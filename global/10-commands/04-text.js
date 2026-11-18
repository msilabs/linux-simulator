// head, tail, wc, grep, find, sort, uniq, cut, less: লেখা পড়া, ছাঁকা আর গোনা
(function (root) {
    var isNode = typeof module !== 'undefined' && module.exports;
    var Path = isNode ? require('../01-path.js') : root.LinuxPath;
    var Fs = isNode ? require('../02-fs.js') : root.LinuxFs;
    var Expand = isNode ? require('../05-expand.js') : root.LinuxExpand;
    var H = isNode ? require('../08-helpers.js') : root.LinuxHelpers;
    var Registry = isNode ? require('../09-registry.js') : root.LinuxRegistry;

    /* ---------- সাহায্যকারী ---------- */

    function pending(name) {
        return name + ': কোনো ফাইলের নাম দিন (এই simulator-এ keyboard থেকে পড়া যায় না, pipe বা ফাইল দিন)\n';
    }

    // ফাইল বা stdin থেকে লেখা। ফেরত { text } অথবা { errno }
    function readSource(ctx, operand) {
        if (operand === '-') return { text: ctx.stdin || '' };
        var user = H.userOf(ctx.state);
        var found = Fs.lookup(ctx.state.fs, user, H.resolveArg(ctx.state, operand));
        if (found.error) return { errno: found.error };
        if (found.node.kind === 'dir') return { errno: 'EISDIR' };
        if (!Fs.can(found.node, user, 'r')) return { errno: 'EACCES' };
        return { text: found.node.content };
    }

    // লাইনগুলো \n সহ: শেষ লাইনে \n না থাকলে তাও যেমন আছে তেমন
    function segments(text) {
        return text.match(/[^\n]*\n|[^\n]+$/g) || [];
    }

    function failure(state, err, errno) {
        return { state: state, stdout: '', stderr: err, code: 1, errno: errno };
    }

    // সব input জোগাড়: operand না থাকলে stdin। ফেরত { inputs: [{ label, text }], err, errno, wait }
    function gather(ctx, operands, format) {
        var inputs = [];
        var err = '';
        var errno;
        if (!operands.length) {
            if (ctx.stdin === null || ctx.stdin === undefined) return { inputs: [], wait: true };
            return { inputs: [{ label: '-', text: ctx.stdin }], err: '' };
        }
        operands.forEach(function (operand) {
            var r = readSource(ctx, operand);
            if (r.errno) { err += format(operand, r.errno); errno = errno || r.errno; return; }
            inputs.push({ label: operand === '-' ? 'standard input' : operand, text: r.text });
        });
        return { inputs: inputs, err: err, errno: errno };
    }

    function number(text) {
        var m = /^\s*[-+]?\d+(\.\d+)?/.exec(text);
        return m ? parseFloat(m[0]) : 0;
    }

    /* ---------- head আর tail ---------- */

    function countOptions(args) {
        // -5 মানে -n 5; তবে `-n -5`-এর -5 নিজেই -n-এর মান, তাই সেটা বদলানো হয় না
        var out = [];
        args.forEach(function (a, index) {
            var valueOfN = index > 0 && args[index - 1] === '-n';
            if (/^-\d+$/.test(a) && !valueOfN) out.push('-n', a.slice(1));
            else out.push(a);
        });
        return out;
    }

    function openMessage(name) {
        return function (operand, errno) {
            if (errno === 'EISDIR') return name + ": error reading '" + operand + "': Is a directory\n";
            return name + ": cannot open '" + operand + "' for reading: " + H.errorText(errno) + '\n';
        };
    }

    function pieces(ctx, name, pick) {
        var state = ctx.state;
        var parsed = H.parseFlags(countOptions(ctx.args), { name: name, flags: name === 'tail' ? 'qvf' : 'qv', valued: 'n' });
        if (parsed.error) return failure(state, parsed.error, 'EOPT');
        var raw = parsed.flags.n === undefined ? '10' : parsed.flags.n;
        if (!/^[-+]?\d+$/.test(raw)) return failure(state, name + ": invalid number of lines: '" + raw + "'\n", 'EOPT');
        var got = gather(ctx, parsed.operands, openMessage(name));
        if (got.wait) return failure(state, pending(name), 'EOPERAND');
        var showNames = (got.inputs.length > 1 || (parsed.operands.length > 1)) && !parsed.flags.q || parsed.flags.v;
        var out = '';
        got.inputs.forEach(function (input, index) {
            if (showNames) out += (index ? '\n' : '') + '==> ' + input.label + ' <==\n';
            out += pick(segments(input.text), raw);
        });
        var result = { state: state, stdout: out, stderr: got.err, code: got.err ? 1 : 0, errno: got.errno };
        if (parsed.flags.f && !got.err) result.waiting = { name: 'tail -f' };
        return result;
    }

    Registry.register('head', {
        desc: 'ফাইলের প্রথম কয়েক লাইন দেখায়',
        run: function (ctx) {
            return pieces(ctx, 'head', function (lines, raw) {
                var n = parseInt(raw, 10);
                if (n < 0) return lines.slice(0, Math.max(0, lines.length + n)).join('');
                return lines.slice(0, n).join('');
            });
        }
    });

    Registry.register('tail', {
        desc: 'ফাইলের শেষ কয়েক লাইন দেখায়',
        run: function (ctx) {
            return pieces(ctx, 'tail', function (lines, raw) {
                var n = parseInt(raw, 10);
                if (raw.charAt(0) === '+') return lines.slice(Math.max(0, n - 1)).join('');
                if (n === 0) return '';
                return lines.slice(-Math.abs(n)).join('');
            });
        }
    });

    /* ---------- wc ---------- */

    function countOf(text) {
        var words = text.match(/\S+/g);
        return { lines: (text.match(/\n/g) || []).length, words: words ? words.length : 0, bytes: Fs.byteLength(text), chars: Array.from(text).length };
    }

    Registry.register('wc', {
        desc: 'লাইন, শব্দ আর অক্ষর গোনে',
        run: function (ctx) {
            var state = ctx.state;
            var parsed = H.parseFlags(ctx.args, { name: 'wc', flags: 'lwcm' });
            if (parsed.error) return failure(state, parsed.error, 'EOPT');
            var flags = parsed.flags;
            var all = !flags.l && !flags.w && !flags.c && !flags.m;
            var columns = [];
            if (all || flags.l) columns.push('lines');
            if (all || flags.w) columns.push('words');
            if (flags.m) columns.push('chars');
            if (all || flags.c) columns.push('bytes');

            var got = gather(ctx, parsed.operands, function (operand, errno) { return 'wc: ' + operand + ': ' + H.errorText(errno) + '\n'; });
            if (got.wait) return failure(state, pending('wc'), 'EOPERAND');
            var rows = got.inputs.map(function (input) {
                var c = countOf(input.text);
                c.label = parsed.operands.length ? (input.label === 'standard input' ? '' : input.label) : '';
                return c;
            });
            var total = rows.reduce(function (sum, r) {
                return { lines: sum.lines + r.lines, words: sum.words + r.words, bytes: sum.bytes + r.bytes, chars: sum.chars + r.chars, label: 'total' };
            }, { lines: 0, words: 0, bytes: 0, chars: 0, label: 'total' });
            if (rows.length > 1) rows.push(total);

            var width = 0;
            if (columns.length > 1 || rows.length > 1) {
                width = parsed.operands.length ? String(total.bytes).length : 7;
            }
            var out = rows.map(function (r) {
                var cells = columns.map(function (col) {
                    var cell = String(r[col]);
                    while (cell.length < width) cell = ' ' + cell;
                    return cell;
                });
                return cells.join(' ') + (r.label ? ' ' + r.label : '');
            }).join('\n');
            return { state: state, stdout: out ? out + '\n' : '', stderr: got.err, code: got.err ? 1 : 0, errno: got.errno };
        }
    });

    /* ---------- grep ---------- */

    var POSIX_CLASS = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', space: '\\s', upper: 'A-Z', lower: 'a-z', punct: '!-\\/:-@\\[-`{-~', blank: ' \\t', xdigit: '0-9A-Fa-f' };

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    }

    // grep-এর pattern থেকে JavaScript RegExp-এর লেখা। মূল ব্যাপার: BRE-তে + ? | ( ) { } সাধারণ অক্ষর, -E দিলে বিশেষ।
    function toRegexSource(pattern, extended) {
        var out = '';
        var special = '+?|(){}';
        for (var i = 0; i < pattern.length; i++) {
            var c = pattern.charAt(i);
            if (c === '\\') {
                var n = pattern.charAt(i + 1);
                if (n === '') { out += '\\\\'; break; }
                i++;
                if (special.indexOf(n) !== -1) out += extended ? '\\' + n : n;
                else if (n === '<' || n === '>') out += '\\b';
                else if ('wWsSbB'.indexOf(n) !== -1) out += '\\' + n;
                else out += /[A-Za-z0-9]/.test(n) ? n : '\\' + n;
                continue;
            }
            if (c === '[') {
                var j = i + 1;
                var body = '';
                if (pattern.charAt(j) === '^') { body += '^'; j++; }
                if (pattern.charAt(j) === ']') { body += '\\]'; j++; }
                var closed = false;
                for (; j < pattern.length; j++) {
                    var d = pattern.charAt(j);
                    if (d === '[' && pattern.charAt(j + 1) === ':') {
                        var end = pattern.indexOf(':]', j + 2);
                        var cls = end === -1 ? null : POSIX_CLASS[pattern.slice(j + 2, end)];
                        if (cls) { body += cls; j = end + 1; continue; }
                    }
                    if (d === ']') { closed = true; break; }
                    body += d === '\\' || d === '[' ? '\\' + d : d;
                }
                if (!closed) throw new Error('Unmatched [, [^, [:, [., or [=');
                out += '[' + body + ']';
                i = j;
                continue;
            }
            if (!extended && special.indexOf(c) !== -1) { out += '\\' + c; continue; }
            if (c === '/') { out += '\\/'; continue; }
            out += c;
        }
        return out;
    }

    function joinDisplay(display, name) {
        return display.charAt(display.length - 1) === '/' ? display + name : display + '/' + name;
    }

    Registry.register('grep', {
        desc: 'লেখার ভেতর থেকে মেলা লাইন খুঁজে দেখায়',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var parsed = H.parseFlags(ctx.args, { name: 'grep', flags: 'inrRvclEFwo', valued: 'e' });
            if (parsed.error) return { state: state, stdout: '', stderr: parsed.error, code: 2, errno: 'EOPT' };
            var flags = parsed.flags;
            var operands = parsed.operands.slice();
            var pattern = flags.e;
            if (pattern === undefined) {
                if (!operands.length) return { state: state, stdout: '', stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n", code: 2, errno: 'EOPERAND' };
                pattern = operands.shift();
            }

            var regex;
            try {
                var source = flags.F ? escapeRegex(pattern) : toRegexSource(pattern, !!flags.E);
                if (flags.w) source = '(?<![A-Za-z0-9_])(?:' + source + ')(?![A-Za-z0-9_])';
                regex = new RegExp(source, flags.i ? 'i' : '');
            } catch (e) {
                return { state: state, stdout: '', stderr: 'grep: ' + (/Unmatched \[/.test(e.message) ? e.message : 'Invalid regular expression') + '\n', code: 2, errno: 'EREGEX' };
            }

            var recursive = flags.r || flags.R;
            var targets = [];
            var err = '';
            var errno;
            var hideDot = false;
            if (!operands.length) {
                if (recursive) { operands = ['.']; hideDot = true; }
                else if (ctx.stdin !== null && ctx.stdin !== undefined) targets.push({ label: '(standard input)', text: ctx.stdin });
                else return { state: state, stdout: '', stderr: pending('grep'), code: 2, errno: 'EOPERAND' };
            }

            function collect(display, abs, node) {
                if (node.kind === 'dir') {
                    if (!recursive) { err += 'grep: ' + display + ': Is a directory\n'; errno = errno || 'EISDIR'; return; }
                    if (!Fs.can(node, user, 'r') || !Fs.can(node, user, 'x')) { err += 'grep: ' + display + ': Permission denied\n'; errno = errno || 'EACCES'; return; }
                    Fs.names(node).forEach(function (name) {
                        var shown = hideDot && display === '.' ? name : joinDisplay(display, name);
                        collect(shown, Path.join(abs, name), node.children[name]);
                    });
                    return;
                }
                if (!Fs.can(node, user, 'r')) { err += 'grep: ' + display + ': Permission denied\n'; errno = errno || 'EACCES'; return; }
                targets.push({ label: display, text: node.content });
            }

            operands.forEach(function (operand) {
                if (operand === '-') { targets.push({ label: '(standard input)', text: ctx.stdin || '' }); return; }
                var abs = H.resolveArg(state, operand);
                var found = Fs.lookup(state.fs, user, abs);
                if (found.error) { err += 'grep: ' + operand + ': ' + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                collect(operand, abs, found.node);
            });

            var withNames = operands.length > 1 || recursive && operands.some(function (o) {
                var f = Fs.lookup(state.fs, user, H.resolveArg(state, o));
                return f.node && f.node.kind === 'dir';
            });
            var out = '';
            var matched = false;
            targets.forEach(function (target) {
                var prefix = withNames ? target.label + ':' : '';
                var hits = 0;
                var lines = target.text === '' ? [] : target.text.split('\n');
                if (lines.length && lines[lines.length - 1] === '') lines.pop();
                var local = '';
                lines.forEach(function (line, index) {
                    var has = regex.test(line);
                    if (has === !!flags.v) return;
                    hits++;
                    if (flags.c || flags.l) return;
                    var num = flags.n ? (index + 1) + ':' : '';
                    if (flags.o && !flags.v) {
                        var globalRegex = new RegExp(regex.source, regex.flags + 'g');
                        var m;
                        while ((m = globalRegex.exec(line)) !== null) {
                            if (m[0] === '') { globalRegex.lastIndex++; continue; }
                            local += prefix + num + m[0] + '\n';
                        }
                    } else local += prefix + num + line + '\n';
                });
                if (hits) matched = true;
                if (flags.c) out += prefix + hits + '\n';
                else if (flags.l) { if (hits) out += target.label + '\n'; }
                else out += local;
            });

            return { state: state, stdout: out, stderr: err, code: err ? 2 : matched ? 0 : 1, errno: err ? errno : matched ? undefined : 'ENOMATCH' };
        }
    });

    /* ---------- find ---------- */

    Registry.register('find', {
        desc: 'নাম বা ধরন ধরে ফাইল খুঁজে বের করে',
        run: function (ctx) {
            var state = ctx.state;
            var user = H.userOf(state);
            var args = ctx.args;
            var paths = [];
            var i = 0;
            while (i < args.length && args[i].charAt(0) !== '-' && args[i] !== '!' && args[i] !== '(') { paths.push(args[i]); i++; }
            if (!paths.length) paths = ['.'];
            var test = { name: null, type: null, maxdepth: Infinity, mindepth: 0 };
            for (; i < args.length; i++) {
                var a = args[i];
                var value = args[i + 1];
                if (a === '-name' || a === '-iname') {
                    if (value === undefined) return failure(state, 'find: missing argument to `' + a + "'\n", 'EOPT');
                    test.name = Expand.patternToRegex(value, a === '-iname');
                    i++;
                } else if (a === '-type') {
                    if (value !== 'f' && value !== 'd' && value !== 'l') return failure(state, 'find: Unknown argument to -type: ' + value + '\n', 'EOPT');
                    test.type = value;
                    i++;
                } else if (a === '-maxdepth' || a === '-mindepth') {
                    if (!/^\d+$/.test(value || '')) return failure(state, 'find: Expected a positive decimal integer argument to ' + a + ', but got ' + (value === undefined ? 'nothing' : "'" + value + "'") + '\n', 'EOPT');
                    test[a.slice(1)] = parseInt(value, 10);
                    i++;
                } else if (a === '-print') {
                    continue;
                } else {
                    return failure(state, "find: unknown predicate `" + a + "'\n", 'EOPT');
                }
            }

            var out = '';
            var err = '';
            var errno;

            function matches(display, node, depth) {
                if (depth < test.mindepth) return false;
                if (test.type === 'f' && node.kind !== 'file') return false;
                if (test.type === 'd' && node.kind !== 'dir') return false;
                if (test.type === 'l' && node.kind !== 'link') return false;
                if (test.name && !test.name.test(Path.basename(display === '/' ? '/' : display.replace(/\/+$/, '')))) return false;
                return true;
            }

            function walk(display, abs, node, depth) {
                if (matches(display, node, depth)) out += display + '\n';
                if (node.kind !== 'dir' || depth >= test.maxdepth) return;
                if (!Fs.can(node, user, 'r') || !Fs.can(node, user, 'x')) {
                    err += 'find: ‘' + display + '’: Permission denied\n';
                    errno = errno || 'EACCES';
                    return;
                }
                Fs.names(node).forEach(function (name) {
                    walk(joinDisplay(display, name), Path.join(abs, name), node.children[name], depth + 1);
                });
            }

            paths.forEach(function (operand) {
                var found = Fs.lookup(state.fs, user, H.resolveArg(state, operand));
                if (found.error) { err += 'find: ‘' + operand + '’: ' + H.errorText(found.error) + '\n'; errno = errno || found.error; return; }
                walk(operand, H.resolveArg(state, operand), found.node, 0);
            });
            return { state: state, stdout: out, stderr: err, code: err ? 1 : 0, errno: errno };
        }
    });

    /* ---------- sort আর uniq ---------- */

    // -k N[,M]: N থেকে M নম্বর field দিয়ে তুলনা
    function keyOf(line, spec, sep) {
        if (!spec) return line;
        var parts = spec.split(',');
        var from = Math.max(1, parseInt(parts[0], 10) || 1);
        var to = parts[1] ? parseInt(parts[1], 10) : Infinity;
        var fields = sep ? line.split(sep) : line.replace(/^\s+/, '').split(/\s+/);
        return fields.slice(from - 1, to === Infinity ? undefined : to).join(sep || ' ');
    }

    function cmpBytes(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    }

    Registry.register('sort', {
        desc: 'লাইনগুলো সাজায়',
        run: function (ctx) {
            var state = ctx.state;
            var parsed = H.parseFlags(ctx.args, { name: 'sort', flags: 'nruf', valued: 'kt' });
            if (parsed.error) return failure(state, parsed.error, 'EOPT');
            var flags = parsed.flags;
            var got = gather(ctx, parsed.operands, function (operand, errno) {
                return errno === 'EISDIR' ? 'sort: read failed: ' + operand + ': Is a directory\n' : 'sort: cannot read: ' + operand + ': ' + H.errorText(errno) + '\n';
            });
            if (got.wait) return failure(state, pending('sort'), 'EOPERAND');
            var lines = [];
            got.inputs.forEach(function (input) {
                var text = input.text;
                if (text === '') return;
                text.split('\n').forEach(function (line, index, all) {
                    if (index === all.length - 1 && line === '') return;
                    lines.push(line);
                });
            });
            function compare(a, b) {
                var ka = keyOf(a, flags.k, flags.t);
                var kb = keyOf(b, flags.k, flags.t);
                var result;
                if (flags.n) result = number(ka) - number(kb);
                else if (flags.f) result = Fs.compareNames(ka.toLowerCase(), kb.toLowerCase());
                else result = Fs.compareNames(ka, kb);
                if (result === 0 && !flags.u) result = cmpBytes(a, b);
                return flags.r ? -result : result;
            }
            lines.sort(compare);
            if (flags.u) {
                lines = lines.filter(function (line, index) { return index === 0 || compare(lines[index - 1], line) !== 0; });
            }
            return { state: state, stdout: lines.length ? lines.join('\n') + '\n' : '', stderr: got.err, code: got.err ? 2 : 0, errno: got.errno };
        }
    });

    Registry.register('uniq', {
        desc: 'পাশাপাশি একই লাইনগুলো এক করে (বা গোনে)',
        run: function (ctx) {
            var state = ctx.state;
            var parsed = H.parseFlags(ctx.args, { name: 'uniq', flags: 'cdui' });
            if (parsed.error) return failure(state, parsed.error, 'EOPT');
            var flags = parsed.flags;
            var got = gather(ctx, parsed.operands.slice(0, 1), function (operand, errno) { return 'uniq: ' + operand + ': ' + H.errorText(errno) + '\n'; });
            if (got.wait) return failure(state, pending('uniq'), 'EOPERAND');
            var lines = got.inputs.length ? H.splitLines(got.inputs[0].text) : [];
            var groups = [];
            lines.forEach(function (line) {
                var last = groups[groups.length - 1];
                var same = last && (flags.i ? last.line.toLowerCase() === line.toLowerCase() : last.line === line);
                if (same) last.count++;
                else groups.push({ line: line, count: 1 });
            });
            var out = '';
            groups.forEach(function (g) {
                if (flags.d && g.count < 2) return;
                if (flags.u && g.count > 1) return;
                if (flags.c) {
                    var n = String(g.count);
                    while (n.length < 7) n = ' ' + n;
                    out += n + ' ' + g.line + '\n';
                } else out += g.line + '\n';
            });
            return { state: state, stdout: out, stderr: got.err, code: got.err ? 1 : 0, errno: got.errno };
        }
    });

    /* ---------- cut ---------- */

    // "1,3", "2-4", "2-", "-3" থেকে একটা বাছাই-ফাংশন
    function rangeTester(spec) {
        var ranges = spec.split(',').map(function (part) {
            var m = /^(\d*)-(\d*)$/.exec(part);
            if (m) return { from: m[1] === '' ? 1 : parseInt(m[1], 10), to: m[2] === '' ? Infinity : parseInt(m[2], 10) };
            if (/^\d+$/.test(part)) return { from: parseInt(part, 10), to: parseInt(part, 10) };
            return null;
        });
        if (ranges.some(function (r) { return !r || r.from < 1; })) return null;
        return function (position) {
            return ranges.some(function (r) { return position >= r.from && position <= r.to; });
        };
    }

    Registry.register('cut', {
        desc: 'প্রতি লাইন থেকে নির্দিষ্ট অংশ কেটে নেয়',
        run: function (ctx) {
            var state = ctx.state;
            var parsed = H.parseFlags(ctx.args, { name: 'cut', flags: 's', valued: 'dfc' });
            if (parsed.error) return failure(state, parsed.error, 'EOPT');
            var flags = parsed.flags;
            if (flags.f === undefined && flags.c === undefined) return failure(state, 'cut: you must specify a list of bytes, characters, or fields\nTry \'cut --help\' for more information.\n', 'EOPERAND');
            var delimiter = flags.d === undefined ? '\t' : flags.d;
            if (delimiter.length !== 1) return failure(state, 'cut: the delimiter must be a single character\nTry \'cut --help\' for more information.\n', 'EOPT');
            var test = rangeTester(flags.f !== undefined ? flags.f : flags.c);
            if (!test) return failure(state, 'cut: invalid field range\nTry \'cut --help\' for more information.\n', 'EOPT');
            var got = gather(ctx, parsed.operands, function (operand, errno) { return 'cut: ' + operand + ': ' + H.errorText(errno) + '\n'; });
            if (got.wait) return failure(state, pending('cut'), 'EOPERAND');
            var out = '';
            got.inputs.forEach(function (input) {
                H.splitLines(input.text).forEach(function (line) {
                    if (flags.c !== undefined) {
                        out += Array.from(line).filter(function (ch, i) { return test(i + 1); }).join('') + '\n';
                        return;
                    }
                    if (line.indexOf(delimiter) === -1) { if (!flags.s) out += line + '\n'; return; }
                    out += line.split(delimiter).filter(function (field, i) { return test(i + 1); }).join(delimiter) + '\n';
                });
            });
            return { state: state, stdout: out, stderr: got.err, code: got.err ? 1 : 0, errno: got.errno };
        }
    });

    /* ---------- less ---------- */

    Registry.register('less', {
        desc: 'ফাইলের লেখা দেখায় (এখানে cat-এর মতো, পুরোটা একবারে)',
        run: function (ctx) {
            var state = ctx.state;
            var got = gather(ctx, ctx.args.filter(function (a) { return a.charAt(0) !== '-' || a === '-'; }), function (operand, errno) {
                return errno === 'EISDIR' ? operand + ' is a directory\n' : operand + ': ' + H.errorText(errno) + '\n';
            });
            if (got.wait) return failure(state, 'Missing filename ("less --help" for help)\n', 'EOPERAND');
            return { state: state, stdout: got.inputs.map(function (i) { return i.text; }).join(''), stderr: got.err, code: got.err ? 1 : 0, errno: got.errno };
        }
    });
})(typeof self !== 'undefined' ? self : this);
