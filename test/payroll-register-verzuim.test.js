/* Drie lagen die WEL bestonden en door NIEMAND werden aangeroepen.

   Ik heb de payrolllaag nagelopen op publieke functies die nergens vandaan
   worden gebruikt. Er kwamen er drie uit, en alle drie waren het een belofte
   die nergens werkte:

   1. `componenten.alle/zet` -- het looncomponentenregister. De hele belofte van
      die module is dat een looncomponent een REGEL is en geen veld: een
      horecabedrijf voegt fooien toe, een vervoerder wachttijd, een school een
      eindejaarsuitkering. Maar er was geen route en geen scherm, dus de elf uit
      de basisset waren alles wat er ooit zou zijn.
   2. `journaal.sluitAan` -- de controle die het loonjournaal en het
      betaalbestand tegen elkaar legt. Uit de opzet: "betaalbestand wijkt af van
      de definitieve loonrun". Hij stond klaar als losse functie en werd nooit
      aangeroepen. Een controle die je kunt overslaan is geen controle; hij zit
      nu IN het maken van het bestand, voordat er iets wordt bewaard.
   3. `verzuim.voorPlanning` -- wat een leidinggevende mag zien: DAT iemand er
      niet is en WAT hij nog kan, zonder te weten wat hij heeft. Nergens
      aangeroepen, en de inzetbaarheid kon door niemand worden gezet, dus stond
      hij eeuwig op "niets".

   Draai los: node --experimental-sqlite --test test/payroll-register-verzuim.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');
const { maakJournaal, TEGENREKENINGEN } = require('../server/kern/payroll/journaal');
const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakRun } = require('../server/kern/payroll/run');
const motor = require('../server/kern/payroll/motor');

function klok() { let t = 0; return () => '2026-04-01T10:0' + (t++ % 10) + ':00.000Z'; }

/* ============ 1. het componentenregister ============ */

test('een sector voegt zijn eigen component toe, zonder dat er code verandert', () => {
  const db = { data: {} };
  const comp = maakComponenten({ db, save: () => {}, nu: klok() });
  const voor = comp.alle().length;

  const r = comp.zet({ sleutel: 'wachttijd', naam: 'Wachttijd', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: false, vakantiegeldgevend: true,
    invoerbron: 'klok', goedkeuring: 'manager', grootboek: '4040' }, 'A. Bakker');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.nieuw, true);
  assert.equal(comp.alle().length, voor + 1);
  assert.equal(comp.een('wachttijd').naam, 'Wachttijd');
  assert.equal(comp.een('wachttijd').door, 'A. Bakker', 'met de naam van wie hem neerzette');
});

