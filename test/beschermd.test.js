/* Integratietests voor de kinderbescherming in de vriendenlaag: profielen van
   15 of jonger (groepen mini/kind/tiener, of rol kind) zijn onvindbaar en
   onbenaderbaar; alleen een ouder/verzorger voegt contacten voor hen toe.
   Draait tegen een echte server in een tijdelijke datamap.
   Draai los: node --experimental-sqlite --test test/beschermd.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-besch-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function soc(pad, body) { return fetch(BASE + '/api/rtf/social' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// hulp: een gezin met een beheerder en een tiener (13, dus beschermd)
async function gezinMetTiener(naam) {
  const g = await json(await api('/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tiener', rol: 'gezinslid', groep: 'tiener' }));
  const kidToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const conn = await json(await soc('/connections', { code: g.code, token: kidToken }));
  return { g, kidToken, kidHandle: conn.me, kidCodenaam: conn.codename, kidBeschermd: conn.beschermd };
}
// hulp: een volwassen RTG-lid met token en codenaam
async function rtgLid(naam) {
  const reg = await json(await (await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: naam, email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' })
  })));
  const call = (pad, body) => fetch(BASE + '/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify(body || {}) });
  // een keer /state aanroepen: zoals de echte app bij het openen doet; dat zet
  // het lid ook in de codenaamgids (dirTouch), zodat een ouder hem kan vinden
  const st = await json(await call('/state', {}));
  return { token: reg.token, codenaam: st.state.user.codename, call };
}

test('beschermd (t/m 15): onvindbaar, onbenaderbaar en kan zelf niets sturen', async () => {
  const fam = await gezinMetTiener('Schild');
  assert.equal(fam.kidBeschermd, true, 'tiener (12-15) telt als beschermd');
  const lid = await rtgLid('Vreemde Volwassene');

  // 1. het kind is onvindbaar: zoeken op zijn codenaam geeft niets
  const zoek = await json(await lid.call('/member/find', { q: fam.kidCodenaam.slice(0, 10) }));
  assert.ok(!(zoek.results || []).some(r => r.key === fam.kidHandle), 'beschermd profiel verschijnt niet in zoekresultaten');

  // 2. rechtstreeks verbinden op de handle: 404, bestaan wordt niet verklapt
  assert.equal((await lid.call('/member/connect', { key: fam.kidHandle })).status, 404);

  // 3. het kind kan zelf niet zoeken of verzoeken sturen
  assert.equal((await soc('/find', { code: fam.g.code, token: fam.kidToken, q: 'vos' })).status, 403);
  assert.equal((await soc('/connect', { code: fam.g.code, token: fam.kidToken, key: 'user-1' })).status, 403);

  // 4. en niet zelf contacten toevoegen via het ouder-kanaal
  assert.equal((await soc('/oudervoeg', { code: fam.g.code, token: fam.kidToken, kindHandle: fam.kidHandle, codenaam: lid.codenaam })).status, 403);
});

test('de ouder voegt een vriend toe; daarna kan het kind chatten en snappen met die vriend', async () => {
  const fam = await gezinMetTiener('Warm');
  const lid = await rtgLid('Tante Ans');

  // de ouder (beheerder) voegt het RTG-lid toe op exacte codenaam
  const voeg = await json(await soc('/oudervoeg', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle, codenaam: lid.codenaam }));
  assert.ok(voeg.ok, 'oudervoeg lukt');

  // het RTG-lid ziet het verzoek en accepteert
  const conns = await json(await lid.call('/member/connections', {}));
  const verzoek = (conns.requests || []).find(r => r.key === fam.kidHandle);
  assert.ok(verzoek, 'de andere kant ziet het verzoek van het kind (namens de ouder)');
  await lid.call('/member/connect/respond', { key: fam.kidHandle, action: 'accept' });

  // nu zijn ze vrienden: het kind kan chatten...
  const dm = await soc('/dm/send', { code: fam.g.code, token: fam.kidToken, toKey: verzoek ? conns.me || undefined : undefined, text: 'hoi' });
  // (toKey is het lid; conns.me is van het lid zelf, dus stuur expliciet)
  const dm2 = await soc('/dm/send', { code: fam.g.code, token: fam.kidToken, toKey: (await json(await soc('/connections', { code: fam.g.code, token: fam.kidToken }))).connections[0].key, text: 'hoi tante' });
  assert.equal(dm2.status, 200, 'kind kan chatten met de door de ouder toegevoegde vriend');

  // ...en snappen (1x1 pixel-jpeg)
  const foto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const kidConns = await json(await soc('/connections', { code: fam.g.code, token: fam.kidToken }));
  const snap = await soc('/snap/send', { code: fam.g.code, token: fam.kidToken, toKey: kidConns.connections[0].key, foto, tekst: 'kijk' });
  assert.equal(snap.status, 200, 'kind kan snappen met de toegevoegde vriend');
});

test('oudervoeg is alleen voor de beheerder, en 16+ (groep jong) houdt de open laag', async () => {
  const fam = await gezinMetTiener('Grens');
  // een 16+ gezinslid (groep jong) is NIET beschermd: zoeken werkt gewoon
  const jong = await json(await api('/gezin/profiel/maak', { code: fam.g.code, token: fam.g.token, naam: 'Grote Zus', rol: 'gezinslid', groep: 'jong' }));
  const jongToken = (await json(await api('/gezin/profiel/kies', { code: fam.g.code, profielId: jong.profiel.id }))).token;
  const conn = await json(await soc('/connections', { code: fam.g.code, token: jongToken }));
  assert.equal(conn.beschermd, false, '16+ is niet beschermd');
  assert.equal((await soc('/find', { code: fam.g.code, token: jongToken, q: 'ster' })).status, 200, '16+ mag gewoon zoeken');

  // de ouder ziet de tiener (ook zonder rol kind) in het meekijk-lijstje
  const ouderConn = await json(await soc('/connections', { code: fam.g.code, token: fam.g.token }));
  assert.ok((ouderConn.kinderen || []).some(k => k.handle === fam.kidHandle), 'tiener staat onder ouder-meekijk');
  assert.ok(!(ouderConn.kinderen || []).some(k => k.handle === conn.me), '16+ staat er niet onder');
});

test('twee beschermde kinderen: beide ouders moeten meewerken', async () => {
  const famA = await gezinMetTiener('Noord');
  const famB = await gezinMetTiener('Zuid');

  // ouder A voegt het kind van gezin B toe op exacte codenaam
  const voeg = await json(await soc('/oudervoeg', { code: famA.g.code, token: famA.g.token, kindHandle: famA.kidHandle, codenaam: famB.kidCodenaam }));
  assert.ok(voeg.ok);
  assert.equal(voeg.status, 'wacht-op-ouder', 'de ouder van het andere kind moet nog akkoord geven');

  // kind B ziet het verzoek NIET zelf (beschermd), maar ouder B wel in teKeuren
  const kidB = await json(await soc('/connections', { code: famB.g.code, token: famB.kidToken }));
  assert.equal((kidB.requests || []).length, 0, 'het beschermde kind ziet zelf geen verzoeken');
  const ouderB = await json(await soc('/connections', { code: famB.g.code, token: famB.g.token }));
  const tk = (ouderB.teKeuren || []).find(t => t.anderKey === famA.kidHandle);
  assert.ok(tk, 'ouder B ziet het verzoek in de goedkeuringslijst');

  // ouder B keurt goed -> de kinderen zijn verbonden
  await soc('/goedkeuren', { code: famB.g.code, token: famB.g.token, kindHandle: famB.kidHandle, anderKey: famA.kidHandle, akkoord: true });
  const naB = await json(await soc('/connections', { code: famB.g.code, token: famB.kidToken }));
  assert.ok((naB.connections || []).some(c => c.key === famA.kidHandle), 'na dubbel ouderakkoord zijn de kinderen vrienden');
});
