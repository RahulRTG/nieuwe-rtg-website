#!/usr/bin/env node
/* ============================================================================
   DE WETTENMOTOR -- welke systeemwet geldt hier, wie handhaaft hem, en is dat
   ooit nagetrokken?

   WAAROM DIT BESTAAT. Dit huis heeft al een ratel (NORM.json), een bewijsregister
   per toets (BEWIJS.md), een mutatiemotor (MUTATIES.json) en een census van
   handhavers (samenhang.js). Wat ontbrak is de laag erboven: WAT BELOOFT DIT
   SYSTEEM ALTIJD, ongeacht welk scherm of welke route je pakt. Een toets bewijst
   een geval. Een wet is een uitspraak over alle gevallen, en die hoort ergens te
   staan waar hij te weerleggen is.

   Zonder zo'n lijst is elke wet impliciet: hij leeft in het hoofd van wie hem
   ooit bedacht, en verdwijnt met die persoon. Met deze lijst is hij een bewering
   met een adres -- en een bewering met een adres kan zakken.

   DE VIER STANDEN, en de volgorde is de strengheid:

     GEBROKEN     de wet wijst naar een bestand of een toets die niet bestaat.
                  Dit is de enige alarmerende stand: de wet bestaat nog op
                  papier terwijl zijn grond weg is. Zakt de run (exit 1).
     ONBEPROEFD   handhaver en toets bestaan, maar geen van de genoemde toetsen
                  is ooit ZIEN ZAKKEN op een mutatie (MUTATIES.json). De wet
                  staat er, er kijkt iemand naar, maar niemand heeft die kijker
                  op de proef gesteld. LAT.md regel 9.
     OPEN         de wet is opgeschreven maar noemt (nog) geen handhaver of geen
                  toets. Werkvoorraad, en met opzet zichtbaar: een wet zonder
                  handhaver is een voornemen, en die mag je niet als bescherming
                  presenteren.
     BEWEZEN      handhaver bestaat, toets bestaat, en minstens een van die
                  toetsen is gemeten gezakt op een mutatie in de bron.

   WAT DEZE MOTOR NIET BEWEERT. "BEWEZEN" betekent: er is een handhaver, er is een
   toets, en die toets is bewezen GEVOELIG. Het betekent niet dat de toets de wet
   volledig dekt -- dat kan geen enkel gereedschap zeggen. De eerlijke lezing is:
   deze wet heeft grond onder zijn voeten, en wie de grond weghaalt merkt het.

   REGEL 10 VAN LAT.md OP DEZE MOTOR ZELF. Een meter die je niet hebt zien
   uitslaan, meet niets. Daarom draagt hij zijn eigen ijking: `--zelftest` voedt
   hem drie wetten waarvan we weten dat ze fout zijn (een verdwenen handhaver,
   een verdwenen toets, een toets die nooit zakte) en eist dat hij alle drie
   ziet. Ziet hij er een niet, dan zakt de zelftest -- want dan is dit
   instrument stuk en niet de code.

   Draai:  node scripts/wetten.js              (schrijft WETTEN.md)
           node scripts/wetten.js --controle   (zakt op GEBROKEN of achterstand)
           node scripts/wetten.js --zelftest   (laat de motor zelf uitslaan)
           node scripts/wetten.js --json       (de standen als JSON)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'INVARIANTS.json');
const DOEL = path.join(WORTEL, 'WETTEN.md');

/* De gemeten mutatie-uitslag. Ontbreekt het bestand, dan is er NIETS gemeten en
   zegt deze motor dat ook -- hij doet niet alsof (LAT.md regel 3: een meter zakt
   als zijn invoer ontbreekt; hier zakt hij niet hard, maar hij weigert wel de
   stand BEWEZEN uit te delen, en schrijft erbij waarom). */
function mutaties() {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen || {}; }
  catch (e) { return null; }
}

function leesRegister(pad) {
  const rauw = JSON.parse(fs.readFileSync(pad || REGISTER, 'utf8'));
  if (!Array.isArray(rauw.wetten)) throw new Error('INVARIANTS.json heeft geen wetten-lijst');
  return rauw;
}

/* Een wet keuren. Puur: alles wat hij van de wereld nodig heeft komt binnen via
   `bestaat` en `gemeten`, zodat de zelftest hem een verzonnen wereld kan voeren. */
