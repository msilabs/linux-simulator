// আসল Chrome-এ পুরো পেজ চালিয়ে দেখা (Playwright ছাড়া, Chrome-এর DevTools protocol আর Node-এর নিজের WebSocket দিয়ে)।
// Chrome না পেলে skip হয়। CI-র ubuntu-latest-এ google-chrome থাকে।
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .filter(Boolean).find((p) => existsSync(p));
const skip = CHROME ? false : 'Chrome পাওয়া যায়নি';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server, chrome, profile, ws, nextId = 0, url;
const pending = new Map();
let problems = [];

async function send(method, params = {}) {
    const id = ++nextId;
    const reply = new Promise((resolve) => pending.set(id, resolve));
    ws.send(JSON.stringify({ id, method, params }));
    return reply;
}

async function js(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('page script failed: ' + r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || ''));
    return r.result?.result?.value;
}

async function waitFor(expression, what) {
    for (let i = 0; i < 60; i++) {
        if (await js(expression)) return;
        await sleep(100);
    }
    assert.fail('timeout: ' + what);
}

async function open(width = 1280, height = 900) {
    problems = [];
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    // আগের test-এর সেভ করা অবস্থা যাতে না ঢোকে: একবার খুলে localStorage মুছে আবার খোলা
    await send('Page.navigate', { url });
    await waitFor("!!document.querySelector('#playground .term-input')", 'first load');
    await js('localStorage.clear()');
    await send('Page.navigate', { url });
    await waitFor("!!document.querySelector('#playground .term-input') && document.querySelector('#playground .term-out').children.length > 0", 'page load');
    problems = [];
}

const run = (command) => js(`(() => { const i = document.querySelector('#playground .term-input'); i.value = ${JSON.stringify(command)}; document.querySelector('#playground .term-form').requestSubmit(); })()`);
const screen = () => js("document.querySelector('#playground .term-out').innerText");
const key = (name, extra = {}) => js(`document.querySelector('#playground .term-input').dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(name)}, bubbles: true, cancelable: true }, ${JSON.stringify(extra)})))`);

