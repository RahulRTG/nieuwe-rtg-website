/* De demo-stand hoort UIT te staan als niemand erom vraagt.

   WAT ER OPENSTOND, op de echte server, op het open internet:

   1. POST /api/login met {"tier":"business"} gaf ZONDER wachtwoord een volledige
      Business-sessie, op naam van de eigenaar.
   2. De backoffice ging open met de vaste code 'RTG-OFFICE', die letterlijk in
      deze repo staat. Achter die deur ligt de identiteitskluis: echte namen,
      e-mailadressen, paspoortscans.
   3. Bij ELKE serverstart zette de bootstrap het wachtwoord van het
      eigenaarsaccount terug op 'Imran', een waarde uit deze repo. De eigenaar
      kon daardoor niet meer inloggen met zijn eigen wachtwoord -- en iedereen
      die de code gelezen had, kon dat wel.

   Alle drie hingen aan hetzelfde: `NODE_ENV !== 'production'`. Het commentaar
   erboven beloofde dat dit "nooit per ongeluk open op productie" zou staan,
   maar de vlag was nooit gezet, dus stond alles open. Een belofte in een
   commentaar is geen slot.

   Nu staat het om: alleen RTG_DEMO=1 zet de demo-stand aan. Deze toetsen leggen
   de stand vast die een server heeft die NIETS weet -- want dat is de stand die
   op het internet stond. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const post = (base) => async (pad, body) => {
  const r = await fetch(base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/* Een server zonder RTG_DEMO: precies wat er draait als niemand iets instelt. */
async function kaleServer() {
  return startServer({ env: { SMTP_URL: '', RTG_DEMO: '', OFFICE_CODE: '' } });
}

test('zonder RTG_DEMO geeft de demo-inlog geen sessie weg', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    for (const tier of ['business', 'lifestyle', 'rtg']) {
      const r = await p('/api/login', { tier });
      assert.notEqual(r.status, 200,
        'een pas-inlog zonder wachtwoord hoort te weigeren (' + tier + '): ' + JSON.stringify(r.body).slice(0, 140));
      assert.ok(!r.body.token, 'en zeker geen token af te geven');
    }
  } finally { stop(srv.child); }
});

test('zonder RTG_DEMO opent de vaste kantoorcode uit de repo niets', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    const r = await p('/api/office/login', { code: 'RTG-OFFICE' });
    assert.notEqual(r.status, 200,
      'de code die in de broncode staat hoort de backoffice NIET te openen: ' + JSON.stringify(r.body).slice(0, 140));
    assert.ok(!r.body.token, 'en geen kantoorsessie af te geven');
  } finally { stop(srv.child); }
});

test('zonder RTG_DEMO blijft het wachtwoord van de eigenaar van de eigenaar', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    /* Het eigenaarsadres uit server/eigenaar.js, met het demo-wachtwoord uit de
       repo. Lukt dit, dan heeft de opstart-bootstrap het wachtwoord van de
       eigenaar overschreven -- en kan iedereen die deze repo las naar binnen. */
    const r = await p('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'rtg' });
    assert.notEqual(r.status, 200,
      'het demo-wachtwoord uit de repo hoort nergens op te passen: ' + JSON.stringify(r.body).slice(0, 140));
  } finally { stop(srv.child); }
});

/* En de andere kant, want een slot dat altijd dichtzit is ook fout: met de vlag
   aan hoort de demo-stand gewoon te werken, anders kan niemand meer iets tonen. */
test('met RTG_DEMO=1 werkt de demo-stand wel gewoon', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DEMO: '1' } });
  const p = post(srv.base);
  try {
    const r = await p('/api/login', { tier: 'business' });
    assert.equal(r.status, 200, 'met de vlag aan hoort de demo-inlog te werken: ' + JSON.stringify(r.body).slice(0, 140));
    assert.ok(r.body.token, 'en een sessie te geven');
  } finally { stop(srv.child); }
});
