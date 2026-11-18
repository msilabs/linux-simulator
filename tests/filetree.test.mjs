import test from 'node:test';
import assert from 'node:assert/strict';
import { runAll, Seed } from './helpers.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FileTree = require('../global/33-filetree.js');

test('expandedFor opens every folder down to the current one', () => {
    assert.deepEqual(FileTree.expandedFor('/home/dev/projects'), { '/': true, '/home': true, '/home/dev': true, '/home/dev/projects': true });
    assert.deepEqual(FileTree.expandedFor('/'), { '/': true });
});

test('rows: folders open only where expanded, sorted, with depth and mode', () => {
    const state = Seed.createState();
    const list = FileTree.rows(state, { expanded: FileTree.expandedFor(state.cwd) });
    assert.deepEqual(list.slice(0, 4).map((r) => r.path), ['/', '/etc', '/home', '/home/dev']);
    const dev = list.filter((r) => r.depth === 3).map((r) => r.name);
    assert.deepEqual(dev, ['.bashrc', 'downloads', 'notes.txt', 'projects', 'scripts']);
    const notes = list.find((r) => r.name === 'notes.txt');
    assert.equal(notes.mode, '-rw-r--r--');
    assert.equal(notes.owner, 'dev');
    assert.equal(notes.kind, 'file');
    assert.equal(list.find((r) => r.name === 'projects').open, false);
    assert.equal(list.find((r) => r.name === 'dev').open, true);
});

test('rows: a folder you cannot read is locked and stays closed', () => {
    const state = Seed.createState();
    const list = FileTree.rows(state, { expanded: { '/': true, '/root': true } });
    const root = list.find((r) => r.path === '/root');
    assert.equal(root.locked, true);
    assert.equal(root.open, false);
    assert.ok(!list.some((r) => r.path.startsWith('/root/')));
});

test('rows: hidden files can be left out', () => {
    const state = Seed.createState();
    const list = FileTree.rows(state, { expanded: FileTree.expandedFor(state.cwd), showHidden: false });
    assert.ok(!list.some((r) => r.name === '.bashrc'));
});

test('rows: links show their target', () => {
    const { state } = runAll(['ln -s projects site']);
    const link = FileTree.rows(state, { expanded: FileTree.expandedFor(state.cwd) }).find((r) => r.name === 'site');
    assert.equal(link.kind, 'link');
    assert.equal(link.target, 'projects');
});

test('diff: new, changed and removed paths', () => {
    const before = Seed.createState();
    const { state: after } = runAll(['mkdir a', 'touch a/f', 'rm notes.txt', 'chmod 600 .bashrc', 'echo hi > scripts/backup.sh']);
    const d = FileTree.diff(before.fs, after.fs);
    assert.deepEqual(d.added.sort(), ['/home/dev/a', '/home/dev/a/f']);
    assert.deepEqual(d.removed, ['/home/dev/notes.txt']);
    assert.ok(d.changed.includes('/home/dev/.bashrc'));
    assert.ok(d.changed.includes('/home/dev/scripts/backup.sh'));
    assert.ok(!d.changed.includes('/home/dev/projects'));
});

test('diff: a removed folder reports everything inside it', () => {
    const before = Seed.createState();
    const { state: after } = runAll(['rm -r projects']);
    const d = FileTree.diff(before.fs, after.fs);
    assert.deepEqual(d.removed.sort(), ['/home/dev/projects', '/home/dev/projects/my-site', '/home/dev/projects/my-site/app.js', '/home/dev/projects/my-site/index.html', '/home/dev/projects/my-site/style.css']);
});

test('diff: nothing changed means nothing reported, and it is fast on same object', () => {
    const state = Seed.createState();
    assert.deepEqual(FileTree.diff(state.fs, state.fs), { added: [], changed: [], removed: [] });
    const { state: after } = runAll(['cd projects', 'pwd']);
    assert.deepEqual(FileTree.diff(state.fs, after.fs), { added: [], changed: [], removed: [] });
});
