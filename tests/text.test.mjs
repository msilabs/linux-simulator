import test from 'node:test';
import assert from 'node:assert/strict';
import { runAll, last, read, exists, Seed, Shell } from './helpers.mjs';

const ERROR_LOG = '/var/log/nginx/error.log';
const ACCESS_LOG = '/var/log/nginx/access.log';
const seed = Seed.createState();
const errorLines = read(seed, ERROR_LOG).split('\n').filter(Boolean);
const accessLines = read(seed, ACCESS_LOG).split('\n').filter(Boolean);

test('seed logs have what the missions need', () => {
    assert.ok(errorLines.filter((l) => l.includes('[ERROR]')).length >= 5);
    assert.ok(errorLines.filter((l) => l.includes('[WARN]')).length >= 5);
    assert.ok(accessLines.filter((l) => l.includes('" 404 ')).length >= 5);
    assert.ok(accessLines.filter((l) => l.includes('" 500 ')).length >= 3);
});

test('head and tail: default, -n, -N, +N, several files', () => {
    assert.equal(last(['head -n 2 ' + ERROR_LOG]).stdout, errorLines.slice(0, 2).join('\n') + '\n');
    assert.equal(last(['head -3 ' + ERROR_LOG]).stdout, errorLines.slice(0, 3).join('\n') + '\n');
    assert.equal(last(['head ' + ERROR_LOG]).stdout, errorLines.slice(0, 10).join('\n') + '\n');
    assert.equal(last(['tail -n 2 ' + ERROR_LOG]).stdout, errorLines.slice(-2).join('\n') + '\n');
    assert.equal(last(['tail -n +29 ' + ERROR_LOG]).stdout, errorLines.slice(28).join('\n') + '\n');
    assert.equal(last(['head -n -28 ' + ERROR_LOG]).stdout, errorLines.slice(0, 2).join('\n') + '\n');
    assert.equal(last(['head -n 0 ' + ERROR_LOG]).stdout, '');
    const both = last(['head -n 1 notes.txt .bashrc']).stdout;
    assert.ok(both.startsWith('==> notes.txt <==\n') && both.includes('\n==> .bashrc <==\n'));
});

test('head and tail: errors', () => {
    assert.equal(last(['head nope']).stderr, "head: cannot open 'nope' for reading: No such file or directory\n");
    assert.equal(last(['tail projects']).stderr, "tail: error reading 'projects': Is a directory\n");
    assert.equal(last(['head -n x notes.txt']).stderr, "head: invalid number of lines: 'x'\n");
    assert.equal(last(['head']).errno, 'EOPERAND');
});

test('wc: lines, words, bytes; one or many files; stdin width', () => {
    assert.equal(last(['wc -l ' + ERROR_LOG]).stdout, errorLines.length + ' ' + ERROR_LOG + '\n');
    assert.equal(last(['wc -l < ' + ERROR_LOG]).stdout, errorLines.length + '\n');
    assert.equal(last(['echo hello world | wc']).stdout, '      1       2      12\n');
    assert.equal(last(['echo hello world | wc -w']).stdout, '2\n');
    const many = last(['wc -l notes.txt .bashrc']).stdout.split('\n');
    assert.equal(many.length, 4);
    assert.match(many[2], / total$/);
    assert.equal(last(['wc nope']).stderr, 'wc: nope: No such file or directory\n');
    assert.equal(last(['echo é | wc -c']).stdout, '3\n');
    assert.equal(last(['echo é | wc -m']).stdout, '2\n');
});

