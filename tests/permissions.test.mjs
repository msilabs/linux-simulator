import test from 'node:test';
import assert from 'node:assert/strict';
import { runAll, last, read, exists, Fs, Seed, Session, Storage, Shell } from './helpers.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Permissions = require('../global/10-commands/06-permissions.js');

function modeOf(state, abs) {
    return Fs.lookup(state.fs, Fs.USERS.root, abs).node.meta.mode;
}

test('chmod: numeric and symbolic modes', () => {
    const cases = [
        ['chmod 600 notes.txt', 0o600],
        ['chmod 0755 notes.txt', 0o755],
        ['chmod +x notes.txt', 0o755],
        ['chmod u+x notes.txt', 0o744],
        ['chmod go-r notes.txt', 0o600],
        ['chmod a=r notes.txt', 0o444],
        ['chmod u=rwx,g=rx,o= notes.txt', 0o750],
        ['chmod -x notes.txt', 0o644],
        ['chmod g+w notes.txt', 0o664]
    ];
    cases.forEach(([line, mode]) => {
        assert.equal(modeOf(last([line]).state, '/home/dev/notes.txt'), mode, line);
    });
});

test('chmod: -R reaches everything inside, -v tells what changed', () => {
    const r = runAll(['chmod -R go-rx projects']);
    assert.equal(modeOf(r.state, '/home/dev/projects'), 0o700);
    assert.equal(modeOf(r.state, '/home/dev/projects/my-site/app.js'), 0o600);
    const v = last(['chmod -v 600 notes.txt']).stdout;
    assert.equal(v, "mode of 'notes.txt' changed from 0644 (rw-r--r--) to 0600 (rw-------)\n");
});

test('chmod: +x makes a script runnable, and the script then runs', () => {
    const r = runAll(['chmod +x scripts/backup.sh', './scripts/backup.sh', 'ls /tmp/backup', 'cat /tmp/backup/notes.txt']);
    assert.equal(r.outputs[1].stdout, 'backup শেষ\n');
    assert.equal(r.outputs[1].code, 0);
    assert.equal(r.outputs[2].stdout, 'notes.txt  projects\n');
    assert.ok(r.outputs[3].stdout.startsWith('Linux'));
    assert.equal(r.state.cwd, '/home/dev');
});

test('chmod: removing r or x really blocks you', () => {
    assert.equal(last(['chmod 000 notes.txt', 'cat notes.txt']).stderr, 'cat: notes.txt: Permission denied\n');
    assert.equal(last(['chmod -x projects', 'cd projects']).stderr, 'bash: cd: projects: Permission denied\n');
    assert.equal(last(['chmod -r projects', 'ls projects']).stderr, "ls: cannot open directory 'projects': Permission denied\n");
    assert.equal(last(['chmod -w downloads', 'rm downloads/song.mp3']).stderr, "rm: cannot remove 'downloads/song.mp3': Permission denied\n");
    assert.equal(last(['chmod -w downloads', 'touch downloads/new']).stderr, "touch: cannot touch 'downloads/new': Permission denied\n");
    assert.equal(last(['chmod -w notes.txt', 'echo x >> notes.txt']).stderr, 'bash: notes.txt: Permission denied\n');
});

test('chmod: errors', () => {
    assert.equal(last(['chmod 755 nope']).stderr, "chmod: cannot access 'nope': No such file or directory\n");
    assert.equal(last(['chmod xyz notes.txt']).stderr, "chmod: invalid mode: 'xyz'\nTry 'chmod --help' for more information.\n");
    assert.equal(last(['chmod 999 notes.txt']).errno, 'EMODE');
    assert.equal(last(['chmod 755']).errno, 'EOPERAND');
    assert.equal(last(['chmod']).errno, 'EOPERAND');
    assert.equal(last(['chmod 644 /etc/hosts']).stderr, "chmod: changing permissions of '/etc/hosts': Operation not permitted\n");
    assert.equal(last(['sudo chmod 666 /etc/hosts']).code, 0);
});

test('chmod -R / is refused, and so is chown -R /', () => {
    assert.equal(last(['sudo chmod -R 777 /']).errno, 'EPROTECT');
    assert.equal(last(['sudo chown -R dev /']).errno, 'EPROTECT');
    assert.equal(modeOf(last(['sudo chmod -R 777 /']).state, '/etc/hosts'), 0o644);
});

test('symbolic mode parser', () => {
    assert.equal(Permissions.newMode('u+x', 0o644, false), 0o744);
    assert.equal(Permissions.newMode('X', 0o644, false), null);
    assert.equal(Permissions.newMode('a+X', 0o644, false), 0o644);
    assert.equal(Permissions.newMode('a+X', 0o644, true), 0o755);
    assert.equal(Permissions.newMode('o+w,u-w', 0o644, false), 0o446);
    assert.equal(Permissions.newMode('bad', 0o644, false), null);
});

