// DOM: Playground (home পেজ)। terminal আর ফাইল গাছ জোড়া দেয়, আর session browser-এ সেভ রাখে।
(function () {
    if (typeof document === 'undefined') return;
    var box = document.getElementById('playground');
    if (!box) return;

    var Session = window.LinuxSession;
    var Storage = window.LinuxStorage;
    var Text = window.LinuxText;

    var loaded = Storage.load();
    var current = loaded.status === 'ok' ? loaded.session : Session.freshSession();
    var tree = window.LinuxTreeView.mount(document.getElementById('playground-tree'), function () { return current.state; });

    var terminal = window.LinuxTerminal.mount(box, {
        session: current,
        confirmReset: true,
        onCommit: function (s) {
            terminal.notice(Storage.save(s) ? '' : Text.saveFailed);
        },
        onRender: function (s) {
            current = s;
            tree.render();
        },
        onReset: function () {
            Storage.clear();
            var s = Session.freshSession();
            tree.reset();
            return Object.assign({}, s, { lines: s.lines.concat([{ id: s.nextId, kind: 'welcome', text: Text.resetDone }]), nextId: s.nextId + 1 });
        }
    });
    if (loaded.status === 'corrupt') terminal.notice(Text.corruptSave);

    Storage.watch(function (result) {
        if (result.status === 'ok') terminal.setSession(result.session);
    });
})();
