import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, Storage, Missions, Seed, read, exists } from './helpers.mjs';

function play(commands, start) {
    return commands.reduce((s, c) => Session.applyCommand(s, c), start || Session.freshSession());
}

// প্রথম n টা mission প্রস্তাবিত command দিয়ে শেষ করা (চলতে থাকা command Ctrl+C দিয়ে থামিয়ে)
function through(n) {
    let s = Session.freshSession();
    Missions.MISSIONS.slice(0, n).forEach((m) => m.stages.forEach((stage) => {
        s = Session.applyCommand(s, stage.command);
        if (s.running) s = Session.stopRunning(s);
    }));
    return s;
}

// প্রতিটা ধাপের নিজের প্রস্তাবিত command চালিয়ে পুরো পথ পার করা
function playAll(session) {
    let s = session || Session.freshSession();
    Missions.MISSIONS.forEach((mission, mi) => {
        mission.stages.forEach((stage, si) => {
            const before = s.step;
            s = Session.applyCommand(s, stage.command);
            if (s.running) s = Session.stopRunning(s);
            assert.equal(s.step, before + 1, `mission ${mi + 1} stage ${si + 1} did not finish with its own command: ${stage.command}`);
        });
    });
    return s;
}

test('there are eleven missions with two to five stages each', () => {
    assert.equal(Missions.MISSIONS.length, 11);
    Missions.MISSIONS.forEach((m) => {
        assert.ok(m.stages.length >= 3 && m.stages.length <= 5, m.title);
        assert.ok(m.title && m.goal);
        m.stages.forEach((st) => assert.ok(st.label && st.command && typeof st.check === 'function'));
    });
    assert.equal(Missions.totalSteps(), Missions.MISSIONS.reduce((n, m) => n + m.stages.length, 0));
});

test('every stage finishes with its own suggested command, in order', () => {
    const s = playAll();
    assert.equal(s.step, Missions.totalSteps());
    assert.equal(Missions.view(s.step).finished, true);
});

test('a finished mission announces the next one', () => {
    let s = Session.freshSession();
    Missions.MISSIONS[0].stages.forEach((stage) => { s = Session.applyCommand(s, stage.command); });
    const last = s.lines[s.lines.length - 1];
    assert.equal(last.kind, 'welcome');
    assert.match(last.text, /"কোথায় আছি\?" শেষ/);
    assert.match(last.text, /mission ২: নতুন প্রজেক্ট/);
});

test('the last mission ends with congratulations', () => {
    const s = playAll();
    assert.match(s.lines.filter((l) => l.kind === 'welcome').pop().text, /সব mission শেষ/);
});

test('a stage does not finish on the wrong command', () => {
    const s = play(['ls', 'pwd', 'ls', 'cd projects', 'pwd']);
    assert.equal(s.step, 2, 'pwd and ls are done in order; cd projects is not the current stage (cd projects/my-site is)');
    assert.equal(Missions.view(s.step).stages.find((x) => x.current).command, 'cd projects/my-site');
});

test('different ways to do the same thing both work', () => {
    const twoCds = play(['pwd', 'ls', 'cd projects', 'cd my-site']);
    assert.equal(twoCds.step, 3, 'reaching my-site in two steps also counts');
    const direct = play(['pwd', 'ls', 'cd ~/projects/my-site', 'cd ..', 'cd']);
    assert.equal(direct.step, 5);

    const afterM1 = () => through(1);
    assert.equal(play(['mkdir -p projects/blog/css'], afterM1()).step, 6);
    assert.equal(play(['mkdir projects/blog', 'mkdir projects/blog/css'], afterM1()).step, 6);
    assert.equal(play(['mkdir projects/blog'], afterM1()).step, 5, 'the css folder is what counts');
});

test('mission 4: wildcard and single-file moves are both fine', () => {
    const upTo4 = () => through(3);
    const base = upTo4();
    const stage = Missions.totalSteps() && base.step;
    let s = play(['mkdir ~/downloads/pics', 'mkdir ~/downloads/docs'], base);
    assert.equal(s.step, stage + 2);
    s = play(['mv ~/downloads/photo1.jpg ~/downloads/pics'], s);
    assert.equal(s.step, stage + 2, 'one jpg left behind is not done');
    s = play(['mv ~/downloads/photo2.jpg ~/downloads/pics'], s);
    assert.equal(s.step, stage + 3);
    s = play(['cd ~/downloads', 'mv *.pdf docs', 'rm old-notes.txt'], s);
    assert.equal(s.step, stage + 5);
});

test('mission 6: redirect needs both the pipe and the file', () => {
    const base = through(5);
    const at = base.step;
    let s = play(['grep 404 /var/log/nginx/access.log | wc -l', "cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c"], base);
    assert.equal(s.step, at + 2);
    s = play(['sort /var/log/nginx/access.log > ~/sorted.txt'], s);
    assert.equal(s.step, at + 2, 'a redirect without the pipeline is a different thing');
    s = play(["cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c > ~/counts.txt"], s);
    assert.equal(s.step, at + 2, 'the file must be ips.txt');
    s = play(["cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c > ~/ips.txt", 'echo "x" >> ~/ips.txt'], s);
    assert.equal(s.step, at + 4);
});

