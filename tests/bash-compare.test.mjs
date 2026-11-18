// একই command আসল bash আর GNU tool-এ চালিয়ে simulator-এর সাথে stdout আর exit code মেলানো।
// শুধু Linux-এ চলে (macOS-এর BSD tool-এর output আলাদা), তাই CI-তে ubuntu-latest-এ। অন্য জায়গায় skip।
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Fs, Seed, Shell } from './helpers.mjs';

const onLinux = process.platform === 'linux' && spawnSync('bash', ['--version']).status === 0;
const locales = onLinux ? spawnSync('locale', ['-a'], { encoding: 'utf8' }).stdout || '' : '';
const hasEnglishLocale = /en_US\.utf-?8/i.test(locales);
const LOCALE = hasEnglishLocale ? 'en_US.UTF-8' : 'C.UTF-8';

const FIXTURE = {
    'a.txt': ['apple\nbanana\ncherry\napple\n', 0o644],
    'b.txt': ['one two three\nfour five\n', 0o644],
    'nums.txt': ['10\n9\n100\n2\n', 0o644],
    'words.txt': ['Banana\napple\nCherry\nbanana\n', 0o644],
    'empty.txt': ['', 0o644],
    '.hidden': ['secret\n', 0o644],
    'script.sh': ['#!/bin/bash\necho script ran\n', 0o755],
    'dir1/c.txt': ['hello world\n', 0o644],
    'dir1/d.md': ['# title\nbody line\n', 0o644],
    'dir1/sub/e.txt': ['deep file\n', 0o644]
};

// সাজানোর নিয়ম locale-এর উপর নির্ভর করে, তাই en_US না থাকলে এগুলো বাদ
const CASES = [
    ['ls'], ['ls -a'], ['ls -1'], ['ls dir1'], ['ls -R dir1'], ['ls -a dir1'], ['ls nope'], ['ls a.txt b.txt'],
    ['cat a.txt'], ['cat -n a.txt'], ['cat a.txt b.txt'], ['cat dir1'], ['cat nope'], ['cat empty.txt'],
    ['head -n 2 a.txt'], ['head -2 a.txt'], ['tail -n 2 a.txt'], ['head -n 1 a.txt b.txt'], ['tail -n +2 a.txt'], ['head -n -1 a.txt'],
    ['wc a.txt'], ['wc -l a.txt b.txt'], ['wc -w b.txt'], ['wc -c a.txt'], ['echo hi | wc'], ['cat a.txt | wc -l'], ['wc -l < a.txt'],
    ['sort a.txt'], ['sort -r a.txt'], ['sort -u a.txt'], ['sort -n nums.txt'], ['sort -nr nums.txt'], ['sort words.txt'],
    ['sort a.txt | uniq'], ['sort a.txt | uniq -c'], ['sort a.txt | uniq -d'], ['sort a.txt | uniq -u'],
    ['grep apple a.txt'], ['grep -c apple a.txt'], ['grep -n an a.txt'], ['grep -v apple a.txt'], ['grep -i BANANA a.txt'],
    ['grep -l apple a.txt b.txt'], ['grep -o an a.txt'], ['grep -w one b.txt'], ['grep -E "a(p|n)+" a.txt'], ['grep "a.p" a.txt'],
    ['grep -r hello dir1'], ['grep zzz a.txt'], ['grep -c zzz a.txt'], ['grep apple a.txt b.txt'], ['grep nope-pattern nofile'],
    ["cut -d' ' -f1 b.txt"], ["cut -d' ' -f2- b.txt"], ['cut -c1-3 a.txt'], ["cut -d' ' -f1,3 b.txt"], ['cut -d: -f1 /etc/passwd | head -n 1'],
    ['find . -name "*.txt" | sort'], ['find dir1 -type f | sort'], ['find dir1 -type d | sort'], ['find . -maxdepth 1 -name "*.md"'], ['find dir1 -name "*.MD"'], ['find dir1 -iname "*.MD"'],
    ['echo hello world'], ['echo -n hi'], ['echo -e "a\\tb"'], ['echo a*'], ['echo dir1/*'], ['echo "a*"'], ['echo *.nomatch'], ['echo a.txt b?txt'],
    ['mkdir -p x/y && ls x'], ['touch t && ls'], ['cp a.txt c.txt && cat c.txt'], ['mv a.txt z.txt && ls'], ['rm a.txt && ls'], ['rm nope'], ['rm -f nope'], ['rm dir1'],
    ['rmdir dir1'], ['rmdir empty.txt'], ['mkdir dir1'], ['cd dir1 && ls'], ['cd nope'], ['cp nope x'], ['cp dir1 x'], ['mv nope x'],
    ['echo x > f && cat f'], ['echo a >> f && echo b >> f && cat f'], ['cat a.txt > out && wc -l < out'], ['ls nope 2> err; cat err'], ['ls nope > both 2>&1; cat both'],
    ['true && echo yes'], ['false || echo no'], ['false && echo x; echo y'], ['true || echo x'], ['ls nope; echo $?'], ['grep zzz a.txt; echo $?'],
    ['cat a.txt | sort | uniq -c | sort -rn'], ['grep an a.txt | wc -l'], ['cat nums.txt | sort -n | head -n 2'], ['cat a.txt | grep apple | wc -l'],
    ['X=5; echo $X'], ['export Y=2; echo "$Y"'], ['echo "[$NOPE]"'], ['echo ${X}y'],
    ['./script.sh'], ['./nope.sh'], ['frob'], ['echo "unclosed'], ['ls |'], ['chmod +x a.txt && ./a.txt'], ['chmod 000 a.txt; cat a.txt']
];

