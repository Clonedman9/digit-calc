(async () => {
  const median = values => values.sort((a, b) => a - b)[values.length >> 1];
  const now = Date.now();
  const records = Array.from({ length: 2000 }, (_, i) => ({ t: now - (2000 - i) * 1234567, op: ['+', '−', '×', '÷'][i % 4], la: 1 + i % 6, lb: 1 + i % 6, ok: +(i % 5 !== 0), sec: 1 + i % 18, carry: i % 2 }));
  localStorage.setItem('drill.records.v1', JSON.stringify(records));
  // Reload before invoking this file a second time to ingest the same test data.
  if (document.getElementById('homeTotal').textContent !== '2000') return { seeded: true, reloadRequired: true };
  const input = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  document.getElementById('navSetup').click();
  for (const b of document.querySelectorAll('#opChips .chip')) if (b.classList.contains('on') !== (b.dataset.op === '+')) b.click();
  for (const id of ['digAAdd', 'digBAdd']) input(id, 6);
  input('cntAdd', 999);
  document.querySelector('#carrySeg [data-v="2"]').click();
  document.querySelector('#showSeg [data-v="0"]').click(); document.querySelector('#limitSeg [data-v="0"]').click();
  document.getElementById('unlimited').checked = false;
  document.getElementById('unlimited').dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('settingsDone').click();
  const startSamples = [];
  for (let i = 0; i < 9; i++) {
    const start = performance.now(); document.getElementById('startBtn').click();
    const text = document.getElementById('qExpr').textContent;
    if (!text.includes('+')) throw Error('run failed');
    const width = document.getElementById('qExpr').getBoundingClientRect().width;
    startSamples.push(performance.now() - start);
    document.getElementById('quitBtn').click(); document.getElementById('backBtn').click();
    await new Promise(r => setTimeout(r, 20));
  }
  const statsSamples = [];
  for (let i = 0; i < 9; i++) {
    document.getElementById('navHome').click();
    const start = performance.now(); document.getElementById('navStats').click();
    const chartWidth = document.getElementById('stTrend').getBoundingClientRect().width;
    statsSamples.push(performance.now() - start);
    await new Promise(r => setTimeout(r, 20));
  }
  document.getElementById('navHome').click();
  return { browser: navigator.userAgent, viewport: innerWidth, records: document.getElementById('homeTotal').textContent, startup999NoCarryMs: +median(startSamples).toFixed(3), statsOpen2000Ms: +median(statsSamples).toFixed(3), startupSamples: startSamples.map(x => +x.toFixed(3)), statsSamples: statsSamples.map(x => +x.toFixed(3)), includes: 'real DOM updates and forced layout; elapsed click-to-render, excludes async paint; same viewport/data; median warm repetitions' };
})()
