import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Session } from './helpers.mjs';

const dir = new URL('../data/learn/', import.meta.url).pathname;
const lessons = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const text = readFileSync(join(dir, file), 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    assert.ok(m, `${file}: front matter missing`);
    const meta = Object.fromEntries(m[1].split('\n').map((l) => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }));
    const blocks = [...m[2].matchAll(/```terminal\n([\s\S]*?)```/g)].map((b) => b[1].split('\n').filter((l) => l.startsWith('$ ')).map((l) => l.slice(2)));
    return { file, meta, body: m[2], blocks };
});

test('there are sixteen lessons, ordered 1 to 16 with no gaps', () => {
    assert.equal(lessons.length, 16);
    const orders = lessons.map((l) => Number(l.meta.order)).sort((a, b) => a - b);
    assert.deepEqual(orders, Array.from({ length: 16 }, (_, i) => i + 1));
});

test('every lesson has a title, a summary and at least one terminal box', () => {
    for (const l of lessons) {
        assert.ok(l.meta.title, `${l.file}: title`);
        assert.ok(l.meta.summary, `${l.file}: summary`);
        assert.ok(l.blocks.length >= 1, `${l.file}: no terminal box`);
        assert.ok(l.blocks.every((b) => b.length >= 1), `${l.file}: an empty terminal box`);
    }
});

// পাঠের পেজ যেভাবে বাক্স বানায়, সেভাবেই নতুন session-এ চালানো
test('every command in a terminal box runs; one that fails must say why in a # comment', () => {
    for (const l of lessons) {
        l.blocks.forEach((commands, bi) => {
            let s = Session.freshSession();
            for (const command of commands) {
                s = Session.applyCommand(s, command);
                const where = `${l.file} box ${bi + 1}: ${command}`;
                assert.equal(s.running, null, `${where} keeps running`);
                assert.notEqual(s.last.code, 127, `${where} is not a known command`);
                if (s.last.code !== 0) assert.ok(command.includes('#'), `${where} failed (${s.last.stderr.trim()}) without a comment`);
            }
        });
    }
});

test('lesson text uses no real-looking personal data', () => {
    for (const l of lessons) {
        assert.doesNotMatch(l.body, /\b01[3-9]\d{8}\b/, `${l.file}: phone number`);
        const ips = l.body.match(/\b\d{1,3}(\.\d{1,3}){3}\b/g) || [];
        for (const ip of ips) assert.match(ip, /^(192\.0\.2|198\.51\.100|203\.0\.113|127\.0\.)/, `${l.file}: ${ip}`);
    }
});
