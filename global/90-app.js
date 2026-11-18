// DOM-এর কাজ: terminal আঁকা, কী চাপা, Undo আর Reset। বাকি সব যুক্তি অন্য ফাইলে।
(function () {
    var out = document.getElementById('term-out');
    if (!out) return;

    var Session = window.LinuxSession;
    var Storage = window.LinuxStorage;
    var Complete = window.LinuxComplete;
    var Text = window.LinuxText;
    var Shell = window.LinuxShell;

    var form = document.getElementById('term-form');
    var input = document.getElementById('term-input');
    var promptEl = document.getElementById('term-prompt');
    var term = document.getElementById('term');
    var undoBtn = document.getElementById('btn-undo');
    var resetBtn = document.getElementById('btn-reset');
    var notice = document.getElementById('term-notice');

    var session;
    var historyIndex = -1;
    var draft = '';
    var lastTab = '';

    function showNotice(message) {
        notice.textContent = message || '';
        notice.hidden = !message;
    }

    function start() {
        var loaded = Storage.load();
        if (loaded.status === 'ok') {
            session = loaded.session;
        } else {
            session = Session.freshSession();
            if (loaded.status === 'corrupt') showNotice(Text.corruptSave);
        }
    }

    // `ব্যাকটিক`-এর ভেতরের অংশ code হয়ে যায়
    function fillRich(el, text) {
        text.split('`').forEach(function (part, i) {
            if (i % 2 === 1) {
                var code = document.createElement('code');
                code.textContent = part;
                el.appendChild(code);
            } else if (part) {
                el.appendChild(document.createTextNode(part));
            }
        });
    }

    function lineElement(line) {
        var el;
        if (line.kind === 'input') {
            el = document.createElement('div');
            el.className = 'line input';
            var p = document.createElement('span');
            p.className = 'prompt';
            p.textContent = line.prompt + ' ';
            var c = document.createElement('span');
            c.className = 'cmd';
            c.textContent = line.text;
            el.appendChild(p);
            el.appendChild(c);
            return el;
        }
        if (line.kind === 'output' || line.kind === 'error') {
            el = document.createElement('pre');
            el.className = 'line ' + line.kind;
            el.textContent = line.text;
            return el;
        }
        el = document.createElement('div');
        el.className = 'line ' + (line.kind === 'welcome' ? 'note' : line.kind);
        if (line.kind !== 'welcome') {
            var tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = line.kind === 'explain-error' ? 'সমস্যা' : 'ব্যাখ্যা';
            el.appendChild(tag);
        }
        var body = document.createElement('span');
        body.className = 'body';
        fillRich(body, line.text);
        el.appendChild(body);
        return el;
    }

    function render() {
        var frag = document.createDocumentFragment();
        session.lines.forEach(function (line) { frag.appendChild(lineElement(line)); });
        out.textContent = '';
        out.appendChild(frag);
        promptEl.textContent = Shell.prompt(session.state);
        undoBtn.disabled = session.past.length === 0;
        term.scrollTop = term.scrollHeight;
    }

    function commit() {
        showNotice(Storage.save(session) ? '' : Text.saveFailed);
        render();
    }

    function run(command) {
        session = Session.applyCommand(session, command);
        historyIndex = -1;
        draft = '';
        lastTab = '';
        input.value = '';
        commit();
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        run(input.value);
    });

    function recall(direction) {
        var history = session.history;
        if (!history.length) return;
        if (historyIndex === -1) {
            if (direction > 0) return;
            draft = input.value;
            historyIndex = history.length - 1;
        } else {
            historyIndex += direction;
            if (historyIndex >= history.length) { historyIndex = -1; input.value = draft; return; }
            if (historyIndex < 0) historyIndex = 0;
        }
        input.value = history[historyIndex];
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); recall(-1); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); recall(1); return; }
        if (e.key === 'Tab') {
            e.preventDefault();
            var result = Complete.complete(session.state, input.value);
            if (!result.candidates.length) return;
            if (result.text !== input.value) { input.value = result.text; lastTab = ''; return; }
            if (lastTab === input.value && result.candidates.length > 1) {
                session = Session.showCompletions(session, input.value, result.candidates);
                render();
                lastTab = '';
            } else {
                lastTab = input.value;
            }
            return;
        }
        lastTab = '';
        if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); run('clear'); return; }
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            session = Session.interrupt(session, input.value);
            input.value = '';
            render();
        }
    });

    term.addEventListener('click', function () {
        if (!window.getSelection || window.getSelection().toString() === '') input.focus();
    });

    undoBtn.addEventListener('click', function () {
        session = Session.undo(session);
        commit();
        input.focus();
    });

    resetBtn.addEventListener('click', function () {
        if (session.log.length && !window.confirm('সব শুরুর অবস্থায় ফিরবে। চালিয়ে যাবেন?')) return;
        Storage.clear();
        session = Session.freshSession();
        session = Object.assign({}, session, { lines: session.lines.concat([{ id: session.nextId, kind: 'welcome', text: Text.resetDone }]), nextId: session.nextId + 1 });
        commit();
        input.focus();
    });

    Storage.watch(function (result) {
        if (result.status !== 'ok') return;
        session = result.session;
        render();
    });

    start();
    render();
})();
