import test from 'node:test';
import assert from 'node:assert/strict';
import { runAll, last, read, exists, Shell, Seed } from './helpers.mjs';

const ok = (r) => assert.equal(r.code, 0, r.stderr);

test('pwd and cd move around, prompt follows', () => {
    const r = runAll(['pwd', 'cd projects', 'pwd', 'cd ..', 'cd ~/downloads', 'pwd', 'cd', 'pwd', 'cd -', 'pwd']);
    assert.deepEqual(r.outputs.map((o) => o.stdout), ['/home/dev\n', '', '/home/dev/projects\n', '', '', '/home/dev/downloads\n', '', '/home/dev\n', '/home/dev/downloads\n', '/home/dev/downloads\n']);
    assert.equal(Shell.prompt(r.state), 'dev@laptop:~/downloads$');
});

test('cd errors: missing, file, permission, OLDPWD, too many', () => {
    assert.equal(last(['cd nope']).stderr, 'bash: cd: nope: No such file or directory\n');
    assert.equal(last(['cd notes.txt']).stderr, 'bash: cd: notes.txt: Not a directory\n');
    assert.equal(last(['cd /root/x']).errno, 'EACCES');
    assert.equal(last(['cd -']).stderr, 'bash: cd: OLDPWD not set\n');
    assert.equal(last(['cd a b']).stderr, 'bash: cd: too many arguments\n');
});

test('ls: plain, hidden, long, human sizes', () => {
    assert.equal(last(['ls']).stdout, 'downloads  notes.txt  projects  scripts\n');
    assert.equal(last(['ls -a']).stdout, '.  ..  .bashrc  downloads  notes.txt  projects  scripts\n');
    const long = last(['ls -l']).stdout.split('\n');
    assert.match(long[0], /^total \d+$/);
    assert.match(long[1], /^drwxr-xr-x 2 dev dev 4096 \w{3} [ \d]\d \d\d:\d\d downloads$/);
    assert.match(long[2], /^-rw-r--r-- 1 dev dev  195 \w{3} [ \d]\d \d\d:\d\d notes\.txt$/);
    assert.match(last(['ls -lh /var/log/nginx']).stdout, /access\.log/);
});

test('ls: one per line when piped, columns on the terminal', () => {
    const state = Seed.createState();
    const registry = require_registry();
    const piped = registry.commands.ls.run({ state, args: [], tty: false });
    assert.equal(piped.stdout, 'downloads\nnotes.txt\nprojects\nscripts\n');
});

test('ls: several operands, -R, missing and unreadable', () => {
    const several = last(['ls notes.txt downloads projects']).stdout;
    assert.ok(several.startsWith('notes.txt\n\ndownloads:\n'));
    assert.ok(several.includes('\n\nprojects:\nmy-site\n'));
    const recursive = last(['ls -R projects']).stdout;
    assert.equal(recursive, 'projects:\nmy-site\n\nprojects/my-site:\napp.js  index.html  style.css\n');
    const missing = last(['ls nope']);
    assert.equal(missing.stderr, "ls: cannot access 'nope': No such file or directory\n");
    assert.equal(missing.code, 2);
    assert.equal(last(['ls /root']).stderr, "ls: cannot open directory '/root': Permission denied\n");
});

test('ls: bad option', () => {
    assert.equal(last(['ls -z']).stderr, "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n");
});

test('mkdir: -p, existing, missing parent, verbose', () => {
    const r = runAll(['mkdir a', 'mkdir -p a/b/c', 'mkdir a', 'mkdir x/y', 'mkdir -p a', 'mkdir -v z']);
    assert.equal(r.outputs[0].code, 0);
    assert.equal(r.outputs[2].stderr, "mkdir: cannot create directory 'a': File exists\n");
    assert.equal(r.outputs[3].stderr, "mkdir: cannot create directory 'x/y': No such file or directory\n");
    assert.equal(r.outputs[4].code, 0);
    assert.equal(r.outputs[5].stdout, "mkdir: created directory 'z'\n");
    assert.ok(exists(r.state, '/home/dev/a/b/c'));
    assert.equal(last(['mkdir']).stderr, "mkdir: missing operand\nTry 'mkdir --help' for more information.\n");
    assert.equal(last(['mkdir /etc/x']).stderr, "mkdir: cannot create directory '/etc/x': Permission denied\n");
});

