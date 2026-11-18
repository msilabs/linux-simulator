// mission আর তাদের ধাপ। ধাপ পূর্ণ হয় ফল দেখে, হুবহু লেখা মিলিয়ে নয়:
// যেমন `mkdir -p a/b` আর `mkdir a && mkdir a/b` দুটোতেই একই ধাপ পূর্ণ হয়।
//
// অগ্রগতি একটা সংখ্যা: সব mission-এর ধাপ পরপর সাজালে কয়টা শেষ হয়েছে। তাই undo আর সেভ সহজ।
// mission-এর লেখা বা ক্রম বদলাতে শুধু এই ফাইল বদলান। নতুন ধাপ শুধু শেষে যোগ করুন,
// নাহলে পুরোনো সেভের অগ্রগতি অন্য ধাপে চলে যাবে।
//
// ctx = { prev, next, command, ok, stdout, stderr, errno, waiting, stopped }
//   prev, next: command-এর আগের আর পরের state; stopped: চলতে থাকা program Ctrl+C-তে থেমেছে
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('./01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('./02-fs.js') : root.LinuxFs;

    var HOME = '/home/dev';
    var ACCESS_LOG = '/var/log/nginx/access.log';
    var ERROR_LOG = '/var/log/nginx/error.log';

    /* ---------- ছোট সাহায্যকারী ---------- */

    function node(state, abs) {
        var found = Fs.lookup(state.fs, Fs.USERS.root, abs, false);
        return found.error ? null : found.node;
    }

    function text(state, abs) {
        var n = node(state, abs);
        return n && n.kind === 'file' ? n.content : undefined;
    }

    function first(command) {
        var m = /^\s*(\S+)/.exec(command);
        return m ? m[1] : '';
    }

    function has(command, regex) {
        return regex.test(command);
    }

    function lines(content) {
        return content === undefined ? [] : content.split('\n').filter(Boolean);
    }

    function created(ctx, abs) {
        return !node(ctx.prev, abs) && !!node(ctx.next, abs);
    }

    function listNames(state, abs) {
        var n = node(state, abs);
        return n && n.kind === 'dir' ? Object.keys(n.children) : [];
    }

    function isNumber(stdout) {
        return /^\d+\n$/.test(stdout);
    }

    // কোন কোন path নতুন বা বদলেছে: FileTree-র diff ব্যবহার করে (দেরিতে খুঁজি, কারণ ওটা পরে লোড হয়)
    function changes(ctx) {
        var FileTree = isNode ? require('./33-filetree.js') : root.LinuxFileTree;
        return FileTree.diff(ctx.prev.fs, ctx.next.fs);
    }

    function pids(state) {
        return state.processes.map(function (p) { return p.pid; });
    }

    function userVars(env) {
        return Object.keys(env).filter(function (k) { return ['HOME', 'USER', 'PWD', 'OLDPWD', 'PATH', 'SHELL'].indexOf(k) === -1; });
    }

    /* ---------- mission ---------- */

    var MISSIONS = [
        {
            title: 'কোথায় আছি?',
            goal: 'terminal-এ সবসময় একটা ফোল্ডারে থাকেন। কোথায় আছেন দেখা আর এক ফোল্ডার থেকে অন্যটায় যাওয়া শিখুন।',
            stages: [
                { label: '`pwd` চালিয়ে দেখুন এখন কোন ফোল্ডারে আছেন', command: 'pwd', check: function (c) { return c.ok && first(c.command) === 'pwd'; } },
                { label: '`ls` দিয়ে ফোল্ডারের ভেতরের জিনিস দেখুন', command: 'ls', check: function (c) { return c.ok && first(c.command) === 'ls'; } },
                { label: '`cd projects/my-site` দিয়ে দুই ধাপ ভেতরে ঢুকুন', command: 'cd projects/my-site', check: function (c) { return c.next.cwd === HOME + '/projects/my-site' && c.prev.cwd !== c.next.cwd; } },
                { label: '`cd ..` দিয়ে এক ধাপ উপরে উঠুন', command: 'cd ..', check: function (c) { return c.prev.cwd === HOME + '/projects/my-site' && c.next.cwd === HOME + '/projects'; } },
                { label: '`cd ~` (বা শুধু `cd`) দিয়ে এক লাফে home-এ ফিরুন', command: 'cd ~', check: function (c) { return c.prev.cwd !== HOME && c.next.cwd === HOME; } }
            ]
        },
        {
            title: 'নতুন প্রজেক্ট',
            goal: 'ফোল্ডার আর ফাইল বানানো, আর ফাইলে লেখা। `>` চিহ্ন command-এর আউটপুট ফাইলে পাঠায়।',
            stages: [
                { label: '`mkdir -p projects/blog/css` দিয়ে এক command-এ তিন স্তরের ফোল্ডার বানান', command: 'mkdir -p projects/blog/css', check: function (c) { return created(c, HOME + '/projects/blog/css'); } },
                { label: '`cd projects/blog` দিয়ে নতুন ফোল্ডারে ঢুকুন', command: 'cd projects/blog', check: function (c) { return c.next.cwd === HOME + '/projects/blog'; } },
                { label: '`touch index.html` দিয়ে খালি ফাইল বানান', command: 'touch index.html', check: function (c) { return created(c, HOME + '/projects/blog/index.html'); } },
                { label: '`echo "..." > index.html` দিয়ে ফাইলে কিছু লিখুন', command: 'echo "<h1>আমার ব্লগ</h1>" > index.html', hint: '`>` পর্দার বদলে ফাইলে লেখে। আগের লেখা থাকলে মুছে যায়।', check: function (c) { return has(c.command, />/) && text(c.prev, HOME + '/projects/blog/index.html') === '' && (text(c.next, HOME + '/projects/blog/index.html') || '') !== ''; } },
                { label: '`cat index.html` দিয়ে লেখাটা পড়ুন', command: 'cat index.html', check: function (c) { return c.ok && first(c.command) === 'cat' && c.stdout.indexOf('<h1>') !== -1; } }
            ]
        },
        {
            title: 'ফাইল পড়া',
            goal: 'বড় ফাইল পুরোটা না পড়ে শুরু বা শেষ দেখা, আর লাইন গোনা। log ফাইলে এটা রোজ লাগে।',
            stages: [
                { label: '`cat ~/notes.txt` দিয়ে নোটটা পড়ুন', command: 'cat ~/notes.txt', check: function (c) { return c.ok && first(c.command) === 'cat' && c.stdout === text(c.next, HOME + '/notes.txt'); } },
                { label: '`head -n 2` দিয়ে access.log-এর প্রথম দুই লাইন দেখুন', command: 'head -n 2 ' + ACCESS_LOG, check: function (c) { return first(c.command) === 'head' && c.stdout === lines(text(c.next, ACCESS_LOG)).slice(0, 2).join('\n') + '\n'; } },
                { label: '`tail -n 3` দিয়ে error.log-এর শেষ তিন লাইন দেখুন', command: 'tail -n 3 ' + ERROR_LOG, check: function (c) { return first(c.command) === 'tail' && c.stdout === lines(text(c.next, ERROR_LOG)).slice(-3).join('\n') + '\n'; } },
                { label: '`wc -l` দিয়ে access.log-এ কত লাইন আছে গুনুন', command: 'wc -l ' + ACCESS_LOG, check: function (c) { return c.ok && first(c.command) === 'wc' && has(c.command, /-\w*l/) && /^\d+ /.test(c.stdout); } }
            ]
        },
        {
            title: 'downloads গোছানো',
            goal: 'ফাইল সরানো, মোছা, আর `*` দিয়ে একসাথে অনেক ফাইল ধরা। `*.jpg` মানে নামের শেষে .jpg আছে এমন সব।',
            stages: [
                { label: '`downloads`-এর ভেতরে `pics` নামে ফোল্ডার বানান', command: 'mkdir ~/downloads/pics', check: function (c) { return created(c, HOME + '/downloads/pics'); } },
                { label: '`downloads`-এর ভেতরে `docs` নামে ফোল্ডার বানান', command: 'mkdir ~/downloads/docs', check: function (c) { return created(c, HOME + '/downloads/docs'); } },
                { label: '`mv ~/downloads/*.jpg ~/downloads/pics` দিয়ে সব ছবি `pics`-এ সরান', command: 'mv ~/downloads/*.jpg ~/downloads/pics', hint: '`*.jpg` shell নিজে বাড়িয়ে `photo1.jpg photo2.jpg` বানিয়ে দেয়, তারপর `mv` চলে।', check: function (c) { var top = listNames(c.next, HOME + '/downloads').filter(function (n) { return /\.jpg$/.test(n); }); return listNames(c.prev, HOME + '/downloads').some(function (n) { return /\.jpg$/.test(n); }) && top.length === 0 && listNames(c.next, HOME + '/downloads/pics').length >= 2; } },
                { label: '`mv ~/downloads/*.pdf ~/downloads/docs` দিয়ে সব PDF `docs`-এ সরান', command: 'mv ~/downloads/*.pdf ~/downloads/docs', check: function (c) { var top = listNames(c.next, HOME + '/downloads').filter(function (n) { return /\.pdf$/.test(n); }); return listNames(c.prev, HOME + '/downloads').some(function (n) { return /\.pdf$/.test(n); }) && top.length === 0 && listNames(c.next, HOME + '/downloads/docs').length >= 2; } },
                { label: '`rm ~/downloads/old-notes.txt` দিয়ে পুরনো নোট মুছুন', command: 'rm ~/downloads/old-notes.txt', hint: '`rm` দিয়ে মুছলে Recycle Bin-এ যায় না, আর ফেরত আসে না। এখানে অবশ্য Undo আছে।', check: function (c) { return !!node(c.prev, HOME + '/downloads/old-notes.txt') && !node(c.next, HOME + '/downloads/old-notes.txt'); } }
            ]
        },
        {
            title: 'খুঁজে বের করা',
            goal: 'কোনো ফাইল কোথায় আছে ভুলে গেলে `find` দিয়ে নাম ধরে খোঁজা, আর `grep` দিয়ে ফাইলের ভেতরের লেখা খোঁজা।',
            stages: [
                { label: '`find /var/log -name "*.log"` দিয়ে নামে `.log` শেষ হওয়া ফাইল খুঁজুন', command: 'find /var/log -name "*.log"', check: function (c) { return c.ok && first(c.command) === 'find' && has(c.command, /-i?name/) && c.stdout.indexOf('error.log') !== -1; } },
                { label: '`find ~ -type d` দিয়ে শুধু ফোল্ডারগুলো খুঁজুন', command: 'find ~ -type d', check: function (c) { return c.ok && first(c.command) === 'find' && has(c.command, /-type\s+d/) && c.stdout.indexOf('projects') !== -1; } },
                { label: '`grep -rn console ~/projects` দিয়ে সব ফাইলের ভেতরে `console` খুঁজুন', command: 'grep -rn console ~/projects', hint: '`-r` মানে ফোল্ডারের ভেতরের সব ফাইলে, `-n` মানে লাইন নম্বরসহ।', check: function (c) { return c.ok && first(c.command) === 'grep' && has(c.command, /-\w*r/) && c.stdout.indexOf('app.js') !== -1; } }
            ]
        },
        {
            title: 'pipe আর redirect',
            goal: '`|` এক command-এর আউটপুটকে পরের command-এর ইনপুট বানায়। এভাবে ছোট command জুড়ে বড় কাজ হয়।',
            stages: [
                { label: '`grep 404 ... | wc -l` দিয়ে access.log-এ কয়টা 404 হয়েছে গুনুন', command: 'grep 404 ' + ACCESS_LOG + ' | wc -l', check: function (c) { return has(c.command, /grep/) && has(c.command, /\|\s*wc/) && isNumber(c.stdout) && c.stdout !== '0\n'; } },
                { label: '`cut -d\' \' -f1 ... | sort | uniq -c` দিয়ে কোন IP কতবার এসেছে গুনুন', command: "cut -d' ' -f1 " + ACCESS_LOG + ' | sort | uniq -c', hint: '`cut` প্রতি লাইনের প্রথম অংশ (IP) কাটে, `sort` একই IP পাশাপাশি আনে, `uniq -c` গোনে।', check: function (c) { return c.ok && has(c.command, /\|\s*sort\s*\|\s*uniq\s+-c/) && c.stdout.indexOf('198.51.100') !== -1; } },
                { label: 'আগের command-এর শেষে `> ~/ips.txt` বসিয়ে ফল ফাইলে রাখুন', command: "cut -d' ' -f1 " + ACCESS_LOG + ' | sort | uniq -c > ~/ips.txt', check: function (c) { return c.ok && has(c.command, /\|/) && has(c.command, />/) && created(c, HOME + '/ips.txt') && changes(c).added.length > 0 && !!text(c.next, HOME + '/ips.txt'); } },
                { label: '`echo "---" >> ~/ips.txt` দিয়ে ফাইলের শেষে যোগ করুন', command: 'echo "---" >> ~/ips.txt', hint: '`>>` আগের লেখা রেখে শেষে যোগ করে, `>` মুছে নতুন লেখে।', check: function (c) { var before = text(c.prev, HOME + '/ips.txt'); var after = text(c.next, HOME + '/ips.txt'); return has(c.command, />>/) && before !== undefined && after !== undefined && after.length > before.length && after.indexOf(before) === 0; } }
            ]
        },
        {
            title: 'script চালানো',
            goal: 'script ফাইল নিজে নিজে চলে না, চালানোর অধিকার (`x`) দিতে হয়। অধিকার না থাকলে কী হয় দেখুন, তারপর ঠিক করুন।',
            stages: [
                { label: '`./backup.sh` চালান (scripts ফোল্ডারে গিয়ে) আর `Permission denied` দেখুন', command: 'cd ~/scripts && ./backup.sh', check: function (c) { return c.errno === 'EACCES' && has(c.command, /backup\.sh/); } },
                { label: '`ls -l` দিয়ে দেখুন `backup.sh`-এ `x` নেই', command: 'ls -l', check: function (c) { return c.ok && first(c.command) === 'ls' && has(c.command, /-\w*l/) && c.stdout.indexOf('backup.sh') !== -1; } },
                { label: '`chmod +x backup.sh` দিয়ে চালানোর অধিকার দিন', command: 'chmod +x backup.sh', check: function (c) { var a = node(c.prev, HOME + '/scripts/backup.sh'); var b = node(c.next, HOME + '/scripts/backup.sh'); return !!a && !!b && (a.meta.mode & 0o111) === 0 && (b.meta.mode & 0o111) !== 0; } },
                { label: 'আবার `./backup.sh` চালান, এবার চলবে', command: './backup.sh', check: function (c) { return c.ok && c.stdout.indexOf('backup শেষ') !== -1; } }
            ]
        },
        {
            title: 'user আর sudo',
            goal: '`sudo` একটা command root হিসেবে চালায়। root-কে কেউ আটকায় না, তাই এটা দরকারি কিন্তু বিপজ্জনক।',
            stages: [
                { label: '`whoami` দিয়ে দেখুন আপনি কে', command: 'whoami', check: function (c) { return c.ok && first(c.command) === 'whoami' && c.stdout === 'dev\n'; } },
                { label: '`sudo whoami` দিয়ে দেখুন root হিসেবে কে চলে', command: 'sudo whoami', check: function (c) { return c.ok && has(c.command, /sudo\s+whoami/) && c.stdout === 'root\n'; } },
                { label: '`ls /root` দিয়ে দেখুন ঢুকতে দেয় কিনা', command: 'ls /root', check: function (c) { return c.errno === 'EACCES' && has(c.command, /\/root/); } },
                { label: '`sudo ls /root` দিয়ে root হিসেবে ঢুকুন', command: 'sudo ls /root', check: function (c) { return c.ok && has(c.command, /sudo\s+ls/) && has(c.command, /\/root/); } },
                { label: '`sudo chown root ~/notes.txt` দিয়ে নোটের মালিক root করুন', command: 'sudo chown root ~/notes.txt', hint: 'এরপর `echo x >> ~/notes.txt` চেষ্টা করুন: মালিক বদলে গেছে, তাই আপনি আর লিখতে পারবেন না।', check: function (c) { var a = node(c.prev, HOME + '/notes.txt'); var b = node(c.next, HOME + '/notes.txt'); return !!a && !!b && a.meta.owner === 'dev' && b.meta.owner === 'root'; } }
            ]
        },
        {
            title: 'আটকে যাওয়া process',
            goal: 'কোনো program আটকে গেলে বা শেষ হচ্ছে না মনে হলে তাকে খুঁজে বের করে থামাতে হয়। server-এ এটা রোজকার কাজ।',
            stages: [
                { label: '`ps aux` দিয়ে সব process দেখুন', command: 'ps aux', check: function (c) { return c.ok && first(c.command) === 'ps' && c.stdout.indexOf('node server.js') !== -1; } },
                { label: '`ps aux | grep node` দিয়ে কোনটা বেশি CPU খাচ্ছে খুঁজুন', command: 'ps aux | grep node', check: function (c) { return c.ok && has(c.command, /ps\s+\w*\s*\|\s*grep/) && c.stdout.indexOf('97.3') !== -1; } },
                { label: '`kill 2301` দিয়ে ভদ্রভাবে বন্ধ করতে বলুন (দেখুন কী হয়)', command: 'kill 2301', check: function (c) { return has(c.command, /^\s*kill\s+2301\s*$/) && pids(c.next).indexOf(2301) !== -1; } },
                { label: '`kill -9 2301` দিয়ে জোর করে থামান', command: 'kill -9 2301', hint: '`-9` (SIGKILL) program-কে গোছানোর সুযোগ দেয় না, তাই শেষ উপায় হিসেবে।', check: function (c) { return pids(c.prev).indexOf(2301) !== -1 && pids(c.next).indexOf(2301) === -1; } },
                { label: '`tail -f` চালিয়ে Ctrl+C চেপে বের হন', command: 'tail -f ' + ERROR_LOG, hint: '`tail -f` শেষ হয় না, নতুন লাইনের অপেক্ষায় থাকে। বের হতে নিচের বোতাম বা Ctrl+C।', check: function (c) { return !!c.stopped && has(c.command, /tail\s+-f/); } }
            ]
        },
        {
            title: 'log থেকে সমস্যা খোঁজা',
            goal: 'server-এ কিছু ভাঙলে প্রথমে log দেখা হয়। এখন আগের সবকিছু জুড়ে সত্যিকারের সমস্যা খুঁজুন।',
            stages: [
                { label: '`grep ERROR` দিয়ে error.log-এর সব ERROR লাইন দেখুন', command: 'grep ERROR ' + ERROR_LOG, check: function (c) { var out = lines(c.stdout); return c.ok && first(c.command) === 'grep' && has(c.command, /error\.log/) && out.length > 0 && out.every(function (l) { return l.indexOf('ERROR') !== -1; }); } },
                { label: '`grep -c ERROR` দিয়ে কয়টা ERROR আছে গুনুন', command: 'grep -c ERROR ' + ERROR_LOG, check: function (c) { return c.ok && has(c.command, /-\w*c/) && has(c.command, /error\.log/) && isNumber(c.stdout); } },
                { label: 'শুধু শেষ ২০ লাইনে ERROR আছে কিনা দেখুন: `tail -n 20 ... | grep ERROR`', command: 'tail -n 20 ' + ERROR_LOG + ' | grep ERROR', check: function (c) { return c.ok && has(c.command, /tail/) && has(c.command, /\|\s*grep/) && c.stdout.indexOf('ERROR') !== -1; } },
                { label: '`grep " 500 " ... | wc -l` দিয়ে access.log-এ কয়টা 500 error গুনুন', command: 'grep " 500 " ' + ACCESS_LOG + ' | wc -l', check: function (c) { return has(c.command, /access\.log/) && has(c.command, /500/) && has(c.command, /wc/) && isNumber(c.stdout) && c.stdout !== '0\n'; } },
                { label: 'কোন IP-র জন্য 500 হয়েছে খুঁজুন: `grep` → `cut` → `sort` → `uniq -c` জুড়ে', command: 'grep " 500 " ' + ACCESS_LOG + " | cut -d' ' -f1 | sort | uniq -c | sort -rn", hint: 'শেষের `sort -rn` সবচেয়ে বেশি সংখ্যাকে উপরে আনে।', check: function (c) { return c.ok && has(c.command, /500/) && has(c.command, /cut/) && has(c.command, /uniq\s+-c/) && lines(c.stdout).length > 0; } }
            ]
        },
        {
            title: 'নিজের মতো shell',
            goal: 'shell-কে নিজের মতো সাজানো: variable রাখা আর বড় command-এর ছোট নাম (alias) বানানো।',
            stages: [
                { label: '`echo $PATH` দিয়ে দেখুন shell command কোথায় খোঁজে', command: 'echo $PATH', check: function (c) { return c.ok && has(c.command, /echo\s+\$PATH/) && c.stdout.indexOf('/usr/bin') !== -1; } },
                { label: '`export GREETING=hello` দিয়ে নিজের variable বানান', command: 'export GREETING=hello', check: function (c) { return first(c.command) === 'export' && userVars(c.next.env).length > userVars(c.prev.env).length; } },
                { label: '`echo $GREETING` দিয়ে সেই variable-এর মান দেখুন', command: 'echo $GREETING', check: function (c) { var names = userVars(c.next.env); return c.ok && first(c.command) === 'echo' && names.some(function (n) { return has(c.command, new RegExp('\\$\\{?' + n + '\\b')) && c.stdout.indexOf(c.next.env[n]) !== -1; }); } },
                { label: "`alias ll='ls -la'` দিয়ে ছোট নাম বানান", command: "alias ll='ls -la'", check: function (c) { return first(c.command) === 'alias' && Object.keys(c.next.aliases).length > Object.keys(c.prev.aliases).length; } },
                { label: '`ll` লিখে নিজের বানানো নামে command চালান', command: 'll', check: function (c) { return c.ok && Object.prototype.hasOwnProperty.call(c.next.aliases, first(c.command)) && c.stdout !== ''; } }
            ]
        }
    ];

    function totalSteps() {
        return MISSIONS.reduce(function (sum, m) { return sum + m.stages.length; }, 0);
    }

    // step নম্বর থেকে এখনকার mission আর তার ভেতরের ধাপ
    function missionAt(step) {
        var left = step;
        for (var i = 0; i < MISSIONS.length; i++) {
            if (left < MISSIONS[i].stages.length) return { index: i, stage: left };
            left -= MISSIONS[i].stages.length;
        }
        return { index: MISSIONS.length, stage: 0 };
    }

    function currentStage(step) {
        var at = missionAt(step);
        var mission = MISSIONS[at.index];
        return mission ? mission.stages[at.stage] : null;
    }

    // একটা command চলার পরে অগ্রগতি এক ধাপ এগোয় কিনা
    function nextStep(step, ctx) {
        var stage = currentStage(step);
        if (stage && stage.check(ctx)) return step + 1;
        return step;
    }

    // UI-র জন্য: এখনকার mission, তার ধাপ (শেষ/চলতি/বাকি), আর সব mission-এর তালিকা
    function view(step) {
        var at = missionAt(step);
        var done = Math.min(step, totalSteps());
        var finished = at.index >= MISSIONS.length;
        var mission = MISSIONS[at.index];
        return {
            finished: finished,
            index: at.index,
            number: finished ? MISSIONS.length : at.index + 1,
            count: MISSIONS.length,
            title: mission ? mission.title : '',
            goal: mission ? mission.goal : '',
            stages: mission ? mission.stages.map(function (stage, i) {
                return { label: stage.label, hint: stage.hint || '', command: stage.command || '', done: i < at.stage, current: i === at.stage };
            }) : [],
            doneSteps: done,
            totalSteps: totalSteps(),
            all: MISSIONS.map(function (m, i) { return { title: m.title, done: i < at.index, current: i === at.index }; })
        };
    }

    var api = { MISSIONS: MISSIONS, totalSteps: totalSteps, missionAt: missionAt, currentStage: currentStage, nextStep: nextStep, view: view };
    if (isNode) module.exports = api;
    else root.LinuxMissions = api;
})(typeof self !== 'undefined' ? self : this);
