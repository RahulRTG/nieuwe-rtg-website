/* Het levensbeleid (LEVEN.md par. 3): de tweede laag van het wereldpatroon voor
   RTFoundation, en de laag die er nog niet was.

   Twee dingen bewaken deze toetsen boven alles:

     1. dit beleid kan alleen VERSMALLEN -- er is geen veld dat vooraf deelt
     2. het eigen slot komt BOVENOP het huisslot en kan het nooit openen

   Die tweede is de scherpste: als een beleidsregel een stuk uit de vaste
   NOOIT-lijst zou kunnen vrijgeven, dan is het gevoelsdagboek ineens deelbaar
   met een instelling -- en dat is een grens uit LEVEN.md par. 2.5, geen
   voorkeur.

   Bij elke toets staat de mutatie die hem hoort te laten zakken; ze zijn alle
   met die mutatie gedraaid en gezien zakken (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakBeleid = require('../server/kern/levensbeleid');
const maakBand = require('../server/kern/levensband');

const STUKKEN = ['lijn', 'talenten', 'interesses', 'bijdrage', 'diplomas', 'talen', 'afspraken', 'gezondheid'];
const straks = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

function opzet() {
  const db = { data: {} };
  const b = maakBeleid({ db, save: () => {}, stukken: STUKKEN }).levensbeleid;
  const band = maakBand({ db, save: () => {}, beleid: b }).levensband;
  return { b, band, db };
}

/* Een band opzetten die leeft, zodat er iets te delen valt. */
function metBand(band) {
  const v = band.bandVraag('lid-a', 'rtf:kind-b', { soort: 'ouder', lidKant: 'van' });
  band.bandBevestig('rtf:kind-b', v.band.id);
  return v.band.id;
}

test('kijken maakt geen opslag aan', () => {
  const { b, db } = opzet();
  assert.equal(b.beleid('lid-a').standaardTot, 90);
  assert.deepEqual(db.data, {}, 'wie alleen kijkt, laat niets achter');
});

/* DE MUTATIE: laat zet() een onbekend veld opslaan, of een onbekend stuk
   accepteren. */
test('alleen de velden en stukken die bestaan', () => {
  const { b, db } = opzet();
  assert.ok(b.zet('lid-a', { stuk: 'verzin', nooit: true }).error);
  for (const n of [0, -1, 366, 'veel', null]) {
    assert.ok(b.zet('lid-a', { standaardTot: n }).error, 'standaardTot ' + n + ' hoort geweigerd');
  }
  b.zet('lid-a', { standaardTot: 30, automatisch: true, vooraf: 'ouder' });
  assert.deepEqual(Object.keys(db.data.levensbeleid['lid-a']).sort(), ['nooit', 'standaardTot']);
});

/* DE MUTATIE: laat zet() altijd `gewijzigd: true` teruggeven. Een log dat
   volloopt met kliks die niets deden, is met ruis leeg te spoelen. */
test('een zet die niets verandert, meldt geen wijziging', () => {
  const { b } = opzet();
  assert.equal(b.zet('lid-a', { stuk: 'talenten', nooit: true }).gewijzigd, true);
  assert.equal(b.zet('lid-a', { stuk: 'talenten', nooit: true }).gewijzigd, false);
  assert.equal(b.zet('lid-a', { standaardTot: 30 }).gewijzigd, true);
  assert.equal(b.zet('lid-a', { standaardTot: 30 }).gewijzigd, false);
});

/* Het beleid moet echt DOORWERKEN in het delen -- anders is het een instelling
   die niets doet, en dat is erger dan geen instelling.

   DE MUTATIE: haal de beleid-controle uit kern/levensband/delen.js. */
test('een stuk op nooit-delen kan niet meer gedeeld worden', () => {
  const { b, band } = opzet();
  const bandId = metBand(band);

  const eerst = band.deelZet('lid-a', { bandId, stuk: 'talenten', vervalt: straks });
  assert.equal(eerst.status, 200, 'zonder slot mag het gewoon');
  band.deelIn('lid-a', eerst.deling.id);

  b.zet('lid-a', { stuk: 'talenten', nooit: true });
  const na = band.deelZet('lid-a', { bandId, stuk: 'talenten', vervalt: straks });
  assert.equal(na.status, 403);
  assert.match(na.error, /nooit-delen/);

  /* En het slot is van DEZE mens: een ander wordt er niet door geraakt. */
  const ander = band.deelZet('rtf:kind-b', { bandId, stuk: 'talenten', vervalt: straks });
  assert.equal(ander.status, 200, 'het slot van de een is niet het slot van de ander');
});

/* DE SCHERPSTE TOETS. Het eigen slot komt BOVENOP het huisslot. Zou een
   beleidsregel een stuk uit de vaste NOOIT-lijst kunnen openen, dan is het
   gevoelsdagboek ineens deelbaar met een instelling -- en dat is een grens uit
   LEVEN.md par. 2.5, geen voorkeur.

   DE MUTATIE: zet de beleid-controle in delen.js VOOR de NOOIT-controle, of
   laat het beleid een `altijd`-lijst dragen die NOOIT overruled. */
test('het beleid kan niets openen dat de vaste lijst verbiedt', () => {
  const { b, band } = opzet();
  const bandId = metBand(band);
  /* 'dagboek' staat op de vaste NOOIT-lijst en is geen instelbaar stuk. Zelfs
     als iemand hem als beleid probeert te zetten, verandert er niets aan de
     weigering. */
  assert.ok(b.zet('lid-a', { stuk: 'dagboek', nooit: false }).error,
    'een stuk dat niet deelbaar is, is ook geen beleidskeuze');
  const r = band.deelZet('lid-a', { bandId, stuk: 'dagboek', vervalt: straks });
  assert.equal(r.status, 403);
  assert.match(r.error, /van u alleen/);
});