test('touch creates an empty file and refreshes an existing one', () => {
    const r = runAll(['touch a.txt', 'ls -l a.txt', 'touch notes.txt', 'touch /etc/x']);
    assert.equal(read(r.state, '/home/dev/a.txt'), '');
    assert.match(r.outputs[1].stdout, /^-rw-r--r-- 1 dev dev 0 /);
    assert.equal(read(r.state, '/home/dev/notes.txt').startsWith('Linux'), true);
    assert.equal(r.outputs[3].stderr, "touch: cannot touch '/etc/x': Permission denied\n");
});

test('cat: files, -n, directory, missing, unreadable', () => {
    assert.equal(last(['cat projects/my-site/app.js']).stdout, 'console.log("সাইট চালু হয়েছে");\n');
    assert.equal(last(['cat -n projects/my-site/style.css']).stdout.split('\n')[0], '     1\tbody {');
    assert.equal(last(['cat projects']).stderr, 'cat: projects: Is a directory\n');
    assert.equal(last(['cat nope']).stderr, 'cat: nope: No such file or directory\n');
    const secret = runAll(['touch s.txt']).state;
    assert.equal(last(['cat /etc/passwd'], secret).code, 0);
    assert.equal(last(['cat'], secret).errno, 'EOPERAND');
});

test('echo: text, -n, -e', () => {
    assert.equal(last(['echo hello   world']).stdout, 'hello world\n');
    assert.equal(last(['echo -n hi']).stdout, 'hi');
    assert.equal(last(['echo -e "a\\tb\\nc"']).stdout, 'a\tb\nc\n');
    assert.equal(last(['echo -x']).stdout, '-x\n');
    assert.equal(last(['echo "$HOME" ~ \'$HOME\'']).stdout, '/home/dev /home/dev $HOME\n');
});

test('cp: file, into folder, -r, errors', () => {
    const r = runAll(['cp notes.txt copy.txt', 'mkdir box', 'cp copy.txt box', 'cp -r projects box', 'cp projects nope', 'cp notes.txt notes.txt', 'cp nope box', 'cp notes.txt downloads/photo1.jpg']);
    assert.equal(read(r.state, '/home/dev/copy.txt'), read(r.state, '/home/dev/notes.txt'));
    assert.ok(exists(r.state, '/home/dev/box/copy.txt'));
    assert.ok(exists(r.state, '/home/dev/box/projects/my-site/app.js'));
    assert.equal(r.outputs[4].stderr, "cp: -r not specified; omitting directory 'projects'\n");
    assert.equal(r.outputs[5].stderr, "cp: 'notes.txt' and 'notes.txt' are the same file\n");
    assert.equal(r.outputs[6].stderr, "cp: cannot stat 'nope': No such file or directory\n");
    assert.equal(read(r.state, '/home/dev/downloads/photo1.jpg').startsWith('Linux'), true);
    assert.equal(last(['cp -r projects projects/my-site/x']).errno, 'ESELF');
    assert.equal(last(['cp a']).errno, 'EOPERAND');
});

test('cp: several sources need a folder', () => {
    assert.equal(last(['cp notes.txt .bashrc nope']).stderr, "cp: target 'nope' is not a directory\n");
    const r = runAll(['mkdir box', 'cp notes.txt .bashrc box', 'ls -a box']);
    assert.equal(r.outputs[2].stdout, '.  ..  .bashrc  notes.txt\n');
});

test('mv: rename, into folder, overwrite, errors', () => {
    const r = runAll(['mv notes.txt renamed.txt', 'mv renamed.txt downloads', 'mv downloads/song.mp3 downloads/old-notes.txt', 'mv projects projects/my-site', 'mv nope x', 'mv scripts downloads/photo1.jpg']);
    assert.ok(!exists(r.state, '/home/dev/notes.txt'));
    assert.ok(exists(r.state, '/home/dev/downloads/renamed.txt'));
    assert.equal(read(r.state, '/home/dev/downloads/old-notes.txt'), '[গানের ডেটা]\n');
    assert.match(r.outputs[3].stderr, /^mv: cannot move 'projects' to a subdirectory of itself/);
    assert.equal(r.outputs[4].stderr, "mv: cannot stat 'nope': No such file or directory\n");
    assert.match(r.outputs[5].stderr, /cannot overwrite non-directory/);
    assert.equal(last(['mv notes.txt notes.txt']).errno, 'ESAME');
});

