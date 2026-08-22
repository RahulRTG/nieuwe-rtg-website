/* ============================================================================
   RTG CONCERN: DE DEUR.

   test/concern.test.js toetst de kern zonder server. Dit bestand toetst de weg
   ernaartoe, en dat is een andere vraag: draaien de routes mee, laat de
   DOMEINGRENS alle kern-namen door die dit domein noemt, en -- het belangrijkst
   -- houdt de eigendomscontrole stand als iemand een id uit het lichaam
   meestuurt dat niet van hem is.

   DIE LAATSTE IS DE REDEN DAT DIT BESTAAT. In routes/member/onderneming.js is
   die controle een keer vergeten en lekte het hele Ondernemers-OS erdoorheen:
   elk ingelogd lid kon codes opvragen, koppelde er een aan zijn eigen
   onderneming, en las daarna het klantenboek, de debiteuren en de kas van een
   ander. Deze toets zorgt dat die fout in deze laag niet opnieuw wordt gemaakt.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, postJson } = require('./helper');

/* Eigen post-hulpje met de STATUS erbij: postJson() uit de helper geeft alleen
   het lichaam terug, en juist de code is hier de bewering (404 voor een vreemde,
   400 voor een feit zonder bron). Dezelfde vorm als test/onderneming-routes.js. */
async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function metServer(doe) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concern-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try { await doe(srv.base); } finally { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); }
}

/* Een lid aanmaken en zijn token teruggeven. De registratieweg van dit huis:
   een gratis account is genoeg om een entiteit te beginnen -- dat is de belofte
   uit CONCERN.md dat nadenken over een bedrijf geen pas kost. */
