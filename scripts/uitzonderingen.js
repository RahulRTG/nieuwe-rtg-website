#!/usr/bin/env node
/* ============================================================================
   DE UITZONDERINGEN -- schuld met een eigenaar en een vervaldatum.

   WAAROM DIT BESTAAT. Elk volwassen systeem wijkt ergens van zijn eigen regels
   af. Het verschil tussen een volwassen en een verwaarloosd systeem zit niet in
   het aantal afwijkingen maar in wat ermee gebeurt. De gebruikelijke vorm is

       // TODO: dit moet later beter

   en die heeft drie eigenschappen die hem waardeloos maken: hij noemt geen
   risico, hij heeft geen eigenaar, en hij verloopt nooit. Zo'n regel overleeft
   iedereen die weet waarom hij er staat.

   Hier draagt een uitzondering vijf dingen die een TODO niet heeft: van welke
   WET wordt afgeweken, wat een aanvaller er concreet mee kan, wat de schade
   beperkt zolang het duurt, wie hem sluit, en WANNEER hij verloopt. Die laatste
   is de motor: na de vervaldatum zakt deze keuring, en dan moet iemand een
   besluit nemen -- verlengen met een reden, of het gat dichten. Stilzwijgend
   eeuwig bestaan is de enige uitkomst die onmogelijk is.

   DE STANDEN:

     GELDIG      compleet ingevuld en nog niet verlopen.
     BINNENKORT  verloopt binnen dertig dagen. Geen fout, wel een waarschuwing:
                 dit is het moment om te plannen, niet de dag erna.
     VERLOPEN    over de datum. Zakt de run (exit 1).
     ONVOLLEDIG  mist een veld dat deze vorm juist zin geeft -- meestal risico,
                 eigenaar of vervaldatum. Zakt ook: een uitzondering zonder
                 risico-analyse is weer gewoon een TODO.

   WAT DIT NIET IS. Geen plek om werkvoorraad te parkeren. Een gat dat niemand
   bewust heeft geaccepteerd hoort in de wet zelf te staan (stand OPEN in
   INVARIANTS.json), niet hier. Deze lijst is voor afwijkingen die we kennen,
   kunnen benoemen en tijdelijk dragen.

   REGEL 10 VAN LAT.md. `--zelftest` voert de keuring vier uitzonderingen waarvan
   we de uitkomst kennen (verlopen, onvolledig, bijna verlopen, goed) en eist dat
   hij ze alle vier ziet. Een keuring die altijd "in orde" zegt, bewaakt niets.

   Draai:  node scripts/uitzonderingen.js            (het overzicht)
           node scripts/uitzonderingen.js --zelftest (laat de keuring uitslaan)
           node scripts/uitzonderingen.js --json     (de standen als JSON)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'EXCEPTIONS.json');
const BIJNA_DAGEN = 30;
const VERPLICHT = ['id', 'regel', 'wat', 'waarom', 'risico', 'compenserend', 'eigenaar', 'aangemaakt', 'verloopt'];

/* De invoer ontbreekt? Dan zakt deze meter, en meldt hij geen nul.

   Nul uitzonderingen en geen register zijn twee totaal verschillende dingen:
   het eerste betekent "we wijken nergens af", het tweede "we hebben niet
   gekeken". Ze op een hoop gooien is precies de fout die LAT.md regel 3
   beschrijft, en hier zou hij het gunstigste antwoord geven op de slechtste
   toestand. */
function leesRegister(pad) {
  const rauw = JSON.parse(fs.readFileSync(pad || REGISTER, 'utf8'));
  if (!Array.isArray(rauw.uitzonderingen)) throw new Error('EXCEPTIONS.json heeft geen uitzonderingen-lijst');
  return rauw;
}

/* Een uitzondering keuren. Puur: `vandaag` komt binnen, zodat de zelftest de
   klok kan zetten zonder te wachten tot een datum echt verstrijkt. */
