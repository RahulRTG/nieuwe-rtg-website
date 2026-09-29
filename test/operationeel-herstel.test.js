'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, stopNet, stopHard } = require('./helper');
const bewijs = require('./operationeel-journaal');

test('aanvraag: ingetrokken personeel, verloren opslag, harde crash en herstel zonder dubbele gevolgen', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvraag-herstel-'));
  const env = { RTG_DATA_DIR: tmp, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1' };
  let srv, lid;
  const api = async (pad, body = {}, token = lid) => {
    const r = await fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body) });
    return { http: r.status, ...await r.json() };
  };
  const lees = async () => (await api('/api/mall/aanvragen/mijn')).aanvragen[0];
  const start = async (verraad = '') => { srv = await startServer({ env: { ...env, RTG_VERRAAD: verraad } }); };
  try {
    await start();
    lid = (await api('/api/auth/register', { name: 'Herstelproef', email: 'herstel@example.test',
      password: 'geheim123', phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' }, null)).token;
    assert.ok(lid);
    const roster = await api('/api/supplier/roster', { code: 'SERENA' }, null);
    const baas = (await api('/api/supplier/login', { code: 'SERENA',
      staffId: roster.staff.find(s => s.role === 'manager').id, pin: '1234' }, null)).token;
    assert.ok(baas);
    const nieuw = await api('/api/supplier/staff/add', { name: 'Aanvraagbehandelaar', role: 'staff' }, baas);
    assert.equal(nieuw.http, 200); assert.ok(nieuw.staff?.id);
    const medewerker = (await api('/api/supplier/login', { code: 'SERENA', staffId: nieuw.staff.id, pin: nieuw.pin }, null)).token;
    assert.ok(medewerker);
    let a = (await api('/api/mall/aanvraag', { sleutel: 'herstel-1', wat: 'Behandeling op zaterdag', plek: 'Ibiza', verdieping: 'beauty' })).aanvraag;
    assert.ok(a?.id);
    a = (await api('/api/supplier/mall/aanvraag/reageer', { id: a.id, versie: a.versie, tekst: 'Zaterdag kan' }, medewerker)).aanvraag;
    a = (await api('/api/mall/aanvraag/kies', { id: a.id, versie: a.versie, code: 'SERENA' })).aanvraag;
    a = (await api('/api/supplier/mall/aanvraag/behandel', { id: a.id, versie: a.versie, actie: 'aanvaard' }, medewerker)).aanvraag;
    assert.equal(a.status, 'in_behandeling');
    const klaar = { id: a.id, versie: a.versie, actie: 'afronden', tekst: 'Het antwoord is vastgelegd. Neem contact op om een afspraak te maken.' };
    assert.equal((await api('/api/supplier/staff/remove', { staffId: nieuw.staff.id }, baas)).http, 200);
    assert.equal((await api('/api/supplier/mall/aanvraag/behandel', klaar, medewerker)).http, 401,
      'een eerder toegestane schermactie is na uitdiensttreding ongeldig');
    assert.equal((await api('/api/supplier/mall/aanvragen', {}, medewerker)).http, 401);
    assert.equal((await lees()).versie, a.versie);
    bewijs('mall-authority', ['AUTHORITY', 'REVOKE'], { grens: 'Actieve personeelsplek ingetrokken via de echte API in Magnaat Test; productieaccountbinding en installatiebrede policy zijn afzonderlijk vereist.' });
    await stopNet(srv.child);

    for (const verraad of ['schrijf-verloren', 'schrijf-faalt']) {
      await start(verraad);
      const voor = await lees(); assert.equal(voor.status, 'in_behandeling');
      const fout = await api('/api/supplier/mall/aanvraag/behandel', klaar, baas);
      assert.equal(fout.http, 503, verraad + ' mag nooit bevestigen');
      assert.equal(fout.ok, undefined); assert.match(fout.error, /niet vastgelegd/);
      assert.deepEqual(await lees(), voor, 'geen half resultaat, versieverhoging of retry-sleutel na een opslagfout');
      const feed = await api('/api/wereld/feed', { ervaring: 'saloon', bronnen: ['voortgang'], vorm: 'mijn', lens: 'all' });
      assert.equal(feed.http, 200); assert.ok(!feed.items.some(x => x.tekst === klaar.tekst));
      await stopHard(srv.child);
    }
    await start('sterf-na-commit');
    await assert.rejects(api('/api/supplier/mall/aanvraag/behandel', klaar, baas), /fetch failed|terminated/,
      'proces sterft nadat de bron is vastgelegd maar voordat het antwoord aankomt');
    await stopHard(srv.child);
    await start();
    const hersteld = await api('/api/supplier/mall/aanvraag/behandel', klaar, baas);
    assert.equal(hersteld.http, 200); assert.equal(hersteld.aanvraag.status, 'afgerond');
    assert.equal(hersteld.aanvraag.versie, a.versie + 1);
    assert.equal(hersteld.aanvraag.verloop.filter(v => v.actie === 'afronden').length, 1);
    assert.equal((await lees()).resultaat.tekst, klaar.tekst);
    await stopHard(srv.child); await start();
    assert.equal((await lees()).versie, hersteld.aanvraag.versie);
    assert.equal((await api('/api/supplier/mall/aanvraag/behandel', klaar, baas)).aanvraag.versie, hersteld.aanvraag.versie);
    bewijs('mall-route-failure', ['FAILURE', 'RECOVERY'], { grens: 'SQLite: verloren en gooiende schrijfactie op echte route, rollback, leesbare Saloon en herstel.' });
    bewijs('mall-crash', ['STATE', 'REPLAY'], { grens: 'SQLite: SIGKILL na duurzame commit vóór antwoord, retry en tweede SIGKILL. Geen bewijs van hoststroomuitval of PostgreSQL.' });
  } finally { stop(srv?.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
