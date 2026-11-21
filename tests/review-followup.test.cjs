'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../assets/core.js');
const { context } = require('./helpers/app.cjs');

test('adaptive display remains monotonic across every supported baseline including 60000ms', () => {
  for (const base of [50, 100, 500, 1000, 2000, 5000, 10000, 20000, 45000, 60000]) {
    const cap = Math.min(60000, Math.max(base * 2, 3000));
    for (const current of [base, Math.min(cap, base * 1.3), cap]) {
      const shorter = Core.nextAdaptiveShow(current, base, 20, true);
      const longer = Core.nextAdaptiveShow(current, base, 20, false);
      assert.ok(shorter <= current, 'correct should shorten: ' + base);
      assert.ok(longer >= current, 'wrong should lengthen or stay capped: ' + base);
      assert.ok(shorter >= 20 && longer <= cap);
    }
  }
  assert.equal(Core.nextAdaptiveShow(20000, 20000, 100, false), 26000);
  assert.equal(Core.nextAdaptiveShow(60000, 60000, 100, false), 60000);
  assert.equal(Core.nextAdaptiveShow(60000, 60000, 100, true), 48000);
});

test('adaptive sequence respects the configured floor and cap during long alternating runs', () => {
  for (const base of [50, 500, 5000, 45000, 60000]) {
    const floor = Math.min(100, Math.round(base * 0.8 / 10) * 10);
    const cap = Math.min(60000, Math.max(base * 2, 3000));
    let current = base;
    for (let i = 0; i < 1000; i++) {
      const correct = i % 9 < 5;
      const next = Core.nextAdaptiveShow(current, base, floor, correct);
      assert.ok(next >= floor && next <= cap);
      assert.ok(correct ? next <= current : next >= current);
      current = next;
    }
  }
});

test('division retreat and multiplication partial-product carry retain the explicit legacy contract', () => {
  const division = { a: 84n, b: 2n, ans: 42n, op: '÷' };
  assert.equal(Core.carryInfo(division), false);
  assert.equal(Core.isConfigValid({ dg: { '÷': { a: 2, b: 1 } }, carry: 2 }, '÷'), false);
  // Here the final addition of partial rows carries, but each individual product row does not.
  assert.equal(Core.mulCarry(222n, 222n), false);
  assert.equal(Core.mulCarry(25n, 2n), true);
});

test('a new session releases old review DOM and cursor state before creating the next question', () => {
  let cleared = 0, shown;
  const ctx = context({
    Core,
    S: { ops: ['+'], showMs: 0, unlimited: false, qid: 1 },
    UI: { reviewRows: ['old'], reviewCursor: 100, reviewNote: { hidden: false, textContent: 'old' } },
    els: { reviewList: { replaceChildren() { cleared++; } } },
    pendingPointerClicks: new Map(),
    stopTimer() {}, clearTimeout() {}, performance: { now: () => 0 }, saveSettings() {},
    show: name => { shown = name; }, nextQuestion() {}
  }, ['startRun']);
  ctx.startRun([{ a: 20n, b: 22n, ans: 42n, op: '+' }]);
  assert.equal(cleared, 1); assert.equal(ctx.UI.reviewRows.length, 0); assert.equal(ctx.UI.reviewCursor, 0);
  assert.equal(ctx.UI.reviewNote.hidden, true); assert.equal(ctx.UI.reviewNote.textContent, ''); assert.equal(shown, 'drill');
});