function keurUitzondering(u, vandaag) {
  const mist = VERPLICHT.filter(v => !u[v] || String(u[v]).trim().length < 2);
  if (mist.length) return { stand: 'ONVOLLEDIG', mist, dagen: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u.verloopt)) return { stand: 'ONVOLLEDIG', mist: ['verloopt (vorm JJJJ-MM-DD)'], dagen: null };
  const dagen = Math.floor((Date.parse(u.verloopt + 'T00:00:00Z') - Date.parse(vandaag + 'T00:00:00Z')) / 86400000);
  if (dagen < 0) return { stand: 'VERLOPEN', mist: [], dagen };
  if (dagen <= BIJNA_DAGEN) return { stand: 'BINNENKORT', mist: [], dagen };
  return { stand: 'GELDIG', mist: [], dagen };
}

function keur(register, vandaag) {
  const dag = vandaag || new Date().toISOString().slice(0, 10);
  const uit = register.uitzonderingen.map(u => Object.assign({}, u, keurUitzondering(u, dag)));
  const telling = { GELDIG: 0, BINNENKORT: 0, VERLOPEN: 0, ONVOLLEDIG: 0 };
  for (const u of uit) telling[u.stand]++;
  return { uitzonderingen: uit, telling, vandaag: dag };
}

/* ---------- de ijking (LAT.md regel 10) ---------- */
function zelftest() {
  const vandaag = '2026-08-12';
  const basis = { id: 'EXC-000', regel: 'RTG-000', wat: 'iets', waarom: 'reden', risico: 'schade',
    compenserend: 'maatregel', eigenaar: 'Platform', aangemaakt: '2026-01-01', verloopt: '2027-01-01' };
  const proeven = [
    ['een goede uitzondering', basis, 'GELDIG'],
    ['verlopen', Object.assign({}, basis, { verloopt: '2026-08-11' }), 'VERLOPEN'],
    ['verloopt binnen 30 dagen', Object.assign({}, basis, { verloopt: '2026-08-20' }), 'BINNENKORT'],
    ['zonder risico-analyse', Object.assign({}, basis, { risico: '' }), 'ONVOLLEDIG'],
    ['zonder eigenaar', Object.assign({}, basis, { eigenaar: '' }), 'ONVOLLEDIG']
  ];
  let stuk = 0;
  for (const [naam, u, verwacht] of proeven) {
    const k = keurUitzondering(u, vandaag);
    const ok = k.stand === verwacht;
    if (!ok) stuk++;
    console.log((ok ? '  ok   ' : '  STUK ') + naam.padEnd(26) + ' verwacht ' + verwacht + ', kreeg ' + k.stand);
  }
  if (stuk) { console.error('\nDe uitzonderingskeuring sloeg ' + stuk + 'x niet uit. Het instrument is stuk.'); return 1; }
  console.log('\nDe uitzonderingskeuring slaat uit op alle vier de standen.');
  return 0;
}

if (require.main === module) {
  if (process.argv.includes('--zelftest')) process.exit(zelftest());
  const u = keur(leesRegister());
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ telling: u.telling,
      uitzonderingen: u.uitzonderingen.map(x => ({ id: x.id, regel: x.regel, stand: x.stand, dagen: x.dagen })) }, null, 2) + '\n');
    process.exit(u.telling.VERLOPEN || u.telling.ONVOLLEDIG ? 1 : 0);
  }
  console.log('\n  DE UITZONDERINGEN  (vandaag: ' + u.vandaag + ')\n');
  for (const x of u.uitzonderingen) {
    console.log('  ' + x.id + '  ' + String(x.regel).padEnd(9) + x.stand.padEnd(12) +
      (x.dagen == null ? '' : (x.dagen < 0 ? Math.abs(x.dagen) + ' dagen over tijd' : 'nog ' + x.dagen + ' dagen')));
    console.log('        ' + x.wat);
    if (x.stand === 'ONVOLLEDIG') console.log('        MIST: ' + x.mist.join(', '));
  }
  console.log('\n  ' + u.telling.GELDIG + ' geldig, ' + u.telling.BINNENKORT + ' verloopt binnenkort, ' +
    u.telling.VERLOPEN + ' verlopen, ' + u.telling.ONVOLLEDIG + ' onvolledig\n');
  if (u.telling.VERLOPEN || u.telling.ONVOLLEDIG) {
    console.error('  Een verlopen uitzondering is geen uitzondering meer maar een gewoonte.');
    console.error('  Verleng hem met een reden, of dicht het gat.\n');
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { keur, keurUitzondering, leesRegister, zelftest, VERPLICHT, BIJNA_DAGEN, REGISTER };
