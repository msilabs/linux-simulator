import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const Path = require('../global/01-path.js');
export const Fs = require('../global/02-fs.js');
export const Seed = require('../global/03-seed.js');
export const Parser = require('../global/04-parser.js');
export const Expand = require('../global/05-expand.js');
export const Helpers = require('../global/08-helpers.js');
export const Shell = require('../global/20-shell.js');
export const Complete = require('../global/22-complete.js');
export const Challenge = require('../global/31-challenge.js');
export const Session = require('../global/30-session.js');
export const Storage = require('../global/32-storage.js');

// command-গুলো একে একে চালায়। ফল: { state, outputs: [{ line, stdout, stderr, code }] }
export function runAll(lines, state) {
    let current = state || Seed.createState();
    const outputs = lines.map((line) => {
        const result = Shell.run(current, line);
        current = result.state;
        return { ...result, line, state: undefined };
    });
    return { state: current, outputs };
}

// শেষ command-এর ফল
export function last(lines, state) {
    const { outputs, state: after } = runAll(lines, state);
    return { ...outputs[outputs.length - 1], state: after };
}

export function dev() {
    return Fs.USERS.dev;
}

export function read(state, abs) {
    const found = Fs.lookup(state.fs, Fs.USERS.dev, abs);
    return found.node ? found.node.content : undefined;
}

export function exists(state, abs) {
    return !Fs.lookup(state.fs, Fs.USERS.root, abs).error;
}
