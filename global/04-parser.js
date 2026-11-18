// লেখা লাইনকে ভেঙে tree বানায়। কিছু চালায় না।
// word = { segs: [{ t: 'লেখা', q: 'none' | 'single' | 'double' }] }: কোন অংশ quote-এর ভেতরে ছিল মনে রাখা হয়,
// কারণ quote-এর ভেতরে * বা ~ আর বিশেষ কিছু নয়।
// ফল: { ok: true, list: [{ pipeline: [command], sep: ';' | '&&' | '||' | '' }] }
//   command = { argv: [word], redirects: [{ op: '>' | '>>' | '<' | '2>' | '2>>' | '2>&1', target: word }] }
// অথবা: { ok: false, error: 'বার্তা', unsupported: true/false }
(function (root) {
    var UNSUPPORTED_WORDS = ['if', 'for', 'while', 'until', 'case', 'function', 'select'];

    function wordText(word) {
        return word.segs.map(function (seg) { return seg.t; }).join('');
    }

    function unsupported(what) {
        return { ok: false, unsupported: true, error: what + ' এই simulator-এ নেই' };
    }

    function tokenize(line) {
        var tokens = [];
        var i = 0;
        var segs = null;

        function startWord() {
            if (!segs) segs = [];
        }
        function addText(text, q) {
            startWord();
            var last = segs[segs.length - 1];
            if (last && last.q === q) last.t += text;
            else segs.push({ t: text, q: q });
        }
        function endWord() {
            if (segs) tokens.push({ type: 'word', word: { segs: segs } });
            segs = null;
        }
        function op(value) {
            endWord();
            tokens.push({ type: 'op', value: value });
        }

        while (i < line.length) {
            var c = line[i];
            var next = line[i + 1];

            if (c === ' ' || c === '\t') { endWord(); i++; continue; }

            if (c === '#' && !segs) break;

            if (c === '\\') {
                if (next === undefined) { addText('\\', 'single'); i++; continue; }
                addText(next, 'single');
                i += 2;
                continue;
            }

            if (c === "'") {
                var close = line.indexOf("'", i + 1);
                if (close === -1) return { ok: false, error: "বন্ধ না হওয়া quote (')" };
                startWord();
                addText(line.slice(i + 1, close), 'single');
                i = close + 1;
                continue;
            }

            if (c === '"') {
                var text = '';
                var j = i + 1;
                var closed = false;
                while (j < line.length) {
                    var d = line[j];
                    if (d === '\\' && '\\"$`'.indexOf(line[j + 1]) !== -1 && line[j + 1] !== undefined) { text += line[j + 1]; j += 2; continue; }
                    if (d === '"') { closed = true; break; }
                    if (d === '`') return unsupported('backtick');
                    if (d === '$' && line[j + 1] === '(') return unsupported('$(...)');
                    text += d;
                    j++;
                }
                if (!closed) return { ok: false, error: 'বন্ধ না হওয়া quote (")' };
                startWord();
                if (text) addText(text, 'double');
                else {
                    // খালি "" ও একটা word
                    segs.push({ t: '', q: 'double' });
                }
                i = j + 1;
                continue;
            }

            if (c === '`') return unsupported('backtick');
            if (c === '$' && next === '(') return unsupported('$(...)');

            if (c === '|') {
                if (next === '|') { op('||'); i += 2; } else { op('|'); i++; }
                continue;
            }
            if (c === '&') {
                if (next === '&') { op('&&'); i += 2; continue; }
                return unsupported('& (background job)');
            }
            if (c === ';') { op(';'); i++; continue; }
            if (c === '<') {
                if (next === '<') return unsupported('here-doc (<<)');
                op('<'); i++;
                continue;
            }
            if (c === '>' || (c === '2' && next === '>' && !segs)) {
                var fd = c === '2' ? '2' : '';
                var at = c === '2' ? i + 1 : i;
                if (line.slice(at, at + 3) === '>&1' && fd === '2') { op('2>&1'); i = at + 3; continue; }
                if (line[at + 1] === '>') { op(fd + '>>'); i = at + 2; continue; }
                op(fd + '>');
                i = at + 1;
                continue;
            }

            addText(c, 'none');
            i++;
        }
        endWord();
        return { ok: true, tokens: tokens };
    }

    var REDIRECTS = { '>': 1, '>>': 1, '<': 1, '2>': 1, '2>>': 1 };

    function parse(line) {
        var lexed = tokenize(line);
        if (!lexed.ok) return lexed;
        var tokens = lexed.tokens;
        var list = [];
        var pipeline = [];
        var command = { argv: [], redirects: [] };

        function syntax(token) {
            return { ok: false, error: "syntax error near unexpected token `" + token + "'" };
        }
        function closeCommand(next) {
            if (command.argv.length === 0 && command.redirects.length === 0) return false;
            pipeline.push(command);
            command = { argv: [], redirects: [] };
            return next === undefined ? true : true;
        }

        for (var k = 0; k < tokens.length; k++) {
            var t = tokens[k];
            if (t.type === 'word') { command.argv.push(t.word); continue; }

            if (t.value === '2>&1') { command.redirects.push({ op: '2>&1', target: null }); continue; }

            if (REDIRECTS[t.value]) {
                var target = tokens[k + 1];
                if (!target) return syntax('newline');
                if (target.type !== 'word') return syntax(target.value);
                command.redirects.push({ op: t.value, target: target.word });
                k++;
                continue;
            }

            if (t.value === '|') {
                if (!closeCommand()) return syntax('|');
                continue;
            }

            // ;  &&  ||
            if (!closeCommand()) return syntax(t.value);
            list.push({ pipeline: pipeline, sep: t.value });
            pipeline = [];
        }

        if (command.argv.length || command.redirects.length) pipeline.push(command);
        else if (pipeline.length) return syntax('newline');
        if (pipeline.length) list.push({ pipeline: pipeline, sep: '' });
        else if (list.length && list[list.length - 1].sep !== ';') return syntax('newline');
        if (list.length && list[list.length - 1].sep === ';') list[list.length - 1].sep = '';

        for (var a = 0; a < list.length; a++) {
            var first = list[a].pipeline[0].argv[0];
            if (first && UNSUPPORTED_WORDS.indexOf(wordText(first)) !== -1) return unsupported(wordText(first) + ' (shell-এর প্রোগ্রামিং)');
        }
        return { ok: true, list: list };
    }

    var api = { parse: parse, tokenize: tokenize, wordText: wordText };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxParser = api;
})(typeof self !== 'undefined' ? self : this);
