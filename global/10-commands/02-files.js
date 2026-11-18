// mkdir, rmdir, touch, cat, echo, cp, mv, rm: ফাইল আর ফোল্ডার বানানো, পড়া, সরানো, মোছা
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('../01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('../02-fs.js') : root.LinuxFs;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    var MISSING_OPERAND = function (name) {
        return name + ": missing operand\nTry '" + name + " --help' for more information.\n";
    };

    function flagError(state, parsed) {
        return H.fail(state, parsed.error, 1, 'EOPT');
    }

    function addEntry(state, abs, node) {
        return Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return node; }) });
    }

    function removeEntry(state, abs) {
        return Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return null; }) });
    }

    /* ---------- mkdir ---------- */

    Registry.register('mkdir', {
        desc: 'নতুন ফোল্ডার বানায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'mkdir', flags: 'pv' });
            if (parsed.error) return flagError(state, parsed);
            if (!parsed.operands.length) return H.fail(state, MISSING_OPERAND('mkdir'), 1, 'EOPERAND');
            var err = '';
            var out = '';
            var errno;

            parsed.operands.forEach(function (operand) {
                var abs = H.resolveArg(state, operand);
                var existing = Fs.lookup(state.fs, user, abs);
                if (!existing.error) {
                    if (parsed.flags.p && existing.node.kind === 'dir') return;
                    err += 'mkdir: ' + operand + ': File exists\n';
                    errno = errno || 'EEXIST';
                    return;
                }
                var toCreate = [abs];
                if (parsed.flags.p) {
                    var up = Path.dirname(abs);
                    while (up !== '/' && Fs.lookup(state.fs, user, up).error === 'ENOENT') { toCreate.unshift(up); up = Path.dirname(up); }
                }
                for (var i = 0; i < toCreate.length; i++) {
                    var check = H.checkParent(state, toCreate[i]);
                    if (check.error) {
                        err += "mkdir: cannot create directory '" + operand + "': " + H.errorText(check.error) + '\n';
                        errno = errno || check.error;
                        return;
                    }
                    state = addEntry(state, toCreate[i], Fs.dir(Object.create(null), H.newMeta(state, 0o755)));
                    if (parsed.flags.v) out += "mkdir: created directory '" + (i === toCreate.length - 1 ? operand : toCreate[i]) + "'\n";
                }
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- rmdir ---------- */

    Registry.register('rmdir', {
        desc: 'খালি ফোল্ডার মোছে',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'rmdir', flags: 'p' });
            if (parsed.error) return flagError(state, parsed);
            if (!parsed.operands.length) return H.fail(state, MISSING_OPERAND('rmdir'), 1, 'EOPERAND');
            var err = '';
            var errno;

            parsed.operands.forEach(function (operand) {
                var abs = H.resolveArg(state, operand);
                var current = abs;
                for (;;) {
                    var found = Fs.lookup(state.fs, user, current);
                    var problem = found.error ||
                        (found.node.kind !== 'dir' ? 'ENOTDIR' : Object.keys(found.node.children).length ? 'ENOTEMPTY' : current === '/' ? 'EBUSY' : null);
                    if (!problem) {
                        var check = H.checkParent(state, current);
                        if (check.error) problem = check.error;
                    }
                    if (problem) {
                        if (current === abs || !parsed.flags.p) {
                            err += "rmdir: failed to remove '" + (current === abs ? operand : current) + "': " + H.errorText(problem) + '\n';
                            errno = errno || problem;
                        }
                        return;
                    }
                    state = removeEntry(state, current);
                    if (!parsed.flags.p) return;
                    current = Path.dirname(current);
                    if (current === '/' || current === state.cwd) return;
                }
            });
            return { state: state, stdout: '', stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- touch ---------- */

    Registry.register('touch', {
        desc: 'খালি ফাইল বানায়, ফাইল থাকলে তার সময় নতুন করে',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'touch', flags: 'c' });
            if (parsed.error) return flagError(state, parsed);
            if (!parsed.operands.length) return H.fail(state, 'touch: missing file operand\nTry \'touch --help\' for more information.\n', 1, 'EOPERAND');
            var err = '';
            var errno;

            parsed.operands.forEach(function (operand) {
                var abs = H.resolveArg(state, operand);
                var found = Fs.lookup(state.fs, user, abs);
                if (!found.error) {
                    var node = found.node;
                    if (node.meta.owner !== user.name && !Fs.can(node, user, 'w')) {
                        err += "touch: cannot touch '" + operand + "': Permission denied\n";
                        errno = errno || 'EACCES';
                        return;
                    }
                    var meta = Object.assign({}, node.meta, { mtime: state.clock });
                    state = addEntry(state, abs, Object.assign({}, node, { meta: meta }));
                    return;
                }
                if (parsed.flags.c) return;
                var check = found.error === 'ENOENT' ? H.checkParent(state, abs) : { error: found.error };
                if (check.error) {
                    err += "touch: cannot touch '" + operand + "': " + H.errorText(check.error) + '\n';
                    errno = errno || check.error;
                    return;
                }
                state = addEntry(state, abs, Fs.file('', H.newMeta(state, 0o644)));
            });
            return { state: state, stdout: '', stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- cat ---------- */

    Registry.register('cat', {
        desc: 'ফাইলের লেখা পর্দায় দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'cat', flags: 'n' });
            if (parsed.error) return flagError(state, parsed);
            var operands = parsed.operands;
            if (!operands.length) {
                if (ctx.stdin === null || ctx.stdin === undefined) return H.fail(state, 'cat: কোনো ফাইলের নাম দিন (এই simulator-এ keyboard থেকে পড়া যায় না)\n', 1, 'EOPERAND');
                operands = ['-'];
            }
            var out = '';
            var err = '';
            var errno;
            operands.forEach(function (operand) {
                if (operand === '-') { out += ctx.stdin || ''; return; }
                var found = Fs.lookup(state.fs, user, H.resolveArg(state, operand));
                if (found.error) { err += 'cat: ' + operand + ': ' + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                if (found.node.kind === 'dir') { err += 'cat: ' + operand + ': Is a directory\n'; errno = errno || 'EISDIR'; return; }
                if (!Fs.can(found.node, user, 'r')) { err += 'cat: ' + operand + ': Permission denied\n'; errno = errno || 'EACCES'; return; }
                out += found.node.content;
            });
            if (parsed.flags.n) {
                out = H.splitLines(out).map(function (line, index) {
                    var n = String(index + 1);
                    while (n.length < 6) n = ' ' + n;
                    return n + '\t' + line;
                }).join('\n');
                if (out) out += '\n';
            }
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- echo ---------- */

    function unescape(text) {
        return text.replace(/\\(n|t|\\)/g, function (all, c) { return c === 'n' ? '\n' : c === 't' ? '\t' : '\\'; });
    }

    Registry.register('echo', {
        desc: 'লেখা পর্দায় ছাপে',
        run: function (ctx) {
            var args = ctx.args.slice();
            var newline = true;
            var escapes = false;
            while (args.length && /^-[neE]+$/.test(args[0])) {
                var flag = args.shift();
                if (flag.indexOf('n') !== -1) newline = false;
                if (flag.indexOf('e') !== -1) escapes = true;
                if (flag.indexOf('E') !== -1) escapes = false;
            }
            var text = args.join(' ');
            if (escapes) text = unescape(text);
            return H.ok(ctx.state, text + (newline ? '\n' : ''));
        }
    });

    /* ---------- cp ---------- */

    function cloneTree(node, state) {
        var user = H.userOf(state);
        var meta = Fs.meta(user.name, user.group, node.meta.mode, state.clock);
        if (node.kind === 'file') return Fs.file(node.content, meta);
        if (node.kind === 'link') return Fs.link(node.target, meta);
        var children = Object.create(null);
        Object.keys(node.children).forEach(function (name) { children[name] = cloneTree(node.children[name], state); });
        return Fs.dir(children, meta);
    }

    function isInside(parentAbs, childAbs) {
        return childAbs === parentAbs || childAbs.indexOf(parentAbs === '/' ? '/' : parentAbs + '/') === 0;
    }

    // dest কোথায় যাবে: পুরোনো ফোল্ডার হলে তার ভেতরে source-এর নামে, নাহলে নিজেই
    function targetPath(state, user, destAbs, sourceAbs) {
        var found = Fs.lookup(state.fs, user, destAbs);
        if (!found.error && found.node.kind === 'dir') return { abs: Path.join(destAbs, Path.basename(sourceAbs)), intoDir: true, existing: null };
        return { abs: destAbs, intoDir: false, existing: found.error ? null : found.node, error: found.error === 'ENOENT' ? null : found.error };
    }

    Registry.register('cp', {
        desc: 'ফাইল বা ফোল্ডারের কপি বানায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'cp', flags: 'rRv' });
            if (parsed.error) return flagError(state, parsed);
            var operands = parsed.operands;
            if (!operands.length) return H.fail(state, MISSING_OPERAND('cp'), 1, 'EOPERAND');
            if (operands.length === 1) return H.fail(state, "cp: missing destination file operand after '" + operands[0] + "'\nTry 'cp --help' for more information.\n", 1, 'EOPERAND');
            var recursive = parsed.flags.r || parsed.flags.R;
            var dest = operands[operands.length - 1];
            var sources = operands.slice(0, -1);
            var destAbs = H.resolveArg(state, dest);
            var destFound = Fs.lookup(state.fs, user, destAbs);
            var destIsDir = !destFound.error && destFound.node.kind === 'dir';
            if (sources.length > 1 && !destIsDir) return H.fail(state, "cp: target '" + dest + "' is not a directory\n", 1, 'ENOTDIR');
            var err = '';
            var out = '';
            var errno;

            sources.forEach(function (source) {
                var sourceAbs = H.resolveArg(state, source);
                var found = Fs.lookup(state.fs, user, sourceAbs);
                if (found.error) { err += "cp: cannot stat '" + source + "': " + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                var node = found.node;
                if (node.kind === 'dir' && !recursive) { err += "cp: -r not specified; omitting directory '" + source + "'\n"; errno = errno || 'ERECURSIVE'; return; }
                if (!Fs.can(node, user, 'r')) { err += "cp: cannot open '" + source + "' for reading: Permission denied\n"; errno = errno || 'EACCES'; return; }
                var target = targetPath(state, user, destAbs, sourceAbs);
                if (target.error) { err += "cp: cannot create regular file '" + dest + "': " + H.errorText(target.error) + '\n'; errno = errno || target.error; return; }
                if (target.abs === sourceAbs) { err += "cp: '" + source + "' and '" + (target.intoDir ? dest + '/' + Path.basename(sourceAbs) : dest) + "' are the same file\n"; errno = errno || 'ESAME'; return; }
                if (node.kind === 'dir' && isInside(sourceAbs, target.abs)) { err += "cp: cannot copy a directory, '" + source + "', into itself, '" + dest + (target.intoDir ? '/' + Path.basename(sourceAbs) : '') + "'\n"; errno = errno || 'ESELF'; return; }
                if (target.existing && node.kind === 'dir' && target.existing.kind !== 'dir') { err += "cp: cannot overwrite non-directory '" + dest + "' with directory '" + source + "'\n"; errno = errno || 'ENOTDIR'; return; }
                var existingAtTarget = target.intoDir ? Fs.lookup(state.fs, user, target.abs) : { node: target.existing };
                if (existingAtTarget.node && existingAtTarget.node.kind === 'dir' && node.kind !== 'dir') { err += "cp: cannot overwrite directory '" + (target.intoDir ? dest + '/' + Path.basename(sourceAbs) : dest) + "' with non-directory\n"; errno = errno || 'EISDIR'; return; }
                var check = H.checkParent(state, target.abs);
                if (check.error) { err += "cp: cannot create regular file '" + (target.intoDir ? dest + '/' + Path.basename(sourceAbs) : dest) + "': " + H.errorText(check.error) + '\n'; errno = errno || check.error; return; }
                state = addEntry(state, target.abs, cloneTree(node, state));
                if (parsed.flags.v) out += "'" + source + "' -> '" + (target.intoDir ? dest.replace(/\/$/, '') + '/' + Path.basename(sourceAbs) : dest) + "'\n";
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- mv ---------- */

    Registry.register('mv', {
        desc: 'ফাইল বা ফোল্ডার সরায়, বা নাম বদলায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'mv', flags: 'v' });
            if (parsed.error) return flagError(state, parsed);
            var operands = parsed.operands;
            if (!operands.length) return H.fail(state, MISSING_OPERAND('mv'), 1, 'EOPERAND');
            if (operands.length === 1) return H.fail(state, "mv: missing destination file operand after '" + operands[0] + "'\nTry 'mv --help' for more information.\n", 1, 'EOPERAND');
            var dest = operands[operands.length - 1];
            var sources = operands.slice(0, -1);
            var destAbs = H.resolveArg(state, dest);
            var destFound = Fs.lookup(state.fs, user, destAbs);
            var destIsDir = !destFound.error && destFound.node.kind === 'dir';
            if (sources.length > 1 && !destIsDir) return H.fail(state, "mv: target '" + dest + "' is not a directory\n", 1, 'ENOTDIR');
            var err = '';
            var out = '';
            var errno;

            sources.forEach(function (source) {
                var sourceAbs = H.resolveArg(state, source);
                var found = Fs.lookup(state.fs, user, sourceAbs, false);
                if (found.error) { err += "mv: cannot stat '" + source + "': " + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                var node = found.node;
                var target = targetPath(state, user, destAbs, sourceAbs);
                var shownDest = target.intoDir ? dest.replace(/\/$/, '') + '/' + Path.basename(sourceAbs) : dest;
                if (target.error) { err += "mv: cannot move '" + source + "' to '" + shownDest + "': " + H.errorText(target.error) + '\n'; errno = errno || target.error; return; }
                if (target.abs === sourceAbs) { err += "mv: '" + source + "' and '" + shownDest + "' are the same file\n"; errno = errno || 'ESAME'; return; }
                if (node.kind === 'dir' && isInside(sourceAbs, target.abs)) { err += "mv: cannot move '" + source + "' to a subdirectory of itself, '" + shownDest + "'\n"; errno = errno || 'ESELF'; return; }
                var existing = target.intoDir ? Fs.lookup(state.fs, user, target.abs).node : target.existing;
                if (existing) {
                    if (node.kind === 'dir' && existing.kind !== 'dir') { err += "mv: cannot overwrite non-directory '" + shownDest + "' with directory '" + source + "'\n"; errno = errno || 'ENOTDIR'; return; }
                    if (node.kind !== 'dir' && existing.kind === 'dir') { err += "mv: cannot overwrite directory '" + shownDest + "' with non-directory\n"; errno = errno || 'EISDIR'; return; }
                    if (existing.kind === 'dir' && Object.keys(existing.children).length) { err += "mv: cannot overwrite '" + shownDest + "': Directory not empty\n"; errno = errno || 'ENOTEMPTY'; return; }
                }
                var fromCheck = H.checkParent(state, sourceAbs);
                if (fromCheck.error) { err += "mv: cannot move '" + source + "' to '" + shownDest + "': " + H.errorText(fromCheck.error) + '\n'; errno = errno || fromCheck.error; return; }
                var toCheck = H.checkParent(state, target.abs);
                if (toCheck.error) { err += "mv: cannot move '" + source + "' to '" + shownDest + "': " + H.errorText(toCheck.error) + '\n'; errno = errno || toCheck.error; return; }
                state = removeEntry(state, sourceAbs);
                state = addEntry(state, target.abs, node);
                if (parsed.flags.v) out += "renamed '" + source + "' -> '" + shownDest + "'\n";
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- rm ---------- */

    // মুছতে হলে প্রতিটা ফোল্ডারে w আর x লাগে (ভেতরের জিনিস সরাতে)। না থাকলে প্রথম আটকানো path
    function blockedInside(node, abs, user) {
        if (node.kind !== 'dir') return null;
        var names = Object.keys(node.children);
        if (names.length && (!Fs.can(node, user, 'w') || !Fs.can(node, user, 'x'))) return abs + '/' + names[0];
        for (var i = 0; i < names.length; i++) {
            var inner = blockedInside(node.children[names[i]], abs + '/' + names[i], user);
            if (inner) return inner;
        }
        return null;
    }

    Registry.register('rm', {
        desc: 'ফাইল বা ফোল্ডার মোছে (আর ফেরত আসে না)',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'rm', flags: 'rRfv' });
            if (parsed.error) return flagError(state, parsed);
            if (!parsed.operands.length) {
                if (parsed.flags.f) return H.ok(state);
                return H.fail(state, MISSING_OPERAND('rm'), 1, 'EOPERAND');
            }
            var recursive = parsed.flags.r || parsed.flags.R;
            var force = parsed.flags.f;
            var err = '';
            var out = '';
            var errno;

            function problem(text, code) {
                err += text;
                errno = errno || code;
            }

            parsed.operands.forEach(function (operand) {
                var abs = H.resolveArg(state, operand);
                var base = Path.basename(operand.replace(/\/+$/, '') || '/');
                if (base === '.' || base === '..') return problem("rm: refusing to remove '.' or '..' directory: skipping '" + operand + "'\n", 'EDOT');
                if (abs === '/' && recursive) return problem("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n", 'EPROTECT');
                if (recursive && (abs === (state.env.HOME || user.home) || isInside(abs, state.cwd) || abs === '/home')) {
                    return problem("rm: refusing to remove '" + operand + "' (simulator-এর সুরক্ষা: নিজের home বা বর্তমান ফোল্ডার মোছা যাবে না)\n", 'EPROTECT');
                }
                var found = Fs.lookup(state.fs, user, abs, false);
                if (found.error) {
                    if (force && found.error === 'ENOENT') return;
                    return problem("rm: cannot remove '" + operand + "': " + H.errorText(found.error) + '\n', found.error);
                }
                if (found.node.kind === 'dir' && !recursive) return problem("rm: cannot remove '" + operand + "': Is a directory\n", 'EISDIR');
                var check = H.checkParent(state, abs);
                if (check.error) return problem("rm: cannot remove '" + operand + "': " + H.errorText(check.error) + '\n', check.error);
                var blocked = blockedInside(found.node, operand.replace(/\/+$/, ''), user);
                if (blocked) return problem("rm: cannot remove '" + blocked + "': Permission denied\n", 'EACCES');
                state = removeEntry(state, abs);
                if (parsed.flags.v) out += (found.node.kind === 'dir' ? "removed directory '" : "removed '") + operand + "'\n";
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });
})(typeof self !== 'undefined' ? self : this);
