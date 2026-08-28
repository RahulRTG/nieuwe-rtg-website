/* Payroll OS: de loonmotor, het regelpakket en het componentenregister.

   DE BELOFTE DIE HIER WORDT BEWAAKT is de belofte waar de hele opzet op rust:
   een oude loonstrook verandert nooit stilletjes mee met een regelwijziging, en
   elk bedrag kan zeggen op welke regel en welke VERSIE het berust.

   Dat is niet te toetsen met "reken eens iets uit". Het is te toetsen door de
   regels te veranderen en te eisen dat de oude uitkomst niet meebeweegt -- en
   dat is precies wat hieronder gebeurt.

   Verder bewaakt dit:
   - de motor neemt niets uit de omgeving (dezelfde invoer, dezelfde uitkomst);
   - een component zonder classificatie komt er niet in plaats van gegokt;
   - een pakket dat de keuring niet haalt komt niet binnen;
   - automatisch binnengehaalde pakketten staan ongecontroleerd klaar en gelden
     pas op hun ingangsdatum;
   - onder het minimumloon is een WAARSCHUWING, geen stille correctie.

   Draai los: node --test test/payroll-motor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakBijwerken } = require('../server/kern/payroll/bijwerken');
const { bereken, controleer } = require('../server/kern/payroll/motor');
const maakOpslag = require('../server/kern/payroll/opslag');

/* Een nepdatabase: deze modules bewaren in db.data en verder nergens. */
function nepDb() {
  const db = { data: {} };
  return { db, save: () => {}, nu: () => '2026-08-06T12:00:00.000Z' };
}

function pakket(versie, over) {
  return Object.assign({
    land: 'NL', versie, geldigVan: '2026-01-01', geldigTot: '2026-12-31',
    regels: {
      minimumUurloon: { '21+': 1499 },
      loonheffing: { tarief: 0.37 },
      premies: { tarief: 0.20 },
      zvw: 0.0657,
      vakantiegeld: 0.08
    }
  }, over || {});
}

function opzet() {
  const { db, save, nu } = nepDb();
  const regels = maakRegelpakket({ opslag: maakOpslag({ db }), save, nu });
  const comps = maakComponenten({ opslag: maakOpslag({ db }), save, nu });
  const register = Object.fromEntries(comps.alle().map(c => [c.sleutel, c]));
  return { db, save, nu, regels, comps, register };
}

test('een bedrag draagt zijn regel en zijn versie', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const rp = regels.opDatum('NL', '2026-06-15');
  assert.equal(rp.versie, 'nl-2026.1');

  const strook = bereken({
    contract: { uurloonCenten: 1600, urenPerWeek: 32, soort: 'oproep' },
    periode: { van: '2026-06-01', tot: '2026-06-30' },
    invoer: [{ component: 'gewerkte_uren', aantal: 100 }],
    regelpakket: rp, componenten: register
  });

  assert.equal(strook.brutoCenten, 160000 + 12800, '100 x 16,00 plus 8% vakantiegeld');
  assert.equal(strook.regelpakket.versie, 'nl-2026.1', 'de versie staat op de strook');
  const heffing = strook.stappen.find(s => s.stap === 'loonheffing');
  assert.equal(heffing.regel, 'loonheffing.tarief', 'de gebruikte regel staat erbij');
  assert.equal(heffing.tarief, 0.37);
  assert.equal(heffing.versie, 'nl-2026.1', 'en de versie waaruit dat tarief kwam');
});

