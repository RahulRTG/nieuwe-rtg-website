/* BEHEER ACHTER EEN MENS -- en daarmee een poort die er echt een is.

   HET GAT DAT DIT DICHT. Het beheer van een werkruimte ging uitsluitend op het
   BEHEER-TOKEN, een sleutel die geen persoon noemt. Elke zware handeling
   daarachter liep daardoor vast op dezelfde muur van VERTROUWEN.md laag 3:
   nodig, maar onmogelijk -- er is niemand om een tweede bevestiging aan te
   vragen. Een poort die alleen "nee" kan zeggen, is geen poort maar een muur,
   en een muur zonder deur wordt eromheen gelopen.

   VIJF BEWERINGEN, EN ELKE BEWERING IS EEN AANVAL DIE ANDERS WERKT:

   1. EEN DIRECTIELID MAG BEHEREN, EEN MEDEWERKER NIET. Anders is "beheer door
      een mens" een tweede voordeur naast het beheer-token.
   2. WIE ALS PERSOON BEHEERT, KAN NOOIT MEER WEGGEVEN DAN HIJ ZELF HEEFT.
      Directie draagt zestien van de achttien rechten -- niet `mens.gevoelig`
      en niet `it.beveiliging`. Zonder deze regel kent een directielid zichzelf
      die twee toe via de HR-rol en heft daarmee de rolgrens op. Dat is
      bevoegdheid die groeit door delegatie: VERTROUWEN.md laag 4.
   3. ACHTER EEN SLEUTEL STAAT NIEMAND, EN DAT ZEGT DE POORT OOK. Een zware
      rolgift met het beheer-token wordt geweigerd MET de reden, en niet
      stilzwijgend doorgelaten omdat er toevallig niets is vastgelegd.
   4. EEN MENS KRIJGT WEL EEN TWEEDE MOMENT, en die bon zit vast aan DEZE
      SESSIE. Wat een bevestiging daarna WEL openzet -- een kwartier waarin
      zware handelingen doorgaan -- staat als eigen toets in 4b: dat is het
      ontwerp en geen gat, en dan hoort het getoetst te zijn en niet aangenomen.
   5. DE TWEEDE SLEUTEL ERFT ZIJN STERKTE VAN DE INLOG ERONDER. Een verlopen
      RTG-inlog bevestigt niets -- anders is de step-up een oude sessie in een
      nieuw jasje. Daarvoor gaat de klok een uur vooruit (RTG_KLOK=+1u).

   NEGEN MUTATIES, NEGEN KEER RAAK. Een toets die je niet hebt zien zakken is
   geen toets (LAT.md regel 9); dit is wat er is stukgemaakt en welke bewering
   het opving:

     de rolcontrole in beheerderVan uit          -> 1
     magGeven overgeslagen                       -> 2
     de poort van laag 3 uit de rolroute         -> 3 en 4
     een sleutel als "niet vastgelegd" i.p.v.
       "aantoonbaar geen mens" (ver: undefined)  -> 3
     de rtgKey-vergelijking in bevestig.js uit   -> 4
     de versheidseis op de RTG-inlog uit         -> 6
     het beheer-token mag bevestigen             -> 4
     `user-<id>` weer als kaal id geschreven     -> 4b (elk apparaat "nieuw")
     de expliciete verificatie uit poort()       -> 3

   Draai los: node --experimental-sqlite --test test/vertrouwenbeheer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beheer-'));
let srv, BASE;
const api = (pad, body, bearer) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    bearer ? { Authorization: 'Bearer ' + bearer } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Vijf rollen die een directielid WEL mag geven -- samen boven de vaste grens
   van drie uit het handelingenregister, dus zwaar. Geen van de vijf draagt
   `mens.gevoelig` of `it.beveiliging`, zodat toets 4 op de step-up stukloopt en
   niet op de insluitingsregel van toets 2. */
const ZWAAR = ['medewerker', 'verkoop', 'service', 'engineering', 'marketing'];

