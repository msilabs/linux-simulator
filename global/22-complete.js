// Tab চাপলে কী কী মিলতে পারে: প্রথম শব্দে command, তারপর ফাইল আর ফোল্ডারের নাম
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;
    var H = isNode ? require('./08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('./09-registry.js') : root.LinuxRegistry;

    function commonPrefix(items) {
        var prefix = items[0];
        items.forEach(function (item) {
            while (item.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
        });
        return prefix;
    }

    // ফল: { text: নতুন পুরো লাইন, candidates: [সব মিল] }
    function complete(state, text) {
        var lastSpace = text.lastIndexOf(' ');
        var head = text.slice(0, lastSpace + 1);
        var word = text.slice(lastSpace + 1);
        var candidates;

        if (lastSpace === -1) {
            candidates = Registry.names().concat(Object.keys(state.aliases)).filter(function (name) { return name.indexOf(word) === 0; });
            candidates.sort();
        } else {
            var slash = word.lastIndexOf('/');
            var dirPart = word.slice(0, slash + 1);
            var prefix = word.slice(slash + 1);
            var user = H.userOf(state);
            var found = Fs.lookup(state.fs, user, H.resolveArg(state, dirPart || '.'));
            candidates = [];
            if (!found.error && found.node.kind === 'dir' && Fs.can(found.node, user, 'r')) {
                Fs.names(found.node).forEach(function (name) {
                    if (name.indexOf(prefix) !== 0) return;
                    if (name.charAt(0) === '.' && prefix.charAt(0) !== '.') return;
                    candidates.push(dirPart + name + (found.node.children[name].kind === 'dir' ? '/' : ''));
                });
            }
        }

        if (!candidates.length) return { text: text, candidates: [] };
        var common = commonPrefix(candidates);
        var done = candidates.length === 1;
        var suffix = done && common.charAt(common.length - 1) !== '/' ? ' ' : '';
        return { text: head + common + suffix, candidates: candidates };
    }

    var api = { complete: complete };
    if (isNode) module.exports = api;
    else root.LinuxComplete = api;
})(typeof self !== 'undefined' ? self : this);
