/* HET PANEEL KAN NIET "VEILIG" ZEGGEN, WAT JE HET OOK VOERT.

   De eis: RTG moet kunnen aantonen waar het niet zeker van is. Een systeem dat
   zijn onbekenden verbergt, liegt over precies het deel dat je moet weten.
   scripts/zekerheid.js is daarom zo gebouwd dat het die uitspraak NIET KAN doen
   -- en deze toets is wat dat vasthoudt.

   De scherpste toets hier is de derde: we voeren het paneel een PERFECTE wereld
   (alles gemeten, niets gebroken, nul onbekenden) en eisen dat de woorden NIET
   ABSOLUUT er nog staan. Zonder die toets is de belofte een voornemen dat
   iemand er over een jaar uit optimaliseert omdat "HOOG" mooier staat.

   En de tweede helft: de zeven soorten bewijs van buiten (pentest, red team,
   extern anker, herstelproef, reproduceerbare build, buitenwacht, ASVS) staan
   in de code als vaste lijst. Ze verdwijnen niet als er geen bestand is -- ze
   staan er dan als ONTBREEKT. Wat je weglaat, telt niemand.

   Gemuteerd en zien zakken: de zin in oordeel() vervangen door alleen het
   niveau (toets 1 en 3 rood), het niveau bij nul onbekenden op HOOG zonder
   achtervoegsel zetten (toets 3 rood), en een regel uit BUITENKANT halen
   (toets 4 rood).
   Draai los: node --test test/zekerheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { paneel, oordeel, buitenkant, maakRij, BUITENKANT } = require('../scripts/zekerheid.js');

/* DEZE TOETS BESTAAT OMDAT EEN MUTATIE HEM MISTE, en dat is het opschrijven
   waard. De proef hieronder ("een ontbrekende bron geeft geen nul") liep over de
   rijen van het echte paneel, en daar bestaan alle zes de bronnen -- dus de tak
   "bron ontbreekt" werd nooit gelopen. Toen ik `probeer(fn) ?? 0` als mutatie
   inbracht, werd een verdwenen bron een GEMETEN rij met waarde 0: precies de
   stand waar dit paneel tegen zou beschermen. Alle vijf de toetsen bleven groen.

   De reparatie zit in de bron (maakRij staat nu los en is te voeden) en hier: we
   geven hem een meting die gooit, en eisen null. Een toets die de gevaarlijke
   tak niet kan bereiken, bewaakt die tak niet. */
test('een meting die haar bron niet vindt, geeft null en heet NIET GEMETEN', () => {
  const stuk = maakRij('PROEF', 'weg.json', () => { throw new Error('bron weg'); });
  assert.equal(stuk.waarde, null, 'een verdwenen bron levert null op, nooit een getal');
  assert.notEqual(stuk.waarde, 0, 'en zeker geen nul: dat leest als "niets aan de hand"');
  assert.equal(stuk.stand, 'NIET GEMETEN', 'zo\'n rij mag nooit als GEMETEN meetellen');

  const leeg = maakRij('PROEF', 'weg.json', () => undefined);
  assert.equal(leeg.stand, 'NIET GEMETEN', 'een meting die niets teruggeeft is ook geen meting');
});

test('het oordeel draagt altijd het aantal onbekenden en de woorden NIET ABSOLUUT', () => {
  const u = paneel();
  assert.match(u.oordeel.zin, /NIET ABSOLUUT/, 'het paneel mag nooit een kaal oordeel geven');
  assert.match(u.oordeel.zin, /\(\d+ onbekend\)/, 'hoeveel we niet weten hoort in dezelfde zin te staan');
  assert.match(u.tekst, /NIET ABSOLUUT/, 'en het staat ook echt in de uitvoer, niet alleen in het object');
  assert.doesNotMatch(u.tekst, /\bVEILIG\b|\bSECURE\b',?/,
    'geen enkel scherm van dit huis toont een groen schild met VEILIG');
});

test('een ontbrekende bron geeft geen nul maar NIET GEMETEN', () => {
  const u = paneel();
  for (const r of u.rijen) {
    if (r.stand === 'GEMETEN') continue;
    assert.notEqual(r.waarde, 0, r.naam + ' meldt nul terwijl er niet gekeken is');
    assert.match(r.stand, /NIET GEMETEN|ONTBREEKT/, r.naam + ' heeft een stand die niets zegt');
  }
});

/* DE PERFECTE WERELD. Alles gemeten, niets gebroken, nul onbekenden -- de
   uitslag waar een paneel dat wil imponeren "VEILIG" van zou maken. */
test('zelfs bij nul onbekenden en nul gebroken blijft het oordeel NIET ABSOLUUT', () => {
  const perfect = [
    { naam: 'A', stand: 'GEMETEN', waarde: 'alles goed' },
    { naam: 'B', stand: 'GEMETEN', waarde: '100/100' },
    { naam: 'C', stand: 'GEMETEN', waarde: 'PASS' }
  ];
  const o = oordeel(perfect);
  assert.equal(o.onbekend, 0, 'deze wereld heeft per definitie geen onbekenden');
  assert.equal(o.gebroken, 0, 'en niets gebrokens');
  assert.equal(o.niveau, 'HOOG', 'het niveau mag dan best HOOG heten');
  assert.match(o.zin, /NIET ABSOLUUT/,
    'maar de zin blijft NIET ABSOLUUT dragen -- dit is de hele belofte van dit paneel');
});

test('de zeven soorten bewijs van buiten staan er ook als ze ontbreken', () => {
  const nodig = ['PENTEST', 'RED TEAM', 'ANKER', 'HERSTEL', 'BUILD', 'BUITENWACHT', 'ASVS'];
  const namen = BUITENKANT.map(b => b[0]).join(' | ');
  for (const n of nodig) {
    assert.match(namen, new RegExp(n.split(' ')[0]),
      n + ' hoort in de vaste lijst te staan; wat je weglaat telt niemand');
  }
  for (const r of buitenkant()) {
    assert.ok(r.bron.startsWith('bewijs/'),
      r.naam + ' moet zijn bewijs uit een bestand halen, niet uit een vlag die je met de hand omzet');
  }
});

test('een gebroken zelfmeting maakt het oordeel AANGETAST', () => {
  const o = oordeel([{ naam: 'A', stand: 'GEMETEN', waarde: '3 GEBROKEN' }]);
  assert.equal(o.niveau, 'AANGETAST', 'iets gebrokens hoort het oordeel te dragen, niet weggemiddeld te worden');
  assert.match(o.zin, /NIET ABSOLUUT/);
});
