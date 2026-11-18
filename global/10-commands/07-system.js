// ps, kill, du, df, ln, nano, date, uname, hostname, sleep: system-এর খবর আর process
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('../01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('../02-fs.js') : root.LinuxFs;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    function padLeft(text, width) {
        text = String(text);
        while (text.length < width) text = ' ' + text;
        return text;
    }

    function padRight(text, width) {
        text = String(text);
        while (text.length < width) text += ' ';
        return text;
    }

    /* ---------- ps আর kill ---------- */

    var MY_PS_PID = 5555;

    Registry.register('ps', {
        desc: 'চলতে থাকা process-এর তালিকা দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var letters = ctx.args.map(function (a) { return a.replace(/^-/, ''); }).join('');
            var all = /[aeA]/.test(letters) || /x/.test(letters);
            var full = /[uf]/.test(letters) || /aux/.test(ctx.args.join(''));
            var mine = { pid: MY_PS_PID, user: state.user, cpu: 0.0, mem: 0.1, vsz: 12524, rss: 3200, tty: 'pts/0', stat: 'R+', start: '10:00', time: '0:00', cmd: ctx.args.length ? 'ps ' + ctx.args.join(' ') : 'ps' };
            var list = state.processes.concat([mine]);
            if (!all) list = list.filter(function (p) { return p.tty === 'pts/0'; });

            var lines = [];
            if (/aux|u/.test(letters) && full && !/f/.test(letters)) {
                lines.push('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
                list.forEach(function (p) {
                    lines.push(padRight(p.user, 8) + ' ' + padLeft(p.pid, 7) + ' ' + padLeft(p.cpu.toFixed(1), 4) + ' ' + padLeft(p.mem.toFixed(1), 4) + ' ' + padLeft(p.vsz, 6) + ' ' + padLeft(p.rss, 5) + ' ' + padRight(p.tty, 8) + ' ' + padRight(p.stat, 4) + ' ' + padRight(p.start, 5) + ' ' + padLeft(p.time, 6) + ' ' + p.cmd);
                });
            } else if (/f/.test(letters)) {
                lines.push('UID          PID    PPID  C STIME TTY          TIME CMD');
                list.forEach(function (p) {
                    lines.push(padRight(p.user, 8) + ' ' + padLeft(p.pid, 7) + ' ' + padLeft(p.pid === 1 ? 0 : 1, 7) + '  0 ' + padRight(p.start, 5) + ' ' + padRight(p.tty, 8) + ' ' + padLeft('00:' + padLeft(p.time, 5).replace(/ /g, '0'), 8) + ' ' + p.cmd);
                });
            } else {
                lines.push('    PID TTY          TIME CMD');
                list.forEach(function (p) {
                    lines.push(padLeft(p.pid, 7) + ' ' + padRight(p.tty, 8) + ' 00:00:00 ' + p.cmd.split(' ')[0]);
                });
            }
            return H.ok(state, lines.join('\n') + '\n');
        }
    });

    var SIGNALS = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, TERM: 15, STOP: 19, CONT: 18, USR1: 10, USR2: 12 };

    Registry.register('kill', {
        desc: 'process-কে signal পাঠায় (kill PID, বা জোর করে: kill -9 PID)',
        run: function (ctx) {
            var state = ctx.state;
            var args = ctx.args.slice();
            var signal = 15;
            if (args.length && /^-/.test(args[0]) && args[0] !== '--') {
                var name = args.shift().slice(1).replace(/^SIG/, '');
                if (/^\d+$/.test(name)) signal = parseInt(name, 10);
                else if (Object.prototype.hasOwnProperty.call(SIGNALS, name)) signal = SIGNALS[name];
                else return H.fail(state, 'bash: kill: ' + name + ': invalid signal specification\n', 1, 'ESIGNAL');
            }
            if (!args.length) return H.fail(state, 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n', 2, 'EOPERAND');

            var processes = state.processes;
            var err = '';
            var errno;
            var survived = [];
            args.forEach(function (arg) {
                if (!/^\d+$/.test(arg)) { err += 'bash: kill: ' + arg + ': arguments must be process or job IDs\n'; errno = errno || 'EPID'; return; }
                var pid = parseInt(arg, 10);
                var target = processes.filter(function (p) { return p.pid === pid; })[0];
                if (pid === 1001 || pid === MY_PS_PID) { if (signal === 9 || signal === 15) return; }
                if (!target) { err += 'bash: kill: (' + pid + ') - No such process\n'; errno = errno || 'ESRCH'; return; }
                if (state.user !== 'root' && target.user !== state.user) { err += 'bash: kill: (' + pid + ') - Operation not permitted\n'; errno = errno || 'EPERM'; return; }
                if (signal === 0) return;
                if (target.stubborn && signal !== 9) { survived.push(pid); return; }
                processes = processes.filter(function (p) { return p.pid !== pid; });
            });
            var next = processes === state.processes ? state : Object.assign({}, state, { processes: processes });
            var result = { state: next, stdout: '', stderr: err, code: err ? 1 : 0, errno: errno };
            if (survived.length) result.survived = survived;
            return result;
        }
    });

    /* ---------- du আর df ---------- */

    function blocks(node) {
        var size = Fs.sizeOf(node);
        var own = node.kind === 'file' && size === 0 ? 0 : Math.ceil(size / 4096) * 4;
        if (node.kind !== 'dir') return own;
        return Object.keys(node.children).reduce(function (sum, name) { return sum + blocks(node.children[name]); }, own);
    }

    function human(kilobytes) {
        if (kilobytes < 1024) return kilobytes === 0 ? '0' : kilobytes + 'K';
        var value = kilobytes / 1024;
        var unit = 'M';
        if (value >= 1024) { value /= 1024; unit = 'G'; }
        return (value < 10 ? (Math.ceil(value * 10) / 10).toFixed(1) : String(Math.ceil(value))) + unit;
    }

    Registry.register('du', {
        desc: 'ফোল্ডার কতটা জায়গা নিয়েছে দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'du', flags: 'sha' });
            if (parsed.error) return H.fail(state, parsed.error, 1, 'EOPT');
            var flags = parsed.flags;
            var operands = parsed.operands.length ? parsed.operands : ['.'];
            var out = '';
            var err = '';
            var errno;

            function show(kb, label) {
                out += (flags.h ? human(kb) : kb) + '\t' + label + '\n';
            }

            function walk(display, node) {
                if (node.kind === 'dir' && (!flags.s || false)) {
                    Fs.names(node).forEach(function (name) {
                        var child = node.children[name];
                        var shown = display.charAt(display.length - 1) === '/' ? display + name : display + '/' + name;
                        if (child.kind === 'dir') walk(shown, child);
                        else if (flags.a) show(blocks(child), shown);
                    });
                }
                show(blocks(node), display);
            }

            operands.forEach(function (operand) {
                var found = Fs.lookup(state.fs, user, H.resolveArg(state, operand));
                if (found.error) { err += "du: cannot access '" + operand + "': " + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                if (flags.s) show(blocks(found.node), operand);
                else walk(operand, found.node);
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    Registry.register('df', {
        desc: 'disk-এ কত জায়গা বাকি আছে দেখায়',
        run: function (ctx) {
            var parsed = H.parseFlags(ctx.args, { name: 'df', flags: 'h' });
            if (parsed.error) return H.fail(ctx.state, parsed.error, 1, 'EOPT');
            if (parsed.flags.h) {
                return H.ok(ctx.state, [
                    'Filesystem      Size  Used Avail Use% Mounted on',
                    'tmpfs           1.6G  1.9M  1.6G   1% /run',
                    '/dev/sda1        50G   18G   30G  38% /',
                    'tmpfs           7.8G     0  7.8G   0% /dev/shm',
                    '/dev/sda15      105M  6.1M   99M   6% /boot/efi'
                ].join('\n') + '\n');
            }
            return H.ok(ctx.state, [
                'Filesystem     1K-blocks     Used Available Use% Mounted on',
                'tmpfs            1623456     1948   1621508   1% /run',
                '/dev/sda1       51474044 18512344  30724836  38% /',
                'tmpfs            8117276        0   8117276   0% /dev/shm',
                '/dev/sda15        106858     6186     100672   6% /boot/efi'
            ].join('\n') + '\n');
        }
    });

    /* ---------- ln ---------- */

    Registry.register('ln', {
        desc: 'অন্য ফাইলের শর্টকাট (symbolic link) বানায়: ln -s লক্ষ্য নাম',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'ln', flags: 'sf' });
            if (parsed.error) return H.fail(state, parsed.error, 1, 'EOPT');
            if (!parsed.flags.s) return H.fail(state, 'ln: এই simulator-এ শুধু symbolic link চলে: ln -s লক্ষ্য নাম\n', 1, 'EUNSUPPORTED');
            if (!parsed.operands.length) return H.fail(state, "ln: missing file operand\nTry 'ln --help' for more information.\n", 1, 'EOPERAND');
            var target = parsed.operands[0];
            var linkName = parsed.operands[1] || Path.basename(target);
            var abs = H.resolveArg(state, linkName);
            var into = Fs.lookup(state.fs, user, abs);
            if (!into.error && into.node.kind === 'dir') abs = Path.join(abs, Path.basename(target));
            var existing = Fs.lookup(state.fs, user, abs, false);
            if (!existing.error) {
                if (!parsed.flags.f) return H.fail(state, "ln: failed to create symbolic link '" + linkName + "': File exists\n", 1, 'EEXIST');
                if (existing.node.kind === 'dir') return H.fail(state, "ln: failed to create symbolic link '" + linkName + "': File exists\n", 1, 'EEXIST');
            }
            var check = H.checkParent(state, abs);
            if (check.error) return H.fail(state, "ln: failed to create symbolic link '" + linkName + "': " + H.errorText(check.error) + '\n', 1, check.error);
            var link = Fs.link(target, H.newMeta(state, 0o777));
            return H.ok(Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return link; }) }));
        }
    });

    /* ---------- nano ---------- */

    Registry.register('nano', {
        desc: 'ফাইল সম্পাদনার editor খোলে',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            if (!ctx.tty || (ctx.stdin !== null && ctx.stdin !== undefined)) return H.fail(state, 'nano: Too many errors from stdin (pipe বা redirect-এর সাথে এই editor চলে না)\n', 1, 'EUNSUPPORTED');
            if (!ctx.args.length) return H.fail(state, 'nano: ফাইলের নাম দিন, যেমন: nano notes.txt\n', 1, 'EOPERAND');
            var operand = ctx.args[0];
            var abs = H.resolveArg(state, operand);
            var found = Fs.lookup(state.fs, user, abs);
            var edit;
            if (!found.error) {
                if (found.node.kind === 'dir') return H.fail(state, "nano: '" + operand + "' is a directory\n", 1, 'EISDIR');
                if (!Fs.can(found.node, user, 'r')) return H.fail(state, "Error reading " + operand + ': Permission denied\n', 1, 'EACCES');
                edit = { path: found.path, shown: operand, content: found.node.content, exists: true, writable: Fs.can(found.node, user, 'w') };
            } else if (found.error === 'ENOENT') {
                var check = H.checkParent(state, abs);
                if (check.error === 'ENOENT' || check.error === 'ENOTDIR') return H.fail(state, 'Error opening ' + operand + ': ' + H.errorText(check.error) + '\n', 1, check.error);
                edit = { path: abs, shown: operand, content: '', exists: false, writable: !check.error };
            } else {
                return H.fail(state, 'Error reading ' + operand + ': ' + H.errorText(found.error) + '\n', 1, found.error);
            }
            var result = H.ok(state);
            result.edit = edit;
            return result;
        }
    });

    /* ---------- date, uname, hostname, sleep ---------- */

    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function two(n) { return n < 10 ? '0' + n : String(n); }

    Registry.register('date', {
        desc: 'এখনকার তারিখ আর সময় দেখায় (এই simulator-এর নকল ঘড়ি)',
        run: function (ctx) {
            var d = new Date(Date.UTC(2026, 10, 18, 10, 0) + ctx.state.clock * 60000);
            var format = ctx.args[0];
            if (format && format.charAt(0) === '+') {
                var out = format.slice(1).replace(/%([YmdHMSFTAaBbjyeZ%])/g, function (all, c) {
                    switch (c) {
                        case 'Y': return String(d.getUTCFullYear());
                        case 'y': return two(d.getUTCFullYear() % 100);
                        case 'm': return two(d.getUTCMonth() + 1);
                        case 'd': return two(d.getUTCDate());
                        case 'e': return (d.getUTCDate() < 10 ? ' ' : '') + d.getUTCDate();
                        case 'H': return two(d.getUTCHours());
                        case 'M': return two(d.getUTCMinutes());
                        case 'S': return '00';
                        case 'F': return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate());
                        case 'T': return two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':00';
                        case 'A': return FULL_DAYS[d.getUTCDay()];
                        case 'a': return DAYS[d.getUTCDay()];
                        case 'B': return FULL_MONTHS[d.getUTCMonth()];
                        case 'b': return MONTHS[d.getUTCMonth()];
                        case 'Z': return 'UTC';
                        default: return '%';
                    }
                });
                return H.ok(ctx.state, out + '\n');
            }
            if (format) return H.fail(ctx.state, "date: invalid date '" + format + "'\n", 1, 'EOPT');
            return H.ok(ctx.state, DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + (d.getUTCDate() < 10 ? ' ' : '') + d.getUTCDate() + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':00 UTC ' + d.getUTCFullYear() + '\n');
        }
    });

    Registry.register('uname', {
        desc: 'system-এর নাম আর ভার্সন দেখায়',
        run: function (ctx) {
            var parsed = H.parseFlags(ctx.args, { name: 'uname', flags: 'asrnm' });
            if (parsed.error) return H.fail(ctx.state, parsed.error, 1, 'EOPT');
            var f = parsed.flags;
            if (f.a) return H.ok(ctx.state, 'Linux laptop 5.15.0-91-generic #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux\n');
            var parts = [];
            if (f.s || (!f.r && !f.n && !f.m)) parts.push('Linux');
            if (f.n) parts.push('laptop');
            if (f.r) parts.push('5.15.0-91-generic');
            if (f.m) parts.push('x86_64');
            return H.ok(ctx.state, parts.join(' ') + '\n');
        }
    });

    Registry.register('hostname', {
        desc: 'এই কম্পিউটারের নাম দেখায়',
        run: function (ctx) { return H.ok(ctx.state, 'laptop\n'); }
    });

    Registry.register('sleep', {
        desc: 'কিছুক্ষণ অপেক্ষা করে (লম্বা হলে Ctrl+C দিয়ে থামাতে হয়)',
        run: function (ctx) {
            if (!ctx.args.length) return H.fail(ctx.state, "sleep: missing operand\nTry 'sleep --help' for more information.\n", 1, 'EOPERAND');
            var seconds = parseFloat(ctx.args[0]);
            if (!/^\d+(\.\d+)?s?$/.test(ctx.args[0]) || isNaN(seconds)) return H.fail(ctx.state, "sleep: invalid time interval '" + ctx.args[0] + "'\nTry 'sleep --help' for more information.\n", 1, 'EOPT');
            var result = H.ok(ctx.state);
            if (seconds > 3) result.waiting = { name: 'sleep ' + ctx.args[0] };
            return result;
        }
    });
})(typeof self !== 'undefined' ? self : this);
