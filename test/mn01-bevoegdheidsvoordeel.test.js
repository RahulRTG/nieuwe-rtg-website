/* MN-01 -- GEEN BEVOEGDHEIDSVOORDEEL, ALS TOETS IN PLAATS VAN ALS ZIN.

   > Geen organisatorische relatie met RTG kan menselijke toestemming
   > vervangen, verruimen, doorgeven of reconstrueren.

   `MENSNETWERK.md` par. 4 noemt dit de eerste van drie constitutionele regels,
   en par. 6 telt eerlijk dat er van de zeven grondwetsregels vandaag TWEE een
   handhaver hebben -- MN-01 "deels". Dat "deels" is precies het probleem: de
   regel wordt vandaag afgedwongen door een AFWEZIGHEID. Er is geen kantoorweg
   naar een machtiging, en `routes/vertegenwoordiging.js` draait achter de
   domeingrens `vertegenwoordiging` en kan per definitie niet bij `kluisAuth`.

   EEN AFWEZIGHEID IS GEEN HANDHAVER. Wie morgen een kantoorroute toevoegt die
   wél bij de machtigingslaag kan, breekt de regel zonder dat er iets rood
   wordt -- en de eerste die het merkt is een cliënt. Dit bestand maakt van die
   afwezigheid een bewering die kan ZAKKEN.

   TWEE HELFTEN, EN ZE BEWIJZEN VERSCHILLENDE DINGEN:

     structureel  geen kantoorroute raakt de machtigingslaag, op EEN verklaarde
                  uitzondering na (de voogdijbeslissing over een minderjarige).
                  Snel, geen server, en het is de helft die het gat dichthoudt.
     de aanvalsproef  de EIGENAAR van RTG -- de sterkste rol die dit huis kent --
                  krijgt met een kantoorsessie nul toegang tot het team van een
                  cliënt. Par. 4 noemt die proef "overtuigender dan tien
                  alinea's", en dat is hij ook.

   WAT HIER NIET WORDT BEWEERD. Dit dekt MN-01 en niet MN-02: dat een
   medewerker via de ledenbalie méér weet is LEGITIEM (par. 0.5), en de regel
   daarover gaat over niet-overdraagbaarheid, niet over gelijkheid. Die staat
   apart.

   Draai los: node --test test/mn01-bevoegdheidsvoordeel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { alleRoutes } = require('../scripts/lib/routes.js');
const { zonderCommentaar } = require('../scripts/lib/bron.js');

const WORTEL = path.join(__dirname, '..');

/* DE ENIGE VERKLAARDE UITZONDERING, met de reden erbij.

   Een voogdijbesluit gaat over een MINDERJARIGE, en dan is er per definitie
   geen meerderjarige cliënt die toestemming kan geven -- dat is juist waarom
   er een mens van het kantoor aan te pas komt. Het is dus geen omweg om de
   toestemming heen maar de plek waar toestemming nog niet kan bestaan.

   Hij staat hier met zijn DEUR erbij: `kluisAuth`, een kantoorsessie op naam.
   De gedeelde backofficecode komt er niet door, want een besluit over het
   gezag over een kind hoort herleidbaar te zijn tot een mens. */
const UITZONDERINGEN = new Map([
  ['POST /api/office/voogdij/besluit', { deur: 'kluisAuth',
    waarom: 'een voogdijbesluit gaat over een minderjarige; daar kan de cliënt zelf geen toestemming geven' }]
]);

/* De laag waar het om gaat. Niet alleen de map: `vertegenwoordiging` komt ook
   uit de kern-tas (`(kern) => { const { vertegenwoordiging } = kern; }`), en
   die weg ziet een require-graaf niet -- zie CLAUDE.md over de kern-tas. */
const RAAKT_DE_LAAG = /kern\/vertegenwoordiging|\bvertegenwoordiging\b/;

const kantoorroute = (r) => String(r.pad || '').startsWith('/api/office/');