async function lid(base, n) {
  const t = Date.now() + n;
  const r = await post(base, '/api/auth/register', { name: 'Concern ' + n,
    email: 'con' + t + '@e.test', phone: '06' + String(t).slice(-8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  assert.ok(r.body.token, 'registratie geeft een token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test('de concern-routes draaien mee en komen door de domeingrens', async () => {
  await metServer(async (base) => {
    const t = await lid(base, 1);

    /* Als de domeingrens een naam tegenhoudt, gooit hij met de naam erin -- dan
       is dit een 500 en zegt de fout precies welke naam ontbreekt in
       GRENZEN.json. Daarom is deze eerste aanroep de goedkoopste bewaking van
       de hele bedrading. */
    const leeg = await post(base, '/api/concern/overzicht', {}, t);
    assert.equal(leeg.status, 200, 'overzicht faalde: ' + JSON.stringify(leeg.body));
    assert.equal(leeg.body.leeg, true);

    const nieuw = await post(base, '/api/concern/entiteit/nieuw', { naam: 'Noordzee Hotels BV', land: 'NL', rechtsvorm: 'bv', van: '2026-01-01' }, t);
    assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body));
    const ent = nieuw.body.entiteit.id;

    // een feit met bron, en dan de tijdmachine erop
    const feit = await post(base, '/api/concern/feit/zet', { entiteit: ent, soort: 'bestuurder', waarde: 'directeur', sleutel: 'marco',
        van: '2026-01-01', bronSoort: 'register', bronDetail: 'KvK' }, t);
    assert.equal(feit.status, 200, JSON.stringify(feit.body));

    const zonderBron = await post(base, '/api/concern/feit/zet', { entiteit: ent, soort: 'bestuurder', waarde: 'directeur', sleutel: 'lisa' }, t);
    assert.equal(zonderBron.status, 400, 'een feit zonder bron hoort door de deur te worden geweigerd');

    const toen = await post(base, '/api/concern/opdatum', { entiteit: ent, op: '2025-01-01' }, t);
    assert.equal(toen.status, 200);
    assert.equal(toen.body.entiteit.bestondNog, false, 'vóór het eerste feit bestond zij nog niet');

    const nu = await post(base, '/api/concern/opdatum', { entiteit: ent, op: '2026-06-01' }, t);
    assert.equal(nu.body.entiteit.naam, 'Noordzee Hotels BV');

    // vestiging + readiness + uitnodiging: de rest van de bedrading
    const v = await post(base, '/api/concern/vestiging/nieuw', { entiteit: ent, naam: 'Amsterdam' }, t);
    assert.equal(v.status, 200, JSON.stringify(v.body));

    const rd = await post(base, '/api/concern/readiness', { entiteit: ent }, t);
    assert.equal(rd.status, 200, JSON.stringify(rd.body));
    assert.ok(typeof rd.body.totaal === 'number');
    assert.match(rd.body.grens, /geen juridisch oordeel/i);

    const uit = await post(base, '/api/concern/uitnodigen', { entiteit: ent, vestiging: v.body.vestiging.id, rol: 'receptie' }, t);
    assert.equal(uit.status, 200, JSON.stringify(uit.body));
    assert.ok(uit.body.tonen.code === undefined, 'de tekst voor de uitgenodigde draagt geen techniek');

    const ubo = await post(base, '/api/concern/ubo', { entiteit: ent }, t);
    assert.equal(ubo.status, 200);
    assert.match(ubo.body.grens, /handelsregister/i, 'de grens hoort in het antwoord te staan');
  });
});

test('andermans entiteit is niet te lezen en niet te wijzigen', async () => {
  await metServer(async (base) => {
    const a = await lid(base, 11);
    const b = await lid(base, 12);

    const nieuw = await post(base, '/api/concern/entiteit/nieuw', { naam: 'Van A BV', land: 'NL' }, a);
    const ent = nieuw.body.entiteit.id;

    /* HET ID UIT HET LICHAAM IS GEEN BEWIJS. B kent het id en probeert alles.
       Elk van deze hoort op 404 te eindigen -- en op 404 en niet op 403, want
       het verschil tussen "bestaat niet" en "niet van jou" zou verklappen welke
       id's bestaan. */
    for (const pad of ['/api/concern/entiteit', '/api/concern/readiness', '/api/concern/ubo',
      '/api/concern/vestigingen', '/api/concern/mensen', '/api/concern/organigram',
      '/api/concern/opdatum', '/api/concern/geschiedenis', '/api/concern/launch']) {
      const r = await post(base, pad, { entiteit: ent }, b);
      assert.equal(r.status, 404, pad + ' liet een vreemde binnen: ' + JSON.stringify(r.body));
    }
    for (const pad of ['/api/concern/vestiging/nieuw', '/api/concern/entiteit/registratie',
      '/api/concern/uitnodigen', '/api/concern/mens/nieuw', '/api/concern/entiteit/verwijder']) {
      const r = await post(base, pad, { entiteit: ent, naam: 'Kaap', nummer: '123', rol: 'directie', persoon: 'x' }, b);
      assert.equal(r.status, 404, pad + ' liet een vreemde schrijven: ' + JSON.stringify(r.body));
    }

    // en de eigenaar zelf komt er wel gewoon in
    const eigen = await post(base, '/api/concern/entiteit', { entiteit: ent }, a);
    assert.equal(eigen.status, 200);
  });
});

test('een uitnodiging laat iemand binnen zonder betaalde pas, en maar één keer', async () => {
  await metServer(async (base) => {
    const baas = await lid(base, 21);
    const werker = await lid(base, 22);

    const ent = (await post(base, '/api/concern/entiteit/nieuw', { naam: 'Hotel Noordzee BV', land: 'NL', rechtsvorm: 'bv' }, baas)).body.entiteit.id;
    const v = (await post(base, '/api/concern/vestiging/nieuw', { entiteit: ent, naam: 'Amsterdam', plaats: 'Amsterdam' }, baas)).body.vestiging;
    const u = (await post(base, '/api/concern/uitnodigen', { entiteit: ent, vestiging: v.id, rol: 'receptie' }, baas)).body;

    /* De werker heeft een gewoon gratis account -- geen Business Pass, geen
       Lifestyle Pass. Dat is de grens uit CONCERN.md: een werknemer koopt nooit
       een pas om te mogen werken. */
    const acc = await post(base, '/api/concern/uitnodiging/accepteer', { code: u.uitnodiging.code }, werker);
    assert.equal(acc.status, 200, 'accepteren faalde: ' + JSON.stringify(acc.body));
    assert.match(acc.body.welkom.kop, /Hotel Noordzee BV/);

    const mijn = await post(base, '/api/concern/mijnwerk', {}, werker);
    assert.equal(mijn.body.werkplekken.length, 1);
    assert.equal(mijn.body.werkplekken[0].rol, 'receptie');

    // tweede keer: dicht
    const derde = await lid(base, 23);
    const nog = await post(base, '/api/concern/uitnodiging/accepteer', { code: u.uitnodiging.code }, derde);
    assert.equal(nog.status, 409, 'een gebruikte uitnodiging hoort dicht te zijn');

    // en de baas ziet er precies één medewerker
    const mensen = await post(base, '/api/concern/mensen', { entiteit: ent }, baas);
    assert.equal(mensen.body.mensen.length, 1);
  });
});
