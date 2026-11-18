// বাংলা manual page
(function (root) {
    var pages = {
        "ls": {
                "summary": "ফোল্ডারের ভেতরের ফাইল আর ফোল্ডারের নাম দেখায়",
                "usage": "ls [option] [ফোল্ডার বা ফাইল...]",
                "options": [
                        [
                                "-l",
                                "প্রতি লাইনে একটা করে, অধিকার, মালিক, আকার আর সময়সহ"
                        ],
                        [
                                "-a",
                                "`.` দিয়ে শুরু হওয়া লুকানো ফাইলও দেখায়"
                        ],
                        [
                                "-h",
                                "আকার K, M-এর মতো পড়ার সুবিধার রূপে (-l-এর সাথে)"
                        ],
                        [
                                "-R",
                                "ভেতরের সব ফোল্ডারও একে একে দেখায়"
                        ],
                        [
                                "-1",
                                "প্রতি লাইনে একটা নাম"
                        ]
                ],
                "examples": [
                        [
                                "ls -la",
                                "লুকানো ফাইলসহ বিস্তারিত তালিকা"
                        ],
                        [
                                "ls -lh /var/log",
                                "আকার পড়ার সুবিধার রূপে"
                        ]
                ]
        },
        "cd": {
                "summary": "অন্য ফোল্ডারে যায়",
                "usage": "cd [ফোল্ডার]",
                "options": [
                        [
                                "(কিছু না)",
                                "home ফোল্ডারে ফেরে"
                        ],
                        [
                                "~",
                                "home ফোল্ডার"
                        ],
                        [
                                "..",
                                "এক ধাপ উপরের ফোল্ডার"
                        ],
                        [
                                "-",
                                "আগে যে ফোল্ডারে ছিলেন সেখানে ফেরে"
                        ]
                ],
                "examples": [
                        [
                                "cd projects/my-site",
                                "ভেতরের ফোল্ডারে ঢোকে"
                        ],
                        [
                                "cd ..",
                                "এক ধাপ উপরে"
                        ]
                ]
        },
        "pwd": {
                "summary": "এখন কোন ফোল্ডারে আছেন তার পুরো ঠিকানা দেখায়",
                "usage": "pwd",
                "options": [],
                "examples": [
                        [
                                "pwd",
                                "যেমন /home/dev"
                        ]
                ]
        },
        "cat": {
                "summary": "ফাইলের পুরো লেখা পর্দায় দেখায়",
                "usage": "cat [option] [ফাইল...]",
                "options": [
                        [
                                "-n",
                                "প্রতি লাইনের আগে নম্বর বসায়"
                        ]
                ],
                "examples": [
                        [
                                "cat notes.txt",
                                "ফাইল পড়া"
                        ],
                        [
                                "cat a.txt b.txt",
                                "দুটো ফাইল পরপর"
                        ]
                ]
        },
        "mkdir": {
                "summary": "নতুন ফোল্ডার বানায়",
                "usage": "mkdir [option] ফোল্ডার...",
                "options": [
                        [
                                "-p",
                                "মাঝের ফোল্ডারগুলোও বানায়, আগে থেকে থাকলে ভুল ধরে না"
                        ],
                        [
                                "-v",
                                "কী বানানো হলো তা বলে"
                        ]
                ],
                "examples": [
                        [
                                "mkdir -p a/b/c",
                                "তিন স্তরের ফোল্ডার একবারে"
                        ]
                ]
        },
        "rmdir": {
                "summary": "খালি ফোল্ডার মোছে",
                "usage": "rmdir [option] ফোল্ডার...",
                "options": [
                        [
                                "-p",
                                "উপরের খালি ফোল্ডারগুলোও মোছে"
                        ]
                ],
                "examples": [
                        [
                                "rmdir old",
                                "খালি ফোল্ডার `old` মোছে"
                        ]
                ]
        },
        "touch": {
                "summary": "খালি ফাইল বানায়, ফাইল থাকলে তার সময় নতুন করে",
                "usage": "touch ফাইল...",
                "options": [
                        [
                                "-c",
                                "ফাইল না থাকলে বানায় না"
                        ]
                ],
                "examples": [
                        [
                                "touch a.txt b.txt",
                                "দুটো খালি ফাইল"
                        ]
                ]
        },
        "rm": {
                "summary": "ফাইল বা ফোল্ডার মোছে। Recycle Bin নেই, মোছা জিনিস ফেরত আসে না",
                "usage": "rm [option] ফাইল...",
                "options": [
                        [
                                "-r",
                                "ফোল্ডার আর তার ভেতরের সবকিছু মোছে"
                        ],
                        [
                                "-f",
                                "ফাইল না থাকলে কিছু বলে না"
                        ],
                        [
                                "-v",
                                "কী মোছা হলো তা বলে"
                        ]
                ],
                "examples": [
                        [
                                "rm old.txt",
                                "একটা ফাইল মোছে"
                        ],
                        [
                                "rm -r old-folder",
                                "ফোল্ডারসহ মোছে"
                        ]
                ]
        },
        "cp": {
                "summary": "ফাইল বা ফোল্ডারের কপি বানায়",
                "usage": "cp [option] উৎস... গন্তব্য",
                "options": [
                        [
                                "-r",
                                "ফোল্ডার কপি করতে লাগে"
                        ],
                        [
                                "-v",
                                "কী কপি হলো তা বলে"
                        ]
                ],
                "examples": [
                        [
                                "cp a.txt b.txt",
                                "নতুন নামে কপি"
                        ],
                        [
                                "cp -r projects backup",
                                "ফোল্ডারসহ কপি"
                        ]
                ]
        },
        "mv": {
                "summary": "ফাইল বা ফোল্ডার সরায়, বা নাম বদলায়",
                "usage": "mv [option] উৎস... গন্তব্য",
                "options": [
                        [
                                "-v",
                                "কী সরানো হলো তা বলে"
                        ]
                ],
                "examples": [
                        [
                                "mv old.txt new.txt",
                                "নাম বদলানো"
                        ],
                        [
                                "mv *.jpg pics",
                                "সব .jpg ফোল্ডারে সরানো"
                        ]
                ]
        },
        "echo": {
                "summary": "লেখা পর্দায় ছাপে",
                "usage": "echo [option] [লেখা...]",
                "options": [
                        [
                                "-n",
                                "শেষে নতুন লাইন দেয় না"
                        ],
                        [
                                "-e",
                                "\\n আর \\t বিশেষ চিহ্ন হিসেবে ধরে"
                        ]
                ],
                "examples": [
                        [
                                "echo \"hello\" > hi.txt",
                                "ফাইলে লেখা"
                        ],
                        [
                                "echo $HOME",
                                "variable-এর মান দেখা"
                        ]
                ]
        },
        "tree": {
                "summary": "ফোল্ডারের ভেতরটা গাছের মতো সাজিয়ে দেখায়",
                "usage": "tree [option] [ফোল্ডার]",
                "options": [
                        [
                                "-a",
                                "লুকানো ফাইলও দেখায়"
                        ],
                        [
                                "-d",
                                "শুধু ফোল্ডার"
                        ],
                        [
                                "-L n",
                                "n স্তর পর্যন্ত"
                        ]
                ],
                "examples": [
                        [
                                "tree -L 2",
                                "দুই স্তর পর্যন্ত"
                        ]
                ]
        },
        "head": {
                "summary": "ফাইলের প্রথম কয়েক লাইন দেখায় (সাধারণত ১০টা)",
                "usage": "head [option] [ফাইল...]",
                "options": [
                        [
                                "-n N",
                                "প্রথম N লাইন"
                        ],
                        [
                                "-N",
                                "-n N-এর ছোট রূপ"
                        ]
                ],
                "examples": [
                        [
                                "head -n 5 access.log",
                                "প্রথম ৫ লাইন"
                        ]
                ]
        },
        "tail": {
                "summary": "ফাইলের শেষ কয়েক লাইন দেখায় (সাধারণত ১০টা)",
                "usage": "tail [option] [ফাইল...]",
                "options": [
                        [
                                "-n N",
                                "শেষ N লাইন"
                        ],
                        [
                                "-n +N",
                                "N নম্বর লাইন থেকে শেষ পর্যন্ত"
                        ],
                        [
                                "-f",
                                "শেষে নজর রাখে, নতুন লাইন এলেই দেখায় (Ctrl+C-তে থামে)"
                        ]
                ],
                "examples": [
                        [
                                "tail -n 20 error.log",
                                "শেষ ২০ লাইন"
                        ]
                ]
        },
        "wc": {
                "summary": "লাইন, শব্দ আর byte গোনে",
                "usage": "wc [option] [ফাইল...]",
                "options": [
                        [
                                "-l",
                                "শুধু লাইন"
                        ],
                        [
                                "-w",
                                "শুধু শব্দ"
                        ],
                        [
                                "-c",
                                "শুধু byte"
                        ],
                        [
                                "-m",
                                "শুধু অক্ষর"
                        ]
                ],
                "examples": [
                        [
                                "wc -l notes.txt",
                                "কত লাইন"
                        ],
                        [
                                "grep ERROR log | wc -l",
                                "কয়টা মিলল তা গোনা"
                        ]
                ]
        },
        "grep": {
                "summary": "লেখার ভেতর থেকে মেলা লাইন খুঁজে দেখায়",
                "usage": "grep [option] pattern [ফাইল...]",
                "options": [
                        [
                                "-i",
                                "বড়-ছোট হাতের ভেদ করে না"
                        ],
                        [
                                "-n",
                                "লাইন নম্বরসহ"
                        ],
                        [
                                "-r",
                                "ফোল্ডারের ভেতরে সব ফাইলে খোঁজে"
                        ],
                        [
                                "-v",
                                "যেগুলো মেলে না সেগুলো দেখায়"
                        ],
                        [
                                "-c",
                                "কয়টা লাইন মিলল তা গোনে"
                        ],
                        [
                                "-l",
                                "শুধু মেলা ফাইলের নাম"
                        ],
                        [
                                "-E",
                                "বাড়তি pattern (+ ? | ( ) ) চালু"
                        ],
                        [
                                "-w",
                                "পুরো শব্দ মিলতে হবে"
                        ],
                        [
                                "-o",
                                "শুধু মেলা অংশটুকু"
                        ]
                ],
                "examples": [
                        [
                                "grep ERROR error.log",
                                "ERROR আছে এমন লাইন"
                        ],
                        [
                                "grep -rn \"TODO\" projects",
                                "সব ফাইলে নম্বরসহ"
                        ]
                ]
        },
        "find": {
                "summary": "নাম বা ধরন ধরে ফাইল খুঁজে বের করে",
                "usage": "find [ফোল্ডার...] [শর্ত]",
                "options": [
                        [
                                "-name pat",
                                "নাম মেলে (`*` আর `?` চলে, quote-এ দিন)"
                        ],
                        [
                                "-iname pat",
                                "বড়-ছোট হাতের ভেদ ছাড়া"
                        ],
                        [
                                "-type f|d",
                                "f = ফাইল, d = ফোল্ডার"
                        ],
                        [
                                "-maxdepth n",
                                "n স্তরের বেশি নামে না"
                        ]
                ],
                "examples": [
                        [
                                "find . -name \"*.js\"",
                                "সব .js ফাইল"
                        ],
                        [
                                "find / -type d -name log",
                                "`log` নামের ফোল্ডার"
                        ]
                ]
        },
        "sort": {
                "summary": "লাইনগুলো সাজায়",
                "usage": "sort [option] [ফাইল...]",
                "options": [
                        [
                                "-n",
                                "সংখ্যা হিসেবে"
                        ],
                        [
                                "-r",
                                "উল্টো ক্রমে"
                        ],
                        [
                                "-u",
                                "একই লাইন একবারই"
                        ],
                        [
                                "-k N",
                                "N নম্বর field দেখে"
                        ],
                        [
                                "-t X",
                                "field আলাদা করার চিহ্ন"
                        ]
                ],
                "examples": [
                        [
                                "sort -n numbers.txt",
                                "সংখ্যা ধরে"
                        ],
                        [
                                "sort | uniq -c",
                                "কোনটা কতবার আছে"
                        ]
                ]
        },
        "uniq": {
                "summary": "পাশাপাশি একই লাইনগুলো এক করে। আগে `sort` লাগে",
                "usage": "uniq [option] [ফাইল]",
                "options": [
                        [
                                "-c",
                                "প্রতিটা কতবার এল তা গোনে"
                        ],
                        [
                                "-d",
                                "শুধু যেগুলো একাধিকবার"
                        ],
                        [
                                "-u",
                                "শুধু যেগুলো একবারই"
                        ]
                ],
                "examples": [
                        [
                                "sort names.txt | uniq -c",
                                "কোন নাম কতবার"
                        ]
                ]
        },
        "cut": {
                "summary": "প্রতি লাইন থেকে নির্দিষ্ট অংশ কেটে নেয়",
                "usage": "cut -d চিহ্ন -f তালিকা [ফাইল...]",
                "options": [
                        [
                                "-d X",
                                "field আলাদা করার চিহ্ন (এক অক্ষর)"
                        ],
                        [
                                "-f 1,3",
                                "কোন field"
                        ],
                        [
                                "-c 1-5",
                                "কোন অক্ষর"
                        ],
                        [
                                "-s",
                                "চিহ্ন নেই এমন লাইন বাদ"
                        ]
                ],
                "examples": [
                        [
                                "cut -d: -f1 /etc/passwd",
                                "সব user-এর নাম"
                        ]
                ]
        },
        "less": {
                "summary": "বড় ফাইল দেখার command। এই simulator-এ পুরোটা একবারে দেখায়",
                "usage": "less [ফাইল]",
                "options": [],
                "examples": [
                        [
                                "less /var/log/nginx/access.log",
                                "বড় log দেখা"
                        ]
                ]
        },
        "history": {
                "summary": "আগে চালানো command-এর তালিকা",
                "usage": "history",
                "options": [],
                "examples": [
                        [
                                "history",
                                "নম্বরসহ তালিকা"
                        ]
                ]
        },
        "env": {
                "summary": "পরিবেশের সব variable দেখায়",
                "usage": "env",
                "options": [],
                "examples": [
                        [
                                "env",
                                "HOME, PATH ইত্যাদি"
                        ]
                ]
        },
        "export": {
                "summary": "variable বানায় বা বদলায়",
                "usage": "export NAME=মান",
                "options": [],
                "examples": [
                        [
                                "export GREETING=hello",
                                "নতুন variable"
                        ],
                        [
                                "echo $GREETING",
                                "মান দেখা"
                        ]
                ]
        },
        "alias": {
                "summary": "বড় command-এর ছোট নাম বানায়। শুধু এই session-এ থাকে",
                "usage": "alias নাম='command'",
                "options": [],
                "examples": [
                        [
                                "alias ll='ls -la'",
                                "`ll` লিখলেই `ls -la` চলবে"
                        ]
                ]
        },
        "which": {
                "summary": "command কোথায় আছে দেখায়",
                "usage": "which command...",
                "options": [],
                "examples": [
                        [
                                "which ls",
                                "/usr/bin/ls"
                        ]
                ]
        },
        "man": {
                "summary": "command-এর বাংলা manual দেখায়",
                "usage": "man command",
                "options": [],
                "examples": [
                        [
                                "man ls",
                                "`ls`-এর manual"
                        ]
                ]
        },
        "chmod": {
                "summary": "ফাইলের অধিকার (পড়া, লেখা, চালানো) বদলায়",
                "usage": "chmod [option] mode ফাইল...",
                "options": [
                        [
                                "-R",
                                "ভেতরের সবকিছুর অধিকারও"
                        ],
                        [
                                "-v",
                                "কী বদলাল তা বলে"
                        ]
                ],
                "examples": [
                        [
                                "chmod +x backup.sh",
                                "script চালানোর অধিকার দেওয়া"
                        ],
                        [
                                "chmod 644 notes.txt",
                                "মালিক পড়বে-লিখবে, বাকিরা শুধু পড়বে"
                        ],
                        [
                                "chmod 755 scripts",
                                "ফোল্ডার আর script-এর সাধারণ অধিকার"
                        ]
                ]
        },
        "chown": {
                "summary": "ফাইলের মালিক বদলায়। শুধু root পারে",
                "usage": "chown [option] মালিক[:দল] ফাইল...",
                "options": [
                        [
                                "-R",
                                "ভেতরের সবকিছুর মালিকও"
                        ]
                ],
                "examples": [
                        [
                                "sudo chown www-data:www-data site",
                                "মালিক আর দল বদলানো"
                        ]
                ]
        },
        "sudo": {
                "summary": "একটা command root হিসেবে চালায়",
                "usage": "sudo command [argument...]",
                "options": [],
                "examples": [
                        [
                                "sudo whoami",
                                "root দেখাবে"
                        ],
                        [
                                "sudo ls /root",
                                "root-এর ফোল্ডার দেখা"
                        ]
                ]
        },
        "whoami": {
                "summary": "এখন কোন user হিসেবে আছেন তা দেখায়",
                "usage": "whoami",
                "options": [],
                "examples": [
                        [
                                "whoami",
                                "dev"
                        ]
                ]
        },
        "id": {
                "summary": "user আর group-এর পরিচয় দেখায়",
                "usage": "id",
                "options": [],
                "examples": [
                        [
                                "id",
                                "uid=1000(dev) gid=1000(dev) ..."
                        ]
                ]
        },
        "ps": {
                "summary": "চলতে থাকা process-এর তালিকা দেখায়",
                "usage": "ps [aux | -ef]",
                "options": [
                        [
                                "aux",
                                "সবার সব process, CPU আর memory সহ"
                        ],
                        [
                                "-ef",
                                "সব process, অন্য সাজে"
                        ]
                ],
                "examples": [
                        [
                                "ps aux | grep node",
                                "node-এর process খোঁজা"
                        ]
                ]
        },
        "kill": {
                "summary": "process-কে signal পাঠায়",
                "usage": "kill [-signal] PID...",
                "options": [
                        [
                                "-15",
                                "ভদ্রভাবে বন্ধ হতে বলা (সাধারণ)"
                        ],
                        [
                                "-9",
                                "জোর করে মারা (শেষ উপায়)"
                        ]
                ],
                "examples": [
                        [
                                "kill 2301",
                                "ভদ্রভাবে"
                        ],
                        [
                                "kill -9 2301",
                                "জোর করে"
                        ]
                ]
        },
        "du": {
                "summary": "ফোল্ডার কতটা জায়গা নিয়েছে দেখায়",
                "usage": "du [option] [ফোল্ডার...]",
                "options": [
                        [
                                "-s",
                                "শুধু মোট"
                        ],
                        [
                                "-h",
                                "K, M-এর মতো সহজ রূপে"
                        ],
                        [
                                "-a",
                                "ফাইলও দেখায়"
                        ]
                ],
                "examples": [
                        [
                                "du -sh projects",
                                "মোট কত"
                        ]
                ]
        },
        "df": {
                "summary": "disk-এ কত জায়গা আছে দেখায়",
                "usage": "df [-h]",
                "options": [
                        [
                                "-h",
                                "সহজ রূপে"
                        ]
                ],
                "examples": [
                        [
                                "df -h",
                                "ফাঁকা জায়গা"
                        ]
                ]
        },
        "ln": {
                "summary": "শর্টকাট (symbolic link) বানায়",
                "usage": "ln -s লক্ষ্য [নাম]",
                "options": [
                        [
                                "-s",
                                "symbolic link"
                        ],
                        [
                                "-f",
                                "আগের নাম থাকলে বদলে দেয়"
                        ]
                ],
                "examples": [
                        [
                                "ln -s projects/my-site site",
                                "`site` নামে শর্টকাট"
                        ]
                ]
        },
        "nano": {
                "summary": "লেখার editor খোলে",
                "usage": "nano ফাইল",
                "options": [],
                "examples": [
                        [
                                "nano notes.txt",
                                "নোট বদলানো"
                        ]
                ]
        },
        "date": {
                "summary": "তারিখ আর সময় দেখায়",
                "usage": "date [+format]",
                "options": [
                        [
                                "+%F",
                                "২০২৬-১১-১৮ ধরনের তারিখ"
                        ],
                        [
                                "+%T",
                                "সময়"
                        ]
                ],
                "examples": [
                        [
                                "date +%F",
                                "শুধু তারিখ"
                        ]
                ]
        },
        "uname": {
                "summary": "system-এর নাম আর ভার্সন দেখায়",
                "usage": "uname [-a]",
                "options": [
                        [
                                "-a",
                                "সব তথ্য"
                        ]
                ],
                "examples": [
                        [
                                "uname -a",
                                "পুরো তথ্য"
                        ]
                ]
        },
        "hostname": {
                "summary": "এই কম্পিউটারের নাম দেখায়",
                "usage": "hostname",
                "options": [],
                "examples": [
                        [
                                "hostname",
                                "laptop"
                        ]
                ]
        },
        "sleep": {
                "summary": "কিছুক্ষণ অপেক্ষা করে",
                "usage": "sleep সেকেন্ড",
                "options": [],
                "examples": [
                        [
                                "sleep 2",
                                "দুই সেকেন্ড"
                        ],
                        [
                                "sleep 100",
                                "লম্বা, Ctrl+C দিয়ে থামান"
                        ]
                ]
        }
};

    // page-এর সাজানো লেখা। না থাকলে null
    function render(name) {
        if (!Object.prototype.hasOwnProperty.call(pages, name)) return null;
        var page = pages[name];
        var out = name.toUpperCase() + '(1)' + '\n\n';
        out += 'নাম\n    ' + name + ' - ' + page.summary + '\n\n';
        out += 'ব্যবহার\n    ' + page.usage + '\n';
        if (page.options.length) {
            var width = 0;
            page.options.forEach(function (o) { width = Math.max(width, o[0].length); });
            out += '\nকাজের option\n';
            page.options.forEach(function (o) {
                var flag = o[0];
                while (flag.length < width) flag += ' ';
                out += '    ' + flag + '  ' + o[1] + '\n';
            });
        }
        if (page.examples.length) {
            out += '\nউদাহরণ\n';
            page.examples.forEach(function (e) { out += '    ' + e[0] + '\n        ' + e[1] + '\n'; });
        }
        return out;
    }

    function names() {
        return Object.keys(pages).sort();
    }

    var api = { pages: pages, render: render, names: names };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxMan = api;
})(typeof self !== 'undefined' ? self : this);
