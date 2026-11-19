// challenge চালু করা আর যাচাই। challenge থাকে data/challenges/*.json-এ, check-গুলো ঘোষণার আকারে:
//   { "type": "cwd", "path": "~/projects" }
//   { "type": "exists" | "missing", "path": "~/a.txt" }
//   { "type": "content", "path": "~/a.txt", "equals" | "contains": "..." }
//   { "type": "mode", "path": "~/a.txt", "mode": "600" }
//   { "type": "owner", "path": "~/a.txt", "owner": "root" }
//   { "type": "stdout", "equals" | "contains": "..." }   শেষ command-এর আউটপুট, শেষের \n বাদে
//   { "type": "noProcess", "cmd": "node server.js" }
//   { "type": "alias", "name": "ll", "value"?: "ls -la" }
//   { "type": "env", "name": "EDITOR", "value"?: "nano" }
// প্রতিটা check-এ চাইলে নিজের "label" দেওয়া যায়, না দিলে এখানে বানানো হয়।
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;
    var Shell = isNode ? require('./20-shell.js') : root.LinuxShell;
    var Session = isNode ? require('./30-session.js') : root.LinuxSession;

    var HOME = '/home/dev';

    function abs(path) {
        if (path === '~') return HOME;
        return path.indexOf('~/') === 0 ? HOME + path.slice(1) : path;
    }

    function node(state, path) {
        var found = Fs.lookup(state.fs, Fs.USERS.root, abs(path), false);
        return found.error ? null : found.node;
    }

    function trimEnd(text) {
        return text.replace(/\n+$/, '');
    }

    function has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function matchText(actual, check) {
        if (actual === undefined || actual === null) return false;
        if (has(check, 'equals')) return actual === check.equals;
        return actual.indexOf(check.contains) !== -1;
    }

    var RULES = {
        cwd: {
            label: function (c) { return 'এখন `' + c.path + '`-এ আছেন'; },
            test: function (c, s) { return s.state.cwd === abs(c.path); }
        },
        exists: {
            label: function (c) { return '`' + c.path + '` আছে'; },
            test: function (c, s) { return !!node(s.state, c.path); }
        },
        missing: {
            label: function (c) { return '`' + c.path + '` আর নেই'; },
            test: function (c, s) { return !node(s.state, c.path); }
        },
        content: {
            label: function (c) { return '`' + c.path + '`-এ ঠিক লেখা আছে'; },
            test: function (c, s) {
                var n = node(s.state, c.path);
                return !!n && n.kind === 'file' && matchText(n.content, c);
            }
        },
        mode: {
            label: function (c) { return '`' + c.path + '`-এর অধিকার `' + c.mode + '`'; },
            test: function (c, s) {
                var n = node(s.state, c.path);
                return !!n && (n.meta.mode & 0o777) === parseInt(c.mode, 8);
            }
        },
        owner: {
            label: function (c) { return '`' + c.path + '`-এর মালিক `' + c.owner + '`'; },
            test: function (c, s) {
                var n = node(s.state, c.path);
                return !!n && n.meta.owner === c.owner;
            }
        },
        stdout: {
            label: function () { return 'শেষ command-এর আউটপুট ঠিক'; },
            test: function (c, s) { return !!s.last && matchText(trimEnd(s.last.stdout), c); }
        },
        noProcess: {
            label: function (c) { return '`' + c.cmd + '` আর চলছে না'; },
            test: function (c, s) { return !s.state.processes.some(function (p) { return p.cmd.indexOf(c.cmd) !== -1; }); }
        },
        alias: {
            label: function (c) { return '`' + c.name + '` নামে alias আছে'; },
            test: function (c, s) { return has(s.state.aliases, c.name) && (!has(c, 'value') || s.state.aliases[c.name] === c.value); }
        },
        env: {
            label: function (c) { return '`$' + c.name + '` variable আছে'; },
            test: function (c, s) { return has(s.state.env, c.name) && s.state.env[c.name] !== '' && (!has(c, 'value') || s.state.env[c.name] === c.value); }
        }
    };

    // নতুন seed-এ setup-এর command চালিয়ে challenge-এর শুরুর session বানায়। setup পর্দায় দেখা যায় না।
    function start(challenge, welcome) {
        var s = Session.freshSession(welcome);
        var state = s.state;
        (challenge.setup || []).forEach(function (command) {
            state = Shell.run(state, command, { history: [], status: 0 }).state;
        });
        return Object.assign({}, s, { state: state, base: state });
    }

    function check(challenge, session) {
        var results = challenge.checks.map(function (c) {
            var rule = RULES[c.type];
            if (!rule) return { label: 'অজানা check: ' + c.type, pass: false };
            return { label: c.label || rule.label(c), pass: !!rule.test(c, session) };
        });
        return { pass: results.length > 0 && results.every(function (r) { return r.pass; }), results: results };
    }

    var api = { TYPES: Object.keys(RULES), start: start, check: check };
    if (isNode) module.exports = api;
    else root.LinuxChallenge = api;
})(typeof self !== 'undefined' ? self : this);