test('chown: only root, valid names, -R', () => {
    assert.equal(last(['chown root notes.txt']).stderr, "chown: changing ownership of 'notes.txt': Operation not permitted\n");
    const r = runAll(['sudo chown root:adm notes.txt', 'ls -l notes.txt']);
    assert.match(r.outputs[1].stdout, /root adm/);
    assert.equal(last(['sudo chown nobody notes.txt']).stderr, "chown: invalid user: 'nobody'\n");
    assert.equal(last(['sudo chown dev:staff notes.txt']).stderr, "chown: invalid group: 'dev:staff'\n");
    const tree = runAll(['sudo chown -R www-data projects']);
    assert.equal(Fs.lookup(tree.state.fs, Fs.USERS.root, '/home/dev/projects/my-site/app.js').node.meta.owner, 'www-data');
    assert.equal(last(['sudo chown']).errno, 'EOPERAND');
});

test('after chown to root, dev can read but not write', () => {
    const r = runAll(['sudo chown root notes.txt', 'cat notes.txt', 'echo x >> notes.txt']);
    assert.equal(r.outputs[1].code, 0);
    assert.equal(r.outputs[2].stderr, 'bash: notes.txt: Permission denied\n');
    assert.equal(last(['sudo chown root notes.txt', 'sudo chmod 600 notes.txt', 'cat notes.txt']).stderr, 'cat: notes.txt: Permission denied\n');
});

test('sudo: runs as root for one command only', () => {
    assert.equal(last(['sudo whoami']).stdout, 'root\n');
    const r = runAll(['sudo whoami', 'whoami']);
    assert.equal(r.outputs[1].stdout, 'dev\n');
    assert.equal(r.state.user, 'dev');
    assert.equal(last(['sudo ls /root']).code, 0);
    assert.equal(last(['ls /root']).stderr, "ls: cannot open directory '/root': Permission denied\n");
    const made = runAll(['sudo mkdir /etc/app', 'ls -ld /etc/app']);
    assert.match(made.outputs[1].stdout, /^drwxr-xr-x 2 root root /);
    assert.equal(last(['sudo cd /root']).stderr, 'sudo: cd: command not found\n');
    assert.equal(last(['sudo nope']).stderr, 'sudo: nope: command not found\n');
    assert.equal(last(['sudo']).errno, 'EOPERAND');
    assert.equal(last(['sudo -i']).errno, 'EUNSUPPORTED');
    assert.equal(last(['echo hi | sudo cat']).stdout, 'hi\n');
});

test('sudo does not make the dangerous things work', () => {
    assert.equal(last(['sudo rm -rf /']).errno, 'EPROTECT');
    assert.equal(last(['sudo rm -rf ~']).errno, 'EPROTECT');
    assert.ok(exists(last(['sudo rm -rf /home/dev']).state, '/home/dev/notes.txt'));
});

test('whoami and id', () => {
    assert.equal(last(['whoami']).stdout, 'dev\n');
    assert.equal(last(['id']).stdout, 'uid=1000(dev) gid=1000(dev) groups=1000(dev),27(sudo)\n');
    assert.equal(last(['sudo id']).stdout, 'uid=0(root) gid=0(root) groups=0(root)\n');
});

/* ---------- process ---------- */

test('ps: plain, aux, -ef', () => {
    const plain = last(['ps']).stdout.split('\n');
    assert.equal(plain[0], '    PID TTY          TIME CMD');
    assert.equal(plain.length, 4);
    assert.match(plain[1], /1001 pts\/0\s+00:00:00 bash/);
    const aux = last(['ps aux']).stdout;
    assert.ok(aux.startsWith('USER         PID %CPU %MEM'));
    assert.match(aux, /dev\s+2301\s+97\.3\s+12\.1.* node server\.js/);
    assert.match(aux, /nginx: master process/);
    assert.match(last(['ps -ef']).stdout, /^UID\s+PID\s+PPID/);
    assert.equal(last(['ps aux | grep node | wc -l']).stdout, '1\n');
});

test('kill: polite signal fails on a stubborn process, -9 works', () => {
    const r = runAll(['kill 2301', 'ps aux | grep -c "node server"', 'kill -9 2301', 'ps aux | grep -c "node server"']);
    assert.equal(r.outputs[0].code, 0);
    assert.equal(r.outputs[1].stdout, '1\n');
    assert.equal(r.outputs[3].stdout, '0\n');
    assert.ok(r.outputs[0].explain.includes('kill -9 2301'));
    assert.equal(last(['kill -KILL 2301', 'ps aux | grep -c "node server"']).stdout, '0\n');
    assert.equal(last(['kill -SIGKILL 2301', 'ps aux | grep -c "node server"']).stdout, '0\n');
});

