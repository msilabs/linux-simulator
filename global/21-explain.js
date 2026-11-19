// প্রতিটা command-এর পরের বাংলা ব্যাখ্যা। `ব্যাকটিক`-এর ভেতরের অংশ UI-তে code-এর মতো দেখায়।
// info = { name, args, result, before, after }
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var H = isNode ? require('./08-helpers.js') : root.LinuxHelpers;

    var BY_ERRNO = {
        ENOENT: 'এই নামে কোনো ফাইল বা ফোল্ডার নেই। নামে ভুল আছে কিনা `ls` দিয়ে দেখে নিন। মনে রাখবেন, বড় আর ছোট হাতের অক্ষর আলাদা ধরা হয়।',
        EACCES: 'অনুমতি নেই (Permission denied)। এই কাজ করার ক্ষমতা আপনার user-এর নেই। `ls -l` দিয়ে ফাইল বা ফোল্ডারের অনুমতি দেখা যায়।',
        ENOTDIR: 'এটা ফোল্ডার নয়, ফাইল। ফোল্ডারের ভেতরে ঢোকা বা ফোল্ডারের মতো ব্যবহার করা যায় শুধু ফোল্ডারকেই।',
        EEXIST: 'এই নামে আগেই কিছু আছে। অন্য নাম দিন, অথবা আগেরটা সরিয়ে নিন।',
        ENOTEMPTY: 'ফোল্ডারটা খালি নয়। আগে ভেতরের জিনিস সরান, অথবা পুরোটা মুছতে `rm -r` ব্যবহার করুন।',
        EOPT: 'এই command-এ এই option নেই, অথবা লেখায় ভুল আছে। কী কী option আছে তা `help` বা command-এর বিবরণে দেখুন।',
        EOPERAND: 'command-টা কিছু একটা চায় (যেমন ফাইলের নাম), কিন্তু সেটা দেওয়া হয়নি।',
        EARGS: 'বেশি argument দেওয়া হয়েছে। এই command-এ একটাই ঠিকানা চলে।',
        ENOCMD: 'এই নামে কোনো command নেই। নামটা ঠিক করে লিখুন, অথবা `help` দিয়ে তালিকা দেখুন।',
        ESYNTAX: 'লেখার গঠনে ভুল আছে। quote (" বা \') খোলা হলে বন্ধও করতে হয়।',
        EOLDPWD: '`cd -` আগের ফোল্ডারে ফেরায়, কিন্তু আগে এখনো কোনো ফোল্ডারে যাওয়া হয়নি।',
        ESAME: 'একই ফাইলকে নিজের ওপরেই কপি বা সরানো যায় না।',
        ESELF: 'ফোল্ডারকে তার নিজের ভেতরে কপি বা সরানো যায় না। এতে শেষ হতো না।',
        EDOT: '`.` আর `..` মোছা যায় না, এরা বর্তমান আর উপরের ফোল্ডারের নাম।',
        EMODE: 'mode লেখা ঠিক নয়। সংখ্যা (যেমন `755`) অথবা `u+x`-এর মতো লিখুন: কার (u মালিক, g দল, o বাকি সবাই, a সবাই), তারপর `+` (যোগ), `-` (বাদ) বা `=` (ঠিক করা), তারপর `r`, `w`, `x`।',
        EUSER: 'এই নামে user বা group নেই। এখানে আছে user `dev`, `root`, `www-data` আর group `dev`, `root`, `adm`, `sudo`, `www-data`।',
        EPERM: 'এই কাজের অনুমতি নেই। অনুমতি বদলাতে পারে শুধু ফাইলের মালিক বা root, আর মালিক বদলাতে পারে শুধু root। দরকার হলে `sudo` দিয়ে চালান।',
        ESRCH: 'এই নম্বরের কোনো process চলছে না। `ps aux` দিয়ে সঠিক PID দেখুন।',
        EPID: 'PID হলো process-এর নম্বর, তাই সংখ্যা দিতে হয়। `ps aux` দিয়ে নম্বর দেখুন।',
        ESIGNAL: 'signal-এর নাম ঠিক নয়। সাধারণত লাগে `-15` (সময় দিয়ে বন্ধ করতে বলা) আর `-9` (জোর করে বন্ধ করা)।',
        ELOOP: 'link গুলো নিজেদের মধ্যেই ঘুরছে, কোনো আসল ফাইলে পৌঁছায় না। `ls -l` দিয়ে link-গুলো দেখে ঠিক করুন।',
        EFALSE: '`false` সবসময় ব্যর্থ হয়, শুধু `||` বা `$?`-এর পরীক্ষার জন্য।',
        ENOMATCH: 'কোনো লাইন মেলেনি, তাই আউটপুট খালি। এটা ভুল নয়, `grep` এভাবেই জানায় যে কিছু পায়নি। pattern-এর বানান আর বড়-ছোট হাতের অক্ষর দেখে নিন, দরকারে `-i` দিন।',
        EREGEX: 'pattern-টা সঠিক regular expression নয়। `[` খুলে বন্ধ না করলে এই ভুল হয়।',
        EREDIRECT: 'redirect-এর গন্তব্য একটাই হতে হয়, কিন্তু এখানে একাধিক ফাইল মিলেছে।',
        EIDENT: 'variable-এর নাম শুরু হবে অক্ষর বা `_` দিয়ে, অঙ্ক দিয়ে নয়।',
        EALIAS: 'এই নামে কোনো alias নেই, অথবা alias-এর নামটা ঠিক নয়।',
        EDEPTH: 'script নিজেকেই বারবার চালাচ্ছে, তাই থামানো হয়েছে।',
        ENOMAN: 'এই command-এর কোনো বাংলা manual নেই। `help` দিয়ে command-এর তালিকা দেখুন।',
        EPROTECT: 'সুরক্ষার জন্য এই simulator কাজটা করতে দেয়নি। আসল Linux-এ এভাবে চালালে পুরো system-এর ফাইল মুছে বা নষ্ট হয়ে যেত, আর ফেরত আনার উপায় থাকত না। root হয়ে এমন ভুল করলে কেউ আটকায় না।'
    };

    var BY_COMMAND_ERRNO = {
        'rm:EISDIR': 'এটা একটা ফোল্ডার। ফোল্ডার মুছতে `-r` লাগে: `rm -r নাম`। সাবধান, মোছা জিনিস আর ফেরত আসে না।',
        'cp:ERECURSIVE': 'ফোল্ডার কপি করতে `-r` লাগে: `cp -r ফোল্ডার নতুন-নাম`। `-r` মানে recursive, ফোল্ডারের ভেতরের সবকিছুসহ।',
        'cat:EISDIR': '`cat` ফাইল পড়ে, ফোল্ডার নয়। ফোল্ডারের ভেতরে কী আছে দেখতে `ls` ব্যবহার করুন।'
    };

    function code(text) {
        return '`' + text + '`';
    }

    function operandsOf(args) {
        return args.filter(function (a) { return a.charAt(0) !== '-' || a === '-'; });
    }

    function flagsOf(args) {
        var flags = '';
        args.forEach(function (a) {
            if (a.charAt(0) === '-' && a.charAt(1) !== '-' && a.length > 1) flags += a.slice(1);
        });
        return flags;
    }

    var DIGIT_TEXT = { 7: 'rwx (পড়া, লেখা, চালানো)', 6: 'rw- (পড়া, লেখা)', 5: 'r-x (পড়া, চালানো)', 4: 'r-- (শুধু পড়া)', 3: '-wx', 2: '-w- (শুধু লেখা)', 1: '--x (শুধু চালানো)', 0: '--- (কিছুই না)' };

    function permWords(letters) {
        var parts = [];
        if (letters.indexOf('r') !== -1) parts.push('পড়ার (r)');
        if (letters.indexOf('w') !== -1) parts.push('লেখার (w)');
        if (letters.indexOf('x') !== -1 || letters.indexOf('X') !== -1) parts.push('চালানোর (x)');
        return parts.join(', ');
    }

    function whoWords(who) {
        if (!who || who.indexOf('a') !== -1) return 'সবাইকে';
        var names = [];
        if (who.indexOf('u') !== -1) names.push('মালিককে');
        if (who.indexOf('g') !== -1) names.push('দলকে');
        if (who.indexOf('o') !== -1) names.push('বাকি সবাইকে');
        return names.join(' আর ');
    }

    // এই mode কি চালানোর (x) অনুমতি যোগ করে?
    function addsExecute(mode) {
        if (/^[0-7]{1,4}$/.test(mode)) return /[1357]/.test(mode.slice(-3));
        return mode.split(',').some(function (clause) {
            var m = /^([ugoa]*)([-+=])([rwxX]*)$/.exec(clause);
            return !!m && m[2] !== '-' && /[xX]/.test(m[3]);
        });
    }

    function chmodText(mode) {
        var parts;
        var risky = false;
        if (/^[0-7]{1,4}$/.test(mode)) {
            var digits = mode.slice(-3);
            while (digits.length < 3) digits = '0' + digits;
            parts = code(mode) + '-এর তিনটা অঙ্ক যথাক্রমে মালিক, দল আর বাকি সবার অনুমতি: ' +
                [0, 1, 2].map(function (k) { return H.bn(digits.charAt(k)) + ' = ' + DIGIT_TEXT[digits.charAt(k)]; }).join(', ') + '।';
            risky = (parseInt(digits.charAt(2), 10) & 2) !== 0;
        } else {
            parts = mode.split(',').map(function (clause) {
                var m = /^([ugoa]*)([-+=])([rwxX]*)$/.exec(clause);
                if (!m) return '';
                var action = m[2] === '+' ? 'যোগ করা হয়েছে' : m[2] === '-' ? 'বাদ দেওয়া হয়েছে' : 'ঠিক করে দেওয়া হয়েছে';
                if ((!m[1] || /[oa]/.test(m[1])) && m[2] !== '-' && m[3].indexOf('w') !== -1) risky = true;
                return code(clause) + ' মানে ' + whoWords(m[1]) + ' ' + permWords(m[3]) + ' অনুমতি ' + action + '।';
            }).join(' ');
        }
        var warn = risky ? ' সাবধান: বাকি সবাইকে লেখার অনুমতি দেওয়া নিরাপদ নয়, যে কেউ ফাইল বদলে ফেলতে পারে। সাধারণত ' + code('755') + ' (ফোল্ডার, script) বা ' + code('644') + ' (সাধারণ ফাইল) যথেষ্ট।' : '';
        return parts + warn;
    }

    var BY_NAME = {
        pwd: function (i) {
            return code('pwd') + ' (print working directory) এখন যে ফোল্ডারে আছেন তার পুরো ঠিকানা দেখায়। আপনি এখন ' + code(i.after.cwd) + '-এ।';
        },
        cd: function (i) {
            var arg = i.args[0];
            var base = 'এখন আপনি ' + code(i.after.cwd) + '-এ আছেন।';
            if (arg === undefined || arg === '~') return code('cd') + ' দিয়ে ফোল্ডার বদলানো যায়। কিছু না লিখলে (বা ' + code('~') + ' লিখলে) নিজের home ফোল্ডারে ফেরা যায়। ' + base;
            if (arg === '..') return code('cd ..') + ' এক ধাপ উপরের ফোল্ডারে নিয়ে যায়। ' + base;
            if (arg === '-') return code('cd -') + ' আগে যে ফোল্ডারে ছিলেন সেখানে ফেরায়। ' + base;
            if (arg === '/') return code('/') + ' হলো সবকিছুর শুরু, root ফোল্ডার। ' + base;
            return code('cd ' + arg) + ' দিয়ে ফোল্ডারে ঢুকলেন। ' + base + ' prompt-এও এই জায়গাটা দেখা যাচ্ছে।';
        },
        ls: function (i) {
            var flags = flagsOf(i.args);
            var parts = [code('ls') + ' ফোল্ডারের ভেতরের ফাইল আর ফোল্ডারের নাম দেখায়।'];
            if (flags.indexOf('l') !== -1) {
                parts.push('`-l` দিলে প্রতি লাইনে একটা করে। প্রথম অক্ষর ' + code('d') + ' মানে ফোল্ডার, ' + code('-') + ' মানে ফাইল। তারপর ' + code('rwx') + ' তিন দলে: মালিক, দল আর বাকি সবার অনুমতি (r = পড়া, w = লেখা, x = চালানো)। এরপর মালিক, দল, আকার (byte), সময় আর নাম।');
            }
            if (flags.indexOf('a') !== -1) parts.push('`-a` দিলে ' + code('.') + ' দিয়ে শুরু হওয়া লুকানো ফাইলও দেখা যায়।');
            if (flags.indexOf('h') !== -1) parts.push('`-h` আকারকে K, M-এর মতো পড়ার সুবিধার রূপে দেখায়।');
            if (flags.indexOf('R') !== -1) parts.push('`-R` ভেতরের সব ফোল্ডারও একে একে দেখায়।');
            return parts.join(' ');
        },
        tree: function () {
            return code('tree') + ' ফোল্ডারের ভেতরের সবকিছু গাছের মতো সাজিয়ে দেখায়, তাই কোনটা কোনটার ভেতরে আছে একনজরে বোঝা যায়। লুকানো ফাইল দেখতে ' + code('tree -a') + ', আর কত স্তর পর্যন্ত দেখাবে তা ঠিক করতে ' + code('tree -L 2') + '।';
        },
        mkdir: function (i) {
            var made = operandsOf(i.args).join(', ');
            var more = flagsOf(i.args).indexOf('p') !== -1 ? ' `-p` থাকায় মাঝের ফোল্ডারগুলোও দরকারমতো বানানো হয়েছে, আর আগে থেকে থাকলে ভুল হয়নি।' : ' একবারে ফোল্ডারের ভেতরে ফোল্ডার বানাতে `mkdir -p a/b/c` লিখুন।';
            return code('mkdir') + ' নতুন ফোল্ডার বানায়। এখন ' + code(made) + ' আছে।' + more;
        },
        rmdir: function (i) {
            return code('rmdir') + ' শুধু খালি ফোল্ডার মোছে, তাই ভুলে দরকারি কিছু মুছে যাওয়ার ভয় নেই। ' + code(operandsOf(i.args).join(', ')) + ' মোছা হয়েছে।';
        },
        touch: function (i) {
            return code('touch') + ' খালি ফাইল বানায়। ফাইল আগে থেকে থাকলে শুধু তার বদলানোর সময় নতুন করে দেয়, লেখা বদলায় না। এখন ' + code(operandsOf(i.args).join(', ')) + ' আছে।';
        },
        cat: function (i) {
            var numbered = flagsOf(i.args).indexOf('n') !== -1 ? ' `-n` প্রতিটা লাইনের আগে নম্বর বসিয়েছে।' : '';
            return code('cat') + ' ফাইলের পুরো লেখা পর্দায় দেখায়। ফাইল বড় হলে ' + code('head') + ' বা ' + code('tail') + ' কাজে লাগবে।' + numbered;
        },
        echo: function (i) {
            if (i.redirected) return code('echo') + ' যা লেখা হয় তাই ছাপে।';
            return code('echo') + ' যা লেখা হয় তাই পর্দায় ছাপে। এটা একা তেমন কাজের নয়, কিন্তু ' + code('>') + ' দিয়ে ফাইলে লেখার সময় লাগে।';
        },
        cp: function (i) {
            var ops = operandsOf(i.args);
            return code('cp ' + ops.join(' ')) + ' কপি বানিয়েছে। আসল ফাইল যেমন ছিল তেমনই আছে। ফোল্ডার কপি করতে ' + code('cp -r') + ' লাগে।';
        },
        mv: function (i) {
            var ops = operandsOf(i.args);
            return code('mv') + ' ফাইল বা ফোল্ডার সরায়। গন্তব্য যদি আগে থেকে থাকা ফোল্ডার হয় তাহলে তার ভেতরে যায়, নাহলে নতুন নাম হিসেবে ধরা হয়। তাই নাম বদলাতেও এটাই ব্যবহার হয়: ' + code('mv ' + ops.join(' ')) + '।';
        },
        rm: function (i) {
            var recursive = /[rR]/.test(flagsOf(i.args));
            return code('rm') + ' ফাইল মোছে। Recycle Bin নেই, তাই মোছা জিনিস আর ফেরত আসে না। ' + (recursive ? '`-r` ফোল্ডারের ভেতরের সবকিছুসহ মুছেছে। এই simulator-এ Undo আছে, আসল Linux-এ নেই।' : 'ফোল্ডার মুছতে `-r` লাগে।');
        },
        head: function (i) { return code('head') + ' ফাইলের প্রথম কয়েক লাইন দেখায়, কিছু না বললে ১০টা। সংখ্যা ঠিক করতে ' + code('head -n 3') + '।'; },
        tail: function (i) {
            if (flagsOf(i.args).indexOf('f') !== -1) return code('tail -f') + ' ফাইলের শেষ কয়েক লাইন দেখিয়ে অপেক্ষা করে, নতুন লাইন এলেই দেখায়। log ফাইল চোখে চোখে রাখতে এটা কাজে লাগে। command শেষ হয় না, তাই থামাতে ' + code('Ctrl+C') + ' চাপুন।';
            return code('tail') + ' ফাইলের শেষ কয়েক লাইন দেখায়, কিছু না বললে ১০টা। log ফাইলের নতুন খবর শেষেই থাকে, তাই এটা log দেখার সময় কাজে লাগে। চলতে থাকা log দেখতে ' + code('tail -f') + '।';
        },
        wc: function (i) { return code('wc') + ' (word count) গোনে। ' + code('-l') + ' লাইন, ' + code('-w') + ' শব্দ, ' + code('-c') + ' byte। কোনো আউটপুট গুনতে pipe-এর শেষে ' + code('| wc -l') + ' বসানো হয়।'; },
        grep: function (i) { return code('grep') + ' লেখার ভেতর থেকে pattern-এর সাথে মেলা লাইন খুঁজে দেখায়। ' + code('-i') + ' বড় হাতের আর ছোট হাতের অক্ষর আলাদা ধরে না, ' + code('-n') + ' লাইন নম্বর দেখায়, ' + code('-v') + ' যেগুলো মেলে না সেগুলো দেখায়, ' + code('-r') + ' ফোল্ডারের ভেতরের সব ফাইলে খোঁজে।'; },
        find: function () { return code('find') + ' ফোল্ডারের ভেতরের সব স্তরে খুঁজে নাম বা ধরন মিলিয়ে যা পায় তা দেখায়। ' + code('-name "*.js"') + ' নামের ধরন দেখে, ' + code('-type d') + ' শুধু ফোল্ডার খোঁজে। ' + code('*') + ' shell-কে আগে খেয়ে নিতে না দিতে quote-এ রাখুন।'; },
        sort: function () { return code('sort') + ' লাইনগুলো সাজায়। সংখ্যা ধরে সাজাতে ' + code('-n') + ', উল্টো ক্রমে ' + code('-r') + '।'; },
        uniq: function () { return code('uniq') + ' শুধু পাশাপাশি থাকা একই লাইন এক করে, তাই আগে ' + code('sort') + ' করে নিতে হয়। ' + code('-c') + ' দিলে প্রতিটা কতবার এসেছে তা গোনে।'; },
        cut: function () { return code('cut') + ' প্রতি লাইন থেকে নির্দিষ্ট অংশ কেটে নেয়। ' + code('-d:') + ' বলে কোন চিহ্ন দিয়ে ভাগ, ' + code('-f1') + ' বলে কোন ভাগ চাই।'; },
        less: function () { return code('less') + ' বড় ফাইল পাতা ধরে পড়ার command। এই simulator-এ এটা ' + code('cat') + '-এর মতো পুরো লেখা একবারে দেখায়।'; },
        env: function () { return code('env') + ' পরিবেশের সব variable দেখায়। প্রোগ্রামগুলো এখান থেকেই জানে আপনার home কোথায়, কোন command কোন ফোল্ডারে থাকে (' + code('PATH') + ') ইত্যাদি।'; },
        export: function (i) { return code('export') + ' variable বানায় বা বদলায়, যেমন ' + code('export NAME=মান') + '। পরে ' + code('echo $NAME') + ' দিয়ে মান দেখা যায়। এই simulator বন্ধ হলে (বা শুরু থেকে নিলে) এটা থাকে না।'; },
        unset: function () { return code('unset') + ' variable মুছে ফেলে।'; },
        alias: function (i) { return code('alias') + ' বড় command-এর ছোট নাম বানায়, যেমন ' + code("alias ll='ls -la'") + '। এরপর ' + code('ll') + ' লিখলেই ' + code('ls -la') + ' চলবে।'; },
        unalias: function () { return code('unalias') + ' alias মুছে ফেলে।'; },
        which: function () { return code('which') + ' বলে একটা command-এর ফাইল কোথায় আছে। ' + code('PATH') + '-এর ফোল্ডারগুলোতে সেটা খোঁজা হয়।'; },
        man: function () { return code('man') + ' (manual) কোনো command কীভাবে চলে তার বিবরণ দেখায়। কোন option কী করে তা ভুলে গেলে এখানে দেখুন।'; },
        '=': function (i) { return 'আপনি variable-এ মান বসিয়েছেন। ' + code('echo $' + i.args[0].split('=')[0]) + ' লিখলে মানটা দেখা যাবে।'; },
        chmod: function (i) {
            var ops = operandsOf(i.args);
            var mode = ops[0] || '';
            return code('chmod') + ' ফাইলের অনুমতি (পড়া, লেখা, চালানো) বদলায়। ' + chmodText(mode) + (addsExecute(mode) ? ' `ls -l` দিলে এখন নামের জায়গায় `x` দেখা যাবে, আর script হলে `./নাম` দিয়ে চালানো যাবে।' : '');
        },
        chown: function (i) {
            return code('chown') + ' ফাইলের মালিক বদলায়। ' + code(operandsOf(i.args)[0] || '') + ' মানে ' + code('মালিক:দল') + '। মালিক বদলাতে পারে শুধু root। ' + (i.underSudo ? 'এখানে sudo দিয়েছেন বলে কাজটা চলেছে। ' : 'তাই সাধারণত ' + code('sudo chown ...') + ' লাগে। ') + code('-R') + ' ভেতরের সবকিছুর মালিকও বদলায়।';
        },
        sudo: function (i) {
            var inner = i.args[0];
            var fn = BY_NAME[inner];
            var innerText = fn ? ' ' + fn({ name: inner, args: i.args.slice(1), before: i.before, after: i.after, redirected: false, underSudo: true }) : '';
            return code('sudo') + ' একটা command root হিসেবে চালায়। root সবকিছু পারে আর কেউ তাকে আটকায় না, তাই ভুল command-ও চলে যায়। না বুঝে sudo দেবেন না।' + innerText;
        },
        whoami: function (i) { if (i.underSudo) return code('whoami') + ' দেখায় কোন user হিসেবে command চলছে। sudo-র ভেতরে চলেছে বলে এখানে ' + code('root') + ' দেখাল।'; return code('whoami') + ' দেখায় এখন আপনি কোন user হিসেবে আছেন। ' + code('sudo whoami') + ' দিলে ' + code('root') + ' দেখাবে, কারণ sudo command-টা root হিসেবে চালায়।'; },
        id: function () { return code('id') + ' আপনার user আর group-এর পরিচয় দেখায়। ' + code('sudo') + ' group-এ থাকলে আপনি ' + code('sudo') + ' ব্যবহার করতে পারেন।'; },
        ps: function () {
            return code('ps') + ' চলতে থাকা process-এর তালিকা দেখায়। কিছু না দিলে শুধু এই terminal-এর process। ' + code('ps aux') + ' সবার সব process দেখায়। ' + code('PID') + ' হলো process-এর নম্বর, ' + code('kill') + ' এই নম্বর দিয়েই কাজ করে। কে বেশি CPU খাচ্ছে বুঝতে ' + code('%CPU') + ' কলাম দেখুন।';
        },
        kill: function (i) {
            var pids = operandsOf(i.args).join(', ');
            var forced = /^-(9|KILL|SIGKILL)$/.test(i.args[0] || '');
            if (i.survived && i.survived.length) {
                return code('kill ' + i.survived.join(' ')) + ' process-কে সময় দিয়ে বন্ধ হতে বলেছে (SIGTERM), কিন্তু এটা কথা শোনেনি। ' + code('ps aux') + ' দিয়ে দেখুন এখনো চলছে। জোর করে থামাতে ' + code('kill -9 ' + i.survived[0]) + ' (SIGKILL), তবে এতে program নিজে গুছিয়ে বন্ধ হওয়ার সুযোগ পায় না, তাই আগে ভদ্রভাবে চেষ্টা করাই নিয়ম।';
            }
            return code('kill') + ' process-কে signal পাঠায়: ' + code(pids) + (forced ? '-কে জোর করে থামানো হয়েছে (SIGKILL)।' : '-কে বন্ধ হতে বলা হয়েছে (SIGTERM)।') + ' ' + code('ps aux') + ' দিয়ে দেখুন আর আছে কিনা।';
        },
        du: function () { return code('du') + ' দেখায় ফোল্ডার কতটা জায়গা নিয়েছে। ' + code('-s') + ' শুধু মোট দেয়, ' + code('-h') + ' K, M-এর মতো সহজ রূপে দেখায়, তাই সাধারণত ' + code('du -sh') + ' লেখা হয়।'; },
        df: function () { return code('df') + ' দেখায় disk-এ কত জায়গা আছে আর কতটা ফুরিয়েছে। ' + code('-h') + ' সহজ রূপে দেখায়। ' + code('Use%') + ' ১০০-র কাছে গেলে server-এ সমস্যা শুরু হয়।'; },
        ln: function () { return code('ln -s') + ' শর্টকাট (symbolic link) বানায়: ' + code('ls -l') + '-এ ' + code('নাম -> আসল-ফাইল') + ' দেখা যাবে। আসল ফাইল সরালে বা মুছলে link ভেঙে যায়।'; },
        nano: function (i) { return code('nano') + ' সাধারণ লেখার editor। নিচে editor খুলেছে: লিখুন, তারপর ' + code('সেভ') + ' (বা Ctrl+S) চাপুন। না চাইলে বন্ধ করুন, ফাইল বদলাবে না।'; },
        date: function () { return code('date') + ' এখনকার তারিখ আর সময় দেখায়। এই simulator-এর ঘড়ি নকল, ফাইল বদলালে এগোয়। ' + code('date +%F') + ' দিলে শুধু ' + code('২০২৬-১১-১৮') + ' ধরনের তারিখ।'; },
        uname: function () { return code('uname') + ' system-এর নাম আর ভার্সন দেখায়। ' + code('uname -a') + ' সব তথ্য একসাথে দেয়।'; },
        hostname: function () { return code('hostname') + ' এই কম্পিউটারের নাম দেখায়। prompt-এ ' + code('@') + '-এর পরের নামটাই এটা।'; },
        sleep: function (i) { return code('sleep') + ' কিছুক্ষণ অপেক্ষা করে। বেশি সময়ের হলে ' + code('Ctrl+C') + ' দিয়ে থামানো যায়।'; },
        clear: function () { return ''; },
        history: function () {
            return code('history') + ' আগে চালানো command-গুলোর তালিকা। ' + code('↑') + ' চেপেও আগের command ফিরিয়ে আনা যায়।';
        },
        true: function () { return code('true') + ' কিছুই করে না, শুধু সফল (exit code 0) হয়।'; },
        help: function () { return ''; }
    };

    function explain(info) {
        var result = info.result;
        if (result.code !== 0 || result.errno) {
            var specific = BY_COMMAND_ERRNO[info.name + ':' + result.errno];
            if (specific) return specific;
            if (result.explain) return result.explain;
            if (result.errno && BY_ERRNO[result.errno]) return BY_ERRNO[result.errno];
            return '';
        }
        var fn = BY_NAME[info.name];
        return fn ? fn(info) : '';
    }

    /* ---------- পুরো লাইনের ব্যাখ্যা: pipe, redirect আর && || ; ---------- */

    var ORDER = { first: 'প্রথমে ', middle: 'তারপর ', last: 'শেষে ' };

    function stageLabel(stage) {
        return code([stage.name].concat(stage.args).join(' '));
    }

    function flagsText(stage) {
        return flagsOf(stage.args);
    }

    // pipe-এর একটা ধাপ কী করল তার এক বাক্য
    function stageSentence(stage, position) {
        var label = stageLabel(stage);
        var n = H.bn(stage.stdoutLines);
        var inl = stage.stdinLines === null ? null : H.bn(stage.stdinLines);
        var flags = flagsText(stage);
        var verb;
        switch (stage.name) {
            case 'cat':
            case 'less':
                verb = inl !== null && !operandsOf(stage.args).length ? 'ইনপুট যেমন পেল তেমনই পাঠাল' : 'ফাইল পড়ে ' + n + ' লাইন দিল';
                break;
            case 'ls': verb = n + 'টা নাম দিল'; break;
            case 'echo': verb = 'লেখাটা দিল'; break;
            case 'find': verb = n + 'টা খুঁজে পেল'; break;
            case 'tree': verb = 'গাছের মতো সাজিয়ে দিল'; break;
            case 'grep':
                if (flags.indexOf('c') !== -1) verb = 'মেলা লাইন গুনে জানাল' + (stage.preview ? ': ' + code(stage.preview) : '');
                else if (inl !== null && stage.args.length === operandsOf(stage.args).length - 0 && operandsOf(stage.args).length <= 1) verb = inl + ' লাইনের মধ্য থেকে ' + n + 'টা রাখল, যেগুলো ' + (flags.indexOf('v') !== -1 ? 'মেলে না' : 'মেলে');
                else verb = 'ফাইল থেকে ' + n + 'টা ' + (flags.indexOf('v') !== -1 ? 'না-মেলা' : 'মেলা') + ' লাইন দিল';
                break;
            case 'wc': verb = 'গুনে জানাল' + (stage.preview ? ': ' + code(stage.preview) : ''); break;
            case 'sort': verb = 'লাইনগুলো সাজাল' + (flags.indexOf('r') !== -1 ? ' (উল্টো ক্রমে)' : '') + (flags.indexOf('n') !== -1 ? ' (সংখ্যা ধরে)' : ''); break;
            case 'uniq': verb = flags.indexOf('c') !== -1 ? 'পাশাপাশি একই লাইন এক করে প্রতিটার আগে কতবার এসেছে তা বসাল' : 'পাশাপাশি একই লাইন এক করল' + (inl !== null ? ' (' + inl + ' → ' + n + ' লাইন)' : ''); break;
            case 'head': verb = 'শুরুর ' + n + ' লাইন রাখল'; break;
            case 'tail': verb = 'শেষের ' + n + ' লাইন রাখল'; break;
            case 'cut': verb = 'প্রতি লাইন থেকে চাওয়া অংশ কেটে নিল'; break;
            default: verb = 'চলল';
        }
        return ORDER[position] + label + ' ' + verb + '।';
    }

    function redirectSentences(stage) {
        var out = [];
        stage.redirects.forEach(function (r) {
            var path = r.path ? code(r.path) : '';
            var devNull = r.path === '/dev/null';
            if (r.op === '>') out.push(devNull ? code('/dev/null') + ' হলো ফেলে দেওয়ার জায়গা, আউটপুট সেখানে হারিয়ে যায়।' : '`>` আউটপুট পর্দায় না এনে ' + path + '-এ লিখেছে। ফাইল আগে থাকলে আগের লেখা মুছে নতুন লেখা বসেছে (সাবধান)।');
            else if (r.op === '>>') out.push('`>>` আউটপুট ' + path + '-এর শেষে যোগ করেছে, আগের লেখা থেকে গেছে।');
            else if (r.op === '<') out.push('`<` ' + path + ' থেকে ইনপুট নিয়েছে।');
            else if (r.op === '2>' || r.op === '2>>') out.push(devNull ? 'error বার্তা ফেলে দেওয়া হয়েছে।' : '`' + r.op + '` শুধু error বার্তা ' + path + '-এ পাঠিয়েছে।');
            else if (r.op === '2>&1') out.push('`2>&1` error বার্তাকে আউটপুটের সাথেই একই জায়গায় পাঠিয়েছে।');
        });
        return out;
    }

    var CONNECTOR = {
        '&&': '`&&` মানে আগেরটা সফল হলে তবেই পরেরটা চলে।',
        '||': '`||` মানে আগেরটা ব্যর্থ হলে তবেই পরেরটা চলে।',
        ';': '`;` দিয়ে command-গুলো একটার পর একটা চলে, আগেরটা সফল হোক বা ব্যর্থ।'
    };

    function errorOf(stage, info) {
        if (stage.script && stage.errno === 'EACCES') {
            return 'ফাইলটা চালানোর অনুমতি (`x`) নেই, তাই চলেনি। `ls -l` দিয়ে দেখুন অনুমতিের জায়গায় `x` নেই। `chmod +x` দিলে তবেই script চালানো যায়।';
        }
        return explain({ name: stage.name, args: stage.args, result: { code: stage.code, errno: stage.errno }, before: info.before, after: info.after });
    }

    function singleSentence(stage, info) {
        if (stage.code) return errorOf(stage, info);
        if (stage.script) return stageLabel(stage) + ' একটা script। এর ভেতরের command-গুলো একে একে চলেছে। script-এর ভেতরে `cd` করলেও আপনার জায়গা বদলায় না, কারণ script আলাদা process।';
        var fn = BY_NAME[stage.name];
        return fn ? fn({ name: stage.name, args: stage.args, before: info.before, after: info.after, redirected: stage.redirects.length > 0, survived: stage.survived }) : '';
    }

    function explainLine(info) {
        var items = info.items || [];
        var executed = items.filter(function (item) { return !item.skipped; });
        if (items.length === 1 && executed[0].stages.length === 1 && !executed[0].stages[0].redirects.length) {
            var only = executed[0].stages[0];
            if (!only.name) return '';
            return singleSentence(only, info);
        }

        var parts = [];
        var connectors = [];
        items.forEach(function (item, index) {
            if (item.skipped) {
                var before = items[index - 1];
                var why = before && before.sep === '&&' ? 'আগেরটা ব্যর্থ হয়েছে বলে' : 'আগেরটা সফল হয়েছে বলে';
                parts.push(code(item.text) + ' চলেনি, ' + why + '।');
            } else if (item.stages.length === 1) {
                var stage = item.stages[0];
                var sentences = [];
                if (stage.name) sentences.push(singleSentence(stage, info));
                else if (stage.code) sentences.push(errorOf(stage, info));
                redirectSentences(stage).forEach(function (s) { sentences.push(s); });
                if (sentences.length) parts.push(sentences.filter(Boolean).join(' '));
            } else {
                var sentencesP = ['pipe (`|`) এক command-এর আউটপুটকে সোজা পরের command-এর ইনপুট বানায়, মাঝে ফাইল লাগে না।'];
                var failed = null;
                item.stages.forEach(function (st, k) {
                    var position = k === 0 ? 'first' : k === item.stages.length - 1 ? 'last' : 'middle';
                    sentencesP.push(stageSentence(st, position));
                    redirectSentences(st).forEach(function (s) { sentencesP.push(s); });
                    if (st.code && !failed) failed = st;
                });
                if (failed) sentencesP.push(errorOf(failed, info));
                parts.push(sentencesP.join(' '));
            }
            if (item.sep && CONNECTOR[item.sep] && connectors.indexOf(item.sep) === -1 && index < items.length - 1) {
                connectors.push(item.sep);
                parts.push(CONNECTOR[item.sep]);
            }
        });
        return parts.filter(Boolean).join('\n');
    }

    var api = { explain: explain, explainLine: explainLine, bn: H.bn };
    if (isNode) module.exports = api;
    else root.LinuxExplain = api;
})(typeof self !== 'undefined' ? self : this);
