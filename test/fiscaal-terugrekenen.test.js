/* DE REKENPLEKKEN OP DE REGELS VAN TOEN.

   De jaargangen (test/fiscaal-jaargangen.test.js) maakten terugrekenen
   MOGELIJK. Deze toets gaat over de plekken die het moeten DOEN: de
   maandboekhouding, het Z-rapport en de zzp-tool herrekenden alle drie uit de
   lopende tabel, en herschreven daarmee stilletjes een afgesloten dag of maand
   zodra de Regelwacht iets bijwerkte.

   Vijf beweringen:

   1. EEN TARIEFWIJZIGING MIDDEN IN DE MAAND SPLITST DE BOEKHOUDING. De omzet
      van voor en na de ingangsdatum hoort niet op een hoop: dan draagt een van
      beide helften het verkeerde percentage af.
   2. EEN Z-RAPPORT VAN EEN AFGESLOTEN DAG BEWEEGT NIET MEE met een latere
      wijziging.
   3. HET Z-RAPPORT GEBRUIKT DEZELFDE CATEGORIE ALS DE FACTUUR. Het had een
      eigen kopie van die logica -- de derde -- met de bug die kern/fiscaal/
      tarief.js kwam opheffen: een kledingwinkel kreeg het lage tarief.
   4. ELKE UITKOMST DRAAGT EEN STEMPEL: op welke dag is teruggerekend, uit
      welke bron, en welke wijzigingen golden er toen.
   5. DE ZZP-TOOL LIEGT NIET OVER EEN ANDER JAAR. Zijn tabellen zijn NIET per
      jaargang vastgelegd, dus een jaar buiten het peiljaar levert een
      uitdrukkelijke waarschuwing en geen stil antwoord.

   Draai los: node --experimental-sqlite --test test/fiscaal-terugrekenen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { LANDEN, FISCAAL_PEILJAAR, maakFiscaal, zzpBerekening } = require('../server/kern/fiscaal');
const { maakJaargangen } = require('../server/kern/fiscaal/jaargangen');
const { rondEuro } = require('../server/kern/util');
const { btwSplit } = require('../server/kern/afgeleid');

const MAAND = new Date().toISOString().slice(0, 7);

function stubDb(extra) {
  const db = { data: Object.assign({
    supplierTypes: { horeca: { caps: ['menu'] }, mode: { caps: [] } },
    orders: [], posSales: {}, rides: [], boekingen: [], giftcards: [], klok: {}
  }, extra || {}) };
  return require('../server/kern/werkvormen').haakAan(db);
}

/* De jaargangen op de ECHTE landentabel, maar zonder te projecteren: neemOp
   raakt LANDEN niet aan, dus andere toetsen in dit proces merken hier niets
   van en de basis blijft het peiljaar. */
function metJaargang(db, wijzigingen, geldigVanaf) {
  const { jaargangen } = maakJaargangen({ db, save: () => {}, LANDEN, peiljaar: FISCAAL_PEILJAAR });
  if (wijzigingen) jaargangen.neemOp({ land: 'NL', wijzigingen, geldigVanaf, bron: { soort: 'kantoor' }, versie: 't1' });
  return jaargangen;
}

test('een tariefwijziging midden in de maand splitst de maandboekhouding', () => {
  const s = { code: 'KIKUNOI', type: 'horeca',
    menu: [{ name: 'Sushi', station: 'keuken' }],
    settings: { land: 'NL', uurloon: 20 } };
  const db = stubDb({ orders: [
    { supplierCode: 'KIKUNOI', paid: true, at: MAAND + '-05', items: [{ name: 'Sushi', price: 109, qty: 1 }] },
    { supplierCode: 'KIKUNOI', paid: true, at: MAAND + '-15', items: [{ name: 'Sushi', price: 110, qty: 1 }] }
  ] });
  // het eten-tarief gaat op de tiende van 9% naar 10%
  const jaargangen = metJaargang(db, { tarieven: { eten: 10 } }, MAAND + '-10');
  const { financeVoor } = maakFiscaal({ db, rondEuro, btwSplit, jaargangen });
  const fin = financeVoor(s);

  const eten = fin.btw.filter(r => r.cat === 'eten').sort((a, b) => a.tarief - b.tarief);
  assert.equal(eten.length, 2, 'twee potten: voor en na de ingangsdatum');
  assert.equal(eten[0].tarief, 9);
  assert.deepEqual([eten[0].omzet, eten[0].grondslag, eten[0].btw], [109, 100, 9], 'de vijfde tegen 9%');
  assert.equal(eten[1].tarief, 10);
  assert.deepEqual([eten[1].omzet, eten[1].grondslag, eten[1].btw], [110, 100, 10], 'de vijftiende tegen 10%');
  assert.equal(fin.btwTotaal, 19);

  // zonder jaargangen valt hij terug op de lopende tabel: een pot, alles 9%
  const zonder = maakFiscaal({ db, rondEuro, btwSplit }).financeVoor(s);
  assert.equal(zonder.btw.filter(r => r.cat === 'eten').length, 1, 'terugval: een tarief voor de hele maand');
  assert.equal(zonder.regelstand.bron, 'lopend');
});

