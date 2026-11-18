// প্রতিটা command-এর পরের বাংলা ব্যাখ্যা। `ব্যাকটিক`-এর ভেতরের অংশ UI-তে code-এর মতো দেখায়।
// info = { name, args, result, before, after }
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var H = isNode ? require('./08-helpers.js') : root.LinuxHelpers;

    var BY_ERRNO = {
        ENOENT: 'এই নামে কোনো ফাইল বা ফোল্ডার নেই। নামে ভুল আছে কিনা `ls` দিয়ে দেখে নিন। মনে রাখবেন, বড় আর ছোট হাতের অক্ষর আলাদা ধরা হয়।',
        EACCES: 'অনুমতি নেই (Permission denied)। কাজটা করার অধিকার আপনার নেই। `ls -l` দিয়ে ফাইল বা ফোল্ডারের অধিকার দেখা যায়।',
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
        EFALSE: '`false` সবসময় ব্যর্থ হয়, শুধু `||` বা `$?`-এর পরীক্ষার জন্য।',
        ENOMATCH: 'কোনো লাইন মেলেনি, তাই আউটপুট খালি। এটা ভুল নয়, `grep` এভাবেই জানায় যে কিছু পায়নি। pattern-এর বানান আর বড়-ছোট হাতের অক্ষর দেখে নিন, দরকারে `-i` দিন।',
        EREGEX: 'pattern-টা সঠিক regular expression নয়। `[` খুলে বন্ধ না করলে এই ভুল হয়।',
        EREDIRECT: 'redirect-এর গন্তব্য একটাই হতে হয়, কিন্তু এখানে একাধিক ফাইল মিলেছে।',
        EIDENT: 'variable-এর নাম শুরু হবে অক্ষর বা `_` দিয়ে, অঙ্ক দিয়ে নয়।',
        EALIAS: 'এই নামে কোনো alias নেই, অথবা alias-এর নামটা ঠিক নয়।',
        EDEPTH: 'script নিজেকেই বারবার চালাচ্ছে, তাই থামানো হয়েছে।',
        ENOMAN: 'এই command-এর কোনো বাংলা manual নেই। `help` দিয়ে command-এর তালিকা দেখুন।',
        EPROTECT: 'সুরক্ষার জন্য এই simulator কাজটা করতে দেয়নি। আসল Linux-এ এভাবে `rm -rf` চালালে পুরো ফোল্ডার, এমনকি পুরো system মুছে যেত, আর ফেরত আনার উপায় থাকত না।'
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
                parts.push('`-l` দিলে প্রতি লাইনে একটা করে। প্রথম অক্ষর ' + code('d') + ' মানে ফোল্ডার, ' + code('-') + ' মানে ফাইল। তারপর ' + code('rwx') + ' তিন দলে: মালিক, দল আর বাকি সবার অধিকার (r = পড়া, w = লেখা, x = চালানো)। এরপর মালিক, দল, আকার (byte), সময় আর নাম।');
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
        tail: function (i) { return code('tail') + ' ফাইলের শেষ কয়েক লাইন দেখায়, কিছু না বললে ১০টা। log ফাইলের নতুন খবর শেষেই থাকে, তাই এটা log দেখার সময় কাজে লাগে।'; },
        wc: function (i) { return code('wc') + ' (word count) গোনে। ' + code('-l') + ' লাইন, ' + code('-w') + ' শব্দ, ' + code('-c') + ' byte। কোনো ফল গুনতে pipe-এর শেষে ' + code('| wc -l') + ' বসানো হয়।'; },
        grep: function (i) { return code('grep') + ' লেখার ভেতর থেকে pattern-এর সাথে মেলা লাইন খুঁজে দেখায়। ' + code('-i') + ' বড়-ছোট হাতের ভেদ করে না, ' + code('-n') + ' লাইন নম্বর দেখায়, ' + code('-v') + ' যেগুলো মেলে না সেগুলো দেখায়, ' + code('-r') + ' ফোল্ডারের ভেতরের সব ফাইলে খোঁজে।'; },
        find: function () { return code('find') + ' ফোল্ডারের ভেতরের সব স্তরে খুঁজে নাম বা ধরন মিলিয়ে ফল দেয়। ' + code('-name "*.js"') + ' নামের ধরন দেখে, ' + code('-type d') + ' শুধু ফোল্ডার খোঁজে। ' + code('*') + ' shell-কে আগে খেয়ে নিতে না দিতে quote-এ রাখুন।'; },
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
            case 'find': verb = n + 'টা ফল পেল'; break;
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
        ';': '`;` দিয়ে command-গুলো একটার পর একটা চলে, আগেরটার ফল যাই হোক।'
    };

    function errorOf(stage, info) {
        if (stage.script && stage.errno === 'EACCES') {
            return 'ফাইলটা চালানোর অধিকার (`x`) নেই, তাই চলেনি। `ls -l` দিয়ে দেখুন অধিকারের জায়গায় `x` নেই। `chmod +x` দিলে তবেই script চালানো যায়।';
        }
        return explain({ name: stage.name, args: stage.args, result: { code: stage.code, errno: stage.errno }, before: info.before, after: info.after });
    }

    function singleSentence(stage, info) {
        if (stage.code) return errorOf(stage, info);
        if (stage.script) return stageLabel(stage) + ' একটা script। এর ভেতরের command-গুলো একে একে চলেছে। script-এর ভেতরে `cd` করলেও আপনার জায়গা বদলায় না, কারণ script আলাদা process।';
        var fn = BY_NAME[stage.name];
        return fn ? fn({ name: stage.name, args: stage.args, before: info.before, after: info.after, redirected: stage.redirects.length > 0 }) : '';
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
