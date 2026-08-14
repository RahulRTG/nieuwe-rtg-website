/* De enterprisegrens van RTG Office.

   Bewijst drie dingen die bij echt samenwerken niet stil fout mogen gaan:
   een oud venster overschrijft nooit een nieuwere versie, goedkeuren blijft
   een menselijke eigenaarsbeslissing, en een wijziging aan een goedgekeurd
   document zet het aantoonbaar terug naar concept.

   Draai los:
   node --experimental-sqlite --test test/office-enterprise.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-enterprise-'));
let srv, base, eigenaar, schrijver, schrijverCode;

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function lid(nr) {
  const u = Date.now() + '-' + nr;
  const r = await api('/api/auth/register', { name: 'Office ' + nr, email: 'office-' + u + '@rtg.test',
    phone: '06' + String(Date.now()).slice(-7) + nr, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' });
  const s = await api('/api/state', {}, r.body.token);
  return { token: r.body.token, code: s.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(1), b = await lid(2);
  eigenaar = a.token; schrijver = b.token; schrijverCode = b.code;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een oud Office-venster overschrijft nooit stil een nieuwere versie', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Directiestuk' }, eigenaar);
  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'bewerken' }, eigenaar);
  const oud = await api('/api/kantoorpakket/open', { id: m.body.id }, schrijver);
  await new Promise(r => setTimeout(r, 4));
  const nieuw = await api('/api/kantoorpakket/bewaar', { id: m.body.id, verwachtGewijzigd: oud.body.gewijzigd,
    inhoud: { tekst: '<p>Besluit van de eigenaar.</p>' } }, eigenaar);
  assert.equal(nieuw.status, 200);

  const conflict = await api('/api/kantoorpakket/bewaar', { id: m.body.id, verwachtGewijzigd: oud.body.gewijzigd,
    inhoud: { tekst: '<p>Oude tekst uit een tweede venster.</p>' } }, schrijver);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'VERSIECONFLICT');
  const open = await api('/api/kantoorpakket/open', { id: m.body.id }, eigenaar);
  assert.match(open.body.inhoud.tekst, /Besluit van de eigenaar/);
});

test('beoordelen en goedkeuren volgen menselijke bevoegdheid', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Bestuursmemo' }, eigenaar);
  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'bewerken' }, eigenaar);

  assert.equal((await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'beoordeling' }, schrijver)).status, 200,
    'een meeschrijver mag beoordeling vragen');
  assert.equal((await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'goedgekeurd', mens: true }, schrijver)).status, 403,
    'een meeschrijver keurt niet goed');
  assert.equal((await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'goedgekeurd' }, eigenaar)).status, 409,
    'zonder menselijke bevestiging geen goedkeuring');
  assert.equal((await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'goedgekeurd', mens: true, bron: 'ai' }, eigenaar)).status, 403,
    'AI bedient deze deur nooit');

  const goed = await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'goedgekeurd', mens: true }, eigenaar);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.fase, 'goedgekeurd');
});

test('bewerken na goedkeuring heropent het stuk en laat een auditspoor', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Go-livebesluit' }, eigenaar);
  await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'beoordeling' }, eigenaar);
  await api('/api/kantoorpakket/fase', { id: m.body.id, naar: 'goedgekeurd', mens: true }, eigenaar);
  const voor = await api('/api/kantoorpakket/open', { id: m.body.id }, eigenaar);
  await new Promise(r => setTimeout(r, 4));
  const wijzig = await api('/api/kantoorpakket/bewaar', { id: m.body.id, verwachtGewijzigd: voor.body.gewijzigd,
    inhoud: { tekst: '<p>Een materiële wijziging.</p>' } }, eigenaar);
  assert.equal(wijzig.status, 200);
  assert.equal(wijzig.body.fase, 'concept');

  const na = await api('/api/kantoorpakket/open', { id: m.body.id }, eigenaar);
  assert.equal(na.body.werkstroom.fase, 'concept');
  assert.ok(na.body.werkstroom.audit.some(a => a.actie === 'status-teruggezet' && a.van === 'goedgekeurd'));
  assert.ok(na.body.werkstroom.audit.every(a => !('inhoud' in a)), 'audit bevat nooit documentinhoud');
});

test('opmerkingen zijn echte acties met anker, deadline en bevoegdheden', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Exploitatiemodel' }, eigenaar);
  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'bewerken' }, eigenaar);
  const nieuw = await api('/api/kantoorpakket/opmerking', { id: m.body.id, actie: 'nieuw',
    tekst: 'Controleer de aanname voor het hoogseizoen.', anker: 'Cel B4',
    actiehouder: schrijverCode, voor: '2026-09-01' }, eigenaar);
  assert.equal(nieuw.status, 200);
  assert.equal(nieuw.body.openActies, 1);

  const samen = await api('/api/kantoorpakket/samen', { id: m.body.id }, schrijver);
  assert.equal(samen.status, 200);
  assert.equal(samen.body.opmerkingen[0].anker, 'Cel B4');
  assert.equal(samen.body.opmerkingen[0].voor, '2026-09-01');
  assert.equal(samen.body.opmerkingen[0].magBeheren, true, 'een meeschrijver mag een actie oplossen');
  const klaar = await api('/api/kantoorpakket/opmerking', { id: m.body.id, actie: 'oplos',
    opmerking: samen.body.opmerkingen[0].id }, schrijver);
  assert.equal(klaar.status, 200);
  assert.equal(klaar.body.openActies, 0);

  const open = await api('/api/kantoorpakket/open', { id: m.body.id }, eigenaar);
  assert.ok(open.body.werkstroom.audit.some(a => a.actie === 'opmerking-opgelost'));
  assert.ok(open.body.werkstroom.audit.every(a => !('tekst' in a)), 'opmerkingstekst belandt niet in het auditspoor');
});

test('classificatie en bewaartermijn hebben afdwingbare gevolgen', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Overnamedossier' }, eigenaar);
  const b = await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'vertrouwelijk',
    bewaartermijn: '7jaar', herzienOp: '2026-12-15', tags: ['bestuur', 'overnames', 'bestuur'] }, eigenaar);
  assert.equal(b.status, 200);
  assert.deepEqual(b.body.beheer.tags, ['bestuur', 'overnames'], 'tags zijn begrensd en uniek');
  assert.equal((await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'strikt' }, schrijver)).status, 403);

  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'lezen' }, eigenaar);
  assert.equal((await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'strikt' }, eigenaar)).status, 409,
    'bestaande toegang wordt nooit stil weggehaald');
  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, aan: false }, eigenaar);
  assert.equal((await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'strikt',
    bewaartermijn: 'permanent' }, eigenaar)).status, 200);
  assert.equal((await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'lezen' }, eigenaar)).status, 409,
    'een strikt document kan niet opnieuw worden gedeeld');

  const lijst = await api('/api/kantoorpakket/mijn', {}, eigenaar);
  const kop = lijst.body.docs.find(d => d.id === m.body.id);
  assert.equal(kop.classificatie, 'strikt');
  assert.equal(kop.herzienOp, '2026-12-15');
  assert.deepEqual(kop.tags, ['bestuur', 'overnames']);
});

test('live aanwezigheid toont typen zonder blijvend personeelslogboek', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'presentatie', titel: 'Board update' }, eigenaar);
  await api('/api/kantoorpakket/deel', { id: m.body.id, codenaam: schrijverCode, rechten: 'bewerken' }, eigenaar);
  const a = await api('/api/kantoorpakket/aanwezig', { id: m.body.id, client: 'venster-a', stand: 'typt' }, eigenaar);
  assert.equal(a.status, 200);
  const b = await api('/api/kantoorpakket/aanwezig', { id: m.body.id, client: 'venster-b', stand: 'bekijkt' }, schrijver);
  assert.equal(b.status, 200);
  assert.equal(b.body.aanwezig.length, 2);
  assert.ok(b.body.aanwezig.some(p => p.stand === 'typt'));
  assert.ok(b.body.aanwezig.every(p => !('key' in p) && !('client' in p)), 'interne sleutels verlaten de server niet');
});
