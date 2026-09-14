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

    /* HOOGUIT EEN KEER -- EN DAT HEEFT TWEE DEUREN, want op de ROUTE staat de
       dubbeltikpoort ervoor en in de MODULE de toestandscontrole. Deze toets
       eiste hier ooit onvoorwaardelijk 409, en dat was de wereld van voordat
       server/lib/idemsleutels-stage.js bestond. Die verklaring kwam er later bij
       en zette deze route in het dubbeltikvenster van lib/idemsleutels.js --
       vijf seconden, huisbreed. Sindsdien krijgt een woordelijk gelijk verzoek
       binnen dat venster het ANTWOORD VAN DE EERSTE terug en komt de handler er
       niet meer aan toe.

       De reparatie was niet de eis verlagen maar hem VERDUBBELEN. Beide takken
       die hieraan werkten kwamen onafhankelijk op dezelfde twee deuren uit; wat
       hier staat is de UNIE ervan, want ze bewaakten elk iets wat de ander niet
       zag -- de tekst van de weigering, en de invariant eronder.

       1. Woordelijk gelijk, binnen het venster: een HERHALING. Niet zomaar een
          200 -- het moet het antwoord van de eerste zijn, dus dezelfde id. Een
          nieuwe id met status 200 zou betekenen dat er wel degelijk een tweede
          handeling was, en daar is deze regel voor. */
    const nogmaals = await post('/api/office/salon/uitlicht', { postId, grond: 'bijzonder' }, persoon);
    assert.equal(nogmaals.status, 200, 'binnen het dubbeltikvenster speelt de poort het antwoord terug');
    assert.equal(nogmaals.body.herhaald, true, 'en hij zegt er ook bij dat het een herhaling is');
    assert.equal(nogmaals.body.uitlichting.id, uit.body.uitlichting.id,
      'een herhaling geeft het antwoord van de EERSTE terug, dus dezelfde uitlichting');

    /* 2. EEN ANDER VERZOEK, en dan draait de toestandscontrole wel. De identiteit
          is `postId` + `grond` (idemsleutels-stage.js), dus dezelfde post met een
          andere grond is geen dubbeltik maar een tweede redactiebesluit -- en dat
          hoort te stuiten op 409 "al uitgelicht", met die reden erbij.

          Zo staat het verschil dat MUTATIECONTRACT.md maakt hier in twee regels
          naast elkaar: een herhaling die hetzelfde antwoord teruggeeft is IETS
          ANDERS dan een herhaling die wordt tegengehouden door de stand van het
          onderwerp. Wie die twee samenvoegt, kan later niet meer zien of een
          route veilig te herhalen IS of alleen toevallig niets deed. */
    const anders = await post('/api/office/salon/uitlicht', { postId, grond: 'lokaal' }, persoon);
    assert.equal(anders.status, 409, 'een andere sleutel bereikt de handler, en die weigert op de STAND');
    assert.match(String(anders.body.error || ''), /al uitgelicht/, 'en zegt waarom');

    /* 3. En de invariant zelf, want daar gaat het om: na drie pogingen loopt er
          precies EEN uitlichting. Zonder deze regel zeggen de twee hierboven
          alleen iets over statuscodes. */
    const naDrie = await post('/api/office/salon/uitlicht/bord', {}, persoon);
    assert.equal(naDrie.body.lopend.filter(r => String(r.post) === String(postId)).length, 1,
      'drie pogingen, een uitlichting');

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

    /* 4a. VOLGEN, ONTVOLGEN, OPNIEUW VOLGEN -- binnen het dubbeltikvenster.

       DEZE TOETS VOND EEN ECHT DEFECT, en het zat in onze eigen verklaring. Met
       `velden: ['id', 'aan']` was het derde verzoek woordelijk gelijk aan het
       eerste, dus de dubbeltikpoort gaf het antwoord van toen terug en de
       handler kwam er niet aan te pas: het lid VOLGDE NIETS terwijl de API 200
       en volgIk:true zei. Een gewone vinger op een knop, en een stille
       onwaarheid tegen het lid.

       De drie oproepen staan hier bewust achter elkaar zonder pauze -- met een
       wachttijd van vijf seconden ertussen zou deze toets altijd slagen en
       nooit iets bewijzen. */
    assert.equal((await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid2.token)).body.volgIk, true);
    assert.equal((await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: false }, lid2.token)).body.volgIk, false);
    const derde = await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid2.token);
    assert.equal(derde.body.volgIk, true, 'de derde zegt dat hij volgt');
    assert.notEqual(derde.body.herhaald, true, 'en hij is GEEN herhaling: de handler heeft echt gedraaid');
    assert.equal((await post('/api/mediaos/aanwezig/mijn', {}, lid2.token)).body.aanwezigheden.length, 1,
      'en dan volgt hij er ook echt een -- dit is de regel die zakte');
    await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: false }, lid2.token);

    /* 4b. DISCOVERY EN DE FAN INBOX over de echte route (13 september 2026).

       De twee helften die schakel 2 en 5 van de momentproef openhielden. Wat
       hier bewezen wordt is niet dat ze 200 geven maar dat ze DOEN wat ze
       beloven: een aanwezigheid VINDEN zonder het id te kennen, en het moment
       TERUGVINDEN zonder dat de melding een adres draagt. */
    /* Zoeken op een stuk van de ECHTE naam van de aanwezigheid. Die komt uit de
       codenaam van de auteur en niet uit een vast voorvoegsel -- de eerste
       versie van deze toets zocht op de stub uit de unittoets en vond niets. */
    const naamVanA = (await post('/api/mediaos/aanwezig', { id: aanwezigId }, lid2.token)).body.aanwezigheid.naam;
    assert.ok(naamVanA && naamVanA.length >= 3, 'de aanwezigheid draagt een naam om op te zoeken');
    const gezocht = await post('/api/mediaos/aanwezig/zoek', { q: naamVanA.slice(0, 4) }, lid2.token);
    assert.equal(gezocht.status, 200);
    assert.ok(Array.isArray(gezocht.body.aanwezigheden), 'de zoeker geeft een lijst');
    const raak = gezocht.body.aanwezigheden.find(a => a.id === aanwezigId);
    assert.ok(raak, 'de aanwezigheid van de auteur is te vinden op een stuk van de naam');
    assert.equal(raak.volgIk, false, 'en lid2 heeft hem net ontvolgd, dus volgIk is false');

    /* De grens die op de route net zo hard staat als in de module: geen
       volgerstelling, ook niet verstopt in een veldnaam. */
    for (const sleutel of Object.keys(raak))
      assert.ok(!/volgers|aantal|score|rang|populair/i.test(sleutel),
        'de zoeker geeft geen telling terug (veld ' + sleutel + ')');

    /* De tijdlijn is een venster op wat je volgt: eerst niets, dan iets. */
    assert.equal((await post('/api/mediaos/momenten', {}, lid2.token)).body.momenten.length, 0,
      'wie niets volgt, ziet niets');
    await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: true }, lid2.token);
    const tijdlijn = await post('/api/mediaos/momenten', {}, lid2.token);
    assert.equal(tijdlijn.status, 200);
    const uitgelicht = tijdlijn.body.momenten.find(m => m.soort === 'uitgelicht');
    assert.ok(uitgelicht, 'de uitlichting van eerder staat in de tijdlijn');
    assert.equal(uitgelicht.aanwezigheid, aanwezigId);
    assert.ok(uitgelicht.at, 'met een tijdstip');
    assert.ok(uitgelicht.naam, 'en de naam van de aanwezigheid, live gelezen');
    await post('/api/mediaos/aanwezig/volg', { id: aanwezigId, aan: false }, lid2.token);

    /* 5. En een gast komt er niet in: de Media OS is voor leden. Alle vier de
       ledenroutes van deze laag, zodat de deur niet per route kan verschillen. */
    const gast = (await post('/api/login', { tier: 'guest' })).body;
    if (gast.token) {
      for (const pad of ['/api/mediaos/aanwezig/mijn', '/api/mediaos/aanwezig/zoek', '/api/mediaos/momenten']) {
        assert.equal((await post(pad, {}, gast.token)).status, 403, pad + ' is niet voor een gast');
      }
    }
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
