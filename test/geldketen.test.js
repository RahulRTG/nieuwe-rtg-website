/* DE GOUDEN WEG (server/kern/kantoor/geldketen.js).

   Deze toets beproeft de BAAN en niet de motoren: die hebben hun eigen toetsen.
   Wat hier moet vaststaan is dat een geldhandeling er niet buitenom kan, en dat
   een keten die een verplichte as mist ook ECHT niet rond heet.

     1 de baan loopt: van klaarzetten tot uitgevoerd, met elke verplichte as
       gehaald en het dossier `rond`;
     2 zonder mens op naam gaat er niets (een gedeelde code is geen mens);
     3 zonder assurance gaat er niets;
     4 het mandaat wordt gevraagd en zegt NEE -- en dat is de as die werkt;
     5 een as op graad `vermoed` of `onbekend` telt NIET als gehaald, en het
       dossier zegt welke verplichte as open staat;
     6 de twee handelingsklassen eisen verschillende assen, en het verschil is
       uitgeschreven (atomair tegenover hervatbaar);
     7 uitvoeren zonder tweede handtekening gaat niet door als het besluit er een
       vraagt;
     8 het journaal is een hashketen die zichzelf verifieert.

   DE STUBS ZIJN MET OPZET DUN, behalve het voornemen: dat is de motor waar de
   baan op rust, dus die draait ECHT (kern/commercie/voornemen.js) met een echte
   beslislaag (kern/kantoor/geldbevoegdheid.js) erachter. Een baan die met een
   nagemaakt voornemen groen staat, bewijst niets over de baan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { maakGeldketen, KLASSEN, KETENS } = require('../server/kern/kantoor/geldketen');
const { maakVoornemens } = require('../server/kern/commercie/voornemen');
const { maakBeslis } = require('../server/kern/kantoor/geldbevoegdheid');
const bewijs = require('../server/kern/commercie/bewijstoken');

function huis({ zonderSleutel = false } = {}) {
  const data = {};
  const bakken = {};
  const bak = (naam) => (bakken[naam] = bakken[naam] || []);
  const db = { data };
  const save = () => {};

  /* De tokenlaag met een ECHTE ondertekensleutel: zonder sleutel zegt de laag
     terecht dat een token een briefje is, en dan meet toets 1 iets anders dan
     hij denkt. Toets 5 gebruikt juist de variant zonder sleutel. */
  const token = bewijs.maakBewijstoken({
    sleutel: zonderSleutel ? null : Buffer.from('01234567890123456789012345678901'),
    gezien: bewijs.geheugenGezien() });
  const beslisser = maakBeslis({ munt: token.munt });

  const kern = { beslis: beslisser.beslis };
  const voornemens = maakVoornemens({ db, save, verbruikToken: token.verbruik,
    beslis: (vraag) => kern.beslis(vraag) });

  /* DE ECHTE FRICTIEMOTOR, met een minimaal beleid eronder: `maakRisico` leest
     zijn grenzen uit het beleidsregister (kern/command/beleid.js, db-backed), en
     dat hoort niet in een unittoets. `getal` geeft hier de standaard terug, dus de
     motor rekent met zijn eigen ingebakken grenzen. Wat NIET mag is de MODULE
     meegeven in plaats van een motor -- dan heeft de baan geen `beoordeel` en zet
     zij de frictie-as stil op onbekend. Precies die fout zat in de bedrading. */
  const frictie = require('../server/kern/frictie').maakRisico({
    beleid: { getal: (naam, standaard) => standaard, waarde: (naam, standaard) => standaard } });
  const ketenlaag = maakGeldketen({ voornemens, frictie, bak });
  return { ketenlaag, voornemens, bak, token };
}

const OPGAVE = (extra) => Object.assign({
  klasse: 'geld-reeks',
  handeling: 'GELD_INNEN',
  pad: '/api/office/bank/incasso',
  doel: 'incassoronde tot nu',
  mens: { naam: 'ans', sleutel: 'user-1' },
  assurance: { ok: true, bewezen: true },
  streefstand: 'elke vaste betaling die aan de beurt was, is geind of staat met een mislukking bij zijn post',
  tegenfeit: { graad: 'vermoed', uitslag: { aantal: 2, bedragCenten: 4000 }, reden: 'bovengrens: wat aan de beurt is' },
  stappen: [{ wat: 'incassoronde', doel: 'tot 1', centen: 4000, gegevens: { tot: 1 } }],
  totaalCenten: 4000,
  sleutel: 'incasso:1',
  uitvoerbelofte: { graad: 'gemeten', uitslag: 'hervatbaar per post', reden: 'de ronde zet volgendeAt per post vooruit' },
}, extra || {});

