// command-এর তালিকা। প্রতিটা command-এর ফাইল এখানে নিজেকে register করে।
// register(নাম, { desc: 'এক লাইনের বাংলা বিবরণ', run: function (ctx) { ... } })
// ctx = { state, args, stdin, tty, history }; run ফেরত দেয় { state, stdout, stderr, code, errno?, clear? }
(function (root) {
    var commands = Object.create(null);

    function register(name, spec) {
        commands[name] = spec;
    }

    function names() {
        return Object.keys(commands).sort();
    }

    var api = { commands: commands, register: register, names: names };
    if (typeof module !== 'undefined' && module.exports) {
        // Node-এ একই registry সবাই পায়, তাই প্রথমবার বানানোটাই রাখা হয়
        module.exports = api;
    } else root.LinuxRegistry = root.LinuxRegistry || api;
})(typeof self !== 'undefined' ? self : this);