let W, S, ada, bo, cas, dee, rtg, rtgAnders;

async function nieuwAccount(naam) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
  const r = await api('/api/auth/register', { name: naam, email: 'b' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  return r.body.token;
}
async function nieuwLid(naam) {
  const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam });
  await api('/api/bedrijf/lid/besluit', { ...S, lidId: a.body.lidId, akkoord: true });
  return a.body;
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  BASE = srv.base;
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Nova Holding' });
  W = w.body.werkruimte;
  S = { werkruimte: W, beheerToken: w.body.beheerToken };
  ada = await nieuwLid('Ada'); bo = await nieuwLid('Bo');
  cas = await nieuwLid('Cas'); dee = await nieuwLid('Dee');
  /* Een rol is er een: licht, dus dit gaat langs de poort zonder iets te
     vragen. Dat is de bedoeling van de hele laag -- invisible when safe. */
  for (const l of [ada, dee]) {
    const r = await api('/api/bedrijf/lid/rollen', { ...S, lidId: l.lidId, rollen: ['directie'] });
    assert.equal(r.status, 200, 'een enkele rol vraagt niets: ' + JSON.stringify(r.body).slice(0, 140));
  }
  rtg = await nieuwAccount('Ada Lovelace');
  rtgAnders = await nieuwAccount('Iemand anders');
  const k = await api('/api/bedrijf/lid/koppel', { werkruimte: W, lidToken: ada.lidToken }, rtg);
  assert.equal(k.status, 200, 'Ada koppelt haar RTG-account: ' + JSON.stringify(k.body).slice(0, 140));
});

test('1. een directielid mag beheren, een medewerker niet', async () => {
  const alsAda = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: bo.lidId, rollen: ['medewerker'] });
  assert.equal(alsAda.status, 200, 'Ada beheert als mens: ' + JSON.stringify(alsAda.body).slice(0, 140));

  const alsBo = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: bo.lidToken, lidId: cas.lidId, rollen: ['medewerker'] });
  assert.equal(alsBo.status, 403, 'een medewerker beheert niets');
  assert.equal(alsBo.body.rol, 'directie', 'en hij hoort te lezen WELKE rol hij mist');
  const na = await api('/api/bedrijf/leden', S);
  assert.deepEqual(na.body.leden.find(l => l.id === cas.lidId).rollen, [],
    'en Cas heeft er niets van gekregen');
});

test('2. wie als persoon beheert, kan niet meer weggeven dan hij zelf heeft', async () => {
  /* HR draagt `mens.gevoelig`, en directie draagt dat niet. Ada zou zichzelf
     dat recht kunnen geven via een rol -- en dan is de rolgrens weg. */
  const u = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: bo.lidId, rollen: ['hr'] });
  assert.equal(u.status, 403, 'bevoegdheid groeit niet door delegatie (laag 4)');
  assert.deepEqual(u.body.erbij, ['mens.gevoelig'], 'en er staat bij WAT erbij zou komen');
  assert.match(u.body.error, /niet meer weggeven dan u zelf heeft/);

  /* Dezelfde poging langs it.beveiliging, zodat dit geen toets op een enkel
     woord is maar op de regel. */
  const it = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: bo.lidId, rollen: ['it'] });
  assert.equal(it.status, 403);
  assert.deepEqual(it.body.erbij, ['it.beveiliging']);

  /* En met de SLEUTEL mag het wel: die draagt alle rechten, dus daar groeit
     niets. Dat is geen uitzondering maar dezelfde regel. */
  const metSleutel = await api('/api/bedrijf/lid/rollen', { ...S, lidId: bo.lidId, rollen: ['hr'] });
  assert.equal(metSleutel.status, 200, JSON.stringify(metSleutel.body).slice(0, 140));
  await api('/api/bedrijf/lid/rollen', { ...S, lidId: bo.lidId, rollen: ['medewerker'] });
});

