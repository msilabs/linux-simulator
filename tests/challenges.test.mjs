import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, Challenge } from './helpers.mjs';

function play(commands, start) {
    return commands.reduce((s, c) => {
        const next = Session.applyCommand(s, c);
        return next.running ? Session.stopRunning(next) : next;
    }, start);
}

function passes(challenge, commands) {
    return Challenge.check(challenge, play(commands, Challenge.start(challenge))).pass;
}

test('engine: setup runs before the challenge and is not shown on screen', () => {
    const s = Challenge.start({ setup: ['mkdir -p ~/a/b', 'cd ~/a'], checks: [] }, 'স্বাগতম');
    assert.equal(s.state.cwd, '/home/dev/a');
    assert.equal(s.base, s.state);
    assert.deepEqual(s.lines.map((l) => l.kind), ['welcome']);
    assert.equal(s.lines[0].text, 'স্বাগতম');
});

test('engine: an empty check list never passes', () => {
    assert.equal(Challenge.check({ checks: [] }, Challenge.start({ checks: [] })).pass, false);
});

test('engine: cwd, exists, missing', () => {
    const ch = { checks: [{ type: 'cwd', path: '~/projects' }, { type: 'exists', path: '~/projects/x' }, { type: 'missing', path: '~/notes.txt' }] };
    assert.equal(passes(ch, ['cd projects', 'touch x']), false);
    assert.equal(passes(ch, ['cd projects', 'touch x', 'rm ~/notes.txt']), true);
    const result = Challenge.check(ch, play(['cd projects'], Challenge.start(ch)));
    assert.deepEqual(result.results.map((r) => r.pass), [true, false, false]);
    assert.equal(result.results[0].label, 'এখন `~/projects`-এ আছেন');
});

test('engine: content equals and contains', () => {
    const eq = { checks: [{ type: 'content', path: '~/a.txt', equals: 'hi\n' }] };
    const has = { checks: [{ type: 'content', path: '~/a.txt', contains: 'hi' }] };
    assert.equal(passes(eq, ['echo hi > a.txt']), true);
    assert.equal(passes(eq, ['echo hi there > a.txt']), false);
    assert.equal(passes(has, ['echo hi there > a.txt']), true);
    assert.equal(passes(has, ['mkdir a.txt']), false);
});

test('engine: mode and owner', () => {
    const mode = { checks: [{ type: 'mode', path: '~/notes.txt', mode: '600' }] };
    assert.equal(passes(mode, []), false);
    assert.equal(passes(mode, ['chmod 600 notes.txt']), true);
    assert.equal(passes(mode, ['chmod u=rw,go= notes.txt']), true);
    const owner = { checks: [{ type: 'owner', path: '~/notes.txt', owner: 'root' }] };
    assert.equal(passes(owner, ['chown root notes.txt']), false);
    assert.equal(passes(owner, ['sudo chown root notes.txt']), true);
});

test('engine: stdout looks at the last command only, without the final newline', () => {
    const ch = { checks: [{ type: 'stdout', equals: '4' }] };
    assert.equal(passes(ch, ['wc -l < notes.txt']), true);
    assert.equal(passes(ch, ['cat notes.txt | wc -l']), true);
    assert.equal(passes(ch, ['cat notes.txt | wc -l', 'pwd']), false);
    assert.equal(passes(ch, ['cat notes.txt | wc -l', 'clear']), true);
    assert.equal(passes({ checks: [{ type: 'stdout', contains: 'my-site' }] }, ['ls projects']), true);
});

test('engine: noProcess needs the stubborn server to really die', () => {
    const ch = { checks: [{ type: 'noProcess', cmd: 'node server.js' }] };
    assert.equal(passes(ch, ['kill 2301']), false);
    assert.equal(passes(ch, ['kill -9 2301']), true);
});

test('engine: alias and env, with and without a value', () => {
    assert.equal(passes({ checks: [{ type: 'alias', name: 'gs' }] }, ["alias gs='git status'"]), true);
    assert.equal(passes({ checks: [{ type: 'alias', name: 'll', value: 'ls -la' }] }, ["alias ll='ls -l'"]), false);
    assert.equal(passes({ checks: [{ type: 'env', name: 'EDITOR' }] }, ['EDITOR=']), false);
    assert.equal(passes({ checks: [{ type: 'env', name: 'EDITOR', value: 'nano' }] }, ['export EDITOR=nano']), true);
});

test('engine: an unknown check type fails with a message', () => {
    const result = Challenge.check({ checks: [{ type: 'magic' }] }, Challenge.start({ checks: [] }));
    assert.equal(result.pass, false);
    assert.match(result.results[0].label, /magic/);
});

test('engine: undo and Ctrl+C keep the last result sensible', () => {
    let s = play(['pwd'], Challenge.start({ checks: [] }));
    assert.equal(s.last.stdout, '/home/dev\n');
    s = Session.applyCommand(s, 'tail -f /var/log/nginx/error.log');
    s = Session.stopRunning(s);
    assert.equal(s.last.stopped, true);
    s = Session.undo(play(['mkdir a'], s));
    assert.equal(s.last, null);
});