test('de keuring houdt een component tegen die de motor zou laten gokken', () => {
  const db = { data: {} };
  const comp = maakComponenten({ db, save: () => {}, nu: klok() });

  const geenGrondslag = comp.zet({ sleutel: 'bonus', naam: 'Bonus', soort: 'bruto', belast: true,
    grondslagen: [], invoerbron: 'handmatig', goedkeuring: 'manager' }, 'A. Bakker');
  assert.equal(geenGrondslag.status, 422);
  assert.ok(geenGrondslag.bezwaren.some(b => /WELKE grondslagen/.test(b)),
    'belast zonder grondslagen: dan moet de motor gokken. ' + geenGrondslag.bezwaren.join(' '));

  const tegenspraak = comp.zet({ sleutel: 'reis', naam: 'Reiskosten', soort: 'netto', belast: false,
    grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager' }, 'A. Bakker');
  assert.ok(tegenspraak.bezwaren.some(b => /spreekt elkaar tegen/.test(b)), tegenspraak.bezwaren.join(' '));

  const rareSleutel = comp.zet({ sleutel: 'Fooi Extra!', naam: 'x', soort: 'bruto', belast: false,
    grondslagen: [], invoerbron: 'handmatig', goedkeuring: 'geen' }, 'A. Bakker');
  assert.ok(rareSleutel.bezwaren.some(b => /sleutel/.test(b)));

  const bijzonderOnbelast = comp.zet({ sleutel: 'iets', naam: 'Iets', soort: 'bruto', belast: false,
    bijzonder: true, grondslagen: [], invoerbron: 'handmatig', goedkeuring: 'geen' }, 'A. Bakker');
  assert.ok(bijzonderOnbelast.bezwaren.some(b => /bijzonder maar onbelast/.test(b)),
    'het bijzondere tarief is een tarief voor BELAST loon');
});

test('een component die vervalt verdwijnt niet, maar telt niet meer mee', () => {
  const db = { data: {} };
  const comp = maakComponenten({ db, save: () => {}, nu: klok() });
  comp.zet({ sleutel: 'caotoeslag', naam: 'Cao-toeslag 2026', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager',
    geldigVan: '2026-01-01', geldigTot: '2026-06-30' }, 'A. Bakker');

  assert.ok(comp.geldigOp('2026-03-01').some(c => c.sleutel === 'caotoeslag'));
  assert.ok(!comp.geldigOp('2026-09-01').some(c => c.sleutel === 'caotoeslag'),
    'na 30 juni telt hij niet meer mee in een nieuwe run');
  assert.ok(comp.een('caotoeslag'), 'maar hij bestaat nog: oude stroken moeten leesbaar blijven');
});

/* ============ 2. de kruiscontrole op het betaalbestand ============ */

function runOpzet() {
  const db = { data: {} };
  const save = () => {};
  const nu = klok();
  const regelpakket = maakRegelpakket({ db, save, nu });
  const componenten = maakComponenten({ db, save, nu });
  regelpakket.neemOp({ land: 'NL', versie: 'nl-2026.1', geldigVan: '2026-01-01', geldigTot: '2026-12-31',
    valuta: 'EUR', regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
      premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } }, { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ db, save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ db, save, nu, crypto });
  const r = run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03', land: 'NL',
    regels: [{ staffId: 7, naam: 'Timo Vos', contract: { uurloonCenten: 1800, soort: 'vast' },
      invoer: [{ component: 'gewerkte_uren', aantal: 160 }], leeftijdsgroep: '21+', gewerkteUren: 160 }],
    door: 'A. Bakker' });
  run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  run.maakDefinitief(r.run.id, 'A. Bakker');
  return { db, run, journaal, vol: run.haal(r.run.id) };
}

test('het betaalbestand controleert zichzelf tegen het loonjournaal', () => {
  const k = runOpzet();
  const bet = k.journaal.betaalbestand(k.vol, { 7: 'NL91ABNA0417164300' });
  assert.ok(bet.ok, JSON.stringify(bet).slice(0, 200));
  const b = k.journaal.boeking(k.vol);
  const netto = b.regels.filter(r => r.rekening === TEGENREKENINGEN.nettoloon)
    .reduce((s, r) => s + r.creditCenten, 0);
  assert.equal(bet.bestand.totaalCenten, netto, 'bestand en journaal zeggen hetzelfde');
});

