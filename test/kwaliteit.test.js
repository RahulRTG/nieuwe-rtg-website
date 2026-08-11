/* De gegevenskwaliteit (kern/command/kwaliteit.js) en de kennisgraaf
   (kern/command/graaf.js). Beide draaien op dezelfde meting: welk veld blijkt
   in de praktijk naar welke soort te verwijzen. Daar komen hier de wezen uit en
   daar komen bij de graaf de randen uit.

   WAT DEZE TOETS VOORAL BEWAAKT is dat de meting MEET en niet raadt. Een
   verwijzing die uit een tabel komt, zegt na de eerste uitbreiding iets anders
   dan de gegevens; een verwijzing die gemeten is, kan alleen fout zijn als de
   gegevens dat ook zijn. Daarom staat hier een geval waarin het veld GEEN
   verwijzing is (te weinig raak) en er dus ook geen wezen gemeld mogen worden:
   liever een wees missen dan een half platform als kapot melden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de drempel REF_DREMPEL van 0.8 naar 0 gezet (elk veld is een verwijzing)
     -> "een veld dat maar half raak is, is geen verwijzing" ZAKT (RAAK)
   - de dubbele-sleutelcontrole eruit (gezien-map niet meer geteld)
     -> "een dubbele sleutel is een defect en geen vermoeden" ZAKT (RAAK)
   - in graaf.js de richting 'van' weggelaten (alleen vooruit wandelen)
     -> "de graaf loopt beide kanten op" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakRegister } = require('../server/kern/command/register');
const { maakKwaliteit } = require('../server/kern/command/kwaliteit');
const { maakGraaf } = require('../server/kern/command/graaf');

/* Een kleine wereld met opzet-fouten erin: één dubbele sleutel, één rij zonder
   sleutel, één verwijzing die nergens aankomt. De codes zijn bewust langer dan
   één teken -- de meter slaat te korte waarden over, want die lijken toevallig
   op van alles. */
function maak(extra) {
  const db = { data: Object.assign({
    suppliers: [{ code: 'HOSHI', name: 'Aguamarina' }, { code: 'KIKUNOI', name: 'Kikunoi' }],
    orders: [
      { ref: 'O1', supplierCode: 'HOSHI', status: 'klaar' },
      { ref: 'O2', supplierCode: 'HOSHI', status: 'klaar' },
      { ref: 'O3', supplierCode: 'HOSHI', status: 'klaar' },
      { ref: 'O4', supplierCode: 'KIKUNOI', status: 'klaar' },
      { ref: 'O5', supplierCode: 'WEGGEVALLEN', status: 'klaar' },
      { ref: 'O6', supplierCode: 'KIKUNOI', status: 'klaar' },
      { ref: 'O6', supplierCode: 'KIKUNOI', status: 'klaar' },
      { ref: '', supplierCode: 'KIKUNOI', status: 'klaar' }
    ]
  }, extra || {}) };
  const register = maakRegister([
    { type: 'zaak', label: 'Zaak', meervoud: 'zaken', domein: 'handel',
      collectie: 'suppliers', sleutel: 'code', zoek: ['code'], titel: r => r.name },
    { type: 'bestelling', label: 'Bestelling', meervoud: 'bestellingen', domein: 'handel',
      collectie: 'orders', sleutel: 'ref', zoek: ['ref'], titel: r => 'Bestelling ' + r.ref }
  ].concat(extra && extra.__soorten ? extra.__soorten : []));
  const kwaliteit = maakKwaliteit({ db, register });
  return { db, register, kwaliteit, graaf: maakGraaf({ db, register, kwaliteit }) };
}

test('een dubbele sleutel is een defect en geen vermoeden', () => {
  const { kwaliteit } = maak();
  const u = kwaliteit.meet();
  const dubbel = u.bevindingen.find(b => b.wat === 'dubbele sleutel');
  assert.ok(dubbel, 'de dubbele O6 wordt gevonden: ' + u.bevindingen.map(b => b.wat).join(','));
  assert.equal(dubbel.zeker, true, 'en hij staat als zeker, niet als vermoeden');
  assert.ok(dubbel.voorbeelden.some(v => v.startsWith('O6')), 'met het voorbeeld erbij: ' + dubbel.voorbeelden);
  assert.ok(u.bevindingen.some(b => b.wat === 'sleutel ontbreekt'), 'en de rij zonder ref ook');
});

