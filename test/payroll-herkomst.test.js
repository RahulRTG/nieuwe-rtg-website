/* DE BEWIJSKETEN VAN DE LOONAANGIFTE.

   De btw-kant kreeg dit al (test/fiscaal-herkomst.test.js); dit is de tweede
   grote geldstroom. Vijf beweringen:

   1. VERKLAREN vouwt het collectieve bedrag open naar de nominatieve regels, en
      VERWIJST per medewerker naar het loondossier in plaats van dat detail nog
      een keer te verzamelen.
   2. HERBOUWEN uit de run komt op de cent uit -- met dezelfde routine waarmee
      de aangifte is opgemaakt, want een herbouw die anders optelt vindt altijd
      een verschil.
   3. EEN AANGIFTE DIE ZICHZELF TEGENSPREEKT wordt gemeld. De twee controles
      draaiden al bij het opmaken; hier draaien ze OPNIEUW, en dat is het punt:
      bij het opmaken bewijzen ze dat de aangifte goed begon, hier dat hij dat
      nog steeds is.
   4. HET REGELPAKKET STAAT NAAST HET BEDRAG: op welke versie de run draaide,
      of een mens die heeft aangemerkt, en wat het pakket over zichzelf zegt.
   5. EEN NIET-AANGEMERKT PAKKET IS EEN BEVINDING en geen stilte.

   Draai los: node --experimental-sqlite --test test/payroll-herkomst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakRun } = require('../server/kern/payroll/run');
const { maakJournaal } = require('../server/kern/payroll/journaal');
const { maakAangifte } = require('../server/kern/payroll/aangifte');
const { maakDossier } = require('../server/kern/payroll/dossier');
const { maakPayrollHerkomst } = require('../server/kern/payroll/herkomst');
const motor = require('../server/kern/payroll/motor');

const pakket = (versie, extra) => Object.assign({ land: 'NL', versie,
  geldigVan: '2026-01-01', geldigTot: '2026-12-31',
  regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } }, extra || {});

const persoon = (staffId, naam, uren) => ({ staffId, naam,
  contract: { uurloonCenten: 1800, soort: 'vast', urenPerWeek: 32 },
  invoer: [{ component: 'gewerkte_uren', aantal: uren }],
  leeftijdsgroep: '21+', gewerkteUren: uren });

function opzet(opties) {
  const o = opties || {};
  const db = { data: {} };
  /* Via de deur van het domein (server/kern/payroll/opslag.js) en niet met een
     kale db-stub: sinds PR #128 krijgt geen payroll-laag de database nog mee,
     alleen het contract. Voedde deze opstelling db, dan viel elke laag hier om
     op `opslag.bak` -- en dat is precies wat er gebeurde. */
  const opslag = require('../server/kern/payroll/opslag')({ db });
  const save = () => {};
  let teller = 0;
  const nu = () => '2026-04-01T10:0' + (teller++ % 10) + ':00.000Z';
  const regelpakket = maakRegelpakket({ opslag, save, nu });
  const componenten = maakComponenten({ opslag, save, nu });
  regelpakket.neemOp(pakket('nl-2026.1', o.pakketExtra), { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe', { ondanks: true, reden: 'toets' });
  const run = maakRun({ opslag, save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ opslag, save, nu, crypto });
  const aangifte = maakAangifte({ opslag, save, nu, crypto, run });
  const dossier = maakDossier({ run, journaal, aangifte, regelpakket, contracten: null });
  const { payrollHerkomst } = maakPayrollHerkomst({ aangifte, run, regelpakket, dossier });
  return { db, run, aangifte, herkomst: payrollHerkomst };
}

function aangifteVan(k) {
  const r = k.run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03',
    land: 'NL', regels: [persoon(1, 'Timo Vos', 160), persoon(2, 'Ilse Berg', 80)], door: 'A. Bakker' });
  k.run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  k.run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  k.run.maakDefinitief(r.run.id, 'A. Bakker');
  return k.aangifte.maak(k.run.haal(r.run.id), 'A. Bakker').aangifte;
}