test('grep: plain, -i, -n, -v, -c, -l, -o, -w, -E, -F', () => {
    const errors = errorLines.filter((l) => l.includes('ERROR'));
    assert.equal(last(['grep ERROR ' + ERROR_LOG]).stdout, errors.join('\n') + '\n');
    assert.equal(last(['grep -c ERROR ' + ERROR_LOG]).stdout, errors.length + '\n');
    assert.equal(last(['grep -ci error ' + ERROR_LOG]).stdout, errors.length + '\n');
    assert.equal(last(['grep -vc ERROR ' + ERROR_LOG]).stdout, errorLines.length - errors.length + '\n');
    const numbered = last(['grep -n ERROR ' + ERROR_LOG]).stdout.split('\n')[0];
    assert.match(numbered, /^\d+:2026-11-18 .* \[ERROR\] /);
    assert.equal(last(['grep -l ERROR ' + ERROR_LOG + ' notes.txt']).stdout, ERROR_LOG + '\n');
    assert.equal(last(['echo "a1 b22 c333" | grep -o "[0-9]*"']).stdout, '1\n22\n333\n');
    assert.equal(last(['echo "cat concat" | grep -ow cat']).stdout, 'cat\n');
    assert.equal(last(['echo "a+b" | grep "a+b"']).stdout, 'a+b\n');
    assert.equal(last(['echo "aab" | grep -E "a+b"']).stdout, 'aab\n');
    assert.equal(last(['echo "aab" | grep "a\\+b"']).stdout, 'aab\n');
    assert.equal(last(['echo "a.b" | grep -F "a.b"']).stdout, 'a.b\n');
    assert.equal(last(['echo "axb" | grep -F "a.b"']).code, 1);
    assert.equal(last(['echo "x1" | grep "[[:digit:]]"']).stdout, 'x1\n');
});

test('grep: exit codes and errors', () => {
    assert.equal(last(['grep zzz notes.txt']).code, 1);
    assert.equal(last(['grep zzz notes.txt']).errno, 'ENOMATCH');
    assert.equal(last(['grep Linux notes.txt']).code, 0);
    assert.equal(last(['grep x nope']).stderr, 'grep: nope: No such file or directory\n');
    assert.equal(last(['grep x nope']).code, 2);
    assert.equal(last(['grep x projects']).stderr, 'grep: projects: Is a directory\n');
    assert.equal(last(['grep "[a" notes.txt']).code, 2);
    assert.equal(last(['grep']).code, 2);
});

test('grep -r: folders, labels and the no-operand form', () => {
    assert.equal(last(['grep -rn console projects']).stdout, 'projects/my-site/app.js:1:console.log("সাইট চালু হয়েছে");\n');
    const noOperand = last(['cd projects', 'grep -r console']).stdout;
    assert.equal(noOperand, 'my-site/app.js:console.log("সাইট চালু হয়েছে");\n');
    assert.equal(last(['grep -r nothing-here projects']).code, 1);
    const two = last(['grep Linux notes.txt .bashrc']).stdout;
    assert.ok(two.startsWith('notes.txt:Linux'));
});

test('find: names, types, depth, errors', () => {
    assert.equal(last(['find . -name "*.js"']).stdout, './projects/my-site/app.js\n');
    assert.equal(last(['find projects -type f']).stdout, 'projects/my-site/app.js\nprojects/my-site/index.html\nprojects/my-site/style.css\n');
    assert.equal(last(['find projects -type d']).stdout, 'projects\nprojects/my-site\n');
    assert.equal(last(['find /var/log -name "*.LOG"']).stdout, '');
    assert.equal(last(['find /var/log -iname "*.LOG"']).stdout, '/var/log/nginx/access.log\n/var/log/nginx/error.log\n');
    assert.equal(last(['find projects -maxdepth 1']).stdout, 'projects\nprojects/my-site\n');
    assert.equal(last(['find notes.txt']).stdout, 'notes.txt\n');
    assert.equal(last(['find nope']).stderr, 'find: ‘nope’: No such file or directory\n');
    assert.equal(last(['find /root -name x']).stderr, 'find: ‘/root’: Permission denied\n');
    assert.match(last(['find . -foo']).stderr, /unknown predicate/);
    assert.equal(last(['find . -name "photo?.jpg" -type f']).stdout, './downloads/photo1.jpg\n./downloads/photo2.jpg\n');
});