/* Zonder beleidslaag verandert er niets aan het gedrag: een oudere mount of een
   toets die alleen levensband opzet, moet gewoon blijven werken.

   DE MUTATIE: laat delen.js knallen of alles weigeren als `beleid` ontbreekt. */
test('zonder beleidslaag blijft levensband zich hetzelfde gedragen', () => {
  const db = { data: {} };
  const band = maakBand({ db, save: () => {} }).levensband;
  const bandId = metBand(band);
  const r = band.deelZet('lid-a', { bandId, stuk: 'talenten', vervalt: straks });
  assert.equal(r.status, 200);
});

/* DE TWEEDE HOOFDTOETS: dit beleid kan alleen versmallen.

   Er bestaat geen veld dat vooraf deelt, geen "deel dit voortaan automatisch met
   mijn ouder", geen vertrouwensniveau. Dat zou besluit 2 uit LEVEN.md par. 2.8
   door de achterdeur ongedaan maken: van een minderjarige ziet de ander
   standaard NIETS, en het kind deelt per stuk.

   DE MUTATIE: voeg een veld toe dat iets aanzet -- `vooraf`, `automatisch`,
   `altijd`, `niveau`. */
test('er is geen stand waarmee iets vooraf gedeeld wordt', () => {
  const { b, db } = opzet();
  b.zet('lid-a', { stuk: 'talenten', nooit: true, standaardTot: 14 });
  const velden = Object.keys(db.data.levensbeleid['lid-a']).concat(Object.keys(b.beleid('lid-a')));
  for (const veld of velden) {
    assert.ok(!/^(vooraf|automatisch|altijd|niveau|autonoom|standaardDelen)$/i.test(veld),
      'het beleid draagt een veld dat vooraf kan delen: ' + veld);
  }
  assert.equal(b.beleid('lid-a').vooraafDelenMogelijk, false);
  assert.deepEqual(Object.keys(b.beleid('lid-a')).sort(),
    ['grens', 'nooit', 'ok', 'standaardTot', 'stukken', 'vooraafDelenMogelijk']);
});

/* De standaardtermijn maakt de veilige keuze de makkelijke, maar neemt hem niet
   over: de datum blijft verplicht bij het delen zelf.

   DE MUTATIE: laat delen.js de standaardTot invullen wanneer er geen datum is
   meegegeven. Dan is een deling zonder gekozen einddatum ineens mogelijk, en de
   belofte "toestemming die eeuwig duurt wordt vergeten" leunt op een instelling
   in plaats van op een keuze. */
test('de standaardtermijn stelt voor, hij vult niet in', () => {
  const { b, band } = opzet();
  const bandId = metBand(band);
  b.zet('lid-a', { standaardTot: 14 });
  const r = band.deelZet('lid-a', { bandId, stuk: 'talenten' });
  assert.equal(r.status, 400, 'zonder datum blijft delen een onvolledige handeling');
  assert.match(r.error, /Tot wanneer/);
});

/* WAT ER ONLANGS EINDIGDE (LEVEN.md par. 2.10, besluit van 11 augustus 2026).

   Een verbroken band verdween tot nu toe zonder enig spoor: de andere kant kon
   niet zien of er een band was die eindigde, of dat er nooit een was. Dat is nu
   zichtbaar -- maar alleen DÁT het voorbij is, en alleen binnen een venster.

   Twee grenzen komen hier samen, en de toets bewaakt ze allebei:

     1. GEEN `verbrokenDoor` en geen reden. Verbreken kan zonder uitleg (par.
        2.8); bij een band met twee kanten zou "wie" van een handeling van een
        kind een verantwoording maken.
     2. GEEN BLIJVENDE LIJST. Na het venster verdwijnt het uit beeld -- een lijst
        met oude banden is een lijst met mensen die iemand liever niet meer ziet
        (de reden die al boven mijnBanden stond).

   DE MUTATIE: neem `verbrokenDoor` op in de teruggegeven vorm, of haal de
   venstergrens weg. Allebei laten deze toets zakken. */
test('een verbroken band laat een spoor na: dat het voorbij is, en verder niets', () => {
  const { band, db } = opzet();
  const bandId = metBand(band);
  assert.equal(band.bandBeeindigd('rtf:kind-b').length, 0, 'een levende band eindigde niet');

  band.bandVerbreek('rtf:kind-b', bandId);

  /* De ANDERE kant ziet dat het voorbij is -- daar ging deze verandering over. */
  const bij = band.bandBeeindigd('lid-a');
  assert.equal(bij.length, 1);
  assert.deepEqual(Object.keys(bij[0]).sort(), ['beeindigdAt', 'id', 'soort'],
    'geen wie en geen reden: verbreken kan zonder uitleg');
  assert.ok(bij[0].beeindigdAt, 'wanneer het eindigde hoort er wel bij te staan');

  /* En hij staat niet meer tussen de levende banden. */
  assert.deepEqual(band.banden('lid-a'), []);

  /* Buiten het venster verdwijnt hij uit beeld en blijft alleen in de opslag. */
  const rij = db.data.levensbanden.banden.find(b => b.id === bandId);
  rij.verbrokenAt = new Date(Date.now() - 60 * 864e5).toISOString();
  assert.deepEqual(band.bandBeeindigd('lid-a'), [],
    'na het venster is het geen lijst meer van mensen die iemand liever niet ziet');
  assert.equal(rij.staat, 'verbroken', 'het spoor blijft wel in de opslag staan');
});
