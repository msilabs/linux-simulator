// chmod, chown, sudo, whoami, id: কে কী করতে পারে
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Fs = isNode ? require('../02-fs.js') : root.LinuxFs;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    var NOT_UNDER_SUDO = ['cd', 'export', 'unset', 'alias', 'unalias', 'history', 'help', 'sudo'];

    function mapTree(node, fn) {
        var changed = fn(node);
        if (node.kind !== 'dir') return changed;
        var children = Object.create(null);
        Object.keys(node.children).forEach(function (name) { children[name] = mapTree(node.children[name], fn); });
        return Fs.dir(children, changed.meta);
    }

    function replaceAt(state, abs, node) {
        return Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return node; }) });
    }

    /* ---------- chmod ---------- */

    function octal(mode) {
        var text = mode.toString(8);
        while (text.length < 4) text = '0' + text;
        return text;
    }

    function rwx(mode) {
        var out = '';
        for (var shift = 6; shift >= 0; shift -= 3) {
            var bits = (mode >> shift) & 7;
            out += (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');
        }
        return out;
    }

    // "755", "u+x", "go-w", "a=r", "u=rw,g=r" থেকে নতুন mode। ভুল হলে null
    function newMode(text, current, isDir) {
        if (/^[0-7]{1,4}$/.test(text)) return parseInt(text, 8) & 0o777;
        var mode = current;
        var clauses = text.split(',');
        for (var i = 0; i < clauses.length; i++) {
            var m = /^([ugoa]*)([-+=])([rwxX]*)$/.exec(clauses[i]);
            if (!m) return null;
            var who = m[1] || 'a';
            var bits = 0;
            if (m[3].indexOf('r') !== -1) bits |= 4;
            if (m[3].indexOf('w') !== -1) bits |= 2;
            if (m[3].indexOf('x') !== -1) bits |= 1;
            if (m[3].indexOf('X') !== -1 && (isDir || (current & 0o111))) bits |= 1;
            var shifts = [];
            if (who.indexOf('a') !== -1) shifts = [6, 3, 0];
            else {
                if (who.indexOf('u') !== -1) shifts.push(6);
                if (who.indexOf('g') !== -1) shifts.push(3);
                if (who.indexOf('o') !== -1) shifts.push(0);
            }
            for (var k = 0; k < shifts.length; k++) {
                var mask = 7 << shifts[k];
                if (m[2] === '+') mode |= bits << shifts[k];
                else if (m[2] === '-') mode &= ~(bits << shifts[k]);
                else mode = (mode & ~mask) | (bits << shifts[k]);
            }
        }
        return mode & 0o777;
    }

    Registry.register('chmod', {
        desc: 'ফাইলের অধিকার (পড়া, লেখা, চালানো) বদলায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            // `-x` বা `-w`-র মতো লেখা flag নয়, mode (যেমন `chmod -x file`)। flag শুধু -R আর -v।
            var flags = { R: false, v: false };
            var operands = [];
            var badOption = false;
            ctx.args.forEach(function (a) {
                if (/^-[Rv]+$/.test(a)) {
                    if (a.indexOf('R') !== -1) flags.R = true;
                    if (a.indexOf('v') !== -1) flags.v = true;
                } else if (/^-[a-zA-Z]/.test(a) && !/^-[rwxXugoa,+=-]*$/.test(a)) badOption = true;
                else operands.push(a);
            });
            if (badOption) return H.fail(state, "chmod: invalid option\nTry 'chmod --help' for more information.\n", 1, 'EOPT');
            if (!operands.length) return H.fail(state, "chmod: missing operand\nTry 'chmod --help' for more information.\n", 1, 'EOPERAND');
            if (operands.length === 1) return H.fail(state, "chmod: missing operand after '" + operands[0] + "'\nTry 'chmod --help' for more information.\n", 1, 'EOPERAND');

            var modeText = operands[0];
            if (newMode(modeText, 0, false) === null) return H.fail(state, "chmod: invalid mode: '" + modeText + "'\nTry 'chmod --help' for more information.\n", 1, 'EMODE');

            var out = '';
            var err = '';
            var errno;
            operands.slice(1).forEach(function (operand) {
                var found = Fs.lookup(state.fs, user, H.resolveArg(state, operand));
                if (found.error) { err += "chmod: cannot access '" + operand + "': " + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                if (flags.R && found.path === '/') {
                    err += "chmod: it is dangerous to operate recursively on '/'\nchmod: use --no-preserve-root to override this failsafe\n";
                    errno = errno || 'EPROTECT';
                    return;
                }
                if (user.name !== 'root' && found.node.meta.owner !== user.name) {
                    err += "chmod: changing permissions of '" + operand + "': Operation not permitted\n";
                    errno = errno || 'EPERM';
                    return;
                }
                var tree = flags.R ? mapTree : function (n, fn) { return fn(n); };
                var updated = tree(found.node, function (n) {
                    var mode = newMode(modeText, n.meta.mode, n.kind === 'dir');
                    if (flags.v && n === found.node) out += "mode of '" + operand + "' changed from " + octal(n.meta.mode) + ' (' + rwx(n.meta.mode) + ') to ' + octal(mode) + ' (' + rwx(mode) + ')\n';
                    if (n.kind === 'dir') return Fs.dir(n.children, Object.assign({}, n.meta, { mode: mode }));
                    if (n.kind === 'link') return n;
                    return Fs.file(n.content, Object.assign({}, n.meta, { mode: mode }));
                });
                state = replaceAt(state, found.path, updated);
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- chown ---------- */

    Registry.register('chown', {
        desc: 'ফাইলের মালিক বদলায় (শুধু root পারে)',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'chown', flags: 'Rv' });
            if (parsed.error) return H.fail(state, parsed.error, 1, 'EOPT');
            if (!parsed.operands.length) return H.fail(state, "chown: missing operand\nTry 'chown --help' for more information.\n", 1, 'EOPERAND');
            if (parsed.operands.length === 1) return H.fail(state, "chown: missing operand after '" + parsed.operands[0] + "'\nTry 'chown --help' for more information.\n", 1, 'EOPERAND');

            var spec = parsed.operands[0];
            var colon = spec.indexOf(':');
            var ownerName = colon === -1 ? spec : spec.slice(0, colon);
            var groupName = colon === -1 ? '' : spec.slice(colon + 1);
            if (ownerName && !Fs.USERS[ownerName]) return H.fail(state, "chown: invalid user: '" + spec + "'\n", 1, 'EUSER');
            if (groupName && Fs.GROUPS.indexOf(groupName) === -1) return H.fail(state, "chown: invalid group: '" + spec + "'\n", 1, 'EUSER');

            var err = '';
            var errno;
            parsed.operands.slice(1).forEach(function (operand) {
                var found = Fs.lookup(state.fs, user, H.resolveArg(state, operand));
                if (found.error) { err += "chown: cannot access '" + operand + "': " + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                if (parsed.flags.R && found.path === '/') {
                    err += "chown: it is dangerous to operate recursively on '/'\nchown: use --no-preserve-root to override this failsafe\n";
                    errno = errno || 'EPROTECT';
                    return;
                }
                if (user.name !== 'root') {
                    err += "chown: changing ownership of '" + operand + "': Operation not permitted\n";
                    errno = errno || 'EPERM';
                    return;
                }
                var tree = parsed.flags.R ? mapTree : function (n, fn) { return fn(n); };
                var updated = tree(found.node, function (n) {
                    var meta = Object.assign({}, n.meta, { owner: ownerName || n.meta.owner, group: groupName || n.meta.group });
                    if (n.kind === 'dir') return Fs.dir(n.children, meta);
                    if (n.kind === 'link') return Fs.link(n.target, meta);
                    return Fs.file(n.content, meta);
                });
                state = replaceAt(state, found.path, updated);
            });
            return { state: state, stdout: '', stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- sudo, whoami, id ---------- */

    Registry.register('sudo', {
        desc: 'একটা command root হিসেবে চালায় (root সব পারে, তাই সাবধান)',
        run: function (ctx) {
            var state = ctx.state;
            if (!ctx.args.length) return H.fail(state, 'usage: sudo -h | -K | -k | -V\nusage: sudo command [arg ...]\n', 1, 'EOPERAND');
            var name = ctx.args[0];
            if (name.charAt(0) === '-') return H.fail(state, 'sudo: এই simulator-এ শুধু `sudo command` চলে, option নেই\n', 1, 'EUNSUPPORTED');
            var command = Registry.commands[name];
            if (!command || NOT_UNDER_SUDO.indexOf(name) !== -1) return H.fail(state, 'sudo: ' + name + ': command not found\n', 1, 'ENOCMD');
            var asRoot = Object.assign({}, state, { user: 'root' });
            var result = command.run({ state: asRoot, args: ctx.args.slice(1), stdin: ctx.stdin, tty: ctx.tty, history: ctx.history });
            result.state = Object.assign({}, result.state, { user: state.user });
            return result;
        }
    });

    Registry.register('whoami', {
        desc: 'কে হিসেবে লগইন আছেন তা দেখায়',
        run: function (ctx) { return H.ok(ctx.state, ctx.state.user + '\n'); }
    });

    Registry.register('id', {
        desc: 'user আর group-এর পরিচয় দেখায়',
        run: function (ctx) {
            if (ctx.state.user === 'root') return H.ok(ctx.state, 'uid=0(root) gid=0(root) groups=0(root)\n');
            return H.ok(ctx.state, 'uid=1000(dev) gid=1000(dev) groups=1000(dev),27(sudo)\n');
        }
    });

    var api = { newMode: newMode, rwx: rwx };
    if (isNode) module.exports = api;
    else root.LinuxPermissions = api;
})(typeof self !== 'undefined' ? self : this);
