/* DE MOMENTPROEF -- de vierde keten, en de eerste die over een PROJECTIE gaat.

   scripts/momentproef.js legt een publieke keten af zoals scripts/ritproef.js
   een ritketen: van een feit bij de bron tot een melding bij iemand die daar
   zelf ja tegen heeft gezegd. Dit bestand bewaakt het INSTRUMENT en niet de
   keten -- die draait tegen een wegwerpserver en duurt daar minuten.

   WAT HIER ANDERS IS DAN BIJ DE DRIE BESTAANDE, en wat deze toetsen dus extra
   moeten vasthouden: deze proef draagt naast schakels en storingen een
   ARCHITECTUURPROEF, en die is de eigenlijke reden dat hij bestaat. De wet die
   hij beproeft (STAGE.md par. 3) is dat de BRON bepaalt DAT iets gebeurd is en
   Stage alleen bepaalt HOE dat wordt getoond. Een keten die sluit terwijl de
   projectie ondertussen een tweede waarheid is geworden, heeft niets bewezen --
   dat is de `Asset`-fout een laag later. Toets 5 en 6 gaan daarover.

   EN ER IS EEN TWEEDE LES DIE IN DE TOETSEN STAAT. Bewering B (het antwoord van
   de bron staat stil) is met een mutatie nagetrokken en BLEEF GROEN: een
   volgersteller die door de volgroute in de producten van het festival werd
   teruggeschreven, haalt het antwoord van de bron nooit, want dat wordt gevormd.
   Daarom staat er een bewering D naast die de BRON van de laag leest. Toets 6
   houdt vast dat die er allebei zijn: zwart-doos en bron zijn hier geen keuze
   maar twee helften.

   Draai los: node --test test/momentproef.test.js
   De keten zelf: npm run momentproef && npm run ketenvorm */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'momentproef.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel zonder reden, en niet op een bevinding', () => {
  assert.match(bron, /uit\.sluit = heel && t\.openBekend === 0/,
    'sluit hoort ALLE slechte uitkomsten te tellen, openBekend inbegrepen');
  assert.match(bron, /t\.architectuurGebroken === 0/,
    'een gebroken architectuurbewering laat de proef niet zakken; dan is zij versiering');
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
  assert.match(bron, /uit\.sluitMetBevinding =/, 'er is geen apart veld voor "loopt door, met een bevinding"');
});

test('1. de proef draait op een wegwerpserver, met een zaak die tickets draagt', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.match(bron, /DEMO_SUPPLIER: ZAAK/, 'zonder deze omgeving logt de proef in bij de verkeerde zaak');
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
});

test('2. de proef deelt geen module met de drie andere ketens', () => {
  /* Een gedeelde ketenklasse zou scripts/ketenvorm.js zijn eigen aanname laten
     meten: de vorm is dan gelijk omdat hij is voorgeschreven, en niet omdat de
     domeinen hem delen. Dat is de `Asset`-fout, en hij is hier goedkoop te
     maken -- vandaar deze toets. */
  assert.doesNotMatch(bron, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
    'de momentproef hangt aan een gedeelde ketenmodule');
});

test('3. elke openBekend-schakel draagt een reden die iets beweert en ergens heen wijst', () => {
  const j = lees('MOMENTPROEF.json');
  const bevindingen = j.schakels.filter(s => s.stand === 'openBekend');
  assert.ok(bevindingen.length >= 1, 'geen enkele bevinding -- dan bewaakt deze toets niets');
  assert.equal(bevindingen.length, (j.bevindingen || []).length, 'de bevindingenlijst loopt niet gelijk met de schakels');
  for (const s of bevindingen) {
    assert.ok(s.bekend && s.bekend.length > 120,
      'schakel ' + s.nr + ': de reden is te kort om een bevinding te zijn in plaats van een etiket');
    assert.match(s.bekend, /STAGE\.md|besluit|register/i,
      'schakel ' + s.nr + ': de reden zegt niet waar het besluit hoort te vallen');
    /* Een schakel die door een WEIGERING openstaat heeft geen `ziet` maar wel een
       antwoord van de server. Beide zijn bewijs; geen van beide mag ontbreken,
       anders staat er een reden zonder meting onder. */
    assert.ok((s.ziet && s.ziet.length > 10) || (s.antwoord && s.antwoord.length > 3),
      'schakel ' + s.nr + ': een bevinding hoort te zeggen wat er WEL gemeten is');
  }
});