test('rm: file, folder needs -r, -f, protections', () => {
    const r = runAll(['rm notes.txt', 'rm projects', 'rm -r projects', 'rm nope', 'rm -f nope', 'rm']);
    assert.ok(!exists(r.state, '/home/dev/notes.txt'));
    assert.equal(r.outputs[1].stderr, "rm: cannot remove 'projects': Is a directory\n");
    assert.ok(!exists(r.state, '/home/dev/projects'));
    assert.equal(r.outputs[3].stderr, "rm: cannot remove 'nope': No such file or directory\n");
    assert.equal(r.outputs[4].code, 0);
    assert.equal(r.outputs[5].stderr, "rm: missing operand\nTry 'rm --help' for more information.\n");
});

test('rm: refuses / and home and . and .. and the current folder', () => {
    for (const line of ['rm -rf /', 'rm -rf ~', 'rm -rf /home/dev', 'rm -rf .', 'rm -rf ..', 'rm -rf /home']) {
        const result = last([line]);
        assert.notEqual(result.code, 0, line);
        assert.ok(exists(result.state, '/home/dev/notes.txt'), line);
    }
    assert.equal(last(['rm -rf /']).errno, 'EPROTECT');
    assert.equal(last(['rm -r .']).errno, 'EDOT');
    const inside = runAll(['cd projects/my-site', 'rm -rf ../../projects']);
    assert.equal(inside.outputs[1].errno, 'EPROTECT');
});

test('rm: cannot remove from a folder you cannot write to', () => {
    assert.equal(last(['rm /etc/hosts']).stderr, "rm: cannot remove '/etc/hosts': Permission denied\n");
});

test('rmdir: empty ok, non-empty, file, missing', () => {
    const r = runAll(['mkdir e', 'rmdir e', 'rmdir downloads', 'rmdir notes.txt', 'rmdir nope']);
    assert.ok(!exists(r.state, '/home/dev/e'));
    assert.equal(r.outputs[2].stderr, "rmdir: failed to remove 'downloads': Directory not empty\n");
    assert.equal(r.outputs[3].stderr, "rmdir: failed to remove 'notes.txt': Not a directory\n");
    assert.equal(r.outputs[4].stderr, "rmdir: failed to remove 'nope': No such file or directory\n");
    const p = runAll(['mkdir -p a/b/c', 'rmdir -p a/b/c']);
    assert.ok(!exists(p.state, '/home/dev/a'));
});

test('tree: shape, counts, -a, -L, -d', () => {
    assert.equal(last(['tree projects']).stdout, 'projects\n└── my-site\n    ├── app.js\n    ├── index.html\n    └── style.css\n\n1 directory, 3 files\n');
    assert.ok(last(['tree -a']).stdout.includes('.bashrc'));
    assert.ok(!last(['tree']).stdout.includes('.bashrc'));
    assert.equal(last(['tree -L 1 projects']).stdout, 'projects\n└── my-site\n\n1 directory, 0 files\n');
    assert.equal(last(['tree -d projects']).stdout, 'projects\n└── my-site\n\n1 directory\n');
});

test('globs reach the commands', () => {
    const r = runAll(['mkdir pics', 'mv downloads/*.jpg pics', 'ls pics', 'rm downloads/*.pdf', 'ls downloads']);
    assert.equal(r.outputs[2].stdout, 'photo1.jpg  photo2.jpg\n');
    assert.equal(r.outputs[4].stdout, 'old-notes.txt  setup.zip  song.mp3\n');
});

test('unknown command, empty line, syntax error, unsupported', () => {
    assert.equal(last(['frob']).stderr, 'bash: frob: command not found\n');
    assert.equal(last(['frob']).code, 127);
    assert.equal(last(['   ']).stdout, '');
    assert.equal(last(['echo "x']).errno, 'ESYNTAX');
    assert.equal(last(['echo $(date)']).errno, 'EUNSUPPORTED');
});

test('failed commands never change the file system', () => {
    const { state } = runAll(['ls']);
    for (const line of ['mkdir /etc/x', 'rm /etc/hosts', 'cp nope x', 'mv nope x', 'touch /etc/x', 'rmdir downloads']) {
        assert.equal(last([line], state).state.fs, state.fs, line);
    }
});

test('every command has an explanation or a good reason not to', () => {
    const r = runAll(['pwd', 'cd projects', 'cd ..', 'ls -l', 'tree', 'mkdir q', 'touch q/t', 'cat notes.txt', 'echo hi', 'cp notes.txt n2', 'mv n2 n3', 'rm n3', 'rmdir q/..', 'history']);
    r.outputs.forEach((o) => {
        if (o.line !== 'clear' && o.line !== 'help') assert.ok(o.explain, `no explanation for: ${o.line}`);
    });
});

import { createRequire } from 'node:module';
function require_registry() {
    return createRequire(import.meta.url)('../global/09-registry.js');
}