test('sort: text, -r, -n, -u, -k, -t', () => {
    const lines = (text) => text.split('\n').filter(Boolean);
    assert.deepEqual(lines(last(['echo -e "b\\na\\nC" | sort']).stdout), ['a', 'b', 'C']);
    assert.deepEqual(lines(last(['echo -e "b\\na\\nC" | sort -r']).stdout), ['C', 'b', 'a']);
    assert.deepEqual(lines(last(['echo -e "10\\n9\\n100" | sort']).stdout), ['10', '100', '9']);
    assert.deepEqual(lines(last(['echo -e "10\\n9\\n100" | sort -n']).stdout), ['9', '10', '100']);
    assert.deepEqual(lines(last(['echo -e "10\\n9\\n100" | sort -nr']).stdout), ['100', '10', '9']);
    assert.deepEqual(lines(last(['echo -e "a\\nb\\na" | sort -u']).stdout), ['a', 'b']);
    assert.deepEqual(lines(last(['echo -e "x 3\\ny 1\\nz 2" | sort -k2 -n']).stdout), ['y 1', 'z 2', 'x 3']);
    assert.deepEqual(lines(last(['echo -e "a:3\\nb:1" | sort -t: -k2 -n']).stdout), ['b:1', 'a:3']);
    assert.equal(last(['sort nope']).stderr, 'sort: cannot read: nope: No such file or directory\n');
});

test('uniq: adjacent only, -c, -d, -u', () => {
    const lines = (text) => text.split('\n').filter(Boolean);
    assert.deepEqual(lines(last(['echo -e "a\\na\\nb\\na" | uniq']).stdout), ['a', 'b', 'a']);
    assert.equal(last(['echo -e "a\\na\\nb" | uniq -c']).stdout, '      2 a\n      1 b\n');
    assert.deepEqual(lines(last(['echo -e "a\\na\\nb" | uniq -d']).stdout), ['a']);
    assert.deepEqual(lines(last(['echo -e "a\\na\\nb" | uniq -u']).stdout), ['b']);
});

test('cut: fields, delimiter, ranges, characters, -s', () => {
    assert.equal(last(['cut -d: -f1 /etc/passwd']).stdout, 'root\ndev\n');
    assert.equal(last(['cut -d: -f1,3 /etc/passwd']).stdout, 'root:0\ndev:1000\n');
    assert.equal(last(['echo "a,b,c,d" | cut -d, -f2-']).stdout, 'b,c,d\n');
    assert.equal(last(['echo "a,b,c,d" | cut -d, -f-2']).stdout, 'a,b\n');
    assert.equal(last(['echo hello | cut -c1-3']).stdout, 'hel\n');
    assert.equal(last(['echo hello | cut -d, -f1']).stdout, 'hello\n');
    assert.equal(last(['echo hello | cut -s -d, -f1']).stdout, '');
    assert.equal(last(['cut -f1 notes.txt']).code, 0);
    assert.equal(last(['cut notes.txt']).errno, 'EOPERAND');
});

test('less reads like cat', () => {
    assert.equal(last(['less notes.txt']).stdout, read(seed, '/home/dev/notes.txt'));
    assert.equal(last(['less nope']).stderr, 'nope: No such file or directory\n');
});

/* ---------- shell ---------- */

test('redirect >: creates, truncates, and sends nothing to the screen', () => {
    const r = runAll(['echo first > a.txt', 'echo second > a.txt', 'cat a.txt']);
    assert.equal(r.outputs[0].stdout, '');
    assert.equal(r.outputs[2].stdout, 'second\n');
});

test('redirect >>: appends', () => {
    const r = runAll(['echo one > a.txt', 'echo two >> a.txt', 'echo three >> new.txt', 'cat a.txt new.txt']);
    assert.equal(r.outputs[3].stdout, 'one\ntwo\nthree\n');
});

test('redirect <: reads a file as input', () => {
    assert.equal(last(['wc -l < notes.txt']).stdout, '4\n');
    assert.equal(last(['wc -l < nope']).stderr, 'bash: nope: No such file or directory\n');
});

