'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard, stopNet, elevateTier } = require('./helper');
const bewijs = require('./operationeel-journaal');
test('de aanvraag gebruikt persoonlijke werkaccounts met testdeuren uit en intrekking werkt onmiddellijk', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvraag-productie-'));
  const env = { RTG_DATA_DIR: tmp, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1' };
  let srv;
  const api = async (pad, body = {}, token) => {
    const r = await fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body) });
    return { http: r.status, ...await r.json() };
  };
  const registreer = naam => api('/api/auth/register', { name: naam, email: naam + '@example.test', password: 'geheim123',
    phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' });
  try {
    // Alleen de lege proefinstallatie krijgt zaaddata. De echte lus loopt na
    // herstart met Magnaat Test en demo uit, via persoonlijke accountbinding.
    srv = await startServer({ env });
    const roster = await api('/api/supplier/roster', { code: 'SERENA' });
    const seed = await api('/api/supplier/login', { code: 'SERENA', staffId: roster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    assert.ok(seed.token);
    await registreer('vrager');
    const eigenaar = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' })).token;
    const beheerder = await registreer('beheerder');
    await elevateTier(srv.base, beheerder.token, 'business', eigenaar);
    const lidBaas = (await api('/api/auth/login', { email: 'beheerder@example.test', password: 'geheim123' })).token;
    assert.equal((await api('/api/partner/apply', { company: 'Proef Beauty', type: 'beautysalon', city: 'Ibiza',
      contactName: 'beheerder', email: 'beheerder@example.test', akkoord: true, bevoegd: true, waarheidsgetrouw: true,
      kvkNummer: '68750110', vestigingsnummer: '000037178598', passToken: lidBaas })).http, 200);
    const aanvraag = (await api('/api/office/state', {}, eigenaar)).state.partnerApplications.find(x => x.company === 'Proef Beauty');
    assert.ok(aanvraag);
    for (const eis of aanvraag.toelating.eisen) {
      assert.equal((await api('/api/office/partner/controle', { id: aanvraag.id, onderdeel: eis.id,
        uitkomst: eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd',
        referentie: 'Uitsluitend lokale testfixture: ' + eis.id }, eigenaar)).http, 200);
    }
    const besluit = await api('/api/office/partner/decide', { id: aanvraag.id, action: 'goedkeuren' }, eigenaar);
    assert.equal(besluit.http, 200); const code = besluit.code; assert.ok(code);
    const setupBaas = (await api('/api/supplier/mijn/login', { login: 'beheerder@example.test', password: 'geheim123' })).token;
    assert.ok(setupBaas);
    const personen = {};
    for (const [naam, role] of [['behandelaar', 'staff']]) {
      assert.ok((await registreer(naam)).token);
      const inv = await api('/api/supplier/staff/invite', { name: naam, role }, setupBaas);
      assert.ok(inv.invite?.kassacode);
      const join = await api('/api/supplier/staff/join', { bedrijf: 'Proef Beauty',
        kassacode: inv.invite.kassacode, login: naam + '@example.test', password: 'geheim123' });
      assert.equal(join.http, 200); personen[naam] = join.staffId;
    }
    await stopNet(srv.child);
    srv = await startServer({ env: { ...env, RTG_MAGNAAT_TEST: '0', RTG_DEMO: '0' } });
    assert.equal((await fetch(srv.base + '/api/health').then(r => r.json())).testomgeving, false);
    assert.equal((await api('/api/supplier/login', { code, staffId: personen.behandelaar, pin: '1234' })).http, 403);
    assert.equal((await api('/api/supplier/mall/aanvragen', {}, seed.token)).http, 401);
    const lid = (await api('/api/auth/login', { email: 'vrager@example.test', password: 'geheim123' })).token;
    const baas = (await api('/api/supplier/mijn/login', { login: 'beheerder@example.test', password: 'geheim123' })).token;
    const medewerker = (await api('/api/supplier/mijn/login', { login: 'behandelaar@example.test', password: 'geheim123' })).token;
    assert.ok(lid && baas && medewerker, 'persoonlijke inlog werkt zonder legacy/testdeuren');
    let a = (await api('/api/mall/aanvraag', { sleutel: 'persoonlijk', wat: 'Behandeling op zaterdag', plek: 'Ibiza', verdieping: 'beauty' }, lid)).aanvraag;
    assert.ok(a?.id);
    const reactie = await api('/api/supplier/mall/aanvraag/reageer', { id: a.id, versie: a.versie, tekst: 'Zaterdag kan' }, medewerker);
    assert.equal(reactie.http, 200, JSON.stringify(reactie)); a = reactie.aanvraag;
    a = (await api('/api/mall/aanvraag/kies', { id: a.id, versie: a.versie, code }, lid)).aanvraag;
    a = (await api('/api/supplier/mall/aanvraag/behandel', { id: a.id, versie: a.versie, actie: 'aanvaard' }, medewerker)).aanvraag;
    assert.equal(a.status, 'in_behandeling');
    assert.equal((await api('/api/supplier/staff/remove', { staffId: personen.behandelaar }, baas)).http, 200);
    const klaar = { id: a.id, versie: a.versie, actie: 'afronden', tekst: 'Antwoord door de actuele behandelaar.' };
    assert.equal((await api('/api/supplier/mall/aanvraag/behandel', klaar, medewerker)).http, 401);
    assert.equal((await api('/api/supplier/mall/aanvragen', {}, medewerker)).http, 401);
    const na = (await api('/api/mall/aanvragen/mijn', {}, lid)).aanvragen[0];
    assert.equal(na.versie, a.versie); assert.equal(na.resultaat, null);
    assert.equal((await api('/api/supplier/mall/aanvraag/behandel', klaar, baas)).aanvraag.status, 'afgerond');
    bewijs('mall-productie', ['AUTHORITY', 'REVOKE'], { grens: 'Persoonlijk RTG-account plus actieve personeelsplek; test- en PIN-deuren uit, oud werkplektoken direct geweigerd na echte personeelsintrekking.' });
  } finally { if (srv) await stopHard(srv.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