test('4. het register sluit en telt op', () => {
  const j = lees('MOMENTPROEF.json');
  const t = j.telling;
  assert.equal(t.gesloten + t.open + t.openBekend + t.stuk, t.schakels, 'de schakelstanden tellen niet op');
  assert.equal(t.gehouden + t.gebroken, t.storingen, 'de storingstanden tellen niet op');
  /* DRIE TELLERS EN NIET TWEE. De eerste versie liet de architectuurbeweringen
     in dezelfde `gehouden` lopen als de storingen, en meldde toen twaalf
     storingen waarvan er vijftien gehouden waren. */
  assert.equal(t.architectuurGehouden + t.architectuurGebroken, t.architectuur,
    'de architectuurbeweringen lopen in dezelfde teller als de storingen');
  assert.ok(t.schakels >= 7 && t.storingen >= 4, 'te weinig schakels of storingen');
  assert.equal(t.open, 0, 'er staat een schakel open zonder reden -- draai npm run momentproef en repareer of verklaar');
  assert.equal(t.stuk, 0);
  assert.equal(t.gebroken, 0);
  assert.equal(t.architectuurGebroken, 0);
  assert.equal(j.sluitMetBevinding, true);
  assert.ok(j.grens && j.grens.length > 80, 'het register draagt geen uitgeschreven grens');
});

test('5. de architectuurproef beweert alle vier, en de bron blijft de bron', () => {
  const j = lees('MOMENTPROEF.json');
  const ids = (j.architectuur || []).map(a => a.id);
  for (const id of ['A', 'B', 'C', 'D'])
    assert.ok(ids.includes(id), 'architectuurbewering ' + id + ' ontbreekt');
  for (const a of j.architectuur) {
    assert.equal(a.stand, 'gehouden', 'architectuurbewering ' + a.id + ' is gebroken: ' + a.gemeten);
    assert.ok(a.gemeten && a.gemeten.length > 20,
      'bewering ' + a.id + ' draagt geen meting; dan is het een uitspraak en geen bewijs');
  }
  /* A gaat over het geval ZONDER volgers, en dat is het hele punt: wie
     `gewekt: []` als "er is niets gebeurd" leest, heeft de wet omgedraaid. */
  const a = j.architectuur.find(x => x.id === 'A');
  assert.match(a.bewering, /niemand|luistert/i, 'A meet het makkelijke geval in plaats van het lege');
});

test('6. B en D meten iets anders, en dat staat er ook', () => {
  /* De scherpste toets hier. B is zwart-doos en D leest de bron van de laag; de
     mutatie die B miste (een volgersteller terugschrijven in de producten van de
     bron) wordt door D wel gevonden. Wie D weghaalt "omdat B er al is", haalt
     precies de helft weg die de creep vangt. */
  assert.match(bron, /db\\\.data\\\.\(\[A-Za-z_\$\]\[\\w\$\]\*\)/,
    'D leest de collecties niet meer uit de bron van de Stage-laag');
  assert.match(bron, /mediaAanwezig', 'mediaVolgt'/,
    'D noemt de eigen collecties van de laag niet met naam');
  assert.match(bron, /B bleef groen|B is met een mutatie/,
    'de reden dat D naast B staat, is niet opgeschreven -- dan haalt de volgende hem weg');
  const j = lees('MOMENTPROEF.json');
  const b = j.architectuur.find(x => x.id === 'B');
  assert.match(b.bewering, /ANTWOORD/,
    'B belooft meer dan hij meet: hij vergelijkt het antwoord van de bron, niet haar toestand');
});

test('7. de proef zet zijn wereld klaar en zegt dat erbij', () => {
  const j = lees('MOMENTPROEF.json');
  assert.ok(j.wereld && j.wereld.festival,
    'de zaaiset heeft geen festival; wie dat klaarzet zonder het te melden, verbergt de opstelling');
  assert.match(j.wereld.mensen || '', /pas/,
    'drie tokens op dezelfde pas zijn dezelfde mens -- dat hoort in de opstelling te staan');
});

test('8. de ketenvorm telt deze keten mee', () => {
  const v = lees('KETENVORM.json');
  assert.ok(v.ketens.some(k => k.naam === 'moment'), 'de momentproef staat niet in de ketenvorm');
  assert.equal(v.ketens.length, v.telling.ketens);
  /* DE UITKOMST MAG BEWEGEN, de vorm van de uitslag niet. Wat hier vastligt is
     dat "gedeeld" over ALLE ketens gaat en dat er een middenbak is: zonder die
     bak verdwijnt een vondst zodra er een keten bijkomt die hem niet heeft, en
     leest de uitslag alsof twee ketens niets delen terwijl ze een actor delen. */
  assert.ok(Array.isArray(v.actoren.bijna),
    'de actoren kennen geen middenbak; dan heet een actor in twee ketens twee keer "alleen"');
  for (const [keten, eigen] of Object.entries(v.actoren.eigen))
    for (const a of eigen)
      assert.ok(!v.actoren.bijna.includes(a),
        'actor "' + a + '" staat als eigen van ' + keten + ' EN als gedeeld door meer ketens');
});