test('1. de baan loopt van klaarzetten tot uitgevoerd, en het dossier is rond', async () => {
  const { ketenlaag } = huis();
  const klaar = ketenlaag.klaarzet(OPGAVE());
  assert.ok(klaar.ok, 'klaarzetten gaf: ' + JSON.stringify(klaar));
  const id = klaar.voornemen.id;

  /* 4.000 cent zit onder de tweede-handtekeninggrens van besluit.js (1.000 euro)
     en boven de grens voor een verse bevestiging (500 euro) -- die laatste is
     gegeven via de assurance, dus dit hoort GEKEURD te zijn. */
  assert.equal(klaar.voornemen.stand, 'GEKEURD', 'stand na keuring: ' + klaar.voornemen.stand +
    ' (' + JSON.stringify(klaar.voornemen.besluit) + ')');

  let gedaan = null;
  /* De tweede mens tekent, precies zoals de route dat doet: onder de
     goedkeuringsgrens vraagt het voornemen zelf geen handtekening, maar de deur
     heeft er een geeist -- en dan hoort die as gevuld te zijn. */
  const t = ketenlaag.tekenAf({ id, door: 'bert' });
  assert.ok(t.ok, 'aftekenen gaf: ' + JSON.stringify(t));
  assert.equal(t.aanDeDeur, true, 'onder de grens hoort dit de deur-variant te zijn');

  const r = await ketenlaag.uitvoer({ id, door: 'bert',
    doe: async (stap) => { gedaan = stap; return { ok: true, uitgevoerd: 2, bedragCenten: 4000 }; } });
  assert.ok(r.ok, 'uitvoeren gaf: ' + JSON.stringify(r));
  assert.equal(r.voornemen.stand, 'UITGEVOERD');
  assert.ok(gedaan, 'de uitvoerder is nooit aangeroepen');
  assert.equal(gedaan.centen, 4000);
  assert.ok(String(gedaan.idemSleutel).startsWith('incasso:1'),
    'de stap draagt de economische sleutel van het voornemen: ' + gedaan.idemSleutel);

  const d = ketenlaag.dossier(id).dossier;
  assert.deepEqual(d.open, [], 'deze verplichte assen staan nog open: ' + d.open.join(', '));
  assert.equal(d.rond, true);
});

test('2. zonder mens op naam gaat er niets', () => {
  const { ketenlaag } = huis();
  const r = ketenlaag.klaarzet(OPGAVE({ mens: null }));
  assert.equal(r.status, 403);
  assert.match(r.error, /mens op naam/);
});

test('3. zonder vastgestelde assurance gaat er niets', () => {
  const { ketenlaag } = huis();
  for (const a of [null, { ok: false }, {}]) {
    const r = ketenlaag.klaarzet(OPGAVE({ assurance: a }));
    assert.equal(r.status, 401, 'assurance ' + JSON.stringify(a) + ' werd toegelaten');
  }
});

test('4. het mandaat wordt gevraagd en zegt nee -- en die as doet mee', () => {
  const { ketenlaag } = huis();
  const klaar = ketenlaag.klaarzet(OPGAVE());
  const as = klaar.dossier.assen.find(a => a.as === 'mandaat');
  assert.ok(as, 'de mandaat-as staat niet in het dossier');
  assert.equal(as.uitslag, 'niet zelfstandig');
  assert.equal(as.graad, 'gemeten');
  assert.ok(as.reden && as.reden.length > 20, 'de mandaat-as hoort een uitgeschreven reden te dragen');

  /* En de baan vertrouwt daar niet blind op: zegt het mandaat ooit JA op een
     geldhandeling, dan stopt de baan in plaats van door te lopen. */
  const raar = maakGeldketen({ voornemens: null, frictie: null, bak: () => [],
    mandaatBron: () => ({ mag: true, reden: 'zogenaamd toegestaan' }) });
  const r = raar.klaarzet(OPGAVE());
  assert.ok(r.status >= 400, 'een mandaat dat ja zegt op geld hoort de baan te stoppen');
});

test('5. vermoed en onbekend tellen niet als gehaald, en het dossier zegt wat er open staat', async () => {
  /* Zonder ondertekensleutel kan er geen bewijstoken worden gemunt. De baan gaat
     door -- het voornemen draait dan op zijn STAND -- maar de as `bewijsDraagt`
     is NIET gehaald, en dat hoort in het dossier te staan in plaats van te
     verdwijnen. */
  const { ketenlaag } = huis({ zonderSleutel: true });
  const klaar = ketenlaag.klaarzet(OPGAVE());
  assert.ok(klaar.ok, JSON.stringify(klaar));
  const as = klaar.dossier.assen.find(a => a.as === 'bewijsDraagt');
  assert.equal(as.graad, 'onbekend');
  assert.ok(klaar.dossier.open.includes('bewijsDraagt'),
    'bewijsDraagt hoort bij de open assen te staan: ' + klaar.dossier.open.join(', '));
  assert.equal(klaar.dossier.rond, false, 'een keten met een open as hoort niet rond te heten');
});

