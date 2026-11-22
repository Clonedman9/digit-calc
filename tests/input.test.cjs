'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../assets/core.js');
const { context } = require('./helpers/app.cjs');
function fixture() {
  const key = name => ({ getAttribute: () => name });
  const S = { locked: false }, els = { answer: { value: '' }, drill: { classList: { contains: () => true } } };
  const pending = new Map(); let submits = 0, prevented = 0;
  const ctx = context({ Core, S, els, pendingPointerClicks: pending, performance: { now: () => 100 }, submit: () => { submits++; } }, ['pressKey', 'onKeypadPointer', 'onKeypadClick', 'onKeypadCancel', 'onDrillKeydown']);
  const event = (node, extra = {}) => ({ target: { closest: () => node }, button: 0, detail: 1, preventDefault() { prevented++; }, ...extra });
  return { ctx, S, els, pending, key, event, get submits() { return submits; }, get prevented() { return prevented; } };
}
test('paired pointer and native click enter a digit exactly once', () => {
  const f = fixture(), key = f.key('1');
  f.ctx.onKeypadPointer(f.event(key)); f.ctx.onKeypadClick(f.event(key));
  assert.equal(f.els.answer.value, '1'); assert.equal(f.pending.size, 0);
});
test('pointer pairing is per key and independent rapid presses preserve all digits', () => {
  const f = fixture(), one = f.key('1'), two = f.key('2');
  f.ctx.onKeypadPointer(f.event(one)); f.ctx.onKeypadPointer(f.event(two));
  f.ctx.onKeypadClick(f.event(two)); f.ctx.onKeypadClick(f.event(one));
  assert.equal(f.els.answer.value, '12'); assert.equal(f.pending.size, 0);
});
test('assistive-technology detail-zero clicks remain active after an unpaired pointer', () => {
  const f = fixture(), one = f.key('1');
  f.ctx.onKeypadPointer(f.event(one)); f.ctx.onKeypadClick(f.event(one, { detail: 0 }));
  assert.equal(f.els.answer.value, '11'); assert.equal(f.pending.size, 0);
});
test('right-click input is ignored and pointer cancellation removes only the matching key', () => {
  const f = fixture(), one = f.key('1'), two = f.key('2');
  f.ctx.onKeypadPointer(f.event(one, { button: 2 })); assert.equal(f.els.answer.value, '');
  f.ctx.onKeypadPointer(f.event(one)); f.ctx.onKeypadPointer(f.event(two));
  f.ctx.onKeypadCancel(f.event(one)); assert.equal(f.pending.has(one), false); assert.equal(f.pending.has(two), true);
});
test('physical digits and delete/decimal keys share the same bounded input reducer', () => {
  const f = fixture();
  for (const key of ['1', '2', '.', '.', '3', 'Backspace']) f.ctx.onDrillKeydown({ key, preventDefault() {} });
  assert.equal(f.els.answer.value, '12.');
  f.ctx.onDrillKeydown({ key: 'Escape', preventDefault() {} }); assert.equal(f.els.answer.value, '');
});
test('Enter on a focused button keeps native activation; ordinary Enter submits once', () => {
  const f = fixture();
  f.ctx.onDrillKeydown({ key: 'Enter', target: { closest: () => ({}) }, preventDefault() { throw Error('should preserve native event'); } });
  assert.equal(f.submits, 0);
  f.ctx.onDrillKeydown({ key: 'Enter', preventDefault() {} }); assert.equal(f.submits, 1);
  f.ctx.onDrillKeydown({ key: 'Enter', repeat: true, preventDefault() {} }); assert.equal(f.submits, 1);
});
test('composition, modifiers and locked runs are ignored', () => {
  const f = fixture();
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) f.ctx.onDrillKeydown({ key: '1', [flag]: true });
  f.S.locked = true; f.ctx.onDrillKeydown({ key: '1' });
  assert.equal(f.els.answer.value, '');
});

test('two touch pointers can enter left/right digits before either matching click arrives', () => {
  const f = fixture(), left = f.key('1'), right = f.key('3');
  f.ctx.onKeypadPointer(f.event(left, { pointerId: 11, pointerType: 'touch', isPrimary: true }));
  f.ctx.onKeypadPointer(f.event(right, { pointerId: 12, pointerType: 'touch', isPrimary: false }));
  assert.equal(f.els.answer.value, '13');
  f.ctx.onKeypadClick(f.event(right)); f.ctx.onKeypadClick(f.event(left));
  assert.equal(f.els.answer.value, '13'); assert.equal(f.pending.size, 0);
});

test('two fingers on the same number preserve two inputs while suppressing both paired clicks', () => {
  const f = fixture(), middle = f.key('5');
  f.ctx.onKeypadPointer(f.event(middle, { pointerId: 21, pointerType: 'touch', isPrimary: true }));
  f.ctx.onKeypadPointer(f.event(middle, { pointerId: 22, pointerType: 'touch', isPrimary: false }));
  f.ctx.onKeypadClick(f.event(middle)); f.ctx.onKeypadClick(f.event(middle));
  assert.equal(f.els.answer.value, '55'); assert.equal(f.pending.size, 0);
});
