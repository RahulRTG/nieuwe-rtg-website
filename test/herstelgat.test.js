/* Het gat in de herstelroute: dev-velden aan een vreemde.

   WAT ER MIS WAS. /api/auth/forgot geeft zonder SMTP de herstel-link en de
   telefooncode terug in het antwoord, zodat de stroom lokaal en in toetsen te
   doorlopen is. Dat hing aan `!PRODUCTION` -- een vlag die IEMAND moet zetten.
   Op de echte server was NODE_ENV niet gezet en was er geen post ingesteld, en
   die server stond op het open internet. Gevolg: iedereen kon met een POST en
   een willekeurig e-mailadres de herstel-link EN de code ophalen, en daarmee elk
   account overnemen. Nagemeten met een curl van buiten; het werkte.

   De eerste reparatie hing het aan het IP van het verzoek, en die was OOK fout:
   de gateway (server/trio.js) stuurt alles lokaal door, dus de server ziet elk
   verzoek als lokaal. Van buiten gemeten bleef het gat open. Een controle die je
   niet van buitenaf naprikt is een aanname.

   Nu staat het om: alleen met RTG_DEV_LINKS=1 komen de velden mee. Deze toets
   bewaakt precies dat, en wel van beide kanten -- met de vlag horen ze er te
   zijn (anders is de stroom nergens te doorlopen) en zonder de vlag nooit. */
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

test('met RTG_DEV_LINKS aan is de herstelstroom lokaal te doorlopen', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });   // helper zet RTG_DEV_LINKS=1
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Gat Lid', email: 'gatlid@x.nl', phone: '0612345788',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registreren lukte: ' + JSON.stringify(reg.body).slice(0, 140));

    // met de vlag aan: de velden mogen er zijn, anders werkt lokaal niets
    const met = await p('/api/auth/forgot', { email: 'gatlid@x.nl' });
    assert.equal(met.status, 200);
    assert.ok(met.body.devResetUrl, 'met de vlag hoort de link er te zijn, anders is de stroom niet te doorlopen');
  } finally { stop(srv.child); }
});

/* De stand die een echte server heeft: de vlag NIET gezet. Dit is de toets die
   het gat zou hebben gevangen, en die er niet was. */
test('zonder RTG_DEV_LINKS komt er nooit een link of code in een antwoord', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DEV_LINKS: '' } });
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Zonder Vlag', email: 'zondervlag@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registreren lukt gewoon: ' + JSON.stringify(reg.body).slice(0, 140));
    assert.equal(reg.body.devVerifyUrl, undefined, 'de bevestigingslink hoort er niet in te staan');

    const v = await p('/api/auth/forgot', { email: 'zondervlag@x.nl' });
    assert.equal(v.status, 200, 'het antwoord blijft gelijk: geen bestaan lekken');
    assert.equal(v.body.devResetUrl, undefined, 'de herstel-link hoort er niet in te staan');
    assert.equal(v.body.devCode, undefined, 'de telefooncode hoort er niet in te staan');
    assert.ok(!/reset=|devCode/.test(JSON.stringify(v.body)),
      'nergens een sleutel of code: ' + JSON.stringify(v.body).slice(0, 160));
  } finally { stop(srv.child); }
});