test('kill: errors and permissions', () => {
    assert.equal(last(['kill 9999']).stderr, 'bash: kill: (9999) - No such process\n');
    assert.equal(last(['kill 612']).stderr, 'bash: kill: (612) - Operation not permitted\n');
    assert.equal(last(['kill abc']).stderr, 'bash: kill: abc: arguments must be process or job IDs\n');
    assert.equal(last(['kill -BOGUS 1']).errno, 'ESIGNAL');
    assert.equal(last(['kill']).errno, 'EOPERAND');
    const root = runAll(['sudo kill 612', 'ps aux | grep -c "master process"']);
    assert.equal(root.outputs[1].stdout, '0\n');
});

test('kill leaves the process list alone when nothing dies', () => {
    const { state } = runAll(['ls']);
    assert.equal(last(['kill 9999'], state).state.processes, state.processes);
    assert.equal(last(['kill 2301'], state).state.processes, state.processes);
});

/* ---------- system ---------- */

test('du and df', () => {
    assert.equal(last(['du -s projects']).stdout, '20\tprojects\n');
    assert.equal(last(['du -sh projects']).stdout, '20K\tprojects\n');
    assert.equal(last(['du projects']).stdout, '16\tprojects/my-site\n20\tprojects\n');
    assert.equal(last(['du -sh nope']).errno, 'ENOENT');
    assert.match(last(['df -h']).stdout, /^Filesystem\s+Size\s+Used\s+Avail\s+Use% Mounted on\n/);
    assert.match(last(['df']).stdout, /1K-blocks/);
});

test('ln -s: relative, absolute, into a folder, errors', () => {
    const r = runAll(['ln -s projects/my-site site', 'ls site', 'ls -l site', 'ln -s /etc/hosts', 'cat hosts', 'mkdir box', 'ln -s ../notes.txt box', 'cat box/notes.txt']);
    assert.equal(r.outputs[1].stdout, 'app.js  index.html  style.css\n');
    assert.match(r.outputs[2].stdout, /lrwxrwxrwx 1 dev dev \d+ .* site -> projects\/my-site/);
    assert.ok(r.outputs[4].stdout.includes('localhost'));
    assert.ok(r.outputs[7].stdout.startsWith('Linux'));
    assert.equal(last(['ln -s a notes.txt']).stderr, "ln: failed to create symbolic link 'notes.txt': File exists\n");
    assert.equal(last(['ln notes.txt hard']).errno, 'EUNSUPPORTED');
    assert.equal(last(['ln -s']).errno, 'EOPERAND');
    const loop = runAll(['ln -s b a', 'ln -s a b', 'cat a']);
    assert.equal(loop.outputs[2].stderr, 'cat: a: Too many levels of symbolic links\n');
});

test('rm of a link removes the link, not the target', () => {
    const r = runAll(['ln -s /etc/hosts h', 'rm h']);
    assert.ok(!exists(r.state, '/home/dev/h'));
    assert.ok(exists(r.state, '/etc/hosts'));
});

test('date, uname, hostname', () => {
    assert.equal(last(['date']).stdout, 'Wed Nov 18 10:00:00 UTC 2026\n');
    assert.equal(last(['date +%F']).stdout, '2026-11-18\n');
    assert.equal(last(['date "+%d/%m/%Y %H:%M"']).stdout, '18/11/2026 10:00\n');
    assert.equal(last(['date x']).errno, 'EOPT');
    assert.equal(last(['uname']).stdout, 'Linux\n');
    assert.match(last(['uname -a']).stdout, /^Linux laptop 5\.15/);
    assert.equal(last(['uname -rn']).stdout, 'laptop 5.15.0-91-generic\n');
    assert.equal(last(['hostname']).stdout, 'laptop\n');
});

test('sleep: short ones finish, long ones wait for Ctrl+C', () => {
    assert.equal(last(['sleep 1']).waiting, undefined);
    assert.equal(last(['sleep 100']).waiting.name, 'sleep 100');
    assert.equal(last(['sleep']).errno, 'EOPERAND');
    assert.equal(last(['sleep abc']).errno, 'EOPT');
    assert.equal(last(['tail -f /var/log/nginx/error.log | grep ERROR']).waiting.name, 'tail -f');
    assert.equal(last(['tail -f nope']).waiting, undefined);
});

/* ---------- session: waiting and editing ---------- */