test('mission 7: the script stages need the real failure and the real fix', () => {
    const base = through(6);
    const at = base.step;
    let s = play(['cd ~/scripts', './backup.sh'], base);
    assert.equal(s.step, at + 1);
    s = play(['ls -l'], s);
    assert.equal(s.step, at + 2);
    s = play(['chmod 644 backup.sh'], s);
    assert.equal(s.step, at + 2, 'no execute bit yet');
    s = play(['chmod 755 backup.sh', './backup.sh'], s);
    assert.equal(s.step, at + 4);
});

test('mission 8: sudo ls /root, and the owner really changes', () => {
    const base = through(7);
    const at = base.step;
    const s = play(['whoami', 'sudo whoami', 'ls /root', 'sudo ls /root', 'sudo chown root ~/notes.txt'], base);
    assert.equal(s.step, at + 5);
    assert.equal(play(['echo x >> ~/notes.txt'], s).lines.at(-2).text.includes('Permission denied'), true);
});

test('mission 9: the polite kill leaves the process, and Ctrl+C finishes the last stage', () => {
    const base = through(8);
    const at = base.step;
    let s = play(['ps aux', 'ps aux | grep node', 'kill 2301'], base);
    assert.equal(s.step, at + 3);
    s = play(['kill -9 2301'], s);
    assert.equal(s.step, at + 4);
    s = Session.applyCommand(s, 'tail -f /var/log/nginx/error.log');
    assert.equal(s.step, at + 4, 'starting tail -f is not enough, you must leave it');
    s = Session.stopRunning(s);
    assert.equal(s.step, at + 5);
    assert.match(s.lines.filter((l) => l.kind === 'welcome').pop().text, /mission ১০/);
});

test('mission 9: sleep and Ctrl+C is not the same as tail -f', () => {
    const base = through(8);
    let s = play(['ps aux', 'ps aux | grep node', 'kill 2301', 'kill -9 2301'], base);
    const at = s.step;
    s = Session.stopRunning(Session.applyCommand(s, 'sleep 100'));
    assert.equal(s.step, at);
});

test('mission 11: any variable and any alias name work', () => {
    const base = through(10);
    const at = base.step;
    let s = play(['echo $PATH', 'export COLOR=blue', 'echo "my color is $COLOR"', 'alias l="ls -l"', 'l'], base);
    assert.equal(s.step, at + 5);
    s = play(['echo $PATH', 'export HOME=/tmp'], base);
    assert.equal(s.step, at + 1, 'changing HOME is not a new variable');
});

test('undo goes back a step, and the step comes back when you redo the command', () => {
    let s = play(['pwd', 'ls']);
    assert.equal(s.step, 2);
    s = Session.undo(play(['cd projects/my-site'], s));
    assert.equal(s.step, 2);
    s = play(['cd projects/my-site'], s);
    assert.equal(s.step, 3);
});

test('progress survives save and load, including the step history for undo', () => {
    const s = play(['pwd', 'ls', 'cd projects/my-site', 'cd ..']);
    assert.equal(s.step, 4);
    const loaded = Storage.parse(Storage.serialize(s)).session;
    assert.equal(loaded.step, 4);
    assert.equal(Session.undo(loaded).step, 3);
});

test('view: current mission, stage states and the list', () => {
    const v = Missions.view(2);
    assert.equal(v.number, 1);
    assert.equal(v.count, 11);
    assert.deepEqual(v.stages.map((x) => [x.done, x.current]), [[true, false], [true, false], [false, true], [false, false], [false, false]]);
    assert.equal(v.doneSteps, 2);
    assert.equal(v.totalSteps, 50);
    assert.deepEqual(v.all.slice(0, 2).map((x) => [x.done, x.current]), [[false, true], [false, false]]);
    const next = Missions.view(5);
    assert.equal(next.title, 'নতুন প্রজেক্ট');
    assert.equal(next.all[0].done, true);
    const end = Missions.view(50);
    assert.equal(end.finished, true);
    assert.equal(end.stages.length, 0);
    assert.ok(Missions.view(9999).finished);
});

test('the seed has what the missions rely on', () => {
    const state = Seed.createState();
    ['/home/dev/notes.txt', '/home/dev/downloads/photo1.jpg', '/home/dev/downloads/photo2.jpg', '/home/dev/downloads/report.pdf', '/home/dev/downloads/resume.pdf', '/home/dev/downloads/old-notes.txt', '/home/dev/scripts/backup.sh', '/var/log/nginx/access.log', '/var/log/nginx/error.log', '/home/dev/projects/my-site/app.js'].forEach((p) => assert.ok(exists(state, p), p));
    assert.ok(state.processes.some((p) => p.pid === 2301 && p.stubborn));
    assert.ok(read(state, '/home/dev/projects/my-site/app.js').includes('console'));
});
