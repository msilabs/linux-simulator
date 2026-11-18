// path-এর সব হিসাব এক জায়গায়: ~, ., .., একাধিক / আর শেষের /
(function (root) {
    function split(path) {
        return path.split('/').filter(function (part) { return part !== ''; });
    }

    // পুরো (absolute) path-কে ছোট করে: /a/./b/../c// → /a/c
    function normalize(path) {
        var out = [];
        split(path).forEach(function (part) {
            if (part === '.') return;
            if (part === '..') out.pop();
            else out.push(part);
        });
        return '/' + out.join('/');
    }

    // ব্যবহারকারীর লেখা path থেকে পুরো path: ~ হলে home, না হলে cwd-র সাথে জোড়া
    function resolve(cwd, path, home) {
        if (path === '~') return normalize(home);
        if (path.indexOf('~/') === 0) return normalize(home + '/' + path.slice(2));
        if (path.charAt(0) === '/') return normalize(path);
        return normalize(cwd + '/' + path);
    }

    function dirname(abs) {
        var parts = split(abs);
        parts.pop();
        return '/' + parts.join('/');
    }

    function basename(abs) {
        var parts = split(abs);
        return parts.length ? parts[parts.length - 1] : '/';
    }

    function join(dir, name) {
        return normalize(dir + '/' + name);
    }

    // prompt-এ দেখানোর জন্য: home-এর ভেতরে হলে ~ দিয়ে ছোট করা
    function shorten(abs, home) {
        if (abs === home) return '~';
        if (abs.indexOf(home + '/') === 0) return '~' + abs.slice(home.length);
        return abs;
    }

    var api = { split: split, normalize: normalize, resolve: resolve, dirname: dirname, basename: basename, join: join, shorten: shorten };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxPath = api;
})(typeof self !== 'undefined' ? self : this);
