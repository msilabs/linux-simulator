import test from 'node:test';
import assert from 'node:assert/strict';
import { Path, Fs, Seed, dev } from './helpers.mjs';

test('path: normalize handles ., .., repeated and trailing slashes', () => {
    assert.equal(Path.normalize('/a/./b/../c//'), '/a/c');
    assert.equal(Path.normalize('/..'), '/');
    assert.equal(Path.normalize('/a/b/../../..'), '/');
});

test('path: resolve handles ~, relative and absolute paths', () => {
    assert.equal(Path.resolve('/home/dev', '~', '/home/dev'), '/home/dev');
    assert.equal(Path.resolve('/tmp', '~/notes.txt', '/home/dev'), '/home/dev/notes.txt');
    assert.equal(Path.resolve('/home/dev', '../x', '/home/dev'), '/home/x');
    assert.equal(Path.resolve('/home/dev', '/etc/hosts', '/home/dev'), '/etc/hosts');
    assert.equal(Path.resolve('/', '..', '/home/dev'), '/');
});

test('path: dirname, basename, shorten', () => {
    assert.equal(Path.dirname('/a/b'), '/a');
    assert.equal(Path.dirname('/a'), '/');
    assert.equal(Path.basename('/a/b.txt'), 'b.txt');
    assert.equal(Path.shorten('/home/dev', '/home/dev'), '~');
    assert.equal(Path.shorten('/home/dev/x', '/home/dev'), '~/x');
    assert.equal(Path.shorten('/home/devil', '/home/dev'), '/home/devil');
});

test('fs: lookup reports ENOENT, ENOTDIR and EACCES', () => {
    const { fs } = Seed.createState();
    assert.ok(Fs.lookup(fs, dev(), '/home/dev/notes.txt').node);
    assert.equal(Fs.lookup(fs, dev(), '/nope').error, 'ENOENT');
    assert.equal(Fs.lookup(fs, dev(), '/home/dev/notes.txt/x').error, 'ENOTDIR');
    assert.equal(Fs.lookup(fs, dev(), '/root/x').error, 'EACCES');
    assert.equal(Fs.lookup(fs, Fs.USERS.root, '/root/x').error, 'ENOENT');
});

test('fs: can() follows owner, group, other and root rules', () => {
    const own = Fs.file('', Fs.meta('dev', 'dev', 0o640, 0));
    assert.ok(Fs.can(own, dev(), 'r'));
    assert.ok(Fs.can(own, dev(), 'w'));
    assert.ok(!Fs.can(own, dev(), 'x'));
    const other = Fs.file('', Fs.meta('root', 'root', 0o640, 0));
    assert.ok(!Fs.can(other, dev(), 'r'));
    assert.ok(Fs.can(other, Fs.USERS.root, 'w'));
    assert.ok(!Fs.can(other, Fs.USERS.root, 'x'));
    const script = Fs.file('', Fs.meta('root', 'root', 0o100, 0));
    assert.ok(Fs.can(script, Fs.USERS.root, 'x'));
    const groupOnly = Fs.file('', Fs.meta('root', 'dev', 0o040, 0));
    assert.ok(Fs.can(groupOnly, dev(), 'r'));
});

test('fs: update never changes the old tree', () => {
    const { fs } = Seed.createState();
    const before = JSON.stringify(fs);
    const next = Fs.update(fs, '/tmp/a.txt', () => Fs.file('hi', Fs.meta('dev', 'dev', 0o644, 1)));
    assert.equal(JSON.stringify(fs), before);
    assert.ok(Fs.lookup(next, dev(), '/tmp/a.txt').node);
    assert.equal(Fs.lookup(fs, dev(), '/tmp/a.txt').error, 'ENOENT');
    const removed = Fs.update(next, '/tmp/a.txt', () => null);
    assert.equal(Fs.lookup(removed, dev(), '/tmp/a.txt').error, 'ENOENT');
});

test('fs: odd names like __proto__ and constructor are plain names', () => {
    const { fs } = Seed.createState();
    const next = Fs.update(fs, '/tmp/__proto__', () => Fs.file('x', Fs.meta('dev', 'dev', 0o644, 0)));
    assert.equal(Fs.lookup(next, dev(), '/tmp/__proto__').node.content, 'x');
    assert.equal(Fs.lookup(next, dev(), '/tmp/constructor').error, 'ENOENT');
    assert.equal(Fs.lookup(fs, dev(), '/tmp/toString').error, 'ENOENT');
});

test('fs: names sort like Ubuntu (case and leading dot ignored)', () => {
    const names = ['b.txt', 'A.txt', '.bashrc', 'a2', 'Zed', 'beta'];
    const sorted = names.slice().sort(Fs.compareNames);
    // '.' বাদ দিয়ে তুলনা: a2 < atxt, bashrc < beta < btxt
    assert.deepEqual(sorted, ['a2', 'A.txt', '.bashrc', 'beta', 'b.txt', 'Zed']);
});

test('fs: modeString and sizeOf', () => {
    assert.equal(Fs.modeString(Fs.file('', Fs.meta('a', 'b', 0o644, 0))), '-rw-r--r--');
    assert.equal(Fs.modeString(Fs.dir(null, Fs.meta('a', 'b', 0o755, 0))), 'drwxr-xr-x');
    assert.equal(Fs.sizeOf(Fs.file('aé', Fs.meta('a', 'b', 0o644, 0))), 3);
    assert.equal(Fs.sizeOf(Fs.dir(null, Fs.meta('a', 'b', 0o755, 0))), 4096);
});

test('seed: starts the same way every time', () => {
    assert.equal(JSON.stringify(Seed.createState()), JSON.stringify(Seed.createState()));
});
