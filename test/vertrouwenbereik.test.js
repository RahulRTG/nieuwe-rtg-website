/* LAAG 4, 6, 7 EN 8 VAN DE TRUST FABRIC -- insluiting, bereik, simulatie, staat.

   De rode draad van deze vier is dezelfde: ze mogen niet mooier zijn dan de
   metingen eronder. Een blast radius die te klein rekent is gevaarlijker dan
   geen blast radius, want hij stelt gerust. En een Trust State met vijf nullen
   die niemand heeft uitgerekend, is de schil die dit huis in augustus 2026
   juist heeft weggehaald.

   1. Bevoegdheid kan niet groeien via de werkwoordentabel -- en de controle
      slaat aan op een tabel die dat wel doet.
   2. Het bereik telt alleen rollen die VANDAAG gelden.
   3. De grenzen komen uit dezelfde meter als de poort, en verschuiven mee met
      de gewoonte van die actor.
   4. De simulatie noemt een catastrofaal pad als er een is, en verzwijgt zijn
      blinde vlek niet.
   5. De Trust State telt en verzint niet -- ook niet als het getal ongunstig is.

   Draai los: node --test test/vertrouwenbereik.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../server/kern/vertrouwen/insluiting');
const Br = require('../server/kern/vertrouwen/bereik');
const St = require('../server/kern/vertrouwen/staat');
const G = require('../server/kern/vertrouwen/gewoonte');
const R = require('../server/kern/vertrouwen/register');
const { HANDELINGEN } = require('../server/bedrijf/handeling-lijst');
const { ROLLEN, RECHTEN } = require('../server/bedrijf/rollen-register');

const rechtenVan = (r) => [...new Set((r.rollen || [])
  .flatMap(id => (ROLLEN.find(x => x.id === id) || {}).rechten || []))];

test('1. geen werkwoord breidt bevoegdheid uit -- en de controle kan dat zien', () => {
  assert.deepEqual(I.keurTabel(HANDELINGEN), [], 'de echte tabel is schoon');
  assert.deepEqual(I.keurRollen(ROLLEN, RECHTEN), [], 'en geen rol noemt een recht dat niet bestaat');

  /* DE CONTROLE MOET OOK KUNNEN AANSLAAN, anders is hij decoratie. Een
     werkwoord dat het recht "kennis" vraagt maar een TAAK aanmaakt, geeft
     iedereen met alleen kennis opeens projectrechten -- en de rechtencontrole
     in handeling.js zou keurig het verkeerde recht controleren. */
  const stiekem = { 'taak.sluipweg': { recht: 'kennis', raakt: () => [{ soort: 'taak' }] } };
  const klacht = I.keurTabel(stiekem);
  assert.equal(klacht.length, 1);
  assert.match(klacht[0].reden, /vraagt het recht "kennis" maar raakt taak/);
  assert.throws(() => I.eisTabel(stiekem), /Bevoegdheid zou kunnen groeien/,
    'en bij het opstarten gooit hij: een server met een amplificatiepad hoort niet te starten');

  /* En een soort die niemand heeft gewogen levert ook een klacht, geen stilte. */
  const onbekend = I.keurTabel({ 'x.y': { recht: 'kennis', raakt: () => [{ soort: 'ietsnieuws' }] } });
  assert.match(onbekend[0].reden, /staan niet in SOORT_RECHT/);
});

test('2. het bereik telt alleen rollen die VANDAAG gelden', () => {
  const bak = { werkruimtes: { 'W-1': { naam: 'Klant', leden: { a: { id: 'lid-1', rollen: [
    { id: 'hr' },                                   // geldig
    { id: 'financieel', tot: '2020-01-01' },         // afgelopen
    { id: 'it', van: '2999-01-01' }                  // nog niet begonnen
  ] } } } }, vertrouwen: {} };
  const b = Br.van(bak, 'lid-1', rechtenVan);
  assert.deepEqual(b.werkruimtes[0].rollen, ['hr']);
  assert.deepEqual(b.werkruimtes[0].buitenVenster.sort(), ['financieel', 'it']);
  assert.ok(b.rechten.includes('mens.gevoelig'), 'hr draagt de gevoelige inzage');
  assert.equal(b.rechten.includes('geld'), false, 'en de afgelopen rol geeft niets meer');
  assert.equal(b.rechten.includes('it'), false, 'de toekomstige ook niet');
});

