// word থেকে আসল argument বানায়: ~, $VAR, ${VAR}, $? আর glob (*, ?, [abc])
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;

    var NAME = /^[A-Za-z_][A-Za-z0-9_]*/;

    // বাড়তি সাহায্য: $ চিহ্নের পরের অংশ পড়ে (মান, কতটা পড়া হলো) ফেরত দেয়; $ সাধারণ অক্ষর হলে null
    function readVariable(text, at, ctx) {
        var rest = text.slice(at + 1);
        if (rest.charAt(0) === '?') return { value: String(ctx.status || 0), length: 2 };
        if (rest.charAt(0) === '{') {
            var close = rest.indexOf('}');
            if (close === -1) return null;
            var inner = rest.slice(1, close);
            if (!NAME.test(inner) || NAME.exec(inner)[0] !== inner) return null;
            return { value: ctx.env[inner] || '', length: close + 2 };
        }
        var m = NAME.exec(rest);
        if (!m) return null;
        return { value: ctx.env[m[0]] || '', length: m[0].length + 1 };
    }

    // [{ c: 'অক্ষর', magic: true/false }]: magic মানে quote ছাড়া লেখা * ? [
    function buildChars(word, ctx) {
        var chars = [];
        var hadQuote = false;
        word.segs.forEach(function (seg, segIndex) {
            if (seg.q !== 'none') hadQuote = true;
            var text = seg.t;
            if (seg.q === 'single') {
                for (var s = 0; s < text.length; s++) chars.push({ c: text[s], magic: false });
                return;
            }
            var i = 0;
            if (seg.q === 'none' && segIndex === 0 && text.charAt(0) === '~' && (text.length === 1 || text.charAt(1) === '/')) {
                var home = ctx.env.HOME || '/';
                for (var h = 0; h < home.length; h++) chars.push({ c: home[h], magic: false });
                i = 1;
            }
            while (i < text.length) {
                var ch = text[i];
                if (ch === '$') {
                    var v = readVariable(text, i, ctx);
                    if (v) {
                        for (var k = 0; k < v.value.length; k++) chars.push({ c: v.value[k], magic: false });
                        i += v.length;
                        continue;
                    }
                }
                chars.push({ c: ch, magic: seg.q === 'none' && (ch === '*' || ch === '?' || ch === '[') });
                i++;
            }
        });
        return { chars: chars, hadQuote: hadQuote };
    }

    function escapeRegex(c) {
        return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // এক অংশের (/ ছাড়া) pattern থেকে RegExp
    function componentRegex(chars) {
        var source = '^';
        for (var i = 0; i < chars.length; i++) {
            var item = chars[i];
            if (!item.magic) { source += escapeRegex(item.c); continue; }
            if (item.c === '*') { source += '[^/]*'; continue; }
            if (item.c === '?') { source += '[^/]'; continue; }
            // [ ... ]: বন্ধ ] পেলে bracket, না পেলে সাধারণ [
            var end = -1;
            for (var j = i + 2; j < chars.length; j++) if (chars[j].c === ']') { end = j; break; }
            if (end === -1) { source += '\\['; continue; }
            var body = chars.slice(i + 1, end).map(function (x) { return x.c; }).join('');
            var negate = body.charAt(0) === '!' || body.charAt(0) === '^';
            if (negate) body = body.slice(1);
            source += '[' + (negate ? '^' : '') + body.replace(/[\\\]^]/g, '\\$&') + ']';
            i = end;
        }
        return new RegExp(source + '$');
    }

    function globComponents(chars) {
        var parts = [[]];
        chars.forEach(function (item) {
            if (item.c === '/' && !item.magic) parts.push([]);
            else parts[parts.length - 1].push(item);
        });
        return parts;
    }

    function hasMagic(chars) {
        return chars.some(function (item) { return item.magic; });
    }

    function glob(chars, ctx) {
        var absolute = chars[0] && chars[0].c === '/';
        var parts = globComponents(chars);
        if (absolute) parts.shift();
        var user = Fs.USERS[ctx.user];
        var results = [];

        function walk(dirAbs, prefix, index) {
            if (index === parts.length) { results.push(prefix); return; }
            var comp = parts[index];
            var last = index === parts.length - 1;
            if (comp.length === 0) {
                // // বা শেষের / : পরের অংশে যাও
                walk(dirAbs, prefix + (prefix && prefix.slice(-1) !== '/' ? '/' : ''), index + 1);
                return;
            }
            if (!hasMagic(comp)) {
                var plain = comp.map(function (x) { return x.c; }).join('');
                var found = Fs.lookup(ctx.fs, user, Path.join(dirAbs, plain));
                if (found.error) return;
                if (!last && found.node.kind !== 'dir') return;
                walk(Path.join(dirAbs, plain), prefix + (prefix && prefix.slice(-1) !== '/' ? '/' : '') + plain, index + 1);
                return;
            }
            var dirNode = Fs.lookup(ctx.fs, user, dirAbs);
            if (dirNode.error || dirNode.node.kind !== 'dir' || !Fs.can(dirNode.node, user, 'r')) return;
            var regex = componentRegex(comp);
            var showHidden = comp[0].c === '.';
            Fs.names(dirNode.node).forEach(function (name) {
                if (name.charAt(0) === '.' && !showHidden) return;
                if (!regex.test(name)) return;
                var child = dirNode.node.children[name];
                if (!last && child.kind !== 'dir') return;
                walk(Path.join(dirAbs, name), prefix + (prefix && prefix.slice(-1) !== '/' ? '/' : '') + name, index + 1);
            });
        }

        walk(absolute ? '/' : ctx.cwd, absolute ? '/' : '', 0);
        if (absolute) results = results.map(function (r) { return r; });
        return results;
    }

    // ctx: { env, cwd, fs, user, status }। ফেরত: argument-এর তালিকা (glob মিললে একাধিক হতে পারে)
    function expandWord(word, ctx) {
        var built = buildChars(word, ctx);
        var text = built.chars.map(function (x) { return x.c; }).join('');
        if (hasMagic(built.chars)) {
            var matches = glob(built.chars, ctx);
            if (matches.length) return matches;
            return [text];
        }
        if (text === '' && !built.hadQuote) return [];
        return [text];
    }

    function expandAll(words, ctx) {
        var out = [];
        words.forEach(function (word) {
            expandWord(word, ctx).forEach(function (arg) { out.push(arg); });
        });
        return out;
    }

    // glob-এর লেখা (যেমন *.txt) থেকে RegExp, find -name-এর জন্য। পুরো লেখার সাথে মেলে।
    function patternToRegex(pattern, ignoreCase) {
        var chars = pattern.split('').map(function (c) { return { c: c, magic: c === '*' || c === '?' || c === '[' }; });
        var base = componentRegex(chars);
        return ignoreCase ? new RegExp(base.source, 'i') : base;
    }

    var api = { expandWord: expandWord, expandAll: expandAll, patternToRegex: patternToRegex };
    if (isNode) module.exports = api;
    else root.LinuxExpand = api;
})(typeof self !== 'undefined' ? self : this);
