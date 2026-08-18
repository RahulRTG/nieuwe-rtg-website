/* KOMT ZAAK B BIJ DE OMZET VAN ZAAK A?

   De derde rollenvraag. test/geld-rollen.test.js dekt lid tegen lid op de bank,
   test/geld-rollen-buiten-bank.test.js lid tegen lid op de dossiers. Dit gaat
   over de zakenkant, en daar staat een ander soort geld: een openstaande
   horecarekening is de omzet van een ondernemer, en wie daaraan kan zitten kan
   hem kwijtspelen.

   DE VORM OM OP TE LETTEN is dezelfde als altijd: het rekening-id komt uit de
   BODY, de zaak uit de SESSIE (req.supplier, gezet door supplierAuth). Elke
   plek waar die twee niet tegen elkaar worden gehouden laat de ene ondernemer
   in de kassa van de andere kijken -- en horeca-ids zijn kort en oplopend, dus
   raden is hier geen kunst.

   WAT ER BEWEZEN WORDT, en het kan allemaal zakken:
     1. TEGENPROEF: zaak A kan zijn eigen rekening wel afrekenen, en dat landt
        ook echt. Zonder deze bewering zou "B komt er niet in" ook groen zijn
        als niemand erin komt;
     2. B kan de rekening van A niet uitlezen, niet korten, niet afrekenen en
        niet annuleren;
     3. en na al die pogingen is de rekening van A byte-voor-byte dezelfde.

   Punt 3 is het punt dat telt. Een route kan netjes 404 antwoorden en onderweg
   toch iets hebben afgeboekt; alleen de vergelijking voor en na sluit dat uit.

   Draai los: node --experimental-sqlite --test test/geld-rollen-zaken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaken-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Inloggen als manager van een seed-zaak, langs de echte weg: het rooster
   opvragen en met de pincode van die manager inloggen. */
async function zaakLogin(code) {
  const roster = (await api('/api/supplier/roster', { code })).body;
  const man = (roster.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'zaak ' + code + ' heeft een manager in het rooster');
  const r = await api('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(r.body.token, 'manager van ' + code + ' kan inloggen: ' + JSON.stringify(r.body).slice(0, 120));
  return { code, token: r.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;

  A = await zaakLogin('KIKUNOI');
  B = await zaakLogin('ESVEDRA');
  assert.notEqual(A.code, B.code, 'twee verschillende zaken -- anders toetst dit niets');

  /* Zaak A opent een tafelrekening en zet er iets op. Dat is de omzet waar B
     straks aan probeert te komen. */
  const open = await api('/api/supplier/horeca/rekening/open', { tafel: 'T1', naam: 'Proef' }, A.token);
  assert.equal(open.status, 200, 'A opent een rekening: ' + JSON.stringify(open.body).slice(0, 160));
  A.rek = (open.body.rekening && open.body.rekening.id) || open.body.id;
  assert.ok(A.rek, 'A heeft een rekening-id: ' + JSON.stringify(open.body).slice(0, 160));
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const rekeningVanA = async () =>
  JSON.stringify((await api('/api/supplier/horeca/rekening', { rekeningId: A.rek }, A.token)).body);

test('1. TEGENPROEF: zaak A kan zijn eigen rekening wel bedienen', async () => {
  const zien = await api('/api/supplier/horeca/rekening', { rekeningId: A.rek }, A.token);
  assert.equal(zien.status, 200, 'de eigenaar ziet zijn eigen rekening: ' + JSON.stringify(zien.body).slice(0, 140));

  const korting = await api('/api/supplier/horeca/korting', { rekeningId: A.rek, reden: 'proef', centen: 100 }, A.token);
  assert.ok(korting.status < 400, 'en kan hem ook bedienen (' + korting.status + ')');
});

test('2. zaak B komt met zijn eigen geldige sessie nergens bij de rekening van A', async () => {
  const voor = await rekeningVanA();

  const pogingen = [
    ['/api/supplier/horeca/rekening', { rekeningId: A.rek }],
    ['/api/supplier/horeca/korting', { rekeningId: A.rek, reden: 'kaping', centen: 5000 }],
    ['/api/supplier/horeca/betaal', { rekeningId: A.rek, wijze: 'contant' }],
    ['/api/supplier/horeca/rekening/sluit', { rekeningId: A.rek }],
    ['/api/supplier/horeca/regel', { rekeningId: A.rek, naam: 'Kaviaar', centen: 9900, aantal: 1 }]
  ];

  const doorgelaten = [];
  for (const [pad, body] of pogingen) {
    const r = await api(pad, body, B.token);
    if (r.status >= 200 && r.status < 300) doorgelaten.push(pad + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
    assert.ok(r.status < 500, pad + ' viel om in plaats van te weigeren (' + r.status + ')');
  }
  assert.deepEqual(doorgelaten, [], 'zaak B kwam bij de rekening van zaak A');

  /* En de rekening van A is ongewijzigd. Een nette foutmelding is geen bewijs
     dat er niets is afgeboekt. */
  assert.equal(await rekeningVanA(), voor, 'de rekening van zaak A is aangeraakt door zaak B');
});

test('3. B ziet de rekening van A ook niet in zijn eigen lijst', async () => {
  const lijst = await api('/api/supplier/horeca/rekeningen', {}, B.token);
  const ids = (lijst.body.rekeningen || lijst.body.open || []).map(r => r.id);
  assert.ok(!ids.includes(A.rek), 'de rekening van A staat niet in de lijst van B');
});
