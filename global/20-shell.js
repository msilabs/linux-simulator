// এক লাইন লেখা নিয়ে চালানো: parse, argument বানানো, pipe, redirect, && || ;, alias, script, ব্যাখ্যা জোড়া।
//
// pipe-এর প্রতিটা ধাপ আসল shell-এর মতো আলাদা subshell: ধাপের ভেতরে cd বা export করলে বাইরে তার ফল পড়ে না,
// তবে ফাইলের বদল থেকে যায়।
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;
    var Text = isNode ? require('./06-text.js') : root.LinuxText;
    var Parser = isNode ? require('./04-parser.js') : root.LinuxParser;
    var Expand = isNode ? require('./05-expand.js') : root.LinuxExpand;
    var H = isNode ? require('./08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('./09-registry.js') : root.LinuxRegistry;
    if (isNode) {
        require('./10-commands/01-navigate.js');
        require('./10-commands/02-files.js');
        require('./10-commands/03-session.js');
        require('./10-commands/04-text.js');
        require('./10-commands/05-environment.js');
        require('./10-commands/06-permissions.js');
        require('./10-commands/07-system.js');
    }

    var MAX_DEPTH = 5;
    var ALIAS_LIMIT = 5;

    function prompt(state) {
        var user = Fs.USERS[state.user];
        var where = Path.shorten(state.cwd, state.env.HOME || user.home);
        return user.name + '@laptop:' + where + (user.name === 'root' ? '#' : '$');
    }

    function explainer() {
        return isNode ? require('./21-explain.js') : root.LinuxExplain;
    }

    function expansionContext(state, env) {
        return { env: state.env, cwd: state.cwd, fs: state.fs, user: state.user, status: env.status };
    }

    /* ---------- ফাইলে লেখা ---------- */

    // `>` এর মতো: ফাইল বানায় বা খালি করে (append হলে আগের লেখা রাখে)। ফেরত: { state } বা { error, errno }
    function openForWrite(state, abs, shown, append) {
        if (abs === '/dev/null') return { state: state };
        var user = H.userOf(state);
        var found = Fs.lookup(state.fs, user, abs);
        if (found.error && found.error !== 'ENOENT') return { error: 'bash: ' + shown + ': ' + H.errorText(found.error) + '\n', errno: found.error };
        if (!found.error) {
            if (found.node.kind === 'dir') return { error: 'bash: ' + shown + ': Is a directory\n', errno: 'EISDIR' };
            if (!Fs.can(found.node, user, 'w')) return { error: 'bash: ' + shown + ': Permission denied\n', errno: 'EACCES' };
            if (append) return { state: state };
            var emptied = Fs.file('', Object.assign({}, found.node.meta, { mtime: state.clock }));
            return { state: Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return emptied; }) }) };
        }
        var check = H.checkParent(state, abs);
        if (check.error) return { error: 'bash: ' + shown + ': ' + H.errorText(check.error) + '\n', errno: check.error };
        var created = Fs.file('', H.newMeta(state, 0o644));
        return { state: Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return created; }) }) };
    }

    function appendText(state, abs, text) {
        if (abs === '/dev/null' || text === '') return state;
        var found = Fs.lookup(state.fs, H.userOf(state), abs);
        if (found.error || found.node.kind !== 'file') return state;
        var node = Fs.file(found.node.content + text, Object.assign({}, found.node.meta, { mtime: state.clock }));
        return Object.assign({}, state, { fs: Fs.update(state.fs, abs, function () { return node; }) });
    }

    /* ---------- alias আর script ---------- */

    function applyAliases(state, args, env) {
        var seen = [];
        for (var i = 0; i < ALIAS_LIMIT; i++) {
            var value = args.length && Object.prototype.hasOwnProperty.call(state.aliases, args[0]) ? state.aliases[args[0]] : null;
            if (value === null || seen.indexOf(args[0]) !== -1) break;
            seen.push(args[0]);
            var parsed = Parser.parse(value);
            if (!parsed.ok || !parsed.list.length) break;
            var expanded = Expand.expandAll(parsed.list[0].pipeline[0].argv, expansionContext(state, env));
            args = expanded.concat(args.slice(1));
        }
        return args;
    }

    function runScript(state, abs, shown, node, env) {
        if (env.depth >= MAX_DEPTH) return { state: state, stdout: '', stderr: 'bash: ' + shown + ': script বেশি গভীরে ঢুকে গেছে\n', code: 1, errno: 'EDEPTH' };
        var keep = { cwd: state.cwd, env: state.env, aliases: state.aliases };
        var out = '';
        var err = '';
        var code = 0;
        var inner = Object.assign({}, env, { depth: env.depth + 1 });
        H.splitLines(node.content).forEach(function (line) {
            var r = execLine(state, line, Object.assign({}, inner, { status: code }));
            state = r.state;
            out += r.stdout;
            err += r.stderr;
            code = r.code;
        });
        // script আলাদা process: cd, export, alias বাইরে পৌঁছায় না
        state = Object.assign({}, state, keep);
        return { state: state, stdout: out, stderr: err, code: code };
    }

    function runPath(state, name, args, stdin, tty, env) {
        var user = H.userOf(state);
        var abs = H.resolveArg(state, name);
        var found = Fs.lookup(state.fs, user, abs);
        if (found.error) return { state: state, stdout: '', stderr: 'bash: ' + name + ': ' + H.errorText(found.error) + '\n', code: 127, errno: found.error };
        if (found.node.kind === 'dir') return { state: state, stdout: '', stderr: 'bash: ' + name + ': Is a directory\n', code: 126, errno: 'EISDIR' };
        if (!Fs.can(found.node, user, 'x')) return { state: state, stdout: '', stderr: 'bash: ' + name + ': Permission denied\n', code: 126, errno: 'EACCES', script: true };
        var result = runScript(state, abs, name, found.node, env);
        result.script = true;
        return result;
    }

    /* ---------- এক command ---------- */

    // stdin: pipe থেকে আসা লেখা, বা null (সরাসরি keyboard)। isLast: pipe-এর শেষ ধাপ কিনা।
    function execCommand(state, command, stdin, isLast, env) {
        var stage = { name: '', args: [], redirects: [], stdinLines: stdin === null ? null : H.splitLines(stdin).length };
        var done = function (r) {
            r.stage = stage;
            return r;
        };

        var args = Expand.expandAll(command.argv, expansionContext(state, env));
        args = applyAliases(state, args, env);

        var out = { kind: isLast ? 'term' : 'pipe' };
        var err = { kind: 'term' };
        var input = stdin;

        for (var i = 0; i < command.redirects.length; i++) {
            var redirect = command.redirects[i];
            if (redirect.op === '2>&1') {
                err = out;
                stage.redirects.push({ op: '2>&1' });
                continue;
            }
            var targets = Expand.expandWord(redirect.target, expansionContext(state, env));
            var shown = Parser.wordText(redirect.target);
            if (targets.length !== 1) return done({ state: state, stdout: '', stderr: 'bash: ' + shown + ': ambiguous redirect\n', code: 1, errno: 'EREDIRECT' });
            var abs = H.resolveArg(state, targets[0]);
            stage.redirects.push({ op: redirect.op, path: targets[0] });

            if (redirect.op === '<') {
                var user = H.userOf(state);
                var found = Fs.lookup(state.fs, user, abs);
                if (found.error) return done({ state: state, stdout: '', stderr: 'bash: ' + shown + ': ' + H.errorText(found.error) + '\n', code: 1, errno: found.error });
                if (found.node.kind === 'dir') { input = ''; continue; }
                if (!Fs.can(found.node, user, 'r')) return done({ state: state, stdout: '', stderr: 'bash: ' + shown + ': Permission denied\n', code: 1, errno: 'EACCES' });
                input = found.node.content;
                continue;
            }

            var append = redirect.op === '>>' || redirect.op === '2>>';
            var opened = openForWrite(state, abs, shown, append);
            if (opened.error) return done({ state: state, stdout: '', stderr: opened.error, code: 1, errno: opened.errno });
            state = opened.state;
            var target = { kind: abs === '/dev/null' ? 'null' : 'file', path: abs };
            if (redirect.op.charAt(0) === '2') err = target;
            else out = target;
        }

        var result;
        if (!args.length) {
            result = { state: state, stdout: '', stderr: '', code: 0 };
        } else if (args.length === 1 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) {
            var eq = args[0].indexOf('=');
            var vars = Object.assign({}, state.env);
            vars[args[0].slice(0, eq)] = args[0].slice(eq + 1);
            result = { state: Object.assign({}, state, { env: vars }), stdout: '', stderr: '', code: 0 };
            stage.name = '=';
            stage.args = args;
        } else {
            stage.name = args[0];
            stage.args = args.slice(1);
            var tty = isLast && out.kind === 'term' && env.tty !== false;
            if (args[0].indexOf('/') !== -1) {
                result = runPath(state, args[0], args.slice(1), input, tty, env);
            } else if (Registry.commands[args[0]]) {
                result = Registry.commands[args[0]].run({ state: state, args: args.slice(1), stdin: input, tty: tty, history: env.history, run: runNested(env) });
            } else {
                result = { state: state, stdout: '', stderr: 'bash: ' + args[0] + ': command not found\n', code: 127, errno: 'ENOCMD' };
            }
        }

        stage.stdoutLines = H.splitLines(result.stdout).length;
        stage.preview = stage.stdoutLines === 1 && result.stdout.length < 40 ? result.stdout.replace(/\n$/, '') : '';
        stage.stderrText = result.stderr;
        stage.code = result.code;
        stage.errno = result.errno;
        stage.script = result.script;

        // আউটপুট যার যার গন্তব্যে
        var routed = { state: result.state, term: '', termErr: '', pipe: '' };
        function deliver(target, text) {
            if (!text) return;
            if (target.kind === 'term') {
                if (target === err && target !== out) routed.termErr += text;
                else routed.term += text;
            } else if (target.kind === 'pipe') routed.pipe += text;
            else if (target.kind === 'file') routed.state = appendText(routed.state, target.path, text);
        }
        deliver(out, result.stdout);
        deliver(err, result.stderr);

        var final = { state: routed.state, stdout: routed.term, stderr: routed.termErr, pipe: routed.pipe, code: result.code, errno: result.errno };
        if (result.clear) final.clear = true;
        if (result.waiting) final.waiting = result.waiting;
        if (result.edit) final.edit = result.edit;
        if (result.survived) stage.survived = result.survived;
        return done(final);
    }

    function runNested(env) {
        return function (state, line) {
            return execLine(state, line, Object.assign({}, env, { depth: env.depth + 1 }));
        };
    }

    /* ---------- pipeline আর তালিকা ---------- */

    function execPipeline(state, pipeline, env) {
        var original = state;
        var text = null;
        var out = '';
        var err = '';
        var stages = [];
        var last = { code: 0 };
        var clear = false;
        var waiting = null;
        var edit = null;

        pipeline.forEach(function (command, index) {
            var r = execCommand(state, command, text, index === pipeline.length - 1, env);
            state = r.state;
            text = r.pipe;
            out += r.stdout;
            err += r.stderr;
            stages.push(r.stage);
            last = r;
            if (r.clear) clear = true;
            if (r.waiting) waiting = r.waiting;
            if (r.edit) edit = r.edit;
        });

        if (pipeline.length > 1) state = Object.assign({}, state, { cwd: original.cwd, env: original.env, aliases: original.aliases });
        var errno;
        stages.forEach(function (s) { if (s.code) errno = s.errno || errno; });
        var result = { state: state, stdout: out, stderr: err, code: last.code, errno: last.code ? last.errno : undefined, stages: stages };
        if (clear) result.clear = true;
        if (waiting) result.waiting = waiting;
        if (edit) result.edit = edit;
        if (!result.errno && result.code && errno) result.errno = errno;
        return result;
    }

    function textOf(pipeline) {
        return pipeline.map(function (command) {
            return command.argv.map(Parser.wordText).join(' ');
        }).join(' | ');
    }

    function execLine(state, line, env) {
        var parsed = Parser.parse(line);
        if (!parsed.ok) {
            var bad = { state: state, stdout: '', stderr: 'bash: ' + parsed.error + '\n', code: 2, errno: parsed.unsupported ? 'EUNSUPPORTED' : 'ESYNTAX', parseError: parsed, items: [] };
            return bad;
        }

        var out = '';
        var err = '';
        var items = [];
        var status = env.status;
        var skip = false;
        var errno;
        var clear = false;
        var waiting = null;
        var edit = null;

        parsed.list.forEach(function (item, index) {
            if (!skip) {
                var r = execPipeline(state, item.pipeline, Object.assign({}, env, { status: status }));
                state = r.state;
                out += r.stdout;
                err += r.stderr;
                status = r.code;
                errno = r.code ? r.errno : undefined;
                if (r.clear) clear = true;
                if (r.waiting) waiting = r.waiting;
                if (r.edit) edit = r.edit;
                items.push({ text: textOf(item.pipeline), stages: r.stages, sep: item.sep, code: r.code, errno: r.errno });
            } else {
                items.push({ text: textOf(item.pipeline), stages: [], sep: item.sep, skipped: true });
            }
            // এই item-এর পরের চিহ্ন ঠিক করে পরেরটা চলবে কিনা
            if (item.sep === '&&') skip = status !== 0;
            else if (item.sep === '||') skip = status === 0;
            else skip = false;
            if (index === parsed.list.length - 1) skip = false;
        });

        var result = { state: state, stdout: out, stderr: err, code: status, errno: status ? errno : undefined, items: items };
        if (clear) result.clear = true;
        if (waiting) result.waiting = waiting;
        if (edit) result.edit = edit;
        return result;
    }

    /* ---------- বাইরের দরজা ---------- */

    function empty(state) {
        return { state: state, stdout: '', stderr: '', code: 0, explain: '' };
    }

    // opts: { history: [...], status: সর্বশেষ exit code, tty: false হলে আউটপুট pipe-এর মতো (ls প্রতি লাইনে একটা) }
    function run(state, line, opts) {
        opts = opts || {};
        if (!line.trim()) return empty(state);

        var env = { history: opts.history || [], status: opts.status || 0, depth: 0, tty: opts.tty };
        var result = execLine(state, line, env);
        var next = result.state;
        if (next.fs !== state.fs) next = Object.assign({}, next, { clock: next.clock + 1 });
        result.state = next;

        result.explainError = result.code !== 0 && result.errno !== 'ENOMATCH';

        var Explain = explainer();
        if (result.parseError) {
            var p = result.parseError;
            if (p.unsupported) result.explain = Text.notSupported(p.error.replace(' এই simulator-এ নেই', ''));
            else result.explain = Explain.explain({ name: '', args: [], result: result, before: state, after: next });
        } else {
            result.explain = Explain.explainLine({ line: line, items: result.items, result: result, before: state, after: next });
        }
        return result;
    }

    // editor থেকে সেভ: ফাইলে সম্পূর্ণ লেখা বসায়। ফেরত { state } বা { error, errno }
    function writeFile(state, abs, content) {
        var opened = openForWrite(state, abs, abs, false);
        if (opened.error) return { error: opened.error, errno: opened.errno };
        var next = appendText(opened.state, abs, content);
        if (next.fs !== state.fs) next = Object.assign({}, next, { clock: next.clock + 1 });
        return { state: next };
    }

    var api = { run: run, prompt: prompt, writeFile: writeFile };
    if (isNode) module.exports = api;
    else root.LinuxShell = api;
})(typeof self !== 'undefined' ? self : this);
