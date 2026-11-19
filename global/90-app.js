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
    var runningBar = document.getElementById('term-running');
    var runningName = document.getElementById('running-name');
    var stopBtn = document.getElementById('btn-stop');
    var editor = document.getElementById('editor');
    var editorTitle = document.getElementById('editor-title');
    var editorState = document.getElementById('editor-state');
    var editorText = document.getElementById('editor-text');
    var editorError = document.getElementById('editor-error');
    var editorSave = document.getElementById('editor-save');
    var editorCancel = document.getElementById('editor-cancel');
    var FileTree = window.LinuxFileTree;
    var Fs = window.LinuxFs;
    var treeEl = document.getElementById('tree');
    var treePerms = document.getElementById('tree-perms');
    var treeHidden = document.getElementById('tree-hidden');
    var treeNote = document.getElementById('tree-note');
    var preview = document.getElementById('preview');
    var previewName = document.getElementById('preview-name');
    var previewText = document.getElementById('preview-text');
    var previewClose = document.getElementById('preview-close');
    var keybar = document.getElementById('keybar');

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

    /* ---------- file tree ---------- */

    var overrides = {};
    var shownFs = null;
    var shownCwd = null;
    var fresh = { added: {}, changed: {} };
    var freshTimer = null;
    var noteTimer = null;

    function setFresh(d) {
        fresh = { added: {}, changed: {} };
        d.added.forEach(function (p) { fresh.added[p] = true; });
        d.changed.forEach(function (p) { fresh.changed[p] = true; });
        clearTimeout(freshTimer);
        freshTimer = setTimeout(function () { fresh = { added: {}, changed: {} }; renderTree(); }, 2400);
        clearTimeout(noteTimer);
        if (d.removed.length) {
            var shown = d.removed.slice(0, 3).map(function (p) { return p.split('/').pop(); }).join(', ');
            treeNote.textContent = 'মোছা হলো: ' + shown + (d.removed.length > 3 ? ' ও আরও ' + String(d.removed.length - 3).replace(/\d/g, function (n) { return '০১২৩৪৫৬৭৮৯'.charAt(n); }) + 'টা' : '');
            treeNote.hidden = false;
            noteTimer = setTimeout(function () { treeNote.hidden = true; }, 3200);
        }
    }

    function icon(row) {
        if (row.locked) return '🔒';
        if (row.kind === 'dir') return row.open ? '📂' : '📁';
        if (row.kind === 'link') return '🔗';
        return '📄';
    }

    function showPreview(row) {
        var found = Fs.lookup(session.state.fs, Fs.USERS[session.state.user], row.path);
        var node = found.node;
        if (!node || node.kind === 'dir') return;
        previewName.textContent = row.path;
        var text = node.kind === 'link' ? '→ ' + node.target : node.content;
        previewText.textContent = !Fs.can(node, Fs.USERS[session.state.user], 'r') ? '(পড়ার অধিকার নেই)' : text.length > 4000 ? text.slice(0, 4000) + '\n…' : text || '(ফাইল খালি)';
        preview.hidden = false;
    }

    function renderTree() {
        var state = session.state;
        if (shownFs !== state.fs) {
            if (shownFs) {
                var d = FileTree.diff(shownFs, state.fs);
                if (d.added.length || d.changed.length || d.removed.length) setFresh(d);
            }
            shownFs = state.fs;
        }
        if (shownCwd !== state.cwd) {
            Object.keys(FileTree.expandedFor(state.cwd)).forEach(function (p) { delete overrides[p]; });
            shownCwd = state.cwd;
        }
        var expanded = Object.assign(FileTree.expandedFor(state.cwd), overrides);
        var rows = FileTree.rows(state, { expanded: expanded, showHidden: treeHidden.checked });
        var frag = document.createDocumentFragment();
        rows.forEach(function (row) {
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'tree-row' + (row.path === state.cwd ? ' cwd' : '') + (fresh.added[row.path] ? ' fresh' : '') + (fresh.changed[row.path] ? ' touched' : '') + (row.hidden ? ' dim' : '');
            el.style.paddingLeft = (8 + row.depth * 14) + 'px';
            el.setAttribute('role', 'treeitem');
            el.dataset.path = row.path;
            if (row.kind === 'dir') el.setAttribute('aria-expanded', String(row.open));
            var name = document.createElement('span');
            name.className = 'name';
            name.textContent = icon(row) + ' ' + row.name + (row.kind === 'dir' && row.name !== '/' ? '/' : '') + (row.target ? ' → ' + row.target : '');
            el.appendChild(name);
            if (treePerms.checked) {
                var perm = document.createElement('span');
                perm.className = 'perm';
                perm.textContent = row.mode + ' ' + row.owner;
                el.appendChild(perm);
            }
            el.addEventListener('click', function () {
                if (row.kind === 'dir') {
                    if (row.locked) return;
                    overrides[row.path] = !row.open;
                    renderTree();
                } else showPreview(row);
            });
            frag.appendChild(el);
        });
        treeEl.textContent = '';
        treeEl.appendChild(frag);
    }

    treePerms.addEventListener('change', renderTree);
    treeHidden.addEventListener('change', renderTree);
    previewClose.addEventListener('click', function () { preview.hidden = true; });

    function openEditor() {
        var edit = session.editing;
        editorTitle.textContent = edit.shown;
        editorText.value = edit.content;
        editorText.readOnly = !edit.writable;
        editorSave.disabled = !edit.writable;
        editorState.textContent = !edit.writable ? 'শুধু পড়া যাবে, লেখার অধিকার নেই' : edit.exists ? '' : 'নতুন ফাইল';
        editorError.hidden = true;
        editor.hidden = false;
        editorText.focus();
    }

    function closeEditor() {
        editor.hidden = true;
        input.focus();
    }

    function render() {
        var frag = document.createDocumentFragment();
        session.lines.forEach(function (line) { frag.appendChild(lineElement(line)); });
        out.textContent = '';
        out.appendChild(frag);
        promptEl.textContent = Shell.prompt(session.state);
        undoBtn.disabled = session.past.length === 0 || !!session.running || !!session.editing;
        form.hidden = !!session.running;
        runningBar.hidden = !session.running;
        if (session.running) runningName.textContent = session.running.name;
        renderTree();
        if (session.editing && editor.hidden) openEditor();
        if (!session.editing && !editor.hidden) closeEditor();
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

    function doTab() {
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
    }

    function interruptInput() {
        session = Session.interrupt(session, input.value);
        input.value = '';
        render();
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); recall(-1); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); recall(1); return; }
        if (e.key === 'Tab') { e.preventDefault(); doTab(); return; }
        lastTab = '';
        if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); run('clear'); return; }
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); interruptInput(); }
    });

    // মোবাইলে keyboard-এ না থাকা key। mousedown থামালে input-এর focus (আর keyboard) সরে যায় না
    keybar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    keybar.addEventListener('click', function (e) {
        var button = e.target.closest('button');
        if (!button) return;
        if (button.dataset.insert) {
            input.setRangeText(button.dataset.insert, input.selectionStart, input.selectionEnd, 'end');
            lastTab = '';
        } else if (button.dataset.key === 'Tab') doTab();
        else if (button.dataset.key === 'Up') recall(-1);
        else if (button.dataset.key === 'Down') recall(1);
        else if (button.dataset.key === 'Ctrl+C') {
            if (session.running) stop();
            else interruptInput();
        }
        if (!session.running) input.focus();
    });

    term.addEventListener('click', function () {
        if (!window.getSelection || window.getSelection().toString() === '') input.focus();
    });

    function stop() {
        if (!session.running) return;
        session = Session.stopRunning(session);
        commit();
        input.focus();
    }

    stopBtn.addEventListener('click', stop);
    document.addEventListener('keydown', function (e) {
        if (session.running && e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); stop(); }
        if (!editor.hidden && e.key === 'Escape') { e.preventDefault(); session = Session.cancelEdit(session); render(); }
        if (!editor.hidden && e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveEdit(); }
    });

    function saveEdit() {
        if (!session.editing || !session.editing.writable) return;
        var result = Session.saveFile(session, session.editing.path, editorText.value, session.editing.shown);
        if (result.error) {
            editorError.textContent = result.error;
            editorError.hidden = false;
            return;
        }
        session = result.session;
        commit();
    }

    editorSave.addEventListener('click', saveEdit);
    editorCancel.addEventListener('click', function () {
        session = Session.cancelEdit(session);
        render();
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