test('1. structureel: geen kantoorroute raakt de machtigingslaag, op de voogdij na', () => {
  const perBestand = new Map();
  for (const r of alleRoutes()) {
    if (!kantoorroute(r) || !r.bestand) continue;
    if (!perBestand.has(r.bestand)) perBestand.set(r.bestand, []);
    perBestand.get(r.bestand).push(r);
  }
  assert.ok(perBestand.size > 10, 'er horen ruim kantoorroutes te zijn; nu ' + perBestand.size + ' bestand(en)');

  const overtreders = [];
  for (const [bestand, routes] of perBestand) {
    let bron;
    try { bron = fs.readFileSync(path.join(WORTEL, bestand), 'utf8'); } catch (e) { continue; }
    /* CODE EN GEEN PROZA, en dat is hier geen detail: `routes/office/werk.js`
       NOEMT deze laag in een kop die uitlegt waarom hij er juist niet bij kan.
       Zou dit op de rauwe bron kijken, dan stond een bestand op de
       overtrederslijst omdat het de regel goed had begrepen. Dezelfde les als
       `npm run check` regel 47. */
    if (!RAAKT_DE_LAAG.test(zonderCommentaar(bron))) continue;
    for (const r of routes) {
      const sleutel = r.methode + ' ' + r.pad;
      if (!UITZONDERINGEN.has(sleutel)) { overtreders.push(sleutel + '   (' + bestand + ')'); continue; }
      /* Een uitzondering blijft alleen een uitzondering achter de deur die is
         opgeschreven. Verhuist hij naar de gedeelde kantoorcode, dan is hij
         iets anders geworden. */
      const eis = UITZONDERINGEN.get(sleutel).deur;
      assert.ok((r.bewakers || []).includes(eis),
        sleutel + ' is een verklaarde uitzondering achter ' + eis + ', maar hangt nu aan ' +
        ((r.bewakers || []).join('+') || 'niets') + ' -- een besluit over het gezag over een kind ' +
        'hoort herleidbaar te zijn tot een mens');
    }
  }
  assert.deepStrictEqual(overtreders, [],
    'kantoorroute(s) die bij de machtigingslaag kunnen zonder verklaarde uitzondering:\n  ' +
    overtreders.join('\n  ') + '\n  -- MN-01 zegt dat geen organisatorische relatie met RTG menselijke ' +
    'toestemming kan vervangen. Is dit bedoeld, zet hem dan in UITZONDERINGEN met een reden en een deur.');
});

