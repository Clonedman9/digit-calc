'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../../assets/app.js'), 'utf8');

// Read real functions while ignoring braces inside strings, comments and regex literals.
function fn(name) {
  const start = script.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Missing function ' + name);
  const opening = script.indexOf('{', start);
  let depth = 0, quote = '', regex = false, regexClass = false, line = false, block = false;
  for (let i = opening; i < script.length; i++) {
    const c = script[i], next = script[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && next === '/') { block = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (regex) {
      if (c === '\\') i++;
      else if (c === '[') regexClass = true;
      else if (c === ']') regexClass = false;
      else if (c === '/' && !regexClass) regex = false;
      continue;
    }
    if (c === '/' && next === '/') { line = true; i++; continue; }
    if (c === '/' && next === '*') { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/') {
      let j = i - 1; while (/\s/.test(script[j])) j--;
      if ('=(:,![{;'.includes(script[j])) { regex = true; continue; }
    }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return script.slice(start, i + 1);
  }
  throw Error('Unterminated function ' + name);
}
function context(values, names) {
  const ctx = vm.createContext(values);
  vm.runInContext(names.map(fn).join('\n'), ctx);
  return ctx;
}
function fakeClock() {
  let next = 1;
  const jobs = new Map();
  return {
    jobs,
    setTimeout(callback, delay) { const id = next++; jobs.set(id, { callback, delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    run(id) { const job = jobs.get(id); jobs.delete(id); if (job) job.callback(); }
  };
}
module.exports = { fn, context, fakeClock, script };
