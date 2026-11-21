#!/usr/bin/env node
// Inline ordered local assets to produce a standalone offline page.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const stylesheet = '<link rel="stylesheet" href="assets/app.css">';
if (!html.includes(stylesheet)) throw Error('Missing CSS entry point');
const css = fs.readFileSync(path.join(root, 'assets/app.css'), 'utf8');
html = html.replace(stylesheet, () => '<style>\n' + css + '\n</style>');
const scripts = ['core.js', 'app.js'].map(name => {
  const token = '<script src="assets/' + name + '" defer></script>';
  if (!html.includes(token)) throw Error('Missing ' + name + ' entry point');
  html = html.replace(token, '');
  return fs.readFileSync(path.join(root, 'assets', name), 'utf8').replace(/<\/script/gi, '<\\/script');
});
html = html.replace('</body>', () => '<script>\n' + scripts.join('\n') + '\n</script>\n</body>');
const dir = path.join(root, 'dist');
fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, 'digit-calc.html');
fs.writeFileSync(output, html);
console.log('Built dist/digit-calc.html (' + Buffer.byteLength(html) + ' bytes)');
