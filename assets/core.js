/* Pure calculation and analytics core. Shared by the browser, offline build and Node tests. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DigitCalcCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OPS = Object.freeze(['+', '−', '×', '÷']);
  const MAX_DIGITS = 6;
  const RECORD_LIMIT = 2000;
  const ANSWER_LIMIT = 24;
  const POWERS = Object.freeze(Array.from({ length: MAX_DIGITS + 1 }, (_, i) => 10n ** BigInt(i)));
  const MUL_PAIRS = Object.freeze(Array.from({ length: 8 }, (_, i) => i + 2)
    .flatMap(a => Array.from({ length: 8 }, (_, i) => i + 2).filter(b => a * b >= 10).map(b => [a, b])));
  const digitPlans = new Map();
  const mulPlans = new Map();

  function p10(n) { return POWERS[n]; }
  function randomInt(size, random) { return Math.floor((random || Math.random)() * size); }
  function randBetween(lo, hi, random) {
    return hi >= lo ? lo + BigInt(randomInt(Number(hi - lo + 1n), random)) : lo;
  }
  function randBig(n, random, excludeOne) {
    const lo = excludeOne && n === 1 ? 2n : p10(n - 1);
    return randBetween(lo, p10(n) - 1n, random);
  }
  function digitsOf(value) {
    const text = value.toString(), digits = [];
    for (let i = text.length - 1; i >= 0; i--) digits.push(text.charCodeAt(i) - 48);
    return digits;
  }
  function addCarry(a, b) {
    const A = digitsOf(a), B = digitsOf(b);
    return A.some((v, i) => v + (B[i] || 0) >= 10) || B.some((v, i) => v + (A[i] || 0) >= 10);
  }
  function subBorrow(a, b) {
    const A = digitsOf(a), B = digitsOf(b);
    return A.some((v, i) => v < (B[i] || 0));
  }
  function mulCarry(a, b) {
    // If every single digit product is below ten, no partial product row carries.
    const maxA = digitsOf(a).reduce((best, digit) => Math.max(best, digit), 0);
    const maxB = digitsOf(b).reduce((best, digit) => Math.max(best, digit), 0);
    return maxA * maxB >= 10;
  }
  function carryInfo(q) {
    if (q.op === '+') return addCarry(q.a, q.b);
    if (q.op === '−') return subBorrow(q.a, q.b);
    if (q.op === '×') return mulCarry(q.a, q.b);
    return String(q.ans).split('.')[0].length < q.a.toString().length;
  }
  function isConfigValid(config, op) {
    const d = config.dg && config.dg[op];
    if (!OPS.includes(op) || !d || !Number.isInteger(d.a) || !Number.isInteger(d.b)
      || d.a < 1 || d.b < 1 || d.a > MAX_DIGITS || d.b > MAX_DIGITS) return false;
    if ((op === '−' || op === '÷') && d.a < d.b) return false;
    // Keep the application's existing division/retreat selection contract.
    if (op === '÷' && (config.carry === 2 || (config.carry === 1 && d.a === 1 && d.b === 1))) return false;
    if (op === '−' && d.a === 1 && d.b === 1 && config.carry === 1) return false;
    return true;
  }
  function validateQueueOps(config, ops) {
    for (const op of ops) {
      if (isConfigValid(config, op)) continue;
      const d = config.dg && config.dg[op];
      if ((op === '−' || op === '÷') && d && d.a < d.b) return op + '：A 位数需大于或等于 B 位数，请调整设置';
      if (op === '÷') return '÷：当前位数与退位规则无可用题目，请调整设置';
      if (op === '−') return '−：两个一位非负数相减不产生借位，请调整规则';
      return '请检查运算与数字位数设置';
    }
    return '';
  }

  // Cache a tiny digit-DP plan. Sample an exact valid pair by rank, without rejection loops.
  // Counts stay below 10^12 (six digits per operand), within exact Number integer precision.
  function digitPlan(op, da, db, mode) {
    const key = [op, da, db, mode].join(':');
    if (digitPlans.has(key)) return digitPlans.get(key);
    const size = Math.max(da, db), states = new Map();
    function build(pos, incoming, seen, different) {
      const id = pos * 8 + incoming * 4 + seen * 2 + different;
      if (states.has(id)) return states.get(id);
      const node = { total: 0, options: [] };
      states.set(id, node);
      if (pos === size) {
        node.total = (mode !== 1 || seen) && (mode !== 2 || !seen)
          && (op !== '−' || (!incoming && different)) ? 1 : 0;
        return node;
      }
      const aMin = pos === da - 1 ? 1 : 0, aMax = pos < da ? 9 : 0;
      const bMin = pos === db - 1 ? 1 : 0, bMax = pos < db ? 9 : 0;
      for (let a = aMin; a <= aMax; a++) {
        for (let b = bMin; b <= bMax; b++) {
          const outgoing = op === '+' ? +(a + b + incoming >= 10) : +(a - b - incoming < 0);
          if (mode === 2 && outgoing) continue;
          const tail = build(pos + 1, outgoing, (seen || outgoing) ? 1 : 0, (different || a !== b) ? 1 : 0);
          if (!tail.total) continue;
          node.total += tail.total;
          node.options.push({ a, b, tail, end: node.total });
        }
      }
      return node;
    }
    const plan = build(0, 0, 0, 0);
    digitPlans.set(key, plan);
    return plan;
  }
  function sampleDigitPair(op, da, db, mode, random) {
    let node = digitPlan(op, da, db, mode);
    if (!node.total) return null;
    let rank = randomInt(node.total, random), a = 0, b = 0, place = 1;
    for (let pos = 0; pos < Math.max(da, db); pos++) {
      let lo = 0, hi = node.options.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (rank < node.options[mid].end) hi = mid;
        else lo = mid + 1;
      }
      const option = node.options[lo];
      rank -= lo ? node.options[lo - 1].end : 0;
      a += option.a * place; b += option.b * place; place *= 10;
      node = option.tail;
    }
    const A = BigInt(a), B = BigInt(b);
    return { a: A, b: B, op, ans: op === '+' ? A + B : A - B };
  }

  function maxDigitCount(length, max) {
    if (length === 1) return max >= 2 ? 1 : 0;
    return max * (max + 1) ** (length - 1) - (max - 1) * max ** (length - 1);
  }
  function sampleMaxDigits(length, max, random) {
    if (length === 1) return BigInt(max);
    let rank = randomInt(maxDigitCount(length, max), random), seen = false, value = 0;
    for (let pos = 0; pos < length; pos++) {
      const left = length - pos - 1;
      for (let d = pos === 0 ? 1 : 0; d <= max; d++) {
        const weight = seen || d === max ? (max + 1) ** left : (max + 1) ** left - max ** left;
        if (rank >= weight) { rank -= weight; continue; }
        value = value * 10 + d; seen = seen || d === max; break;
      }
    }
    return BigInt(value);
  }
  function genMul(da, db, mode, random) {
    let a, b;
    if (mode === 2) {
      const key = da + ':' + db;
      let plan = mulPlans.get(key);
      if (!plan) {
        plan = { total: 0, options: [] };
        for (let maxA = 1; maxA <= 9; maxA++) {
          for (let maxB = 1; maxA * maxB < 10 && maxB <= 9; maxB++) {
            const count = maxDigitCount(da, maxA) * maxDigitCount(db, maxB);
            if (!count) continue;
            plan.total += count;
            plan.options.push({ maxA, maxB, end: plan.total });
          }
        }
        mulPlans.set(key, plan);
      }
      const rank = randomInt(plan.total, random);
      const group = plan.options.find(x => rank < x.end);
      a = sampleMaxDigits(da, group.maxA, random); b = sampleMaxDigits(db, group.maxB, random);
    } else if (mode === 1) {
      const pair = MUL_PAIRS[randomInt(MUL_PAIRS.length, random)];
      a = da === 1 ? BigInt(pair[0]) : randBig(da - 1, random) * 10n + BigInt(pair[0]);
      b = db === 1 ? BigInt(pair[1]) : randBig(db - 1, random) * 10n + BigInt(pair[1]);
    } else {
      a = randBig(da, random, true); b = randBig(db, random, true);
    }
    return { a, b, op: '×', ans: a * b };
  }

  function tryDivDec(dd, b, random, mode) {
    let g = 1n;
    if (b % 2n === 0n) g *= 2n;
    if (b % 5n === 0n) g *= 5n;
    if (g === 1n) return null;
    const step = b / g;
    let lo = (p10(dd - 1) + step - 1n) / step, hi = (p10(dd) - 1n) / step;
    if (lo < 2n * g) lo = 2n * g;
    if (mode === 1 && hi >= p10(dd - 1) * g) hi = p10(dd - 1) * g - 1n;
    if (hi < lo) return null;
    // At most ten residues, so a bounded scan finds a non-integer quotient if one exists.
    const start = randBetween(lo, hi, random), width = hi - lo + 1n;
    for (let i = 0n; i < g && i < width; i++) {
      const m = lo + (start - lo + i) % width;
      if (m % g !== 0n) return { a: m * step, b, ans: Number(m) / Number(g) };
    }
    return null;
  }
  function tryDiv(dd, bd, random, mode) {
    const loB = p10(bd - 1) < 2n ? 2n : p10(bd - 1);
    let hiB = p10(bd) - 1n;
    const cap = (p10(dd) - 1n) / 2n;
    if (cap < hiB) hiB = cap;
    if (hiB < loB) return null;
    const b = randBetween(loB, hiB, random);
    if (randomInt(10, random) < 5) {
      const decimal = tryDivDec(dd, b, random, mode);
      if (decimal) return decimal;
    }
    let lo = (p10(dd - 1) + b - 1n) / b, hi = (p10(dd) - 1n) / b;
    if (lo < 2n) lo = 2n;
    if (mode === 1 && hi >= p10(dd - 1)) hi = p10(dd - 1) - 1n;
    if (hi < lo) return null;
    const ans = randBetween(lo, hi, random);
    return { a: b * ans, b, ans };
  }
  function generateFor(config, op, random) {
    if (!isConfigValid(config, op)) return null;
    const { a: da, b: db } = config.dg[op], mode = config.carry || 0;
    if (op === '×') return genMul(da, db, mode, random);
    if (op === '÷') {
      const q = tryDiv(da, db, random, mode);
      return q ? { ...q, op } : null;
    }
    if (mode) return sampleDigitPair(op, da, db, mode, random);
    let a = randBig(da, random), b = randBig(db, random);
    if (op === '−' && da === db) {
      // Two distinct uniformly sampled numbers, ordered once; no retry or digit-width repair.
      const lo = p10(db - 1), count = p10(db) - lo;
      b = lo + BigInt(randomInt(Number(count - 1n), random));
      if (b >= a) b++;
      if (b > a) [a, b] = [b, a];
    }
    return { a, b, op, ans: op === '+' ? a + b : a - b };
  }
  function generateQuestion(config, random) {
    const candidates = config.ops.filter(op => isConfigValid(config, op));
    return candidates.length ? generateFor(config, candidates[randomInt(candidates.length, random)], random) : null;
  }
  function buildSchedule(config, random) {
    const ops = OPS.filter(op => config.ops.includes(op) && config.cnt[op] > 0);
    if (!ops.length) return null;
    const error = validateQueueOps(config, ops);
    if (error) return { error };
    const schedule = [];
    for (const op of ops) for (let i = 0; i < config.cnt[op]; i++) schedule.push(op);
    for (let i = schedule.length - 1; i > 0; i--) {
      const j = randomInt(i + 1, random);
      [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
    }
    return schedule;
  }

  function decimalFraction(text) {
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    const parts = text.split('.'), decimals = parts[1] || '';
    return { numerator: BigInt(parts[0] + decimals), denominator: 10n ** BigInt(decimals.length) };
  }
  function gradeAnswer(q, input, tolerance) {
    const raw = String(input).trim().replace(/[,\s]/g, '');
    if (!raw || raw.length > ANSWER_LIMIT) return { valid: false };
    const user = decimalFraction(raw);
    const expected = typeof q.ans === 'bigint' ? { numerator: q.ans, denominator: 1n } : decimalFraction(String(q.ans));
    if (!user || !expected) return { valid: false };
    const delta = user.numerator * expected.denominator - expected.numerator * user.denominator;
    const diff = delta < 0n ? -delta : delta;
    if (diff === 0n) return { valid: true, correct: true, approx: false, raw };
    const rate = Number.isFinite(tolerance) ? Math.max(0, Math.min(20, tolerance)) : 0;
    const basisPoints = BigInt(Math.round(rate * 100));
    const approx = q.op === '÷' && basisPoints > 0n
      && diff * 10000n <= expected.numerator * user.denominator * basisPoints;
    return { valid: true, correct: approx, approx, raw };
  }
  function nextInput(value, command) {
    if (command === 'back') return value.slice(0, -1);
    if (command === 'clear') return '';
    if (value.length >= ANSWER_LIMIT) return value;
    if (command === '.') return value && !value.includes('.') ? value + '.' : value;
    return /^\d$/.test(command) ? value + command : value;
  }

  function validRecord(r) {
    return r && typeof r === 'object' && Number.isFinite(r.t) && r.t >= 0 && r.t <= 8640000000000000
      && OPS.includes(r.op) && Number.isInteger(r.la) && r.la >= 1 && r.la <= MAX_DIGITS
      && Number.isInteger(r.lb) && r.lb >= 1 && r.lb <= MAX_DIGITS
      && (r.ok === 0 || r.ok === 1) && Number.isFinite(r.sec) && r.sec >= 0 && (r.carry === 0 || r.carry === 1);
  }
  function sanitizeRecords(raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];
      const result = [];
      for (let i = parsed.length - 1; i >= 0 && result.length < RECORD_LIMIT; i--) {
        if (validRecord(parsed[i])) result.push(parsed[i]);
      }
      return result.reverse().sort((a, b) => a.t - b.t);
    } catch (_) { return []; }
  }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function rangeStart(range, now) {
    if (range === '1') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
    return range === '7' ? now - 7 * 86400000 : 0;
  }
  function newBucket() { return { n: 0, ok: 0, sec: 0 }; }
  function addToBucket(bucket, r) { bucket.n++; bucket.ok += r.ok; bucket.sec += r.sec; }
  function aggregateRecords(records, from, now) {
    const rows = records.filter(r => r.t >= from);
    if (rows.some((r, i) => i && r.t < rows[i - 1].t)) rows.sort((a, b) => a.t - b.t);
    const result = {
      records: rows, n: rows.length, ok: 0, sec: 0, bestStreak: 0,
      okSec: 0, badSec: 0, byDay: new Map(),
      byOp: Object.fromEntries(OPS.map(op => [op, newBucket()])),
      byCarry: [newBucket(), newBucket()], time: [0, 0, 0, 0],
      byLength: Array.from({ length: 4 }, newBucket), sessions: [], series: []
    };
    let streak = 0, session = null;
    for (const r of rows) {
      result.ok += r.ok; result.sec += r.sec;
      if (r.ok) { result.okSec += r.sec; result.bestStreak = Math.max(result.bestStreak, ++streak); }
      else { result.badSec += r.sec; streak = 0; }
      addToBucket(result.byOp[r.op], r); addToBucket(result.byCarry[r.carry], r);
      const length = r.la + r.lb;
      addToBucket(result.byLength[length <= 4 ? 0 : length <= 8 ? 1 : length <= 12 ? 2 : 3], r);
      result.time[r.sec < 2 ? 0 : r.sec < 5 ? 1 : r.sec < 10 ? 2 : 3]++;
      const key = dayKey(r.t);
      if (!result.byDay.has(key)) result.byDay.set(key, newBucket());
      addToBucket(result.byDay.get(key), r);
      if (!session || r.t - session.end > 300000) {
        session = { start: r.t, end: r.t, n: 0, ok: 0 };
        result.sessions.push(session);
        if (result.sessions.length > 10) result.sessions.shift();
      }
      session.end = r.t; session.n++; session.ok += r.ok;
    }
    result.wrong = result.n - result.ok;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today); date.setDate(date.getDate() - offset);
      const bucket = result.byDay.get(dayKey(date.getTime())) || newBucket();
      result.series.push({ label: (date.getMonth() + 1) + '/' + date.getDate(), cnt: bucket.n,
        acc: bucket.n ? Math.round(bucket.ok / bucket.n * 100) : 0 });
    }
    return result;
  }
  function createRingBuffer(capacity) {
    const items = new Array(Math.max(1, capacity));
    let cursor = 0, size = 0;
    return {
      push(value) { items[cursor] = value; cursor = (cursor + 1) % items.length; size = Math.min(size + 1, items.length); },
      toArray() { return Array.from({ length: size }, (_, i) => items[(cursor - size + items.length + i) % items.length]); },
      get size() { return size; }
    };
  }
  const HTML_ENTITIES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => HTML_ENTITIES[char]); }

  return Object.freeze({ OPS, MAX_DIGITS, RECORD_LIMIT, ANSWER_LIMIT, p10, randBetween, randBig,
    digitsOf, addCarry, subBorrow, mulCarry, carryInfo, isConfigValid, validateQueueOps,
    sampleDigitPair, genMul, tryDiv, tryDivDec, generateFor, generateQuestion, buildSchedule,
    decimalFraction, gradeAnswer, nextInput, validRecord, sanitizeRecords, dayKey, rangeStart,
    aggregateRecords, createRingBuffer, escapeHTML });
});
