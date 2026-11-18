// terminal session-এর যুক্তি (DOM ছাড়া): command চালানো, undo, সেভ থেকে ফেরানো।
//
// সেভের কৌশল: shell deterministic, তাই পুরো state বারবার সেভ না করে রাখি একটা ভিত্তি-state (`base`)
// আর তার পরে চালানো state-বদলানো command-এর তালিকা (`log`)। রিলোডে command-গুলো আবার চালালে
// হুবহু একই state ফিরে আসে। তালিকা লম্বা হলে পুরোনো অংশ ভিত্তিতে ঢুকিয়ে দিই (`compact`),
// তাই সেভের আকার সীমার মধ্যে থাকে।
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Text = isNode ? require('./06-text.js') : root.LinuxText;
    var Seed = isNode ? require('./03-seed.js') : root.LinuxSeed;
    var Shell = isNode ? require('./20-shell.js') : root.LinuxShell;
    var Missions = isNode ? require('./25-missions.js') : root.LinuxMissions;

    // তালিকা এর চেয়ে লম্বা হলে ছোট করা হয়; ছোট করার পর KEEP_LOG সংখ্যক command (অর্থাৎ এত ধাপের undo) থাকে
    var MAX_LOG = 200;
    var KEEP_LOG = 100;
    var MAX_LINES = 400;
    var MAX_HISTORY = 100;

    var LINE_KINDS = ['input', 'output', 'error', 'explain', 'explain-error', 'welcome'];

    function stateChanged(a, b) {
        return a.fs !== b.fs || a.cwd !== b.cwd || a.env !== b.env || a.aliases !== b.aliases || a.processes !== b.processes;
    }

    function freshSession(welcome) {
        var state = Seed.createState();
        return {
            state: state,
            base: state,
            log: [],
            past: [],
            lines: [{ id: 1, kind: 'welcome', text: welcome === undefined ? Text.welcome : welcome }],
            history: [],
            step: 0,
            status: 0,
            running: null,
            editing: null,
            nextId: 2
        };
    }

    function compact(s) {
        if (s.log.length <= MAX_LOG) return s;
        var drop = s.log.length - KEEP_LOG;
        return Object.assign({}, s, { base: s.past[drop].state, log: s.log.slice(drop), past: s.past.slice(drop) });
    }

    function trimEnd(text) {
        return text.replace(/\n+$/, '');
    }

    function applyCommand(s, command) {
        if (s.running || s.editing) return s;
        var nextId = s.nextId;
        function line(kind, text, prompt) {
            return { id: nextId++, kind: kind, text: text, prompt: prompt };
        }

        var input = line('input', command, Shell.prompt(s.state));
        if (!command.trim()) return Object.assign({}, s, { lines: s.lines.concat([input]), nextId: nextId });

        var history = s.history[s.history.length - 1] === command ? s.history : s.history.concat([command]);
        history = history.slice(-MAX_HISTORY);
        var result = Shell.run(s.state, command, { history: history, status: s.status });

        if (result.clear) return Object.assign({}, s, { lines: [], history: history, status: result.code, nextId: nextId });

        var lines = s.lines.concat([input]);
        if (result.stdout) lines.push(line('output', trimEnd(result.stdout)));
        if (result.stderr) lines.push(line('error', trimEnd(result.stderr)));
        if (result.explain) lines.push(line(result.explainError ? 'explain-error' : 'explain', result.explain));

        var step = Missions.nextStep(s.step, { prev: s.state, next: result.state, command: command, ok: result.code === 0, stdout: result.stdout, stderr: result.stderr, errno: result.errno, waiting: !!result.waiting });
        var before = Missions.missionAt(s.step).index;
        var after = Missions.missionAt(step).index;
        if (after > before) {
            var finished = Missions.MISSIONS[before];
            var upcoming = Missions.MISSIONS[after];
            lines.push(line('welcome', Text.missionDone(finished.title, after + 1, upcoming ? upcoming.title : null)));
        }

        var changed = stateChanged(s.state, result.state);
        return compact(Object.assign({}, s, {
            state: result.state,
            log: changed ? s.log.concat([command]) : s.log,
            past: changed ? s.past.concat([{ state: s.state, step: s.step, command: command }]) : s.past,
            lines: lines.slice(-MAX_LINES),
            history: history,
            step: step,
            status: result.code,
            running: result.waiting ? { command: command, name: result.waiting.name } : null,
            editing: result.edit || null,
            nextId: nextId
        }));
    }

    // চলতে থাকা program (tail -f, sleep) Ctrl+C দিয়ে থামানো
    function stopRunning(s) {
        if (!s.running) return s;
        var id = s.nextId;
        var step = Missions.nextStep(s.step, { prev: s.state, next: s.state, command: s.running.command, ok: true, stdout: '', stderr: '', waiting: false, stopped: true });
        var lines = s.lines.concat([
            { id: id, kind: 'output', text: '^C' },
            { id: id + 1, kind: 'explain', text: Text.stopped }
        ]);
        var finished = Missions.missionAt(s.step).index;
        if (Missions.missionAt(step).index > finished) {
            var upcoming = Missions.MISSIONS[Missions.missionAt(step).index];
            lines.push({ id: id + 2, kind: 'welcome', text: Text.missionDone(Missions.MISSIONS[finished].title, finished + 2, upcoming ? upcoming.title : null) });
        }
        return Object.assign({}, s, { running: null, step: step, status: 130, lines: lines.slice(-MAX_LINES), nextId: id + (lines.length - s.lines.length) });
    }

    // editor থেকে সেভ। ভুল হলে editor খোলা থাকে আর error ফেরত আসে।
    function saveFile(s, path, content, shown) {
        if (!s.editing) return { session: s };
        var written = Shell.writeFile(s.state, path, content);
        if (written.error) return { session: s, error: written.error.replace(/^bash: /, '').replace(/\n$/, '') };
        var label = 'nano ' + (shown || path);
        var id = s.nextId;
        var session = Object.assign({}, s, {
            state: written.state,
            log: s.log.concat([{ type: 'write', path: path, content: content, label: label }]),
            past: s.past.concat([{ state: s.state, step: s.step, command: label }]),
            lines: s.lines.concat([{ id: id, kind: 'welcome', text: Text.fileSaved(path) }]).slice(-MAX_LINES),
            editing: null,
            nextId: id + 1
        });
        return { session: compact(session) };
    }

    function cancelEdit(s) {
        return s.editing ? Object.assign({}, s, { editing: null }) : s;
    }

    // পরপর দুইবার Tab: লেখা লাইনটা আর মিলগুলোর তালিকা দেখায়। কোনো command চলে না।
    function showCompletions(s, text, candidates) {
        var input = { id: s.nextId, kind: 'input', text: text, prompt: Shell.prompt(s.state) };
        var list = { id: s.nextId + 1, kind: 'output', text: candidates.join('  ') };
        return Object.assign({}, s, { lines: s.lines.concat([input, list]).slice(-MAX_LINES), nextId: s.nextId + 2 });
    }

    // Ctrl+C: লেখা লাইনটা ^C সহ পর্দায় থেকে যায়, কিছু চলে না
    function interrupt(s, text) {
        var input = { id: s.nextId, kind: 'input', text: text + '^C', prompt: Shell.prompt(s.state) };
        return Object.assign({}, s, { lines: s.lines.concat([input]).slice(-MAX_LINES), nextId: s.nextId + 1 });
    }

    function undo(s) {
        var last = s.past[s.past.length - 1];
        if (!last) return s;
        var note = { id: s.nextId, kind: 'welcome', text: Text.undoDone(last.command) };
        return Object.assign({}, s, {
            state: last.state,
            step: last.step,
            log: s.log.slice(0, -1),
            past: s.past.slice(0, -1),
            running: null,
            editing: null,
            lines: s.lines.concat([note]).slice(-MAX_LINES),
            nextId: s.nextId + 1
        });
    }

    // ভিত্তি থেকে command-গুলো আবার চালিয়ে state আর undo-র ইতিহাস বানায়
    function replay(base, log) {
        var state = base;
        var step = 0;
        var status = 0;
        var kept = [];
        var past = [];
        log.forEach(function (command) {
            if (typeof command === 'object') {
                var written = Shell.writeFile(state, command.path, command.content);
                if (written.error) return;
                past.push({ state: state, step: step, command: command.label });
                kept.push(command);
                state = written.state;
                return;
            }
            var result = Shell.run(state, command, { history: [], status: status });
            status = result.code;
            if (!stateChanged(state, result.state)) return;
            past.push({ state: state, step: step, command: command });
            step = Missions.nextStep(step, { prev: state, next: result.state, command: command, ok: result.code === 0, stdout: result.stdout, stderr: result.stderr, errno: result.errno, waiting: !!result.waiting });
            kept.push(command);
            state = result.state;
        });
        return { state: state, log: kept, past: past };
    }

    function isValidLines(x) {
        return Array.isArray(x) && x.every(function (l) {
            return l && typeof l === 'object' && typeof l.id === 'number' && LINE_KINDS.indexOf(l.kind) !== -1 &&
                typeof l.text === 'string' && (l.prompt === undefined || typeof l.prompt === 'string');
        });
    }

    function isLogEntry(x) {
        if (typeof x === 'string') return true;
        return !!x && typeof x === 'object' && x.type === 'write' && typeof x.path === 'string' && x.path.charAt(0) === '/' &&
            typeof x.content === 'string' && typeof x.label === 'string';
    }

    function isValidLog(x) {
        return Array.isArray(x) && x.every(isLogEntry);
    }

    function isStringArray(x) {
        return Array.isArray(x) && x.every(function (v) { return typeof v === 'string'; });
    }

    var api = {
        MAX_LOG: MAX_LOG, KEEP_LOG: KEEP_LOG, MAX_LINES: MAX_LINES, MAX_HISTORY: MAX_HISTORY,
        stateChanged: stateChanged, freshSession: freshSession, compact: compact, applyCommand: applyCommand,
        showCompletions: showCompletions, interrupt: interrupt, stopRunning: stopRunning, saveFile: saveFile, cancelEdit: cancelEdit, undo: undo, replay: replay, isValidLines: isValidLines, isValidLog: isValidLog, isStringArray: isStringArray
    };
    if (isNode) module.exports = api;
    else root.LinuxSession = api;
})(typeof self !== 'undefined' ? self : this);
