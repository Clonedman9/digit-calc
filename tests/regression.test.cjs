'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../assets/core.js');
const { fn, context, fakeClock, script } = require('./helpers/app.cjs');

test('application and pure-core JavaScript syntax remain valid', () => {
  new vm.Script(script);
  new vm.Script(fs.readFileSync(path.join(__dirname, '../assets/core.js'), 'utf8'));
});
test('integer division includes exactly divisible lower bound', () => {
  const samples = [0, 0.9, 0];
  const q = Core.tryDiv(2, 1, () => samples.shift() ?? 0);
  assert.equal(q.a, 10n); assert.equal(q.b, 2n); assert.equal(q.ans, 5n);
});
test('late answer is timeout even before interval fires', () => {
  let args;
  const ctx = context({ S: { locked: false, limit: 1, t0: 0 }, performance: { now: () => 1000 }, resolve: (...a) => { args = a; } }, ['submit']);
  ctx.submit(); assert.deepEqual(args, [false, null, true]);
});
test('valid in-time integer answer still passes', () => {
  let args;
  const ctx = context({ Core, S: { locked: false, limit: 1, t0: 0, divTol: 0, cur: { op: '+', ans: 42n } }, els: { answer: { value: '42' } }, performance: { now: () => 999 }, resolve: (...a) => { args = a; } }, ['submit']);
  ctx.submit(); assert.deepEqual(args, [true, '42', false, false]);
});
test('records reject wrong shape, corrupt JSON and malformed entries; cap at 2000', () => {
  let raw;
  const ctx = context({ Core, S: {}, markStatsDirty() {}, localStorage: { getItem: () => raw } }, ['loadRecords']);
  for (raw of ['{}', 'null', 'broken', '[null,{}, {"op":"<script>"}]']) { ctx.loadRecords(); assert.equal(ctx.S.records.length, 0); }
  const valid = { t: 1, op: '+', la: 2, lb: 2, ok: 1, sec: 0.5, carry: 0 };
  raw = JSON.stringify(Array.from({ length: 2005 }, () => valid)); ctx.loadRecords(); assert.equal(ctx.S.records.length, 2000);
});
test('finish invalidates pending callbacks and settles 150000 answers with constant-size counters', () => {
  const ctx = context({
    S: { qid: 4, hideTimer: 1, nextTimer: 2, ok: 150000, bad: 0, timeCount: 150000, timeTotal: 15000, fastest: 0.1, startClock: 0, maxStreak: 150000, reviewBuffer: Core.createRingBuffer(2000) },
    stopTimer() {}, clearTimeout() {}, flushPersistence() {}, performance: { now: () => 15000000 }, fmtTime: String, show() {},
    els: { scoreBig: {}, scoreSub: {}, kpiAvg: {}, kpiStreak: {}, kpiFast: {}, kpiTotal: {}, wrongCard: { style: {} }, retryWrongBtn: { style: {} } }
  }, ['finish']);
  ctx.finish(); assert.equal(ctx.S.qid, 5); assert.equal(ctx.S.locked, true); assert.equal(ctx.els.kpiFast.textContent, '0.1'); assert.equal(ctx.els.kpiAvg.textContent, '0.1');
  assert.equal(ctx.S.nextTimer, null);
});
test('skip after deadline records timeout, clamps timing and preserves blind answering', () => {
  const clock = fakeClock(); let dirty = 0;
  const ctx = context({
    Core, S: { locked: false, limit: 1, t0: 0, qid: 3, cur: { op: '+', a: 20n, b: 22n, ans: 42n }, timeTotal: 0, timeCount: 0, fastest: Infinity, ok: 0, bad: 0, streak: 0, records: [], reviewBuffer: Core.createRingBuffer(2000) },
    performance: { now: () => 1500 }, Date, stopTimer() {}, clearTimeout: clock.clearTimeout, setTimeout: clock.setTimeout,
    exprText: q => q.a + ' ' + q.op + ' ' + q.b + ' =', carryInfo: Core.carryInfo, adaptActive: () => false,
    markStatsDirty: () => { dirty++; }, scheduleRecordsSave() {},
    els: { qcard: { classList: { remove() {} } }, qMark: {}, drill: { classList: { contains: () => false } } }
  }, ['resolve']);
  ctx.resolve(true, '42', false, false);
  assert.equal(ctx.S.ok, 0); assert.equal(ctx.S.bad, 1); assert.equal(ctx.S.timeTotal, 1);
  const record = ctx.S.reviewBuffer.toArray()[0]; assert.equal(record.timeout, true); assert.equal(record.user, null); assert.equal(record.ok, false);
  assert.equal(ctx.S.records[0].sec, 1); assert.equal(dirty, 1); assert.equal(ctx.els.qMark.textContent, '');
});
test('failed settings validation leaves the previous session intact', () => {
  const old = { ok: 2, log: ['retained'] };
  const ctx = context({ S: { ...old, ops: ['−'], unlimited: false }, toast() {}, buildQueue: () => ({ error: 'adjust settings' }) }, ['startRun']);
  ctx.startRun(null); assert.equal(ctx.S.ok, 2); assert.deepEqual(ctx.S.log, ['retained']);
});
