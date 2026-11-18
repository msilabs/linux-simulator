// এক লাইন লেখা নিয়ে চালানো: parse করা, argument বানানো, command খোঁজা, চালানো, ব্যাখ্যা জোড়া
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;
    var Text = isNode ? require('./06-text.js') : root.LinuxText;
    var Parser = isNode ? require('./04-parser.js') : root.LinuxParser;
    var Expand = isNode ? require('./05-expand.js') : root.LinuxExpand;
    var Registry = isNode ? require('./09-registry.js') : root.LinuxRegistry;
    if (isNode) {
        require('./10-commands/01-navigate.js');
        require('./10-commands/02-files.js');
        require('./10-commands/03-session.js');
    }

    function prompt(state) {
        var user = Fs.USERS[state.user];
        var where = Path.shorten(state.cwd, state.env.HOME || user.home);
        return user.name + '@laptop:' + where + (user.name === 'root' ? '#' : '$');
    }

    function explainOf(info) {
        var Explain = isNode ? require('./21-explain.js') : root.LinuxExplain;
        return Explain ? Explain.explain(info) : '';
    }

    function empty(state) {
        return { state: state, stdout: '', stderr: '', code: 0, explain: '' };
    }

    // opts: { history: [...], status: সর্বশেষ exit code }
    function run(state, line, opts) {
        opts = opts || {};
        if (!line.trim()) return empty(state);

        var parsed = Parser.parse(line);
        if (!parsed.ok) {
            var bad = { state: state, stdout: '', stderr: 'bash: ' + parsed.error + '\n', code: 2, errno: parsed.unsupported ? 'EUNSUPPORTED' : 'ESYNTAX' };
            if (parsed.unsupported) bad.explain = Text.notSupported(parsed.error.replace(' এই simulator-এ নেই', ''));
            else bad.explain = explainOf({ name: '', args: [], result: bad, before: state, after: state });
            return bad;
        }

        var single = parsed.list.length === 1 && parsed.list[0].pipeline.length === 1 && parsed.list[0].pipeline[0].redirects.length === 0;
        if (!single) {
            return { state: state, stdout: '', stderr: 'bash: pipe, redirect আর && এই ধাপে এখনো চালু হয়নি\n', code: 2, errno: 'EUNSUPPORTED', explain: '' };
        }

        var ctx = { env: state.env, cwd: state.cwd, fs: state.fs, user: state.user, status: opts.status || 0 };
        var args = Expand.expandAll(parsed.list[0].pipeline[0].argv, ctx);
        if (!args.length) return empty(state);

        var name = args[0];
        var command = Registry.commands[name];
        if (!command) {
            var missing = { state: state, stdout: '', stderr: 'bash: ' + name + ': command not found\n', code: 127, errno: 'ENOCMD' };
            missing.explain = explainOf({ name: name, args: args.slice(1), result: missing, before: state, after: state });
            return missing;
        }

        var result = command.run({ state: state, args: args.slice(1), stdin: null, tty: true, history: opts.history || [] });
        var next = result.state;
        if (next.fs !== state.fs) next = Object.assign({}, next, { clock: next.clock + 1 });
        result.state = next;
        result.explain = explainOf({ name: name, args: args.slice(1), result: result, before: state, after: next });
        return result;
    }

    var api = { run: run, prompt: prompt };
    if (isNode) module.exports = api;
    else root.LinuxShell = api;
})(typeof self !== 'undefined' ? self : this);