test('3. de grens per soort komt uit dezelfde meter als de poort', () => {
  const bak = { werkruimtes: {}, vertrouwen: {} };
  const kaal = Br.grenzen(bak, 'lid-2').find(g => g.soort === 'mens.uitdienst');
  assert.equal(kaal.ongehinderd, 5, 'zonder eigen grondslag geldt de vaste grens');

  /* Wie dit dagelijks doet, komt verder -- en dat is geen fout maar de hele
     opzet: de drempel meet tegen het eigen normale bereik. Een blast radius die
     dat negeert, rekent voor de salarisadministratie veel te klein. */
  for (let i = 0; i < 40; i += 1) G.noteer(bak.vertrouwen, 'lid-2', 'mens.uitdienst', 300);
  const gewend = Br.grenzen(bak, 'lid-2').find(g => g.soort === 'mens.uitdienst');
  assert.ok(gewend.ongehinderd > 200, 'de gewoonte verschuift de grens mee: ' + gewend.ongehinderd);

  const vernietig = Br.grenzen(bak, 'lid-2').find(g => g.soort === 'tenant.vernietig');
  assert.equal(vernietig.ongehinderd, 0, 'en een soort met een ondergrens komt nooit ongehinderd door');
  assert.match(vernietig.reden, /onherstelbaar/);
});

test('4. de simulatie noemt het catastrofale pad, en verzwijgt zijn blinde vlek niet', () => {
  const bak = { werkruimtes: {}, vertrouwen: {} };
  const u = Br.simuleer(bak, 'lid-3', { rechtenVan, alleRechten: RECHTEN });

  /* Een catastrofaal pad is ONOMKEERBAAR EN ONGEHINDERD. Vandaag zijn dat er
     twee -- de uitvoer en de gevoelige inzage -- en die staan er dus, want een
     simulator die alleen goed nieuws geeft is een folder. */
  assert.ok(u.catastrofaal.length >= 1, 'de stand van vandaag is niet nul, en dat hoort er te staan');
  assert.match(u.oordeel, /ongehinderd kan doen/);
  for (const c of u.catastrofaal) {
    const s = R.soort(c.soort);
    assert.equal(s.omkeerbaar, false, c.soort + ' hoort onomkeerbaar te zijn om zo te tellen');
  }

  assert.ok(u.tegengehouden.some(t => t.soort === 'tenant.vernietig'), 'en wat wel bewaakt is, staat apart');
  assert.ok(u.kanNiet.length, 'wat deze actor NIET kan is het antwoord waar een CIO naar zoekt');
  assert.ok(u.nietGemodelleerd.some(n => /onbekende kwetsbaarheden/.test(n.wat)),
    'een berekend bereik zegt wat het MODEL weet en niet wat de aanvaller kan');

  /* DE REGEL IS EEN EN, EN BEIDE HELFTEN MOETEN TELLEN. Hierboven stond een
     assertie die dezelfde simulatie tweemaal draaide en dus niets vaststelde.
     Dit is wat er wel te bewijzen valt met het echte register: een soort die
     ONOMKEERBAAR is maar wordt tegengehouden telt niet mee, en een soort die
     ONGEHINDERD is maar omkeerbaar ook niet. Alleen samen. */
  const namen = u.catastrofaal.map(c => c.soort);
  assert.equal(namen.includes('tenant.vernietig'), false,
    'onomkeerbaar maar bewaakt is niet catastrofaal maar bewaakt');
  assert.equal(R.soort('mens.uitdienst').omkeerbaar, true);
  assert.ok(u.kan.some(k => k.soort === 'mens.uitdienst'), 'die kan hij ongehinderd doen');
  assert.equal(namen.includes('mens.uitdienst'), false,
    'ongehinderd maar omkeerbaar is hooguit vervelend');
});

test('5. de Trust State telt, en verzint niets -- ook geen gunstige nul', () => {
  const s = St.staat({ bonnen: [], ongewogen: 0 }, HANDELINGEN);
  const bij = (wat) => s.eigenschappen.find(e => new RegExp(wat).test(e.wat));

  assert.equal(bij('bevoegdheid').aantal, 0, 'de tabel is schoon, dus deze staat op nul');
  assert.equal(bij('gebroken schakels').aantal, 0);
  for (const e of s.eigenschappen) assert.ok(e.bron && e.bron.length > 10, e.wat + ' zonder bron');

  /* HET ONGUNSTIGE GETAL, en dat is de kern van deze toets. Vijf van de zes
     soorten hebben geen poort: ze worden wel gemeten en niet tegengehouden.
     Dat hoort als getal op de HUD te staan en niet weggerond te worden. */
  const zonder = bij('niet tegengehouden');
  assert.ok(zonder.aantal > 0, 'dit huis houdt nog lang niet alles tegen, en dat staat er');
  assert.ok(zonder.details.includes('tenant.uitvoer'));
  assert.equal(zonder.details.includes('tenant.vernietig'), false, 'die heeft er wel een');

  /* En wat niet te meten is, staat als niet-gemeten MET reden. */
  assert.ok(s.nietGemeten.length >= 3);
  for (const n of s.nietGemeten) assert.ok(n.reden.length > 40, n.wat + ' zonder echte reden');
  assert.ok(s.nietGemeten.some(n => /virusdefinities/.test(n.wat)),
    'de scanner die zijn eigen versheid niet meet, staat er ook op');

  /* De teller van ongewogen handelingen is echt en niet vastgezet. */
  assert.equal(St.staat({ bonnen: [], ongewogen: 7 }, HANDELINGEN)
    .eigenschappen.find(e => /ongewogen/.test(e.wat)).aantal, 7);
});

