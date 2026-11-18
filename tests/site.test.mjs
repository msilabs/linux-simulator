import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;

test('site.json has the fields the layout needs', () => {
    const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));
    for (const key of ['name', 'tagline', 'description', 'lang', 'url', 'repo']) {
        assert.ok(site[key], `data/site.json is missing "${key}"`);
    }
    assert.equal(site.repo, 'https://github.com/msilabs/linux-simulator');
});

function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...jsFiles(path));
        else if (name.endsWith('.js')) out.push(path);
    }
    return out;
}

test('every engine file in global/ loads in Node without a DOM', () => {
    const files = jsFiles(join(root, 'global')).filter((f) => !f.endsWith('90-app.js'));
    for (const file of files) {
        assert.doesNotThrow(() => require(file), `${file} must load without window or document`);
    }
});
