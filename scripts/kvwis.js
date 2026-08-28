#!/usr/bin/env node
/* ============================================================================
   EEN COLLECTIE WISSEN IN DE GEDEELDE OPSLAG -- ZOALS HET HOORT.

   WAAROM DIT COMMANDO BESTAAT

   `DELETE FROM kv WHERE key='...'` doet precies wat je vraagt en laat geen
   spoor na. Dat laatste is het probleem. Elke node houdt een lokale snapshot
   als warme cache, en bij het opstarten wint Postgres alleen "voor elke
   collectie die hij HEEFT". Een rij die er niet meer is, heeft hij niet -- dus
   wint de verouderde snapshot, en de node schrijft die staat daarna zelfs
   terug. De collectie herrijst.

   Dat is geen theorie: het is gereproduceerd (TAKEN.md 4.38). Rij aanmaken,
   met de hand wissen, herstarten -- en de rij staat er weer, in Postgres.

   Dit commando zet in plaats daarvan een GRAFSTEEN: de rij blijft staan met
   `weg = true` en een nieuw versienummer. Elke node die opstart of die het
   NOTIFY-seintje krijgt, past het verwijderen dan alsnog toe -- ook een node
   die maanden uit heeft gestaan en de wis nooit heeft zien gebeuren.

   WAT DIT NIET IS

   Geen "leegmaken". Wil je een collectie legen maar houden, doe dat via de
   applicatie: een lege collectie flusht gewoon en wint gewoon. Wissen is voor
   een collectie die WEG moet.

   Draai:  DATABASE_URL=postgres://... node scripts/kvwis.js <collectie> [...]
           npm run kvwis -- lastafworp
           npm run kvwis -- --lijst      (toont wat er staat, wist niets)
   ========================================================================= */
'use strict';
const URL = process.env.DATABASE_URL || process.env.PG_URL || '';
const args = process.argv.slice(2).filter(a => a !== '--');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

if (!URL) {
  console.error('\n  ' + K.rood + 'GEEN DATABASE_URL.' + K.reset + ' Dit commando werkt op de gedeelde Postgres-opslag.\n' +
    '  ' + K.grijs + 'Draait de installatie op SQLite, dan is er geen kv-tabel en geen tweede waarheid.' + K.reset + '\n');
  process.exit(1);
}
if (!args.length) {
  console.error('\n  Geef minstens een collectienaam op, of --lijst om te zien wat er staat.\n' +
    '  ' + K.grijs + 'npm run kvwis -- --lijst' + K.reset + '\n');
  process.exit(1);
}

const { merge3 } = require('../server/db');
const { maakPg } = require('../server/pg');
const kluis = require('../server/kluis');

(async () => {
  const pg = maakPg({ merge3, kluis, log: { warn: (m) => console.error(m) }, url: URL });
  await pg.schema();
  try {
    const { rows } = await pg.pool.query('SELECT key, weg, length(val) AS bytes FROM kv ORDER BY key');
    if (args[0] === '--lijst') {
      console.log('\n  ' + rows.length + ' rij(en) in kv:\n');
      for (const r of rows) {
        console.log('    ' + (r.weg ? K.geel + 'GRAFSTEEN' + K.reset : '         ') + '  ' +
          r.key.padEnd(28) + K.grijs + (r.weg ? '' : r.bytes + ' bytes versleuteld') + K.reset);
      }
      console.log('');
      return;
    }
    const bekend = new Map(rows.map(r => [r.key, r]));
    let gewist = 0;
    for (const naam of args) {
      const r = bekend.get(naam);
      if (!r) { console.log('  ' + K.grijs + '- ' + naam + ': staat niet in kv, niets te doen' + K.reset); continue; }
      if (r.weg) { console.log('  ' + K.grijs + '- ' + naam + ': staat er al als grafsteen' + K.reset); continue; }
      const ok = await pg.wisCollectie(naam);
      if (ok) { gewist++; console.log('  ' + K.groen + '✓ ' + naam + ' gewist' + K.reset + K.grijs + ' (grafsteen achtergelaten; elke node past hem toe)' + K.reset); }
      else console.log('  ' + K.rood + '✗ ' + naam + ': wissen mislukt' + K.reset);
    }
    if (gewist) {
      console.log('\n  ' + K.geel + 'Let op:' + K.reset + ' draaiende instances passen dit binnen enkele seconden toe (NOTIFY + poll).\n' +
        '  ' + K.grijs + 'Een node die later opstart, past het bij het opstarten alsnog toe.' + K.reset + '\n');
    }
  } finally {
    await pg.sluit().catch(() => {});
  }
})().catch(e => { console.error('\n  ' + K.rood + 'FOUT: ' + e.message + K.reset + '\n'); process.exit(1); });
