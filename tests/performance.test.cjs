'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../assets/core.js');
const { context, fakeClock } = require('./helpers/app.cjs');
function state() { return { ops: ['+'], dg: { '+': { a: 2, b: 2 } }, cnt: { '+': 10 }, unlimited: false, limit: 0, carry: 0, divTol: 0, showMs: 0, adaptShow: false, adaptMin: 100, records: [] }; }
function persistence() { return { settingsTimer: null, recordsTimer: null, settingsJSON: null, recordsDirty: false }; }
test('settings slider storms debounce to one write; unchanged flushes perform no writes', () => {
  const clock = fakeClock(), writes = [], p = persistence();
  const ctx = context({ S: state(), UI: { ready: true }, persistence: p, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, localStorage: { setItem: (key, val) => writes.push([key, val]) } }, ['saveSettings', 'scheduleSettingsSave']);
  for (let i = 0; i < 100; i++) { ctx.S.limit = i; ctx.scheduleSettingsSave(); }
  assert.equal(clock.jobs.size, 1); assert.equal(writes.length, 0);
  clock.run(p.settingsTimer); assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0][1]).limit, 99);
  ctx.saveSettings(); ctx.saveSettings(); assert.equal(writes.length, 1);
});
test('record writes coalesce and flush the latest state at an explicit lifecycle boundary', () => {
  const clock = fakeClock(), writes = [], p = persistence();
  const ctx = context({ S: state(), persistence: p, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, localStorage: { setItem: (key, val) => writes.push([key, val]) } }, ['saveRecords', 'scheduleRecordsSave']);
  for (let i = 0; i < 40; i++) { ctx.S.records.push({ t: i }); ctx.scheduleRecordsSave(); }
  assert.equal(clock.jobs.size, 1); assert.equal(writes.length, 0); assert.equal(clock.jobs.get(p.recordsTimer).delay, 500);
  ctx.saveRecords(); assert.equal(clock.jobs.size, 0); assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0][1]).length, 40);
  ctx.saveRecords(); assert.equal(writes.length, 1);
});
test('failed record storage remains dirty and can retry', () => {
  const p = persistence(); p.recordsDirty = true; let blocked = true;
  const ctx = context({ S: state(), persistence: p, clearTimeout() {}, localStorage: { setItem() { if (blocked) throw Error('quota'); } } }, ['saveRecords']);
  ctx.saveRecords(); assert.equal(p.recordsDirty, true); blocked = false; ctx.saveRecords(); assert.equal(p.recordsDirty, false);
});
test('analytics cache reuses aggregates until records, range or local day changes', () => {
  let now = new Date(2026, 10, 21, 12).getTime(), calls = 0;
  const UI = { recordsVersion: 0, statsCache: new Map(), lastStatsRender: null };
  const fakeCore = { ...Core, aggregateRecords: (...args) => { calls++; return Core.aggregateRecords(...args); } };
  const ctx = context({ S: state(), UI, Core: fakeCore, Date: class extends Date { static now() { return now; } } }, ['getStats', 'markStatsDirty']);
  const a = ctx.getStats('all'); assert.equal(ctx.getStats('all'), a); assert.equal(calls, 1);
  ctx.getStats('1'); assert.equal(calls, 2);
  ctx.markStatsDirty(); assert.notEqual(ctx.getStats('all'), a); assert.equal(calls, 3);
  now += 86400000; ctx.getStats('all'); assert.equal(calls, 4);
});
test('cached analytics render avoids rewriting graph DOM on repeated opens', () => {
  const a = {}; const UI = { lastStatsRender: a };
  const ctx = context({ UI, S: { stRange: 'all' }, getStats: () => a }, ['renderStats']);
  assert.doesNotThrow(() => ctx.renderStats());
});
test('timer cleanup clears both periodic UI updates and the deadline handle', () => {
  const intervals = [], timeouts = [];
  const ctx = context({ S: { tick: 3, deadlineTimer: 5 }, clearInterval: id => intervals.push(id), clearTimeout: id => timeouts.push(id) }, ['stopTimer']);
  ctx.stopTimer(); ctx.stopTimer(); assert.deepEqual(intervals, [3]); assert.deepEqual(timeouts, [5]);
  assert.equal(ctx.S.tick, null); assert.equal(ctx.S.deadlineTimer, null);
});
test('hidden tabs flush persistence and suspend visual timers without changing deadlines', () => {
  let flushed = 0, cleared = 0;
  const ctx = context({ document: { hidden: true }, flushPersistence: () => { flushed++; }, clearInterval: () => { cleared++; }, S: { tick: 8, deadlineTimer: 9 } }, ['reconcileVisibility']);
  ctx.reconcileVisibility(); assert.equal(flushed, 1); assert.equal(cleared, 1); assert.equal(ctx.S.tick, null); assert.equal(ctx.S.deadlineTimer, 9);
});
test('returning to a throttled tab settles expiration before restarting visual timers', () => {
  let intervals = 0;
  const S = { locked: false, tick: null };
  const ctx = context({ document: { hidden: false }, S, els: { drill: { classList: { contains: () => true } } }, updateTimer: () => { S.locked = true; }, setInterval: () => { intervals++; } }, ['reconcileVisibility']);
  ctx.reconcileVisibility(); assert.equal(intervals, 0);
});
test('review rendering escapes stored text and initially renders only 100 rows', () => {
  const inserted = []; const buttons = [];
  const rows = Array.from({ length: 2000 }, () => ({ expr: '<bad>', user: '"answer"', ans: '42', ok: false }));
  const UI = { reviewRows: [], reviewCursor: 0, reviewNote: {} };
  const list = { scrollTop: 77, innerHTML: '', querySelector: () => null, insertAdjacentHTML: (_, html) => inserted.push(html), appendChild: b => buttons.push(b) };
  const ctx = context({ Core, S: { log: rows, reviewMode: 'all', timeCount: 2500, reviewLimit: 2000 }, UI, els: { reviewList: list }, document: { createElement: () => ({ setAttribute() {} }) } }, ['appendReviewRows', 'renderReview']);
  ctx.renderReview(); assert.equal(UI.reviewCursor, 100); assert.equal(inserted[0].match(/class="review-row"/g).length, 100);
  assert.ok(inserted[0].includes('&lt;bad&gt;')); assert.equal(buttons.length, 1); assert.equal(UI.reviewNote.hidden, false);
  ctx.appendReviewRows(); assert.equal(UI.reviewCursor, 200);
});