test('6. de twee klassen eisen verschillende assen, met de reden erbij', () => {
  assert.ok(KLASSEN['geld-eenmalig'].verplicht.includes('atomair'));
  assert.ok(!KLASSEN['geld-reeks'].verplicht.includes('atomair'),
    'alles-of-niets is bij een reeks de verkeerde garantie');
  assert.ok(KLASSEN['geld-reeks'].verplicht.includes('hervatbaar'));
  assert.match(KLASSEN['geld-reeks'].waaromNiet.atomair, /verkeerde garantie/i,
    'een as die NIET verplicht is, hoort een uitgeschreven reden te dragen');
  /* Geen klasse mag stiller worden dan de andere: elke as die de ene wel eist en
     de andere niet, staat in `waaromNiet`. */
  for (const [naam, k] of Object.entries(KLASSEN)) {
    const anderen = Object.entries(KLASSEN).filter(([n]) => n !== naam);
    for (const [, ander] of anderen)
      for (const as of ander.verplicht)
        if (!k.verplicht.includes(as))
          assert.ok(k.waaromNiet[as], 'klasse ' + naam + ' eist "' + as + '" niet en zegt niet waarom');
  }
});

test('7. uitvoeren kan niet vooruit op een voornemen dat een handtekening wacht', async () => {
  const { ketenlaag } = huis();
  /* 150.000 cent (1.500 euro) staat boven de tweede-handtekeninggrens van
     besluit.js, dus de keuring zet het voornemen op WACHT. */
  const klaar = ketenlaag.klaarzet(OPGAVE({ totaalCenten: 150000, sleutel: 'incasso:2',
    stappen: [{ wat: 'incassoronde', doel: 'tot 2', centen: 150000, gegevens: { tot: 2 } }] }));
  assert.ok(klaar.ok, JSON.stringify(klaar));
  assert.equal(klaar.voornemen.stand, 'WACHT', 'stand: ' + klaar.voornemen.stand);

  let geraakt = false;
  const r = await ketenlaag.uitvoer({ id: klaar.voornemen.id, door: 'bert',
    doe: async () => { geraakt = true; return { ok: true }; } });
  assert.equal(geraakt, false, 'er is geld bewogen zonder tweede handtekening');
  assert.ok(r.status >= 400, JSON.stringify(r));

  /* En met de handtekening van een ANDER gaat hij wel door. */
  const t = ketenlaag.tekenAf({ id: klaar.voornemen.id, door: 'bert' });
  assert.ok(t.ok, JSON.stringify(t));
  const r2 = await ketenlaag.uitvoer({ id: klaar.voornemen.id, door: 'bert',
    doe: async () => { geraakt = true; return { ok: true, uitgevoerd: 1 }; } });
  assert.ok(r2.ok, JSON.stringify(r2));
  assert.equal(geraakt, true);

  /* Dezelfde persoon tekent niet zijn eigen aanvraag af. */
  const eigen = ketenlaag.klaarzet(OPGAVE({ totaalCenten: 150000, sleutel: 'incasso:3',
    stappen: [{ wat: 'incassoronde', doel: 'tot 3', centen: 150000, gegevens: { tot: 3 } }] }));
  const zelf = ketenlaag.tekenAf({ id: eigen.voornemen.id, door: 'ans' });
  assert.ok(zelf.error, 'dezelfde persoon mocht zijn eigen voornemen aftekenen');
});

test('8. het journaal is een hashketen die zichzelf verifieert', async () => {
  const { ketenlaag, bak } = huis();
  const klaar = ketenlaag.klaarzet(OPGAVE());
  await ketenlaag.uitvoer({ id: klaar.voornemen.id, door: 'bert', doe: async () => ({ ok: true }) });
  const heel = ketenlaag.journaalVerifieer();
  assert.ok(heel.ok, 'de keten is niet heel: ' + JSON.stringify(heel));
  assert.ok(ketenlaag.journaalTop(), 'er is geen top van de keten');

  /* En hij merkt het als iemand een regel verbouwt -- anders is een hashketen
     een lijst met extra velden. */
  const j = bak('geldketenJournaal');
  assert.ok(j.length >= 2, 'er staan te weinig schakels om iets te bewijzen');
  j[j.length - 1] = Object.assign({}, j[j.length - 1], { wat: 'geldketen.verzonnen' });
  assert.equal(ketenlaag.journaalVerifieer().ok, false, 'een verbouwde regel bleef onopgemerkt');
});

test('9. de ketendeclaratie noemt bestaande routes en een bestaande klasse', () => {
  assert.ok(KETENS.length >= 1);
  for (const k of KETENS) {
    assert.ok(KLASSEN[k.klasse], 'keten ' + k.naam + ' hangt aan een onbekende klasse');
    assert.ok(k.routes.length >= 2, 'een keten over een enkele route is geen keten');
    for (const r of k.routes) assert.match(r, /^\/api\//);
  }
});
