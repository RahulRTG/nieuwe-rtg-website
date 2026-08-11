#!/usr/bin/env node
/* ============================================================================
   HET ZEKERHEIDSPANEEL -- wat weten we, en vooral: wat weten we NIET.

   DE EIS WAAR DIT UIT VOORTKOMT: RTG moet kunnen aantonen waar het niet zeker
   van is. Geen enkel scherm in dit huis mag ooit een groen schild met "VEILIG"
   tonen. Dat is geen bescheidenheid maar nauwkeurigheid: een systeem dat zijn
   onbekenden verbergt, liegt over precies het deel dat je moet weten.

   Daarom is dit paneel ZO GEBOUWD DAT HET DIE UITSPRAAK NIET KAN DOEN. Het
   oordeel onderaan draagt altijd twee dingen: het aantal dingen dat we niet
   weten, en de letterlijke woorden NIET ABSOLUUT. Er is geen invoer die dat
   weghaalt -- ook niet een wereld waarin alles gemeten en alles groen is.
   test/zekerheid.test.js voert hem precies die perfecte wereld en eist dat de
   woorden er nog staan.

   DRIE SOORTEN RIJ, en het onderscheid is de hele opzet:

     GEMETEN     er is een bronbestand, het is gelezen, en het getal komt daar
                 vandaan. De bron staat erbij, zodat je hem kunt natrekken.
     NIET GEMETEN  de bron ontbreekt of is onleesbaar. Dan staat er GEEN nul --
                 een nul zou "niets aan de hand" betekenen, en dat is het
                 gevaarlijkste antwoord op een verdwenen meting (LAT.md regel 3).
     ONTBREEKT   bewijs dat dit huis PRINCIPIEEL niet over zichzelf kan leveren:
                 een onafhankelijke pentest, een red team, een externe
                 verankering van de auditketen, een herstelproef vanuit een lege
                 omgeving, een reproduceerbare build op een tweede builder, een
                 buitenwacht buiten de eigen infrastructuur. Zolang die er niet
                 zijn, horen ze zichtbaar te ONTBREKEN en niet weggelaten te
                 worden. Wat je weglaat, telt niemand.

   WAAROM DIE DERDE SOORT ER MOET ZIJN. Alles hierboven is zelfmeting: RTG dat
   RTG beoordeelt. Dat kan uitstekend zijn en het blijft in dezelfde aannames
   staan. De enige manier om dat eerlijk te tonen is de ontbrekende buitenkant
   even zichtbaar maken als de aanwezige binnenkant.

   Draai:  node scripts/zekerheid.js              (het paneel)
           node scripts/zekerheid.js --json       (dezelfde standen als JSON)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (naam) => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

/* Een meting die zijn bron niet vindt, geeft null terug en NOOIT een getal.
   Het verschil tussen "nul problemen" en "niet gekeken" is het hele punt. */
function probeer(fn) { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } }

/* De rijbouwer staat apart en wordt geexporteerd, en dat is geen netheid maar
   een reparatie. Hij zat eerst als sluiting binnen zelfmetingen(), waar geen
   toets erbij kon: alle zes de bronnen bestaan, dus de tak "bron ontbreekt" werd
   nooit gelopen. Een mutatieproef liet dat zien -- `probeer(fn) ?? 0` maakte van
   een verdwenen bron een GEMETEN rij met waarde 0, precies de gevaarlijkste
   stand, en de toetsen bleven alle vijf groen omdat ze GEMETEN-rijen overslaan.
   Nu is de tak los te voeden: test/zekerheid.test.js geeft hem een meting die
   gooit en eist NIET GEMETEN met waarde null. */
function maakRij(naam, bron, fn, duiding) {
  const v = probeer(fn);
  return { naam, bron, waarde: v, stand: v === null ? 'NIET GEMETEN' : 'GEMETEN', duiding: duiding || '' };
}

