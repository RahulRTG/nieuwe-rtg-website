/* Elke LibraryOS-route, letterlijk en tegen een echte server (#502).

   De gedragstoetsen (library-http.test.js en de fixtures in test/lib/) roepen
   de routes aan via een samengesteld pad. Dat bewijst de stromen, maar laat
   de vraag open of ELKE geregistreerde route achter de ledendeur zit en een
   nette weigering geeft in plaats van een 404 of een crash. Deze toets stelt
   die vraag per route, en houdt zijn lijst tegen server/routes/library.js:
   een route die erbij komt zonder dat hij hier staat, laat hem zakken. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('./helper');

const ROUTES = [
  '/api/library/work/create', '/api/library/context', '/api/library/work/list',
  '/api/library/work/get', '/api/library/revision/add', '/api/library/structure/reorder',
  '/api/library/contribution/invite', '/api/library/contribution/accept', '/api/library/agreement/propose',
  '/api/library/agreement/accept', '/api/library/agreement/conflict', '/api/library/rights/grant',
  '/api/library/rights/revoke', '/api/library/edition/create', '/api/library/edition/freeze',
  '/api/library/edition/get', '/api/library/edition/withdraw', '/api/library/edition/warn',
  '/api/library/publication/preview', '/api/library/publication/consent', '/api/library/publication/revoke-consent',
  '/api/library/publication/confirm', '/api/library/studio/workspace', '/api/library/feedback/create',
  '/api/library/feedback/list', '/api/library/feedback/decide', '/api/library/feedback/resolve',
  '/api/library/education/release', '/api/library/education/withdraw', '/api/library/education/get',
  '/api/library/reader/open', '/api/library/reader/state', '/api/library/reader/proof',
  '/api/library/reader/search', '/api/library/reader/progress', '/api/library/reader/bookmark',
  '/api/library/reader/bookmark/remove', '/api/library/reader/highlight', '/api/library/reader/highlight/remove',
  '/api/library/reader/note', '/api/library/reader/note/remove', '/api/library/proof'
];

test('de lijst is precies de routes die server/routes/library.js registreert', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'library.js'), 'utf8');
  const geregistreerd = [...bron.matchAll(/app\.post\('([^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual([...ROUTES].sort(), geregistreerd);
});

test('elke LibraryOS-route: zonder sessie dicht, met een ledensessie bereikbaar en zonder crash', async () => {
  const srv = await h.startServer({ env: { RTG_STORE: 'sqlite', SMTP_URL: '', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1' } });
  try {
    const reg = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Library Route', email: 'library-route@example.test', phone: '0612345678',
        password: 'VeiligWachtwoord123!', geboortedatum: '1990-01-01', tier: 'rtg' }) });
    const token = (await reg.json()).token;
    assert.ok(token, 'een ledensessie');
    const post = (pad, tok) => fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}), body: '{}' })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    /* Een onbekende route geeft de algemene 404 zonder `code`; een weigering van
       LibraryOS zelf (een werk dat niet bestaat) draagt er altijd een. */
    assert.equal((await post('/api/library/bestaat-niet', token)).body.code, undefined, 'de ijking: een onbekende route draagt geen code');
    for (const pad of ROUTES) {
      assert.equal((await post(pad)).status, 401, pad + ': zonder sessie hoort de deur dicht te zijn');
      const r = await post(pad, token);
      assert.ok(r.status < 500, pad + ': met een ledensessie gaf de route ' + r.status);
      if (r.status >= 400) assert.ok(r.body.code, pad + ': een weigering zonder code is geen LibraryOS-antwoord (' + r.status + ')');
    }
  } finally { await h.stop(srv.child); }
});