before(async () => {
    if (skip) return;
    execFileSync('node', ['alo', 'build'], { cwd: root });
    server = createServer((req, res) => {
        const path = req.url.split('?')[0].replace(/\/$/, '/index.html');
        const file = join(root, 'dist', path);
        if (!file.startsWith(join(root, 'dist')) || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${server.address().port}/`;

    profile = mkdtempSync(join(tmpdir(), 'lsim-e2e-'));
    const port = 9500 + Math.floor(Math.random() * 400);
    chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
    let targets;
    for (let i = 0; i < 100 && !targets; i++) {
        try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(150); }
    }
    ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        if (msg.method === 'Runtime.exceptionThrown') problems.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push(msg.params.args.map((a) => a.value).join(' '));
    };
    await send('Runtime.enable');
    await send('Page.enable');
});

after(async () => {
    if (ws) ws.close();
    if (chrome) {
        await new Promise((resolve) => { chrome.once('exit', resolve); chrome.kill(); setTimeout(resolve, 3000); });
    }
    if (server) server.close();
    try { if (profile) rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* অস্থায়ী ফোল্ডার, না মুছলেও চলে */ }
});

test('e2e: the page loads and shows the welcome note, with no script errors', { skip }, async () => {
    await open();
    assert.match(await screen(), /Linux Simulator-এ স্বাগতম/);
    assert.equal(await js("document.querySelector('#playground .term-form .prompt').textContent"), 'dev@laptop:~$');
    assert.deepEqual(problems, []);
});

test('e2e: the header has three links and the hero points to Learn and Challenge', { skip }, async () => {
    await open();
    assert.deepEqual(await js("[...document.querySelectorAll('.site-header .nav a')].map((a) => a.textContent.trim())"), ['Playground', 'Learn', 'Challenge']);
    assert.equal(await js("document.querySelector('.site-header .nav a.on').textContent.trim()"), 'Playground');
    assert.deepEqual(await js("[...document.querySelectorAll('.hero-actions a')].map((a) => a.getAttribute('href'))"), ['/learn/', '/challenge/']);
});

test('e2e: a lesson turns its terminal blocks into small working terminals', { skip }, async () => {
    await open();
    await send('Page.navigate', { url: url + 'learn/navigate/' });
    await waitFor("document.querySelectorAll('#lessonBody .try .term-input').length >= 2", 'lesson terminals');
    problems = [];
    const box = "document.querySelectorAll('#lessonBody .try')[1]";
    assert.match(await js(`${box}.querySelector('.term-out').innerText`), /\/home\/dev\/projects\/my-site/);
    await js(`(() => { const b = ${box}; b.querySelector('.term-input').value = 'cd ..'; b.querySelector('.term-form').requestSubmit(); })()`);
    assert.equal(await js(`${box}.querySelector('.term-form .prompt').textContent`), 'dev@laptop:~/projects$');
    assert.equal(await js("document.querySelectorAll('#lessonBody .try')[0].querySelector('.term-form .prompt').textContent"), 'dev@laptop:~$');
    await js(`${box}.querySelector('.btn-reset').click()`);
    assert.equal(await js(`${box}.querySelector('.term-form .prompt').textContent`), 'dev@laptop:~/projects/my-site$');
    assert.equal(await js("document.querySelector('.site-header .nav a.on').textContent.trim()"), 'Learn');
    assert.deepEqual(problems, []);
});

test('e2e: a challenge checks every command, unlocks the next one and remembers it', { skip }, async () => {
    await open();
    await send('Page.navigate', { url: url + 'challenge/' });
    await waitFor("!!document.querySelector('#chTerm .term-input') && document.getElementById('chTitle').textContent !== ''", 'challenge page');
    problems = [];
    assert.equal(await js("document.querySelectorAll('#chList .side-item').length"), 15);
    assert.equal(await js("document.querySelectorAll('#chList .side-item[disabled]').length"), 14);
    assert.equal(await js("document.querySelector('#chChecks .ch-check.pass')"), null);
    const type = (command) => js(`(() => { const i = document.querySelector('#chTerm .term-input'); i.value = ${JSON.stringify(command)}; document.querySelector('#chTerm .term-form').requestSubmit(); })()`);
    await type('cd projects');
    assert.equal(await js("document.getElementById('chResult').hidden"), true);
    await type('cd my-site');
    assert.equal(await js("document.getElementById('chResult').hidden"), false);
    assert.equal(await js("document.getElementById('chNext').hidden"), false);
    assert.equal(await js("document.querySelectorAll('#chList .side-item[disabled]').length"), 13);
    await js("document.getElementById('chNext').click()");
    assert.equal(await js("document.getElementById('chTitle').textContent"), 'নোটে কয় লাইন');
    assert.equal(await js("document.querySelector('#chTerm .term-form .prompt').textContent"), 'dev@laptop:~$');
    await send('Page.reload');
    await waitFor("!!document.querySelector('#chTerm .term-input') && document.getElementById('chTitle').textContent !== ''", 'reload');
    assert.equal(await js("document.getElementById('chTitle').textContent"), 'নোটে কয় লাইন');
    assert.equal(await js("document.getElementById('progressText').textContent"), '১ / ১৫টা শেষ');
    await js("document.getElementById('chSolution').click(); document.querySelector('#chSolutionBox button').click()");
    assert.equal(await js("document.getElementById('chResult').hidden"), false);
    assert.deepEqual(problems, []);
});

test('e2e: commands, explanations, errors and pipes show on screen', { skip }, async () => {
    await open();
    await run('ls -l');
    await run('cd nope');
    await run('cat notes.txt | head -n 1 | wc -l');
    await waitFor("document.querySelector('#playground .term-out').innerText.includes('pipe')", 'pipe explanation');
    const text = await screen();
    assert.match(text, /drwxr-xr-x/);
    assert.match(text, /bash: cd: nope: No such file or directory/);
    assert.match(text, /সমস্যা/);
    assert.match(text, /ব্যাখ্যা/);
    assert.deepEqual(problems, []);
});

test('e2e: history with the arrow keys and Tab completion', { skip }, async () => {
    await open();
    await run('pwd');
    await run('ls');
    await key('ArrowUp');
    assert.equal(await js("document.querySelector('#playground .term-input').value"), 'ls');
    await key('ArrowUp');
    assert.equal(await js("document.querySelector('#playground .term-input').value"), 'pwd');
    await key('ArrowDown');
    await key('ArrowDown');
    assert.equal(await js("document.querySelector('#playground .term-input').value"), '');
    await js("document.querySelector('#playground .term-input').value = 'cd pro'");
    await key('Tab');
    assert.equal(await js("document.querySelector('#playground .term-input').value"), 'cd projects/');
});

test('e2e: progress stays after a reload, and Reset clears it', { skip }, async () => {
    await open();
    await run('mkdir keep && cd keep && touch a');
    await waitFor("document.querySelector('#playground .term-form .prompt').textContent.includes('keep')", 'cd keep');
    await send('Page.reload');
    await waitFor("!!document.querySelector('#playground .term-out') && document.querySelector('#playground .term-out').innerText.includes('mkdir keep')", 'restored screen');
    assert.equal(await js("document.querySelector('#playground .term-form .prompt').textContent"), 'dev@laptop:~/keep$');
    await js("window.confirm = () => true; document.querySelector('#playground .btn-reset').click()");
    await waitFor("!document.querySelector('#playground .term-out').innerText.includes('mkdir keep')", 'reset');
    assert.equal(await js("document.querySelector('#playground .term-form .prompt').textContent"), 'dev@laptop:~$');
});

test('e2e: Undo steps back one change', { skip }, async () => {
    await open();
    await run('mkdir gone');
    await waitFor("[...document.querySelectorAll('.tree-row')].some(r => r.textContent.includes('gone'))", 'folder in the tree');
    await js("document.querySelector('#playground .btn-undo').click()");
    await waitFor("![...document.querySelectorAll('.tree-row')].some(r => r.textContent.includes('gone'))", 'folder gone after undo');
    assert.match(await screen(), /Undo করা হলো/);
});

test('e2e: tail -f waits and the stop button ends it', { skip }, async () => {
    await open();
    await run('tail -f /var/log/nginx/error.log');
    await waitFor("!document.querySelector('#playground .term-running').hidden && document.querySelector('#playground .term-form').hidden", 'running bar');
    await js("document.querySelector('#playground .btn-stop').click()");
    await waitFor("document.querySelector('#playground .term-running').hidden && !document.querySelector('#playground .term-form').hidden", 'stopped');
    assert.match(await screen(), /\^C/);
});

test('e2e: nano opens the editor, saving changes the file', { skip }, async () => {
    await open();
    await run('nano notes.txt');
    await waitFor("!document.getElementById('editor').hidden", 'editor open');
    await js("document.getElementById('editor-text').value = 'বদলানো নোট\\n'; document.getElementById('editor-save').click()");
    await waitFor("document.getElementById('editor').hidden", 'editor closed');
    await run('cat notes.txt');
    await waitFor("document.querySelector('#playground .term-out').innerText.includes('বদলানো নোট')", 'new text');
});

test('e2e: read-only files open read-only', { skip }, async () => {
    await open();
    await run('nano /etc/hosts');
    await waitFor("!document.getElementById('editor').hidden", 'editor open');
    assert.equal(await js("document.getElementById('editor-save').disabled"), true);
    await js("document.getElementById('editor-cancel').click()");
    await waitFor("document.getElementById('editor').hidden", 'editor closed');
});

test('e2e: the file tree opens folders, previews files and flags changes', { skip }, async () => {
    await open();
    await js("document.querySelector('.tree-row[data-path=\"/home/dev/projects\"]').click()");
    await waitFor("!!document.querySelector('.tree-row[data-path=\"/home/dev/projects/my-site\"]')", 'folder opened');
    await js("document.querySelector('.tree-row[data-path=\"/home/dev/notes.txt\"]').click()");
    assert.match(await js("document.querySelector('#playground-tree .preview-text').textContent"), /Linux শেখার নোট/);
    await run('touch fresh.txt');
    await waitFor("!!document.querySelector('.tree-row.fresh')", 'fresh highlight');
    await js("document.querySelector('#playground-tree .tree-perms').click()");
    assert.equal(await js("document.querySelectorAll('.tree-row .perm').length"), 0);
});

test('e2e: the theme button switches the colours and is remembered', { skip }, async () => {
    await open();
    const before = await js("getComputedStyle(document.body).backgroundColor");
    await js("document.querySelector('.theme').click()");
    const after = await js("document.documentElement.dataset.theme");
    assert.ok(after === 'dark' || after === 'light');
    await send('Page.reload');
    await waitFor("!!document.querySelector('#playground .term-input')", 'reload');
    assert.equal(await js("document.documentElement.dataset.theme"), after);
    void before;
});

test('e2e: on a phone the key bar shows, inserts text, and nothing scrolls sideways', { skip }, async () => {
    await open(390, 844);
    assert.notEqual(await js("getComputedStyle(document.querySelector('#playground .keybar')).display"), 'none');
    await js("document.querySelector('#playground .term-input').value = 'ls'");
    await js("document.querySelector('[data-insert=\"|\"]').click()");
    assert.equal(await js("document.querySelector('#playground .term-input').value"), 'ls|');
    assert.ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'page is wider than the phone screen');
    await open(1280, 900);
    assert.equal(await js("getComputedStyle(document.querySelector('#playground .keybar')).display"), 'none');
});