test('rolling seven-day statistics cache expires exactly when a record ages out', () => {
  let now = new Date(2026, 10, 21, 12).getTime(), calls = 0;
  const edge = now - 7 * 86400000 + 1000;
  const UI = { recordsVersion: 0, statsCache: new Map(), lastStatsRender: null };
  const S = state(); S.records = [{ t: edge, op: '+', la: 2, lb: 2, ok: 1, sec: 1, carry: 0 }];
  const fakeCore = { ...Core, aggregateRecords: (...args) => { calls++; return Core.aggregateRecords(...args); } };
  const ctx = context({ S, UI, Core: fakeCore, Date: class extends Date { static now() { return now; } } }, ['getStats']);
  const first = ctx.getStats('7'); assert.equal(first.n, 1);
  now += 1000; assert.equal(ctx.getStats('7'), first); assert.equal(calls, 1);
  now += 1; assert.equal(ctx.getStats('7').n, 0); assert.equal(calls, 2);
});

test('early deadline timer callback rearms rather than losing expiration while hidden', () => {
  const clock = fakeClock(); let now = 0;
  const S = { locked: false, limit: 1, qid: 7, tick: null, deadlineTimer: null };
  const ctx = context({ S, performance: { now: () => now }, document: { hidden: true }, stopTimer() {}, setTimeout: clock.setTimeout,
    setInterval() { throw Error('hidden tab UI timer'); }, updateTimer() { if(now >= 1000) S.locked = true; } }, ['startTimer']);
  ctx.startTimer(); now = 999; clock.run(S.deadlineTimer);
  assert.equal(S.locked, false); assert.equal(clock.jobs.size, 1);
  now = 1000; clock.run(S.deadlineTimer); assert.equal(S.locked, true); assert.equal(clock.jobs.size, 0);
});