/* ---------- de scanner die zijn eigen versheid meet ----------

   Dit was de stilste faalvorm die dit huis had: een virusscanner met definities
   van drie maanden oud meldt "schoon" op precies dezelfde manier als een verse.
   Alles werkt, niets klaagt, en de bescherming is weg. */
const C = require('../server/kern/clamd');

test('7. de definitiedatum wordt gelezen, en een onleesbaar antwoord levert een reden', () => {
  const goed = C.leesVersie('ClamAV 1.5.3/27340/Mon Aug 24 09:00:00 2026');
  assert.equal(goed.definitieDatum, '2026-08-24T09:00:00.000Z');
  assert.equal(goed.definities, '27340');

  for (const raar of ['ClamAV 1.5.3', 'ClamAV 1.5.3/27340/geen datum', '', null]) {
    const u = C.leesVersie(raar);
    assert.equal(u.definitieDatum, null, JSON.stringify(raar) + ' hoort geen datum op te leveren');
    assert.ok(u.reden && u.reden.length > 20, 'en wel een reden: ' + JSON.stringify(raar));
  }
});

test('8. oude definities zijn een getal op de HUD, geen stilte', () => {
  const dagen = (n) => ({ definitieDatum: new Date(Date.now() - n * 86400000).toISOString() });
  const bij = (s) => s.eigenschappen.find(e => /verouderde virusdefinities/.test(e.wat));

  const vers = St.staat({ bonnen: [] }, HANDELINGEN, dagen(0));
  assert.equal(bij(vers).aantal, 0);
  const oud = St.staat({ bonnen: [] }, HANDELINGEN, dagen(3));
  assert.equal(bij(oud).aantal, 1, 'drie dagen oud is te oud');
  assert.match(oud.eigenschappen.find(e => /verouderde/.test(e.wat)).details[0], /uur oud/);

  /* DE TWEE MANIEREN OM HEM TE MISSEN ZIJN NIET DEZELFDE, en geen van beide
     levert een nul op. "Geen clamd in deze opstelling" is een feit over de
     omgeving; "clamd draait maar zegt niets" is een echt gat. */
  const geenClamd = St.staat({ bonnen: [] }, HANDELINGEN, null);
  assert.equal(bij(geenClamd), undefined, 'geen eigenschap zonder meting');
  const g1 = geenClamd.nietGemeten.find(n => /virusdefinities/.test(n.wat));
  assert.match(g1.reden, /geen clamd geconfigureerd/i);

  const stil = St.staat({ bonnen: [] }, HANDELINGEN, { definitieDatum: null, reden: 'gaf niets terug.' });
  const g2 = stil.nietGemeten.find(n => /virusdefinities/.test(n.wat));
  assert.match(g2.reden, /draait maar gaf geen leesbare definitiedatum/);
  assert.match(g2.reden, /precies zoals een verse/, 'met waarom dat erg is');
});

/* ---------- het anker: het enige dat kopafknipping ziet ---------- */
const BON = require('../server/kern/vertrouwen/bon');

test('9. de hashketen ziet geen KOPAFKNIPPING -- het anker wel', () => {
  const bak = {};
  const gegevens = (doel) => ({ soort: 'tenant.vernietig', doel, aantal: 1, actor: 'user-1',
    blootstelling: { gemeten: true, aantal: 1, eenheid: 'tenants', zwaarte: 'uitzonderlijk',
      drempel: 1, grondslag: 'vast' }, stapop: { nodig: true }, bevestigd: true,
    poort: 'techAuth', uitgevoerd: true });
  for (const d of ['O-1', 'O-2', 'O-3', 'O-4']) BON.schrijf(bak, gegevens(d));

  const anker = BON.ankerPunt(bak);
  assert.ok(anker, 'er valt een momentopname van de kop te maken');
  assert.equal(BON.tegenAnker(bak, anker).ok, true, 'ongeschonden klopt hij');

  /* Iemand knipt de twee nieuwste bonnen eraf. De keten die overblijft is van
     voor naar achter PERFECT -- dat is precies het punt. */
  bak.bonnen.splice(0, 2);
  assert.equal(BON.controleer(bak).ok, true,
    'de hashketen zelf ziet hier niets: dat is de aanvalsklasse waar hij niet tegen beschermt');
  assert.equal(BON.tegenAnker(bak, anker).ok, false, 'en het anker ziet het wel');
});

