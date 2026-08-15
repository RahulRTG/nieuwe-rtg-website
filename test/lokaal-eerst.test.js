/* Bewijst de grens tussen lokaal taalwerk en generatief werk. Een beschikbare
   provider mag niet vanzelf worden aangeroepen voor taken die de code zelf
   controleerbaar kan uitvoeren. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakAgenda } = require('../server/kern/agenda');
const maakDelen = require('../server/kern/office/delen');
const { maakReisbureau } = require('../server/kern/reisbureau');
const maakBelasting = require('../server/kern/overheid/belasting');
const maakMeldingen = require('../server/kern/gemeente/meldingen');
const techniek = require('../server/techniek');
const registreerDiagnose = require('../server/routes/techniek/diagnose');

function provider(antwoord) {
  const p = { aanroepen: 0, messages: { create: async () => {
    p.aanroepen++;
    return { content: [{ text: antwoord }] };
  } } };
  return p;
}

test('een herkenbare agenda-opdracht blijft lokaal, ook als een model beschikbaar is', async () => {
  const model = provider('{"titel":"Modeltitel","datum":"2030-01-01","tijd":"09:00"}');
  const db = { data: {} };
  const agenda = maakAgenda({ db, save() {}, bijeen: async fn => fn(), inBundel: () => false,
    crypto, anthropic: model });
  const r = await agenda.aiVoegToe('lid:test', 'Lunch met Sofia morgen om 13u', true);
  assert.equal(r.gedaan, true);
  assert.equal(r.item.tijd, '13:00');
  assert.match(r.item.titel, /Sofia|lunch/i);
  assert.equal(model.aanroepen, 0, 'een lokale parse stuurt geen tekst naar het model');
});

test('alleen een agenda-opdracht die lokaal geen datum oplevert mag naar het model', async () => {
  const model = provider('{"titel":"Strategische sessie","datum":"2030-01-01","tijd":"09:00"}');
  const agenda = maakAgenda({ db: { data: {} }, save() {}, bijeen: async fn => fn(), inBundel: () => false,
    crypto, anthropic: model });
  const r = await agenda.aiVoegToe('lid:test', 'Plan de strategische sessie op het besproken moment', true);
  assert.equal(r.gedaan, true);
  assert.equal(model.aanroepen, 1);
});

function officeMet(model, soort, inhoud) {
  const doc = { id: 'doc1', key: 'eigenaar', soort, inhoud };
  const basis = {
    nu: () => new Date().toISOString(), docMet: id => id === doc.id ? doc : null,
    naamVan: x => x, magSchrijven: () => true, magLezen: () => true,
    faseVan: () => 'concept', schrijfAudit() {}
  };
  return maakDelen({ save() {}, schoon: (x, n) => String(x || '').slice(0, n),
    keyVanCodenaam: async () => null, sseToCustomer() {}, anthropic: model }, basis);
}

test('Office selecteert en rekent lokaal, zelfs met een provider klaar', async () => {
  const model = provider('Dit antwoord kwam van het model.');
  const office = officeMet(model, 'tekst', { tekst: '<p>Mila levert vrijdag het rapport. De omzet is 12.000 euro. Het bestuur besluit maandag.</p>' });
  for (const opdracht of ['samenvatten', 'actiepunten', 'inkorten', 'kritisch']) {
    const r = await office.officeAI('eigenaar', 'doc1', opdracht, '');
    assert.equal(r.status, 200);
    assert.equal(r.stand, 'lokaal');
  }
  assert.equal(model.aanroepen, 0);

  const blad = officeMet(model, 'blad', { cellen: {} });
  const formule = await blad.officeAI('eigenaar', 'doc1', 'formule', 'tel A1 tot A10 op');
  assert.equal(formule.stand, 'lokaal');
  assert.match(formule.voorstel, /^=/);
  assert.equal(model.aanroepen, 0);
});

test('Office gebruikt het model wel voor werkelijk generatief schrijven', async () => {
  const model = provider('Een heldere, nieuw geschreven versie.');
  const office = officeMet(model, 'tekst', { tekst: '<p>Ruwe tekst.</p>' });
  const r = await office.officeAI('eigenaar', 'doc1', 'herschrijven', '');
  assert.equal(r.status, 200);
  assert.equal(r.voorstel, 'Een heldere, nieuw geschreven versie.');
  assert.equal(model.aanroepen, 1);
});

test('herkenbare belastingbedragen worden lokaal uit vrije tekst gehaald', async () => {
  const model = provider('{"inkomen":999999,"aftrek":999999}');
  const belasting = maakBelasting({ anthropic: model,
    eur: x => Math.round((Number(x) || 0) * 100) / 100 });
  const r = await belasting.aangifteAdvies('Mijn bruto inkomen is 54.000 euro en mijn aftrek is 3.200 euro.');
  assert.equal(r.inkomen, 54000);
  assert.equal(r.aftrek, 3200);
  assert.equal(r.bron, 'regel');
  assert.equal(model.aanroepen, 0);
});

test('een herkenbare gemeentemelding wordt lokaal gerouteerd', async () => {
  const model = provider('{"categorie":"overig"}');
  const CATS = { verlichting: 'Verlichting', afval: 'Afval', wegdek: 'Wegdek', groen: 'Groen',
    riool: 'Riool', overlast: 'Overlast', speeltuin: 'Speeltuin', overig: 'Overig' };
  const PLOEG = Object.fromEntries(Object.keys(CATS).map(k => [k, 'ploeg-' + k]));
  const meldingen = maakMeldingen({ anthropic: model, CATS, PLOEG });
  const r = await meldingen.triage('De straatlantaarn bij de brug is kapot en het is donker.');
  assert.equal(r.categorie, 'verlichting');
  assert.equal(r.bron, 'regel');
  assert.equal(model.aanroepen, 0);
});

test('een reis uit een vaste catalogus wordt lokaal en uitlegbaar gerangschikt', async () => {
  const model = provider('{"id":"verkeerd","reden":"model"}');
  const db = { data: { partnerTrips: [
    { id: 'bergen', title: 'Bergen en stilte', dest: 'Zwitserland', netto: 1800, desc: 'wandelen en natuur' },
    { id: 'strand', title: 'Zon aan zee', dest: 'Portugal', netto: 1400, desc: 'strand en surfen' }
  ] } };
  const bureau = maakReisbureau({ db, save() {}, crypto, anthropic: model }).reisbureau;
  const r = await bureau.advies('Ik zoek stilte, natuur en wandelen in de bergen.');
  assert.equal(r.reis.id, 'bergen');
  assert.equal(r.bron, 'regel');
  assert.match(r.reden, /stilte|natuur|wandelen|bergen/i);
  assert.equal(model.aanroepen, 0);
});

test('de ingebouwde techniekdiagnose blijft werken wanneer model-AI uitstaat', async () => {
  let handelaar;
  const app = { post: (_pad, _auth, fn) => { handelaar = fn; } };
  registreerDiagnose({ app, techAuth: (_req, _res, next) => next(),
    staat: () => ({ zekeringen: { ai: { aan: false } } }), ctx: () => ({}) });

  const origineel = techniek.draaiChecks;
  techniek.draaiChecks = async () => [
    { id: 'schijf', naam: 'Schijfruimte', code: 'DSK-01', status: 'waarschuwing' }
  ];
  let status = 200;
  let antwoord;
  const res = { status: s => { status = s; return res; }, json: x => { antwoord = x; return res; } };
  try {
    await handelaar({ body: { checkId: 'schijf' } }, res);
  } finally {
    techniek.draaiChecks = origineel;
  }
  assert.equal(status, 200);
  assert.equal(antwoord.ai, false);
  assert.equal(antwoord.bron, 'ingebouwd');
  assert.match(antwoord.advies, /schijf|volume/i);
});
