import test from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Expand, Seed } from './helpers.mjs';

const text = (word) => Parser.wordText(word);
const shape = (line) => Parser.parse(line).list.map((item) => ({
    sep: item.sep,
    pipeline: item.pipeline.map((c) => ({ argv: c.argv.map(text), redirects: c.redirects.map((r) => r.op + (r.target ? ' ' + text(r.target) : '')) }))
}));

test('parser: words, quotes and escapes', () => {
    assert.deepEqual(shape('ls -l "my dir" \'a b\' c\\ d')[0].pipeline[0].argv, ['ls', '-l', 'my dir', 'a b', 'c d']);
    assert.deepEqual(shape('echo ""')[0].pipeline[0].argv, ['echo', '']);
    assert.deepEqual(shape('echo "say \\"hi\\""')[0].pipeline[0].argv, ['echo', 'say "hi"']);
});

test('parser: pipes, redirects and lists', () => {
    const list = shape('cat a | grep x > out.txt 2>&1; ls && pwd || echo no');
    assert.equal(list.length, 4);
    assert.equal(list[0].sep, ';');
    assert.deepEqual(list[0].pipeline.map((c) => c.argv), [['cat', 'a'], ['grep', 'x']]);
    assert.deepEqual(list[0].pipeline[1].redirects, ['> out.txt', '2>&1']);
    assert.deepEqual(list.map((l) => l.sep), [';', '&&', '||', '']);
});

test('parser: 2> is a redirect only at the start of a word', () => {
    assert.deepEqual(shape('echo a2>x')[0].pipeline[0].redirects, ['> x']);
    assert.deepEqual(shape('cmd 2> err.txt')[0].pipeline[0].redirects, ['2> err.txt']);
    assert.deepEqual(shape('cmd >> log')[0].pipeline[0].redirects, ['>> log']);
});

test('parser: comments are ignored', () => {
    assert.deepEqual(shape('echo hi # not this')[0].pipeline[0].argv, ['echo', 'hi']);
    assert.equal(Parser.parse('# only a comment').list.length, 0);
});

test('parser: syntax errors in English like bash', () => {
    assert.equal(Parser.parse('a | | b').error, "syntax error near unexpected token `|'");
    assert.equal(Parser.parse('| a').error, "syntax error near unexpected token `|'");
    assert.equal(Parser.parse('ls >').error, "syntax error near unexpected token `newline'");
    assert.equal(Parser.parse('echo "open').ok, false);
    assert.equal(Parser.parse("echo 'open").ok, false);
});

test('parser: things the simulator leaves out are marked unsupported', () => {
    for (const line of ['echo $(date)', 'echo `date`', 'sleep 1 &', 'cat <<EOF', 'if true', 'for i in 1 2']) {
        const result = Parser.parse(line);
        assert.equal(result.ok, false, line);
        assert.equal(result.unsupported, true, line);
    }
});

function expand(line) {
    const state = Seed.createState();
    const ctx = { env: { ...state.env, NAME: 'dev', EMPTY: '' }, cwd: state.cwd, fs: state.fs, user: 'dev', status: 3 };
    return Expand.expandAll(Parser.parse(line).list[0].pipeline[0].argv, ctx);
}

test('expand: ~, $VAR, ${VAR} and $?', () => {
    assert.deepEqual(expand('echo ~ ~/x $HOME ${NAME}s $?'), ['echo', '/home/dev', '/home/dev/x', '/home/dev', 'devs', '3']);
});

test('expand: quotes stop expansion and globbing', () => {
    assert.deepEqual(expand("echo '$HOME' \"$NAME\" '~' \"*.txt\""), ['echo', '$HOME', 'dev', '~', '*.txt']);
});

test('expand: unquoted empty variable vanishes, quoted one stays', () => {
    assert.deepEqual(expand('echo $EMPTY a'), ['echo', 'a']);
    assert.deepEqual(expand('echo "$EMPTY" a'), ['echo', '', 'a']);
});

test('expand: globs *, ? and [..] match sorted, skip dotfiles', () => {
    assert.deepEqual(expand('echo *'), ['echo', 'downloads', 'notes.txt', 'projects', 'scripts']);
    assert.deepEqual(expand('echo downloads/photo?.jpg'), ['echo', 'downloads/photo1.jpg', 'downloads/photo2.jpg']);
    assert.deepEqual(expand('echo downloads/*.pdf'), ['echo', 'downloads/report.pdf', 'downloads/resume.pdf']);
    assert.deepEqual(expand('echo downloads/photo[12].jpg'), ['echo', 'downloads/photo1.jpg', 'downloads/photo2.jpg']);
    assert.deepEqual(expand('echo downloads/photo[!1].jpg'), ['echo', 'downloads/photo2.jpg']);
    assert.deepEqual(expand('echo .b*'), ['echo', '.bashrc']);
    assert.deepEqual(expand('echo projects/*/*.js'), ['echo', 'projects/my-site/app.js']);
    assert.deepEqual(expand('echo */*.js'), ['echo', '*/*.js']);
});

test('expand: a glob with no match stays as typed', () => {
    assert.deepEqual(expand('echo *.nomatch'), ['echo', '*.nomatch']);
});