function keurWet(w, bestaat, gemeten) {
  const handhavers = w.handhaver || [];
  const toetsen = w.toetsen || [];
  const missendeHandhaver = handhavers.filter(p => !bestaat(p));
  const missendeToets = toetsen.filter(t => !bestaat('test/' + t));
  const gebroken = missendeHandhaver.concat(missendeToets.map(t => 'test/' + t));
  if (gebroken.length) return { stand: 'GEBROKEN', gebroken, bewezenDoor: null };
  if (!handhavers.length || !toetsen.length) {
    return { stand: 'OPEN', gebroken: [],
      reden: !handhavers.length ? 'geen handhaver benoemd' : 'geen toets benoemd', bewezenDoor: null };
  }
  if (!gemeten) return { stand: 'ONBEPROEFD', gebroken: [], reden: 'MUTATIES.json ontbreekt; niets gemeten', bewezenDoor: null };
  const bewijs = toetsen.find(t => gemeten[t] && gemeten[t].staat === 'gezakt');
  if (!bewijs) return { stand: 'ONBEPROEFD', gebroken: [], reden: 'geen van de toetsen is zien zakken op een mutatie', bewezenDoor: null };
  return { stand: 'BEWEZEN', gebroken: [], bewezenDoor: bewijs, operator: (gemeten[bewijs] || {}).operator || null };
}

function keur(register, opties) {
  const o = opties || {};
  const bestaat = o.bestaat || (p => fs.existsSync(path.join(WORTEL, p)));
  const gemeten = o.gemeten === undefined ? mutaties() : o.gemeten;
  const uit = register.wetten.map(w => Object.assign({}, w, keurWet(w, bestaat, gemeten)));
  const telling = { BEWEZEN: 0, ONBEPROEFD: 0, OPEN: 0, GEBROKEN: 0 };
  for (const w of uit) telling[w.stand]++;
  return { wetten: uit, telling, gemetenBeschikbaar: !!gemeten };
}

/* ---------- de uitvoer ---------- */
const MERK = { BEWEZEN: 'BEWEZEN', ONBEPROEFD: 'ONBEPROEFD', OPEN: 'OPEN', GEBROKEN: 'GEBROKEN' };

function bouw(uitslag) {
  const r = [];
  const p = s => r.push(s === undefined ? '' : s);
  const t = uitslag.telling;
  p('# De systeemwetten van RTG');
  p('');
  p('**Dit bestand is GEGENEREERD** door `node scripts/wetten.js` uit `INVARIANTS.json`.');
  p('Wijzig het niet met de hand; de wet zelf verander je in het register. Er staat geen');
  p('datum in -- zie `ARCHITECTUUR.md` voor waarom.');
  p('');
  p('Een toets bewijst een geval. Een **wet** is een uitspraak over alle gevallen: wat dit');
  p('systeem altijd belooft, ongeacht welk scherm of welke route je pakt. Zonder register');
  p('leeft zo\'n wet alleen in het hoofd van wie hem bedacht. Hier draagt hij een adres, en');
  p('een bewering met een adres kan zakken.');
  p('');
  p('## De stand');
  p('');
  p('| stand | aantal | wat het betekent |');
  p('|---|---|---|');
  p('| **BEWEZEN** | ' + t.BEWEZEN + ' | handhaver bestaat, toets bestaat, en die toets is zien zakken op een mutatie |');
  p('| **ONBEPROEFD** | ' + t.ONBEPROEFD + ' | er kijkt iemand naar, maar die kijker is nooit op de proef gesteld |');
  p('| **OPEN** | ' + t.OPEN + ' | opgeschreven zonder handhaver of zonder toets: een voornemen, geen bescherming |');
  p('| **GEBROKEN** | ' + t.GEBROKEN + ' | wijst naar iets dat er niet meer is -- de enige alarmerende stand |');
  p('');
  if (!uitslag.gemetenBeschikbaar) {
    p('**`MUTATIES.json` ontbreekt.** Er is dus niets gemeten en geen enkele wet kan hier');
    p('BEWEZEN heten. Draai `npm run mutatie`. Deze motor doet niet alsof.');
    p('');
  }
  p('`BEWEZEN` zegt: deze wet heeft grond onder zijn voeten, en wie de grond weghaalt merkt');
  p('het. Het zegt niet dat de toets de wet volledig dekt -- dat kan geen gereedschap zeggen.');
  p('');
  p('## De wetten');
  p('');
  for (const w of uitslag.wetten) {
    p('### ' + w.id + ' -- ' + w.wet);
    p('');
    p('`' + MERK[w.stand] + '`' + (w.bewezenDoor ? ' · zien zakken in `' + w.bewezenDoor + '`' +
      (w.operator ? ' op `' + w.operator + '`' : '') : '') + (w.reden ? ' · ' + w.reden : ''));
    p('');
    if (w.waarom) { p(w.waarom); p(''); }
    if (w.gebroken && w.gebroken.length) {
      p('**Gebroken:** deze wet wijst naar iets dat niet bestaat: ' +
        w.gebroken.map(x => '`' + x + '`').join(', ') + '.');
      p('');
    }
    if ((w.handhaver || []).length) { p('*Handhaver:* ' + w.handhaver.map(x => '`' + x + '`').join(', ')); p(''); }
    if ((w.toetsen || []).length) { p('*Toets:* ' + w.toetsen.map(x => '`test/' + x + '`').join(', ')); p(''); }
    if (w.sabotage) { p('*Breek hem zo:* ' + w.sabotage); p(''); }
  }
  p('## Hoe je dit bestand bijwerkt');
  p('');
  p('```');
  p('node scripts/wetten.js              # opnieuw genereren');
  p('node scripts/wetten.js --controle   # zakt op een GEBROKEN wet of een achterlopend bestand');
  p('node scripts/wetten.js --zelftest   # laat de motor zelf uitslaan (LAT.md regel 10)');
  p('```');
  return r.join('\n') + '\n';
}