test('verklaren vouwt het collectieve bedrag open en verwijst naar het dossier', () => {
  const k = opzet();
  const a = aangifteVan(k);
  const v = k.herkomst.verklaar(a.id);

  assert.equal(v.periode, '2026-03');
  assert.equal(v.teBetalenCenten, a.teBetalenCenten);
  assert.equal(v.medewerkers.length, 2, 'twee nominatieve regels');
  assert.equal(v.medewerkers[0].naam, 'Timo Vos');
  assert.ok(v.medewerkers[0].ingehoudenLoonheffing > 0);

  /* De verwijzing, niet het detail: de rekenstappen horen in het dossier en
     niet nog een keer hier. */
  assert.deepEqual(v.medewerkers[0].dossier, { runId: a.runId, staffId: 1 });
  assert.ok(!v.medewerkers[0].stappen, 'geen tweede kopie van de rekenstappen');
  assert.match(v.let, /loondossier/i);

  // en de optelling van de regels IS het collectieve bedrag
  const som = v.medewerkers.reduce((s, m) => s + m.ingehoudenLoonheffing, 0);
  assert.equal(som, v.collectief.ingehoudenLoonheffing);
  assert.equal(v.sluitAan, true);
  assert.deepEqual(v.bevindingen, []);
  assert.equal(v.zekerheid.klasse, 'bepaald');
  assert.equal(v.zekerheid.term, 'DETERMINISTIC');
});

test('herbouwen uit de run komt op de cent uit', () => {
  const k = opzet();
  const a = aangifteVan(k);
  const h = k.herkomst.herbouw(a.id);

  assert.equal(h.gelijk, true);
  assert.equal(h.verschilCenten, 0);
  assert.deepEqual(h.verschillen, []);
  assert.equal(h.herbouwd.teBetalenCenten, a.teBetalenCenten);
  assert.deepEqual(h.herbouwd.totalen, a.totalen, 'rubriek voor rubriek gelijk');
  assert.match(h.uitslag, /op de cent gelijk/i);
  assert.equal(k.herkomst.herbouw('bestaatniet').status, 404);
});

test('een aangifte die zichzelf tegenspreekt wordt gemeld', () => {
  const k = opzet();
  const a = aangifteVan(k);

  /* De aangifte in de opslag verdraaien -- precies wat er NIET hoort te
     gebeuren, en waar deze keten voor bestaat. Bij het opmaken klopte hij; de
     vraag is of dat later nog wordt nagegaan. */
  a.totalen.ingehoudenLoonheffing += 100;

  const v = k.herkomst.verklaar(a.id);
  assert.equal(v.sluitAan, false);
  const nom = v.bevindingen.find(b => b.soort === 'nominatief-wijkt-af');
  assert.ok(nom, 'het nominatieve deel telt niet meer op tot het collectieve');
  assert.equal(nom.rubriek, 'ingehoudenLoonheffing');
  assert.equal(nom.collectief - nom.nominatief, 100);
  assert.ok(v.bevindingen.some(b => b.soort === 'stroken-wijken-af'),
    'en het wijkt ook af van wat er op de stroken staat');

  /* En de herbouw legt het verschil op tafel. Let op WAAR het opduikt: er is
     alleen aan een rubriek gedraaid en niet aan het totaal, dus het te betalen
     bedrag klopt nog. De twee controles zijn dus onafhankelijk, en de
     rubriekcontrole vangt precies wat de totaalcontrole mist. */
  const h = k.herkomst.herbouw(a.id);
  assert.equal(h.gelijk, false);
  assert.ok(h.verschillen.some(x => x.rubriek === 'ingehoudenLoonheffing'));
  assert.equal(h.verschilCenten, 0, 'het TOTAAL is niet aangeraakt, dus dat verschil is nul');
  assert.match(h.uitslag, /NIET gelijk/);

  // draai ook aan het totaal, dan slaat de andere controle uit
  a.teBetalenCenten += 250;
  const h2 = k.herkomst.herbouw(a.id);
  assert.equal(h2.gelijk, false);
  assert.equal(h2.verschilCenten, -250, 'de herbouw telt 250 cent minder dan er staat');
});

