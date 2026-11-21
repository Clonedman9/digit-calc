#!/usr/bin/env node
'use strict';
// Reproducible before/after comparisons. Pass a historical app.js path for the baseline.
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const C = require('../assets/core.js');
const filename = process.argv[2];
if (!filename) throw Error('Usage: node scripts/benchmark.cjs BASELINE_APP_JS');
let source = fs.readFileSync(filename, 'utf8');
const cut = source.indexOf('  /* ---------------- 初始化 ---------------- */');
if (cut < 0) throw Error('Missing baseline init marker');
source = source.slice(0, cut) + 'globalThis.baseline = { S: S, genForMode: genForMode, buildQueue: buildQueue, renderStats: renderStats };\n})();';
const element = () => ({ addEventListener() {}, querySelectorAll: () => [], querySelector: () => element(), classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, style: { setProperty() {} }, setAttribute() {}, getAttribute: () => '', value: 2, min: 1, max: 6, innerHTML: '', textContent: '' });
const doc = { getElementById: () => element(), querySelectorAll: () => [], addEventListener() {}, documentElement: { getAttribute: () => 'light' } };
const baseline = vm.createContext({ document: doc, window: { addEventListener() {}, getComputedStyle: () => ({ fontSize: '40px' }) }, Math, BigInt, Number, Date, performance, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, setInterval, clearInterval, cancelAnimationFrame() {}, requestAnimationFrame() {} });
vm.runInContext(source, baseline);
const old = baseline.baseline;
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function median(samples) { return samples.sort((a, b) => a - b)[samples.length >> 1]; }
function measure(fn, n = 9) { const samples = []; for (let i = 0; i < n; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); } return median(samples); }
function compare(label, before, after, extra) {
  before(); after();
  const b = measure(before), a = measure(after);
  return { label, beforeMs: +b.toFixed(3), afterMs: +a.toFixed(3), ratio: +(b / a).toFixed(2), ...extra };
}
const c = { ops: [...C.OPS], dg: Object.fromEntries(C.OPS.map(op => [op, { a: 6, b: 6 }])), cnt: Object.fromEntries(C.OPS.map(op => [op, 999])), carry: 2 };
old.S.dg = c.dg; old.S.cnt = c.cnt;
const result = [];
old.S.ops = ['+']; old.S.carry = 2;
result.push(compare('1000 six-digit no-carry additions', () => { for (let i = 0; i < 1000; i++) old.genForMode('+'); }, () => { const r = random(123); for (let i = 0; i < 1000; i++) C.generateFor(c, '+', r); }, { questions: 1000 }));
old.S.ops = [...C.OPS]; old.S.carry = 0; c.carry = 0;
result.push(compare('3996-question startup preparation', () => old.buildQueue(), () => C.buildSchedule(c, random(77)), { questionCount: 3996, oldQuestionObjects: 3996, newQuestionObjects: 0 }));
const now = Date.now();
const records = Array.from({ length: 2000 }, (_, i) => ({ t: now - (2000 - i) * 1234567, op: C.OPS[i % 4], la: 1 + i % 6, lb: 1 + i % 6, ok: +(i % 5 !== 0), sec: 1 + i % 18, carry: i % 2 }));
old.S.records = records; old.S.stRange = 'all';
result.push(compare('2000-record statistics (old aggregation+HTML vs new uncached aggregation)', () => old.renderStats(), () => C.aggregateRecords(records, 0, now), { note: 'New number excludes DOM/HTML; use the browser DOM benchmark for end-to-end render comparisons.' }));
function oldStorageWrites() { for (let i = 0; i < 100; i++) JSON.stringify(records); }
function newStorageWrites() { JSON.stringify(records); }
result.push(compare('100 rapid answer persistence snapshots', oldStorageWrites, newStorageWrites, { oldSerializations: 100, newSerializations: 1, note: 'Burst coalescing; localStorage I/O excluded.' }));
console.log(JSON.stringify({ node: process.version, platform: process.platform, baseline: filename, samples: 9, statistic: 'median', results: result }, null, 2));
