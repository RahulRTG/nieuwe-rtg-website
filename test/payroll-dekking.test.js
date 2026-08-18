/* Payroll OS: de DEKKING per land -- waar kan er loon draaien, en waar niet?

   WAT HIER OP HET SPEL STAAT. De loonmotor is landneutraal: hij vraagt het
   regelpakket van het land van de zaak en rekent daarmee. Ligt dat er niet, dan
   komt er geen loonrun, en dat is precies goed -- met Nederlandse tarieven
   Spaans loon rekenen is erger dan niet rekenen.

   Maar "er komt geen loonrun" mag geen STILTE zijn. Zonder dit overzicht merkt
   niemand dat er in tweeenzeventig zaken personeel werkt waarvoor geen tabel
   ligt; je ontdekt het op de dag dat iemand vraagt waar zijn loonstrook blijft.
   Deze toetsen gaan over die stilte:

   - een land met werk en zonder tabel staat in de lijst, met wat er ontbreekt;
   - een pakket dat niemand heeft aangemerkt telt NIET als "draait";
   - een jaargang die afloopt zonder opvolger wordt vooraf gemeld (de klassieke
     januarifout: op 31 december draait alles, op 1 januari niets);
   - een bron is een https-adres per land, en de bijwerkronde pakt hem op
     zonder dat er code verandert. Dat is wat "wereldwijd" hier betekent.

   Draai los: node --test test/payroll-dekking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakDekking } = require('../server/kern/payroll/dekking');
const { maakBijwerken } = require('../server/kern/payroll/bijwerken');
const { LANDEN } = require('../server/kern/fiscaal/landen');

const pakket = (land, versie, over) => Object.assign({
  land, versie, geldigVan: '2026-01-01', geldigTot: '2026-12-31',
  regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 }
}, over || {});

function opzet(zaken) {
  const db = { data: { suppliers: zaken || [
    { code: 'MERIDIAAN', name: 'Meridiaan Toren', settings: { land: 'NL' } },
    { code: 'KIKUNOI', name: 'Sal de Mar', settings: { land: 'ES' } },
    { code: 'PONTO', name: 'Sunset Ibiza', settings: { land: 'ES' } }
  ] } };
  const save = () => {};
  const nu = () => '2026-03-01T00:00:00.000Z';
  const regelpakket = maakRegelpakket({ db, save, nu });
  const accounts = { countStaff: (code) => ({ MERIDIAAN: 5, KIKUNOI: 12, PONTO: 3 })[code] || 0 };
  const dekking = maakDekking({ db, save, nu, regelpakket, LANDEN, accounts });
  return { db, regelpakket, dekking, nu, save };
}

test('de landenlijst komt uit de zaken zelf, niet uit een lijst die iemand bijhoudt', () => {
  const k = opzet();
  const werk = k.dekking.landenMetWerk();
  assert.deepEqual(werk.map(w => w.land).sort(), ['ES', 'NL']);
  const es = werk.find(w => w.land === 'ES');
  assert.equal(es.zaken, 2);
  assert.equal(es.personeel, 15, '12 + 3 -- het personeel telt op over de zaken van dat land');
});

test('een land zonder tabel staat er MET wat er nog moet komen', () => {
  const k = opzet();
  const es = k.dekking.voorLand('ES');
  assert.equal(es.stand, 'geen_tabel');
  assert.ok(es.ontbreekt.includes('loonheffing'),
    'de loonheffing ontbreekt en die verzinnen we niet: ' + es.ontbreekt.join(', '));
  /* Wat de fiscaal-tabel WEL weet, staat erbij. Dat is echte kennis en het
     verschil tussen een blokkade ("niet beschikbaar") en een opdracht. */
  assert.ok(es.fiscaal, 'de fiscaal-tabel kent dit land');
  assert.equal(es.fiscaal.naam, 'Spanje');
  assert.ok(es.fiscaal.minimumUurloonCenten > 0, 'met een minimumuurloon in centen');
  assert.ok(es.fiscaal.werkgeverslasten > 0, 'en de werkgeverslasten');
});

test('een pakket dat niemand heeft aangemerkt telt niet als "draait"', () => {
  const k = opzet();
  k.regelpakket.neemOp(pakket('NL', 'nl-2026.1'), { soort: 'test' });
  assert.equal(k.dekking.voorLand('NL').stand, 'wacht_op_mens',
    'binnengehaald is niet goedgekeurd -- daar mag geen definitieve run op');
  k.regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const na = k.dekking.voorLand('NL');
  assert.equal(na.stand, 'draait');
  assert.equal(na.pakket.goedgekeurdDoor, 'R. Sardjoe', 'met de naam eraan');
  assert.equal(na.fiscaal, null, 'en de fiscaal-tabel valt weg: er is nu EEN waarheid');
});

