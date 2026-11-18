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
        echo: function () {
            return code('echo') + ' যা লেখা হয় তাই পর্দায় ছাপে। এটা একা তেমন কাজের নয়, কিন্তু পরে ' + code('>') + ' দিয়ে ফাইলে লেখার সময় লাগবে।';
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
        clear: function () { return ''; },
        history: function () {
            return code('history') + ' আগে চালানো command-গুলোর তালিকা। ' + code('↑') + ' চেপেও আগের command ফিরিয়ে আনা যায়।';
        },
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

    var api = { explain: explain, bn: H.bn };
    if (isNode) module.exports = api;
    else root.LinuxExplain = api;
})(typeof self !== 'undefined' ? self : this);
