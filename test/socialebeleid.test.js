/* Het sociale beleid (LIFE.md par. 6): de regels van het lid over zijn eigen
   sociale wereld, en de tweede laag van het wereldpatroon.

   DE TOETS DIE ER HET MEEST TOE DOET staat onderaan: dit beleid kan alleen
   VERSMALLEN. Er bestaat geen instelling waarmee een handeling die een ander
   mens bereikt vanzelf gaat. Bij geld kan dat wel -- daar is de grens het eigen
   tegoed -- en juist daarom moet het verschil hier machinaal bewaakt worden en
   niet alleen opgeschreven.

   Bij elke toets staat de mutatie die hem hoort te laten zakken; ze zijn alle
   met die mutatie gedraaid en gezien zakken (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakBeleid = require('../server/kern/socialebeleid');
const maakVoorstellen = require('../server/kern/socialecommand/voorstellen');
const maakCmdOpslag = require('../server/kern/command/opslag');

const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function opzet() {
  const db = { data: {} };
  const k = maakBeleid({ db, opslag: maakCmdOpslag({ db }), save: () => {}, soorten: ['antwoord'] });
  return { b: k.socialebeleid, db };
}

/* Kijken laat geen spoor achter: een rij per mens die een keer keek, is opslag
   die niemand heeft gevraagd. Zelfde afspraak als kern/geldbeleid.

   DE MUTATIE: laat beleid() pak() aanroepen in plaats van kijk(). */
test('kijken maakt geen opslag aan', () => {
  const { b, db } = opzet();
  const d = b.beleid('k');
  assert.equal(d.horizon, 60);
  assert.deepEqual(db.data, {}, 'wie alleen kijkt, laat niets achter');
});

/* DE MUTATIE: laat zet() een onbekend veld toch opslaan. Opslag die niemand
   leest, gaat ooit iets betekenen zonder dat iemand het bedoelde. */
test('alleen de velden die bestaan, en een onbekend soort wordt geweigerd', () => {
  const { b, db } = opzet();
  assert.ok(b.zet('k', { soort: 'verzin', aan: false }).error);
  b.zet('k', { horizon: 14, onbekend: 'x', automatisch: true });
  assert.deepEqual(Object.keys(db.data.socialebeleid.k).sort(), ['horizon', 'knopUit', 'uit']);
  assert.equal(db.data.socialebeleid.k.horizon, 14);
});

/* DE MUTATIE: haal de grenzen weg bij horizon. Een horizon van nul is "niets"
   (dat doet uitzetten al) en een van tienduizend is geen horizon meer. */
test('de horizon heeft grenzen en die worden gehandhaafd', () => {
  const { b } = opzet();
  for (const n of [0, -5, 366, 'veel', null]) {
    assert.ok(b.zet('k', { horizon: n }).error, 'horizon ' + n + ' hoort geweigerd te worden');
  }
  assert.equal(b.zet('k', { horizon: 1 }).beleid.horizon, 1);
  assert.equal(b.zet('k', { horizon: 365 }).beleid.horizon, 365);
});

/* Een handeling die niets verandert, verandert niets -- en wordt dus ook niet
   als wijziging gemeld. Die les komt uit kern/geldbeleid/actielog.js: een log
   dat volloopt met kliks die niets deden, is met ruis leeg te spoelen.

   DE MUTATIE: laat zet() altijd `gewijzigd: true` teruggeven. */
test('een zet die niets verandert, meldt geen wijziging', () => {
  const { b } = opzet();
  assert.equal(b.zet('k', { horizon: 30 }).gewijzigd, true);
  assert.equal(b.zet('k', { horizon: 30 }).gewijzigd, false);
  assert.equal(b.zet('k', { soort: 'antwoord', aan: false }).gewijzigd, true);
  assert.equal(b.zet('k', { soort: 'antwoord', aan: false }).gewijzigd, false);
});

/* Het beleid moet echt DOORWERKEN in wat Rahul klaarzet -- anders is het een
   instelling die niets doet, en dat is erger dan geen instelling.

   DE MUTATIE: laat voorstellen.js het beleid niet raadplegen (haal de
   magSoort-controle of de horizon-controle weg). */
test('het beleid versmalt wat er klaargezet wordt', () => {
  const { b } = opzet();
  const kern = {
    socialebeleid: b,
    bijeenkomst: {
      mijnAgenda: () => ({ komt: [
        { id: 'b1', groepId: 'g1', groep: 'K', wat: 'Dichtbij', datum: dag(3), mijnAntwoord: null },
        { id: 'b2', groepId: 'g1', groep: 'K', wat: 'Ver weg', datum: dag(200), mijnAntwoord: null }
      ] })
    }
  };
  const v = maakVoorstellen({ kern });

  /* Standaardhorizon is 60 dagen: het verre voorstel valt er buiten. */
  assert.deepEqual(v.voorstellen('k').voorstellen.map(x => x.titel), ['Dichtbij']);

  b.zet('k', { horizon: 1 });
  assert.deepEqual(v.voorstellen('k').voorstellen, [], 'een kortere horizon laat minder zien');

  b.zet('k', { horizon: 365 });
  assert.deepEqual(v.voorstellen('k').voorstellen.map(x => x.titel), ['Dichtbij', 'Ver weg']);

  b.zet('k', { soort: 'antwoord', aan: false });
  assert.deepEqual(v.voorstellen('k').voorstellen, [], 'uitgezet is uitgezet');
});

