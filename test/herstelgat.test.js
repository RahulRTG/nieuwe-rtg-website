/* Het gat in de herstelroute: dev-velden aan een vreemde.

   WAT ER MIS WAS. /api/auth/forgot geeft zonder SMTP de herstel-link en de
   telefooncode terug in het antwoord, zodat de stroom lokaal en in toetsen te
   doorlopen is. Dat hing aan `!PRODUCTION` -- een vlag die IEMAND moet zetten.
   Op de echte server was NODE_ENV niet gezet en was er geen post ingesteld, en
   die server stond op het open internet. Gevolg: iedereen kon met een POST en
   een willekeurig e-mailadres de herstel-link EN de code ophalen, en daarmee elk
   account overnemen. Nagemeten met een curl van buiten; het werkte.

   Een vlag die je moet onthouden is geen slot. Het hangt nu aan het IP van het
   verzoek: alleen deze machine krijgt de velden.

   DEZE TOETS BEWAAKT PRECIES DAT. Hij draait zelf op localhost -- dus hij ziet
   de dev-velden WEL, en dat hoort ook: anders zou hij niets bewijzen over het
   verschil. Het verschil zelf toetsen we door het IP te vervalsen met een
   X-Forwarded-For, want zo komt een verzoek van buiten binnen als er een proxy
   voor staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const post = (base) => async (pad, body, kop) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, kop || {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test('de herstel-link komt nooit terug bij een verzoek dat niet van deze machine komt', async () => {
  // TRUST_PROXY aan: dan telt X-Forwarded-For als het echte adres, precies zoals
  // achter een doorgeefluik in productie
  const srv = await startServer({ env: { SMTP_URL: '', TRUST_PROXY: '1' } });
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Gat Lid', email: 'gatlid@x.nl', phone: '0612345788',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registreren lukte: ' + JSON.stringify(reg.body).slice(0, 140));

    // van deze machine: de velden mogen er zijn, anders werkt lokaal niets
    const eigen = await p('/api/auth/forgot', { email: 'gatlid@x.nl' });
    assert.equal(eigen.status, 200);
    assert.ok(eigen.body.devResetUrl, 'lokaal hoort de link er wel te zijn, anders is de stroom niet te doorlopen');

    // van buiten: geen link, geen code, en verder exact hetzelfde antwoord
    const vreemd = await p('/api/auth/forgot', { email: 'gatlid@x.nl' }, { 'X-Forwarded-For': '203.0.113.9' });
    assert.equal(vreemd.status, 200, 'het antwoord blijft gelijk: geen bestaan lekken');
    assert.equal(vreemd.body.devResetUrl, undefined, 'een vreemde krijgt de herstel-link NIET');
    assert.equal(vreemd.body.devCode, undefined, 'een vreemde krijgt de telefooncode NIET');
    assert.ok(!JSON.stringify(vreemd.body).includes('reset='),
      'er hoort nergens een reset-sleutel in het antwoord te staan: ' + JSON.stringify(vreemd.body).slice(0, 160));
  } finally { stop(srv.child); }
});

test('hetzelfde geldt voor de bevestigingslink bij registreren', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', TRUST_PROXY: '1' } });
  const p = post(srv.base);
  try {
    const vreemd = await p('/api/auth/register', { name: 'Van Buiten', email: 'vanbuiten@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' }, { 'X-Forwarded-For': '203.0.113.9' });
    assert.ok(vreemd.body.token, 'registreren lukt gewoon: ' + JSON.stringify(vreemd.body).slice(0, 140));
    assert.equal(vreemd.body.devVerifyUrl, undefined, 'de bevestigingslink hoort niet naar buiten te gaan');
  } finally { stop(srv.child); }
});
