// DOM: পাশের ফাইল গাছ। LinuxTreeView.mount(root, getState) root-এর ভেতরে গাছ বানায়, ফেরত দেয় { render }।
// নতুন আর বদলানো জিনিস কিছুক্ষণ রঙিন থাকে, মোছা জিনিসের নাম ছোট বার্তায় আসে।
(function () {
    if (typeof document === 'undefined') return;

    var FileTree = window.LinuxFileTree;
    var Fs = window.LinuxFs;

    var TEMPLATE = '<div class="tree-head"><h2>ফাইল</h2><div class="tree-opts">'
        + '<label><input type="checkbox" class="tree-perms" checked> অধিকার</label>'
        + '<label><input type="checkbox" class="tree-hidden" checked> লুকানো</label>'
        + '</div></div>'
        + '<div class="tree" role="tree" aria-label="ফাইলের গাছ"></div>'
        + '<p class="tree-note" hidden></p>'
        + '<div class="preview" hidden><div class="preview-head"><strong class="preview-name"></strong>'
        + '<button class="btn small preview-close" type="button">বন্ধ</button></div><pre class="preview-text"></pre></div>';

    function icon(row) {
        if (row.locked) return '🔒';
        if (row.kind === 'dir') return row.open ? '📂' : '📁';
        if (row.kind === 'link') return '🔗';
        return '📄';
    }

    function mount(root, getState) {
        root.innerHTML = TEMPLATE;
        var q = function (sel) { return root.querySelector(sel); };
        var treeEl = q('.tree');
        var treePerms = q('.tree-perms');
        var treeHidden = q('.tree-hidden');
        var treeNote = q('.tree-note');
        var preview = q('.preview');
        var previewName = q('.preview-name');
        var previewText = q('.preview-text');

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
            freshTimer = setTimeout(function () { fresh = { added: {}, changed: {} }; render(); }, 2400);
            clearTimeout(noteTimer);
            if (d.removed.length) {
                var shown = d.removed.slice(0, 3).map(function (p) { return p.split('/').pop(); }).join(', ');
                treeNote.textContent = 'মোছা হলো: ' + shown + (d.removed.length > 3 ? ' ও আরও ' + window.LinuxTerminal.bn(d.removed.length - 3) + 'টা' : '');
                treeNote.hidden = false;
                noteTimer = setTimeout(function () { treeNote.hidden = true; }, 3200);
            }
        }

        function showPreview(row) {
            var state = getState();
            var user = Fs.USERS[state.user];
            var node = Fs.lookup(state.fs, user, row.path).node;
            if (!node || node.kind === 'dir') return;
            previewName.textContent = row.path;
            var text = node.kind === 'link' ? '→ ' + node.target : node.content;
            previewText.textContent = !Fs.can(node, user, 'r') ? '(পড়ার অধিকার নেই)' : text.length > 4000 ? text.slice(0, 4000) + '\n…' : text || '(ফাইল খালি)';
            preview.hidden = false;
        }

        function render() {
            var state = getState();
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
                        render();
                    } else showPreview(row);
                });
                frag.appendChild(el);
            });
            treeEl.textContent = '';
            treeEl.appendChild(frag);
        }

        // নতুন শুরু (Reset বা অন্য challenge): পরের render আগের অবস্থার সাথে তুলনা করে রং দেখায় না
        function reset() {
            shownFs = null;
            shownCwd = null;
            overrides = {};
            preview.hidden = true;
        }

        treePerms.addEventListener('change', render);
        treeHidden.addEventListener('change', render);
        q('.preview-close').addEventListener('click', function () { preview.hidden = true; });

        return { render: render, reset: reset };
    }

    window.LinuxTreeView = { mount: mount };
})();