test('session: a waiting command blocks input until Ctrl+C', () => {
    let s = Session.applyCommand(Session.freshSession(), 'tail -f /var/log/nginx/error.log');
    assert.equal(s.running.name, 'tail -f');
    const same = Session.applyCommand(s, 'ls');
    assert.equal(same, s);
    s = Session.stopRunning(s);
    assert.equal(s.running, null);
    assert.deepEqual(s.lines.slice(-2).map((l) => l.text.slice(0, 2)), ['^C', 'Ct']);
    assert.notEqual(Session.applyCommand(s, 'ls'), s);
    assert.equal(Session.stopRunning(s), s);
});

test('session: nano opens an edit, saving writes the file and can be undone', () => {
    let s = Session.applyCommand(Session.freshSession(), 'nano notes.txt');
    assert.equal(s.editing.path, '/home/dev/notes.txt');
    assert.equal(s.editing.writable, true);
    assert.equal(Session.applyCommand(s, 'ls'), s);
    const saved = Session.saveFile(s, s.editing.path, 'নতুন লেখা\n', 'notes.txt');
    s = saved.session;
    assert.equal(s.editing, null);
    assert.equal(read(s.state, '/home/dev/notes.txt'), 'নতুন লেখা\n');
    assert.equal(s.log[s.log.length - 1].type, 'write');
    const back = Session.undo(s);
    assert.ok(read(back.state, '/home/dev/notes.txt').startsWith('Linux'));
    assert.match(back.lines[back.lines.length - 1].text, /nano notes\.txt/);
});

test('session: nano for a new file, a read-only file, and a cancelled edit', () => {
    let s = Session.applyCommand(Session.freshSession(), 'nano fresh.txt');
    assert.equal(s.editing.exists, false);
    s = Session.saveFile(s, s.editing.path, 'hi', 'fresh.txt').session;
    assert.equal(read(s.state, '/home/dev/fresh.txt'), 'hi');
    const ro = Session.applyCommand(Session.freshSession(), 'nano /etc/hosts');
    assert.equal(ro.editing.writable, false);
    const refused = Session.saveFile(ro, '/etc/hosts', 'x', '/etc/hosts');
    assert.match(refused.error, /Permission denied/);
    assert.ok(refused.session.editing);
    assert.equal(Session.cancelEdit(ro).editing, null);
    assert.equal(last(['nano /nodir/x']).errno, 'ENOENT');
    assert.equal(last(['nano projects']).errno, 'EISDIR');
    assert.equal(last(['nano']).errno, 'EOPERAND');
    assert.equal(last(['echo | nano x']).errno, 'EUNSUPPORTED');
});

test('storage: file saves survive save and load', () => {
    let s = Session.applyCommand(Session.freshSession(), 'nano notes.txt');
    s = Session.saveFile(s, s.editing.path, 'বদলানো\n', 'notes.txt').session;
    s = Session.applyCommand(s, 'mkdir after');
    const loaded = Storage.parse(Storage.serialize(s));
    assert.equal(loaded.status, 'ok');
    assert.equal(read(loaded.session.state, '/home/dev/notes.txt'), 'বদলানো\n');
    assert.equal(loaded.session.log.length, 2);
    const twice = Session.undo(Session.undo(loaded.session));
    assert.ok(read(twice.state, '/home/dev/notes.txt').startsWith('Linux'));
    const broken = JSON.parse(Storage.serialize(s));
    broken.log[0] = { type: 'write', path: 'relative', content: 'x', label: 'x' };
    assert.equal(Storage.parse(JSON.stringify(broken)).status, 'corrupt');
});

test('explanations for the new commands', () => {
    assert.match(last(['chmod +x scripts/backup.sh']).explain, /চালানোর \(x\) অনুমতি যোগ/);
    assert.match(last(['chmod 755 notes.txt']).explain, /৭ = rwx.*৫ = r-x.*৫ = r-x/);
    assert.match(last(['chmod 777 notes.txt']).explain, /সাবধান/);
    assert.doesNotMatch(last(['chmod 644 notes.txt']).explain, /সাবধান/);
    assert.match(last(['chmod -R 777 /']).explain, /সুরক্ষার জন্য/);
    assert.match(last(['./scripts/backup.sh']).explain, /chmod \+x/);
    assert.match(last(['sudo whoami']).explain, /root হিসেবে/);
    assert.match(last(['ps aux']).explain, /PID/);
    assert.match(last(['kill 9999']).explain, /ps aux/);
    assert.match(last(['tail -f notes.txt']).explain, /Ctrl\+C/);
    for (const line of ['whoami', 'id', 'du -sh .', 'df -h', 'ln -s a b', 'date', 'uname', 'hostname', 'sleep 1', 'chown --help']) {
        assert.ok(last([line]).explain, line);
    }
});
