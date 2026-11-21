'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../assets/core.js');
function rng(seed = 123456789) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function config(overrides) {
  return { ops: [...Core.OPS], dg: Object.fromEntries(Core.OPS.map(op => [op, { a: 2, b: 2 }])), cnt: Object.fromEntries(Core.OPS.map(op => [op, 10])), carry: 0, ...overrides };
}
function assertQuestion(q, op, a, b, carry) {
  assert.ok(q, [op, a, b, carry].join('/'));
  assert.equal(String(q.a).length, a); assert.equal(String(q.b).length, b); assert.ok(q.ans > 0);
  if (op === '×' || op === '÷') assert.ok(q.a >= 2n && q.b >= 2n);
  if (op === '÷') { assert.ok(Number(q.ans) >= 2); assert.ok(Math.abs(Number(q.a) / Number(q.b) - Number(q.ans)) < 1e-9); }
  else assert.equal(q.ans, op === '+' ? q.a + q.b : op === '−' ? q.a - q.b : q.a * q.b);
  if (carry) assert.equal(Core.carryInfo(q), carry === 1);
  assert.equal(Core.gradeAnswer(q, String(q.ans), 0).correct, true);
}
test('pure core runs without DOM in Node and exposes a frozen browser API', () => {
  assert.equal(Object.isFrozen(Core), true); assert.equal(Object.isFrozen(Core.OPS), true);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/core.js'), 'utf8'), context);
  assert.equal(context.DigitCalcCore.p10(6), 1000000n);
});
test('all valid operator/digit/carry combinations satisfy invariants across 63800 seeded questions', () => {
  const random = rng(); let count = 0;
  for (const op of Core.OPS) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let carry = 0; carry <= 2; carry++) {
    const c = config({ dg: { [op]: { a, b } }, carry });
    if (!Core.isConfigValid(c, op)) continue;
    for (let i = 0; i < 200; i++) { assertQuestion(Core.generateFor(c, op, random), op, a, b, carry); count++; }
  }
  assert.equal(count, 63800);
});
test('bounded constructive generation also works with deterministic endpoint random sources', () => {
  for (const random of [() => 0, () => 1 - Number.EPSILON]) {
    for (const op of Core.OPS) for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let carry = 0; carry <= 2; carry++) {
      const c = config({ dg: { [op]: { a, b } }, carry });
      if (Core.isConfigValid(c, op)) assertQuestion(Core.generateFor(c, op, random), op, a, b, carry);
    }
  }
});
test('digit DP samples the complete one-digit carry-constrained support', () => {
  for (const op of ['+', '−']) for (const carry of [1, 2]) {
    const expected = new Set();
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
      if (op === '−' && a <= b) continue;
      const q = { a: BigInt(a), b: BigInt(b), op, ans: op === '+' ? BigInt(a + b) : BigInt(a - b) };
      if (Core.carryInfo(q) === (carry === 1)) expected.add(a + ':' + b);
    }
    const observed = new Set(); const random = rng(101 + carry);
    for (let i = 0; i < 10000; i++) { const q = Core.sampleDigitPair(op, 1, 1, carry, random); if (q) observed.add(q.a + ':' + q.b); }
    assert.deepEqual(observed, expected);
  }
});
test('no-carry multiplication reaches every valid single-digit pair without ×1', () => {
  const got = new Set(), random = rng(44);
  for (let i = 0; i < 3000; i++) { const q = Core.genMul(1, 1, 2, random); got.add(q.a + ':' + q.b); }
  assert.deepEqual(got, new Set(['2:2', '2:3', '2:4', '3:2', '3:3', '4:2']));
});
test('subtraction stays positive with selected digit widths, including equal random samples', () => {
  const c = config({ dg: { '−': { a: 1, b: 1 } } });
  for (const random of [() => 0, () => 1 - Number.EPSILON]) {
    const q = Core.generateFor(c, '−', random); assert.ok(q.a > q.b); assert.equal(String(q.a).length, 1); assert.equal(String(q.b).length, 1);
  }
});
test('invalid digit/order/retreat combinations return explicit errors rather than relaxing rules', () => {
  for (const [op, a, b, carry] of [['−', 1, 2, 0], ['÷', 1, 2, 0], ['÷', 2, 1, 2], ['−', 1, 1, 1], ['÷', 1, 1, 1], ['+', 7, 2, 0]]) {
    const c = config({ ops: [op], dg: { [op]: { a, b } }, carry });
    assert.equal(Core.isConfigValid(c, op), false); assert.equal(Core.generateFor(c, op), null); assert.ok(Core.validateQueueOps(c, [op]));
  }
});
test('schedule preserves exact per-operator counts and allocates no question objects', () => {
  const c = config({ cnt: { '+': 999, '−': 999, '×': 999, '÷': 999 } });
  let calls = 0;
  const schedule = Core.buildSchedule(c, () => { calls++; return 0.5; });
  assert.equal(schedule.length, 3996); assert.equal(calls, 3995);
  for (const op of Core.OPS) assert.equal(schedule.filter(x => x === op).length, 999);
  assert.ok(schedule.every(x => typeof x === 'string'));
});
test('empty question counts and invalid selections fail before shuffling', () => {
  assert.equal(Core.buildSchedule(config({ cnt: { '+': 0, '−': 0, '×': 0, '÷': 0 } })), null);
  let calls = 0;
  const c = config({ ops: ['−'], dg: { '−': { a: 1, b: 2 } } });
  assert.ok(Core.buildSchedule(c, () => { calls++; return 0; }).error); assert.equal(calls, 0);
});
test('exact rational grading handles decimal and 12-digit answers without float tolerance', () => {
  for (const [q, answer] of [[{ op: '÷', ans: 14.4 }, '14.4000'], [{ op: '+', ans: 42n }, '42.0'], [{ op: '×', ans: 999998000001n }, '999998000001']]) {
    assert.equal(Core.gradeAnswer(q, answer, 0).correct, true);
  }
  assert.equal(Core.gradeAnswer({ op: '÷', ans: 2 }, '2.0000000001', 0).correct, false);
});
test('percentage tolerance includes exact boundaries using integer arithmetic', () => {
  for (const answer of ['13.68', '15.12']) assert.deepEqual(Core.gradeAnswer({ op: '÷', ans: 14.4 }, answer, 5), { valid: true, correct: true, approx: true, raw: answer });
  for (const answer of ['13.679999999', '15.120000001']) assert.equal(Core.gradeAnswer({ op: '÷', ans: 14.4 }, answer, 5).correct, false);
  assert.equal(Core.gradeAnswer({ op: '+', ans: 40n }, '38', 5).correct, false);
});
test('answer parsing rejects malformed and overlength inputs', () => {
  for (const raw of ['', '.', '-1', '1e2', 'Infinity', 'NaN', '1.2.3', '1'.repeat(25), '<script>']) assert.equal(Core.gradeAnswer({ op: '+', ans: 1n }, raw, 0).valid, false);
});
test('input commands are identical for touch and physical keyboards', () => {
  assert.equal(Core.nextInput('', '.'), ''); assert.equal(Core.nextInput('1.', '.'), '1.');
  assert.equal(Core.nextInput('12', 'back'), '1'); assert.equal(Core.nextInput('12', 'clear'), '');
  assert.equal(Core.nextInput('1'.repeat(24), '2'), '1'.repeat(24)); assert.equal(Core.nextInput('12', 'Enter'), '12');
});
test('record validation preserves the newest valid 2000 entries and sorts only a copy', () => {
  const records = Array.from({ length: 2100 }, (_, t) => ({ t, op: '+', la: 2, lb: 2, ok: 1, sec: 2, carry: 0 }));
  const raw = [...records, null, {}, { ...records[0], t: NaN }];
  const got = Core.sanitizeRecords(raw); assert.equal(got.length, 2000); assert.equal(got[0].t, 100); assert.equal(got.at(-1).t, 2099); assert.equal(raw.length, 2103);
});
test('all analytics buckets and streaks match a simple reference including out-of-order records', () => {
  const now = new Date(2026, 10, 21, 12).getTime(), random = rng(22);
  const records = Array.from({ length: 2000 }, (_, i) => ({ t: now - (i % 17) * 86400000 + i * 1000, op: Core.OPS[i % 4], la: 1 + i % 6, lb: 1 + i % 6, ok: +(random() > 0.3), sec: i % 18, carry: i % 2 })).reverse();
  const before = records.map(x => x.t);
  for (const range of ['all', '7', '1']) {
    const from = Core.rangeStart(range, now), a = Core.aggregateRecords(records, from, now);
    const rows = records.filter(r => r.t >= from).sort((x, y) => x.t - y.t);
    assert.equal(a.n, rows.length); assert.equal(a.ok, rows.reduce((n, r) => n + r.ok, 0)); assert.equal(a.sec, rows.reduce((n, r) => n + r.sec, 0));
    for (const op of Core.OPS) {
      const chosen = rows.filter(r => r.op === op);
      assert.equal(a.byOp[op].n, chosen.length); assert.equal(a.byOp[op].ok, chosen.reduce((n, r) => n + r.ok, 0)); assert.equal(a.byOp[op].sec, chosen.reduce((n, r) => n + r.sec, 0));
    }
    const dates = new Set(rows.map(r => Core.dayKey(r.t))); assert.equal(a.byDay.size, dates.size);
    let best = 0, streak = 0; for (const r of rows) { streak = r.ok ? streak + 1 : 0; best = Math.max(best, streak); } assert.equal(a.bestStreak, best);
    assert.equal(a.time.reduce((x, y) => x + y, 0), rows.length); assert.equal(a.byLength.reduce((n, r) => n + r.n, 0), rows.length);
    for (const day of a.series) {
      const count = rows.filter(r => { const d = new Date(r.t); return (d.getMonth() + 1) + '/' + d.getDate() === day.label; }).length;
      assert.equal(day.cnt, count);
    }
  }
  assert.deepEqual(records.map(x => x.t), before);
});
test('sessions use a >5-minute gap and retain the last ten sessions', () => {
  const now = Date.now();
  const rows = Array.from({ length: 15 }, (_, i) => ({ t: now + i * 300001, op: '+', la: 2, lb: 2, ok: 1, sec: 2, carry: 0 }));
  const a = Core.aggregateRecords(rows, 0, now); assert.equal(a.sessions.length, 10); assert.equal(a.sessions[0].start, rows[5].t);
});
test('ring review buffer holds a constant-size chronological window for 150000 answers', () => {
  const buffer = Core.createRingBuffer(2000);
  for (let i = 0; i < 150000; i++) buffer.push(i);
  assert.equal(buffer.size, 2000); assert.equal(buffer.toArray()[0], 148000); assert.equal(buffer.toArray().at(-1), 149999);
});
test('review content escapes every HTML-sensitive character', () => {
  assert.equal(Core.escapeHTML('<img src=x onerror="alert(1)">&\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
});
