/* De identiteit van een medewerker: ja/nee voor de werkgever, en opvragen in
   twee zwaartes.

   DE AFSPRAAK die hier wordt bewaakt: een werkgever ziet standaard alleen of de
   identiteit is vastgesteld -- geen documentnummer, geen scan, geen
   geboortedatum. Opvragen kan wel, want de loonadministratie vraagt erom, maar
   nooit stil: met een reden die iets zegt, in het inzagejournaal, en met bericht
   aan de medewerker.

   De toetsen gaan daarom vooral over wat NIET mag:
   - de standaardweergave lekt niets;
   - geen reden, of een reden van niks, is geen inzage;
   - een kopie is niet voor iedereen;
   - niet over iemand die er niet werkt;
   - en de medewerker hoort het, elke keer.

   Draai los: node --test test/identiteit-opvraag.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakIdentiteit } = require('../server/kern/payroll/identiteit');
const maakOpslag = require('../server/kern/payroll/opslag');
/* HET ECHTE INZAGEJOURNAAL en niet een dubbel. Hier stond `{ noteer: (r) =>
   journaal.push(r) }`, en dat slikte elk object -- ook een met sleutels die het
   echte inzagelog niet leest. Dat is precies wat er gebeurde: de aanroep zette
   `accountId` in plaats van `over`, dus voorBetrokkene() (dat op overId filtert)
   vond niets en een medewerker zag zijn eigen werkgever niet staan. Een dubbel
   dat ruimer is dan het echte ding meet niets (LAT-regel 9). */
const inzagelog = require('../server/inzagelog');

function opzet(over) {
  const db = { data: {} };
  const berichten = [];
  const journaal = [];
  const users = { 7: { id: 7, verified: 'verified' }, 8: { id: 8, verified: 'none' } };
  const state = { 7: { geboren: '1996-04-12', geverifieerdOp: '2026-03-02',
    paspoort: { soort: 'paspoort', nummer: 'NL9938214821', vervaldatum: '2031-04-12', nationaliteit: 'NL' } } };
  const accounts = {
    getUserById: (id) => users[id] || null,
    getMemberState: (id) => state[id] || null
  };
  inzagelog.zet(db, () => {});
  const ident = maakIdentiteit(Object.assign({
    accounts, opslag: maakOpslag({ db }), save: () => {}, nu: () => '2026-08-06T12:00:00.000Z',
    inzagelog,
    notify: (key, m) => berichten.push({ key, m }),
    logActivity: () => {}
  }, over || {}));
  /* `journaal` is nu wat er ECHT in de database staat, niet wat er is
     doorgegeven. Het verschil daartussen was de bug. */
  return { ident, db, berichten, journaal, regels: () => (db.data.inzageLog || []) };
}

const sam = { id: 1, name: 'Sam', supplier_code: 'ESVEDRA', member_id: 7 };
const nieuw = { id: 2, name: 'Robin', supplier_code: 'ESVEDRA', member_id: 8 };
const elders = { id: 3, name: 'Kim', supplier_code: 'KIKUNOI', member_id: 7 };

const vraag = (ident, over) => ident.opvraag(Object.assign({
  supplierCode: 'ESVEDRA', supplierNaam: 'Es Vedra Tours', staff: sam,
  niveau: 'gegevens', reden: 'loonadministratie juni, identificatieplicht',
  door: 'M. de Wit', doorRol: 'manager'
}, over || {}));

test('de standaardweergave zegt ja of nee, en verder niets', () => {
  const { ident } = opzet();
  const rij = ident.standen([sam, nieuw]);
  assert.deepEqual(rij, [
    { staffId: 1, naam: 'Sam', geverifieerd: true, stand: 'verified' },
    { staffId: 2, naam: 'Robin', geverifieerd: false, stand: 'none' }
  ], 'geen nummer, geen datum, geen nationaliteit: ' + JSON.stringify(rij));
});

test('zonder een reden die iets zegt is er geen inzage', () => {
  const { ident, journaal } = opzet();
  for (const reden of ['', '   ', 'ok', 'j', '.........']) {
    const r = vraag(ident, { reden });
    assert.equal(r.status, 400, 'reden ' + JSON.stringify(reden) + ' hoort te worden geweigerd');
  }
  assert.equal(journaal.length, 0, 'en er komt niets in het journaal');
});

