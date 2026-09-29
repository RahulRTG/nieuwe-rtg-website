'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, stopNet } = require('./helper');
const bewijs = require('./operationeel-journaal');

test('aanvraag gaat via twee bevoegde werkplekken terug naar Saloon, ook zonder optionele diensten', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-operationeel-'));
  const env = { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1',
    ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OLLAMA_URL: '', RTG_AI_LOCAL_URL: '' };
  let srv, lid, zaak;
  const api = async (pad, body = {}, token = lid) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body) });
    return { http: r.status, ...await r.json() };
  };
  const feed = (token = lid, vorm = 'mijn') => api('/api/wereld/feed', { ervaring: 'saloon', bronnen: ['voortgang'], vorm, lens: 'all' }, token);
  const login = async code => {
    const r = await api('/api/supplier/roster', { code }, null);
    return (await api('/api/supplier/login', { code, staffId: r.staff.find(x => x.role === 'manager').id, pin: '1234' }, null)).token;
  };
  try {
    srv = await startServer({ env });
    const registreer = async n => (await api('/api/auth/register', { name: 'Proef ' + n, email: 'operationeel' + n + '@example.test',
      password: 'geheim123', phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' }, null)).token;
    lid = await registreer(1); const ander = await registreer(2); zaak = await login('SERENA');
    assert.ok(lid && ander && zaak);
    const invoer = { sleutel: 'aanvraag-1', wat: 'Behandeling op zaterdag', plek: 'Ibiza', verdieping: 'beauty' };
    assert.equal((await api('/api/mall/aanvraag', invoer, null)).http, 401);
    let a = (await api('/api/mall/aanvraag', invoer)).aanvraag; assert.ok(a?.id);
    assert.equal((await api('/api/mall/aanvraag', invoer)).aanvraag.id, a.id);
    assert.equal((await api('/api/mall/aanvraag/sluit', { id: a.id, versie: a.versie }, ander)).http, 404);
    assert.equal((await api('/api/mall/aanvragen/mijn', {}, zaak)).http, 401);
    assert.ok(!(await api('/api/wereld/state')).saloon.voorkeuren.bronnen.includes('voortgang'));
    assert.equal((await feed(ander)).items.length, 0);
    const wachtrij = (await api('/api/supplier/mall/aanvragen', {}, zaak)).aanvragen;
    assert.ok(wachtrij.some(x => x.id === a.id));
    a = (await api('/api/supplier/mall/aanvraag/reageer', { id: a.id, versie: a.versie, tekst: 'Zaterdag om 14 uur', prijs: 90 }, zaak)).aanvraag;
    assert.ok(a); const aandacht = (await feed(lid, 'actie')).items.find(x => x.id === 'voortgang:' + a.id);
    assert.ok(aandacht); assert.equal(aandacht.bronActies.some(x => x.id === 'kies'), true);
    assert.equal(aandacht.provenance.source_version, a.versie);
    const kies = { id: a.id, versie: a.versie, code: 'SERENA' };
    a = (await api('/api/mall/aanvraag/kies', kies)).aanvraag;
    assert.equal(a.status, 'gegund');
    assert.equal((await api('/api/mall/aanvraag/kies', kies)).aanvraag.versie, a.versie);
    const ontvangen = (await api('/api/supplier/mall/aanvragen', {}, zaak)).aanvragen.find(x => x.id === a.id);
    assert.equal(ontvangen.status, 'gegund', 'gekozen aanvraag blijft bij de eigenaar');
    assert.equal(ontvangen.acties.some(x => x.id === 'aanvaard'), true);
    a = (await api('/api/supplier/mall/aanvraag/behandel', { id: a.id, versie: a.versie, actie: 'aanvaard' }, zaak)).aanvraag;
    const afronden = { id: a.id, versie: a.versie, actie: 'afronden', tekst: 'Wij kunnen zaterdag om 14 uur helpen. Maak de afspraak rechtstreeks met ons.' };
    a = (await api('/api/supplier/mall/aanvraag/behandel', afronden, zaak)).aanvraag;
    assert.equal(a.status, 'afgerond'); assert.equal(a.resultaat.tekst, afronden.tekst);
    const resultaat = (await feed()).items.find(x => x.id === 'voortgang:' + a.id);
    assert.equal(resultaat.tekst, afronden.tekst); assert.notEqual(resultaat.versie, aandacht.versie);
    assert.equal((await feed(lid, 'wereld')).items.length, 0);
    assert.equal((await api('/api/supplier/mall/aanvraag/behandel', afronden, zaak)).aanvraag.versie, a.versie);
    // Echte herstart met dezelfde opslag. Dit bewijst een nette herstart, geen stroomuitval.
    await stopNet(srv.child); srv = await startServer({ env });
    lid = (await api('/api/auth/login', { email: 'operationeel1@example.test', password: 'geheim123' }, null)).token;
    assert.ok(lid);
    const terug = (await api('/api/mall/aanvragen/mijn')).aanvragen.find(x => x.id === a.id);
    assert.deepEqual(terug.resultaat, a.resultaat); assert.equal(terug.versie, a.versie);
    assert.equal((await feed()).items[0].bronversie, a.versie);
    a = (await api('/api/mall/aanvraag/heropen', { id: a.id, versie: a.versie })).aanvraag;
    assert.equal(a.status, 'open'); assert.equal(a.reacties[0].ingetrokken, true);
    assert.equal((await api('/api/mall/aanvraag/kies', kies)).http, 409);
    a = (await api('/api/mall/aanvraag/wijzig', { ...invoer, id: a.id, versie: a.versie, wat: 'Behandeling op zondag' })).aanvraag;
    assert.equal(a.wat, 'Behandeling op zondag');
    assert.equal((await feed()).items[0].titel, a.wat);
    a = (await api('/api/mall/aanvraag/sluit', { id: a.id, versie: a.versie })).aanvraag;
    assert.equal(a.status, 'gesloten');
    assert.equal((await fetch(srv.base + '/api/push/key').then(r => r.json())).key, null);
    assert.equal((await api('/api/pay/stuur', { centen: 100 })).code, 'betalingen-uit');
    bewijs('mall-api', ['ENTRY', 'AUTHORITY', 'HANDOFF', 'DECISION', 'STATE', 'RESULT', 'RETURN', 'RECALL', 'CHANGE', 'REVOKE', 'REPLAY', 'DEGRADED', 'PROOF'],
      { modi: ['PAYMENTS OFF', 'AI OFF', 'PUSH OFF'], grens: 'API + nette herstart; geen bewijs van harde opslaguitval, ingetrokken personeelsrol of alle schermacties.' });

    const horeca = await login('KIKUNOI');
    const h = (pad, body) => api('/api/supplier/horeca' + pad, body, horeca);
    const e = (await h('/event/offerte', { naam: 'Operationele proef', gasten: 2, posten: [{ omschrijving: 'Diner', aantal: 2, prijs: 30 }] })).event;
    assert.ok(e?.id);
    assert.equal((await h('/event/akkoord', { eventId: e.id, door: 'Proefpersoon', kanaal: 'mail' })).event.status, 'bevestigd');
    assert.equal((await h('/event/aanbetaling', { eventId: e.id, bedrag: 20 })).code, 'betalingen-uit');
    assert.equal((await h('/bon/maak', { centen: 1000 })).code, 'betalingen-uit');
    const bon = { clientId: 'offline-1', soort: 'opgenomen', regels: [{ naam: 'Soep', centen: 600 }], betaald: false };
    const mixed = await h('/offline/sync', { bonnen: [bon, { ...bon, clientId: 'betaald', soort: 'verkocht', betaald: true }] });
    assert.equal(mixed.code, 'betalingen-uit');
    const doorgaan = await h('/offline/sync', { bonnen: [bon] });
    assert.equal(doorgaan.nieuw, 1, 'geweigerde batch had geen gedeeltelijke schrijfactie');
    assert.equal((await h('/offline/sync', { bonnen: [bon] })).dubbel, 1);
    bewijs('betaalstop-api', ['DEGRADED', 'FAILURE', 'RECOVERY', 'REPLAY'], { grens: 'Drie horeca-geldpaden en onbetaalde offline invoer; geen volledige horeca-keten.' });
  } finally { stop(srv?.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
