// clear, history, help: terminal নিজেকে নিয়ে যা করে
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    Registry.register('clear', {
        desc: 'পর্দা পরিষ্কার করে',
        run: function (ctx) {
            var result = H.ok(ctx.state);
            result.clear = true;
            return result;
        }
    });

    Registry.register('history', {
        desc: 'আগে চালানো command-এর তালিকা দেখায়',
        run: function (ctx) {
            var lines = (ctx.history || []).map(function (line, index) {
                var n = String(index + 1);
                while (n.length < 5) n = ' ' + n;
                return n + '  ' + line;
            });
            return H.ok(ctx.state, lines.length ? lines.join('\n') + '\n' : '');
        }
    });

    Registry.register('help', {
        desc: 'command-এর তালিকা দেখায়',
        run: function (ctx) {
            var names = Registry.names();
            var width = 0;
            names.forEach(function (name) { width = Math.max(width, name.length); });
            var lines = names.map(function (name) {
                var pad = name;
                while (pad.length < width) pad += ' ';
                return pad + '  ' + Registry.commands[name].desc;
            });
            return H.ok(ctx.state, 'এই simulator-এ যেসব command চলে:\n\n' + lines.join('\n') + '\n');
        }
    });
})(typeof self !== 'undefined' ? self : this);
