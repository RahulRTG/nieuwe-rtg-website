/* HET TEMPO -- de reeks die geen enkele omvangmeter ziet.

   HET GAT DAT DIT DICHT, en het stond met naam in het register als openstaand
   punt. De meter van laag 1 weegt de OMVANG VAN EEN HANDELING. Vijf mensen op
   een dag uit dienst zetten is vijf keer een handeling die er EEN raakt, en elk
   van die vijf is licht. De zuivering die dit huis vreest komt dus niet als een
   grote handeling binnen maar als een reeks kleine, en daar keek deze laag
   dwars doorheen.

   VIJF BEWERINGEN, EN ELKE BEWERING IS EEN MANIER WAAROP DIT MIS KAN GAAN:

   1. HET BUDGET WORDT VERKLAARD EN NIET GELEERD. Bij een reeks is het tempo
      zelf de aanval: wie langzaam opvoert, leert een lerende meter dat opvoeren
      normaal is. Dan staat de drempel precies zo hoog als de aanvaller hem wil.
   2. OVER HET BUDGET IS UITZONDERLIJK EN NIET ZWAAR. Een zware handeling gaat
      na een bevestiging een kwartier lang vanzelf door -- en in dat kwartier
      maakt iemand zijn reeks af. Boven het budget vraagt dus ELKE volgende.
   3. ALLEEN WAT IS UITGEVOERD TELT. Anders vult een aanvaller andermans budget
      door te proberen: een blokkade die je op een collega kunt aanrichten.
   4. HET VENSTER ROLT. Een kalenderdag die om middernacht terugspringt is een
      cadeau aan wie tot 23:59 wacht.
   5. HET LAAT NIETS ACHTER. Dit is de enige reeks in deze laag met
      TIJDSTIPPEN erin, en die zijn gevoeliger dan kale getallen. Wat ouder is
      dan het venster bestaat hier niet meer, en wie vergeten wordt laat ook
      hier niets achter.

   TIEN MUTATIES, TIEN KEER RAAK, en een elfde die met opzet BLEEF staan:

     over het budget wordt "zwaar" i.p.v. "uitzonderlijk"   -> 8
     het tempo telt niet meer mee in de zwaarte             -> 1
     het budget tien keer zo ruim                           -> 1, 7
     de grens een schuif naar beneden (>= i.p.v. >)         -> 1
     het venster knipt niet meer                            -> 3
     een uitgevoerde handeling vult het budget niet         -> 1, 7
     de poort vraagt het tempo niet op                      -> 7
     de poort uit de uitdienstroute                         -> 7
     geen afspraak levert {over: false} i.p.v. null         -> 5
     vergeten wist het tempo niet                           -> 6

   De elfde was een controle: een onschuldige regel erbij (`bak.tempo` alvast
   aanmaken) hoort GEEN toets te laten zakken, en deed dat ook niet. Zonder die
   controle bewijst een rij "RAAK" alleen dat het bestand gevoelig is voor
   veranderen, niet dat de toetsen op het gedrag kijken.

   Draai los: node --experimental-sqlite --test test/vertrouwentempo.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const T = require('../server/kern/vertrouwen/tempo');
const B = require('../server/kern/vertrouwen/blootstelling');
const R = require('../server/kern/vertrouwen/register');

const REGEL = { budget: 5, vensterUren: 24 };

test('1. vijf losse handelingen zijn elk licht, en samen over het budget', () => {
  const bak = {};
  /* Elke handeling raakt er EEN. De omvangmeter zegt daar terecht "licht" van;
     dat is niet fout, het is een ander antwoord op een andere vraag. */
  for (let i = 0; i < 5; i++) {
    const t = T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL);
    assert.equal(t.over, false, 'binnen het budget bij nummer ' + (i + 1));
    assert.equal(B.meet({ soort: 'mens.uitdienst', aantal: 1 }, null, t).zwaarte, 'licht');
    T.noteer(bak, 'a', 'mens.uitdienst', 1, REGEL);
  }
  const zes = T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.equal(zes.ervoor, 5);
  assert.equal(zes.metDeze, 6);
  assert.equal(zes.over, true, 'de zesde past niet meer in het venster');

  const u = B.meet({ soort: 'mens.uitdienst', aantal: 1 }, null, zes);
  assert.equal(u.zwaarte, 'uitzonderlijk',
    'en niet "zwaar": daarna zou een bevestiging een kwartier vrij spel geven, en juist daarin past de reeks');
  assert.match(u.zin, /totaal op 6 personen/, u.zin);
  assert.equal(u.redenen[0], u.zin, 'wie het oordeel velde, staat vooraan -- niet "0,2x de vaste grens"');
});