test('een correctierun waarbij iemand geld terug moet, gaat gewoon door', () => {
  /* DEZE TOETS BESTAAT OMDAT MIJN EERSTE VERSIE VAN DE CONTROLE HIER OP STUKGING.
     Ik vergeleek journaal en bestand op "gelijk". Bij een correctierun kan een
     nettobedrag NEGATIEF zijn -- iemand heeft te veel gekregen en moet
     terugbetalen. Het journaal boekt die negatieve schuld mee; het
     betaalbestand slaat hem over, want je maakt geen min-bedrag over. Een
     controle op "gelijk" blokkeert dus precies elke correctierun waar geld
     terug moet, en dat is nu juist waar een correctierun voor is.

     De som die wel klopt: journaal = uitbetaald MIN terug te vorderen. */
  const k = runOpzet();
  /* Een echte correctiestrook: een negatieve brutoregel MET grootboek, zodat de
     boeking gewoon op nul sluit. Zo ziet een terugvordering er in het echt uit;
     een losse min-post zonder tegenrekening zou de boeking al laten struikelen
     en dan toets je iets anders. */
  k.vol.stroken.push({ staffId: 8, naam: 'Ilse Berg',
    invoer: [], contract: { uurloonCenten: 1800, soort: 'vast' },
    strook: { regels: [{ component: 'gewerkte_uren', naam: 'Gewerkte uren', soort: 'bruto',
        aantal: null, centen: -25000, grootboek: '4000' }],
      stappen: [], brutoCenten: -25000, loonheffingCenten: 0,
      inhoudingenCenten: 0, nettoCenten: -25000, werkgeverslastenCenten: 0,
      kostenWerkgeverCenten: -25000, valuta: { code: 'EUR', decimalen: 2, aangenomen: false } } });

  const bet = k.journaal.betaalbestand(k.vol,
    { 7: 'NL91ABNA0417164300', 8: 'NL02ABNA0123456789' });
  assert.ok(bet.ok, 'een terugvordering mag geen betaalbestand blokkeren: ' + JSON.stringify(bet).slice(0, 220));
  assert.equal(bet.bestand.aantal, 1, 'er wordt aan een persoon uitbetaald');
  assert.equal(bet.bestand.terugtevorderenCenten, 25000,
    'en wat er terug moet komen staat erbij -- anders verdwijnt het uit beeld zodra het bestand er is');
  assert.equal(bet.bestand.terugtevorderen[0].naam, 'Ilse Berg');
});

test('spreken ze elkaar echt tegen, dan wordt er NIETS bewaard', () => {
  /* HOE JE DEZE CONTROLE ÜBERHAUPT LAAT AFGAAN. Via de gewone weg kan het niet:
     journaal.js en journaal-betalen.js rekenen allebei uit dezelfde stroken, dus
     ze kunnen vandaag niet uiteenlopen. Dat is precies wat een controle als deze
     hoort te zijn -- een vangnet voor DRIFT, voor de dag dat iemand een van de
     twee kanten aanpast.

     Een vangnet dat je niet kunt zien werken, is geen vangnet. Daarom bouwen we
     de betaalmodule hier op met een BOEKING die iets anders zegt; dat mag, want
     hij krijgt zijn boeking van buiten (dat is de naad waarlangs hij is
     afgesplitst). Zo toetsen we de afspraak van de module en niet mijn
     vermogen om de opzet te verminken. */
  const maakBetalen = require('../server/kern/payroll/journaal-betalen');
  const k = runOpzet();
  const eerlijk = k.journaal.boeking(k.vol);
  const scheef = Object.assign({}, eerlijk, { regels: eerlijk.regels.map(r =>
    r.rekening === TEGENREKENINGEN.nettoloon
      ? Object.assign({}, r, { creditCenten: r.creditCenten + 100 }) : r) });

  const db = { data: {} };
  const betalen = maakBetalen({ db, save: () => {}, tijd: () => '2026-04-01T10:00:00.000Z',
    crypto, boeking: () => scheef, bestandenVan: () => [],
    tegenrekeningNetto: TEGENREKENINGEN.nettoloon });

  const bet = betalen.betaalbestand(k.vol, { 7: 'NL91ABNA0417164300' });
  assert.equal(bet.status, 422, JSON.stringify(bet).slice(0, 220));
  assert.match(bet.error, /spreken elkaar tegen/);
  assert.match(bet.error, /niets bewaard/);
  assert.equal((db.data.payrollBetaalbestanden || []).length, 0,
    'en er staat inderdaad niets in de administratie: een bestand dat er is, kan iemand inlezen bij de bank');
});

