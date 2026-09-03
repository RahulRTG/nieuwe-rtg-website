/* ============================================================================
   DE NIEUWE LEDENROUTES OVER DE LIJN: /api/opvang, /api/knelpunt, /api/rtgid/bewijzen

   test/opvangleden.test.js, test/knelpunt.test.js en test/rtgid-bewijs.test.js
   toetsen de MODULES: de projectie, de rekenregel, wat er de deur uit gaat. Dat
   is waar de inhoud zit, en het is zonder server te doen.

   Wat daar NIET in zit is de weg ernaartoe, en dat is precies wat scripts/norm.js
   telde als `endpointsZonderTest`. Een module die klopt achter een route die
   nergens gemonteerd staat, achter een poort die iedereen doorlaat, is nog steeds
   stuk -- en geen van die drie fouten laat een moduletoets zakken.

   Dit bestand toetst dus alleen de LIJN, en met opzet niet nog eens de inhoud:

     1. de poort: zonder inlog komt er niets door;
     2. de route bestaat en is gemonteerd (geen 404);
     3. wat de module belooft, bereikt de lezer ook echt -- de grenszinnen en de
        `bron`-vlag staan in het antwoord en niet alleen in de module;
     4. de knelpuntmotor bewaart niets: twee gelijke oproepen, gelijk antwoord.

   WAAROM DE BEWIJSMAP EEN EIGEN ACCOUNT NODIG HEEFT. RTG iD eist een echt
   RTG-account (een demo-persona heeft er geen), en dat is geen tekort van deze
   toets maar de poort die werkt. Er wordt er dus een geregistreerd; zonder dat
   zou deze route alleen op zijn 403 te toetsen zijn en niet op zijn antwoord.

   Draai los: node --test test/opvangroute.test.js
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv, BASE, TOK;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer();
  BASE = srv.base;
  /* Een echt account, want RTG iD laat een demo-persona niet toe. Vier velden,
     precies wat server/routes/auth/aanmeldcontrole.js vraagt. */
  const r = await post('/api/auth/register', {
    name: 'Route Toets', email: 'route.toets.' + Date.now() + '@example.test',
    password: 'Route-Toets-2026!', geboortedatum: '1990-04-12'
  });
  assert.equal(r.status, 200, 'registreren mislukte: ' + JSON.stringify(r.body).slice(0, 200));
  TOK = r.body.token;
  assert.ok(TOK, 'zonder token valt er niets te toetsen');
});
test.after(() => stop(srv));

test('1. zonder inlog komt er niets door', async () => {
  for (const pad of ['/api/opvang', '/api/opvang/mijn', '/api/opvang/vraag', '/api/opvang/weg',
    '/api/knelpunt', '/api/rtgid/bewijzen']) {
    const r = await post(pad, {});
    assert.ok(r.status === 401 || r.status === 403,
      pad + ' liet een verzoek zonder inlog door met ' + r.status + '; deze routes dragen invoer van een mens');
  }
});

test('2. /api/opvang staat gemonteerd en draagt zijn grenzen in het antwoord', async () => {
  const r = await post('/api/opvang', {}, TOK);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.ok(Array.isArray(r.body.opvangen), 'het aanbod hoort een lijst te zijn');
  /* De twee zinnen die de laag eerlijk houden, moeten de LEZER bereiken. Ze in
     de module zetten en niet doorgeven is precies de fout die deze reeks al een
     keer maakte met `dektNiet`. */
  assert.match(r.body.grens, /niet dat u hem heeft/,
    'het antwoord hoort zelf te zeggen dat een vrije plek geen plek is');
  assert.match(r.body.zelfDoen, /reserveert hier niets/,
    'en dat RTG hier niets voor u aanvraagt');
  /* En de aanwezigheidslijst komt er ook over de lijn niet uit. */
  assert.ok(!/aanwezig/.test(JSON.stringify(r.body)),
    'de aanwezigheidslijst van een groep hoort de server nooit te verlaten');
});

test('3. /api/opvang/mijn geeft alleen wat op de eigen codenaam staat', async () => {
  const r = await post('/api/opvang/mijn', {}, TOK);
  assert.equal(r.status, 200);
  /* EEN LEGE LIJST IS HIER DE UITSLAG, EN DAAROM WORDT ER MEER GETOETST DAN
     "leeg". Een route die altijd niets teruggeeft -- kapot, verkeerd gemount --
     zou een kale `deepEqual([])` net zo groen laten; scripts/tandeloos.js telt
     dat soort beweringen en heeft gelijk. Dus: de lijst BESTAAT (een array en
     geen undefined), hij is leeg, en de route zegt ok. Dat drietal kan een
     kapotte route niet halen. */
  assert.ok(Array.isArray(r.body.aanvragen), 'er hoort een lijst terug te komen, ook als hij leeg is');
  assert.equal(r.body.ok, true, 'en de route hoort te slagen in plaats van stil niets te geven');
  assert.equal(r.body.aanvragen.length, 0, 'een vers account heeft nog geen aanvragen staan');
});