test('2. alleen wat is uitgevoerd telt: proberen vult andermans budget niet', () => {
  const bak = {};
  /* Twintig keer meten is twintig keer vragen "mag dit". Wie daarmee het
     budget zou vullen, kan een collega buitensluiten door namens hem te
     proberen -- of zichzelf een alibi meten. */
  for (let i = 0; i < 20; i++) T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.deepEqual(bak.tempo, undefined, 'meten heeft geen bijwerking');
  assert.equal(T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL).ervoor, 0);
});

test('3. het venster rolt, en wat erbuiten valt bestaat hier niet meer', () => {
  const bak = {};
  for (let i = 0; i < 5; i++) T.noteer(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.equal(T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL).over, true);

  /* De klok verzetten kan hier niet zonder de server te herstarten, dus worden
     de momenten met de hand naar het verleden gezet -- exact wat de tijd zelf
     zou doen. */
  const k = Object.keys(bak.tempo)[0];
  for (const x of bak.tempo[k].reeks) x.at -= 25 * 3600000;

  const na = T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.equal(na.ervoor, 0, 'vijfentwintig uur later is het venster leeg');
  assert.equal(na.over, false);

  /* En het is echt WEG, niet alleen ongeteld: een tijdstip dat blijft staan is
     een bewaartermijn die niemand heeft afgesproken. */
  T.noteer(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.equal(bak.tempo[k].reeks.length, 1, 'de oude momenten zijn geknipt en niet bewaard');
});

test('4. het budget is per actor en per soort, en dat staat er ook bij', () => {
  const bak = {};
  for (let i = 0; i < 6; i++) T.noteer(bak, 'a', 'mens.uitdienst', 1, REGEL);
  assert.equal(T.meet(bak, 'a', 'mens.uitdienst', 1, REGEL).over, true);
  assert.equal(T.meet(bak, 'b', 'mens.uitdienst', 1, REGEL).over, false, 'een ander heeft zijn eigen venster');
  assert.equal(T.meet(bak, 'a', 'rol.geven', 1, REGEL).over, false, 'en een andere soort ook');

  /* Precies die twee zijn de bekende gaten, en ze horen benoemd te staan --
     een meting die zwijgt over haar randen leest als een volledige analyse. */
  const woorden = T.NIET_GEDEKT.map(n => n.wat).join(' ');
  assert.match(woorden, /twee actoren/);
  assert.match(woorden, /over soorten heen/);
  for (const n of T.NIET_GEDEKT) assert.ok(n.reden.length > 40, n.wat + ' zonder echte reden');
});

test('5. geen afspraak is geen nul', () => {
  /* Een soort zonder budget levert null en geen `{over: false}`. Dat verschil
     is hetzelfde als bij de omvangmeter: "niet gewogen" is geen "licht". */
  assert.equal(T.meet({}, 'a', 'tenant.vernietig', 1, null), null);
  assert.equal(T.meet({}, 'a', 'x', 1, { budget: 'veel' }), null, 'een budget dat geen getal is, is geen budget');
  assert.ok(R.soort('tenant.vernietig').waaromGeenTempo, 'en waarom die er geen heeft, staat opgeschreven');
  for (const s of R.SOORTEN) assert.ok(s.tempo || s.waaromGeenTempo,
    s.id + ' heeft geen budget en geen reden waarom niet');
});

test('6. wie vergeten wordt, laat ook hier geen tijdstip achter', () => {
  const bak = {};
  T.noteer(bak, 'a', 'mens.uitdienst', 1, REGEL);
  T.noteer(bak, 'b', 'mens.uitdienst', 1, REGEL);
  assert.equal(T.vergeetActor(bak, 'a'), 1);
  assert.equal(T.meet(bak, 'a', 'mens.uitdienst', 0, REGEL).ervoor, 0);
  assert.equal(T.meet(bak, 'b', 'mens.uitdienst', 0, REGEL).ervoor, 1, 'en van een ander blijft alles staan');

  /* De opruiming die LOS staat van een verzoek: wie nooit iets vraagt, hoort
     evengoed te verdwijnen zodra zijn venster leeg is. */
  for (const x of bak.tempo[Object.keys(bak.tempo)[0]].reeks) x.at -= 25 * 3600000;
  assert.equal(T.ruimOp(bak, 24), 1);
  assert.deepEqual(Object.keys(bak.tempo), [], 'een lege reeks laat geen sleutel achter');
});

/* ---------- en de echte weg, over HTTP ---------- */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tempo-'));
let srv, BASE;
const api = (pad, body, bearer) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, bearer ? { Authorization: 'Bearer ' + bearer } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('7. de zesde uitdiensttreding op een dag vraagt een tweede moment -- en de zevende weer', async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  BASE = srv.base;

  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Reeks BV' });
  const W = w.body.werkruimte, S = { werkruimte: W, beheerToken: w.body.beheerToken };

  const leden = [];
  for (let i = 0; i < 9; i++) {
    const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam: 'Medewerker ' + i });
    await api('/api/bedrijf/lid/besluit', { ...S, lidId: a.body.lidId, akkoord: true });
    leden.push(a.body);
  }

  /* Vijf gaan er zonder een woord doorheen, en dat hoort ook: een vertrek is
     een gewone gebeurtenis. Invisible when safe. */
  for (let i = 0; i < 5; i++) {
    const u = await api('/api/bedrijf/lid/uit-dienst', { ...S, lidId: leden[i].lidId, reden: 'Eigen verzoek.' });
    assert.equal(u.status, 200, 'nummer ' + (i + 1) + ' hoort niets te vragen: ' + JSON.stringify(u.body).slice(0, 160));
  }

  /* De zesde niet. En let op WELKE weigering het is: achter het beheer-token
     staat geen mens, dus er valt niets te vragen -- 403 en geen 428. */
  const zes = await api('/api/bedrijf/lid/uit-dienst', { ...S, lidId: leden[5].lidId, reden: 'Eigen verzoek.' });
  assert.equal(zes.status, 403, JSON.stringify(zes.body).slice(0, 200));
  assert.equal(zes.body.blootstelling.zwaarte, 'uitzonderlijk');
  assert.match(zes.body.blootstelling.zin, /totaal op 6 personen/, zes.body.blootstelling.zin);
  assert.match(zes.body.error, /geen persoon|kent geen persoon/);

  const leden6 = await api('/api/bedrijf/leden', S);
  assert.equal(leden6.body.leden.find(l => l.id === leden[5].lidId).status, 'actief',
    'en hij staat er nog gewoon in');
});