test('een verwijzing die nergens aankomt heet een wees', () => {
  const { kwaliteit } = maak();
  const wees = kwaliteit.meet().bevindingen.find(b => b.wat === 'verwijzing zonder doel');
  assert.ok(wees, 'de bestelling naar WEGGEVALLEN wordt gevonden');
  assert.equal(wees.veld, 'supplierCode');
  assert.equal(wees.wijstNaar, 'zaak');
  assert.match(wees.uitleg, /\d+% van de gevallen/, 'en hij zegt hoe zeker die verwijzing is: ' + wees.uitleg);
});

test('een veld dat maar half raak is, is geen verwijzing', () => {
  /* DE KERN VAN DE METING. Zonder drempel zou elk veld dat toevallig een keer
     op een sleutel lijkt een verwijzing heten, en dan meldt de meter honderden
     wezen die geen wezen zijn. Liever een wees missen dan een half platform als
     kapot melden -- dus hier een veld dat de helft van de tijd raak is. */
  const { kwaliteit } = maak({
    rides: [
      { ref: 'R1', wie: 'HOSHI' }, { ref: 'R2', wie: 'KIKUNOI' },
      { ref: 'R3', wie: 'iemand-anders' }, { ref: 'R4', wie: 'nog-iemand' },
      { ref: 'R5', wie: 'weer-iemand' }, { ref: 'R6', wie: 'en-nog-een' }
    ],
    __soorten: [{ type: 'rit', label: 'Rit', meervoud: 'ritten', domein: 'mob',
      collectie: 'rides', sleutel: 'ref', zoek: ['ref'], titel: r => 'Rit ' + r.ref }]
  });
  const wezen = kwaliteit.meet().bevindingen.filter(b => b.soort === 'rit' && b.wat === 'verwijzing zonder doel');
  assert.equal(wezen.length, 0, 'twee van de zes raak is geen verwijzing, dus geen wezen');
});

test('de graaf meet zijn randen uit dezelfde gegevens', () => {
  const { graaf } = maak();
  const v = graaf.vorm();
  const rand = v.randen.find(r => r.van === 'bestelling' && r.naar === 'zaak');
  assert.ok(rand, 'bestelling -> zaak is gemeten: ' + JSON.stringify(v.randen));
  assert.equal(rand.veld, 'supplierCode');
  assert.ok(rand.deel >= 0.8 && rand.deel < 1, 'met het aandeel erbij (' + rand.deel + ')');
  assert.match(v.uitleg, /niet uit een schema/, 'en het antwoord zegt dat het gemeten is');
});

test('de graaf loopt beide kanten op', () => {
  const { graaf } = maak();
  const w = graaf.wandel('zaak', 'HOSHI', 2);
  assert.equal(w.start.id, 'HOSHI');
  const stap1 = w.lagen[1];
  assert.ok(stap1 && stap1.aantal >= 3, 'vanaf de zaak vind je de bestellingen die naar hem wijzen');
  assert.ok(stap1.objecten.every(o => o.type === 'bestelling'));

  /* En andersom: vanaf een bestelling moet de zaak te vinden zijn. Dat is de
     andere richting van dezelfde rand, en precies wat een graaf onderscheidt
     van een lijst met verwijzingen. */
  const terug = graaf.wandel('bestelling', 'O1', 1);
  assert.ok(terug.lagen[1].objecten.some(o => o.type === 'zaak' && o.id === 'HOSHI'),
    'vanaf O1 kom je bij HOSHI uit: ' + JSON.stringify(terug.lagen[1].objecten));
});

test('de graaf zegt het als hij tegen zijn grens loopt', () => {
  const { graaf } = maak();
  const w = graaf.wandel('zaak', 'HOSHI', 2);
  assert.equal(w.afgekapt, false, 'deze kleine wereld past ruim');
  assert.equal(w.grens, null);
  assert.equal(graaf.wandel('zaak', 'BESTAATNIET', 1).status, 404);
  assert.equal(graaf.wandel('onzin', 'X', 1).status, 404);
});