test('4. de aanvraag gaat eerst langs de gegevenspoort, en intrekken weigert netjes', async () => {
  /* DE GEGEVENSPOORT STAAT VOOR DE HANDLER, en dat is hier de bedoeling: een
     aanvraag deelt uw codenaam en uw wens met een derde, dus hij loopt langs
     kern/gegevenspoort.js net als elke andere bestelling. Een vers account heeft
     geen telefoonnummer opgegeven en krijgt dus een 428 met de VRAAG erbij --
     geen 400 en geen stille weigering.

     Deze toets stond eerst op 404 (een onbekende partnercode). Dat was mijn
     verwachting die fout was en niet de route: de poort komt eerder, en dat hoort
     zo. Vandaar dat hij nu de poort vastlegt; die is het interessante deel. */
  const zonderTelefoon = await post('/api/opvang/vraag',
    { code: 'BESTAATNIET', datum: '2030-01-01', van: '08:00', tot: '17:00' }, TOK);
  assert.equal(zonderTelefoon.status, 428, JSON.stringify(zonderTelefoon.body).slice(0, 160));
  assert.equal(zonderTelefoon.body.soort, 'bestelling');
  assert.ok((zonderTelefoon.body.ontbreekt || []).some(v => v.veld === 'telefoon'),
    'de poort hoort te zeggen WELK gegeven hij mist, niet alleen dat er iets mist');

  /* Intrekken deelt niets met een derde en gaat dus niet langs de poort: daar
     komt de gewone weigering, met een reden. */
  const weg = await post('/api/opvang/weg', { code: 'BESTAATNIET', id: 'x' }, TOK);
  assert.equal(weg.status, 404);
  assert.ok(weg.body.error, 'een weigering hoort een reden te dragen');
});

test('5. /api/knelpunt rekent en bewaart niets', async () => {
  const lijf = {
    doel: 'verpleegkundige worden',
    randvoorwaarden: [{ id: 'opvang', wat: 'opvang voor de kinderen', stand: 'ontbreekt' }],
    manieren: [{ id: 'voltijd', wat: 'voltijd', nodig: ['opvang'] }, { id: 'avond', wat: 'avond', nodig: [] }]
  };
  const een = await post('/api/knelpunt', lijf, TOK);
  assert.equal(een.status, 200, JSON.stringify(een.body).slice(0, 200));
  assert.equal(een.body.manieren.length, 2, 'een geblokkeerde weg hoort in het antwoord te blijven staan');
  assert.ok(een.body.openingen.length > 0, 'de openingenlaag hoort mee te komen over de lijn');
  assert.ok(een.body.terreinen.length >= 5, 'de stand van elk terrein hoort mee te komen');

  /* BEWAART NIETS: twee gelijke oproepen geven een gelijk antwoord. Dat is hier
     geen idempotentiebelofte maar het bewijs dat er geen toestand ontstaat. */
  const twee = await post('/api/knelpunt', lijf, TOK);
  assert.deepEqual(twee.body, een.body, 'deze route hoort geen toestand op te bouwen');

  // en een leeg verzoek krijgt een reden, geen leeg antwoord
  const leeg = await post('/api/knelpunt', {}, TOK);
  assert.equal(leeg.status, 400);
  assert.ok(leeg.body.error);
});

test('6. /api/rtgid/bewijzen geeft een lijst eisen, en nooit een nummer', async () => {
  const r = await post('/api/rtgid/bewijzen', {}, TOK);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.bron, true, 'de bewijzenlaag hoort gekoppeld te zijn');
  assert.ok(r.body.eisen.length >= 5, 'de eisen komen uit kern/persoonseis-lijst.js');
  for (const e of r.body.eisen) {
    assert.equal(typeof e.voldoet, 'boolean', 'elke eis hoort een ja of nee te dragen');
    assert.ok(e.naam, 'en een leesbare naam');
  }
  /* Een vers account heeft niets, en dan hoort er een REDEN te staan -- dat is
     het enige waar de mens zelf iets mee kan. */
  assert.ok(r.body.eisen.every(e => e.voldoet || e.reden), 'bij "nu niet" hoort een reden te staan');

  /* Het registratienummer verlaat de server niet. Er staat wel een VELD met dat
     woord in de uitlegtekst van een eis ("Uw eigen BIG-nummer"), dus er wordt op
     een echte cijferreeks getoetst en niet op het woord -- anders vangt deze
     toets zijn eigen uitleg. */
  const heel = JSON.stringify(r.body);
  assert.ok(!/"nummer"\s*:/.test(heel), 'er hoort geen veld "nummer" in het antwoord te staan');
  assert.ok(!/[A-Z]{2,}-?\d{6,}|\d{8,}/.test(heel), 'er hoort geen registratienummer in het antwoord te staan');
});