test('redirect 2> and 2>&1', () => {
    const r = runAll(['ls nope 2> err.txt', 'cat err.txt', 'ls nope > both.txt 2>&1', 'cat both.txt', 'ls nope 2> /dev/null']);
    assert.equal(r.outputs[0].stderr, '');
    assert.equal(r.outputs[1].stdout, "ls: cannot access 'nope': No such file or directory\n");
    assert.equal(r.outputs[2].stderr, '');
    assert.equal(r.outputs[3].stdout, "ls: cannot access 'nope': No such file or directory\n");
    assert.equal(r.outputs[4].stderr, '');
    assert.equal(last(['ls nope 2>&1 | wc -l']).stdout, '1\n');
});

test('redirect: an error leaves the command unrun, directories and permissions are refused', () => {
    assert.equal(last(['echo x > /etc/new']).stderr, 'bash: /etc/new: Permission denied\n');
    assert.equal(last(['echo x > /etc/hosts']).stderr, 'bash: /etc/hosts: Permission denied\n');
    assert.equal(last(['echo x > projects']).stderr, 'bash: projects: Is a directory\n');
    assert.equal(last(['echo x > nodir/file']).stderr, 'bash: nodir/file: No such file or directory\n');
    const r = runAll(['echo x > /dev/null', 'ls']);
    assert.ok(!r.outputs[1].stdout.includes('null'));
});

test('redirect: only a redirect creates an empty file', () => {
    const r = runAll(['> empty.txt', 'ls -l empty.txt']);
    assert.ok(exists(r.state, '/home/dev/empty.txt'));
    assert.match(r.outputs[1].stdout, / 0 /);
});

test('pipe: stages pass text along and a stage cannot change the caller', () => {
    const r = runAll(['cat notes.txt | head -n 1', 'cd projects | echo hi', 'pwd']);
    assert.equal(r.outputs[0].stdout, 'Linux শেখার নোট\n');
    assert.equal(r.outputs[2].stdout, '/home/dev\n');
    assert.equal(last(['ls /var/log/nginx | wc -l']).stdout, '2\n');
    assert.equal(last(['cat notes.txt | grep "২" | wc -l']).stdout, '1\n');
    assert.equal(last(['nope | cat']).code, 0);
    assert.equal(last(['cat notes.txt | nope']).code, 127);
});

test('pipe: file changes from a stage stay', () => {
    const r = runAll(['echo hi | cat > out.txt', 'cat out.txt']);
    assert.equal(r.outputs[1].stdout, 'hi\n');
});

test('lists: ; && ||', () => {
    assert.equal(last(['echo a ; echo b']).stdout, 'a\nb\n');
    assert.equal(last(['true && echo yes']).stdout, 'yes\n');
    assert.equal(last(['false && echo yes']).stdout, '');
    assert.equal(last(['false || echo fallback']).stdout, 'fallback\n');
    assert.equal(last(['true || echo fallback']).stdout, '');
    assert.equal(last(['false && echo a || echo b']).stdout, 'b\n');
    assert.equal(last(['true && false || echo c']).stdout, 'c\n');
    assert.equal(last(['ls nope ; echo after']).stdout, 'after\n');
    const chain = runAll(['mkdir w && cd w && touch f && ls']);
    assert.equal(chain.outputs[0].stdout, 'f\n');
    assert.equal(chain.state.cwd, '/home/dev/w');
    assert.equal(last(['ls nope && echo no']).code, 2);
    assert.equal(last(['echo ok && ls nope']).code, 2);
});

test('variables: $VAR, assignment, export, env, unset, $?', () => {
    const r = runAll(['GREETING=hello', 'echo $GREETING world', 'export NAME=Dev', 'echo "Hi $NAME"', 'unset NAME', 'echo "[$NAME]"', 'ls nope', 'echo $?', 'echo ${GREETING}s']);
    assert.equal(r.outputs[1].stdout, 'hello world\n');
    assert.equal(r.outputs[3].stdout, 'Hi Dev\n');
    assert.equal(r.outputs[5].stdout, '[]\n');
    assert.equal(last(['echo $?'], r.state).stdout, '0\n');
    assert.equal(last(['echo $HOME $USER']).stdout, '/home/dev dev\n');
    assert.match(last(['env']).stdout, /^HOME=\/home\/dev\nUSER=dev\n/);
    assert.equal(last(['export 1x=2']).code, 1);
    assert.match(last(['export']).stdout, /declare -x HOME="\/home\/dev"/);
});