test('het regelpakket staat naast het bedrag', () => {
  const k = opzet();
  const v = k.herkomst.verklaar(aangifteVan(k).id);
  assert.equal(v.regelpakket.versie, 'nl-2026.1');
  assert.equal(v.regelpakket.gevonden, true);
  assert.equal(v.regelpakket.stand, 'goedgekeurd');
  assert.equal(v.regelpakket.goedgekeurdDoor, 'R. Sardjoe');
});

test('een niet-aangemerkt regelpakket is een bevinding en geen stilte', () => {
  /* Een DEFINITIEVE run mag niet op een ongecontroleerd pakket draaien, dus
     zo'n aangifte ontstaat nooit rechtstreeks. Waar het wel op aankomt is de
     stand ACHTERAF: een pakket dat later van zijn aanmerking valt, of dat
     alsnog iets over zichzelf meldt. De aangifte blijft dan gewoon staan -- en
     dan hoort dat naast het bedrag te komen in plaats van te verdwijnen. */
  const k = opzet();
  const a = aangifteVan(k);
  const pk = k.db.data.payrollRegels.NL[0];
  pk.stand = 'ongecontroleerd';
  pk.waarschuwing = 'Deze cijfers zijn niet tegen het Handboek gelegd.';

  const v = k.herkomst.verklaar(a.id);
  assert.equal(v.sluitAan, false);
  assert.ok(v.bevindingen.some(b => b.soort === 'pakket-ongecontroleerd'));
  const w = v.bevindingen.find(b => b.soort === 'pakket-waarschuwt');
  assert.ok(w, 'en wat het pakket over zichzelf zegt, reist mee');
  assert.match(w.tekst, /Handboek/);
  assert.equal(v.regelpakket.stand, 'ongecontroleerd');
  /* De cijfers zelf zijn niet veranderd: een pakket dat van zijn stand valt
     maakt de aangifte niet fout, het maakt hem twijfelachtig. Dat verschil moet
     zichtbaar blijven. */
  assert.equal(k.herkomst.herbouw(a.id).gelijk, true);
});

/* ------------------------------------------------------- door de API heen ---
   De poort doet er hier meer toe dan bij het dossier: een verklaring legt de
   ingehouden loonheffing PER WERKNEMER open. Dat is kantoorwerk, en de zaak
   heeft er zijn eigen, smallere ingang voor (/api/supplier/payroll/aangiftes).
   Een tweede, ruimere ingang op dezelfde gegevens zou een tweede sleutel op
   dezelfde deur zijn. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const CODE = 'KANTOOR-LOONHERKOMST-1';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loonherkomst-'));
let srv, base, office, zaak;

const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  office = (await post('/api/office/login', { code: CODE })).body.token;
  zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de bewijsketen van de loonaangifte zit achter de kantoorpoort', async () => {
  assert.ok(office, 'het kantoor logt in');

  /* Een aangifte-id dat niet bestaat geeft 404 en niet 500: de route moet ook
     zonder geldige aangifte een nette weigering geven. */
  const leeg = await post('/api/office/payroll/verklaar', { id: 'aan_bestaatniet' }, office);
  assert.equal(leeg.status, 404, 'onbekende aangifte -> 404');
  const leeg2 = await post('/api/office/payroll/herbouw', { id: 'aan_bestaatniet' }, office);
  assert.equal(leeg2.status, 404);

  for (const pad of ['/api/office/payroll/verklaar', '/api/office/payroll/herbouw']) {
    assert.equal((await post(pad, { id: 'x' })).status, 401, pad + ' zonder token');
    assert.equal((await post(pad, { id: 'x' }, 'nep-token')).status, 401, pad + ' met een verzonnen token');
    /* En niet met het token van de ZAAK: die leest zijn aangifte via zijn eigen
       route en krijgt hier de loonheffing per werknemer niet los. */
    if (zaak) assert.ok([401, 403].includes((await post(pad, { id: 'x' }, zaak)).status),
      pad + ' met een zaaktoken');
  }
});