test('sluitAan maakt geen tweede bestand als er al een is', () => {
  const k = runOpzet();
  k.journaal.betaalbestand(k.vol, { 7: 'NL91ABNA0417164300' });
  const s = k.journaal.sluitAan(k.vol, { 7: 'NL91ABNA0417164300' });
  assert.ok(s.ok);
  assert.equal(s.sluitAan, true);
  assert.equal((k.db.data.payrollBetaalbestanden || []).length, 1,
    'een rapport openen hoort geen tweede betaalopdracht te maken');
});

/* ============ 3. de planning ============ */

test('een leidinggevende ziet DAT iemand er niet is, niet WAT hij heeft', () => {
  const db = { data: {} };
  const verzuim = maakVerzuim({ db, save: () => {}, nu: klok() });
  verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-13' }, 'Timo Vos');
  verzuim.meld('MERIDIAAN', 7, { soort: 'vakantie', van: '2026-03-23', tot: '2026-03-27' }, 'Timo Vos');

  const plan = verzuim.voorPlanning('MERIDIAAN', 7, '2026-03-01', '2026-03-31');
  const ziek = plan.find(x => x.van === '2026-03-09');
  assert.equal(ziek.wat, 'afwezig', '"ziek" is zelf al een gezondheidsgegeven');
  const vak = plan.find(x => x.van === '2026-03-23');
  assert.equal(vak.wat, 'Vakantie', 'vakantie is geen medisch gegeven; die mag met naam');

  /* En de payroll ziet wel de soort, want die moet het percentage weten. Twee
     lagen, EEN opslag: twee plekken die hetzelfde bewaren lopen uit elkaar. */
  const pay = verzuim.voorPayroll('MERIDIAAN', 7, '2026-03-01', '2026-03-31');
  assert.equal(pay.find(x => x.van === '2026-03-09').soort, 'ziek');
  assert.equal(pay.find(x => x.van === '2026-03-09').betaaldDeel, 0.7);
});

test('wat iemand nog wel kan, kan worden bijgesteld -- en dat is wat de planning leest', () => {
  const db = { data: {} };
  const verzuim = maakVerzuim({ db, save: () => {}, nu: klok() });
  verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-27' }, 'Timo Vos');

  assert.equal(verzuim.voorPlanning('MERIDIAAN', 7, '2026-03-01', '2026-03-31')[0].inzetbaarheid, 'niets',
    'een ziekmelding begint op "niets"');

  const r = verzuim.zetInzetbaarheid('MERIDIAAN', 7, '2026-03-09', 'aangepast', 'Timo Vos');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(verzuim.voorPlanning('MERIDIAAN', 7, '2026-03-01', '2026-03-31')[0].inzetbaarheid, 'aangepast',
    'en na een week kan iemand aangepast werk doen -- dat is wat een rooster moet weten');

  /* De melding zelf verandert niet: dit is een bijstelling en geen nieuwe
     melding, dus de doorbetaling blijft staan waar hij stond. */
  const pay = verzuim.voorPayroll('MERIDIAAN', 7, '2026-03-01', '2026-03-31')[0];
  assert.equal(pay.soort, 'ziek');
  assert.equal(pay.van, '2026-03-09');
});

test('inzetbaarheid kent vier standen en geen vijfde, en geen veld voor waarom', () => {
  const db = { data: {} };
  const verzuim = maakVerzuim({ db, save: () => {}, nu: klok() });
  verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-27' }, 'Timo Vos');
  assert.equal(verzuim.zetInzetbaarheid('MERIDIAAN', 7, '2026-03-09', 'bijna beter', 'Timo Vos').status, 400);
  assert.equal(verzuim.zetInzetbaarheid('MERIDIAAN', 7, '2026-03-09', 'deels', '').status, 400,
    'en er hoort een naam bij wie het bijstelt');
  assert.equal(verzuim.zetInzetbaarheid('MERIDIAAN', 8, '2026-03-09', 'deels', 'Iemand').status, 404,
    'zonder lopende melding valt er niets bij te stellen');
  assert.deepEqual(verzuim.INZETBAARHEID, ['niets', 'aangepast', 'deels', 'volledig']);
});