test('een Z-rapport van een afgesloten dag beweegt niet mee met een latere wijziging', () => {
  const s = { code: 'KIKUNOI', type: 'horeca',
    menu: [{ name: 'Sushi', station: 'keuken' }], settings: { land: 'NL' } };
  const db = stubDb({ posSales: { KIKUNOI: [
    { at: MAAND + '-05T20:00:00.000Z', method: 'pin', total: 109, items: [{ name: 'Sushi', price: 109, qty: 1 }] },
    { at: MAAND + '-15T20:00:00.000Z', method: 'pin', total: 110, items: [{ name: 'Sushi', price: 110, qty: 1 }] }
  ] } });
  const jaargangen = metJaargang(db, { tarieven: { eten: 10 } }, MAAND + '-10');
  const { dagrapport } = maakFiscaal({ db, rondEuro, btwSplit, jaargangen });

  const voor = dagrapport(s, MAAND + '-05');
  assert.equal(voor.btw[0].tarief, 9, 'de vijfde houdt het oude tarief');
  assert.equal(voor.btw[0].btw, 9);

  const na = dagrapport(s, MAAND + '-15');
  assert.equal(na.btw[0].tarief, 10, 'de vijftiende het nieuwe');
  assert.equal(na.btw[0].btw, 10);
});

test('het Z-rapport gebruikt dezelfde categorie als de factuur en de boekhouding', () => {
  /* Een kledingwinkel: geen kaart, geen kamers, geen ritten. De oude eigen
     kopie in rapporten.js zette die op 'eten' (9%); kern/fiscaal/tarief.js zegt
     'standaard' (21%), en dat is wat er op de factuur van de klant staat. */
  const winkel = { code: 'MODE', type: 'mode', menu: [], settings: { land: 'NL' } };
  const db = stubDb({ posSales: { MODE: [
    { at: MAAND + '-05T12:00:00.000Z', method: 'pin', total: 121, items: [{ name: 'Jas', price: 121, qty: 1 }] }
  ] } });
  const { dagrapport, financeVoor } = maakFiscaal({ db, rondEuro, btwSplit });

  const z = dagrapport(winkel, MAAND + '-05');
  assert.equal(z.btw[0].cat, 'standaard', 'een jas is geen eten');
  assert.equal(z.btw[0].tarief, 21);
  assert.deepEqual([z.btw[0].grondslag, z.btw[0].btw], [100, 21]);

  // en de maandboekhouding zegt over dezelfde verkoop hetzelfde
  const fin = financeVoor(winkel);
  assert.equal(fin.btw[0].cat, 'standaard');
  assert.equal(fin.btw[0].tarief, 21, 'Z-rapport en maandboekhouding zijn het eens');
});

test('elke uitkomst draagt een stempel van de regels die eronder liggen', () => {
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL', uurloon: 20 } };
  const db = stubDb({});
  const jaargangen = metJaargang(db, { uurloonMin: 15.5 }, MAAND + '-01');
  const { financeVoor, dagrapport } = maakFiscaal({ db, rondEuro, btwSplit, jaargangen });

  const fin = financeVoor(s);
  assert.equal(fin.regelstand.bron, 'jaargangen');
  assert.equal(fin.regelstand.jaargangen.length, 1, 'de toegepaste wijziging staat erbij');
  assert.match(fin.regelstand.op, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fin.personeel.uurloonMin, 15.5, 'en de personeelsregels komen van die dag');

  // een dag VOOR de ingangsdatum kent hem nog niet
  const z = dagrapport(s, MAAND + '-01');
  assert.equal(z.regelstand.jaargangen.length, 1);
  const vorigeMaand = new Date(Date.UTC(Number(MAAND.slice(0, 4)), Number(MAAND.slice(5, 7)) - 2, 15)).toISOString().slice(0, 10);
  assert.equal(dagrapport(s, vorigeMaand).regelstand.jaargangen.length, 0, 'ervoor gold hij nog niet');
});

test('de zzp-tool liegt niet over een jaar waarvan hij de tabellen niet heeft', () => {
  const nu = zzpBerekening('NL', 60000, { urencriterium: true });
  assert.equal(nu.jaar, FISCAAL_PEILJAAR);
  assert.ok(!nu.buitenPeiljaar);

  const oud = zzpBerekening('NL', 60000, { urencriterium: true, jaar: FISCAAL_PEILJAAR - 2 });
  assert.equal(oud.buitenPeiljaar, true, 'een ander jaar wordt gemeld');
  assert.match(oud.regels[0], /niet met die van/i);
  assert.match(oud.regels[0], /niet de regels die toen golden/i);
  /* De som zelf blijft gelijk, en dat is de reden dat de waarschuwing er MOET
     staan: zonder die zin ziet dit eruit als het antwoord voor dat jaar. */
  assert.equal(oud.belasting, nu.belasting);
});
