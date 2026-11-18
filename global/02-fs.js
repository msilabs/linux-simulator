// নকল file system। সব বদল immutable: পুরোনো tree বদলায় না, নতুন tree ফেরত আসে।
// node: { kind: 'file', content, meta } | { kind: 'dir', children, meta } | { kind: 'link', target, meta }
// meta: { owner, group, mode, mtime }; mode যেমন 0o755, mtime হলো ক্রমিক সময় (মিনিট)
(function (root) {
    var Path = typeof module !== 'undefined' && module.exports ? require('./01-path.js') : root.LinuxPath;

    var USERS = {
        dev: { name: 'dev', group: 'dev', home: '/home/dev' },
        root: { name: 'root', group: 'root', home: '/root' }
    };

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

    // path-এর শেষ node-টা, আর কোথাও আটকালে error। ফোল্ডার পেরোতে `x` অধিকার লাগে।
    // result: { node } অথবা { error: 'ENOENT' | 'ENOTDIR' | 'EACCES', path }
    function lookup(fs, user, abs, followLinks) {
        var parts = Path.split(abs);
        var node = fs;
        var walked = '';
        for (var i = 0; i < parts.length; i++) {
            if (node.kind === 'link' && followLinks !== false) {
                var target = lookup(fs, user, Path.resolve('/', node.target, '/'), true);
                if (target.error) return target;
                node = target.node;
            }
            if (node.kind !== 'dir') return { error: 'ENOTDIR', path: walked || '/' };
            if (!can(node, user, 'x')) return { error: 'EACCES', path: walked || '/' };
            walked += '/' + parts[i];
            if (!has(node.children, parts[i])) return { error: 'ENOENT', path: walked };
            node = node.children[parts[i]];
        }
        if (node.kind === 'link' && followLinks !== false) {
            var end = lookup(fs, user, Path.resolve('/', node.target, '/'), true);
            if (end.error) return end;
            node = end.node;
        }
        return { node: node };
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

    function sortKey(name) {
        return name.toLowerCase().replace(/[^a-z0-9\u0080-￿]/g, '');
    }

    // Ubuntu-র সাধারণ locale-এর মতো: বড়-ছোট হাতের ভেদ আর শুরুর . না ধরে সাজানো
    function compareNames(a, b) {
        var ka = sortKey(a);
        var kb = sortKey(b);
        if (ka < kb) return -1;
        if (ka > kb) return 1;
        return a < b ? -1 : a > b ? 1 : 0;
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
        USERS: USERS, has: has, meta: meta, file: file, dir: dir, link: link,
        lookup: lookup, can: can, update: update, names: names, compareNames: compareNames,
        modeString: modeString, sizeOf: sizeOf
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxFs = api;
})(typeof self !== 'undefined' ? self : this);
