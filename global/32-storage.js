// browser-এর localStorage-এ session রাখা।
// private window, ব্লক করা বা ভরা storage-এ exception আসতে পারে, তাই প্রতিটা read/write try/catch-এ।
// সেভ হয়: ভিত্তি-state, command-এর তালিকা, পর্দার লাইন, history আর mission-এর ধাপ।
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;
    var Seed = isNode ? require('./03-seed.js') : root.LinuxSeed;
    var Session = isNode ? require('./30-session.js') : root.LinuxSession;

    var KEY = 'msilabs-linux-simulator:v1';

    function isObject(x) {
        return typeof x === 'object' && x !== null && !Array.isArray(x);
    }

    function isMeta(m) {
        return isObject(m) && typeof m.owner === 'string' && typeof m.group === 'string' &&
            Number.isInteger(m.mode) && m.mode >= 0 && m.mode <= 0o7777 && typeof m.mtime === 'number';
    }

    // সেভ করা tree ঠিক আছে কিনা ভেতর পর্যন্ত দেখে। ঠিক হলে Fs-এর নিজের গঠনে আবার বানায় (children-এর prototype নেই)
    function rebuild(node, depth) {
        if (!isObject(node) || depth > 40 || !isMeta(node.meta)) return null;
        if (node.kind === 'file') return typeof node.content === 'string' ? Fs.file(node.content, node.meta) : null;
        if (node.kind === 'link') return typeof node.target === 'string' ? Fs.link(node.target, node.meta) : null;
        if (node.kind !== 'dir' || !isObject(node.children)) return null;
        var children = Object.create(null);
        var names = Object.keys(node.children);
        for (var i = 0; i < names.length; i++) {
            if (names[i] === '' || names[i].indexOf('/') !== -1) return null;
            var child = rebuild(node.children[names[i]], depth + 1);
            if (!child) return null;
            children[names[i]] = child;
        }
        return Fs.dir(children, node.meta);
    }

    function rebuildState(x) {
        if (!isObject(x) || typeof x.cwd !== 'string' || x.cwd.charAt(0) !== '/' || !Fs.USERS[x.user]) return null;
        if (!isObject(x.env) || !isObject(x.aliases) || !Array.isArray(x.processes) || typeof x.clock !== 'number') return null;
        var fs = rebuild(x.fs, 0);
        if (!fs || fs.kind !== 'dir') return null;
        var env = {};
        var aliases = {};
        var ok = Object.keys(x.env).every(function (k) { env[k] = x.env[k]; return typeof x.env[k] === 'string'; }) &&
            Object.keys(x.aliases).every(function (k) { aliases[k] = x.aliases[k]; return typeof x.aliases[k] === 'string'; });
        if (!ok) return null;
        return { fs: fs, cwd: x.cwd, user: x.user, env: env, aliases: aliases, processes: x.processes, clock: x.clock };
    }

    function serialize(s) {
        return JSON.stringify({
            v: 1,
            base: s.base,
            log: s.log,
            lines: s.lines,
            history: s.history,
            step: s.step,
            steps: s.past.map(function (p) { return p.step; })
        });
    }

    // ফল: { status: 'empty' } | { status: 'ok', session } | { status: 'corrupt' }
    function parse(raw) {
        if (!raw) return { status: 'empty' };
        try {
            var d = JSON.parse(raw);
            if (!isObject(d) || d.v !== 1) return { status: 'corrupt' };
            var lines = Session.isValidLines(d.lines) ? d.lines.slice(-Session.MAX_LINES) : null;
            var history = Session.isStringArray(d.history) ? d.history.slice(-Session.MAX_HISTORY) : null;
            var step = typeof d.step === 'number' && d.step >= 0 ? d.step : 0;
            var base = rebuildState(d.base);
            if (!lines || !history || !base || !Session.isValidLog(d.log)) return { status: 'corrupt' };

            var replayed = Session.replay(base, d.log);
            var steps = d.steps;
            var stepsOk = Array.isArray(steps) && steps.length === d.log.length && replayed.log.length === d.log.length &&
                steps.every(function (n) { return Number.isInteger(n) && n >= 0; });
            if (stepsOk) {
                replayed = { state: replayed.state, log: replayed.log, past: replayed.past.map(function (p, i) { return { state: p.state, step: steps[i], command: p.command }; }) };
            }
            var nextId = lines.reduce(function (m, l) { return Math.max(m, l.id); }, 0) + 1;
            var session = Object.assign(Session.freshSession(), replayed, { base: base, lines: lines, history: history, step: step, nextId: nextId });
            return { status: 'ok', session: session };
        } catch (e) {
            return { status: 'corrupt' };
        }
    }

    function load() {
        var raw = null;
        try { raw = root.localStorage.getItem(KEY); } catch (e) { return { status: 'empty' }; }
        return parse(raw);
    }

    // সফল হলে true; storage বন্ধ বা ভরা হলে false
    function save(s) {
        try { root.localStorage.setItem(KEY, serialize(s)); return true; } catch (e) { return false; }
    }

    function clear() {
        try { root.localStorage.removeItem(KEY); } catch (e) { /* উপেক্ষা */ }
    }

    // অন্য tab-এ সেভ বদলালে জানায়, যাতে দুই tab একে অপরের কাজ মুছে না ফেলে
    function watch(onChange) {
        var listener = function (e) {
            if (e.key === KEY || e.key === null) onChange(parse(e.newValue));
        };
        root.addEventListener('storage', listener);
        return function () { root.removeEventListener('storage', listener); };
    }

    var api = { KEY: KEY, serialize: serialize, parse: parse, load: load, save: save, clear: clear, watch: watch };
    if (isNode) module.exports = api;
    else root.LinuxStorage = api;
})(typeof self !== 'undefined' ? self : this);
