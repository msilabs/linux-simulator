// সব command যা ব্যবহার করে: result বানানো, error-এর লেখা, flag পড়া, path খোঁজা
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;

    var ERRNO_TEXT = {
        ENOENT: 'No such file or directory',
        EACCES: 'Permission denied',
        ENOTDIR: 'Not a directory',
        EISDIR: 'Is a directory',
        EEXIST: 'File exists',
        ENOTEMPTY: 'Directory not empty'
    };

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // clock 0 = ২০২৬-১১-১৮ ১০:০০; প্রতি একক এক মিনিট
    var EPOCH = Date.UTC(2026, 10, 18, 10, 0);

    function ok(state, stdout) {
        return { state: state, stdout: stdout || '', stderr: '', code: 0 };
    }

    function fail(state, stderr, code, errno) {
        return { state: state, stdout: '', stderr: stderr, code: code === undefined ? 1 : code, errno: errno };
    }

    function errorText(errno) {
        return ERRNO_TEXT[errno] || errno;
    }

    function userOf(state) {
        return Fs.USERS[state.user];
    }

    function resolveArg(state, arg) {
        return Path.resolve(state.cwd, arg, state.env.HOME || userOf(state).home);
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function formatTime(minutes) {
        var d = new Date(EPOCH + minutes * 60000);
        return MONTHS[d.getUTCMonth()] + ' ' + (d.getUTCDate() < 10 ? ' ' : '') + d.getUTCDate() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    }

    // flag পড়ে। spec: { name: 'ls', flags: 'laRh1', valued: 'n', long: { '--all': 'a' } }
    // ফল: { flags: { l: true, n: '5' }, operands: [...] } অথবা { error: 'বার্তা' }
    function parseFlags(args, spec) {
        var flags = {};
        var operands = [];
        var valued = spec.valued || '';
        var i = 0;
        for (; i < args.length; i++) {
            var arg = args[i];
            if (arg === '--') { i++; break; }
            if (arg.length < 2 || arg.charAt(0) !== '-') { operands.push(arg); continue; }
            if (arg.indexOf('--') === 0) {
                var mapped = spec.long && spec.long[arg];
                if (!mapped) return { error: spec.name + ": unrecognized option '" + arg + "'\nTry '" + spec.name + " --help' for more information.\n" };
                flags[mapped] = true;
                continue;
            }
            for (var j = 1; j < arg.length; j++) {
                var letter = arg.charAt(j);
                if (valued.indexOf(letter) !== -1) {
                    var rest = arg.slice(j + 1);
                    if (rest) flags[letter] = rest;
                    else if (i + 1 < args.length) { flags[letter] = args[i + 1]; i++; }
                    else return { error: spec.name + ": option requires an argument -- '" + letter + "'\nTry '" + spec.name + " --help' for more information.\n" };
                    break;
                }
                if (spec.flags.indexOf(letter) === -1) return { error: spec.name + ": invalid option -- '" + letter + "'\nTry '" + spec.name + " --help' for more information.\n" };
                flags[letter] = true;
            }
        }
        for (; i < args.length; i++) operands.push(args[i]);
        return { flags: flags, operands: operands };
    }

    // নতুন entry বানানোর আগে parent ঠিক আছে কিনা: ফোল্ডার, আর তাতে w আর x অধিকার
    function checkParent(state, abs) {
        var user = userOf(state);
        var parent = Fs.lookup(state.fs, user, Path.dirname(abs));
        if (parent.error) return { error: parent.error };
        if (parent.node.kind !== 'dir') return { error: 'ENOTDIR' };
        if (!Fs.can(parent.node, user, 'w') || !Fs.can(parent.node, user, 'x')) return { error: 'EACCES' };
        return { parent: parent.node };
    }

    function newMeta(state, mode) {
        var user = userOf(state);
        return Fs.meta(user.name, user.group, mode, state.clock);
    }

    // লাইনগুলো গুনে: শেষে \n না থাকলেও শেষ লাইন ধরা হয়
    function splitLines(text) {
        if (text === '') return [];
        var lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    }

    function bn(n) {
        return String(n).replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(d); });
    }

    var api = {
        ok: ok, fail: fail, errorText: errorText, userOf: userOf, resolveArg: resolveArg,
        formatTime: formatTime, parseFlags: parseFlags, checkParent: checkParent, newMeta: newMeta,
        splitLines: splitLines, bn: bn
    };
    if (isNode) module.exports = api;
    else root.LinuxHelpers = api;
})(typeof self !== 'undefined' ? self : this);
