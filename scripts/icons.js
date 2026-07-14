/* Genereert PNG-app-iconen uit de bestaande SVG's, met de al aanwezige Chromium
   (geen extra pakket; zie docs/de-lijn.md). Per icoon: 192 en 512 (purpose "any")
   en een maskable 512 (het icoon binnen de veilige zone op een volvlaks merkvlak),
   zodat PWA-installatie op iOS en Android een scherp startscherm-icoon geeft.

   Draai: node scripts/icons.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const BG = '#0C0C0B';
const MERK = [192, 512];

function laadPlaywright() {
  const paden = [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
  for (const p of paden) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); }
    catch (e) { /* volgende pad */ }
  }
  return null;
}

// Alle bronnen: /public/icons/*.svg plus /public/icon.svg.
function bronnen() {
  const lijst = [];
  const dir = path.join(ROOT, 'icons');
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.svg')) lijst.push({ svg: path.join(dir, f), base: path.join(dir, f.replace(/\.svg$/, '')) });
  }
  const rootIcon = path.join(ROOT, 'icon.svg');
  if (fs.existsSync(rootIcon)) lijst.push({ svg: rootIcon, base: path.join(ROOT, 'icon') });
  return lijst;
}

async function schietPng(page, svg, size, maskable) {
  const inner = maskable
    ? '<div style="width:' + Math.round(size * 0.8) + 'px;height:' + Math.round(size * 0.8) + 'px">' + svg + '</div>'
    : '<div style="width:' + size + 'px;height:' + size + 'px">' + svg + '</div>';
  const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0}' +
    '.vlak{width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;' + (maskable ? 'background:' + BG + ';' : '') + '}' +
    'svg{width:100%;height:100%;display:block}' +
    '</style></head><body><div class="vlak">' + inner + '</div></body></html>';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'networkidle' });
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size }, omitBackground: !maskable });
}

(async () => {
  const pw = laadPlaywright();
  if (!pw) { console.error('[icons] Playwright niet gevonden; iconen niet gegenereerd.'); process.exit(1); }
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  let n = 0;
  for (const b of bronnen()) {
    const svg = fs.readFileSync(b.svg, 'utf8');
    for (const size of MERK) {
      fs.writeFileSync(b.base + '-' + size + '.png', await schietPng(page, svg, size, false));
      n++;
    }
    fs.writeFileSync(b.base + '-maskable.png', await schietPng(page, svg, 512, true));
    n++;
  }
  await browser.close();
  console.log('[icons] ' + n + ' PNG-iconen gegenereerd.');
})().catch(e => { console.error('[icons]', e.message); process.exit(1); });
