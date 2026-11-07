/* Tegenproeven voor browserbinding in de bestaande VOLTOOIPROEF. Geen browser
   of productregister wordt hier uitgevoerd of geschreven. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bewijsVoor } = require('../scripts/lib/bewijsbron');

function proef(wijzig = () => {}, opties = {}) {
  const instrument = 'scripts/lib/voltooi/lokaal.js';
  const bewijs = opties.bewijs || 'persistent';
  const bron = { soort: 'voltooiproef', kanaal: 'browser', instrument, register: 'VOLTOOIPROEF.json',
    scherm: { ingang: '/apps/lokaal.html', bestemmingen: ['/apps/document.html?versie=1'], toestand: '#hoofd' } };
  const schakels = [1, 2, 3].map(nr => ({ nr, wat: 'lokale taakstap ' + nr, stand: 'gesloten',
    herstartsVoor: nr === 1 ? { netjes: 0, crash: 0 } : { netjes: 1, crash: 1 } }));
  const app = { scenario: instrument, kanaal: 'browser', ingang: bron.scherm.ingang, afgebroken: null,
    herstarts: { netjes: 1, crash: 1 },
    browser: { ingang: bron.scherm.ingang, bezocht: [bron.scherm.ingang, ...bron.scherm.bestemmingen],
      toestanden: [{ pad: bron.scherm.ingang, selector: '#hoofd', zichtbaar: true }], fouten: [], documentfouten: [] },
    [bewijs]: { sluit: true, schakels, storingen: [],
      telling: { schakels: 3, gesloten: 3, open: 0, stuk: 0 } } };
  const reg = { stempel: { op: 'nu', commit: 'abc1234', boomVuil: false,
    instrument: 'scripts/voltooiproef.js', node: process.version },
    apps: { 'link:lokaal': app } };
  const contract = { 'link:lokaal': { belofte: 'lokaal document lezen', [bewijs]: bron } };
  const data = { bron, app, reg, contract, instrumentTekst: 'module.exports = {};', ingang: bron.scherm.ingang };
  wijzig(data);
  return bewijsVoor('link:lokaal', bewijs, data.ingang, {
    contract, lees: rel => rel === 'VOLTOOIPROEF.json' ? JSON.stringify(reg) : rel === instrument ? data.instrumentTekst : null,
    versheid: opties.versheid || (() => ({ vers: true, reden: 'unitfixture' }))
  });
}

test('browserbinding vereist geen verzonnen API voor een werkelijk bezochte lokale taak', () => {
  const uit = proef();
  assert.equal(uit.status, 'BEWEZEN', uit.reden);
  assert.equal(uit.bewijs.deel, 'apps/link:lokaal/persistent');
  assert.equal(uit.bron.kanaal, 'browser');
});

for (const [naam, wijzig] of [
  ['andere aangeleverde ingang', d => { d.ingang = '/apps/ander.html'; }],
  ['andere contractingang', d => { d.contract['link:lokaal'].ingang = '/apps/ander.html'; }],
  ['andere scenario-identiteit', d => { d.app.scenario = 'scripts/lib/voltooi/ander.js'; }],
  ['ontbrekend resultaatkanaal', d => { delete d.app.kanaal; }],
  ['ander resultaatkanaal', d => { d.app.kanaal = 'api'; }],
  ['andere resultaatingang', d => { d.app.ingang = '/apps/ander.html'; }],
  ['andere browseringang', d => { d.app.browser.ingang = '/apps/ander.html'; }],
  ['ander broninstrument', d => { d.reg.stempel.instrument = 'scripts/ander.js'; }],
  ['ontbrekend instrument', d => { d.instrumentTekst = null; }],
  ['ontbrekend browserresultaat', d => { delete d.app.browser; }],
  ['geen bezoeken', d => { d.app.browser.bezocht = []; }],
  ['ontbrekende bestemming', d => { d.app.browser.bezocht.pop(); }],
  ['verkeerde query', d => { d.app.browser.bezocht[1] = '/apps/document.html?versie=2'; }],
  ['geen toestanden', d => { d.app.browser.toestanden = []; }],
  ['geen browserfoutwaarneming', d => { delete d.app.browser.fouten; }],
  ['geen documentfoutwaarneming', d => { d.app.browser.documentfouten = null; }],
  ['onzichtbare toestand', d => { d.app.browser.toestanden[0].zichtbaar = false; }],
  ['ander element', d => { d.app.browser.toestanden[0].selector = '#ander'; }],
  ['toestand op verkeerde pagina', d => { d.app.browser.toestanden[0].pad = '/apps/document.html?versie=1'; }],
  ['afgebroken scenario', d => { d.app.afgebroken = 'browser crashte'; }],
  ['ongeldige toestand', d => { d.app.browser.toestanden.push(null); }],
  ['ongeldig bezoek', d => { d.app.browser.bezocht.push('https://extern.invalid/apps/lokaal.html'); }],
  ['ongecanoniseerd pad', d => { d.bron.scherm.bestemmingen = ['/apps/../document.html']; }],
  ['onbekend kanaal', d => { d.bron.kanaal = 'onbekend'; }],
  ['lege schakels', d => { d.app.persistent.schakels = []; }],
  ['minder dan drie schakels', d => {
    d.app.persistent.schakels.pop();
    d.app.persistent.telling = { schakels: 2, gesloten: 2, open: 0, stuk: 0 };
  }],
  ['tegenstrijdig schakeltotaal', d => { d.app.persistent.telling.schakels = 4; }],
  ['tegenstrijdige standtelling', d => { d.app.persistent.telling.gesloten = 2; }],
  ['tegenstrijdige sluiting', d => { d.app.persistent.sluit = false; }],
  ['geen nette herstart', d => { d.app.herstarts.netjes = 0; }],
  ['teller zonder stap na nette herstart', d => {
    for (const s of d.app.persistent.schakels) s.herstartsVoor.netjes = 0;
  }],
  ['herstartsnapshot uit de toekomst', d => { d.app.persistent.schakels[1].herstartsVoor.netjes = 2; }],
  ['ontbrekende herstartsnapshot', d => { delete d.app.persistent.schakels[1].herstartsVoor; }]
]) test('browserbinding faalt gesloten: ' + naam, () => assert.equal(proef(wijzig).status, 'NIET_GETEST'));

test('browserbinding passeert daarna dezelfde versheids- en uitkomstpoort', () => {
  assert.equal(proef(() => {}, { versheid: () => ({ vers: false, reden: 'UI-bron gewijzigd' }) }).status, 'NIET_GETEST');
  assert.equal(proef(d => {
    d.app.persistent.schakels[0].stand = 'stuk';
    d.app.persistent.sluit = false;
    d.app.persistent.telling = { schakels: 3, gesloten: 2, open: 0, stuk: 1 };
  }).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('herstelbaar browserbewijs vereist een werkelijk gemeten crash', () => {
  assert.equal(proef(() => {}, { bewijs: 'herstelbaar' }).status, 'BEWEZEN');
  assert.equal(proef(d => { d.app.herstarts.crash = 0; }, { bewijs: 'herstelbaar' }).status, 'NIET_GETEST');
  assert.equal(proef(d => {
    for (const s of d.app.herstelbaar.schakels) s.herstartsVoor.crash = 0;
  }, { bewijs: 'herstelbaar' }).status, 'NIET_GETEST');
});

test('late browser- en documentfouten verhinderen groen ondanks gesloten taakstappen', () => {
  for (const veld of ['fouten', 'documentfouten']) {
    const wijzig = d => { d.app.browser[veld].push(veld === 'fouten' ? 'TypeError: te laat' : { pad: '/apps/document.html', status: 500 }); };
    assert.equal(proef(wijzig).status, 'GEBLOKKEERD_DOOR_DEFECT');
    assert.equal(proef(wijzig, { versheid: () => ({ vers: false, reden: 'UI gewijzigd' }) }).status, 'NIET_GETEST');
  }
});

test('interne OS-taak gebruikt de fysieke contractingang zonder zijn identiteit te verwisselen', () => {
  const uit = proef(d => {
    d.contract['link:lokaal'].ingang = '/apps/lokaal.html';
    d.ingang = '(os:lokaal)';
  });
  assert.equal(uit.status, 'BEWEZEN', uit.reden);
});
