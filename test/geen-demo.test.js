/* ZONDER RTG_DEMO STAAT ER NIETS VERZONNENS.

   De demo-INLOG stond al op "uit tenzij je hem aanzet" (server.js, `const
   DEMO`), met de conclusie erbij: een slot dat opengaat als iemand iets vergeet
   is geen slot. De DEMO-INHOUD volgde die regel niet. De seed keek naar
   `NODE_ENV !== 'production' || RTG_DEMO === '1'` -- woordelijk de afgekeurde
   regel -- en zes wereldmodules zaaiden hun instelling helemaal zonder vraag.

   Gevolg op een echte server die geen NODE_ENV had gezet, en dat is het gewone
   geval: zes voorbeeldposts in De Salon met naam en al, drie fictieve reizen,
   twee partnerkanalen, een Living Lab, uitgegeven muziek, en zes verzonnen
   instellingen (Gemeente Eivissa, RTG Airport, Ibiza Transit, FC RTG, de
   Rijksoverheid, een marechausseebrigade). Plus drie belastingaanslagen op naam
   van elk lid dat zijn belastingen opende, van een gemeente die niet bestaat.

   Deze toets start een server ZONDER RTG_DEMO en kijkt naar wat een echt lid
   werkelijk terugkrijgt -- niet naar de bron. Zakt hij, dan staat er weer iets
   op het scherm dat niemand heeft gemaakt.

   De tegenproef staat eronder: mét RTG_DEMO is de demo er gewoon nog. "Alles
   weg" mag geen "de demo bestaat niet meer" worden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function lidOp(base) {
  const P = post(base);
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: 'Kijker', email: 'kijker' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, 'het lid is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return { P, token: r.body.token };
}

test('zonder RTG_DEMO staat er geen verzonnen inhoud op het platform', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geendemo-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '' } });
  try {
    const { P, token } = await lidOp(srv.base);

    // 1. De Salon: geen voorbeeldposts van verzonnen leden
    const st = (await P('/api/state', {}, token)).body.state;
    assert.deepEqual(st.posts, [], 'De Salon begint leeg: ' +
      JSON.stringify((st.posts || []).map(p => p.author)));
    assert.equal(st.creatorLikes, 0, 'en niemand heeft geërfde likes');

    /* 2. De catalogus: geen demozaken en geen verzonnen instellingen.

       EERST DE WERELDEN AANRAKEN. Die instellingen worden LUI gezaaid: pas als
       iemand de OV-, gemeente- of luchthaven-app opent. De opruiming van
       kern/initdata/index.js draait één keer bij het opstarten, dus wie daarna
       zaait ontsnapt eraan. Meten we de catalogus vóór dat eerste bezoek, dan
       meet deze toets niets -- en juist dat gat is hier gerepareerd (de zaai
       zelf vraagt nu of de demo aanstaat, kern/demostand.js). */
    for (const wek of ['/api/ov/kaart', '/api/gemeente/bekendmakingen', '/api/gemeente/afval'])
      await P(wek, {}, token);
    const zaken = (await P('/api/suppliers', {}, token)).body.suppliers || [];
    assert.deepEqual(zaken.map(s => s.code), [],
      'de ledencatalogus begint leeg, kreeg: ' + zaken.map(s => s.code).join(', '));

    // 3. het reisbureau: geen fictieve reizen om aan te vragen
    const reizen = (await P('/api/reisbureau', {}, token)).body.reizen || [];
    assert.deepEqual(reizen, [], 'geen verzonnen reizen in de catalogus');

    /* 4. En de scherpste: een verzonnen REKENING van de overheid. Elk lid dat
       zijn gemeentebelastingen opende kreeg er drie, met bedrag en openstaand
       saldo, van een gemeente die niet bestaat. */
    const aanslagen = (await P('/api/gemeente/belasting/mijn', {}, token)).body.aanslagen || [];
    assert.deepEqual(aanslagen, [], 'geen verzonnen aanslagen op naam van dit lid: ' +
      JSON.stringify(aanslagen).slice(0, 160));

    /* 5. De afvalkalender rekende zonder gemeente een volledige ophaalkalender
       uit. Wie zijn container op zo'n datum buiten zet, staat er alleen. */
    const afval = (await P('/api/gemeente/afval', {}, token)).body;
    assert.deepEqual(afval.fracties, {}, 'geen verzonnen ophaaldata');
    assert.match(String(afval.reden || ''), /geen gemeente/i, 'en het zegt waarom: ' + afval.reden);

    // 6. en de balie van die gemeente staat niet "open"
    const balie = (await P('/api/gemeente/burgerzaken', {}, token)).body;
    assert.equal(balie.open, false, 'een balie zonder gemeente is niet open');

    /* 7. En de werelden zelf tonen niets van die instellingen. De catalogus
       hierboven filtert op een compleet Salon-profiel en ziet ze daarom niet
       allemaal; deze schermen wel. Zonder vervoerder rijdt er geen lijn, en
       zonder gemeente staat er geen bekendmaking over een boulevard. */
    const ovKaart = (await P('/api/ov/kaart', {}, token)).body;
    assert.deepEqual(ovKaart.lijnen, [], 'geen verzonnen OV-lijnen: ' +
      JSON.stringify((ovKaart.lijnen || []).map(l => l.naam)));
    const bekend = (await P('/api/gemeente/bekendmakingen', {}, token)).body.bekendmakingen || [];
    assert.deepEqual(bekend, [], 'geen verzonnen bekendmakingen: ' +
      JSON.stringify(bekend.map(b => b.titel)));

    /* 8. Geen enkele wereld valt om zonder zijn demo-instelling: een leeg
       antwoord is goed, een 500 is dat niet. */
    for (const pad of ['/api/ov/kaart', '/api/ov/mijn', '/api/mob/plekken', '/api/mob/aanbod',
      '/api/gemeente/bekendmakingen', '/api/gemeente/meldingen/mijn']) {
      const r = await P(pad, {}, token);
      assert.ok(r.status < 500, pad + ' geeft een net antwoord in plaats van een fout: ' + r.status);
    }
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

test('met RTG_DEMO=1 staat de demo er gewoon nog', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-weldemo-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const { P, token } = await lidOp(srv.base);
    const st = (await P('/api/state', {}, token)).body.state;
    assert.ok((st.posts || []).length >= 3, 'De Salon toont de demo-posts: ' + (st.posts || []).length);
    const zaken = (await P('/api/suppliers', {}, token)).body.suppliers || [];
    assert.ok(zaken.length >= 5, 'en de demozaken staan er: ' + zaken.length);
    assert.ok(zaken.some(s => s.code === 'TRANSIT'), 'inclusief de verzonnen instellingen');
    const reizen = (await P('/api/reisbureau', {}, token)).body.reizen || [];
    assert.ok(reizen.length >= 1, 'en het reisbureau heeft reizen om te tonen');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
