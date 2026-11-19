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

test('engine: setup can write a file as root, out of reach for dev', () => {
    const ch = { setup: [{ file: '/root/secret.txt', content: 'hidden\n', mode: '600' }], checks: [{ type: 'stdout', contains: 'hidden' }] };
    const s = Challenge.start(ch);
    assert.equal(s.state.user, 'dev');
    assert.equal(passes(ch, ['cat /root/secret.txt']), false);
    assert.equal(passes(ch, ['sudo cat /root/secret.txt']), true);
});

test('engine: stdout notContains', () => {
    const ch = { checks: [{ type: 'stdout', contains: 'app.js' }, { type: 'stdout', notContains: 'console' }] };
    assert.equal(passes(ch, ['grep -rl console projects']), true);
    assert.equal(passes(ch, ['grep -r console projects']), false);
});

/* ---------- data/challenges ---------- */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../data/challenges/', import.meta.url).pathname;
const challenges = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => ({ file, ...JSON.parse(readFileSync(join(dir, file), 'utf8')) }));

test('data: fifteen challenges, easy to hard, with every field', () => {
    assert.equal(challenges.length, 15);
    const levels = ['সহজ', 'মাঝারি', 'কঠিন'];
    let previous = 0;
    for (const c of challenges) {
        for (const key of ['title', 'level', 'task', 'hint', 'solution']) assert.ok(typeof c[key] === 'string' && c[key], `${c.file}: ${key}`);
        assert.ok(Array.isArray(c.setup) && Array.isArray(c.alternatives), `${c.file}: setup/alternatives`);
        assert.ok(Array.isArray(c.checks) && c.checks.length > 0, `${c.file}: checks`);
        c.checks.forEach((k) => assert.ok(Challenge.TYPES.includes(k.type), `${c.file}: unknown check ${k.type}`));
        const level = levels.indexOf(c.level);
        assert.ok(level >= previous, `${c.file}: level "${c.level}" is out of order`);
        previous = level;
    }
});

test('data: no challenge is already solved before you start', () => {
    for (const c of challenges) {
        assert.equal(Challenge.check(c, Challenge.start(c)).pass, false, `${c.file} passes with no commands`);
    }
});

test('data: the solution and every alternative pass', () => {
    for (const c of challenges) {
        for (const answer of [c.solution, ...c.alternatives]) {
            const result = Challenge.check(c, play([answer], Challenge.start(c)));
            assert.ok(result.pass, `${c.file}: "${answer}" fails: ${result.results.filter((r) => !r.pass).map((r) => r.label).join(', ')}`);
        }
    }
});

test('data: common half answers do not pass', () => {
    const byName = Object.fromEntries(challenges.map((c) => [c.file.replace(/^\d+-|\.json$/g, ''), c]));
    const fails = (name, commands) => assert.equal(passes(byName[name], commands), false, `${name}: ${commands.join(' ; ')}`);
    fails('count-notes', ['wc -l notes.txt']);
    fails('photos', ['mkdir ~/pictures', 'cp ~/downloads/*.jpg ~/pictures']);
    fails('clean-tmp', ['rm ~/downloads/*']);
    fails('todo-files', ['grep -r TODO ~/projects']);
    fails('todo-files', ['cat ~/projects/my-site/index.html']);
    fails('run-backup', ['~/scripts/backup.sh']);
    fails('secret-env', ['echo DB_PASSWORD=example > ~/projects/my-site/.env']);
    fails('root-secret', ['cat /root/secret.txt']);
    fails('stuck-server', ['kill 2301']);
    fails('log-detective', ["grep ' 500 ' /var/log/nginx/access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -n 1"]);
});

test('the seed has what the challenges rely on', () => {
    const s = Challenge.start({ checks: [] });
    for (const p of ['/home/dev/notes.txt', '/home/dev/downloads/photo1.jpg', '/home/dev/downloads/photo2.jpg', '/home/dev/scripts/backup.sh', '/var/log/nginx/access.log', '/var/log/nginx/error.log', '/home/dev/projects/my-site/app.js']) {
        assert.equal(passes({ checks: [{ type: 'exists', path: p }] }, []), true, p);
    }
    assert.ok(s.state.processes.some((p) => p.pid === 2301 && p.stubborn));
});