/* Zonder beleidslaag geldt de veilige standaard: tonen en wachten. Een oudere
   mount mag geen stille verandering van gedrag opleveren.

   DE MUTATIE: laat voorstellen.js knallen of alles overslaan als kern.socialebeleid
   ontbreekt. */
test('zonder beleidslaag blijft het veilige minimum staan', () => {
  const v = maakVoorstellen({ kern: {
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      { id: 'b1', groepId: 'g1', groep: 'K', wat: 'Borrel', datum: dag(3), mijnAntwoord: null }] }) }
  } });
  assert.deepEqual(v.voorstellen('k').voorstellen.map(x => x.titel), ['Borrel']);
});

/* DE BELANGRIJKSTE TOETS VAN DEZE LAAG.

   Bij geld heeft elke regel een niveau, tot en met "automatisch" binnen het
   eigen tegoed (GELD.md par. 3-4). Hier bestaat dat niveau niet, en het ontbreekt
   niet per ongeluk: de grens van deze wereld is een ANDER MENS (LIFE.md par. 3).
   Een beleidslaag met een automatisch-stand zou precies de deur zijn waarlangs
   dat alsnog gebeurt.

   DE MUTATIE: voeg aan het beleid een veld toe dat iets AANZET -- `automatisch`,
   `niveau`, `vanzelf`, `zonderBevestiging`. Deze toets hoort dan te zakken, en
   wie hem toch wil, verandert een wereld en geen instelling. */
test('dit beleid kan alleen versmallen: er is geen automatische stand', () => {
  const { b, db } = opzet();
  b.zet('k', { horizon: 30, soort: 'antwoord', aan: false });

  const opgeslagen = Object.keys(db.data.socialebeleid.k);
  const beeld = Object.keys(b.beleid('k'));
  for (const veld of opgeslagen.concat(beeld)) {
    assert.ok(!/^(automatisch|niveau|vanzelf|zonderBevestiging|autonoom)$/i.test(veld),
      'het beleid draagt een veld dat iets kan aanzetten: ' + veld);
  }
  assert.equal(b.beleid('k').automatischMogelijk, false,
    'en het scherm hoort te kunnen tonen dat die stand hier niet bestaat');

  /* Elk instelbaar veld doet iets UIT of maakt iets KLEINER; geen van beide kan
     Rahul meer laten doen dan hij zonder beleid al mag. */
  assert.deepEqual(Object.keys(b.beleid('k')).sort(),
    ['automatischMogelijk', 'horizon', 'horizonGrens', 'knoppen', 'ok', 'soorten']);

  /* En ook de schakelaars kunnen alleen versmallen: aan is de wereld zoals hij
     zonder beleid ook is, uit haalt iets weg. Geen enkele knop geeft iets dat
     er zonder beleid niet was. */
  for (const k of b.beleid('k').knoppen) {
    assert.equal(k.aan, true, 'standaard staat elke schakelaar AAN: beleid haalt af, het voegt niet toe');
    assert.ok(k.naam && k.uitleg, 'een schakelaar zonder uitleg is een knop waarvan niemand weet wat hij doet');
  }
});

/* DE SCHAKELAARS (besluit van 11 augustus 2026: beleid als aan/uit-knoppen).

   Drie knoppen, en alle drie versmallend. De lijst woont in de kern en niet in
   het scherm, om dezelfde reden als de caps: twee plekken die weten wat
   instelbaar is, lopen uiteen.

   DE MUTATIE: laat zet() een onbekende knop accepteren, of laat een uitgezette
   knop niet doorwerken in de laag die hem raadpleegt. */
test('de drie schakelaars staan standaard aan en zijn alleen versmallend', () => {
  const { b } = opzet();
  assert.deepEqual(b.beleid('k').knoppen.map(x => x.knop), ['bereik', 'vonk', 'stilte']);
  assert.ok(b.zet('k', { knop: 'verzin', aan: false }).error, 'een knop die niet bestaat, bestaat niet');

  assert.equal(b.zet('k', { knop: 'vonk', aan: false }).gewijzigd, true);
  assert.equal(b.zet('k', { knop: 'vonk', aan: false }).gewijzigd, false, 'twee keer uitzetten is een keer');
  assert.equal(b.knopAan('k', 'vonk'), false);
  assert.equal(b.knopAan('k', 'bereik'), true, 'de ene knop raakt de andere niet');

  b.zet('k', { knop: 'vonk', aan: true });
  assert.equal(b.knopAan('k', 'vonk'), true, 'weer aan is terug naar de standaard, niet meer dan dat');
});

/* Het stiltevenster is een VAST venster (zaterdag en zondag) en geen instelbaar
   uur: een instelbaar venster is een tweede klok, en de winst is nul -- er zijn
   hier geen meldingen die iemand wakker maken.

   DE MUTATIE: laat inStilte() true geven terwijl de knop AAN staat. Dan zet
   Rahul niets klaar bij iemand die daar nooit om vroeg. */
test('het stiltevenster geldt alleen als de knop uit staat', () => {
  const { b } = opzet();
  const zaterdag = new Date('2026-08-15T12:00:00Z'); // zaterdag
  const dinsdag = new Date('2026-08-11T12:00:00Z');
  assert.equal(b.inStilte('k', zaterdag), false, 'met de knop aan is er geen stilte');
  b.zet('k', { knop: 'stilte', aan: false });
  assert.equal(b.inStilte('k', zaterdag), true);
  assert.equal(b.inStilte('k', dinsdag), false, 'doordeweeks blijft het gewoon werken');
});
