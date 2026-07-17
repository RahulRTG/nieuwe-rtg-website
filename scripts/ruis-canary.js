/* Ruis-kanarie voor de chaos-soak (scripts/mega65-storm.js): een los proces
   dat elke 250 ms een vaste CPU-brok draait en meet hoeveel langzamer die is
   dan de eigen basislijn (beste van 30 in een strakke lus bij de start). De
   verhouding meet verstoring van buiten dit proces: co-tenants op de VM,
   CPU-steal, throttling, en tijdens de soak ook de druk van server+harnas
   zelf. Machineklasse valt weg (alles is relatief aan de eigen basislijn).
   Schrijft periodiek een JSON-samenvatting naar het opgegeven bestand; het
   harnas leest die na afloop en RAPPORTEERT hem alleen (het oordeel schaalt
   uitsluitend op de rustige kalibratie vooraf, niet op deze kanarie). */
const fs = require('fs');
const uit = process.argv[2];
if (!uit) { console.error('gebruik: node ruis-canary.js <uitvoerbestand>'); process.exit(2); }

function brok() { let x = 0; for (let i = 0; i < 4e6; i++) x = (x + i) % 9973; return x; }

let basis = Infinity;
for (let i = 0; i < 30; i++) {
  const t0 = process.hrtime.bigint(); brok();
  const dt = Number(process.hrtime.bigint() - t0) / 1e6;
  if (dt < basis) basis = dt;
}

const factoren = [];
setInterval(() => {
  const t0 = process.hrtime.bigint(); brok();
  const dt = Number(process.hrtime.bigint() - t0) / 1e6;
  factoren.push(dt / basis);
  if (factoren.length % 8 === 0) {
    const s = [...factoren].sort((a, b) => a - b);
    try {
      fs.writeFileSync(uit, JSON.stringify({
        n: factoren.length, basisMs: Math.round(basis * 1000) / 1000,
        p50: Math.round(s[s.length >> 1] * 100) / 100,
        p99: Math.round(s[Math.floor(s.length * 0.99)] * 100) / 100,
        max: Math.round(s[s.length - 1] * 100) / 100
      }));
    } catch (e) {}
  }
}, 250);