test('een oude strook verandert niet mee als de regels wijzigen', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const juni = regels.opDatum('NL', '2026-06-15');
  const invoer = [{ component: 'gewerkte_uren', aantal: 100 }];
  const contract = { uurloonCenten: 1600 };
  const eerst = bereken({ contract, periode: { van: '2026-06-01' }, invoer, regelpakket: juni, componenten: register });

  // halverwege het jaar gaat het tarief omhoog
  regels.neemOp(pakket('nl-2026.2', { geldigVan: '2026-07-01',
    regels: Object.assign({}, pakket('x').regels, { loonheffing: { tarief: 0.50 } }) }), { soort: 'test' });

  // juni draait nog steeds op juni
  const juniNu = regels.opDatum('NL', '2026-06-15');
  assert.equal(juniNu.versie, 'nl-2026.1', 'de datum bepaalt het pakket, niet "het nieuwste"');
  const opnieuw = bereken({ contract, periode: { van: '2026-06-01' }, invoer, regelpakket: juniNu, componenten: register });
  assert.equal(opnieuw.nettoCenten, eerst.nettoCenten, 'dezelfde periode, dezelfde uitkomst');
  assert.equal(opnieuw.loonheffingCenten, eerst.loonheffingCenten);

  // juli draait wel op het nieuwe pakket
  const juli = regels.opDatum('NL', '2026-07-15');
  assert.equal(juli.versie, 'nl-2026.2');
  const naJuli = bereken({ contract, periode: { van: '2026-07-01' }, invoer, regelpakket: juli, componenten: register });
  assert.ok(naJuli.loonheffingCenten > eerst.loonheffingCenten, 'en die is hoger');
});

test('dezelfde invoer geeft altijd dezelfde uitkomst', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const rp = regels.opDatum('NL', '2026-06-15');
  const arg = { contract: { uurloonCenten: 1737 }, periode: { van: '2026-06-01' },
    invoer: [{ component: 'gewerkte_uren', aantal: 143.5 }, { component: 'nachttoeslag', centen: 4210 },
      { component: 'kilometervergoeding', centen: 2300 }, { component: 'loonbeslag', centen: 15000 }],
    regelpakket: rp, componenten: register };
  const a = bereken(arg), b = bereken(arg);
  assert.deepEqual(b, a, 'de motor neemt niets uit de omgeving');
});

test('een onbekende component wordt niet gegokt maar geweigerd', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const rp = regels.opDatum('NL', '2026-06-15');
  const uit = bereken({ contract: { uurloonCenten: 1600 }, invoer: [{ component: 'geheime_bonus', centen: 50000 }],
    regelpakket: rp, componenten: register });
  assert.ok(uit.fout, 'een bedrag zonder classificatie hoort niet op een loonstrook');
  assert.deepEqual(uit.onbekend, ['geheime_bonus']);
});

test('een pakket dat de keuring niet haalt komt er niet in', () => {
  const { regels } = opzet();
  const zonderTarief = pakket('kapot.1');
  delete zonderTarief.regels.premies;
  const r = regels.neemOp(zonderTarief, { soort: 'test' });
  assert.equal(r.status, 422, 'afgekeurd');
  assert.ok(r.bezwaren.some(b => /premies/.test(b)), 'met de reden erbij: ' + JSON.stringify(r.bezwaren));

  const onzin = pakket('onzin.1');
  onzin.regels.minimumUurloon = { '21+': 3 }; // drie cent per uur
  const r2 = regels.neemOp(onzin, { soort: 'test' });
  assert.equal(r2.status, 422, 'een onaannemelijk tarief is een fout in de bron, geen tarief');
});

test('automatisch binnengehaalde pakketten staan ongecontroleerd klaar', async () => {
  const { db, save, nu, regels } = opzet();
  const bij = maakBijwerken({ regelpakket: regels, opslag: maakOpslag({ db }), save, nu });
  bij.meldBronAan({ naam: 'proefbron', soort: 'url', haal: async () => pakket('nl-2027.1', {
    geldigVan: '2027-01-01', geldigTot: '2027-12-31' }) });

  const uit = await bij.ronde();
  assert.equal(uit.nieuw.length, 1, 'er is er een binnengekomen');
  const opgenomen = regels.alle('NL').find(p => p.versie === 'nl-2027.1');
  assert.equal(opgenomen.stand, 'ongecontroleerd', 'maar niet zomaar in gebruik');
  assert.equal(opgenomen.bron.naam, 'proefbron', 'met de herkomst erbij');

  // en hij geldt pas op zijn ingangsdatum
  assert.equal(regels.opDatum('NL', '2026-12-31'), null, 'in 2026 is er nog niets van te merken');
  assert.equal(regels.opDatum('NL', '2027-03-01').versie, 'nl-2027.1');

  // tweede ronde: dezelfde versie stapelt niet
  const nog = await bij.ronde();
  assert.equal(nog.nieuw.length, 0, 'dezelfde versie komt niet twee keer binnen');

  // aanmerken vraagt om een naam
  assert.equal(regels.merkAan('NL', 'nl-2027.1', '').status, 400);
  const ok = regels.merkAan('NL', 'nl-2027.1', 'R. Sardjoe');
  assert.equal(ok.stand, 'goedgekeurd');
});