/* ---------- de zelfmetingen: alles met een bron in deze repo ---------- */
function zelfmetingen() {
  const rijen = [];
  const rij = (naam, bron, fn, duiding) => rijen.push(maakRij(naam, bron, fn, duiding));

  rij('SYSTEEMWETTEN', 'INVARIANTS.json', () => {
    const w = require('./wetten.js');
    const t = w.keur(w.leesRegister()).telling;
    return t.BEWEZEN + '/' + (t.BEWEZEN + t.ONBEPROEFD + t.OPEN + t.GEBROKEN) + ' bewezen' +
      (t.GEBROKEN ? ', ' + t.GEBROKEN + ' GEBROKEN' : '') +
      ', ' + t.ONBEPROEFD + ' onbeproefd, ' + t.OPEN + ' open';
  }, 'een wet is BEWEZEN als zijn toets is zien zakken op een mutatie');

  rij('TOETSEN MET TANDEN', 'MUTATIES.json', () => {
    const m = lees('MUTATIES.json').toetsen;
    const namen = Object.keys(m);
    const gezakt = namen.filter(n => m[n].staat === 'gezakt').length;
    const overleefd = namen.filter(n => m[n].staat === 'overleefd').length;
    return gezakt + '/' + namen.length + ' zien zakken, ' + overleefd + ' overleefden elke mutatie';
  }, 'een toets die niet kan zakken is slechter dan geen toets');

  rij('SABOTAGE VAN WETTEN', 'SABOTAGE.json', () => {
    const w = lees('SABOTAGE.json').wetten;
    const ids = Object.keys(w);
    const bewezen = ids.filter(i => w[i].stand === 'BEWEZEN').length;
    const gaten = ids.filter(i => w[i].stand === 'OVERLEEFD').length;
    return bewezen + '/' + ids.length + ' handhavers uitgezet en gezien wie rood werd' +
      (gaten ? ', ' + gaten + ' GEBROKEN gat(en)' : '');
  }, 'gericht bewijs: de handhaver ging echt uit');

  rij('SCHERMEN BEREIKBAAR', 'BEREIK.json', () => {
    const b = lees('BEREIK.json').gemeten;
    return b.bereikbaar + '/' + b.schermen + (b.zonderRoute ? ', ' + b.zonderRoute + ' zonder klikroute' : '');
  });

  rij('BELOFTEN GEDEKT', 'BELOFTE.json', () => {
    const rijen2 = require('./belofte.js').meet().rijen;
    const gebroken = rijen2.filter(r => r.stand === 'gebroken').length;
    const gedekt = rijen2.filter(r => r.stand === 'gedekt').length;
    return gedekt + '/' + rijen2.length + ' gedekt' + (gebroken ? ', ' + gebroken + ' GEBROKEN' : '');
  }, 'een belofte die naar iets verdwenen wijst, mist niemand vanzelf');

  rij('DE NORM', 'NORM.json', () => {
    const norm = lees('NORM.json');
    return Object.keys(norm.meters).length + ' meters vastgelegd op ' + norm.vastgelegd;
  }, 'de ratel: meters mogen maar een kant op');

  rij('LASTPROEF', 'BEPROEVING.json', () => {
    const b = lees('BEPROEVING.json');
    const m = b.machine || {};
    return b.oordeel + ' op ' + (m.kernen || '?') + 'k/' + (m.platform || '?') + '/' + (b.modus || '?') +
      ', p99 ' + ((b.meters || {}).p99Ms) + ' ms';
  }, 'een p99 van een andere machine is geen betere p99, maar een andere');

  return rijen;
}

/* ---------- het bewijs dat dit huis NIET over zichzelf kan leveren ----------
   Elk van deze regels wordt pas GEMETEN als het genoemde bestand bestaat. Er is
   met opzet geen manier om zo'n regel met de hand op "in orde" te zetten: het
   bewijs is het bestand, en dat schrijft de buitenwacht, niet dit script. */
