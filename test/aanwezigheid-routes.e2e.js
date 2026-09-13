/* DE ZES ROUTES VAN DE PUBLIEKE LAAG, tegen een echte server.

   test/aanwezigheid.test.js beproeft de MODULES; deze toets beproeft de weg
   ernaartoe. Dat verschil is hier geen formaliteit: de twee besluiten van
   13 september gaan allebei over WIE iets mag doen, en dat staat op de route en
   niet in de module.

   De scherpste regel die hier wordt vastgelegd: UITLICHTEN GEBEURT OP NAAM. Met
   de gedeelde kantoorcode lukt het niet -- dezelfde grens die de toelatingsketen
   al vond, en de reden dat de boardroomdeur bestaat. Een spoor dat eindigt bij
   een gedeelde code is geen spoor (KANTOOR.md). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

test('de publieke laag: volgen op naam, en uitlichten alleen door een mens', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanwezig-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-AANWEZIG-1' } });
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const lid = (await post('/api/login', { tier: 'rtg' })).body;
    assert.ok(lid.token, 'lid-inlog mislukt');

    /* 1. Wie niets volgt, volgt niets. Deze lege lijst zegt op zichzelf NIETS --
       een bewering over een lege verzameling slaagt ook als de route stuk is
       (scripts/tandeloos.js telt precies zulke beweringen). Daarom staat hij hier
       als NULSTAND van een lus die verderop echt heen en terug gaat: leeg, dan
       gevolgd, dan weer leeg. Pas die drie samen bewijzen iets. */
    const leeg = await post('/api/mediaos/aanwezig/mijn', {}, lid.token);
    assert.equal(leeg.status, 200);
    assert.equal(leeg.body.aanwezigheden.length, 0);

    /* 2. De gedeelde kantoorcode komt de redactiedeur niet door. */
    const gedeeld = (await post('/api/office/login', { code: 'KANTOOR-AANWEZIG-1' })).body;
    assert.ok(gedeeld.token, 'kantoor-inlog mislukt');
    /* STRENGER DAN VERWACHT, en dat is de bevinding: de boardroomdeur laat de
       gedeelde code NERGENS door -- ook niet bij het lezen van het bord. De
       eerste versie van deze toets nam aan dat lezen wel mocht en zakte daarop.
       De controle in kern/salon/uitlichten.js ("uitlichten gebeurt op naam")
       blijft staan als tweede slot: hij is via deze route niet te bereiken, maar
       een module die zijn eigen grens kent, houdt hem ook als er ooit een
       andere deur op komt. test/aanwezigheid.test.js toets 6 beproeft hem. */
    for (const pad of ['/api/office/salon/uitlicht/bord', '/api/office/salon/uitlicht', '/api/office/salon/uitlicht/intrek']) {
      const r = await post(pad, { postId: 'p1', grond: 'redactie', reden: 'x' }, gedeeld.token);
      assert.equal(r.status, 403, 'de gedeelde kantoorcode komt niet op ' + pad);
    }

    /* 3. Op naam lukt het wel -- en dan ontstaat de aanwezigheid van de AUTEUR. */
    const persoon = await kantoorAlsPersoon(srv.base);
    assert.ok(persoon, 'de eigenaar staat als persoon in de backoffice');
    assert.equal((await post('/api/office/salon/uitlicht/bord', {}, persoon)).status, 200,
      'op naam mag het bord wel');

    /* Een EIGEN post van het lid, zodat de keten van begin tot eind echt is en
       niet afhangt van wat er toevallig in de zaaiset staat. */
    const post1 = await post('/api/salon/plaats', { tekst: 'Een middag in Kyoto.' }, lid.token);
    const postId = post1.body && (post1.body.post ? post1.body.post.id : post1.body.id);
    assert.ok(postId, 'het lid kon plaatsen: ' + JSON.stringify(post1.body).slice(0, 160));

    const uit = await post('/api/office/salon/uitlicht', { postId, grond: 'bijzonder' }, persoon);
    assert.equal(uit.status, 200, 'op naam lukt het: ' + JSON.stringify(uit.body).slice(0, 160));
    /* De uitlichting levert het MOMENT, en dat draagt de aanwezigheid van de
       AUTEUR -- niet die van de redactie. */
    const aanwezigId = uit.body.moment && uit.body.moment.aanwezigheid;
    assert.ok(aanwezigId, 'de uitlichting leverde een moment met een aanwezigheid');

    /* HOOGUIT EEN KEER -- en hier staan TWEE dingen die niet hetzelfde zijn.
       Deze toets beweerde eerst dat een woordelijk gelijke herhaling meteen 409
       geeft, en dat is onwaar: server/lib/idemsleutels-stage.js zet op deze route
       de sleutel ['postId','grond'], dus binnen het dubbeltikvenster speelt de
       idempotentiepoort het BEWAARDE antwoord terug. Dat is geen gat maar het
       besluit dat in de kop van dat bestand staat -- binnen vijf seconden is een
       tweede identieke uitlichting een haperend netwerk.

       Het bewijs dat het een replay is en geen tweede uitlichting: dezelfde `id`.
       Een nieuwe regel zou een nieuwe dragen.

       DE TOESTANDSCONTROLE ZIT ERONDER en is iets anders. Met een andere grond
       verschilt de sleutel, dus de handler draait echt -- en dan komt de 409 waar
       hij hoort. Precies het onderscheid dat de kop van idemsleutels-stage.js
       maakt: wie replay en toestandscontrole samenvoegt, kan later niet meer zien
       of een route veilig te herhalen IS of alleen toevallig niets deed. */
    const herhaald = await post('/api/office/salon/uitlicht', { postId, grond: 'bijzonder' }, persoon);
    assert.equal(herhaald.status, 200, 'binnen het dubbeltikvenster speelt de poort het antwoord terug');
    assert.equal(herhaald.body.uitlichting.id, uit.body.uitlichting.id,
      'en het is echt hetzelfde antwoord: een tweede uitlichting zou een nieuwe id dragen');

    const anders = await post('/api/office/salon/uitlicht', { postId, grond: 'lokaal' }, persoon);
    assert.equal(anders.status, 409, 'een andere sleutel bereikt de handler, en die weigert op de STAND');
    assert.match(String(anders.body.error || ''), /al uitgelicht/, 'en zegt waarom');

    /* 3b. DE VOLGLUS, en die maakt de lege lijst hierboven pas iets waard.

       EEN TWEEDE LID, en dat is geen omweg maar een vondst: de AUTEUR kan zijn
       eigen aanwezigheid niet volgen (400 "Dit bent u zelf"). De eerste versie
       van deze toets probeerde dat en zakte -- terecht, want jezelf volgen maakt
       elke volgerstelling onzuiver. */
    /* EEN ANDERE PAS EN NIET ALLEEN EEN TWEEDE TOKEN. `/api/login { tier: 'rtg' }`
       geeft twee keer dezelfde demo-SLEUTEL: het token verschilt, de mens niet.
       Ook dat vond deze toets door te zakken -- en het is precies de val waar een
       volgerstelling stil fout van wordt. */
    const lid2 = (await post('/api/login', { tier: 'business' })).body;
    assert.ok(lid2.token, 'een tweede lid met een andere pas');
    assert.equal((await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid.token)).status, 400,
      'de auteur volgt zichzelf niet');

    assert.equal((await post('/api/mediaos/aanwezig', { id: aanwezigId }, lid2.token)).status, 200);
    assert.equal((await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid2.token)).status, 200);
    const naVolgen = await post('/api/mediaos/aanwezig/mijn', {}, lid2.token);
    assert.equal(naVolgen.body.aanwezigheden.length, 1, 'nu volgt hij er een');
    assert.ok(naVolgen.body.aanwezigheden[0].watUKrijgt.length, 'en hij ziet WAT hij krijgt');

    /* Twee keer volgen is een keer volgen (het contract zegt idempotent). */
    await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid2.token);
    assert.equal((await post('/api/mediaos/aanwezig/mijn', {}, lid2.token)).body.aanwezigheden.length, 1);

    await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: false }, lid2.token);
    assert.equal((await post('/api/mediaos/aanwezig/mijn', {}, lid2.token)).body.aanwezigheden.length, 0,
      'en terug naar nul -- dezelfde nul als bij het begin, nu met betekenis');

    /* Intrekken vraagt een reden, ook op naam. */
    assert.equal((await post('/api/office/salon/uitlicht/intrek', { postId }, persoon)).status, 400);
    assert.equal((await post('/api/office/salon/uitlicht/intrek',
      { postId, reden: 'Auteur wilde het niet.' }, persoon)).status, 200);

    /* 4. Een aanwezigheid die niet bestaat, bestaat niet -- en volgen ervan ook
       niet. Geen stille 200 op een verzonnen id. */
    assert.equal((await post('/api/mediaos/aanwezig', { id: 'zaak:bestaat-niet' }, lid.token)).status, 404);
    assert.equal((await post('/api/mediaos/aanwezig/volg', { id: 'zaak:bestaat-niet', aan: true }, lid.token)).status, 404);

    /* 5. En een gast komt er niet in: de Media OS is voor leden. */
    const gast = (await post('/api/login', { tier: 'guest' })).body;
    if (gast.token) {
      assert.equal((await post('/api/mediaos/aanwezig/mijn', {}, gast.token)).status, 403);
    }
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