test('onder het minimumloon is een waarschuwing, geen stille correctie', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const rp = regels.opDatum('NL', '2026-06-15');
  const strook = bereken({ contract: { uurloonCenten: 900 }, invoer: [{ component: 'gewerkte_uren', aantal: 100 }],
    regelpakket: rp, componenten: register });

  assert.equal(strook.brutoCenten, 90000 + 7200, 'het bedrag wordt NIET stiekem opgehoogd');
  const w = controleer(strook, { regelpakket: rp, leeftijdsgroep: '21+', gewerkteUren: 100 });
  const onder = w.find(x => x.soort === 'onder_minimumloon');
  assert.ok(onder, 'maar er komt wel een waarschuwing: ' + JSON.stringify(w));
  assert.equal(onder.ernst, 'hoog');
  assert.equal(onder.versie, 'nl-2026.1', 'met de regelversie waartegen is getoetst');
});

test('een ongecontroleerd regelpakket waarschuwt luid', () => {
  const { regels, register } = opzet();
  regels.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  const rp = regels.opDatum('NL', '2026-06-15');
  const strook = bereken({ contract: { uurloonCenten: 2000 }, invoer: [{ component: 'gewerkte_uren', aantal: 10 }],
    regelpakket: rp, componenten: register });
  const w = controleer(strook, { regelpakket: rp, leeftijdsgroep: '21+', gewerkteUren: 10 });
  assert.ok(w.some(x => x.soort === 'ongecontroleerd_regelpakket'),
    'zolang niemand het pakket heeft aangemerkt, mag er geen definitieve run op');
});

test('een component die belast is moet zeggen WELKE grondslagen', () => {
  const { comps } = opzet();
  const bez = comps.keur({ sleutel: 'vage_toeslag', naam: 'Vaag', soort: 'bruto', belast: true,
    grondslagen: [], invoerbron: 'handmatig', goedkeuring: 'manager' });
  assert.ok(bez.some(b => /grondslagen/.test(b)), 'anders moet de motor gokken: ' + JSON.stringify(bez));
});

test('de meegeleverde jaargang komt door de eigen keuring, en staat ongecontroleerd klaar', () => {
  /* Dit ging mis en het is precies waar de keuring voor is: de ondergrens voor
     het minimumuurloon stond op 500 cent, terwijl het minimumJEUGDloon voor een
     vijftienjarige rond de 450 ligt. De eigen jaargang werd dus afgewezen en er
     stond helemaal geen regelpakket -- zichtbaar pas toen het scherm "nog geen
     regelpakketten" zei.

     Twee dingen worden hier vastgehouden. Dat de meegeleverde jaargang door de
     keuring komt (anders is er niets om mee te rekenen), en dat hij daarna
     ONGECONTROLEERD is: er mag geen definitieve loonrun op tot iemand hem
     tegen het Handboek Loonheffingen heeft gelegd. */
  const { maakPayrollOS } = require('../server/kern/payroll/index.js');
  const db = { data: {} };
  const os = maakPayrollOS({ db, save: () => {}, crypto: require('node:crypto'), accounts: {} }).payrollOS;

  const uit = os.laadMeegeleverd();
  assert.ok(uit.every(x => x.ok), 'de eigen jaargang hoort door de eigen keuring te komen: ' + JSON.stringify(uit));
  const pakketten = os.regels.alle('NL');
  assert.equal(pakketten.length, 1);
  assert.equal(pakketten[0].stand, 'ongecontroleerd', 'en niet zomaar in gebruik');
});