const BUITENKANT = [
  ['ONAFHANKELIJKE PENTEST', 'bewijs/pentest.json', 'een extern bureau zonder kennis van onze aannames'],
  ['RED TEAM', 'bewijs/redteam.json', 'een doel in plaats van een checklist, plus wat detectie zag'],
  ['EXTERNE AUDITVERANKERING', 'bewijs/anker.json', 'ook het WEGHALEN van de laatste schakels moet van buiten opvallen'],
  ['HERSTELPROEF UIT LEEG', 'bewijs/herstel.json', 'lege omgeving, alleen officiele backups, daarna invarianten en heartbeats'],
  ['REPRODUCEERBARE BUILD', 'bewijs/build.json', 'dezelfde bron op twee onafhankelijke builders geeft dezelfde hash'],
  ['BUITENWACHT', 'bewijs/buitenwacht.json', 'een systeem buiten onze infrastructuur dat ons als gewone gebruiker behandelt'],
  ['ASVS-AFBEELDING', 'bewijs/asvs.json', 'eis -> control -> toets -> bewijs, tegen een externe standaard']
];

function buitenkant() {
  return BUITENKANT.map(([naam, bron, duiding]) => {
    const er = fs.existsSync(path.join(WORTEL, bron));
    return { naam, bron, waarde: er ? probeer(() => lees(bron).samenvatting) : null,
      stand: er ? 'GEMETEN' : 'ONTBREEKT', duiding };
  });
}

/* ---------- het oordeel, dat nooit "veilig" kan zeggen ----------
   Twee dingen staan er altijd in: hoeveel we niet weten, en NIET ABSOLUUT. Er
   is geen tak die daaromheen gaat, ook niet bij een perfecte uitslag. */
function oordeel(rijen) {
  const onbekend = rijen.filter(r => r.stand !== 'GEMETEN').length;
  const gebroken = rijen.filter(r => r.stand === 'GEMETEN' && /GEBROKEN/.test(String(r.waarde))).length;
  let niveau;
  if (gebroken) niveau = 'AANGETAST';
  else if (onbekend === 0) niveau = 'HOOG';
  else if (onbekend <= 3) niveau = 'REDELIJK';
  else niveau = 'BEPERKT';
  return { niveau, onbekend, gebroken, zin: niveau + ' -- NIET ABSOLUUT (' + onbekend + ' onbekend)' };
}

function paneel() {
  const zelf = zelfmetingen();
  const buiten = buitenkant();
  const alles = zelf.concat(buiten);
  const o = oordeel(alles);
  const r = [];
  const breed = 26;
  const p = s => r.push(s === undefined ? '' : s);
  const regel = (x) => p('  ' + x.naam.padEnd(breed) + (x.stand === 'GEMETEN' ? String(x.waarde) : x.stand));

  p('');
  p('  RTG ZEKERHEID');
  p('  ' + '='.repeat(60));
  p('');
  p('  ZELFMETING -- RTG dat RTG beoordeelt');
  for (const x of zelf) regel(x);
  p('');
  p('  VAN BUITEN -- bewijs dat wij niet over onszelf kunnen leveren');
  for (const x of buiten) regel(x);
  p('');
  p('  ' + '='.repeat(60));
  p('  ZEKERHEID: ' + o.zin);
  p('  ' + '='.repeat(60));
  p('');
  p('  Wat hier ONTBREEKT is geen fout in dit paneel maar de stand van zaken.');
  p('  Alles onder ZELFMETING staat in dezelfde aannames als de code die het');
  p('  meet; alleen de regels eronder kunnen die aannames weerleggen.');
  p('');
  return { tekst: r.join('\n') + '\n', rijen: alles, oordeel: o };
}

if (require.main === module) {
  const u = paneel();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ oordeel: u.oordeel, rijen: u.rijen }, null, 2) + '\n');
  } else process.stdout.write(u.tekst);
  process.exit(u.oordeel.gebroken ? 1 : 0);
}

module.exports = { paneel, oordeel, zelfmetingen, buitenkant, maakRij, BUITENKANT };
