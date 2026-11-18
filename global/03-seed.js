// শুরুর file system আর state। প্রতিবার হুবহু একই, তাই test আর mission নির্ভরযোগ্য।
(function (root) {
    var Fs = typeof module !== 'undefined' && module.exports ? require('./02-fs.js') : root.LinuxFs;

    function fileOf(owner, group, mode, content, mtime) {
        return Fs.file(content, Fs.meta(owner, group, mode, mtime));
    }

    function dirOf(owner, group, mode, entries, mtime) {
        var children = Object.create(null);
        Object.keys(entries || {}).forEach(function (name) { children[name] = entries[name]; });
        return Fs.dir(children, Fs.meta(owner, group, mode, mtime));
    }

    // সরল, নির্দিষ্ট ক্রমের সংখ্যা: একই seed থেকে একই লগ
    function sequence(seed) {
        var n = seed;
        return function (max) {
            n = (n * 1103515245 + 12345) % 2147483648;
            // নিচের bit-গুলো বারবার একই ঘোরে, তাই উপরের bit নেওয়া হয়
            return (n >>> 12) % max;
        };
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function accessLog() {
        var next = sequence(7);
        var ips = ['203.0.113.10', '203.0.113.24', '198.51.100.7', '198.51.100.52', '192.0.2.18'];
        var paths = ['/', '/index.html', '/about', '/contact', '/api/users', '/api/orders', '/login', '/static/app.js', '/static/style.css', '/old-page'];
        var statuses = [200, 200, 200, 200, 200, 301, 404, 404, 500, 200];
        var lines = [];
        for (var i = 0; i < 60; i++) {
            var minute = 8 * 60 + i * 2;
            var time = '18/Nov/2026:' + pad(Math.floor(minute / 60)) + ':' + pad(minute % 60) + ':' + pad(next(60));
            var path = paths[next(paths.length)];
            var status = statuses[next(statuses.length)];
            var size = status === 200 ? 300 + next(4000) : 150;
            lines.push(ips[next(ips.length)] + ' - - [' + time + ' +0600] "GET ' + path + ' HTTP/1.1" ' + status + ' ' + size);
        }
        return lines.join('\n') + '\n';
    }

    function errorLog() {
        var next = sequence(21);
        var messages = [
            ['INFO', 'server started on port 80'],
            ['INFO', 'configuration reloaded'],
            ['WARN', 'slow response from upstream: 2.4s'],
            ['ERROR', 'upstream timed out while reading response header'],
            ['ERROR', 'open() "/var/www/html/old-page" failed: No such file or directory'],
            ['WARN', 'cache is almost full: 91%'],
            ['ERROR', 'connect() to 192.0.2.50:9000 failed: Connection refused'],
            ['INFO', 'worker process exited normally']
        ];
        var lines = [];
        for (var i = 0; i < 30; i++) {
            var minute = 8 * 60 + i * 5;
            var m = messages[next(messages.length)];
            lines.push('2026-11-18 ' + pad(Math.floor(minute / 60)) + ':' + pad(minute % 60) + ':' + pad(next(60)) + ' [' + m[0] + '] ' + m[1]);
        }
        return lines.join('\n') + '\n';
    }

    var BACKUP_SH = '#!/bin/bash\n# notes.txt আর projects ফোল্ডারের একটা কপি বানায়\nmkdir -p /tmp/backup\ncp -r /home/dev/projects /tmp/backup\ncp /home/dev/notes.txt /tmp/backup\necho "backup শেষ"\n';

    function createFs() {
        var u = function (mode, content, mtime) { return fileOf('dev', 'dev', mode, content, mtime); };
        var d = function (entries, mtime) { return dirOf('dev', 'dev', 0o755, entries, mtime); };

        var home = dirOf('dev', 'dev', 0o755, {
            'notes.txt': u(0o644, 'Linux শেখার নোট\n১. ls দিয়ে ফাইল দেখা\n২. cd দিয়ে ফোল্ডারে ঢোকা\n৩. cat দিয়ে ফাইল পড়া\n', -4300),
            '.bashrc': u(0o644, '# প্রতিবার shell চালু হলে এই ফাইল পড়া হয়\nalias ll=\'ls -la\'\n', -9000),
            projects: d({
                'my-site': d({
                    'index.html': u(0o644, '<!doctype html>\n<html>\n<head>\n  <title>আমার সাইট</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>স্বাগতম</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n', -2600),
                    'style.css': u(0o644, 'body {\n  font-family: sans-serif;\n  margin: 2rem;\n}\nh1 {\n  color: teal;\n}\n', -2590),
                    'app.js': u(0o644, 'console.log("সাইট চালু হয়েছে");\n', -2580)
                }, -2600)
            }, -2600),
            scripts: d({
                'backup.sh': u(0o644, BACKUP_SH, -1500)
            }, -1500),
            downloads: d({
                'photo1.jpg': u(0o644, '[ছবির ডেটা]\n', -800),
                'photo2.jpg': u(0o644, '[ছবির ডেটা]\n', -790),
                'report.pdf': u(0o644, '[PDF-এর ডেটা]\n', -700),
                'resume.pdf': u(0o644, '[PDF-এর ডেটা]\n', -690),
                'song.mp3': u(0o644, '[গানের ডেটা]\n', -600),
                'setup.zip': u(0o644, '[zip-এর ডেটা]\n', -500),
                'old-notes.txt': u(0o644, 'পুরনো নোট, আর লাগবে না\n', -400)
            }, -300)
        }, -100);

        var log = dirOf('root', 'adm', 0o755, {
            nginx: dirOf('root', 'adm', 0o755, {
                'access.log': fileOf('root', 'adm', 0o644, accessLog(), -60),
                'error.log': fileOf('root', 'adm', 0o644, errorLog(), -55)
            }, -55)
        }, -55);

        var etc = dirOf('root', 'root', 0o755, {
            hosts: fileOf('root', 'root', 0o644, '127.0.0.1\tlocalhost\n127.0.1.1\tlaptop\n', -20000),
            passwd: fileOf('root', 'root', 0o644, 'root:x:0:0:root:/root:/bin/bash\ndev:x:1000:1000:dev:/home/dev:/bin/bash\n', -20000)
        }, -20000);

        return dirOf('root', 'root', 0o755, {
            home: dirOf('root', 'root', 0o755, { dev: home }, -20000),
            root: dirOf('root', 'root', 0o700, {}, -20000),
            var: dirOf('root', 'root', 0o755, { log: log }, -20000),
            etc: etc,
            tmp: dirOf('root', 'root', 0o777, {}, -10)
        }, -20000);
    }

    function createState() {
        return {
            fs: createFs(),
            cwd: '/home/dev',
            user: 'dev',
            env: {
                HOME: '/home/dev',
                USER: 'dev',
                PWD: '/home/dev',
                OLDPWD: '',
                PATH: '/usr/local/bin:/usr/bin:/bin',
                SHELL: '/bin/bash'
            },
            aliases: {},
            processes: [],
            clock: 0
        };
    }

    var api = { createState: createState };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxSeed = api;
})(typeof self !== 'undefined' ? self : this);