/* ---------- de ijking: laat de motor zelf uitslaan (LAT.md regel 10) ----------
   Drie wetten waarvan we WETEN dat ze fout zijn. Ziet de motor er een niet, dan
   is dit instrument stuk, en dan hoort de run te zakken -- niet de code. */
function zelftest() {
  const bestaat = p => ['server/echt.js', 'test/echt.test.js', 'test/slap.test.js'].includes(p);
  const gemeten = { 'echt.test.js': { staat: 'gezakt', operator: 'return-weg#0' }, 'slap.test.js': { staat: 'overleefd' } };
  const proeven = [
    ['verdwenen handhaver', { id: 'X-1', wet: 'x', handhaver: ['server/weg.js'], toetsen: ['echt.test.js'] }, 'GEBROKEN'],
    ['verdwenen toets', { id: 'X-2', wet: 'x', handhaver: ['server/echt.js'], toetsen: ['weg.test.js'] }, 'GEBROKEN'],
    ['toets die nooit zakte', { id: 'X-3', wet: 'x', handhaver: ['server/echt.js'], toetsen: ['slap.test.js'] }, 'ONBEPROEFD'],
    ['wet zonder handhaver', { id: 'X-4', wet: 'x', handhaver: [], toetsen: ['echt.test.js'] }, 'OPEN'],
    ['volledige wet', { id: 'X-5', wet: 'x', handhaver: ['server/echt.js'], toetsen: ['echt.test.js'] }, 'BEWEZEN']
  ];
  let stuk = 0;
  for (const [naam, wet, verwacht] of proeven) {
    const k = keurWet(wet, bestaat, gemeten);
    const ok = k.stand === verwacht;
    if (!ok) stuk++;
    console.log((ok ? '  ok   ' : '  STUK ') + naam.padEnd(24) + ' verwacht ' + verwacht + ', kreeg ' + k.stand);
  }
  if (stuk) { console.error('\nDe wettenmotor sloeg ' + stuk + 'x niet uit op bekend-foute invoer. Het instrument is stuk.'); return 1; }
  console.log('\nDe wettenmotor slaat uit op alle vijf de bekende standen.');
  return 0;
}

if (require.main === module) {
  if (process.argv.includes('--zelftest')) process.exit(zelftest());
  const uitslag = keur(leesRegister());
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ telling: uitslag.telling,
      wetten: uitslag.wetten.map(w => ({ id: w.id, stand: w.stand, bewezenDoor: w.bewezenDoor })) }, null, 2) + '\n');
    process.exit(uitslag.telling.GEBROKEN ? 1 : 0);
  }
  const tekst = bouw(uitslag);
  const t = uitslag.telling;
  const regel = t.BEWEZEN + ' bewezen, ' + t.ONBEPROEFD + ' onbeproefd, ' + t.OPEN + ' open, ' + t.GEBROKEN + ' gebroken';
  if (process.argv.includes('--controle')) {
    let fout = 0;
    for (const w of uitslag.wetten) if (w.stand === 'GEBROKEN') {
      console.error('GEBROKEN ' + w.id + ': wijst naar ' + w.gebroken.join(', '));
      fout++;
    }
    const opSchijf = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
    if (opSchijf !== tekst) { console.error('WETTEN.md loopt achter. Draai: node scripts/wetten.js'); fout++; }
    if (fout) process.exit(1);
    console.log('De wetten staan (' + regel + ').');
    process.exit(0);
  }
  fs.writeFileSync(DOEL, tekst);
  console.log('WETTEN.md geschreven: ' + regel + '.');
  process.exit(uitslag.telling.GEBROKEN ? 1 : 0);
}

module.exports = { keur, keurWet, bouw, leesRegister, zelftest, REGISTER, DOEL };
