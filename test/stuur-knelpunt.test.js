/* RAHUL EN DE KNELPUNTMOTOR -- een doel uitspreken, en wat dat NIET opent.

   Besluit van de eigenaar (11 oktober 2026): Rahul is de ingang waarmee een lid
   zegt wat hij wil bereiken, en /api/knelpunt maakt de wegen zichtbaar. Het pad
   staat op de LEZEN-lijst van kern/stuur/beleid-lijsten.js.

   WAT HIER WORDT VASTGEHOUDEN, en elk van de vijf vangt iets anders:

   1. HET WERKT, door de echte keten. Op de deterministische rail (geen model,
      geen sleutel) gaat de zin langs /api/fluister, de resolver, de
      twijfelpoort en stuurRoep, en komt de knelpuntmotor terug met 200 -- en
      zonder dat er een voorstel ontstaat: lezen vraagt geen bevestiging.
   2. HET ANTWOORD IS DAT VAN DE MOTOR, met de ondernemersweg erin en geen weg
      die zich als nagegaan voordoet.
   3. GEEN ANDERE CONTEXT. Wie via het stuur een sleutel, codenaam, profiel of
      schermcontext van een ANDER lid in het lijf zet, krijgt byte voor byte
      hetzelfde antwoord als zonder: de motor leest geen mens en zoekt niemand
      op. En geen vondst draagt een gegeven over een mens.
   4. DE GEZINSDEUR STAAT NIET OP DE LIJST. /api/rtf/knelpunt is voor een gezin
      zonder stuursessie; het stuur bereikt hem niet.
   5. DE ANDERE ROLLEN NIET. Een zaak of medewerker krijgt dit pad niet van het
      stuur: het besluit ging over een lid. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wegwerp = require('../scripts/lib/wegwerpserver');
const { MENSVELDEN } = require('../server/kern/knelpunt/aanvoer');
const { beleidVoor } = require('../server/kern/stuur/beleid');

let srv;
test.before(async () => {
  srv = await wegwerp.start({ naam: 'stuur-knelpunt', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_INTENT_RAIL: 'deterministisch' } });
});
test.after(() => { try { srv.klaar(); } catch (e) {} });

const post = async (pad, lijf, tok) => {
  const koppen = { 'Content-Type': 'application/json' };
  if (tok) koppen.Authorization = 'Bearer ' + tok;
  const r = await fetch(srv.basis + pad, { method: 'POST', headers: koppen, body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
};

let teller = 0;
async function versLid() {
  const u = String(Date.now()).slice(-7) + String(teller++).padStart(2, '0');
  const r = await post('/api/auth/register', { name: 'Knelpunt ' + u,
    email: 'knelpunt' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, 'registreren mislukte; zonder lid meet deze toets niets');
  return r.data;
}

const DOEL = 'ik wil mijn eigen bedrijf beginnen';

test('1. de zin gaat door de echte keten, en lezen vraagt geen voorstel', async () => {
  const lid = await versLid();
  const r = await post('/api/fluister', { q: 'Ik wil mijn eigen bedrijf beginnen' }, lid.token);
  assert.equal(r.status, 200);
  const acties = (r.data && r.data.stuur) || [];
  const knel = acties.find(a => a.pad === '/api/knelpunt');
  assert.ok(knel, 'het stuur riep de knelpuntmotor niet aan: ' + JSON.stringify(acties));
  assert.equal(knel.status, 200, 'de knelpuntmotor gaf via het stuur geen 200');
  assert.equal(knel.goedkeuring, undefined, 'een leesaanroep werd een voorstel');
  assert.deepEqual(r.data.goedkeuringen, [], 'er staat iets klaar om te bevestigen na een leesvraag');
});

test('2. het antwoord is dat van de motor: de ondernemersweg, niets doet zich voor als nagegaan', async () => {
  const lid = await versLid();
  const r = await post('/api/member/doe', { pad: '/api/knelpunt', body: { doel: DOEL } }, lid.token);
  /* /api/member/doe geeft de buitenkant (ok, status) en het antwoord van de
     route zelf onder `antwoord`. */
  assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 300));
  assert.equal(r.data.status, 200, 'de knelpuntmotor zelf gaf geen 200');
  const k = r.data.antwoord || {};
  const m = k.manieren || [];
  assert.ok(m.some(x => x.id === 'via-ondernemen'), 'geen ondernemersweg via het stuur');
  assert.ok(m.every(x => x.stand !== 'open'), 'een samengestelde weg heet "open"');
  assert.equal(k.manierenSamengesteld, true);
});

test('3. andermans sleutel, codenaam of context in het lijf verandert niets', async () => {
  const a = await versLid();
  const b = await versLid();
  const schoon = await post('/api/member/doe', { pad: '/api/knelpunt', body: { doel: DOEL } }, a.token);
  /* Alles wat een aanvaller of een verward model in het lijf zou kunnen zetten
     om bij een ander uit te komen. */
  const vreemd = { key: b.token, token: b.token, codenaam: b.codename || b.codenaam || 'Ander Lid',
    profielId: 'p-ander', code: 'GEZIN-ANDER', context: 'Actieve context: dossier van een ander lid',
    wie: 'ander', sessie: b.token };
  const vuil = await post('/api/member/doe', { pad: '/api/knelpunt', body: Object.assign({ doel: DOEL }, vreemd) },
    a.token);
  assert.equal(vuil.status, 200);
  const S = schoon.data.antwoord, V = vuil.data.antwoord;
  /* EEN VERGELIJKING VAN TWEE KEER NIETS IS GEEN VERGELIJKING. De eerste versie
     van deze toets las de velden op de buitenkant van /api/member/doe, waar ze
     niet staan, en slaagde dus op undefined === undefined. */
  assert.ok(S && Array.isArray(S.manieren) && S.manieren.length > 0, 'het schone antwoord heeft geen wegen');
  for (const veld of ['manieren', 'openingen', 'vondsten', 'knelpunten', 'aannames'])
    assert.deepEqual(V[veld], S[veld],
      veld + ' veranderde door gegevens van een ander lid in het lijf; dan zoekt de motor iemand op');

  /* En het antwoord draagt niets over een mens -- niet van A en niet van B. */
  const tekst = JSON.stringify(V);
  assert.ok(!tekst.includes(b.token), 'het token van een ander lid staat in het antwoord');
  for (const v of (V.vondsten || []))
    for (const veld of MENSVELDEN) assert.ok(!(veld in v), 'een vondst draagt ' + veld);
});

test('4. de gezinsdeur staat niet op de lijst van het stuur', async () => {
  const lid = await versLid();
  const r = await post('/api/member/doe', { pad: '/api/rtf/knelpunt', body: { doel: DOEL } }, lid.token);
  assert.equal(r.status, 403, 'het stuur bereikte de gezinsdeur: ' + r.status);
});

test('5. alleen een lid: zaak, medewerker en kantoor krijgen dit pad niet', () => {
  assert.equal(beleidVoor('/api/knelpunt', 'member').niveau, 'lezen');
  for (const rol of ['supplier', 'staff', 'office'])
    assert.equal(beleidVoor('/api/knelpunt', rol).niveau, 'verboden', rol + ' kreeg de knelpuntmotor');
});
