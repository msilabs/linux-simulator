import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, Storage, Complete, Seed, Fs } from './helpers.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

function play(commands, start) {
    return commands.reduce((s, c) => Session.applyCommand(s, c), start || Session.freshSession());
}

test('session: commands add input, output and explanation lines', () => {
    const s = play(['pwd']);
    assert.deepEqual(s.lines.map((l) => l.kind), ['welcome', 'input', 'output', 'explain']);
    assert.equal(s.lines[1].prompt, 'dev@laptop:~$');
    assert.equal(s.lines[2].text, '/home/dev');
});

test('session: errors go to the error kind', () => {
    const s = play(['frob']);
    assert.deepEqual(s.lines.slice(1).map((l) => l.kind), ['input', 'error', 'explain-error']);
});

test('session: only commands that change things are logged', () => {
    const s = play(['ls', 'mkdir a', 'pwd', 'cd a', 'frob', 'cd nope']);
    assert.deepEqual(s.log, ['mkdir a', 'cd a']);
    assert.equal(s.past.length, 2);
});

test('session: undo goes back one change, again and again', () => {
    let s = play(['mkdir a', 'cd a', 'touch f']);
    s = Session.undo(s);
    assert.equal(Fs.lookup(s.state.fs, Fs.USERS.dev, '/home/dev/a/f').error, 'ENOENT');
    s = Session.undo(s);
    assert.equal(s.state.cwd, '/home/dev');
    s = Session.undo(s);
    assert.equal(Fs.lookup(s.state.fs, Fs.USERS.dev, '/home/dev/a').error, 'ENOENT');
    assert.equal(Session.undo(s), s);
});

test('session: history skips repeats; clear empties the screen', () => {
    let s = play(['ls', 'ls', 'pwd']);
    assert.deepEqual(s.history, ['ls', 'pwd']);
    s = Session.applyCommand(s, 'clear');
    assert.deepEqual(s.lines, []);
    assert.deepEqual(s.history, ['ls', 'pwd', 'clear']);
});

test('session: the history command lists past commands', () => {
    const s = play(['ls', 'pwd', 'history']);
    const out = s.lines.filter((l) => l.kind === 'output').pop().text;
    assert.equal(out, '    1  ls\n    2  pwd\n    3  history');
});

test('session: replay gives the same state as playing live', () => {
    const live = play(['mkdir -p a/b', 'cd a', 'touch x', 'cp x b', 'mv x y', 'cd b']);
    const again = Session.replay(live.base, live.log);
    assert.equal(JSON.stringify(again.state), JSON.stringify(live.state));
    assert.deepEqual(again.log, live.log);
});

test('session: a long log is compacted and undo still works', () => {
    let s = Session.freshSession();
    for (let i = 0; i < Session.MAX_LOG + 5; i++) s = Session.applyCommand(s, 'mkdir d' + i);
    assert.ok(s.log.length <= Session.MAX_LOG);
    assert.ok(s.log.length >= Session.KEEP_LOG);
    const names = Object.keys(Fs.lookup(s.state.fs, Fs.USERS.dev, '/home/dev').node.children);
    assert.ok(names.includes('d0') && names.includes('d' + (Session.MAX_LOG + 4)));
    const back = Session.undo(s);
    assert.equal(Fs.lookup(back.state.fs, Fs.USERS.dev, '/home/dev/d' + (Session.MAX_LOG + 4)).error, 'ENOENT');
    const replayed = Session.replay(s.base, s.log);
    assert.equal(JSON.stringify(replayed.state), JSON.stringify(s.state));
});

test('session: Ctrl+C keeps the typed text with ^C and runs nothing', () => {
    const s = Session.interrupt(Session.freshSession(), 'ls -l');
    assert.equal(s.lines[s.lines.length - 1].text, 'ls -l^C');
    assert.equal(s.log.length, 0);
});

