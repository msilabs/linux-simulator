// DOM: একটা terminal বসানো। একই পেজে অনেকগুলো চলতে পারে (পাঠের ভেতরের ছোট বাক্স)।
// LinuxTerminal.mount(root, options) root-এর ভেতরে পুরো terminal বানায়।
//   options.session    শুরুর session
//   options.compact    ছোট মাপ: key bar আর নিচের ইঙ্গিত থাকে না
//   options.onCommit   state বা পর্দা বদলানো কাজের পরে (সেভ, যাচাই)
//   options.onRender   প্রতিবার আঁকার পরে (file tree)
//   options.onReset    "শুরু থেকে" চাপলে নতুন session ফেরত দেয়
//   options.confirmReset  কিছু বদলে থাকলে Reset-এর আগে জিজ্ঞেস করে
(function () {
    if (typeof document === 'undefined') return;

    var Session = window.LinuxSession;
    var Complete = window.LinuxComplete;
    var Shell = window.LinuxShell;

    var BN_DIGITS = '০১২৩৪৫৬৭৮৯';

    function bn(n) {
        return String(n).replace(/\d/g, function (d) { return BN_DIGITS.charAt(d); });
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

    var KEYBAR = '<div class="keybar" role="toolbar" aria-label="বিশেষ key">'
        + '<button type="button" data-key="Tab">Tab</button>'
        + '<button type="button" data-key="Up">↑</button>'
        + '<button type="button" data-key="Down">↓</button>'
        + '<button type="button" data-key="Ctrl+C">Ctrl+C</button>'
        + ['|', '~', '/', '-', '&gt;', '.', '*'].map(function (k) { return '<button type="button" data-insert="' + k + '">' + k + '</button>'; }).join('')
        + '</div>';

    function template(compact) {
        return '<div class="term">'
            + '<div class="term-out" role="log" aria-live="polite"></div>'
            + '<form class="term-form" autocomplete="off">'
            + '<label class="term-label"><span class="prompt"></span></label>'
            + '<input class="term-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="command লিখুন">'
            + '</form></div>'
            + (compact ? '' : KEYBAR)
            + '<div class="term-running" hidden><span><code class="running-name"></code> চলছে, শেষ হচ্ছে না।</span>'
            + '<button class="btn small btn-stop" type="button">Ctrl+C দিয়ে থামান</button></div>'
            + '<p class="term-notice" hidden></p>'
            + '<div class="term-actions">'
            + '<button class="btn small btn-undo" type="button" disabled>Undo</button>'
            + '<button class="btn small btn-reset" type="button">শুরু থেকে</button>'
            + (compact ? '' : '<span class="term-hint">Tab = নাম পূরণ · ↑ ↓ = আগের command · Ctrl+L = পর্দা পরিষ্কার</span>')
            + '</div>';
    }

    /* ---------- nano editor: পুরো পেজে একটাই, যে terminal খুলেছে সে-ই মালিক ---------- */

    var editor = null;
    var editorOwner = null;

    function editorEl(name) {
        return document.getElementById('editor-' + name);
    }

    function ensureEditor() {
        if (editor) return editor;
        editor = document.createElement('div');
        editor.className = 'editor';
        editor.id = 'editor';
        editor.hidden = true;
        editor.setAttribute('role', 'dialog');
        editor.setAttribute('aria-modal', 'true');
        editor.setAttribute('aria-labelledby', 'editor-title');
        editor.innerHTML = '<div class="editor-box">'
            + '<div class="editor-head"><strong id="editor-title"></strong><span class="editor-state" id="editor-state"></span></div>'
            + '<textarea class="editor-text" id="editor-text" spellcheck="false" aria-label="ফাইলের লেখা"></textarea>'
            + '<p class="term-notice" id="editor-error" hidden></p>'
            + '<div class="editor-actions">'
            + '<button class="btn primary" type="button" id="editor-save">সেভ (Ctrl+S)</button>'
            + '<button class="btn" type="button" id="editor-cancel">বন্ধ করুন (Esc)</button>'
            + '</div></div>';
        document.body.appendChild(editor);
        editorEl('save').addEventListener('click', function () { if (editorOwner) editorOwner.saveEdit(); });
        editorEl('cancel').addEventListener('click', function () { if (editorOwner) editorOwner.cancelEdit(); });
        document.addEventListener('keydown', function (e) {
            if (editor.hidden || !editorOwner) return;
            if (e.key === 'Escape') { e.preventDefault(); editorOwner.cancelEdit(); }
            if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); editorOwner.saveEdit(); }
        });
        return editor;
    }

    // Ctrl+C পেজের যেকোনো জায়গা থেকে: শেষ যে terminal ব্যবহার হয়েছে, তার চলতে থাকা program থামে
    var active = null;
    document.addEventListener('keydown', function (e) {
        if (active && e.ctrlKey && (e.key === 'c' || e.key === 'C') && active.isRunning()) {
            e.preventDefault();
            active.stop();
        }
    });

    function mount(root, options) {
        options = options || {};
        root.classList.add('term-box');
        if (options.compact) root.classList.add('compact');
        root.innerHTML = template(options.compact);

        var q = function (sel) { return root.querySelector(sel); };
        var term = q('.term');
        var out = q('.term-out');
        var form = q('.term-form');
        var input = q('.term-input');
        var promptEl = q('.term-form .prompt');
        var keybar = q('.keybar');
        var runningBar = q('.term-running');
        var runningName = q('.running-name');
        var stopBtn = q('.btn-stop');
        var notice = q('.term-notice');
        var undoBtn = q('.btn-undo');
        var resetBtn = q('.btn-reset');

        var session = options.session || Session.freshSession();
        var historyIndex = -1;
        var draft = '';
        var lastTab = '';
        var self;

        function showNotice(message) {
            notice.textContent = message || '';
            notice.hidden = !message;
        }

        function openEditor() {
            ensureEditor();
            editorOwner = self;
            var edit = session.editing;
            editorEl('title').textContent = edit.shown;
            editorEl('text').value = edit.content;
            editorEl('text').readOnly = !edit.writable;
            editorEl('save').disabled = !edit.writable;
            editorEl('state').textContent = !edit.writable ? 'শুধু পড়া যাবে, লেখার অধিকার নেই' : edit.exists ? '' : 'নতুন ফাইল';
            editorEl('error').hidden = true;
            editor.hidden = false;
            editorEl('text').focus();
        }

        function closeEditor() {
            editor.hidden = true;
            editorOwner = null;
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
            if (session.editing && editorOwner !== self) openEditor();
            if (!session.editing && editorOwner === self) closeEditor();
            term.scrollTop = term.scrollHeight;
            if (options.onRender) options.onRender(session);
        }

        function commit() {
            if (options.onCommit) options.onCommit(session);
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

        function stop() {
            if (!session.running) return;
            session = Session.stopRunning(session);
            commit();
            input.focus();
        }

        function saveEdit() {
            if (!session.editing || !session.editing.writable) return;
            var result = Session.saveFile(session, session.editing.path, editorEl('text').value, session.editing.shown);
            if (result.error) {
                editorEl('error').textContent = result.error;
                editorEl('error').hidden = false;
                return;
            }
            session = result.session;
            commit();
        }

        function cancelEdit() {
            session = Session.cancelEdit(session);
            render();
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            run(input.value);
        });

        input.addEventListener('focus', function () { active = self; });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowUp') { e.preventDefault(); recall(-1); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); recall(1); return; }
            if (e.key === 'Tab') { e.preventDefault(); doTab(); return; }
            lastTab = '';
            if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); run('clear'); return; }
            if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); e.stopPropagation(); interruptInput(); }
        });

        // মোবাইলে keyboard-এ না থাকা key। mousedown থামালে input-এর focus (আর keyboard) সরে যায় না
        if (keybar) {
            keybar.addEventListener('mousedown', function (e) { e.preventDefault(); });
            keybar.addEventListener('click', function (e) {
                var button = e.target.closest('button');
                if (!button) return;
                active = self;
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
        }

        term.addEventListener('click', function () {
            active = self;
            if (!window.getSelection || window.getSelection().toString() === '') input.focus();
        });

        stopBtn.addEventListener('click', stop);

        undoBtn.addEventListener('click', function () {
            session = Session.undo(session);
            commit();
            input.focus();
        });

        resetBtn.addEventListener('click', function () {
            if (options.confirmReset && session.log.length && !window.confirm('সব শুরুর অবস্থায় ফিরবে। চালিয়ে যাবেন?')) return;
            session = options.onReset ? options.onReset() : Session.freshSession();
            historyIndex = -1;
            input.value = '';
            commit();
            input.focus();
        });

        self = {
            root: root,
            getSession: function () { return session; },
            setSession: function (next) { session = next; render(); },
            run: run,
            stop: stop,
            isRunning: function () { return !!session.running; },
            saveEdit: saveEdit,
            cancelEdit: cancelEdit,
            notice: showNotice,
            focus: function () { input.focus(); }
        };
        if (!active) active = self;
        render();
        // পাঠের বাক্স শুরুতে উপর থেকে দেখায়, যাতে আগে থেকে চালানো প্রথম command চোখে পড়ে
        if (options.compact) term.scrollTop = 0;
        return self;
    }

    window.LinuxTerminal = { mount: mount, fillRich: fillRich, bn: bn };
})();