test('3. achter een sleutel staat niemand, en de poort zegt dat ook', async () => {
  const u = await api('/api/bedrijf/lid/rollen', { ...S, lidId: bo.lidId, rollen: ZWAAR });
  assert.equal(u.status, 403, 'geen 428: er is niemand om een bevestiging aan te vragen');
  assert.match(u.body.error, /geen persoon|kent geen persoon/,
    'en de reden noemt de deur en niet "policy": ' + JSON.stringify(u.body).slice(0, 200));
  assert.equal(u.body.bevestiging, undefined, 'er wordt geen bon uitgedeeld die niemand kan oplossen');
  assert.equal(u.body.blootstelling.zwaarte, 'zwaar', 'de omvang is wel degelijk gemeten');

  const na = await api('/api/bedrijf/leden', S);
  assert.deepEqual(na.body.leden.find(l => l.id === bo.lidId).rollen.map(r => r.id), ['medewerker'],
    'en er is niets veranderd');
});

test('4. een mens krijgt wel een tweede moment, en die bon zit vast aan DEZE handeling', async () => {
  const alsAda = (rollen, lidId) => api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId, rollen });

  const eerst = await alsAda(ZWAAR, bo.lidId);
  assert.equal(eerst.status, 428, 'geen weigering maar een voorwaarde: ' + JSON.stringify(eerst.body).slice(0, 200));
  const bon = eerst.body.bevestiging && eerst.body.bevestiging.id;
  assert.ok(bon, 'met een bon om af te maken');

  const ongebruikt = await alsAda(ZWAAR, bo.lidId);
  assert.equal(ongebruikt.status, 428, 'en zonder te bevestigen komt hij er niet langs');

  /* DE BEVESTIGING ZELF: twee sleutels van dezelfde mens. */
  const sleutelDeur = await api('/api/bedrijf/bevestig', { ...S, id: bon }, rtg);
  assert.equal(sleutelDeur.status, 400, 'een beheer-token bevestigt niets');
  assert.match(sleutelDeur.body.error, /bevestigt niets/);

  const ongekoppeld = await api('/api/bedrijf/bevestig',
    { werkruimte: W, lidToken: dee.lidToken, id: bon }, rtg);
  assert.equal(ongekoppeld.status, 409, 'een ongekoppeld lid heeft niets om mee te bewijzen');

  const ander = await api('/api/bedrijf/bevestig',
    { werkruimte: W, lidToken: ada.lidToken, id: bon }, rtgAnders);
  assert.equal(ander.status, 403, 'een RTG-sessie van iemand anders bevestigt niets');

  const goed = await api('/api/bedrijf/bevestig',
    { werkruimte: W, lidToken: ada.lidToken, id: bon }, rtg);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));

  /* DE INSLUITING DIE HIER ECHT WERKT: de bon zit vast aan DEZE SESSIE. Dee is
     ook directie en heeft ook een zware gift klaarstaan; Ada's bevestiging doet
     voor hem niets. Zonder die binding zou een bevestiging in dit huis een
     rondslingerende sleutel zijn: de een lost hem op, de ander gebruikt hem. */
  const dees = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: dee.lidToken, lidId: cas.lidId, rollen: ZWAAR, bevestiging: bon });
  assert.equal(dees.status, 428, 'Ada bevestigt niet voor Dee');
  assert.match(dees.body.error, /andere sessie|niet \(meer\)/, JSON.stringify(dees.body).slice(0, 200));

  const raak = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: bo.lidId, rollen: ZWAAR, bevestiging: bon });
  assert.equal(raak.status, 200, 'met de juiste bon gaat hij door: ' + JSON.stringify(raak.body).slice(0, 200));

  const na = await api('/api/bedrijf/leden', S);
  assert.deepEqual(na.body.leden.find(l => l.id === bo.lidId).rollen.map(r => r.id).sort(),
    ZWAAR.slice().sort(), 'en Bo heeft ze echt gekregen');
});