test('storage: save and load give back the same session', () => {
    const live = play(['mkdir -p a/b', 'cd a', 'touch x', 'ls']);
    const loaded = Storage.parse(Storage.serialize(live));
    assert.equal(loaded.status, 'ok');
    const s = loaded.session;
    assert.equal(JSON.stringify(s.state), JSON.stringify(live.state));
    assert.deepEqual(s.log, live.log);
    assert.deepEqual(s.history, live.history);
    assert.equal(s.past.length, live.past.length);
    assert.equal(Session.undo(s).state.cwd, '/home/dev/a');
    const next = Session.applyCommand(s, 'pwd');
    assert.equal(next.lines[next.lines.length - 2].text, '/home/dev/a');
    assert.ok(next.lines[next.lines.length - 1].id > s.lines[s.lines.length - 1].id);
});

test('storage: empty, broken and tampered saves are handled', () => {
    assert.equal(Storage.parse(null).status, 'empty');
    assert.equal(Storage.parse('{nope').status, 'corrupt');
    assert.equal(Storage.parse('{"v":2}').status, 'corrupt');
    const good = JSON.parse(Storage.serialize(play(['ls'])));
    const tamper = (fn) => { const copy = JSON.parse(JSON.stringify(good)); fn(copy); return Storage.parse(JSON.stringify(copy)).status; };
    assert.equal(tamper((d) => { d.base.cwd = 'relative'; }), 'corrupt');
    assert.equal(tamper((d) => { d.base.user = 'hacker'; }), 'corrupt');
    assert.equal(tamper((d) => { d.base.fs.kind = 'file'; }), 'corrupt');
    assert.equal(tamper((d) => { d.base.fs.children.home.meta.mode = 'rwx'; }), 'corrupt');
    assert.equal(tamper((d) => { d.base.fs.children.home.children['a/b'] = { kind: 'file', content: '', meta: { owner: 'dev', group: 'dev', mode: 420, mtime: 0 } }; }), 'corrupt');
    assert.equal(tamper((d) => { d.lines = [{ id: 1, kind: 'weird', text: 'x' }]; }), 'corrupt');
    assert.equal(tamper((d) => { d.log = [1, 2]; }), 'corrupt');
    assert.equal(tamper(() => {}), 'ok');
});

test('complete: command names and paths', () => {
    const state = Seed.createState();
    assert.deepEqual(Complete.complete(state, 'mk'), { text: 'mkdir ', candidates: ['mkdir'] });
    assert.deepEqual(Complete.complete(state, 'cd pro'), { text: 'cd projects/', candidates: ['projects/'] });
    assert.equal(Complete.complete(state, 'cat n').text, 'cat notes.txt ');
    assert.deepEqual(Complete.complete(state, 'ls d').candidates, ['downloads/']);
    assert.equal(Complete.complete(state, 'ls downloads/ph').text, 'ls downloads/photo');
    assert.deepEqual(Complete.complete(state, 'ls downloads/photo').candidates, ['downloads/photo1.jpg', 'downloads/photo2.jpg']);
    assert.deepEqual(Complete.complete(state, 'ls .b').candidates, ['.bashrc']);
    assert.deepEqual(Complete.complete(state, 'ls zzz'), { text: 'ls zzz', candidates: [] });
    assert.ok(!Complete.complete(state, 'ls ').candidates.includes('.bashrc'));
});

// Alo সব global/*.js নামের ক্রমে একটা ফাইলে জোড়ে, Node-এর require ছাড়া। সেভাবে চালিয়ে দেখা:
// কোনো ফাইল পরে লোড হওয়া ফাইলের উপর load-এর সময়েই নির্ভর করলে এখানে ধরা পড়ে।
function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...jsFiles(path));
        else if (name.endsWith('.js')) out.push(path);
    }
    return out;
}

test('browser: all files load in Alo order without require, and a session runs', () => {
    const root = new URL('..', import.meta.url).pathname;
    const files = jsFiles(join(root, 'global')).filter((f) => !f.endsWith('90-app.js'))
        .sort((a, b) => (a.slice(root.length) < b.slice(root.length) ? -1 : 1));
    const sandbox = { console };
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    for (const file of files) vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
    let s = sandbox.LinuxSession.freshSession();
    s = sandbox.LinuxSession.applyCommand(s, 'mkdir a');
    s = sandbox.LinuxSession.applyCommand(s, 'ls');
    assert.equal(s.lines.find((l) => l.kind === 'output').text, 'a  downloads  notes.txt  projects  scripts');
    assert.equal(sandbox.LinuxStorage.parse(sandbox.LinuxStorage.serialize(s)).status, 'ok');
});
