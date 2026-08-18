/* MEEBOUWEN: de twee dingen die een nieuw lid aan het platform zelf bijdraagt,
   elk met een toestemming die ergens op slaat.

   Sinds de demo-inhoud eruit is begint een installatie leeg -- De Salon zonder
   berichten, de catalogus zonder zaken. Dat is de bedoeling, maar dan moet er
   wel een deur zijn waardoor er iets naar binnen kan, en dat is de onboarding.

   WAT DEZE TOETS BEWAAKT, en het is precies het verschil met ./inrichten.js:
   daar staat GEEN vinkje omdat die gegevens het lid nergens verlaten, hier WEL
   omdat deze twee dat echt doen. Een vinkje dat niets doet is een belofte die de
   code niet waarmaakt (LAT-regel 6), dus meten we of hij werkt:

   1. een Salon-bericht zonder toestemming komt NIET in het promobeeld van de
      site en de campagne; met toestemming wel;
   2. een bedrijf komt op naam van het lid te staan, en het antwoord zegt eerlijk
      wat er daarna gebeurt -- nooit dat het geregeld is.
   Draai: npm test -- --bestanden=onboarding-meebouwen */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');

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

test('het aanbod staat er voor wie nog niets heeft, en verdwijnt zodra dat wel zo is', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await versLid(P, 'Lotte');
    const voor = (await P('/api/onboarding/meebouwen', {}, lid)).body;
    assert.equal(voor.klaar, false);
    const ids = voor.open.map(o => o.id);
    assert.deepEqual(ids, ['salon', 'bedrijf'], 'beide staan open, kreeg: ' + ids.join(', '));
    for (const o of voor.open) {
      assert.equal(o.standaard, false, o.id + ': het vinkje staat UIT tot het lid hem aanzet');
      assert.ok(o.toestemming && o.toestemming.length > 30,
        o.id + ' zegt in gewone taal wat er met het vinkje gebeurt: ' + o.toestemming);
    }

    await P('/api/onboarding/salonpost', { tekst: 'Eerste bericht van een echt lid.' }, lid);
    const na = (await P('/api/onboarding/meebouwen', {}, lid)).body;
    assert.deepEqual(na.open.map(o => o.id), ['bedrijf'],
      'wie al geplaatst heeft krijgt die vraag niet nog eens -- dit is een startzet, geen aansporing');
  } finally { child.kill('SIGKILL'); }
});

/* HET VINKJE DOET IETS, EN DIT IS WAT. Het promobeeld ("Uit De Salon") is de
   enige plek waar het bericht van een lid BUITEN De Salon terechtkomt: als beeld
   op de site en in de campagne, met zijn naam eronder. Zonder toestemming hoort
   het daar niet te staan. */
test('een Salon-bericht komt alleen met toestemming in het promobeeld', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    // een piepklein maar geldig PNG, zodat er echt een foto aan de post hangt
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const lid = await versLid(P, 'Mila');
    const r = await P('/api/onboarding/salonpost',
      { tekst: 'Dit mag RTG uitlichten.', media: [PNG], promoMag: true }, lid);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
    const feed = (await P('/api/salon/feed', {}, lid)).body;
    assert.ok((feed.posts || []).some(p => p.text === 'Dit mag RTG uitlichten.'),
      'het bericht staat in De Salon: ' + JSON.stringify(feed).slice(0, 160));
  } finally { child.kill('SIGKILL'); }
});

/* En de REGEL zelf, los gemeten. Het promobeeld is een pure functie op de
   berichten, dus die toetsen we rechtstreeks: dat is de enige manier om ook het
   geval te zien waarin RTG een bericht heeft uitgelicht (`featured`), want dat
   besluit hoort bij RTG en er is geen route waarmee een toets het zet. */
test('het promobeeld gebruikt geen ledenbeeld zonder toestemming', () => {
  const { salonPromoFotos } = require('../server/kern/salonpromo');
  const post = (extra) => Object.assign({ photo: '/media/x' + Math.random().toString(36).slice(2) + '.jpg',
    author: 'Een lid' }, extra);
  const eigen = (db) => salonPromoFotos(db, 60).filter(f => !/^\/campagne\//.test(f.src));

  const zonder = post({ featured: true });                       // uitgelicht, geen toestemming
  const met = post({ featured: true, promoMag: true });          // uitgelicht mét toestemming
  const partner = post({ partner: true, author: 'Een zaak' });   // publiceert commercieel

  assert.deepEqual(eigen({ data: { posts: [zonder] } }), [],
    'een uitgelicht ledenbericht zonder toestemming levert geen promobeeld');
  assert.deepEqual(eigen({ data: { posts: [met] } }).map(f => f.src), [met.photo],
    'met toestemming wel, en met de naam van het lid erbij');
  assert.deepEqual(eigen({ data: { posts: [partner] } }).map(f => f.src), [partner.photo],
    'een partner valt hierbuiten: zijn Salon-pagina IS zijn etalage');
  assert.deepEqual(eigen({ data: { posts: [zonder, met, partner] } }).map(f => f.src),
    [met.photo, partner.photo], 'door elkaar heen blijft de regel dezelfde');
});

test('een bedrijf komt op naam van het lid, en niets wordt geregeld genoemd', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await versLid(P, 'Olivier');
    const r = await P('/api/onboarding/bedrijf', { naam: 'Bakkerij Olivier', catalogus: true }, lid);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
    assert.equal(r.body.onderneming.naam, 'Bakkerij Olivier');

    const mijn = (await P('/api/onderneming/mijn', {}, lid)).body.ondernemingen || [];
    assert.ok(mijn.some(o => o.naam === 'Bakkerij Olivier'), 'het staat op zijn naam');

    /* NOOIT "GEREGELD". Een partnerplek vraagt een Business Pass en een mens die
       beslist; het antwoord hoort dat te zeggen in plaats van het te suggereren. */
    const v = String(r.body.vervolg || '');
    assert.ok(v.length > 20, 'er staat een vervolg bij: ' + v);
    assert.doesNotMatch(v, /\b(geregeld|geplaatst|staat in de catalogus|goedgekeurd)\b/i,
      'het belooft niets: ' + v);
    assert.match(v, /mens beslist|Business Pass/i, 'en zegt waar het echt ligt: ' + v);

    // zonder naam gebeurt er niets, en dat is een nette fout
    const leeg = await P('/api/onboarding/bedrijf', { naam: '' }, lid);
    assert.equal(leeg.status, 400, 'zonder naam geen onderneming');
  } finally { child.kill('SIGKILL'); }
});
