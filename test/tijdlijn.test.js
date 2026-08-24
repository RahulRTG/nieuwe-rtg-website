/* DE CONFIGURATIETIJDLIJN: acht beweringen, en ze gaan allemaal over de manier
   waarop een "wat is er veranderd"-scherm normaal gesproken onwaar wordt.

   1. DRIE BRONNEN OP ÉÉN LIJN, elk met zijn eigen naam erbij. Een regel zonder
      bron is niet na te trekken.
   2. HIJ BEWAART NIETS. Wat de bron zegt, staat er; er is geen vierde opslag die
      op een dag iets anders zegt dan de drie waar zij uit komt.
   3. VOLGORDE IS GEEN OORZAAK. Elk antwoord van `rondom` draagt die zin, want een
      tijdlijn zonder die zin wordt binnen een week gelezen als een oorzakenlijst.
   4. "NIETS GEVONDEN" IS NIET "NIETS GEBEURD". Een leeg venster zegt dat met
      zoveel woorden.
   5. WAT DEZE LIJN NIET ZIET, STAAT ERBIJ -- per bron én als aparte lijst.
   6. EEN AANVRAAG DIE NIETS VERANDERDE, STAAT ER TOCH IN, met de status erbij.
      Wie zoekt naar wat er veranderde, wil ook zien wat er bijna veranderde.
   7. DE AFSTAND IS GEMETEN. `secondenVoor` is het enige getal hier, en het is
      een verschil van twee tijdstempels en geen schatting.
   8. HET VENSTER IS BEGRENSD. Een venster van een jaar is geen tijdlijn maar een
      export.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de `let`-zin uit rondom() gehaald
     -> "volgorde is geen oorzaak" ZAKT (RAAK)
   - de lege-venster-tak van die zin weggehaald
     -> "niets gevonden is niet niets gebeurd" ZAKT (RAAK)
   - BUITEN_BEELD leeggemaakt
     -> "wat deze lijn niet ziet, staat erbij" ZAKT (RAAK)
   - de aanvraagregel (status wacht/geweigerd) niet meer opnemen
     -> "een aanvraag die niets veranderde, staat er toch in" ZAKT (RAAK)
   - de bovengrens van 24 uur uit rondom() gehaald
     -> "het venster is begrensd" ZAKT (RAAK)
   - grens() terug naar `Number(minuten || 30)`
     -> "het venster is begrensd" ZAKT (RAAK). Dat was een echte fout, gevonden
        door deze toets: een gevraagde NUL is falsy, dus wie om een venster van
        nul minuten vroeg kreeg er stil dertig en dus veel meer regels dan hij
        vroeg.

   Draai los: node --test test/tijdlijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakTijdlijn } = require('../server/kern/command/tijdlijn');

const T = (min) => new Date(Date.parse('2026-08-24T12:00:00.000Z') - min * 60000).toISOString();
const NU = '2026-08-24T12:00:00.000Z';

function opstelling() {
  const db = { data: { techniek: {
    functieVerzoeken: [
      { vid: 'a1', label: 'Salon UIT', wijzigingen: [{ id: 'salon', aan: false }],
        doorNaam: 'Sarah', at: T(9), status: 'akkoord', besluitAt: T(8) },
      { vid: 'a2', label: 'Betalen UIT', wijzigingen: [{ id: 'betalen', aan: false }],
        doorNaam: 'Sarah', at: T(6), status: 'geweigerd', besluitAt: T(5) },
      { vid: 'a3', label: 'Spelen UIT', wijzigingen: [{ id: 'spellen', aan: false }],
        doorNaam: 'Sarah', at: T(4), status: 'wacht' }
    ],
    incidentcontrole: { audit: [{ at: T(3), actie: 'noodstand aan', door: 'de eigenaar', reden: 'proef' }] }
  } } };
  const regels = [
    { at: T(20), actor: 'kantoor', actie: 'beleid zetten', objectType: 'beleid', objectId: 'herstel.autoAan',
      niveau: 'hand', reden: 'autoherstel uit' },
    { at: T(2), actor: 'kantoor', actie: 'herstel uitvoeren', objectType: 'runbook', objectId: 'rit-vast',
      niveau: 'auto', reden: 'ritten hervat' }
  ];
  const journaal = { recent: () => regels.slice().reverse() };
  return { db, tijdlijn: maakTijdlijn({ db, journaal }) };
}

test('1. drie bronnen op één lijn, elk met zijn naam erbij', () => {
  const t = opstelling();
  const d = t.tijdlijn.lijst({ max: 100 });
  const bronnen = [...new Set(d.regels.map(r => r.bron))].sort();
  assert.deepEqual(bronnen, ['journaal', 'noodstand', 'schakelaar']);
  for (const r of d.regels) assert.ok(r.bron && r.at && r.wat, 'een regel zonder bron, tijd of tekst');
  /* Nieuwste eerst: dat is de volgorde waarin iemand kijkt. */
  for (let i = 1; i < d.regels.length; i++) {
    assert.ok(Date.parse(d.regels[i - 1].at) >= Date.parse(d.regels[i].at), 'de lijn loopt niet aflopend');
  }
});