test('alias: define, use, list, remove', () => {
    const r = runAll(["alias ll='ls -la'", 'll projects', 'alias', 'alias ll', 'unalias ll', 'll']);
    assert.match(r.outputs[1].stdout, /^total \d+\n/);
    assert.equal(r.outputs[2].stdout, "alias ll='ls -la'\n");
    assert.equal(r.outputs[3].stdout, "alias ll='ls -la'\n");
    assert.equal(r.outputs[5].code, 127);
    assert.equal(last(['alias nope']).stderr, 'bash: alias: nope: not found\n');
    assert.equal(last(['unalias nope']).stderr, 'bash: unalias: nope: not found\n');
    const loop = runAll(['alias a=b', 'alias b=a', 'a']);
    assert.equal(loop.outputs[2].code, 127);
});

test('which and man', () => {
    assert.equal(last(['which ls cat']).stdout, '/usr/bin/ls\n/usr/bin/cat\n');
    assert.equal(last(['which nope']).code, 1);
    assert.equal(last(['which cd']).code, 1);
    const page = last(['man grep']).stdout;
    assert.match(page, /^GREP\(1\)\n\nনাম\n/);
    assert.ok(page.includes('উদাহরণ'));
    assert.equal(last(['man nope']).stderr, 'No manual entry for nope\n');
    assert.equal(last(['man']).code, 1);
});

test('scripts: need x permission, run in a subshell, count their depth', () => {
    const denied = last(['./scripts/backup.sh']);
    assert.equal(denied.stderr, 'bash: ./scripts/backup.sh: Permission denied\n');
    assert.equal(denied.code, 126);
    assert.equal(last(['./nope.sh']).code, 127);
    assert.equal(last(['./projects']).stderr, 'bash: ./projects: Is a directory\n');
});

test('syntax errors and unsupported things leave the state alone', () => {
    const { state } = runAll(['ls']);
    for (const line of ['echo "x', 'a | | b', 'ls >', 'echo $(date)', 'sleep 1 &']) {
        const r = last([line], state);
        assert.notEqual(r.code, 0, line);
        assert.equal(r.state.fs, state.fs, line);
    }
});

test('explanations for pipes, redirects and lists', () => {
    const pipe = last(['cat notes.txt | head -n 2 | wc -l']).explain;
    assert.match(pipe, /pipe/);
    assert.match(pipe, /প্রথমে `cat notes\.txt`/);
    assert.match(pipe, /তারপর `head -n 2` শুরুর ২ লাইন রাখল/);
    assert.match(pipe, /শেষে `wc -l` গুনে জানাল: `2`/);
    assert.match(last(['echo hi > a.txt']).explain, /`a\.txt`-এ লিখেছে/);
    assert.match(last(['echo hi >> a.txt']).explain, /শেষে যোগ/);
    assert.match(last(['ls nope && echo yes']).explain, /`echo yes` চলেনি/);
    assert.match(last(['ls /var/log/nginx 2> /dev/null']).explain, /ফেলে দেওয়া/);
    assert.match(last(['grep zzz notes.txt']).explain, /ভুল নয়/);
    assert.match(last(['./scripts/backup.sh']).explain, /chmod \+x/);
});

test('grep with no match is not shown as a problem on screen', () => {
    const state = Seed.createState();
    const none = Shell.run(state, 'grep zzz notes.txt');
    assert.equal(none.explainError, false);
    assert.equal(Shell.run(state, 'ls nope').explainError, true);
    assert.equal(Shell.run(state, 'ls').explainError, false);
});