test('het wereldbeeld telt de mensen die geen loonrun kunnen krijgen', () => {
  const k = opzet();
  k.regelpakket.neemOp(pakket('NL', 'nl-2026.1'), { soort: 'test' });
  k.regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const w = k.dekking.wereld();
  assert.equal(w.telling.draait, 1);
  assert.equal(w.telling.geen_tabel, 1);
  assert.equal(w.telling.personeelZonderTabel, 15,
    'vijftien mensen in Spanje krijgen geen loonstrook, en dat is het getal dat telt');
  assert.equal(w.telling.zakenZonderTabel, 2);
});

test('een jaargang die afloopt zonder opvolger wordt vooraf gemeld', () => {
  const k = opzet();
  k.regelpakket.neemOp(pakket('NL', 'nl-2026.1'), { soort: 'test' });
  k.regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');

  // vanaf maart is 31 december nog ver weg
  assert.equal(k.dekking.verlooptBinnen(60, '2026-03-01').length, 0);

  // maar in november wel
  const nov = k.dekking.verlooptBinnen(60, '2026-11-15');
  assert.equal(nov.length, 1, 'de januarifout wordt in november gemeld');
  assert.equal(nov[0].land, 'NL');
  assert.equal(nov[0].personeel, 5, 'met hoeveel mensen het raakt');
  assert.match(nov[0].uitleg, /geen loonrun meer/);

  // ligt er een opvolger, dan is er niets aan de hand
  k.regelpakket.neemOp(pakket('NL', 'nl-2027.1',
    { geldigVan: '2027-01-01', geldigTot: '2027-12-31' }), { soort: 'test' });
  assert.equal(k.dekking.verlooptBinnen(60, '2026-11-15').length, 0,
    'met een opvolger klaar is het geen bevinding meer');
});

test('een bron is een https-adres per land, en niets anders', () => {
  const k = opzet();
  assert.equal(k.dekking.zetBron('ES', { url: 'http://onveilig.example/es.json' }, 'A. Bakker').status, 400,
    'geen http: een loontabel over een onbeveiligde lijn is geen loontabel');
  assert.equal(k.dekking.zetBron('ES', { url: 'niets' }, 'A. Bakker').status, 400);
  assert.equal(k.dekking.zetBron('ES', { url: 'https://x.example/es.json' }, '').status, 400,
    'en er hoort een naam bij wie hem neerzet');

  const ok = k.dekking.zetBron('ES', { naam: 'Agencia Tributaria', url: 'https://x.example/es.json' }, 'A. Bakker');
  assert.ok(ok.ok);
  assert.equal(k.dekking.bronnenVan('ES').length, 1);
  assert.ok(k.dekking.zetBron('ES', { url: 'https://x.example/es.json' }, 'A. Bakker').ongewijzigd,
    'dezelfde bron twee keer levert geen tweede rij');
  assert.equal(k.dekking.voorLand('ES').bronnen.length, 1, 'en hij staat op het dekkingsscherm');
  assert.ok(k.dekking.haalBronWeg('ES', 'https://x.example/es.json').ok);
  assert.equal(k.dekking.bronnenVan('ES').length, 0);
});

test('de bijwerkronde pakt een bron op die via het scherm is toegevoegd', async () => {
  const k = opzet();
  k.dekking.zetBron('ES', { naam: 'Proefbron', url: 'https://x.example/es.json' }, 'A. Bakker');

  /* De ronde krijgt zijn fetch mee in plaats van het netwerk op te gaan. Dat is
     geen truc voor de toets: de bronlaag is met opzet zo gebouwd dat hij niets
     van zijn omgeving aanneemt (zie ./bijwerken.js). */
  let gevraagd = null;
  const nep = async (url) => {
    gevraagd = url;
    return { ok: true, json: async () => pakket('ES', 'es-2026.1') };
  };
  const bijwerken = maakBijwerken({ regelpakket: k.regelpakket, db: k.db, save: k.save,
    nu: k.nu, dekking: k.dekking, fetchImpl: nep });

  const uitslag = await bijwerken.ronde();
  assert.equal(gevraagd, 'https://x.example/es.json', 'de bron is echt opgehaald');
  assert.equal(uitslag.gekeken, 1);
  assert.equal(uitslag.nieuw.length, 1, JSON.stringify(uitslag));
  assert.equal(uitslag.nieuw[0].land, 'ES');

  /* En hij staat als ONGECONTROLEERD klaar. Dit is de hele rem: automatisch
     binnenhalen mag, automatisch in gebruik nemen niet. */
  const es = k.dekking.voorLand('ES');
  assert.equal(es.stand, 'wacht_op_mens');
  assert.equal(es.pakket.stand, 'ongecontroleerd');
});

