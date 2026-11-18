// file tree-র জন্য: কোন সারি দেখাবে, আর এক command-এর পরে কী বদলাল (DOM ছাড়া, তাই test করা যায়)
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;

    // এখনকার জায়গা পর্যন্ত সব ফোল্ডার খোলা: { '/': true, '/home': true, ... }
    function expandedFor(cwd) {
        var open = { '/': true };
        var walked = '';
        Path.split(cwd).forEach(function (part) {
            walked += '/' + part;
            open[walked] = true;
        });
        return open;
    }

    // সারির তালিকা। opts: { expanded: {path: true}, user: 'dev', showHidden: true }
    // সারি: { path, name, depth, kind, mode, owner, group, size, target, open, locked, hidden }
    function rows(state, opts) {
        var expanded = opts.expanded || {};
        var user = Fs.USERS[opts.user || state.user];
        var list = [];

        function walk(abs, name, node, depth) {
            var open = node.kind === 'dir' && !!expanded[abs];
            var locked = node.kind === 'dir' && (!Fs.can(node, user, 'r') || !Fs.can(node, user, 'x'));
            list.push({
                path: abs,
                name: name,
                depth: depth,
                kind: node.kind,
                mode: Fs.modeString(node),
                owner: node.meta.owner,
                group: node.meta.group,
                size: Fs.sizeOf(node),
                target: node.kind === 'link' ? node.target : '',
                open: open && !locked,
                locked: locked,
                hidden: name.charAt(0) === '.'
            });
            if (!open || locked) return;
            Fs.names(node).forEach(function (child) {
                if (opts.showHidden === false && child.charAt(0) === '.') return;
                walk(Path.join(abs, child), child, node.children[child], depth + 1);
            });
        }

        walk('/', '/', state.fs, 0);
        return list;
    }

    // দুই tree মিলিয়ে: { added: [path], changed: [path], removed: [path] }
    // tree-র বদল path-copying দিয়ে হয়, তাই একই object মানে বদলায়নি, সেখানে আর ভেতরে যাওয়া লাগে না
    function diff(prevFs, nextFs) {
        var result = { added: [], changed: [], removed: [] };

        function same(a, b) {
            if (a.kind !== b.kind) return false;
            if (a.kind === 'file') return a.content === b.content && sameMeta(a.meta, b.meta);
            if (a.kind === 'link') return a.target === b.target && sameMeta(a.meta, b.meta);
            return sameMeta(a.meta, b.meta);
        }

        function sameMeta(a, b) {
            return a.owner === b.owner && a.group === b.group && a.mode === b.mode && a.mtime === b.mtime;
        }

        function collect(abs, node, into) {
            into.push(abs);
            if (node.kind === 'dir') Object.keys(node.children).forEach(function (name) { collect(Path.join(abs, name), node.children[name], into); });
        }

        function inside(abs, node, into) {
            Object.keys(node.children).forEach(function (name) { collect(Path.join(abs, name), node.children[name], into); });
        }

        function walk(abs, a, b) {
            if (a === b) return;
            if (!same(a, b)) result.changed.push(abs);
            if (a.kind !== 'dir' || b.kind !== 'dir') {
                // ফোল্ডার ফাইল হয়ে গেলে (বা উল্টো) ভেতরের সবকিছু মোছা বা নতুন ধরা হয়
                if (a.kind === 'dir') inside(abs, a, result.removed);
                if (b.kind === 'dir') inside(abs, b, result.added);
                return;
            }
            Object.keys(a.children).forEach(function (name) {
                var child = Path.join(abs, name);
                if (!Fs.has(b.children, name)) collect(child, a.children[name], result.removed);
                else walk(child, a.children[name], b.children[name]);
            });
            Object.keys(b.children).forEach(function (name) {
                if (!Fs.has(a.children, name)) collect(Path.join(abs, name), b.children[name], result.added);
            });
        }

        walk('/', prevFs, nextFs);
        return result;
    }

    var api = { rows: rows, diff: diff, expandedFor: expandedFor };
    if (isNode) module.exports = api;
    else root.LinuxFileTree = api;
})(typeof self !== 'undefined' ? self : this);