test('2. de machtigingsroutes zelf staan op de LEDEN-deur en nergens anders', () => {
  /* De keerzijde van toets 1. Daar wordt gemeten dat het kantoor er niet bij
     komt; hier dat de laag zelf niet stilletjes een tweede deur krijgt. Een
     route die `auth` verruilt voor een kantoordeur zou in toets 1 niet
     opvallen, want die kijkt alleen naar paden onder /api/office/. */
  const routes = alleRoutes().filter(r => /^\/api\/vertegenwoordiging\//.test(r.pad));
  assert.ok(routes.length >= 8, 'de laag hoort routes te hebben; nu ' + routes.length);
  const fout = routes.filter(r => !(r.bewakers || []).includes('auth'));
  assert.deepStrictEqual(fout.map(r => r.methode + ' ' + r.pad + ' (' + (r.bewakers || []).join('+') + ')'), [],
    'machtigingsroute(s) die niet op de gewone leden-deur staan -- een tweede deur naar dit domein ' +
    'is een tweede weg naar iemands leven');
});

/* ============================================================================
   DE AANVALSPROEF -- de sterkste rol die dit huis kent, en nul toegang.

   `MENSNETWERK.md` par. 4 zegt het zo: *"maak de eigenaar van RTG zelf manager
   van een testtalent en bewijs dat hij zonder machtiging niets kan. Dat is
   overtuigender dan tien alinea's."* Dit is die proef.

   De EIGENAAR is met opzet gekozen en niet een willekeurige medewerker. Hij
   komt door `officeAuth` zonder code, door `boardroomAuth`, door `kluisAuth`,
   en `isEigenaar()` staat in de identiteitskluis en niet in een verzoek. Kan
   HIJ niets, dan kan niemand met een organisatorische relatie iets -- en dat
   is precies wat MN-01 belooft.

   VIER DEUREN, en ze falen om verschillende redenen. Dat is het punt: een
   enkele weigering kan toeval zijn, vier op vier verschillende gronden is een
   grens. De vierde is de belangrijkste, want daar handelt hij niet NAMENS maar
   ALS.
   ========================================================================== */
const os = require('os');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mn01-'));
let BASE, kind, talentToken, talentCodenaam, talentKey, eigenaarLid, eigenaarKantoor;
let clientToken, agentToken, machtigingId;

const post = (pad, lijf, tok) => fetch(BASE + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(lijf || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  /* RTG_DEMO en een eigen OFFICE_CODE, en allebei om dezelfde reden: deze proef
     heeft de EIGENAAR nodig, en die bestaat alleen in de demo-seed. Zonder hem
     meet de aanvalsproef niets -- en dan zou hij groen staan omdat er niemand
     was om tegen te houden. Dezelfde opstelling als scripts/lib/proefsleutels.js. */
  ({ child: kind, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-MN01' } }));
  const reg = await post('/api/auth/register', { name: 'Test Talent', email: 'mn01talent@x.nl',
    phone: '0612349901', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  talentToken = reg.body.token;
  const st = (await post('/api/state', {}, talentToken)).body.state.user;
  talentCodenaam = st.codename;
  /* De SLEUTEL en niet alleen de codenaam: `req.session.key` heeft de vorm
     `user-<id>`, en dat is precies wat een aanvaller zou meesturen om een
     identiteit te overschrijven. */
  talentKey = 'user-' + st.id;

  /* HET TALENT KRIJGT EEN EIGEN GRENS, en dat is geen aankleding.

     Zonder die grens is het dossier van het talent LEEG, en dan geeft een route
     die per ongeluk de verkeerde sleutel leest exact hetzelfde antwoord als een
     route die het goed doet. Een mutatie die `mijn(req.session.key)` verving
     door `mijn((req.body||{}).key || req.session.key)` bleef daardoor groen:
     het gat stond open en er viel niets te lekken.

     Een toets die alleen op een leeg dossier kijkt, bewijst niets over wie hij
     leest. Dus zet het talent iets herkenbaars, en dan is elk verschil in het
     antwoord van de eigenaar een lek. */
  await post('/api/vertegenwoordiging/grens', { bevoegdheden: ['reis.voorbereiden'] }, talentToken);

  const login = await post('/api/auth/login', { login: 'Rahul', password: 'Imran' });
  eigenaarLid = login.body && login.body.token;
  eigenaarKantoor = await kantoorAlsPersoon(BASE, 'RTG-OFFICE-MN01');

  /* EEN ECHTE MACHTIGING, want zonder die is toets 6 een uitspraak over een
     onbekend id en niet over eigenaarschap.

     De cliënt moet daarvoor door `volwassen()` -- 18 jaar EN A3, dus RTG heeft
     het identiteitsbewijs gezien. Dat is geen bijwerking maar de bedoeling: een
     machtiging waarmee iemand commercieel namens je handelt, hoort niet te
     kunnen op een geboortedatum die je zelf hebt ingetypt. De weg erheen loopt
     via het KANTOOR (`/api/office/verify`, achter kluisAuth), en dat is meteen
     de tweede reden dat stap 1 van deze ronde nodig was: zonder een
     kantoorsessie op naam is deze opstelling niet te bouwen. */
  const c = await post('/api/auth/register', { name: 'MN01 Client', email: 'mn01client@x.nl',
    phone: '0612349902', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  clientToken = c.body.token;
  const cSt = (await post('/api/state', {}, clientToken)).body.state.user;
  const a = await post('/api/auth/register', { name: 'MN01 Agent', email: 'mn01agent@x.nl',
    phone: '0612349903', password: 'geheim123', geboortedatum: '1985-01-01', tier: 'rtg', pasApp: 'rtg' });
  agentToken = a.body.token;

  if (eigenaarKantoor) {
    await post('/api/office/verify', { userId: cSt.id, decision: 'approve',
      faceMatch: true, nationaliteit: 'NL', geboortedatum: '1990-01-01' }, eigenaarKantoor);
  }
  const voorstel = await post('/api/vertegenwoordiging/voorstel', { client: cSt.codename,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'],
    tot: new Date(Date.now() + 100 * 86400000).toISOString() }, agentToken);
  const mid = voorstel.body && voorstel.body.machtiging && voorstel.body.machtiging.id;
  if (mid) {
    const aanvaard = await post('/api/vertegenwoordiging/aanvaard', { id: mid }, clientToken);
    if (aanvaard.status === 200) machtigingId = mid;
  }

  /* Twee sessies van DEZELFDE mens: de eigenaar als lid, en de eigenaar achter
     de kantoordeur. Dat onderscheid is de hele proef -- het gaat er niet om of
     hij ergens binnenkomt, maar of zijn ORGANISATORISCHE rol hem iets geeft
     over het leven van een ander. */

});
test.after(() => {
  stop(kind);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('3. de aanvalsproef: de eigenaar krijgt met een KANTOORsessie niets over een cliënt', async () => {
  assert.ok(eigenaarKantoor, 'geen kantoorsessie; dan meet deze toets niets');
  /* De machtigingsroutes staan op de leden-deur. Een kantoortoken is daar geen
     geldige sessie -- en dat is toets 2 hierboven, nu langs de HTTP-kant. */
  for (const pad of ['/api/vertegenwoordiging/mijn', '/api/vertegenwoordiging/bevoegdheden']) {
    const r = await post(pad, {}, eigenaarKantoor);
    assert.ok(r.status === 401 || r.status === 403,
      pad + ' liet een kantoorsessie binnen (status ' + r.status + '); een kantoorrol is geen cliëntrelatie');
  }
});

test('4. de aanvalsproef: "mijn" komt uit de SESSIE, ook als de eigenaar iets anders meestuurt', async () => {
  assert.ok(eigenaarLid, 'geen eigenaarslogin; dan meet deze toets niets');

  /* DEZE TOETS WAS EERST EEN TAUTOLOGIE, en een mutatie vond dat. Hij vroeg
     `/mijn` met een LEEG lichaam en stelde vast dat het team van de eigenaar de
     codenaam van het talent niet bevat -- maar dat team is leeg, dus dat was
     altijd waar. Met `mijn((req.body||{}).key || req.session.key)` in de route
     bleef hij gewoon groen: het gat stond open en de toets merkte het niet.

     Nu doet hij de AANVAL. MN-01 zegt dat een relatie met RTG toestemming niet
     kan "reconstrueren", en de goedkoopste reconstructie is een veld in het
     lichaam dat de identiteit overschrijft. Er wordt daarom op vijf plausibele
     namen geduwd in plaats van op een: welke van de vijf een route ooit zou
     lezen is niet te voorspellen, en een aanvaller probeert ze allemaal. */
  const leeg = await post('/api/vertegenwoordiging/mijn', {}, eigenaarLid);
  assert.equal(leeg.status, 200, 'de eigenaar is ook gewoon een lid en mag zijn eigen team zien');
  const eigenAntwoord = JSON.stringify(leeg.body);

  for (const veld of ['key', 'client', 'codenaam', 'lid', 'sleutel']) {
    const r = await post('/api/vertegenwoordiging/mijn', { [veld]: talentKey, [veld + '2']: talentCodenaam }, eigenaarLid);
    assert.ok(!JSON.stringify(r.body).includes(talentCodenaam),
      '"mijn" gaf gegevens van een ander lid terug toen "' + veld + '" werd meegestuurd -- de identiteit ' +
      'hoort uit de sessie te komen en niet uit het verzoek');
    assert.equal(JSON.stringify(r.body), eigenAntwoord,
      'het antwoord van "mijn" veranderde door een veld in het lichaam ("' + veld + '"); ook als er geen ' +
      'codenaam lekt is dat een identiteit die van buiten te sturen is');
  }

  /* En dezelfde duw op de simulatie, want die neemt WEL een id aan -- daar is
     het verschil tussen "leest een id" en "leest een identiteit" het smalst. */
  const sim = await post('/api/vertegenwoordiging/simulatie', { id: talentKey, key: talentKey }, eigenaarLid);
  assert.ok(!JSON.stringify(sim.body).includes(talentCodenaam),
    'de simulatie gaf gegevens van een ander lid terug op een meegestuurde sleutel');
});

test('5. de aanvalsproef: de eigenaar kan zichzelf geen machtiging op een cliënt geven', async () => {
  /* Hij mag een VOORSTEL doen -- dat mag iedereen, het is een vraag. Wat hij
     niet kan is het zelf aanvaarden: aanvaarden doet de cliënt (toets 13 van
     test/vertegenwoordiging.test.js), en daar is geen kantoorweg omheen.
     Vandaag strandt hij al eerder, op de 18+-poort, en dat is de eerlijke
     uitkomst: er staat GEEN pad open, niet een pad dat later dichtgaat. */
  const v = await post('/api/vertegenwoordiging/voorstel', { client: talentCodenaam,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'],
    tot: new Date(Date.now() + 100 * 86400000).toISOString() }, eigenaarLid);
  assert.ok(v.status >= 400,
    'de eigenaar kreeg een machtiging op een cliënt zonder dat die cliënt iets heeft aanvaard (status ' +
    v.status + ') -- dat is MN-01 in één aanroep');
  assert.ok(String(v.body.error || '').length > 10, 'een weigering draagt een reden (GRAMMATICA.md)');
});

test('6. de aanvalsproef: de eigenaar kan NIET handelen op een machtiging die WEL werkt', async () => {
  /* DE SCHERPSTE VAN DE ZES, en hij was eerst waardeloos.

     De eerste versie stuurde een verzonnen id (`m-verzonnen-id`) en stelde vast
     dat het afketste. Dat bewijst alleen dat een ONBEKEND id wordt geweigerd --
     niets over eigenaarschap. Erger nog: hij stuurde dat id in het veld `mid`
     terwijl de route `id` leest, dus de route kreeg een lege string en zou ook
     hebben geweigerd als er geen enkele controle in zat.

     Wat het wél bewijst is dit: EEN machtiging, ECHT aanvaard door de cliënt,
     en twee aanroepen erop. De gemachtigde agent krijgt 200. De eigenaar van
     RTG krijgt op HETZELFDE id 404. Het id is dus aantoonbaar geldig, en het
     enige verschil is wie het vraagt. Dat is MN-01 in twee regels. */
  assert.ok(machtigingId, 'geen echte machtiging opgezet; dan meet deze toets niets');

  const agent = await post('/api/vertegenwoordiging/handel',
    { id: machtigingId, bevoegdheid: 'aanbod.ontvangen' }, agentToken);
  assert.equal(agent.status, 200,
    'de gemachtigde kon niet handelen; zonder die helft bewijst de andere niets: ' +
    JSON.stringify(agent.body).slice(0, 160));

  const baas = await post('/api/vertegenwoordiging/handel',
    { id: machtigingId, bevoegdheid: 'aanbod.ontvangen' }, eigenaarLid);
  assert.equal(baas.status, 404,
    'de eigenaar van RTG handelde namens een cliënt op een machtiging die niet van hem is (status ' +
    baas.status + ') -- en de regel eronder zegt dat geen organisatorische relatie toestemming vervangt');
  assert.match(String(baas.body.error || ''), /heeft deze machtiging niet/i,
    'de weigering hoort te zeggen dat de machtiging niet van hem is, en niet dat zij niet bestaat');
});

test('7. MN-01 geval 7: intrekken werkt onmiddellijk, en raakt de gemachtigde net zo hard', async () => {
  /* Par. 4, geval 7: "machtiging ingetrokken -> beiden verliezen onmiddellijk
     toegang". Hier is de eigenaar niet de aanvaller maar de controle: als de
     agent na intrekking nog kan handelen, is een machtiging geen toestemming
     maar een eenmalige sleutel. */
  assert.ok(machtigingId, 'geen echte machtiging opgezet');
  const weg = await post('/api/vertegenwoordiging/intrek', { id: machtigingId }, clientToken);
  assert.equal(weg.status, 200, 'de cliënt hoort zijn eigen machtiging te kunnen intrekken: ' +
    JSON.stringify(weg.body).slice(0, 140));

  const nog = await post('/api/vertegenwoordiging/handel',
    { id: machtigingId, bevoegdheid: 'aanbod.ontvangen' }, agentToken);
  assert.ok(nog.status >= 400,
    'de gemachtigde kon na intrekking nog handelen (status ' + nog.status + ') -- dan is intrekken een ' +
    'melding en geen grens');
});