test('een bron die stukgaat zet de andere niet stil, en zijn fout blijft staan', async () => {
  const k = opzet();
  k.dekking.zetBron('ES', { naam: 'Stuk', url: 'https://stuk.example/es.json' }, 'A. Bakker');
  k.dekking.zetBron('NL', { naam: 'Goed', url: 'https://goed.example/nl.json' }, 'A. Bakker');

  const nep = async (url) => {
    if (url.includes('stuk')) throw new Error('bron gaf status 503');
    return { ok: true, json: async () => pakket('NL', 'nl-2026.1') };
  };
  const bijwerken = maakBijwerken({ regelpakket: k.regelpakket, db: k.db, save: k.save,
    nu: k.nu, dekking: k.dekking, fetchImpl: nep });

  const uitslag = await bijwerken.ronde();
  assert.equal(uitslag.fouten.length, 1);
  assert.equal(uitslag.fouten[0].land, 'ES');
  assert.equal(uitslag.nieuw.length, 1, 'de andere bron deed gewoon zijn werk');

  /* De fout blijft aan de bron hangen. Een bron die al drie maanden zwijgt is
     zelf een bevinding, en die zie je alleen als het ergens blijft staan. */
  const es = k.dekking.voorLand('ES');
  assert.match(es.bronnen[0].laatsteFout, /503/);
  assert.ok(es.bronnen[0].laatst, 'met het moment erbij');
});

test('de ronde kijkt vooruit naar wat afloopt', async () => {
  const k = opzet();
  k.regelpakket.neemOp(pakket('NL', 'nl-2026.1'), { soort: 'test' });
  k.regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  /* Een eigen dekking met DEZELFDE klok als de bijwerklaag. In het echt komen
     ze allebei uit kern/payroll/index.js en delen ze er een; hier twee
     verschillende zetten zou een verschil toetsen dat alleen in deze toets
     bestaat -- de ronde kijkt bewust met de klok van de dekking vooruit en niet
     met een datum die hij zelf meestuurt. */
  const nov = () => '2026-11-15T00:00:00.000Z';
  const dekkingNov = maakDekking({ db: k.db, save: k.save, nu: nov,
    regelpakket: k.regelpakket, LANDEN, accounts: { countStaff: () => 5 } });
  const gemeld = [];
  const bijwerken = maakBijwerken({ regelpakket: k.regelpakket, db: k.db, save: k.save,
    nu: nov, dekking: dekkingNov, log: (t) => gemeld.push(t) });
  const uitslag = await bijwerken.ronde();
  assert.equal(uitslag.verloopt.length, 1, 'de ronde die tarieven haalt, kijkt meteen vooruit');
  assert.ok(gemeld.some(t => /loopt af op 2026-12-31/.test(t)),
    'en zegt het hardop: ' + gemeld.join(' | '));
});

/* "DRAAIT" ZEGT NIET WAAROP. Een land kan draaien op tabellen die zelf melden
   dat ze niet tegen de bron zijn gelegd -- iemand heeft ze uitdrukkelijk
   aangemerkt, dat mag, maar op een dekkingsoverzicht is "draait" dan een half
   antwoord. Geen vierde stand (die zou elke lezer opnieuw moeten leren) maar
   een vlag ernaast, met de reden die bij het aanmerken is opgeschreven. */
test('een land dat draait op ongecontroleerde tabellen zegt dat erbij', () => {
  const k = opzet();
  const demo = Object.assign(pakket('NL', 'nl-demo.1'),
    { _let_op: 'ONGECONTROLEERD. Niet tegen het Handboek Loonheffingen gelegd.' });
  k.regelpakket.neemOp(demo, { soort: 'meegeleverd' });
  k.regelpakket.merkAan('NL', 'nl-demo.1', 'R. Sardjoe', { ondanks: true, reden: 'demo-opstelling' });

  const d = k.dekking.voorLand('NL');
  assert.equal(d.stand, 'draait', 'hij draait -- een mens heeft getekend');
  assert.equal(d.opDemoTabellen, true, 'maar wel op ongecontroleerde tabellen');
  assert.equal(d.pakket.ondanksWaarschuwing, 'demo-opstelling', 'met de reden die toen is opgeschreven');
  assert.match(d.pakket.waarschuwing, /Handboek/, 'en de zelfverklaring van het pakket zelf');
});

test('een gecontroleerd pakket draagt die vlag juist niet', () => {
  const k = opzet();
  k.regelpakket.neemOp(pakket('NL', 'nl-2026.1'), { soort: 'test' });
  k.regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const d = k.dekking.voorLand('NL');
  assert.equal(d.stand, 'draait');
  assert.equal(d.opDemoTabellen, false, 'anders zou de vlag betekenisloos worden');
  assert.equal(d.pakket.waarschuwing, null);
});