const ORDER_SENSITIVE = /^(sort words\.txt|ls -a|ls -R dir1|ls -a dir1)$/;

function makeReal(root) {
    Object.entries(FIXTURE).forEach(([path, [content, mode]]) => {
        const abs = join(root, path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content);
        chmodSync(abs, mode);
    });
}

function makeSimulated() {
    const base = Seed.createState();
    const meta = (mode) => Fs.meta('dev', 'dev', mode, 0);
    let fs = Fs.update(base.fs, '/work', () => Fs.dir(null, meta(0o755)));
    Object.entries(FIXTURE).forEach(([path, [content, mode]]) => {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
            const dir = '/work/' + parts.slice(0, i).join('/');
            if (Fs.lookup(fs, Fs.USERS.root, dir).error) fs = Fs.update(fs, dir, () => Fs.dir(null, meta(0o755)));
        }
        fs = Fs.update(fs, '/work/' + path, () => Fs.file(content, meta(mode)));
    });
    return { ...base, fs, cwd: '/work', env: { ...base.env, HOME: '/work', PWD: '/work' } };
}

// quote-এর ধরন (‘x’ আর 'x') আর "line 1:" bash-এর ভেতরের খুঁটিনাটি, শিক্ষার্থীর কাছে অর্থহীন
function tidy(text) {
    return text.replace(/[‘’]/g, "'").replace(/^bash: line \d+: /gm, 'bash: ');
}

const skip = onLinux ? false : 'শুধু Linux-এ চলে (GNU tool লাগে)';

// bash -c-এর নিজের syntax error বার্তা ("line 2: unexpected end of file") আর interactive বার্তা আলাদা, তাই শুধু stdout আর exit code
const STDOUT_ONLY = /^(echo "unclosed|ls \|)$/;

for (const [script] of CASES) {
    const needsLocale = ORDER_SENSITIVE.test(script);
    test('same as bash: ' + script, { skip: skip || (needsLocale && !hasEnglishLocale ? 'en_US.UTF-8 locale নেই' : false) }, () => {
        const root = mkdtempSync(join(tmpdir(), 'lsim-compare-'));
        try {
            makeReal(root);
            const real = spawnSync('bash', ['-c', script], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, LC_ALL: LOCALE, HOME: root } });
            const sim = Shell.run(makeSimulated(), script, { tty: false });
            assert.equal(sim.stdout, real.stdout, 'stdout\n');
            if (!STDOUT_ONLY.test(script)) assert.equal(tidy(sim.stderr), tidy(real.stderr), 'stderr\n');
            assert.equal(sim.code, real.status, 'exit code\n');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}