/* ---------- en de drie deuren, over HTTP ----------

   Zonder deze toets zijn het drie endpoints die niemand ooit heeft aangeroepen,
   en dan is "een beheerder kan het bereik van een account opvragen" een
   bewering zonder bron. Ze staan achter de eigenaar, en juist dat hoort
   nagelopen te worden: een blast radius is een kaart van de zwakke plekken. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bereik-'));
let srv, base;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('6. de drie deuren doen wat ze beloven, en niet meer', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const tech = (await api('/api/techniek/inloggen',
    { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;

  /* Zonder sleutel komt niemand erlangs -- dit is de kaart van de zwakke
     plekken, en die hoort niet open te liggen. */
  assert.equal((await api('/api/techniek/vertrouwen/bereik', { actor: 'x' })).status, 401);
  assert.equal((await api('/api/techniek/vertrouwen/staat', {})).status, 401);

  /* Een werkruimte met een lid, zodat het bereik iets te tellen heeft. */
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Bereikklant BV' });
  const ruimte = w.body.werkruimte, beheer = w.body.beheerToken;
  const l = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam: 'Pia' });
  const lidId = l.body.lidId;
  await api('/api/bedrijf/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId, rollen: ['hr'] });

  const zonder = await api('/api/techniek/vertrouwen/bereik', {}, tech);
  assert.equal(zonder.status, 400, 'zonder actor valt er niets te rekenen');

  const b = await api('/api/techniek/vertrouwen/bereik', { actor: lidId }, tech);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 160));
  assert.equal(b.body.werkruimtes.length, 1, 'hij vindt de werkruimte van dit lid');
  assert.ok(b.body.grenzen.length, 'en per soort een grens');
  assert.ok(b.body.nietGemodelleerd.length, 'met de blinde vlek erbij');

  const sim = await api('/api/techniek/vertrouwen/simuleer', { actor: lidId }, tech);
  assert.equal(sim.status, 200);
  assert.ok(sim.body.kanNiet.length, 'wat deze actor niet kan, staat erbij');
  /* Het oordeel hoort te KLOPPEN met de lijst eronder, en niet los daarvan een
     geruststelling te zijn. Dat is de enige zinvolle assertie op een zin. */
  assert.equal(/ongehinderd kan doen/.test(sim.body.oordeel), sim.body.catastrofaal.length > 0,
    'oordeel en lijst horen hetzelfde te zeggen: ' + sim.body.oordeel);

  /* Het anker. Hij MAAKT de momentopname en bewaart hem niet: een anker dat in
     dezelfde database blijft staan is een tweede regel om te wijzigen, en de
     deur zegt dat er ook bij. */
  const a = await api('/api/techniek/vertrouwen/anker', {}, tech);
  assert.equal(a.status, 200);
  /* HIER STOND DAT ER NOG GEEN BON WAS, en dat klopte tot de rolroute een poort
     kreeg: een rol toekennen schrijft sindsdien zelf een Trust Receipt, dus de
     opstelling hierboven heeft er al een. Dat de toets daarop viel is precies
     wat hij hoort te doen -- de bewering was verouderd, niet de code.

     Wat er WEL hoort te staan: een echt anker MET de opdracht hem buiten deze
     database weg te zetten. De volledige ankercyclus staat in toets 9. */
  assert.ok(a.body.anker && a.body.anker.hash, 'er is een kop om te verankeren: ' + JSON.stringify(a.body).slice(0, 160));
  assert.match(a.body.let, /buiten deze database/);

  /* En de lege stand, want die tak bestaat nog steeds. Rechtstreeks op de pure
     functie: een server zonder enige bon is in een e2e niet meer te maken zodra
     de opstelling er zelf een schrijft. */
  const Bon = require('../server/kern/vertrouwen/bon');
  assert.equal(Bon.ankerPunt({}), null, 'geen bonnen, geen kop, geen anker');

  const st = await api('/api/techniek/vertrouwen/staat', {}, tech);
  assert.equal(st.status, 200);
  assert.ok(st.body.eigenschappen.length >= 5);
  for (const e of st.body.eigenschappen) assert.ok(e.bron, e.wat + ' zonder bron op de HUD');
  assert.ok(st.body.nietGemeten.length, 'en wat niet te meten is staat er als zodanig');
  /* In deze opstelling draait geen clamd, dus de scanner hoort als NIET GEMETEN
     te staan met die reden -- en niet als een geruststellende nul. */
  const scan = st.body.nietGemeten.find(n => /virusdefinities/.test(n.wat));
  assert.ok(scan, 'zonder clamd hoort de scannerregel bij nietGemeten te staan');
  assert.match(scan.reden, /RTG_CLAMD_HOST/);
});

test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