test('4b. en wat een bevestiging WEL openzet: een kwartier, voor zware handelingen', async () => {
  /* Dit is geen gat maar het ontwerp, en het hoort daarom met zoveel woorden
     getoetst te worden in plaats van stilzwijgend te bestaan. Na een verse,
     harde verificatie gaat een ZWARE handeling het kwartier erna vanzelf door
     (kern/vertrouwen/stapop.js). Wie bij elke handeling opnieuw moet bevestigen,
     leest de vraag binnen een week niet meer, en dan is de veiligheid GEDAALD.

     WAT DAT KOST, en dat is de eerlijke kant: wie in dat kwartier Ada's
     lid-token heeft, deelt haar venster. Voor een OMKEERBARE handeling is dat
     de prijs; voor een onomkeerbare niet, en die staan dan ook als
     `minstens: 'uitzonderlijk'` in het handelingenregister -- die vragen elke
     keer opnieuw, ook binnen het kwartier (zie test/vertrouwenpoort.test.js). */
  const binnenHetKwartier = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: cas.lidId, rollen: ZWAAR });
  assert.equal(binnenHetKwartier.status, 200,
    'een verse, harde verificatie draagt het kwartier erna: ' + JSON.stringify(binnenHetKwartier.body).slice(0, 200));

  /* En hij draagt alleen DEZE sessie. Dee heeft niets bevestigd en merkt er
     dus ook niets van -- anders was het geen sessie-eigenschap maar een stand
     van het huis. */
  const dees = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: dee.lidToken, lidId: bo.lidId, rollen: ZWAAR });
  assert.equal(dees.status, 428, 'het kwartier van Ada is niet het kwartier van Dee');
});

test('5. er staat een Trust Receipt onder, met per bewering een bron', async () => {
  const tech = (await api('/api/techniek/inloggen',
    { login: 'roellie.i@gmail.com', wachtwoord: process.env.DEMO_PASS || 'Imran' })).body.token;
  const u = await api('/api/techniek/vertrouwen/bonnen', { hoeveel: 20 }, tech);
  assert.equal(u.status, 200, JSON.stringify(u.body).slice(0, 200));
  const mijne = u.body.bonnen.filter(b => b.soort === 'rol.geven');
  assert.ok(mijne.length >= 2, 'elke geslaagde rolgift laat een bon achter, ook de lichte');
  const bevestigd = mijne.find(b => b.doel === bo.lidId && b.aantal === ZWAAR.length);
  assert.ok(bevestigd, 'de zware gift aan Bo staat erbij');
  assert.ok(bevestigd.beweringen.some(x => /tweede moment/.test(x.wat) && x.bron),
    'en het tweede moment staat er MET een bron: ' + JSON.stringify(bevestigd.beweringen).slice(0, 300));
  assert.equal(u.body.keten.ok, true, 'en de bonketen klopt van voor naar achter');
});

test('6. een verlopen RTG-inlog bevestigt niets', async () => {
  /* De tweede sleutel erft zijn sterkte van de inlog eronder en verzint er
     geen. Een uur later is die inlog niet vers meer, en dan is "ik heb ook een
     RTG-sessie" geen tweede factor maar een oude sessie in een nieuw jasje. */
  await stop(srv);
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_KLOK: '+1u' } });
  BASE = srv.base;

  const vraag = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: dee.lidId, rollen: ZWAAR });
  assert.equal(vraag.status, 428, 'het kwartier is voorbij, dus er wordt weer gevraagd');
  const bon = vraag.body.bevestiging.id;

  const oud = await api('/api/bedrijf/bevestig', { werkruimte: W, lidToken: ada.lidToken, id: bon }, rtg);
  assert.equal(oud.status, 403, 'en een uur oude inlog draagt die bevestiging niet');
  assert.match(oud.body.error, /oud/, JSON.stringify(oud.body).slice(0, 200));

  const naDeWeigering = await api('/api/bedrijf/lid/rollen',
    { werkruimte: W, lidToken: ada.lidToken, lidId: dee.lidId, rollen: ZWAAR, bevestiging: bon });
  assert.equal(naDeWeigering.status, 428, 'een geweigerde bevestiging is geen bevestiging');
});

test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