test('gegevens opvragen levert het nodige, niet het document', () => {
  const { ident, journaal, berichten } = opzet();
  const r = vraag(ident);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  assert.equal(r.gegevens.laatsteVier, '4821', 'de laatste vier, niet het hele nummer');
  assert.equal(r.gegevens.geldigTot, '2031-04-12');
  assert.equal(r.gegevens.nationaliteit, 'NL');
  assert.equal(r.kopie, undefined, 'en geen scan');
  assert.ok(!JSON.stringify(r).includes('NL9938214821'), 'het volledige documentnummer gaat niet mee');

  const regels = inzagelog.lijst({ max: 50 });
  assert.equal(regels.length, 1, 'het staat in het inzagejournaal');
  assert.equal(regels[0].overId, '7', 'OVER wie het gaat, want daar filtert voorBetrokkene() op');
  assert.ok(/identiteit:gegevens/.test(regels[0].bron), 'met de bron erbij: ' + regels[0].bron);
  assert.ok(regels[0].door && regels[0].door !== 'onbekend', 'en WIE er keek: ' + regels[0].door);
  assert.ok(regels[0].waarom.length >= 10, 'met de reden erbij');
  assert.ok(!JSON.stringify(regels[0]).includes('Sam'), 'maar zonder de naam van de medewerker: dat zou een tweede kluis zijn');

  /* DE BEWERING WAAR HET OM DRAAIT: de medewerker kan het zelf terugvinden.
     Dat is de hele reden dat het journaal bestaat, en juist dat werkte niet. */
  const zijnEigen = inzagelog.voorBetrokkene(7);
  assert.equal(zijnEigen.length, 1, 'de medewerker ziet deze inzage in zijn eigen dossier');
  assert.ok(/loonadministratie/.test(zijnEigen[0].waarom), 'met de reden die de werkgever opgaf');

  assert.equal(berichten.length, 1, 'en de medewerker krijgt bericht');
  assert.equal(berichten[0].key, 'user-7');
  assert.ok(/Reden: loonadministratie/.test(berichten[0].m.body), 'met de reden erin: ' + berichten[0].m.body);
});

test('een kopie is zwaarder: alleen een manager, en het wordt gezegd', () => {
  const { ident, berichten } = opzet();
  const nee = vraag(ident, { niveau: 'kopie', doorRol: 'staff', door: 'Iemand' });
  assert.equal(nee.status, 403, 'een gewone medewerker vraagt geen kopie op');

  const ja = vraag(ident, { niveau: 'kopie' });
  assert.ok(ja.ok);
  assert.ok(ja.kopie && ja.kopie.beschikbaar);
  assert.ok(/kluis/.test(ja.let || ''), 'met de waarschuwing dat de scan de kluis verlaat');
  assert.ok(/[Kk]opie/.test(berichten[berichten.length - 1].m.title), 'en de medewerker hoort dat het een kopie was');
});

test('niet over iemand die hier niet werkt, en niet over wie nog niet gecontroleerd is', () => {
  const { ident, journaal } = opzet();
  assert.equal(vraag(ident, { staff: elders }).status, 404, 'een andere zaak: nee');
  assert.equal(vraag(ident, { staff: nieuw }).status, 409, 'nog niets vastgesteld: er is niets op te vragen');
  assert.equal(journaal.length, 0, 'en geen van beide komt in het journaal terecht');
});

test('de medewerker kan zelf zien wie wat opvroeg', () => {
  const { ident } = opzet();
  vraag(ident);
  vraag(ident, { niveau: 'kopie', reden: 'controle identificatieplicht 2026' });
  const mijn = ident.mijnVerzoeken(7);
  assert.equal(mijn.length, 2);
  assert.deepEqual(mijn.map(v => v.niveau).sort(), ['gegevens', 'kopie']);
  assert.ok(mijn.every(v => v.reden && v.door), 'met reden en aanvrager erbij');
});
