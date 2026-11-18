// env, export, unset, alias, unalias, which, man: shell-এর নিজের পরিবেশ আর সাহায্য
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    var BUILTINS = ['cd', 'export', 'unset', 'alias', 'unalias', 'history', 'help'];
    var NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

    function withEnv(state, env) {
        return Object.assign({}, state, { env: env });
    }

    Registry.register('true', {
        desc: 'কিছু না করে সফল হয় (exit code 0)',
        run: function (ctx) { return H.ok(ctx.state); }
    });

    Registry.register('false', {
        desc: 'কিছু না করে ব্যর্থ হয় (exit code 1)',
        run: function (ctx) { return { state: ctx.state, stdout: '', stderr: '', code: 1, errno: 'EFALSE' }; }
    });

    Registry.register('env', {
        desc: 'পরিবেশের সব variable দেখায়',
        run: function (ctx) {
            var env = ctx.state.env;
            var lines = Object.keys(env).filter(function (k) { return !(k === 'OLDPWD' && env[k] === ''); }).map(function (k) { return k + '=' + env[k]; });
            return H.ok(ctx.state, lines.join('\n') + '\n');
        }
    });

    Registry.register('export', {
        desc: 'variable বানায় বা বদলায় (export NAME=মান)',
        run: function (ctx) {
            var state = ctx.state;
            if (!ctx.args.length) {
                var env = state.env;
                var listing = Object.keys(env).sort().filter(function (k) { return !(k === 'OLDPWD' && env[k] === ''); }).map(function (k) { return 'declare -x ' + k + '="' + env[k] + '"'; });
                return H.ok(state, listing.join('\n') + '\n');
            }
            var next = Object.assign({}, state.env);
            var err = '';
            ctx.args.forEach(function (arg) {
                var eq = arg.indexOf('=');
                var name = eq === -1 ? arg : arg.slice(0, eq);
                if (!NAME.test(name)) { err += "bash: export: `" + arg + "': not a valid identifier\n"; return; }
                if (eq !== -1) next[name] = arg.slice(eq + 1);
                else if (!Object.prototype.hasOwnProperty.call(next, name)) next[name] = '';
            });
            return { state: withEnv(state, next), stdout: '', stderr: err, code: err ? 1 : 0, errno: err ? 'EIDENT' : undefined };
        }
    });

    Registry.register('unset', {
        desc: 'variable মুছে ফেলে',
        run: function (ctx) {
            var next = Object.assign({}, ctx.state.env);
            ctx.args.forEach(function (name) { delete next[name]; });
            return H.ok(withEnv(ctx.state, next));
        }
    });

    Registry.register('alias', {
        desc: 'ছোট নাম বানায় (alias ll=\'ls -la\')',
        run: function (ctx) {
            var state = ctx.state;
            var aliases = state.aliases;
            if (!ctx.args.length) {
                var all = Object.keys(aliases).sort().map(function (k) { return "alias " + k + "='" + aliases[k] + "'"; });
                return H.ok(state, all.length ? all.join('\n') + '\n' : '');
            }
            var next = Object.assign({}, aliases);
            var out = '';
            var err = '';
            ctx.args.forEach(function (arg) {
                var eq = arg.indexOf('=');
                if (eq === -1) {
                    if (Object.prototype.hasOwnProperty.call(aliases, arg)) out += "alias " + arg + "='" + aliases[arg] + "'\n";
                    else err += 'bash: alias: ' + arg + ': not found\n';
                    return;
                }
                var name = arg.slice(0, eq);
                if (!name || /[\s\/$`"'\\|&;<>()]/.test(name)) { err += "bash: alias: `" + name + "': invalid alias name\n"; return; }
                next[name] = arg.slice(eq + 1);
            });
            return { state: Object.assign({}, state, { aliases: next }), stdout: out, stderr: err, code: err ? 1 : 0, errno: err ? 'EALIAS' : undefined };
        }
    });

    Registry.register('unalias', {
        desc: 'alias মুছে ফেলে',
        run: function (ctx) {
            var state = ctx.state;
            if (ctx.args[0] === '-a') return H.ok(Object.assign({}, state, { aliases: {} }));
            if (!ctx.args.length) return H.fail(state, 'unalias: usage: unalias [-a] name [name ...]\n', 2, 'EOPERAND');
            var next = Object.assign({}, state.aliases);
            var err = '';
            ctx.args.forEach(function (name) {
                if (Object.prototype.hasOwnProperty.call(next, name)) delete next[name];
                else err += 'bash: unalias: ' + name + ': not found\n';
            });
            return { state: Object.assign({}, state, { aliases: next }), stdout: '', stderr: err, code: err ? 1 : 0, errno: err ? 'EALIAS' : undefined };
        }
    });

    Registry.register('which', {
        desc: 'command কোথায় আছে দেখায়',
        run: function (ctx) {
            var out = '';
            var missing = false;
            ctx.args.forEach(function (name) {
                if (Registry.commands[name] && BUILTINS.indexOf(name) === -1) out += '/usr/bin/' + name + '\n';
                else missing = true;
            });
            return { state: ctx.state, stdout: out, stderr: '', code: missing || !ctx.args.length ? 1 : 0, errno: missing ? 'ENOCMD' : undefined };
        }
    });

    Registry.register('man', {
        desc: 'command-এর বাংলা manual দেখায়',
        run: function (ctx) {
            var Man = isNode ? require('../23-man.js') : root.LinuxMan;
            if (!ctx.args.length) return H.fail(ctx.state, 'What manual page do you want?\nFor example, try \'man man\'.\n', 1, 'EOPERAND');
            var out = '';
            var err = '';
            ctx.args.forEach(function (name) {
                var page = Man.render(name);
                if (page) out += page;
                else err += 'No manual entry for ' + name + '\n';
            });
            return { state: ctx.state, stdout: out, stderr: err, code: err ? 16 : 0, errno: err ? 'ENOMAN' : undefined };
        }
    });
})(typeof self !== 'undefined' ? self : this);
