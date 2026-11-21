#!/usr/bin/env node
// Inline local presentation assets to make a genuinely standalone offline page.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
for(const [token,name] of [['<link rel="stylesheet" href="assets/app.css">','CSS'],['<script src="assets/app.js" defer></script>','JavaScript']]){
 if(!html.includes(token))throw Error('Missing '+name+' entry point');
}
html=html.replace('<link rel="stylesheet" href="assets/app.css">',()=>'<style>\n'+css+'\n</style>');
html=html.replace('  <script src="assets/app.js" defer></script>\n','');
html=html.replace('</body>',()=>'<script>\n'+js+'\n</script>\n</body>');
const dir=path.join(root,'dist');fs.mkdirSync(dir,{recursive:true});
const output=path.join(dir,'digit-calc.html');fs.writeFileSync(output,html);
console.log('Built dist/digit-calc.html ('+Buffer.byteLength(html)+' bytes)');
