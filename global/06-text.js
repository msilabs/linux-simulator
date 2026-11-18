// terminal আর UI-র বাংলা লেখা এক জায়গায়
(function (root) {
    var text = {
        welcome: 'Linux Simulator-এ স্বাগতম! এটা নকল terminal, তাই যা খুশি চালান, কিছু নষ্ট হবে না।\n`help` লিখে command-এর তালিকা দেখুন। ভুল হলে নিচের Undo বোতাম আছে।',
        undoDone: function (command) { return 'Undo করা হলো: `' + command + '` আগের অবস্থায় ফিরেছে।'; },
        resetDone: 'সব শুরুর অবস্থায় ফিরেছে।',
        notSupported: function (what) { return what + ' এই simulator-এ নেই। আসল Linux-এ এটা চলে, তবে শেখার জন্য এখানে বাদ রাখা হয়েছে।'; },
        missionDone: function (title, number, next) {
            if (!next) return 'অভিনন্দন! "' + title + '" শেষ। সব mission শেষ হয়েছে। এখন নিজের মতো করে যা খুশি চালিয়ে দেখুন।';
            return 'অভিনন্দন! "' + title + '" শেষ। এবার mission ' + number + ': ' + next + '।';
        },
        fileSaved: function (path) { return '`' + path + '` সেভ হয়েছে। `cat` দিয়ে দেখুন।'; },
        stopped: 'Ctrl+C চলতে থাকা program-কে থামতে বলে (আসলে SIGINT signal পাঠায়)। কোনো program আটকে গেলে বা শেষ হচ্ছে না মনে হলে এটাই প্রথম চেষ্টা।',
        saveFailed: 'এই browser-এ অগ্রগতি সেভ করা যাচ্ছে না (হয়তো private window)। পেজ রিলোড করলে সব হারাবে।',
        corruptSave: 'আগের সেভ করা অবস্থা পড়া যায়নি, তাই নতুন করে শুরু হলো।'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = text;
    else root.LinuxText = text;
})(typeof self !== 'undefined' ? self : this);
