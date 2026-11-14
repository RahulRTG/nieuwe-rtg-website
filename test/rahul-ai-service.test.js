'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const post = (base) => async (pad, body, token) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function lid(p, email) {
  const r = await p('/api/auth/register', { name: 'Rahul AI Proef', email,
    phone: '0612340199', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body));
  return r.body.token;
}

test('Rahul AI routeert, adviseert en laat alle beslissingen bij de medewerker', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  try {
    const token = await lid(p, 'rahulai-route@x.nl');
    const kantoor = await kantoorAlsPersoon(srv.base);
    const open = await p('/api/service/open', {
      titel: 'Mijn uitbetaling staat vast', tekst: 'De betaling en factuur zijn nog niet verwerkt.'
    }, token);
    assert.equal(open.status, 200, JSON.stringify(open.body));
    assert.equal(open.body.zaak.onderwerp, 'betaling');
    assert.equal(open.body.zaak.team, 'betalingen');

    const mijn = await p('/api/service/mijn', {}, token);
    assert.equal(mijn.body.zaken[0].team, undefined);
    const dossier = await p('/api/service/zaak', { id: open.body.zaak.id }, token);
    const klantbeeld = JSON.stringify(dossier.body);
    assert.equal(klantbeeld.includes('rahulTriage'), false);
    assert.equal(klantbeeld.includes('toegewezen aan Betalingen'), false);

    const advies = await p('/api/office/service/rahul/advies', { id: open.body.zaak.id }, kantoor);
    assert.equal(advies.status, 200, JSON.stringify(advies.body));
    assert.equal(advies.body.naam, 'Rahul AI');
    assert.match(advies.body.grens, /medewerker.*beslist/i);
    assert.ok(advies.body.volgendeStap);

    const concept = await p('/api/office/service/rahul/concept', { id: open.body.zaak.id }, kantoor);
    assert.equal(concept.status, 200, JSON.stringify(concept.body));
    assert.match(concept.body.concept, new RegExp(open.body.zaak.id));
    assert.match(concept.body.grens, /alleen een medewerker/i);

    const controle = await p('/api/office/service/rahul/controle', {}, kantoor);
    assert.equal(controle.status, 200, JSON.stringify(controle.body));
    assert.ok(controle.body.regels.some(r => r.wat === 'rahulTriage'));
    assert.ok(controle.body.regels.some(r => r.wat === 'rahulAdvies' && r.door));
    assert.equal(JSON.stringify(controle.body).includes('De betaling en factuur'), false,
      'het controlebeeld kopieert geen gesprekstekst');
  } finally { await stop(srv); }
});

test('een meekijksessie is zaakgebonden en ook voor een RTG-account beschikbaar', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  try {
    const token = await lid(p, 'rahulai-scherm@x.nl');
    const open = await p('/api/service/open', { titel: 'De knop in mijn app werkt niet' }, token);
    const id = open.body.zaak.id;
    const mag = await p('/api/service/bel/mijn', { id }, token);
    assert.equal(mag.body.mag.mag, true);
    assert.equal(mag.body.mag.via, 'eigen zaak');

    const sessie = await p('/api/service/bel', { id, ondersteuning: true }, token);
    assert.equal(sessie.status, 200, JSON.stringify(sessie.body));
    assert.equal(sessie.body.gesprek.ondersteuning, true);

    const ander = await lid(p, 'rahulai-ander@x.nl');
    const gluur = await p('/api/service/bel', { id, ondersteuning: true }, ander);
    assert.equal(gluur.status, 404, 'een ander account kon een sessie aan deze zaak hangen');
  } finally { await stop(srv); }
});

test('de schermdeelknop gebruikt browsertoestemming en biedt geen opnamepad', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const motor = fs.readFileSync(path.join(__dirname, '..', 'public/shared/servicebel.js'), 'utf8');
  const lid = fs.readFileSync(path.join(__dirname, '..', 'public/apps/service-bel.js'), 'utf8');
  assert.match(motor, /getDisplayMedia/);
  assert.match(motor, /deelScherm/);
  assert.doesNotMatch(motor + lid, /MediaRecorder|startRecording|opnameStart/);
  assert.match(lid, /RTG neemt het scherm niet op/);
});

test('Work OS probeert het gewone RTG-account voordat een aparte werkruimtesleutel verschijnt', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/apps/werk/app.js'), 'utf8');
  const poort = bron.indexOf('K.viaLid()');
  const alleenExtern = bron.indexOf("$('inlogGa').addEventListener");
  assert.ok(poort > alleenExtern, 'de accountbrug ontbreekt uit de Werk OS-start');
  assert.match(bron, /if \(!gelukt\) return/,
    'de aparte werkruimte-invoer hoort alleen zichtbaar te blijven als de accountbrug niet lukt');
});