test('8. de reeks is de aanval, dus een bevestiging dekt er precies EEN', async () => {
  /* Dit is de eigenschap waar het hele budget om draait. Zou de zesde als
     "zwaar" gelden, dan gaf een bevestiging een kwartier vrij spel -- en in dat
     kwartier is de reeks af. Uitzonderlijk vraagt elke keer opnieuw. */
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Reeks Twee BV' });
  const W = w.body.werkruimte, S = { werkruimte: W, beheerToken: w.body.beheerToken };
  const maak = async (naam) => {
    const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam });
    await api('/api/bedrijf/lid/besluit', { ...S, lidId: a.body.lidId, akkoord: true });
    return a.body;
  };
  const baas = await maak('Directie');
  await api('/api/bedrijf/lid/rollen', { ...S, lidId: baas.lidId, rollen: ['directie'] });

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
  const reg = await api('/api/auth/register', { name: 'Directie', email: 't' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const rtg = reg.body.token;
  await api('/api/bedrijf/lid/koppel', { werkruimte: W, lidToken: baas.lidToken }, rtg);

  const mensen = [];
  for (let i = 0; i < 8; i++) mensen.push(await maak('Mens ' + i));
  const alsBaas = (lidId, bevestiging) => api('/api/bedrijf/lid/uit-dienst',
    { werkruimte: W, lidToken: baas.lidToken, lidId, reden: 'Reorganisatie.', bevestiging });

  for (let i = 0; i < 5; i++) assert.equal((await alsBaas(mensen[i].lidId)).status, 200, 'nummer ' + (i + 1));

  const zes = await alsBaas(mensen[5].lidId);
  assert.equal(zes.status, 428, 'nu staat er wel een mens, dus het is een voorwaarde en geen weigering');
  const bon = zes.body.bevestiging.id;
  assert.equal((await api('/api/bedrijf/bevestig', { werkruimte: W, lidToken: baas.lidToken, id: bon }, rtg)).status, 200);
  assert.equal((await alsBaas(mensen[5].lidId, bon)).status, 200, 'met de bon gaat nummer zes door');

  /* EN DAN DE ZEVENDE, meteen erna, met een verse en harde verificatie op zak.
     Hier zou een "zware" handeling doorheen glippen. */
  const zeven = await alsBaas(mensen[6].lidId);
  assert.equal(zeven.status, 428,
    'een bevestiging dekt EEN handeling, niet het kwartier erna: ' + JSON.stringify(zeven.body).slice(0, 200));
  assert.notEqual(zeven.body.bevestiging.id, bon, 'en er ligt een nieuwe vraag klaar');

  const nog = await api('/api/bedrijf/leden', S);
  assert.equal(nog.body.leden.find(l => l.id === mensen[6].lidId).status, 'actief');
});

test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
