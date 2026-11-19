// নকল file system। সব বদল immutable: পুরোনো tree বদলায় না, নতুন tree ফেরত আসে।
// node: { kind: 'file', content, meta } | { kind: 'dir', children, meta } | { kind: 'link', target, meta }
// meta: { owner, group, mode, mtime }; mode যেমন 0o755, mtime হলো ক্রমিক সময় (মিনিট)
(function (root) {
    var Path = typeof module !== 'undefined' && module.exports ? require('./01-path.js') : root.LinuxPath;

    var USERS = {
        dev: { name: 'dev', group: 'dev', home: '/home/dev' },
        root: { name: 'root', group: 'root', home: '/root' },
        'www-data': { name: 'www-data', group: 'www-data', home: '/var/www' }
    };
    var GROUPS = ['dev', 'root', 'adm', 'sudo', 'www-data'];

    var hasOwn = Object.prototype.hasOwnProperty;

    function has(children, name) {
        return hasOwn.call(children, name);
    }

    function meta(owner, group, mode, mtime) {
        return { owner: owner, group: group, mode: mode, mtime: mtime || 0 };
    }

    function file(content, m) {
        return { kind: 'file', content: content, meta: m };
    }

    function dir(children, m) {
        return { kind: 'dir', children: children || Object.create(null), meta: m };
    }

    function link(target, m) {
        return { kind: 'link', target: target, meta: m };
    }

    function childrenWith(children, name, node) {
        var copy = Object.assign(Object.create(null), children);
        if (node === null) delete copy[name];
        else copy[name] = node;
        return copy;
    }

    var MAX_LINKS = 8;

    // symlink-এর target পুরো path-এ: relative হলে link যে ফোল্ডারে আছে সেখান থেকে
    function linkTarget(node, linkPath) {
        return Path.resolve(Path.dirname(linkPath), node.target, '/');
    }

    // path-এর শেষ node-টা, আর কোথাও আটকালে error। ফোল্ডার পেরোতে `x` অনুমতি লাগে।
    // মাঝের symlink সবসময় অনুসরণ হয়; শেষেরটা অনুসরণ হয় না যদি followFinal === false (ls -l, rm-এর মতো)।
    // result: { node, path } অথবা { error: 'ENOENT' | 'ENOTDIR' | 'EACCES' | 'ELOOP', path }
    function lookup(fs, user, abs, followFinal, depth) {
        depth = depth || 0;
        if (depth > MAX_LINKS) return { error: 'ELOOP', path: abs };
        var parts = Path.split(abs);
        var node = fs;
        var walked = '';

        function follow(linkNode) {
            return lookup(fs, user, linkTarget(linkNode, walked || '/'), true, depth + 1);
        }

        for (var i = 0; i < parts.length; i++) {
            if (node.kind === 'link') {
                var through = follow(node);
                if (through.error) return through;
                node = through.node;
                walked = through.path === '/' ? '' : through.path;
            }
            if (node.kind !== 'dir') return { error: 'ENOTDIR', path: walked || '/' };
            if (!can(node, user, 'x')) return { error: 'EACCES', path: walked || '/' };
            walked += '/' + parts[i];
            if (!has(node.children, parts[i])) return { error: 'ENOENT', path: walked };
            node = node.children[parts[i]];
        }
        if (node.kind === 'link' && followFinal !== false) {
            var end = follow(node);
            if (end.error) return end;
            return { node: end.node, path: end.path };
        }
        return { node: node, path: walked || '/' };
    }

    // user এই node-এ r, w বা x করতে পারে কিনা (owner, group, other ক্রমে দেখা হয়)
    function can(node, user, kind) {
        var bit = { r: 4, w: 2, x: 1 }[kind];
        if (user.name === 'root') {
            if (kind !== 'x') return true;
            return node.kind === 'dir' || (node.meta.mode & 0o111) !== 0;
        }
        var shift = node.meta.owner === user.name ? 6 : node.meta.group === user.group ? 3 : 0;
        return ((node.meta.mode >> shift) & bit) !== 0;
    }

    // path-এর node বদলায়। fn(পুরোনো node বা null) নতুন node (বা মোছার জন্য null) ফেরত দেয়।
    // parent না থাকলে বা ফোল্ডার না হলে exception।
    function update(fs, abs, fn) {
        var parts = Path.split(abs);
        if (parts.length === 0) {
            var replaced = fn(fs);
            if (!replaced) throw new Error('cannot remove /');
            return replaced;
        }
        function walk(node, index) {
            if (node.kind !== 'dir') throw new Error('not a directory');
            var name = parts[index];
            var current = has(node.children, name) ? node.children[name] : null;
            var next;
            if (index === parts.length - 1) next = fn(current);
            else {
                if (!current) throw new Error('no such directory');
                next = walk(current, index + 1);
            }
            if (next === current) return node;
            return { kind: 'dir', children: childrenWith(node.children, name, next), meta: node.meta };
        }
        return walk(fs, 0);
    }

    // Ubuntu-র (glibc ২.২৮-এর পরের) en_US ক্রমের মতো: বড় হাতের আর ছোট হাতের অক্ষরের তফাত প্রথমে ধরা হয় না,
    // চিহ্ন (. - _ ইত্যাদি) আগে, তারপর অঙ্ক, তারপর অক্ষর। সব এক হলে ছোট হাতের অক্ষর আগে।
    function weight(c) {
        if (/[0-9]/.test(c)) return 1;
        if (/[a-z\u0080-\uffff]/.test(c)) return 2;
        return 0;
    }

    function compareNames(a, b) {
        var la = a.toLowerCase();
        var lb = b.toLowerCase();
        var n = Math.min(la.length, lb.length);
        for (var i = 0; i < n; i++) {
            var ca = la.charAt(i);
            var cb = lb.charAt(i);
            if (ca === cb) continue;
            var wa = weight(ca);
            var wb = weight(cb);
            if (wa !== wb) return wa - wb;
            return ca < cb ? -1 : 1;
        }
        if (la.length !== lb.length) return la.length - lb.length;
        if (a === b) return 0;
        return a > b ? -1 : 1;
    }

    function names(node) {
        return Object.keys(node.children).sort(compareNames);
    }

    function modeString(node) {
        var kind = node.kind === 'dir' ? 'd' : node.kind === 'link' ? 'l' : '-';
        var out = kind;
        for (var shift = 6; shift >= 0; shift -= 3) {
            var bits = (node.meta.mode >> shift) & 7;
            out += (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');
        }
        return out;
    }

    function byteLength(text) {
        var n = 0;
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            if (c < 0x80) n += 1;
            else if (c < 0x800) n += 2;
            else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
            else n += 3;
        }
        return n;
    }

    function sizeOf(node) {
        if (node.kind === 'dir') return 4096;
        if (node.kind === 'link') return byteLength(node.target);
        return byteLength(node.content);
    }

    var api = {
        USERS: USERS, GROUPS: GROUPS, has: has, meta: meta, file: file, dir: dir, link: link,
        lookup: lookup, can: can, update: update, names: names, compareNames: compareNames,
        modeString: modeString, sizeOf: sizeOf, byteLength: byteLength
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxFs = api;
})(typeof self !== 'undefined' ? self : this);
