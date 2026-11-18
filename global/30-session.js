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
        if (result.explain) lines.push(line(result.code === 0 ? 'explain' : 'explain-error', result.explain));

        var step = Missions.nextStep(s.step, { prev: s.state, next: result.state, command: command, ok: result.code === 0, stdout: result.stdout });
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
            nextId: nextId
        }));
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
            var result = Shell.run(state, command, { history: [], status: status });
            status = result.code;
            if (!stateChanged(state, result.state)) return;
            past.push({ state: state, step: step, command: command });
            step = Missions.nextStep(step, { prev: state, next: result.state, command: command, ok: result.code === 0, stdout: result.stdout });
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

    function isStringArray(x) {
        return Array.isArray(x) && x.every(function (v) { return typeof v === 'string'; });
    }

    var api = {
        MAX_LOG: MAX_LOG, KEEP_LOG: KEEP_LOG, MAX_LINES: MAX_LINES, MAX_HISTORY: MAX_HISTORY,
        stateChanged: stateChanged, freshSession: freshSession, compact: compact, applyCommand: applyCommand,
        showCompletions: showCompletions, interrupt: interrupt, undo: undo, replay: replay, isValidLines: isValidLines, isStringArray: isStringArray
    };
    if (isNode) module.exports = api;
    else root.LinuxSession = api;
})(typeof self !== 'undefined' ? self : this);
