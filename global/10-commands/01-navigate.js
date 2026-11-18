// pwd, cd, ls, tree: কোথায় আছি আর ভেতরে কী আছে
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('../01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('../02-fs.js') : root.LinuxFs;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    Registry.register('pwd', {
        desc: 'এখন কোন ফোল্ডারে আছেন তা দেখায়',
        run: function (ctx) {
            return H.ok(ctx.state, ctx.state.cwd + '\n');
        }
    });

    Registry.register('cd', {
        desc: 'অন্য ফোল্ডারে যায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var arg = ctx.args[0];
            var printed = false;
            if (ctx.args.length > 1) return H.fail(state, 'bash: cd: too many arguments\n', 1, 'EARGS');
            if (arg === undefined) arg = '~';
            if (arg === '-') {
                if (!state.env.OLDPWD) return H.fail(state, 'bash: cd: OLDPWD not set\n', 1, 'EOLDPWD');
                arg = state.env.OLDPWD;
                printed = true;
            }
            var abs = H.resolveArg(state, arg);
            var found = Fs.lookup(state.fs, user, abs);
            if (found.error) return H.fail(state, 'bash: cd: ' + arg + ': ' + H.errorText(found.error) + '\n', 1, found.error);
            if (found.node.kind !== 'dir') return H.fail(state, 'bash: cd: ' + arg + ': Not a directory\n', 1, 'ENOTDIR');
            if (!Fs.can(found.node, user, 'x')) return H.fail(state, 'bash: cd: ' + arg + ': Permission denied\n', 1, 'EACCES');
            var env = Object.assign({}, state.env, { OLDPWD: state.cwd, PWD: abs });
            var next = Object.assign({}, state, { cwd: abs, env: env });
            return H.ok(next, printed ? abs + '\n' : '');
        }
    });

    /* ---------- ls ---------- */

    function humanSize(bytes) {
        if (bytes < 1024) return String(bytes);
        var units = ['K', 'M', 'G'];
        var value = bytes / 1024;
        var unit = 0;
        while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
        var shown = value < 10 ? (Math.ceil(value * 10) / 10).toFixed(1) : String(Math.ceil(value));
        return shown + units[unit];
    }

    function blocksOf(node) {
        var size = Fs.sizeOf(node);
        if (node.kind === 'file' && size === 0) return 0;
        return Math.ceil(size / 4096) * 4;
    }

    function linkCount(node) {
        if (node.kind !== 'dir') return 1;
        var subdirs = Object.keys(node.children).filter(function (name) { return node.children[name].kind === 'dir'; }).length;
        return 2 + subdirs;
    }

    function longLines(entries, flags) {
        var rows = entries.map(function (entry) {
            var node = entry.node;
            var size = Fs.sizeOf(node);
            return [
                Fs.modeString(node),
                String(linkCount(node)),
                node.meta.owner,
                node.meta.group,
                flags.h ? humanSize(size) : String(size),
                H.formatTime(node.meta.mtime),
                node.kind === 'link' ? entry.name + ' -> ' + node.target : entry.name
            ];
        });
        var widths = [0, 0, 0, 0, 0];
        rows.forEach(function (row) {
            for (var c = 0; c < 5; c++) widths[c] = Math.max(widths[c], row[c].length);
        });
        function left(text, w) { while (text.length < w) text += ' '; return text; }
        function right(text, w) { while (text.length < w) text = ' ' + text; return text; }
        var total = entries.reduce(function (sum, entry) { return sum + blocksOf(entry.node); }, 0);
        var lines = ['total ' + total];
        rows.forEach(function (row) {
            lines.push([row[0], right(row[1], widths[1]), left(row[2], widths[2]), left(row[3], widths[3]), right(row[4], widths[4]), row[5], row[6]].join(' '));
        });
        return lines;
    }

    function entriesOf(dirNode, parentNode, flags) {
        var names = Fs.names(dirNode).filter(function (name) { return flags.a || name.charAt(0) !== '.'; });
        var entries = names.map(function (name) { return { name: name, node: dirNode.children[name] }; });
        if (flags.a) {
            entries.push({ name: '.', node: dirNode });
            entries.push({ name: '..', node: parentNode || dirNode });
            entries.sort(function (a, b) { return Fs.compareNames(a.name, b.name); });
        }
        return entries;
    }

    function formatEntries(entries, flags, tty) {
        if (flags.l) return longLines(entries, flags).join('\n') + '\n';
        if (!entries.length) return '';
        var names = entries.map(function (entry) { return entry.name; });
        if (tty && !flags['1']) return names.join('  ') + '\n';
        return names.join('\n') + '\n';
    }

    function joinDisplay(display, name) {
        return display.charAt(display.length - 1) === '/' ? display + name : display + '/' + name;
    }

    Registry.register('ls', {
        desc: 'ফোল্ডারের ভেতরের ফাইল দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'ls', flags: 'laRh1' });
            if (parsed.error) return H.fail(state, parsed.error, 2, 'EOPT');
            var flags = parsed.flags;
            var operands = parsed.operands.length ? parsed.operands : ['.'];
            var out = [];
            var err = '';
            var code = 0;
            var firstErrno;

            function problem(text, errno) {
                err += text;
                code = 2;
                if (!firstErrno) firstErrno = errno;
            }

            var files = [];
            var dirs = [];
            operands.forEach(function (operand) {
                var abs = H.resolveArg(state, operand);
                var found = Fs.lookup(state.fs, user, abs);
                if (found.error) return problem("ls: cannot access '" + operand + "': " + H.errorText(found.error) + '\n', found.error);
                if (found.node.kind === 'dir') dirs.push({ operand: operand, abs: abs, node: found.node });
                else files.push({ name: operand, node: found.node });
            });

            if (files.length) out.push(formatEntries(files, flags, ctx.tty).replace(/\n$/, ''));

            var showHeaders = operands.length > 1 || flags.R;

            function listDir(display, abs, node) {
                if (!Fs.can(node, user, 'r')) {
                    problem("ls: cannot open directory '" + display + "': Permission denied\n", 'EACCES');
                    return;
                }
                var parentFound = abs === '/' ? { node: node } : Fs.lookup(state.fs, user, Path.dirname(abs));
                var entries = entriesOf(node, parentFound.node, flags);
                var block = (showHeaders ? display + ':\n' : '') + formatEntries(entries, flags, ctx.tty).replace(/\n$/, '');
                out.push(block);
                if (flags.R) {
                    entries.forEach(function (entry) {
                        if (entry.name === '.' || entry.name === '..' || entry.node.kind !== 'dir') return;
                        listDir(joinDisplay(display, entry.name), Path.join(abs, entry.name), entry.node);
                    });
                }
            }

            dirs.forEach(function (dir) { listDir(dir.operand, dir.abs, dir.node); });

            var text = out.join('\n\n');
            if (text !== '') text += '\n';
            return { state: state, stdout: text, stderr: err, code: code, errno: firstErrno };
        }
    });

    /* ---------- tree ---------- */

    Registry.register('tree', {
        desc: 'ফোল্ডারের ভেতরটা গাছের মতো সাজিয়ে দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'tree', flags: 'ad', valued: 'L' });
            if (parsed.error) return H.fail(state, parsed.error, 2, 'EOPT');
            var flags = parsed.flags;
            var limit = flags.L === undefined ? Infinity : parseInt(flags.L, 10);
            if (flags.L !== undefined && !(limit >= 1)) return H.fail(state, 'tree: Invalid level, must be greater than 0.\n', 1, 'EOPT');
            var operand = parsed.operands[0] || '.';
            var abs = H.resolveArg(state, operand);
            var found = Fs.lookup(state.fs, user, abs);
            if (found.error) return H.fail(state, operand + ' [error opening dir]\n\n0 directories, 0 files\n', 2, found.error);
            if (found.node.kind !== 'dir') return H.ok(state, operand + '\n\n0 directories, 0 files\n');

            var lines = [operand];
            var dirCount = 0;
            var fileCount = 0;

            function walk(node, prefix, depth) {
                if (depth > limit) return;
                if (!Fs.can(node, user, 'r')) { lines[lines.length - 1] += ' [error opening dir]'; return; }
                var names = Fs.names(node).filter(function (name) {
                    if (name.charAt(0) === '.' && !flags.a) return false;
                    return !flags.d || node.children[name].kind === 'dir';
                });
                names.forEach(function (name, index) {
                    var child = node.children[name];
                    var last = index === names.length - 1;
                    lines.push(prefix + (last ? '└── ' : '├── ') + name + (child.kind === 'link' ? ' -> ' + child.target : ''));
                    if (child.kind === 'dir') {
                        dirCount++;
                        walk(child, prefix + (last ? '    ' : '│   '), depth + 1);
                    } else fileCount++;
                });
            }
            walk(found.node, '', 1);

            var summary = dirCount + (dirCount === 1 ? ' directory' : ' directories');
            if (!flags.d) summary += ', ' + fileCount + (fileCount === 1 ? ' file' : ' files');
            return H.ok(state, lines.join('\n') + '\n\n' + summary + '\n');
        }
    });
})(typeof self !== 'undefined' ? self : this);
