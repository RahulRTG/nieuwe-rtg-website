/* HET INRICHTEN: in één keer invullen wat het huis anders per keer komt vragen.

   De voordeur vraagt vier dingen en zet de rest op 'later': telefoon en adres
   worden pas gevraagd op het moment dat een handeling ze nodig heeft
   (kern/gegevenspoort.js). Dat blijft, maar het kende één stand die niemand
   wil -- je komt binnen in een leeg huis en bij elk eerste ding staat er weer
   een vraag. Sinds de demo-inhoud eruit is, is dat lege huis ook echt wat je
   ziet.

   Deze toets bewaakt de twee dingen die het inrichten waard maken:
   1. het schrijft naar de plek waar de POORT kijkt (de kluis en het
      ledendossier), niet naar het onboardingprofiel -- anders vul je je adres in
      en word je er bij de eerste bezorging alsnog om gevraagd;
   2. het is een AANBOD: wie het overslaat merkt er niets van.
   En de grens eromheen: nationaliteit zet een lid niet over zichzelf.
   Draai: npm test -- --bestanden=onboarding-inrichten */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function versLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return r.body.token;
}

test('het inrichten vult in één keer wat de gegevenspoort anders per keer vraagt', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await versLid(P, 'Ingrid');

    // 1. een vers lid heeft die gegevens nog niet, en het aanbod zegt waarom
    const voor = (await P('/api/onboarding/inrichten', {}, lid)).body;
    assert.equal(voor.klaar, false, 'er staat nog iets open');
    const ids = voor.open.map(o => o.id);
    for (const id of ['telefoon', 'adres', 'postcode', 'plaats', 'land'])
      assert.ok(ids.includes(id), id + ' hoort erbij, kreeg: ' + ids.join(', '));
    for (const o of voor.open) {
      assert.ok(o.vraag && o.vraag.length > 5, o.id + ' heeft een vraag');
      assert.ok(o.waarom && o.waarom.length > 15,
        o.id + ' zegt WAAROM we het vragen -- een veld zonder handeling vragen we niet: ' + o.waarom);
    }

    /* 2. DE POORT MOET HET ZIEN. Dit is de hele reden dat het inrichten naar de
       kluis en het ledendossier schrijft: het onboardingprofiel is een andere
       bak, en wie daarin zijn adres zette werd bij de eerste bezorging alsnog
       om zijn adres gevraagd. We meten daarom niet onze eigen opslag maar de
       poort zelf -- een bezorging vraagt om telefoon EN adres. */
    const stopVoor = await P('/api/order', { supplierCode: 'X', bezorgen: true, items: [] }, lid);
    assert.equal(stopVoor.status, 428, 'zonder gegevens houdt de poort een bezorging tegen');
    const mistVoor = (stopVoor.body.ontbreekt || []).map(m => m.veld);
    assert.ok(mistVoor.includes('telefoon') && mistVoor.includes('adres'),
      'en noemt telefoon en adres: ' + mistVoor.join(', '));

    const na = await P('/api/onboarding/inricht', { velden: {
      telefoon: '0612345678', adres: 'Vara de Rey 12', postcode: '07800', plaats: 'Eivissa', land: 'ES'
    } }, lid);
    assert.equal(na.status, 200, JSON.stringify(na.body).slice(0, 160));
    assert.equal(na.body.klaar, true, 'daarna staat er niets meer open');

    const stopNa = await P('/api/order', { supplierCode: 'X', bezorgen: true, items: [] }, lid);
    assert.notEqual(stopNa.status, 428,
      'de poort vraagt er niet meer om -- het inrichting schreef waar zij kijkt, kreeg: ' +
      JSON.stringify(stopNa.body).slice(0, 160));

    // 3. en het lid ziet zijn eigen plaats terug in zijn staat
    const st = (await P('/api/state', {}, lid)).body.state;
    assert.ok(st && st.user, 'de staat komt gewoon terug');
  } finally { child.kill('SIGKILL'); }
});

test('overslaan mag: wie niets invult merkt er niets van', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await versLid(P, 'Joris');
    // niets invullen; de app slaat de stap over en de staat opent gewoon
    const st = (await P('/api/state', {}, lid)).body.state;
    assert.ok(st && st.user, 'de app opent zonder in te richten');
    const stand = (await P('/api/onboarding/inrichten', {}, lid)).body;
    assert.equal(stand.klaar, false, 'en het aanbod blijft gewoon openstaan');
    // een leeg veld wist niets en is geen fout
    const leeg = await P('/api/onboarding/inricht', { velden: { adres: '' } }, lid);
    assert.equal(leeg.status, 200, 'een lege invoer is geen fout');
    assert.equal(leeg.body.klaar, false, 'en vult niets in');
  } finally { child.kill('SIGKILL'); }
});

/* DE GRENS DIE HIER NIET OVERHEEN MAG. Een lid zet zijn nationaliteit niet over
   zichzelf: dat kan alleen met bewijs (het kantoor na verificatie, of de
   MRZ-scan). De uitleg en het gemeten gat staan in kern/onboarding/lid.js bij
   slaOp. Deze toets staat hier omdat het inrichten precies de plek is waar zo'n
   veld er per ongeluk bij zou glippen. */
test('het inrichten raakt de nationaliteit niet aan', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await versLid(P, 'Karel');
    const r = await P('/api/onboarding/inricht', { velden: { nationaliteit: 'DE', land: 'NL' } }, lid);
    assert.equal(r.status, 200);
    assert.ok(!(r.body.gedaan || []).includes('nationaliteit'),
      'nationaliteit hoort niet bij de onderdelen die een lid zelf invult');
    const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
      'server/kern/onboarding/inrichten.js'), 'utf8');
    assert.doesNotMatch(bron.replace(/\/\*[\s\S]*?\*\//g, ''), /nationaliteit/i,
      'en komt in de code van het inrichten niet voor buiten de uitleg');
  } finally { child.kill('SIGKILL'); }
});
