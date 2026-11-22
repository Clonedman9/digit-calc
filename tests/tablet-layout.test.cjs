'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../assets/app.css'), 'utf8');

test('training uses a single shared three-column keyboard after the centered question', () => {
  assert.equal((html.match(/id="keypad"/g) || []).length, 1);
  assert.equal((html.match(/id="answer"/g) || []).length, 1);
  assert.ok(html.indexOf('id="qExpr"') < html.indexOf('id="answer"'));
  assert.ok(html.indexOf('id="answer"') < html.indexOf('id="keypad"'));
  for (const digit of '0123456789') assert.equal((html.match(new RegExp('data-k="' + digit + '"', 'g')) || []).length, 1);
  assert.match(css, /\.drill-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.keypad\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /\.drill-layout\s*\{[^}]*grid-template-columns:[^;}]*1\.\d+fr/);
});

test('tablet training hides the offset sidebar and centers against the complete viewport', () => {
  assert.match(css, /body\[data-view="drill"\] \.app\s*\{[^}]*display:\s*block/);
  assert.match(css, /body\[data-view="drill"\] \.sidebar,[\s\S]*?\.app-header\s*\{\s*display:\s*none/);
  assert.match(css, /body\[data-view="drill"\] #drillView\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /body\[data-view="drill"\] #answer\s*\{[^}]*text-align:\s*center/);
  assert.match(css, /--training-key-height:\s*clamp\(56px,\s*8\.5svh,\s*84px\)/);
  assert.match(css, /max-height:\s*720px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