test('2. hij bewaart niets', () => {
  const t = opstelling();
  t.tijdlijn.lijst({ max: 100 });
  t.tijdlijn.rondom(NU, 30);
  const eigen = Object.keys(t.db.data).filter(k => /tijdlijn/i.test(k));
  assert.deepEqual(eigen, [], 'de tijdlijn legde een eigen opslag aan: ' + eigen.join(', '));
});

test('3. volgorde is geen oorzaak, en 7. de afstand is gemeten', () => {
  const t = opstelling();
  const r = t.tijdlijn.rondom(NU, 30);
  assert.ok(r.aantal >= 5, 'er is te weinig gevonden om iets te toetsen: ' + r.aantal);
  assert.match(r.let, /VOLGORDE en geen oorzaak/);
  assert.ok(!/veroorzaakt|oorzaak van/i.test(JSON.stringify(r.regels)), 'er staat een oorzaakclaim in de regels');
  const herstel = r.regels.find(x => x.soort === 'herstel uitvoeren');
  assert.equal(herstel.secondenVoor, 120, 'de afstand is geen gemeten verschil van twee tijdstempels');
});

test('4. "niets gevonden" is niet "niets gebeurd"', () => {
  const t = opstelling();
  const leeg = t.tijdlijn.rondom('2020-01-01T00:00:00.000Z', 30);
  assert.equal(leeg.aantal, 0);
  assert.match(leeg.let, /iets anders dan "er is niets veranderd"/);
});

test('5. wat deze lijn niet ziet, staat erbij', () => {
  const t = opstelling();
  for (const d of [t.tijdlijn.lijst({}), t.tijdlijn.rondom(NU, 30)]) {
    assert.equal(d.bronnen.length, 3);
    for (const b of d.bronnen) assert.ok(b.zietNiet && b.zietNiet.length > 20, b.id + ' zegt niet wat hij mist');
    assert.ok(d.buitenBeeld.length >= 3, 'er staat geen lijst met wat er buiten beeld valt');
    for (const b of d.buitenBeeld) assert.ok(b.waarom && b.waarom.length > 20, b.wat + ' heeft geen reden');
  }
});

test('6. een aanvraag die niets veranderde, staat er toch in', () => {
  const t = opstelling();
  const r = t.tijdlijn.rondom(NU, 30);
  const geweigerd = r.regels.filter(x => x.soort === 'schakelaar geweigerd');
  const wacht = r.regels.filter(x => x.status === 'wacht');
  assert.equal(geweigerd.length, 1, 'een geweigerde aanvraag verdween van de lijn');
  assert.equal(wacht.length, 1, 'een wachtende aanvraag verdween van de lijn');
  assert.equal(geweigerd[0].veranderdeIets, false);
  const omgezet = r.regels.find(x => x.soort === 'schakelaar omgezet');
  assert.equal(omgezet.veranderdeIets, true);
  /* En het aantal dat WERKELIJK iets veranderde staat apart: anders leest
     "vijf wijzigingen vlak ervoor" als vijf wijzigingen. */
  assert.ok(r.veranderdeIets < r.aantal, 'alles telt als een echte wijziging');
});

test('8. het venster is begrensd', () => {
  const t = opstelling();
  const groot = t.tijdlijn.rondom(NU, 60 * 24 * 365);
  assert.equal(groot.venster.minuten, 24 * 60, 'een venster van een jaar werd gewoon geaccepteerd');
  const klein = t.tijdlijn.rondom(NU, 0);
  assert.equal(klein.venster.minuten, 1, 'een venster van nul minuten werd geaccepteerd');
  const stuk = t.tijdlijn.rondom('geen tijd', 30);
  assert.equal(stuk.status, 400, 'een onzinnig moment gaf gewoon een lijst terug');
});
