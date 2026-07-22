/* Geld-conservatie onder GELIJKTIJDIGE, ECHTE schrijfpaden. De beproeving zaait
   haar activiteit rechtstreeks in de opslag (snel, maar het toetst geen
   functionele juistheid van de echte betaalroute). Deze test doet het omgekeerde:
   meerdere leden sturen elkaar door elkaar heen ECHTE tikken via /api/pay/stuur,
   allemaal tegelijk, en de invariant is hard -- de som van alle wallets blijft op
   de cent gelijk aan wat er is opgeladen, en geen wallet zakt ooit onder nul (een
   dubbeltelling of een race zou juist daar zichtbaar worden). Draai los:
   node --experimental-sqlite --test test/geld-conservatie-last.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const api = (base, pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('gelijktijdige echte tikken bewaren geld op de cent en zakken nooit onder nul', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-conserv-'));
  const srv = await startServer({ env: { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  try {
    // vijf ECHTE leden (register geeft elk een eigen sleutel; /api/login deelt de
    // sleutel per tier en zou dus maar één wallet opleveren)
    const N = 5, START = 40000;
    const leden = [];
    for (let i = 0; i < N; i++) {
      const uniek = Date.now().toString(36) + i;
      const reg = await api(base, 'auth/register', { name: 'Conserv ' + i, email: 'c' + uniek + '@x.test',
        phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'lid ' + i + ' geregistreerd');
      const ov = await api(base, 'pay/overzicht', {}, reg.body.token);
      leden.push({ token: reg.body.token, codenaam: ov.body.codenaam });
    }
    const codes = new Set(leden.map(l => l.codenaam));
    assert.equal(codes.size, N, 'elk lid heeft een eigen codenaam (' + codes.size + ')');

    // elk lid laadt hetzelfde bedrag: het beginkapitaal dat NOOIT mag veranderen
    for (let i = 0; i < N; i++) {
      const r = await api(base, 'pay/oplaad', { centen: START, idem: 'op-' + i }, leden[i].token);
      assert.equal(r.status, 200, 'opladen lid ' + i);
    }
    const somVan = async () => { let s = 0; for (const l of leden) s += (await api(base, 'pay/overzicht', {}, l.token)).body.saldo || 0; return s; };
    const beginTotaal = await somVan();
    assert.equal(beginTotaal, N * START, 'beginkapitaal klopt: ' + beginTotaal);

    // een storm van tikken kris-kras tussen de leden, ALLEMAAL TEGELIJK de deur uit.
    // Sommige slagen, sommige stuiten op saldo/rate-limit -- dat mag; een mislukte
    // tik verplaatst simpelweg niets. De invariant geldt hoe dan ook.
    let seed = 20260722;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const taken = [];
    for (let i = 0; i < 48; i++) {
      const a = Math.floor(rnd() * N); let b = Math.floor(rnd() * N); if (b === a) b = (b + 1) % N;
      const centen = 100 + Math.floor(rnd() * 2900);
      taken.push(api(base, 'pay/stuur', { aan: leden[b].codenaam, centen, oms: 'storm', idem: 'storm-' + i }, leden[a].token).catch(() => ({ status: 0, body: {} })));
    }
    const uit = await Promise.all(taken);
    const geslaagd = uit.filter(r => r.status === 200 && r.body && r.body.ok && !r.body.herhaald).length;
    assert.ok(geslaagd > 0, 'ten minste een deel van de gelijktijdige tikken is echt geboekt (' + geslaagd + ')');

    // DE INVARIANT: geen cent ontstaan of verdwenen, en niemand onder nul.
    const eindTotaal = await somVan();
    assert.equal(eindTotaal, beginTotaal, 'geld-conservatie over alle gelijktijdige tikken: ' + eindTotaal + ' == ' + beginTotaal);
    for (const l of leden) {
      const s = (await api(base, 'pay/overzicht', {}, l.token)).body.saldo;
      assert.ok(s >= 0, 'wallet ' + l.codenaam + ' zakte niet onder nul (' + s + ') -- geen dubbeluitgave');
    }
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
