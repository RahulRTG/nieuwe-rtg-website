/* RTG Ledenportaal, backend.
   Start: npm start (of node server/server.js). Draait op http://localhost:3000.
   De kern werkt zonder model. Vrije taal kan lokaal via LOCAL_AI_URL; externe
   aanbieders zijn optionele, expliciete uitwijk. */

/* DE ONDERGRENS VAN DE RUNTIME, en waarom hij hier hard staat.

   De accountsdatabase draait op `node:sqlite`. Die bestaat vanaf Node 22 en
   laadt sinds 22.13 ZONDER `--experimental-sqlite`; de zelf-herstart met die
   vlag die hier stond is daarmee vervallen. Op een oudere Node klapt het pas
   veel later stuk op een `require('node:sqlite')` diep in de opslaglaag -- een
   foutmelding die niets zegt over de echte oorzaak. `LAUNCH.md` beloofde
   bovendien jarenlang "Node 18+", dus dit was geen theoretisch scenario maar een
   gedocumenteerde valkuil.

   Een `engines`-veld in package.json waarschuwt alleen bij `npm install` en doet
   niets bij `node server/server.js`. Daarom staat de grens hier, vóór het eerste
   require: falen op de eerste regel met de reden erbij. De grens staat op 22.13
   en niet op 22.0, want dat is de versie waarop node:sqlite zonder vlag laadt --
   precies wat deze server doet. Zelfde getal als in package.json en .nvmrc. */
const NODE_MINIMAAL = [22, 13];
const nodeDelen = process.versions.node.split('.').map(Number);
if (!Number.isFinite(nodeDelen[0]) ||
    nodeDelen[0] < NODE_MINIMAAL[0] ||
    (nodeDelen[0] === NODE_MINIMAAL[0] && nodeDelen[1] < NODE_MINIMAAL[1])) {
  console.error(
    '[start] Node ' + process.versions.node + ' is te oud. RTG vereist Node ' +
    NODE_MINIMAAL.join('.') + ' of nieuwer, omdat de accountsdatabase op de ' +
    'ingebouwde node:sqlite draait. Zie LIVEGANG.md.'
  );
  process.exit(78);
}

const { idVanKey } = require('./lib/lidsleutel');

/* Wachtwoord-hashing (scrypt) rekent in de libuv-threadpool, die standaard
   maar 4 draden heeft, ongeacht de machine. scrypt is puur rekenwerk, dus de
   juiste maat is: evenveel draden als CPU-kernen (gemeten: op een 4-kernen
   machine brengt meer dan 4 niets, op een 16-kernen machine wel ~4x meer
   gelijktijdige logins). Dit moet gezet zijn VOOR het eerste asynchrone
   crypto/fs-werk, dus hier bovenaan; een expliciete UV_THREADPOOL_SIZE uit
   de omgeving wint altijd. */
if (!process.env.UV_THREADPOOL_SIZE) {
  const kernen = require('os').availableParallelism();
  process.env.UV_THREADPOOL_SIZE = String(Math.max(4, kernen));
}

const express = require('./web');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const rtgKlok = require('./lib/klok');
/* De hashketen onder het inlog-auditlog; zie logInlog verderop voor waarom juist
   dat log eraan hangt. */
const { noteerIn: ketenNoteerIn, verifieer: ketenVerifieer, top: ketenTop } = require('./lib/keten');
const { db, load, save, bijeen, inBundel, bewerkCollectie, economischeBoekingEenmaal, DATA_DIR, STORE, opslagKlaar: opslagMotorKlaar, pgPoolStatus, postgresSchrijfStand, postgresVerzoekMiddleware, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, onExternalChange, grootSupplierSync, grootAantal,
  ledenGidsActief, ledenGidsHaal, ledenGidsAantal, ledenGidsZet, ledenGidsWeg, ledenGidsExact, ledenGidsZoek, ledenGidsHaalWacht,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
  betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal, checkpointSqlite, checkpointGrootboek } = require('./db');
/* De opslagmotor kan technisch geladen zijn terwijl een verplichte
   datamigratie nog niet gecommitte is. Verkeer blijft dan dicht; een groene
   motorstatus alleen is geen groene applicatiestatus. */
let salonMigratieKlaar = false;
let rtfSamenMigratieKlaar = false;
let boardingPassMigratieKlaar = false;
const opslagKlaar = () => opslagMotorKlaar() && accounts.postgresKlaar() &&
  salonMigratieKlaar && rtfSamenMigratieKlaar && boardingPassMigratieKlaar;
const i18n = require('./translate');
const accounts = require('./accounts');
const eigenaar = require('./eigenaar');
const mail = require('./mail');
const logboek = require('./log');
const log = logboek.log;
const testomgeving = require('./testomgeving');
const betaal = require('./betaal');
const systeemKlok = require('./lib/klok');
const { schoon, ledenPrijs, rondEuro, entreeCode, pickupCode, veiligGelijk } = require('./kern/util');
const { totpOk } = require('./kern/totp');
const { publicPartner, weekdagFactor, cvReady, btwSplit } = require('./kern/afgeleid');
const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal } = require('./kern/fiscaal');
const { RUN_STATIONS, ALT_IDEE, coachCache, maakEvents } = require('./kern/events');
const { maakLive } = require('./kern/live');
const { RIT_KETEN, RIT_LEGACY, RIT_MELDING, maakVervoer } = require('./kern/vervoer');
const { VAC_SOORTEN, maakWerk } = require('./kern/werk');
const { AI_TONE, maakAi } = require('./kern/ai');
const { maakKantoor } = require('./kern/kantoor');
const { SHIFT_NAMES, maakPersoneel } = require('./kern/personeel');
const { HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES, maakLeverancier } = require('./kern/leverancier');
const { maakLid } = require('./kern/lid');
const { MELDING_SCOPES, maakErvaring } = require('./kern/ervaring');
const { RETAIL_MATEN, RETAIL_SEIZOENEN, maakRetail } = require('./kern/retail');
const { maakGroothandel } = require('./kern/groothandel');
const { maakModebezorg } = require('./kern/modebezorg');
const { maakZaak } = require('./kern/zaak');
const { maakLidboard } = require('./kern/lidboard');
const { maakAutoverkoop } = require('./kern/autoverkoop');
const { maakBeveiliging } = require('./kern/beveiliging');
const { maakDirectpay } = require('./kern/directpay');
const { maakFonds } = require('./kern/fonds');
const { maakMunten } = require('./kern/munten');
const muntbetaal = require('./muntbetaal');
const factuur = require('./kern/factuur');
const boekhoudkennis = require('./kern/boekhoudkennis');
const { maakTalen } = require('./talen');
const { PASPOORT_NIVEAUS, maakPaspoort } = require('./kern/paspoort');
const { maakOntmoeting } = require('./kern/ontmoeting');

/* Fout-aggregatie zit ALTIJD aan in server/log.js (in-memory, zichtbaar op het
   techniekbord: ERR-01 + de storingslijst) -- dat dekt het groeperen en tonen.
   Daarbovenop kan optioneel EXTERNE bezorging via de eigen fout-melder
   (server/foutmelder.js): een dunne webhook-POST, aan te zetten met
   ERR_WEBHOOK_URL. Zonder blijft de eigen aggregatie gewoon draaien. */
/* ALTIJD MAKEN, OOK ZONDER WEBHOOK. Hier stond dit hele blok achter
   `if (process.env.ERR_WEBHOOK_URL)`, en dan bestond er zonder die variabele
   geen melder-object -- dus kon het techniekbord ook niet TONEN dat er geen
   externe alarmering is. Een ontbrekend alarm hoort zichtbaar te zijn, niet
   afwezig. Zonder url is de melder inert (actief:false) en zegt de zelfproef
   precies wat eraan ontbreekt. */
const foutmelder = (() => {
  try { return require('./foutmelder').maakFoutmelder({ url: process.env.ERR_WEBHOOK_URL || '' }); }
  catch (e) {
    log.warn('de fout-melder kon niet starten (' + (e && e.message) + ').');
    return { melden() {}, async zelfproef() { return { ok: false, reden: 'de fout-melder kon niet starten' }; },
      stand: () => ({ actief: false, geprobeerd: 0, bezorgd: 0, mislukt: 0, laatsteFout: 'niet gestart' }), actief: false };
  }
})();
if (foutmelder.actief) {
  log.onError((err, ctx) => foutmelder.melden(err, ctx));
  log.info('Fout-tracker: eigen webhook-melder actief.');
}

// Vangnet: een niet-afgevangen belofte-afwijzing (bijv. een externe AI- of
// vertaalaanroep die faalt) beeindigt in Node 22 standaard het proces. Voor een
// webserver is dat een crash-DoS: een enkel verzoek zou de actieve server
// kunnen platleggen. We loggen zo'n afwijzing en laten de server doordraaien;
// het verzoek dat hem veroorzaakte krijgt geen antwoord, maar de rest wel.
process.on('unhandledRejection', reason => {
  log.uitzondering(reason instanceof Error ? reason : new Error(String(reason)), { bron: 'unhandledRejection' });
});
// Een niet-afgevangen synchrone uitzondering laat de staat mogelijk half klaar
// achter; we loggen hem mét stack en stoppen netjes, zodat de proces-manager
// (Docker/systemd) ons herstart in plaats van door te draaien op kapotte staat.
process.on('uncaughtException', err => {
  log.uitzondering(err, { bron: 'uncaughtException', fataal: true });
  try { save(); } catch (e) {}
  /* De 200 ms zijn er zodat het log nog wegkomt. Deze timer stond .unref(), en
     dat is het tegenovergestelde van wat hier moet gebeuren: een unref'd timer
     houdt het proces niet wakker. In de praktijk viel dat nooit op, want een
     draaiende server heeft handles zat -- maar het is een val die openligt: was
     dit ooit de laatste handle, dan viel het proces ervoor al om, met exitcode
     0, en een crash die zich voordoet als een nette afsluiting wordt door geen
     enkele proces-manager herstart. Hij houdt het proces nu die 200 ms vast. */
  setTimeout(() => process.exit(1), 200);
});

/* HET ADRES VAN DE LINK IN EEN E-MAIL KOMT NIET UIT HET VERZOEK.

   appUrl() bouwt de links die in onze uitgaande e-mail terechtkomen: de
   bevestigingslink en -- ernstiger -- de wachtwoord-herstellink met een geldig
   token erin. Hij nam daarvoor de Origin- of Host-header over, en die zet de
   aanvrager zelf.

   Dat is een werkende overname. Iemand POST /api/auth/forgot met het adres van
   een ander en `Origin: https://kwaadaardig.example`. Het slachtoffer krijgt een
   ECHTE mail van RTG, van ons adres, met onze tekst -- en een link naar de
   server van de aanvaller, met daarin het echte hersteltoken. Er is geen
   phishing-pagina nodig die op ons lijkt; de mail is van ons.

   In productie mag dat dus niet meer. De volgorde is nu:
   1. APP_URL, als die gezet is. Dat is het antwoord van de beheerder en die
      wint altijd.
   2. Anders, in productie: het eerste domein uit RTG_DOMAINS (dat weet de
      vloot toch al) -- ook uit de omgeving, dus ook niet te sturen.
   3. Anders, in productie: WEIGEREN we te gokken. Liever een link naar
      https://localhost die zichtbaar niet werkt dan een link naar een domein
      dat de aanvrager koos. Dat valt op en wordt gerepareerd; het andere niet.
   4. Buiten productie: gewoon de header, want daar draait het op wisselende
      poorten en is dit precies wat je wilt.

   De config-controle weigert inmiddels iedere productiestart zonder een vast
   geldig APP_URL; deze terugval blijft alleen extra verdediging voor het geval
   deze helper ooit vóór de configuratiekeuring wordt aangeroepen. */
const APP_URL_VAST = (() => {
  const gezet = String(process.env.APP_URL || '').trim();
  if (gezet) return gezet.replace(/\/+$/, '');
  const eerste = String(process.env.RTG_DOMAINS || '').split(',')[0].trim();
  if (eerste) return 'https://' + eerste.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return null;
})();
function appUrl(req) {
  if (APP_URL_VAST) return APP_URL_VAST;
  if (PRODUCTION) return 'https://localhost';
  return (req && req.headers && req.headers.origin) || (req ? req.protocol + '://' + req.get('host') : '');
}

// Fail-fast: weiger te starten als productie onveilig is ingesteld (demo aan,
// geen versleutelingssleutel, standaard-geheimen). Dit stopt het proces vóór
// er ook maar één verzoek binnenkomt.
require('./config').pasToe(process.env, log);

load();

/* Eén blijvende waarheid voor inkomende betalingen, vóór routes en webhooks
   worden bedraad. Ze hangt niet aan Stripe of Mollie: providers leveren alleen
   gebeurtenissen aan. Daardoor kan een zaak van rail wisselen zonder dat de
   betekenis van "betaald" mee verhuist. */
const betaalWaarheid = require('./kern/betaalwaarheid')({
  d: () => db.data, save, crypto, betaal, nu: () => systeemKlok.datum().toISOString(), log
});
const betaalRegie = require('./kern/betaalregie')({
  d: () => db.data, save, betaal, env: process.env, nu: () => systeemKlok.datum().toISOString()
});

/* Het inzagejournaal (wie keek in wiens identiteitskluis) leeft in dezelfde
   duurzame opslag als de rest; hier krijgt het de database en save() aangereikt.
   Meteen na load(), zodat de eerste inzage al een spoor achterlaat. */
require('./inzagelog').zet(db, save);

/* Is het eigenaarschap ooit overgedragen vanuit de boardroom, dan staat de
   opvolger in de database. Dat zetten we hier meteen terug in de eigenaar-
   module, VOOR de routers geladen worden. Anders zou het platform na een
   herstart terugvallen op het startadres en zou de vorige eigenaar er weer
   doorheen komen, terwijl de nieuwe buiten staat. */
try {
  const bewaard = db.data && db.data.techniek && db.data.techniek.eigenaarEmail;
  if (bewaard && eigenaar.zetEigenaarEmail(bewaard)) {
    console.log('[eigenaar] overgedragen eigenaarschap hersteld: ' + eigenaar.eigenaarEmail());
  }
} catch (e) {}
/* accounts.init() draait ook de schemamigraties (server/migraties), dus de
   sso- en scim-tabellen komen daar vandaan. Ze stonden hier even als losse
   aanroep; twee plekken die hetzelfde schema maken is precies hoe ze uit elkaar
   gaan lopen. */
accounts.init();
/* SYNTHETISCHE DATA: ALLEEN IN MAGNAAT TEST.

   Hier stond `NODE_ENV !== 'production' || RTG_DEMO === '1'`, met de belofte
   erboven dat de demo-inlog "nooit per ongeluk open op productie" staat. Die
   belofte was precies verkeerd om: de demo stond AAN zolang niemand NODE_ENV
   had gezet. Op de echte server, op het open internet, was dat het geval.

   Wat er daardoor openstond, nagemeten met twee curl-opdrachten van buitenaf:
   een POST naar /api/login met {"tier":"business"} gaf zonder wachtwoord een
   volledige Business-sessie op naam van de eigenaar, en de backoffice ging open
   met de vaste code 'RTG-OFFICE' die in deze repo te lezen staat -- en achter
   die deur ligt de identiteitskluis met echte namen en paspoortscans.

   Een slot dat opengaat als iemand iets vergeet is geen slot. De echte vier
   werelden hebben daarom geen demo-stand. Alleen de afzonderlijke Magnaat-
   testomgeving mag synthetische accounts en gegevens laden. */
const DEMO = testomgeving.actief(process.env);
// Het eigenaarsaccount (Rahul Imran Ismail), zodat Rahul/Imran ook via de
// echte accountlogin werkt. Bestaat het account al (een oudere lokale
// database), dan krijgt het hier de juiste naam; de kluis blijft de bron.
// Sync-varianten: de seed draait voor 'listen', dus blokkeren kan geen kwaad
// en zodra de poort opengaat bestaan de accounts gegarandeerd (geen race in tests).
/* Waarom dit een FUNCTIE is en niet gewoon een blok.

   In Postgres-modus is deze bootstrap tweemaal nodig. Hij draait hier, bij het
   laden -- en daarna haalt accounts.startPostgres() de gedeelde users-tabel op
   en zet die er met "Postgres wint" overheen. Dat is de juiste regel voor echte
   data, maar hij draaide zo ook de demo-bootstrap terug. Gevolg: de eigenaar kon
   op een gedeelde database niet inloggen met het demo-wachtwoord, de boardroom
   bleef dicht, en De Beproeving kon haar schakelkast niet op "alles aan" zetten.
   Twee volledige 100M-runs hebben daardoor tegen de standaard-functiestand
   gemeten terwijl er "alles aan" in het rapport stond.

   Het commentaar hierboven redeneerde over de volgorde ten opzichte van
   'listen'. Dat klopte -- tot de Postgres-spiegel eronder kwam. */
function zetEigenaarsAccountEens() {
  const DEMO_WACHTWOORD = process.env.DEMO_PASS || 'Imran';
  /* EN HET WACHTWOORD OOK ALS HET ACCOUNT AL BESTOND. Dat gebeurde niet, en
     daarmee was de demo-stand een garantie die alleen gold op een verse
     database -- precies wanneer je hem niet nodig hebt. Op een gedeelde
     Postgres kwam de rij ergens anders vandaan en was het wachtwoord
     onbekend. "Demo" hoort een bekende, herhaalbare toestand te betekenen.
     Dit staat achter DEMO en draait dus nooit in productie. */
  const bijwerken = (rij) => {
    let x = rij;
    if (accounts.realNameOf(x) !== 'Rahul Imran Ismail') x = accounts.renameUser(x.id, { username: 'Rahul', realName: 'Rahul Imran Ismail' });
    accounts.setPasswordZaai(x.id, DEMO_WACHTWOORD);
    accounts.setVerification(x.id, 'verified');
    return x;
  };
  let u = accounts.findByLogin(eigenaar.OWNER_EMAIL);
  if (!u) {
    /* Nog geen account op het eigenaarsadres. Op een verse database maken we er
       een; op een database die al demoleden bevat draagt de seed-persona de
       naam Rahul al, en verhuizen we die naar het eigenaarsadres. Anders zou
       de inlognaam botsen en bleef de eigenaar buiten de boardroom staan. */
    const bestaand = accounts.findByLogin('Rahul');
    if (bestaand) {
      u = accounts.renameUser(bestaand.id, { username: 'Rahul', realName: 'Rahul Imran Ismail', email: eigenaar.OWNER_EMAIL });
      accounts.setPasswordZaai(u.id, DEMO_WACHTWOORD);
      accounts.setVerification(u.id, 'verified');
    } else {
      u = accounts.createUserZaai({ username: 'Rahul', email: eigenaar.OWNER_EMAIL, password: DEMO_WACHTWOORD, tier: 'business', realName: 'Rahul Imran Ismail', phone: '+31612345678' });
      accounts.saveMemberState(u.id, demoLidInhoud());
      accounts.setVerification(u.id, 'verified'); // demo-account is al geverifieerd
    }
  } else {
    if (accounts.realNameOf(u) !== 'Rahul Imran Ismail') u = accounts.renameUser(u.id, { username: 'Rahul', realName: 'Rahul Imran Ismail' });
    /* EN HET WACHTWOORD OOK ALS HET ACCOUNT AL BESTOND. Dat gebeurde niet, en
       daarmee was de demo-stand een garantie die alleen gold op een verse
       database -- precies wanneer je hem niet nodig hebt. Op een gedeelde
       Postgres kwam de rij ergens anders vandaan en was het wachtwoord
       onbekend. "Demo" hoort een bekende, herhaalbare toestand te betekenen.
       Dit staat achter DEMO en draait dus nooit in productie. */
    accounts.setPasswordZaai(u.id, DEMO_WACHTWOORD);
    accounts.setVerification(u.id, 'verified');
  }
  /* De sleutelbos van de eigenaar: alles zien en alles doen met het ene
     account. De kantoor- en zaak-rol staan er standaard aan gekoppeld, dus
     na de leden-inlog is elke werkplek een rolkeuze, geen tweede inlog. */
  if (u) {
    if (!db.data.accountRollen || typeof db.data.accountRollen !== 'object') db.data.accountRollen = {};
    const sleutelbos = db.data.accountRollen['user-' + u.id] =
      Array.isArray(db.data.accountRollen['user-' + u.id]) ? db.data.accountRollen['user-' + u.id] : [];
    if (!sleutelbos.some(r => r.rol === 'kantoor')) sleutelbos.push({ rol: 'kantoor', at: new Date().toISOString() });
    if (!sleutelbos.some(r => r.rol === 'zaak')) {
      const zc = (process.env.DEMO_SUPPLIER || 'KIKUNOI').toUpperCase();
      const zaak = (db.data.suppliers || []).find(s => s.code === zc);
      sleutelbos.push({ rol: 'zaak', code: zc, zaakNaam: zaak ? zaak.name : zc, naam: 'Beheer', at: new Date().toISOString() });
    }
    save();
  }
}

/* EEN VERLOREN RACE IS GEEN FOUT, ook hier niet.

   De vloot start leden, kantoor en rtf als aparte processen op dezelfde
   accountsdatabase. Alle drie kijken ze of het eigenaarsaccount bestaat, alle
   drie zien ze van niet, en alle drie maken ze het aan -- waarna twee van de
   drie fataal omvallen op UNIQUE constraint failed: users.username. Dat was de
   tweede helft van de flake in test/vloot.test.js; de eerste helft zat in
   server/migraties/index.js en is daar met een slot opgelost.

   Hier past geen slot maar een herlezing: de bedoeling van deze functie is
   IDEMPOTENT -- zorg dat de eigenaar bestaat -- dus een botsing op de unieke
   sleutel betekent dat een ander proces het al heeft gedaan. Dan kijken we
   opnieuw, en die tweede ronde vindt het account en loopt door. Elke andere
   fout blijft staan zoals hij is.

   Een keer opnieuw en niet in een lus: na de botsing BESTAAT de rij (SQLite
   commit synchroon), dus ziet de tweede ronde hem nog steeds niet, dan is er
   iets anders aan de hand dan drukte. */
function zetEigenaarsAccount() {
  try { return zetEigenaarsAccountEens(); }
  catch (e) {
    const bericht = String((e && e.message) || e);
    if (!/UNIQUE constraint failed: users\./.test(bericht)) throw e;
    return zetEigenaarsAccountEens();
  }
}
// bij het laden; in Postgres-modus nogmaals na de gedeelde pull (zie onder)
if (DEMO) zetEigenaarsAccount();
/* GEEN EIGENAAR IN PRODUCTIE: ZEG HET, EN ZEG HET LUID.

   Buiten demostand maakt niets dit account aan. Zolang het er niet is, staat de
   technische pagina voor niemand open -- dat is de veilige kant. Maar het is
   ook een half afgemaakte installatie, en dat hoort de beheerder te WETEN in
   plaats van er tegenaan te lopen.

   Tot vandaag was er nog een tweede reden: de registratieroute kon dat account
   maken, dus wie het eigenaarsadres als eerste registreerde kreeg het platform.
   Die route is nu dicht (routes/auth/account.js). Deze melding blijft, want een
   installatie zonder eigenaar is nog steeds een installatie die af moet. */
if (!DEMO) {
  try {
    if (!accounts.findByLogin(eigenaar.eigenaarEmail()))
      log.warn('Er is nog GEEN eigenaarsaccount (' + eigenaar.eigenaarEmail() + '). '
        + 'De technische pagina en de boardroom blijven dicht tot het bestaat. '
        + 'Maak het bewust aan; via de openbare registratie kan het niet meer.');
  } catch (e) { /* accounts nog niet klaar: dan meldt de golive-keuring het */ }
}

/* Het demopersoneel per leverancier staat als pure data in een kern-module. */
const STAFF_SEED = Object.assign({}, require('./kern/staffseed').STAFF_SEED, require('./kern/staffseed2').STAFF_SEED);
// demopersoneel bestaat alleen in demostand; in productie komt personeel
// uitsluitend via de eigen zaak binnen (uitnodiging + eigen pincode)
if (DEMO) {
  /* Later toegevoegde demo-zaken (zoals De Ibiza Bode) ook op bestaande
     demo-databases aanvullen; de verse seed draait immers maar een keer. */
  for (const s of require('./seed/leveranciers').suppliers) {
    if (!db.data.suppliers.some(x => x.code === s.code)) db.data.suppliers.push(JSON.parse(JSON.stringify(s)));
  }
  for (const [code, people] of Object.entries(STAFF_SEED)) {
    /* heling: bij een allereerste start kunnen de drie werkers tegelijk
       countStaff 0 zien en elk seeden; dubbele seed-rijen (zelfde naam+rol)
       worden hier bij elke start weer opgeruimd */
    const seedNamen = new Set(people.map(p => p[0] + '|' + p[1]));
    const gezien = new Set();
    for (const st of accounts.listStaff(code)) {
      const k = st.name + '|' + st.role;
      if (seedNamen.has(k) && gezien.has(k)) accounts.deactivateStaff(st.id); else gezien.add(k);
    }
    if (accounts.countStaff(code) === 0) {
      /* createStaffZaai en niet createStaffSync: dit zijn 183 rijen met een
         pincode die twee regels hierboven te lezen is. Op volle scrypt-kosten
         duurde deze lus alleen al twintig seconden voor 'listen' -- zie
         server/accounts/wachtwoord.js bij hashDemoSync voor het waarom en de
         drie grendels eromheen. */
      people.forEach(([name, role, func], i) => accounts.createStaffZaai({ supplierCode: code, name, role, func, pin: i === 0 ? '1234' : '5678' }));
    }
  }
  // het restaurant en de beachclub zijn verbonden in het personeelsnetwerk,
  // zodat het wisselen van afdeling (geaccrediteerd personeel) te proberen is
  const net = db.data.supplierNet = db.data.supplierNet || { links: [], gesprek: {} };
  if (!Array.isArray(net.links)) net.links = [];
  if (!net.links.some(l => [String(l.a), String(l.b)].sort().join('|') === 'KIKUNOI|VORA')) {
    net.links.push({ a: 'KIKUNOI', b: 'VORA', status: 'akkoord', doorCode: 'KIKUNOI', at: new Date().toISOString(), beslistAt: new Date().toISOString() });
  }
  // Demo van de "1x aanmelden"-inlog: een RTG-lid dat bij twee bedrijven op het
  // rooster staat. Log in de personeels-app in met nora@rtg.example / werk en je
  // landt meteen bij Sal de Mar, met Vora Beach Club als tweede werkplek om naar
  // te wisselen. De personeelsrijen bestaan al (Nora Prins); we koppelen ze aan
  // dit account via member_id, zodat de inlog ze allebei vindt.
  try {
    let nora = accounts.findByLogin('nora@rtg.example');
    if (!nora) {
      nora = accounts.createUserZaai({ username: 'nora', email: 'nora@rtg.example', password: process.env.DEMO_STAFF_PASS || 'werk', tier: 'rtg', realName: 'Nora Prins', phone: '+31600000002' });
      accounts.setVerification(nora.id, 'verified');
    }
    for (const c of ['KIKUNOI', 'VORA']) {
      const rij = accounts.listStaff(c).find(m => m.name === 'Nora Prins');
      if (rij && rij.member_id == null) accounts.setStaffMember(rij.id, nora.id, nora.tier);
    }
  } catch (e) { /* demo-koppeling is optioneel */ }
}

const app = express();

/* ---------- De Zaakdoos (RTG_DOOS_CLOUD gezet) ----------
   Dit proces draait dan op een kastje in de zaak. Online is het een
   doorgeefluik naar de cloud; valt de lijn weg, dan draait alles hier lokaal
   verder en wordt elke zaak-schrijfactie gejournald en later nagespeeld.
   Deze middleware staat bewust voor de body-parsers: het doorgeefluik stuurt
   de rauwe bytes een-op-een door. */
const zaakdoos = require('./kern/zaakdoos')({ db, save, log, dataDir: DATA_DIR }).doos;
if (zaakdoos.actief) {
  app.use((req, res, next) => {
    if (zaakdoos.modusVan() !== 'cloud' || !zaakdoos.magProxy(req.path)) return next();
    zaakdoos.proxy(req, res).then(gelukt => { if (!gelukt) next(); }).catch(() => next());
  });
  // de randcache: media die eerder over de lijn kwam, serveert de doos zelf
  // zodra het doorgeefluik hem niet kan leveren (de lijn is weg)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.path.startsWith('/media/') || zaakdoos.modusVan() === 'cloud') return next();
    const hit = zaakdoos.kasLees(req.originalUrl);
    if (!hit) return next();
    res.set('Content-Type', hit.type);
    res.set('X-Content-Type-Options', 'nosniff');
    res.end(hit.buf);
  });
  console.log('[doos] zaakdoos-modus: doorgeefluik naar', process.env.RTG_DOOS_CLOUD);
}

/* ---------- de voordeurketen staat in ./opzet/verzoekketen.js ----------
   Foutisolatie per verzoek, proxy-vertrouwen, logboek en meting, https + HSTS,
   het schild, De Wacht, de security-headers, de betaal-webhooks (die MOETEN
   voor express.json() staan), de dieptewacht op de body en het
   zaakdoos-journaal. In die volgorde, en die volgorde is de inhoud.

   Twee draden komen hier terug: het schild raadpleegt De Wacht, en de meelezer
   is de RTG AI. Allebei worden verderop in dit bestand gebouwd (na de
   database), dus ze worden laat gebonden via zetWacht/zetRtgai. */
const PRODUCTION = process.env.NODE_ENV === 'production';
const { schild, ssrf, zetWacht, zetRtgai } = require('./opzet/verzoekketen')({
  app, express, log, logboek, db, save, betaal, betaalWaarheid, muntbetaal, zaakdoos, PRODUCTION,
  postgresVerzoekMiddleware,
  opslagKlaar: () => opslagKlaar(),
  // alle drie pas verderop in dit bestand gebouwd; lui doorgegeven
  beveiligVan: () => beveilig,
  muntenVan: () => munten, settleFactuurVan: () => settleFactuur,
  // de opdrachtenrij bestaat pas verderop; de payout-webhook leest hem per verzoek
  opdrachtenVan: () => betaalOpdrachten
});

/* ---------- de poortwachters voor de routers staan in ./opzet/poortwachters.js
   De drie remmen, de functieschakelaars met hun storingswachter, de compressie,
   het scan-net, de RTFoundation-router en de voordeur met de statische
   bestanden. Ook hier een late binding: het scan-net wordt pas gebouwd als
   `beveilig` en `wacht` er zijn (zetScanNet). */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
/* De haak voor eigen domeinen: hij wordt hier leeg meegegeven en pas gevuld
   zodra de webmaker bestaat. Zolang hij leeg is, verandert er niets. */
const eigenWeb = {};
const { rtf, CSP_NONCE, zetScanNet, functies, auditspoor } = require('./opzet/poortwachters')({
  app, express, db, save, log, accounts, eigenaar, PUBLIC_DIR, PRODUCTION, opslagKlaar, eigenWeb,
  // hoisted of verderop in dit bestand; lui doorgegeven
  sseToOffice: (ev, data) => sseToOffice(ev, data),
  sessionFor: t => sessionFor(t),
  findSupplier: c => findSupplier(c),
  sendPushToUser: (u, n) => sendPushToUser(u, n),
  // de bevoegdheidslaag ontstaat pas in kernlaag4b; lui doorgegeven
  bevoegdVan: () => kern.bevoegd
});

/* ---------- modelverrijking (optioneel, lokaal eerst) ---------- */

let anthropic = null;
try {
  // De uitwijk start lokaal. Alleen expliciet ingestelde externe aanbieders
  // volgen; RTG_EXTERNE_AI_UIT sluit die route hard af.
  anthropic = require('./ai').maakAI({ log });
  if (anthropic) {
    i18n.setAnthropic(anthropic);
    const aiStand = require('./ai-stand').beschikbaarheid(anthropic);
    console.log('Modelverrijking actief (' + aiStand.modus + '); aanbieders: ' + anthropic.aanbieders.join(', ') + '.');
  } else {
    console.log('Regelgestuurde werkmodus actief; vrije modelverrijking staat uit.');
  }
} catch (e) {
  console.warn('Modelclient kon niet starten (' + (e && e.message) + '); regelgestuurde werkmodus actief.');
}

/* ---------- personas & sessies ---------- */

/* Codenaam: elke klant krijgt een pseudoniem. Reserveringen, betalingen en
   reisdata staan in onze systemen op de codenaam; de echte naam ligt in een
   gescheiden kluis en wordt pas bij ticketing/check-in eenmalig gekoppeld.
   Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam. */
const PERSONAS = {
  guest:     { name: 'Gast',         full: 'Gast',               since: null,             number: null,                codename: 'GAST' },
  rtg:       { name: 'K. Kiss',    full: 'Katja Kiss',    since: 'Maart 2026',     number: 'RTG · 2026 · 8841', codename: 'Amberen Vos',      geboren: '1994-09-14' },
  lifestyle: { name: 'F. Johanna', full: 'Fleur Johanna', since: 'Augustus 2025',  number: 'LSP · 2025 · 0217', codename: 'Gouden Ibis',      geboren: '1957-02-20' },
  business:  { name: 'R. Imran',   full: 'Rahul Imran',   since: 'November 2025',  number: 'BSP · 2025 · 1104', codename: 'Noordelijke Ster', geboren: '1992-11-30' }
};

/* ---------- leeftijd uit het paspoort ----------
   Elke pas wordt met paspoort aangevraagd, dus de leeftijd van een lid is
   geverifieerd. Die stuurt functies: 15-17 (jeugdlid: geen alcohol, geen
   privejet, altijd vooraf betalen), 18-21 (alcohol volgt de landsgrens van de
   zaak, bijvoorbeeld 20 in Japan) en 21+. Partners zien nooit de
   geboortedatum, hooguit dat de leeftijd geverifieerd is. */
// Zuivere leeftijdshulp zit nu in server/lib/leeftijd.js.
const leeftijdlib = require('./lib/leeftijd');
const leeftijdVan = leeftijdlib.leeftijdVan;
const leeftijdsgroepVan = leeftijdlib.leeftijdsgroepVan;
function geborenVan(sess) {
  if (!sess) return null;
  // een echt account (ook de gratis laag) heeft een paspoort-geboortedatum
  if (sess.account) return (accounts.getMemberState(sess.account.id) || {}).geboren || null;
  if (sess.tier === 'guest') return null; // anonieme demo-gast heeft geen paspoort
  return (PERSONAS[sess.tier] || {}).geboren || null;
}
// de alcoholgrens volgt het land van de zaak (LANDEN staat verderop)
function alcoholGrensVan(s) {
  const land = LANDEN[(s.settings && s.settings.land) || 'NL'] || LANDEN.NL;
  return { grens: land.alcoholLeeftijd || 18, land: land.naam };
}

// sha256(token) -> { tier, key }. In-memory voor snelheid, gespiegeld in
// db.json zodat ingelogde gebruikers een serverherstart overleven.
// Alleen de hash wordt bewaard: wie db.json in handen krijgt, heeft daarmee
// nog geen bruikbare tokens. Sessies verlopen na 30 dagen zonder gebruik.
// De sessie-opslag (Map + hash + remember/forget/lookup) zit in een
// maak…(state)-fabriek; de Map komt terug zodat het herstel-/migratiepad in
// initRealtime er ongewijzigd op blijft werken.
const { maakSessies } = require('./kern/sessies');
const { sessions, tokenHash, rememberSession, forgetSession, forgetSessionDuurzaam, sessionFor,
  koppelBus: koppelSessiesBus, herbouwSessions, TOKEN_TTL_MS } =
  maakSessies({ db, save, crypto,
    // lui: accounts is hier al geladen, maar de pijl houdt de volgorde vrij
    sessieIngetrokken: (sid) => (accounts && typeof accounts.sessieIngetrokken === 'function' ? accounts.sessieIngetrokken(sid) : false) });

/* Inlogpogingen afremmen: per emmer hooguit tien mislukkingen (of de grens die
   de aanroeper meegeeft), daarna vijf minuten wachten. Geldt voor wachtwoorden
   en toegangscodes.

   WAT EEN EMMER IS, BEPAALT WAT DE REM KAN. Een emmer op IP+account remt tien
   gokken van EEN bron op EEN account -- en niets anders. Veertig bronnen op
   hetzelfde account zijn veertig verse emmers, dus een verspreide aanval loopt
   er ongehinderd langs. Daarom hangt de inlog nu ook een emmer op de bron
   alleen en een op het doel alleen (routes/auth/inlog.js), net zoals de
   passkey-kant dat al deed. Gemeten voor de reparatie: 40 gokken op een account
   vanaf 40 adressen leverden nul remmen op.

   DE GRENS IS PER AANROEP INSTELBAAR omdat de emmers niet dezelfde schade
   aanrichten als ze onterecht dichtgaan. Een emmer op IP+account raakt alleen
   de aanvaller; een emmer op de bron alleen kan een heel kantoor achter een
   NAT-adres treffen, en een emmer op het doel alleen kan een vreemde gebruiken
   om iemands account dicht te houden. Die twee staan dus ruimer, en het slot
   duurt bewust maar vijf minuten. */
const loginFails = new Map(); // bucket -> { n, until, laatst }
function tooManyTries(res, bucket) {
  const f = loginFails.get(bucket);
  if (f && f.until > Date.now()) {
    res.status(429).json({ error: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.' });
    return true;
  }
  return false;
}
/* DE BUCKET IS DE DEUR, DE BRON IS DE AANVALLER -- EN DAT ZIJN TWEE DINGEN.

   `bucket` is waar geteld wordt voor de snelheidsrem, en die is met opzet fijn:
   'auth:<ip>:<inlognaam>'. De inlognaam hoort daarin, want anders kan iemand
   het account van een ander op slot zetten door het tien keer fout te raden.

   `bron` is WIE er klopt. Die gaat apart mee naar het beveiligingsjournaal,
   want de noodrem daar stelt een andere vraag: hoeveel AANVALLERS zijn er?
   Telde je daar buckets, dan is een script vanaf een adres dat zes namen
   probeert -- credential stuffing, de meest gewone aanval die er is -- goed
   voor zes "bronnen", en ging het hele platform in onderhoud. Zonder ook maar
   een account te raken. Zie server/beveiliging.js bij noodrem() en
   test/noodrem-bron.test.js.

   Wie geen bron meegeeft valt terug op de bucket. Dat is de oude, te
   schrikachtige stand -- veilig maar luidruchtig -- en hij zegt het er ook bij,
   zodat een vergeten aanroep opvalt in plaats van stil de noodrem te voeden.

   De GRENS staat los van allebei: de deur van een lid gaat na tien pogingen
   dicht, maar een emmer die een heel adres of een heel doelwit telt heeft er
   meer nodig voor hij iemand onterecht buitensluit. Wie niets meegeeft krijgt
   tien. */
let bronLoosGemeld = false;
function noteFailedTry(bucket, bron, limiet) {
  const grens = Number(limiet) > 0 ? Number(limiet) : 10;
  const f = loginFails.get(bucket) || { n: 0, until: 0 };
  f.n += 1;
  /* WANNEER DEZE TELLER MOCHT VERVALLEN WAS EEN GAT. De opruimlus gooide elke
     vijf minuten alles weg wat niets tegenhield -- ook een emmer die nog aan
     het tellen was. Daarmee was de regel in de praktijk "negen mislukkingen per
     opruimronde", en wie zijn gokken doseerde kwam nooit aan de grens. Sinds
     hier een tijdstempel bij staat, ruimt de lus alleen op wat ook echt stil
     is (zie opzet/start.js). */
  f.laatst = Date.now();
  if (f.n >= grens) {
    f.until = Date.now() + 5 * 60000; f.n = 0;
    if (!bron && !bronLoosGemeld) {
      bronLoosGemeld = true;
      try { require('./log').log.warn('noteFailedTry zonder bron (' + String(bucket).split(':')[0] +
        '): de noodrem telt deze deur als aparte aanvaller. Geef req.ip mee.'); } catch (e) {}
    }
    // de rate-limit sloeg aan: dit ziet eruit als brute force op een inlog
    if (beveilig) beveilig.meld('brute-force', 'kritiek',
      'Te veel mislukte inlogpogingen (' + String(bucket).split(':')[0] + '). De inlog is tijdelijk op slot gezet; mogelijk een brute-force-aanval.',
      { bron: bucket, aanvaller: String(bron || bucket) });
  }
  loginFails.set(bucket, f);
}

/* ---------- demo-account: één inlog (Rahul / Imran) voor elk kanaal ----------
   Zo kunt u het klantportaal, de leverancier-app en het personeelskanaal met
   dezelfde gebruikersnaam en wachtwoord uitproberen. De gebruikersnaam is
   hoofdletterongevoelig, het wachtwoord niet. */
const DEMO_USER = (process.env.DEMO_USER || 'rahul').trim().toLowerCase();
const DEMO_PASS = process.env.DEMO_PASS || 'Imran';
const DEMO_SUPPLIER = process.env.DEMO_SUPPLIER || 'KIKUNOI';
function hasCred(body) { return !!body && (body.username != null || body.password != null); }
// tijd-veilig vergeleken: een gewone !== lekt via de reactietijd hoeveel klopt
function checkCred(username, password) {
  const userOk = veiligGelijk(String(username || '').trim().toLowerCase(), DEMO_USER);
  const passOk = veiligGelijk(String(password || ''), DEMO_PASS);
  return userOk && passOk;
}

/* ---------- het inlog-auditlog ----------
   Elke inlogpoging (gelukt of mislukt, op elk kanaal) komt in een afgeschermd
   log: wie, waar vandaan, wanneer. Zo is een aanval of een gestolen code
   achteraf altijd te reconstrueren; het kantoor leest het log in RTG HQ.

   AAN DE KETEN. Dit log is precies wat iemand die binnen is als eerste zou
   willen bijstellen: één mislukte reeks pogingen wegpoetsen en het bezoek is
   nooit gebeurd. Elke regel draagt daarom de hash van de vorige, zodat een
   wijziging of een verwijdering MIDDEN in het log aantoonbaar breekt. Wat dat
   wel en niet tegenhoudt staat in de kop van lib/keten.js -- kort: het ziet
   niet dat iemand de NIEUWSTE regels wegknipt, daar is het anker voor.

   Regels van vóór deze keten dragen geen hash; verifieer() telt die apart en
   veroordeelt ze niet, dus een bestaande installatie gaat hier niet stuk op. */
function logInlog(kanaal, ok, wie, req) {
  const lijst = db.data.securityLog = db.data.securityLog || [];
  ketenNoteerIn(lijst, {
    at: new Date().toISOString(), kanaal, ok: !!ok,
    wie: schoon(wie, 60) || null, ip: String((req && req.ip) || '')
  }, 5000);
  save();
}

/* De ketenstand van het inlog-auditlog: hetzelfde getal dat inzagelog.ketenTop()
   voor het inzagejournaal geeft. Het kantoor toont hem naast het log, zodat
   "klopt dit spoor nog" een antwoord heeft in plaats van een aanname. */
/* HET HANDELINGSSPOOR, als EEN instantie.

   De lijfpoort maakt er zelf ook een aan om de middleware te hangen. Dat mag,
   want het spoor houdt geen staat in het geheugen -- alles staat in
   db.data.handelingLog en de keten wordt per regel uitgerekend. Twee instanties
   schrijven dus in hetzelfde journaal en zien elkaars regels. Wat NIET mag is
   twee verschillende opslagplekken, en die zijn er niet.

   Deze instantie bestaat voor het LEZEN: het kantoor vraagt het hele spoor op,
   een lid alleen zijn eigen regels. Zie ../lib/handelingsspoor.js. */
const handelingsspoor = require('./lib/handelingsspoor')({ db, save });

/* DE ANKERDIENST: het ene getal dat naar buiten moet.

   De keten ziet gesleutel MIDDEN in een spoor. Kopafknipping ziet hij niet --
   wie de nieuwste regels weggooit houdt een kloppende keten over. Daarvoor moet
   er een blok naar een GESCHEIDEN plek, en dat besluit is van een mens.

   Deze dienst verzamelt de koppen van alle journalen en rekent af met een blok
   dat wordt teruggevoerd. Hij schrijft zelf niets weg: een anker dat deze
   software op dezelfde schijf zet, is geen anker. Zie ./lib/ankerdienst.js. */
const ankerdienst = require('./lib/ankerdienst').maakAnkerdienst({ db });
/* WAAR het blok heen gaat is inmiddels wel besloten: een tweede machine binnen
   RTG (./lib/ankerpost.js). Zonder RTG_ANKERPOST_URL doet die post niets en
   zegt hij dat -- geen bestemming blijft "niet in bedrijf". */
const ankerpost = require('./lib/ankerpost').maakAnkerpost({ ankerdienst });
function securityLogKeten() {
  const lijst = (db.data && db.data.securityLog) || [];
  return Object.assign({ top: ketenTop(lijst) }, ketenVerifieer(lijst));
}

/* DE LEVERANCIERSPOORT staat in ./opzet/leverancierpoort.js: de twee
   SSE-wegen, de melding aan een zaak, de code-index, de opzoeking, de poort
   waar elke supplier-route doorheen moet, de persoonseis die daaraan hangt, en
   het activiteitenjournaal. Acht functies die eerst midden in het
   leverancier-blok hieronder stonden.

   HIER EN NIET DAAR, want de dienstenlaag hieronder krijgt findSupplier,
   sseToOffice en sseToSupplier als WAARDE mee. `bus` en `kern` gaan andersom en
   bestaan hier nog niet; die komen daarom als getter binnen (zie de kop daar). */
const { sseToSupplier, sseToOffice, notifySupplier, supplierIndex,
  findSupplier, supplierAuth, persoonsPoort, logActivity } =
  require('./opzet/leverancierpoort')({ db, save, crypto, rtgKlok, sessionFor, DEMO, accounts,
    grootSupplierSync, busGeef: () => bus, kernGeef: () => kern });

/* De dienstenlaag -- live updates (SSE), meldingen en web-push, en de diensten
   die daarop leunen (archief, beveiliging, de Wacht, RTmail, naamlaag, antivirus)
   plus de poortwachters resolveSession en auth -- staat in ./opzet/diensten.js.
   De in- en uitgangslijsten zijn uitgerekend met scripts/blokscan.js, niet met
   de hand bijgehouden. */
const {
  AUTHOR_TIER, SSE_BUFFER_TTL, aiPoort, antivirus, archief, atelierweb, auth, automatisering, 
  beveilig, broadcastSync, bufferEvent, bus, connectedSupplierCodes, dirTouch, 
  ensureSupplierDefaults, etaMinutes, gidsHaal, gidsHaalWacht, gidsWeg, gidsZoekCodenaam, guestsFor,
  haversine, initRealtime, keyVanCodenaam, ledenAantal, leverSse, liveCodename, liveStateFor, 
  mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, naamlaag, nextSseId, notify, ondernemerpoort, pushLive, resolveSession, sessieregister, toestellen, bezitsbewijs, tweefactor, commercieel, commercieelStand, commercieelZet, rtmail, rtmailTeam,
  rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, mailAanname,
  ruimBuffer, salonItemsVan, salonProfielCompleet, salonZichtbaar, sendPush, sendPushToUser, 
  speelOpnieuw, sseBuffer, sseClients, sseSend, sseToCustomer, toRad, webpush, werkmail
  , scanNet, wacht
} = require('./opzet/diensten')({
  DATA_DIR, DEMO, PERSONAS, accounts, crypto, db, eigenaar, findSupplier, i18n,
  ledenGidsAantal, ledenGidsActief, ledenGidsExact, ledenGidsHaal, ledenGidsHaalWacht, ledenGidsWeg, ledenGidsZet,
  ledenGidsZoek, ledenPrijs, maakLive, mail, onExternalChange,
  ordersVanKlant, rtf, save, schild, schoon, sessionFor, sessions, herbouwSessions, sseToOffice, sseToSupplier,
  tokenHash,
  // pas verderop in dit bestand gebouwd; zie de uitleg in diensten.js
  lidBoardUitVan: () => lidBoardUit, lidPadFunctieVan: () => lidPadFunctie
});
koppelSessiesBus(bus);
/* De twee draden terug, hier gezet en niet daar (zie de kop van diensten.js):
   beide worden per verzoek gelezen door middleware die HIERBOVEN al gemount is.
   Ze gingen eerst via een `let` die de middleware en de bedrading deelden; nu
   via een zetter, zodat er geen variabele meer is die twee bestanden nodig
   hebben om hem te begrijpen. */
zetScanNet(scanNet);
zetWacht(wacht);
/* ---------- Salon-rechten (server-side afgedwongen) ----------
   gast: alleen liken; RTG: reageren/dm'en met RTG-leden;
   Lifestyle & Business: volledige interactie met alle leden.
   Wederkerigheid: spreekt een hoger lid een RTG-lid aan (reactie of DM
   op diens post), dan mag dat RTG-lid bij die persoon terugpraten. */
/* De leden-laag (contactregels, memberTemplate, de leden-app-state en de
   eigen sollicitaties) staat in server/kern/lid.js. findSupplier en geborenVan
   zijn hoisted functies en dus hier al bruikbaar. */
/* Wereldtalen (server/talen.js): de Boardroom zet per taal een schakelaar aan of
   uit; iedereen chat in de eigen taal en de ander leest alles in de zijne. Vroeg
   opgezet zodat de leden-laag (en alles daarna) taalVan kan gebruiken. */
const talen = maakTalen({ db, save });
/* Salon-claimcodes zijn bearers en delen daarom een eigen transactionele kern
   tussen de leden- en leveranciersroute. Hij staat vóór de ledenprojectie,
   zodat die uitsluitend statusmetadata en nooit de kale code teruggeeft. */
const salonClaimcode = require('./kern/salon-claimcode')({
  db, save, bewerkCollectie, crypto
});
/* PostgreSQL neemt zijn waarheid pas asynchroon over; die variant draait daarom
   in startPostgresMetSalon en niet vóór de pull. De drie lokale migraties
   draaien verderop samen, zodra ook Samen en Luchthaven zijn opgebouwd. */
const startPostgresMetSalon = () => {
  /* opslagstart roept deze ingang voor elke motor aan. Een lokale standby mag
     daardoor niet via de inerte Postgres-tak ten onrechte "gemigreerd" worden. */
  if (STORE !== 'postgres') return Promise.resolve(false);
  salonMigratieKlaar = false;
  rtfSamenMigratieKlaar = false;
  boardingPassMigratieKlaar = false;
  return Promise.resolve(startPostgres(async () => {
    await salonClaimcode.migreerAlles();
    if (!kern.samenRtf || typeof kern.samenRtf.migreerAlles !== 'function')
      throw new Error('FoundationOS Samen-migratie ontbreekt bij de opslagstart.');
    await kern.samenRtf.migreerAlles();
    if (!kern.lucht || typeof kern.lucht.migreerBoardingPasses !== 'function')
      throw new Error('TravelOS boarding-passmigratie ontbreekt bij de opslagstart.');
    await kern.lucht.migreerBoardingPasses();
  })).then(gestart => {
    salonMigratieKlaar = true;
    rtfSamenMigratieKlaar = true;
    boardingPassMigratieKlaar = true;
    return gestart;
  });
};
// De leden-kern wordt vóór de sociale laag gebouwd; deps.zijnVrienden wordt
// hieronder laat-gebonden gevuld zodra de vriendenlaag bestaat (voor de
// Salon-zichtbaarheid: van een vriend zie je een bericht altijd).
/* geldPasprijzen laat gebonden, net als bij de aanmeldingen: de geld-regie wordt
   verderop gemount, en de ledenfacturen worden pas op request-tijd opgebouwd.
   Zonder deze regel viel lid.js terug op eigen, hard ingetikte bedragen. */
const lidDeps = { db, accounts, PERSONAS, findSupplier, i18n, rtf, talen, leeftijdVan, leeftijdsgroepVan, geborenVan,
  salonClaimcode,
  geldPasprijzen: () => (kern.geldPasprijzen ? kern.geldPasprijzen() : null) };
const lidKern = maakLid(lidDeps);
const { hasContact, addContact, canEngage, engageError, registerContact, stateFor, myApplications,
  ledenInhoudVan, eersteBijdrageFactuur } = lidKern;

/* Startinhoud voor een nieuw account: LEEG -- waarom staat in kern/lid.js, bij
   dezelfde functie. Hoisted en dus ook bruikbaar door de demo-seed hierboven
   (die vóór de leden-kern draait); kern/lid.js is de bron, dit is de doorgifte. */
function memberTemplate() {
  return lidKern.memberTemplate();
}

/* De DEMO-inhoud voor het geseede demo-account: een eigen kopie van de
   voorbeeldreis en -facturen uit de seed. Alleen zetEigenaarsAccount() gebruikt
   dit, en dat draait uitsluitend onder DEMO. Zo blijft de demo een volle app om
   te laten zien wat RTG doet, zonder dat iemand die zich ECHT aanmeldt de reis
   en de rekeningen van een ander in zijn app aantreft. */
function demoLidInhoud() {
  return {
    invoices: JSON.parse(JSON.stringify(db.data.invoices || [])),
    trip: db.data.trip ? JSON.parse(JSON.stringify(db.data.trip)) : null,
    creatorCredit: 0,
    creatorLikes: 0
  };
}




/* Na een reactie/DM van een hoger lid op een RTG-post: leg het contact vast. */

/* ---------- state per gebruiker ---------- */

/* Startinhoud voor een nieuw account: een eigen kopie van de voorbeeldreis en
   -facturen, zodat elk lid zijn eigen boekingen/betalingen heeft (wat de één
   betaalt, verandert niets bij de ander). */


// De sollicitaties van dit lid, over alle partners heen, nieuwste eerst.

/* ---------- endpoints ---------- */

// Liveness: draait het proces? (Voor de load balancer/monitor, altijd 200 als
// het proces leeft.)
app.get('/api/health', (req, res) => {
  const omgeving = testomgeving.status(process.env);
  const model = require('./ai-stand').beschikbaarheid(anthropic);
  res.json({
    ok: true, ...omgeving, ai: model.modus, verwerking: model.verwerking,
    betalen: betaal.AANBIEDER,
    /* `active` is "schrijft dit proces?", `leider` is "doet dit proces het werk
       dat per installatie een keer hoort te gebeuren?". In spreidingsmodus
       (RTG_SPREIDING=1) staat `active` op alle drie de servers op true en is
       `leider` de enige manier om van buitenaf te zien wie de backup maakt.
       Zonder die modus zijn ze altijd gelijk. */
    server: Number(process.env.RTG_SERVER || 1), active: db.writable, leider: !!db.leider,
    domeinen: process.env.RTG_DOMAINS || 'alle',
    pid: process.pid, up: Math.round(process.uptime())
  });
});

/* De satelliet-ping en de /api/doos/-vloot (sleutelwacht, kloon, status,
   meting, buurmelding, rapport) staan in server/routes/doos.js en worden
   verderop met de andere routers gemount, nadat kern klaar is. De proxy- en
   journaallagen die elke aanvraag omhullen, staan hierboven. */

/* Alleen in de testsuite: twee opzettelijke storingen om de foutisolatie te
   BEWIJZEN. /api/test/bug gooit een async fout (die ene aanvraag krijgt 500,
   het proces leeft door); /api/test/crash laat dit proces echt sterven (de
   vloot-toezichthouder moet hem herstarten, de andere apps merken niets). */
if (process.env.NODE_ENV === 'test') {
  app.post('/api/test/bug', async () => { throw new Error('opzettelijke testbug'); });
  app.post('/api/test/crash', (req, res) => { res.json({ ok: true, doei: true }); setTimeout(() => process.exit(1), 50); });
}

// Readiness: mag deze instance verkeer krijgen? Controleert dat de datalaag
// echt bruikbaar is (kan lezen). Een standby- of half-gestarte server geeft 503,
// zodat de load balancer hem overslaat tot hij klaar is.
app.get('/api/ready', (req, res) => {
  let dataOk = false;
  try { dataOk = !!db.data && typeof db.data === 'object'; } catch (e) { dataOk = false; }
  // Echt klaar = de duurzame opslag is geladen. In Postgres-modus telt "geladen"
  // pas als de gedeelde data binnen is en het RAM-venster uit het grootboek is
  // bijgewerkt; zo krijgt een nog warmdraaiende instance nog geen verkeer van de
  // load balancer (het boot-bottleneck-risico bij een herstart onder druk).
  let klaar = dataOk;
  try { klaar = opslagKlaar(); } catch (e) { klaar = false; }
  let intrekking = { gekoppeld: false, soort: 'geen', gereed: false };
  try { intrekking = require('./kern/intreksignaal').stand(); } catch (e) {}
  const redisGereed = !process.env.REDIS_URL ||
    (intrekking.gekoppeld && intrekking.soort === 'redis' && intrekking.gereed);
  klaar = klaar && redisGereed;
  let pool = null;
  try { pool = pgPoolStatus(); } catch (e) { pool = null; }
  res.status(klaar ? 200 : 503).json({
    ready: klaar, data: dataOk, writable: !!db.writable, store: STORE,
    ...(STORE === 'postgres' ? postgresSchrijfStand() : {}),
    ...(pool ? { pool } : {}),
    redis: process.env.REDIS_URL ? 'geconfigureerd' : 'uit', redisGereed,
    intrekking, up: Math.round(process.uptime())
  });
});

/* ---- failover-cluster (server/trio.js): drie servers, een actief ----
   De poortwachter promoveert of degradeert een server via deze endpoints.
   Alleen bereikbaar met de clustersleutel die het trio bij de start deelt;
   draait de server los (zonder sleutel), dan bestaan ze feitelijk niet. */
const CLUSTER_KEY = process.env.RTG_CLUSTER_KEY || null;
app.post('/api/cluster/:actie', (req, res) => {
  /* veiligGelijk en geen !==: dit is de sleutel waarmee een server actief wordt
     gemaakt of teruggezet naar standby, en een gewone vergelijking stopt bij het
     eerste verschillende teken. Op een netwerk waar je duizenden pogingen kunt
     doen is dat een meetbaar verschil per positie. Overal elders in dit huis
     staat al veiligGelijk; uitgerekend de zwaarste knop van het cluster stond
     nog op de kale vergelijking. */
  if (!CLUSTER_KEY || !veiligGelijk(String(req.get('x-rtg-cluster') || ''), CLUSTER_KEY)) return res.status(404).json({ error: 'Onbekend.' });
  const nr = process.env.RTG_SERVER || '1';
  if (req.params.actie === 'promote') {
    /* `promote` maakt schrijvend EN leider; `promote?leider=0` maakt alleen
       schrijvend. Dat tweede is de spreidingsmodus (server/trio-spreiding.js):
       daar nemen alle gezonde servers verkeer aan, maar de klussen die per
       installatie een keer horen te gebeuren blijven bij een. Zonder de
       queryparameter verandert er niets aan wat de poortwachter altijd al deed. */
    const wordtLeider = String(req.query && req.query.leider) !== '0';
    // Eerst schrijfrecht, dan de verse data van schijf laden (bestaat er nog
    // geen database, dan wordt de seed nu ook echt bewaard) en tot slot de
    // realtime-tabellen (sessies, notificaties) opnieuw opbouwen.
    db.writable = true;
    db.leider = wordtLeider;
    try { load(); migreerLokaleToegang(); initRealtime(); } catch (e) {
      db.writable = false;
      db.leider = false;
      return res.status(500).json({ error: 'Data laden of migreren mislukte: ' + e.message });
    }
    console.log('[cluster] server ' + nr + (wordtLeider ? ' neemt over en is nu actief' : ' loopt mee en neemt verkeer aan'));
    /* En meteen een backup. backupData() slaat alles over wat geen leider is
       (die maken er terecht geen), en draait verder alleen op de dagteller. In de
       trio-opstelling start ELKE server als standby, dus tot deze regel was er
       na een overname tot 24 uur lang geen verse backup -- juist in het uur
       waarin er net iets is omgevallen. Een meelopende server valt hier vanzelf
       doorheen: die is wel schrijvend maar geen leider. */
    try { backupData(); } catch (e) { console.warn('[cluster] backup na overname mislukt:', e.message); }
  } else if (req.params.actie === 'demote') {
    db.writable = false;
    db.leider = false;
    console.log('[cluster] server ' + nr + ' gaat terug naar standby');
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  res.json({ ok: true, active: db.writable, leider: !!db.leider });
});



/* ---------- echte accounts (registreren / inloggen) ---------- */








/* ---------- identiteitsverificatie (tegen nepaccounts) ----------
   Een lid uploadt een foto van zijn identiteitsbewijs; RTG keurt die goed in de
   backoffice. Zo weet je zeker dat er een echt mens achter een account zit, en
   kan een geverifieerd lid daarna in één tik boeken.
   Let op (AVG): een ID-document is een bijzonder persoonsgegeven. Het bestand
   wordt buiten de repo bewaard (server/data/uploads, gitignored) en is alleen
   voor de backoffice zichtbaar. Voor productie: versleutel het bestand, bewaar
   het zo kort mogelijk, en gebruik bij voorkeur een gecertificeerde KYC-dienst. */
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

/* Mediastore: Salon-foto's en snaps staan als losse (versleutelde) bestanden op
   schijf, niet als base64 in db.data. Zo blijft het werkgeheugen en elke snapshot
   klein, hoeveel er ook gepost wordt. De publieke Salon-foto's worden via de
   /media-route uitgeserveerd; snaps komen alleen eenmalig als data-URL terug. */
const media = require('./media').maakMedia({ dir: DATA_DIR });
/* RTG Webmaker (kern/webmaker.js): de eigen site van een lid. Staat hier en
   niet eerder omdat hij de mediastore nodig heeft: een foto die uit de
   bibliotheek valt of wordt weggehaald, moet ook van schijf. */
/* Merken met vestigingen (kern/webmerk.js) en de Website-maker kennen elkaar:
   de maker vraagt bij elke bewaring welke huisstijl er voor deze zaak geldt,
   het merk laat zijn hoofdontwerp door de maker uitrollen. Late binding
   daarom -- webmerk bestaat een regel later. */
let webmerk = null;
const webmaker = require('./kern/webmaker')({ db, save, crypto, schoon, media,
  merkHuisstijl: z => webmerk && webmerk.huisstijlVoorZaak(z) });
webmerk = require('./kern/webmerk')({ db, save, scho: schoon, webmaker, findSupplier });
/* De haak vullen die de poortwachters boven express.static hebben gezet: een
   verzoek op een gekoppelde hostnaam krijgt de GEPUBLICEERDE site als HTML.
   De boardroom-schakelaar staat standaard uit; zolang die dicht is gebeurt hier
   niets en valt het verzoek gewoon door naar de site van het huis. */
const webdomeinHtml = require('./kern/webdomein-html');
eigenWeb.serveer = (req, res, next) => {
  try {
    const staat = db.data && db.data.techniek && db.data.techniek.functies;
    if (!functies.functieAan('dom-eigendomein', staat)) return next();
    const host = String(req.headers.host || '').split(':')[0];
    const d = webmaker.siteVoorHost(host);
    if (!d) return next();
    const s = d.zaakCode ? findSupplier(d.zaakCode) : null;
    // wat er BUITEN staat is de gepubliceerde stand, nooit het concept
    const site = webplatform.losSite(webmaker.publiekeStand(d), s, true);
    const pad = req.path === '/' ? '' : req.path.replace(/^\//, '').replace(/\/$/, '');
    const html = webdomeinHtml.render(site, pad);
    if (html == null) return res.status(404).type('text/plain').send('Deze pagina bestaat niet.');
    res.type('html').send(html);
  } catch (e) { next(); }
};
/* RTG Web Platform (kern/webplatform.js): genereert bedrijfssites uit het
   zaakprofiel en lost de live zaakdata-blokken op bij het openen. */
/* Wie van het personeel op de bedrijfssite mag staan: een publicatiebesluit
   van de leiding, geen veld in de personeelsadministratie. */
const webmakerTeam = require('./kern/webmaker-team')({ db, save, listStaff: accounts.listStaff });
const webplatform = require('./kern/webplatform')({ db, team: webmakerTeam });
/* Een site lezen in je eigen taal: dezelfde vertaallaag als de berichten. */
const webplatformTaal = require('./kern/webplatform-taal')({ vertaler: require('./translate') });
// AI in de Website-maker: past een ontwerp aan op een opdracht; bewaart niets zelf
const webmakerAi = require('./kern/webmaker-ai')({ anthropic, schoon });
app.get('/media/:naam', (req, res) => { media.serveer(req, res).catch(() => { if (!res.headersSent) res.status(500).end(); }); });
// Eenmalige verhuizing van al bestaande base64-foto's (Salon + snaps) naar de
// mediastore, zodat ook oude data het geheugen niet meer belast. Alleen de
// schrijver migreert; idempotent, dus veilig bij elke start. Async (kan naar S3).
console.log('[media] opslag-backend:', media.backendNaam);
if (db.writable) {
  media.migreerDb(db)
    .then(n => { if (n > 0) { save(); console.log('[media] ' + n + ' bestaande foto(s) naar de mediastore verplaatst.'); } })
    .catch(e => console.warn('[media] migratie overgeslagen:', e.message));
}

/* Een versleuteld geupload bestand (identiteitsbewijs/selfie) ontsleutelen en
   als data-URL teruggeven, zodat de paspoortlaag een goedgekeurde inzage kan
   tonen. Geen padtraversal: alleen de kale bestandsnaam telt. */
function leesUploadDataUrl(fname) {
  try {
    const file = path.basename(String(fname || ''));
    const full = path.join(UPLOAD_DIR, file);
    if (!file || !full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return null;
    const buf = require('./kluis').ontsleutelBestand(fs.readFileSync(full), file);
    const ext = (file.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  } catch (e) { return null; }
}



/* Live-verbinding. EventSource kan geen Authorization-header sturen, dus het
   token gaat als query-parameter. */
app.get('/api/stream', (req, res) => {
  const token = req.query.token;
  const sess = resolveSession(token);
  if (!sess) return res.status(401).end();
  const isolatieRealtime = require('./middleware/isolatiepoort-realtime');
  const bewaakt = isolatieRealtime.registreer({ res, token, sessie: sess });
  if (!bewaakt.toegestaan) return res.status(bewaakt.status || 503).json(bewaakt.antwoord);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });
  /* Open de SSE-handshake nu. De PostgreSQL-antwoordgrens buffert gewone
     antwoorden tot COMMIT; voor deze read-only stroom is flushHeaders het
     expliciete teken dat de stream veilig mag beginnen. */
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write('retry: 3000\n\n');
  const client = { tier: sess.tier, key: sess.key, res };
  sseClients.push(client);
  // gemiste persoonlijke events opnieuw afspelen (na een korte verbroken verbinding)
  const sinds = Number(req.headers['last-event-id'] || req.query.since || 0);
  if (sinds) speelOpnieuw(res, sess.key, sinds);
  // onopgehaalde notificaties meteen meesturen
  const unread = (db.data.notifications[sess.tier] || []).filter(n => !n.read);
  sseSend(res, 'hello', { unread });
  const ping = setInterval(() => {
    if (!isolatieRealtime.magSchrijven(res)) return clearInterval(ping);
    res.write(': ping\n\n');
  }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    isolatieRealtime.vergeet(res);
    const i = sseClients.indexOf(client);
    if (i >= 0) sseClients.splice(i, 1);
  });
});

// notificaties ophalen / als gelezen markeren
app.post('/api/notifications', auth, (req, res) => {
  res.json({ notifications: db.data.notifications[req.session.tier] || [] });
});
app.post('/api/notifications/read', auth, (req, res) => {
  (db.data.notifications[req.session.tier] || []).forEach(n => n.read = true);
  save();
  res.json({ ok: true });
});

/* ---------- RTFoundation-koppeling: een lid (oppas, opa/oma, familie) koppelt
   met zijn RTG-pas een gezinsprofiel, zodat de meldingen uit dat gezin hier in
   de RTG-app binnenkomen. Zo hoeft hij de RTFoundation-app niet te installeren. */
function eisAccount(req, res) {
  if (!req.session.account) { res.status(403).json({ error: 'Log in met je eigen RTG-account om een gezin te koppelen.' }); return false; }
  return true;
}
// alle gast-gegevens (belangrijke info, agenda, waar iedereen is) van de
// gezinnen waaraan dit lid gekoppeld is, om in de RTG-app te lezen
// het chat-/belkanaal van een gekoppeld gezin (profieltoken + leden) voor de RTG-app
// terugberichten naar het gezin (bijv. de oppas antwoordt op een oproep)

/* ================= SALON-CONNECTIES =================
   Leden voegen elkaar toe op codenaam, sturen elkaar berichten, delen
   Salon-posts en bellen elkaar (audio/video via WebRTC; de server is
   alleen het signaleringskanaal en ziet nooit beeld of geluid). */

// De sociale kern (vrienden, veiligheid, snaps) zit in server/kern/sociaal.js.
/* De sociale laag wordt hier gebouwd, de communicatiekern pas in kernlaag4 --
   dus krijgt hij geen verwijzing naar die kern maar een manier om hem OP TE
   HALEN. Dat is geen omweg om de volgorde heen: de sociale laag heeft de kern
   alleen nodig op het moment dat er echt een bericht langskomt, en tegen die
   tijd staat hij er. Een vaste verwijzing zou hier voor altijd undefined zijn. */
const sociaal = require('./kern/sociaal')({ db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsHaalWacht, gidsZoekCodenaam, media,
  commDm: () => kern && kern.commDm,
  // de ondertekenaar van de levende contactcode, om dezelfde reden opgehaald in
  // plaats van vastgehouden: kern/dyncode.js wordt pas in kernlaag1 gezet
  dyncodeGeef: () => kern && kern.dyncode });
// Verplichte intake (paspoort/e-mail/telefoon/adres/standaard) + contract voor elk
// account, per scope (platform 'rtg' of leverancier-code), AI-aanpasbaar.
const onboarding = require('./kern/onboarding').maakOnboarding({ db, save, crypto, accounts, anthropic, schoon });
// De slimme boerderij-laag (kern/boerderij.js): boerderijtypes, percelen+gewassen,
// dieren, takenbord, seizoensbriefing en een AI-adviseur die ook dingen doet.
const boerderij = require('./kern/boerderij').maakBoerderij({ db, save, crypto, findSupplier, anthropic, schoon });
// Het Journalistiek-genre (kern/journalistiek.js): redactie + eigen krantsite.
const journalistiek = require('./kern/journalistiek')({ db, save, crypto, schoon, findSupplier });
// De content-creator-laag (kern/creator.js): carriere-profiel, platforms, tarieven,
// portfolio, content-kalender en een AI content/script-helper.
const creator = require('./kern/creator').maakCreator({ db, save, crypto, anthropic, schoon });
// De samenwerkingslaag (kern/samenwerking.js): EGn knop tussen creators en
// leveranciers, plus oproepen voor content creators.
const samenwerking = require('./kern/samenwerking').maakSamenwerking({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon });
// De persoonlijke, interactieve AI-agenda (kern/agenda.js) voor leveranciers en
// leden, in de boardroom, met een ballon-badge op de voorkant.
const agenda = require('./kern/agenda').maakAgenda({ db, save, bijeen, inBundel, crypto, anthropic, schoon });
// De centrale facturatielaag (kern/facturatie.js): bij elke verkoop/dienst/verhuur
// automatisch EGn tweezijdige factuur die beide partijen in de app zien, plus een
// AI-factuurtool. Alle apps haken hierop in.
const facturatie = require('./kern/facturatie').maakFacturatie({ db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon, automatisering });
// De handelsketen (kern/handelsketen.js): een weg waarlangs ELKE zaak met elke
// andere zaak zaken doet -- aanvraag, offerte, gunning, planning, levering,
// factuur, betaling. Vervangt op termijn de veertien losse aanvraagcollecties.
// Staat NA de facturatielaag omdat de keten zijn factuur daar inhangt: een
// tweede nummerreeks naast die van kern/facturatie.js zou twee waarheden geven.
const handelsketen = require('./kern/handelsketen').maakHandelsketen({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon, facturatie });
// De marktplaats (kern/markt.js): één gedeelde motor voor de RTFoundation-app
// (gezinnen kopen/verkopen) en voor leveranciers die er ook op willen verkopen.
const markt = require('./kern/markt').maakMarkt({ db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal });
rtf.setMarkt(markt);
const {
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken
} = sociaal;
// laat-gebonden: de leden-kern (De Salon) mag nu de vriendschap tussen kijker en
// auteur nakijken, zodat je een bericht van een vriend altijd ziet
lidDeps.zijnVrienden = zijnVrienden;
/* De pro-laag over de agenda (kern/agenda-pro.js): kalenderbereik met
   herhalingen, uitnodigen op codenaam, herinneringen, ICS-export en de
   alleen-lezen laag met eigen RTG-boekingen. Ligt hier omdat hij
   codenaamVan uit de sociale kern nodig heeft. */
Object.assign(agenda, require('./kern/agenda-pro').maakAgendaPro({
  db, save, bijeen, inBundel, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, boekingenVanKlant }));
/* Notities & Taken (kern/notities.js): het bord met notities en lijstjes.
   Krijgt de agenda mee, want een notitie met datum en tijd wordt een
   gekoppelde afspraak -- een wekkerlaag, niet drie.
   En `bijeen`, want het bord legt DUURZAAM vast: werk van een lid mag niet
   bevestigd worden voordat de opslag het heeft (GELDLAT.md). */
const notities = require('./kern/notities').maakNotities({
  db, save, bijeen, inBundel, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer }, agenda);
/* RTG Bestanden (kern/bestanden.js): de kluis. Bytes versleuteld op schijf
   (zelfde aanpak als media.js), alleen verwijzingen in de database. */
/* De opslagpeiling van de kostprijslaag (KOSTEN.md) staat naast de kluis en niet
   erin; zie de kop van kern/bestanden-opslag.js voor waarom, en welke toets die
   naad bewaakt. */
const bestandenOpslag = require('./kern/bestanden-opslag')({ db });
const bestanden = require('./kern/bestanden').maakBestanden({
  // antivirus: de gestukte upload komt nooit als data-URL in een verzoek-body
  // langs het scan-net, dus die scant zichzelf zodra het bestand compleet is
  db, save, bijeen, inBundel, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, dir: DATA_DIR, antivirus });
/* RTG Meet (kern/meet.js): vergaderkamers op codenaam; de server geeft
   alleen WebRTC-seinen door, beeld en geluid lopen peer-to-peer. */
const meet = require('./kern/meet').maakMeet({
  db, save, bewerkCollectie, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer });
/* RTG Galerij (kern/galerij.js): leest De Salon en RTG Bestanden; albums
   en favorieten zijn verwijzingen, nooit kopieen van de bytes. */
const galerij = require('./kern/galerij').maakGalerij({ db, save, crypto, schoon });
const boeken = require('./kern/boeken').maakBoeken({ db, save });
const onderwijs = require('./kern/onderwijs').maakOnderwijs({ db, save, schoon });
const leerstof = require('./kern/leerstof').maakLeerstof({ db, save, onderwijs });
/* De school mag bewijs in het leerpaspoort schrijven: een becijferde toets is
   bewijs dat een leerling een leerdoel beheerst. Laat gebonden, want de
   foundation-router bestaat eerder dan deze kern (zie foundation.js). */
rtf.setOnderwijs(onderwijs, leerstof);
const bijles = require('./kern/bijles').maakBijles({ winkel: () => (db.data.bijles = db.data.bijles || {}), save, schoon, anthropic });
const vervolg = require('./kern/leerstof-vervolg').maakVervolg({ db, save, onderwijs });
/* RTG Klok (kern/klok.js): wekkers en timers die op de server aftellen,
   zoals de Thuiswacht -- en daardoor ook door Rahul te zetten. */
const klok = require('./kern/klok').maakKlok({
  db, save, crypto, schoon, sseToCustomer, sendPushToUser });
function geenGast(req, res) {
  // vrienden toevoegen, chatten en bellen kan met elk echt account, ook de
  // gratis laag (met paspoort). Alleen een anonieme demo-gast zonder account niet.
  if (req.session.tier === 'guest' && !req.session.account) { res.status(403).json({ error: 'Maak een gratis account (met paspoort) om vrienden toe te voegen en te chatten.' }); return true; }
  return false;
}
/* Is de identiteit RTG-GEVERIFIEERD? Een lid telt pas als volwassene -- en mag
   pas alcohol bestellen -- nadat RTG het identiteitsbewijs echt heeft gezien;
   tot die tijd geldt de standaard "onder de 18".

   HIER STOND EEN AANNAME IN PLAATS VAN EEN CONTROLE. De regel luidde: "pas-leden:
   met paspoort geballoteerd", en gaf `true` voor IEDEREEN die geen gast was.
   Dat is hoe het bedoeld is -- een betaalde pas loopt door de ballotage -- maar
   het werd nergens nagegaan. Een lid dat zich zojuist had aangemeld en nog in de
   keuringsrij stond, gold dus al als geverifieerd, met een geboortedatum die hij
   bij dat aanmelden zelf had ingetypt. De foutmelding aan de bar zei intussen
   "je leeftijd is via je paspoort geverifieerd" (kern/lidacties/bestellen.js).

   Nu wordt het gevraagd in plaats van aangenomen, voor iedereen langs dezelfde
   weg. Een anonieme demo-gast zonder account telt nooit als bekend. */
function idGeverifieerd(sess) {
  if (!sess) return false;
  if (!sess.account) {
    /* Geen dossier. Voor een GAST is het antwoord altijd nee. Een DEMO-PERSONA
       (inloggen met alleen een pas-tier, kan uitsluitend met RTG_DEMO aan) is
       iets anders: die speelt een volledig geballoteerd lid -- de zaaiset geeft
       hem een dossier, reizen en facturen -- en de demo bestaat juist om de
       hele stroom te tonen, inclusief wat er achter de keuring zit. In
       productie staat DEMO uit en bestaat deze sessie niet eens. */
    return DEMO && sess.tier !== 'guest' && !String(sess.key || '').startsWith('guest-');
  }
  const u = accounts.getUserById(sess.account.id);
  return !!u && u.verified === 'verified';
}

/* ---------- gedeelde vriendenlaag over RTG en RTFoundation ----------
   Iedereen (RTG-lid, gratis account, RTFoundation-gezinslid) heeft een codenaam
   en een "handle". RTG: de sessiesleutel (user-<id> of tier). RTFoundation:
   rtf:<GEZINSCODE>:<profielId>. Zo kunnen RTF en RTG elkaar op codenaam vinden,
   toevoegen, chatten, bellen en snappen. Kinderprofielen hebben ouderakkoord
   nodig voordat een vriendschap actief wordt. */

app.post('/api/push/subscribe', auth, (req, res) => {
  if (!webpush) return res.status(501).json({ error: 'Push niet beschikbaar.' });
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Ongeldige subscription.' });
  // SSRF-afweer: het endpoint komt van de client en de server POST daar later
  // naartoe. Alleen https naar bekende push-diensten; anders weigeren en melden
  // (een intern/metadata-adres hier is een SSRF-poging).
  if (!ssrf.pushEndpointOk(sub.endpoint)) {
    if (beveilig) beveilig.meld('ssrf-push', 'kritiek',
      'Push-subscription met een niet-vertrouwd endpoint geweigerd (mogelijke SSRF): ' + String(sub.endpoint).slice(0, 120),
      { bron: 'user:' + (req.session.account ? req.session.account.id : req.ip) });
    return res.status(400).json({ error: 'Ongeldig push-endpoint.' });
  }
  const list = db.data.pushSubs[req.session.tier] = (db.data.pushSubs[req.session.tier] || []);
  if (!list.some(s => s.endpoint === sub.endpoint)) list.push(sub);
  // echte accounts krijgen ook een persoonlijke push-lijst (voor o.a. RTFoundation-meldingen)
  if (req.session.account) {
    const uid = req.session.account.id;
    const ulist = db.data.pushSubsUser[uid] = (db.data.pushSubsUser[uid] || []);
    if (!ulist.some(s => s.endpoint === sub.endpoint)) ulist.push(sub);
  }
  save();
  res.json({ ok: true });
});

/* Eén tik betaalt: één factuur ({invoiceId}) of alles wat openstaat ({all:true}).
   De echte Face ID-/Apple Pay-verificatie gebeurt op het toestel; de server
   verwerkt de betaling in één aanroep. */




/* Vertaal een bericht naar de taal van de ontvanger. Iedereen schrijft in de
   eigen taal; de lezer krijgt het in de zijne (en andersom). */
/* Publiek, want de taalkiezer staat al op het inlogscherm. Maar wel met een
   rem, en zonder inlog gaat er niets naar de AI-aanbieder: het woordenboek
   volstaat voor de knoppen die een uitgelogde bezoeker ziet. Zie de toelichting
   bij magAi in server/translate.js. */
app.post('/api/translate', require('./rem')({ windowMs: 60000, limit: 30 }), async (req, res) => {
  const text = String(req.body.text || '').slice(0, 1500);
  const to = talen.taalVan(req.body.to); // elke actieve wereldtaal mag als doel
  const from = req.body.from || undefined; // translate valideert tegen het register
  // De beslissing staat in kern/aipoort.js, zodat hij beproefd kan worden zonder
  // server en zonder AI-sleutel. Hier stond een regex op de HEADER, en die keurde
  // "Bearer x" goed: een doorgeefluik naar de aanbieder zonder enig account.
  const ingelogd = aiPoort.magAi(req);
  try {
    const out = await i18n.translate(text, to, from, { ai: ingelogd });
    res.json(out);
  } catch (e) {
    res.json({ text, translated: false });
  }
});

/* Wereldtalen: de actieve talen voor de taalkiezers in alle apps (publiek;
   ook de inlogschermen tonen de kiezer al). De schakelaars zelf zitten in de
   RTG Boardroom (/api/boardroom/talen). */
// Publiek en voor iedereen gelijk (alleen Boardroom-schakelaars sturen het), en
// bij elke app-boot geraakt: een response-cache haalt dit uit de staart. De
// sleutel is de handtekening van de actieve set, dus een taal aan/uit zetten
// verandert de sleutel en de cache is meteen ongeldig (geen staleness).
const talenCache = require('./lib/cache').antwoordCache({ ttl: 3600000, max: 8, sleutel: () => 'talen:' + talen.handtekening() });
/* De losse GitHub Pages-voordeur (index.html in de repositoryroot) draait op
   rahulrtg.github.io en gebruikt dezelfde taal-API. Alleen die vaste publieke
   voordeuren krijgen CORS; andere oorsprongen kunnen de response niet lezen. */
const UI_CORS_ORIGINS = new Set([
  'https://rahulrtg.github.io',
  'https://rahultravelgroup.com',
  'https://www.rahultravelgroup.com'
]);
app.use(['/api/talen', '/api/vertaal/ui'], (req, res, next) => {
  const origin = String(req.get('origin') || '');
  if (UI_CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
// talen: de actieve set (voor autodetectie + vertaling) en de VOLLEDIGE wereld
// (alle 114, met een aan/uit-vlag) zodat de taalkiezer alle landvlaggen toont.
app.post('/api/talen', talenCache, (req, res) => res.json({ talen: talen.actieve(), alle: talen.alle() }));

/* ---------- RTG Zegel: bewijs zonder tonen (offline verifieerbaar) ----------
   Een lid bewijst een FEIT aan een partner (18+, geldig lid, welke pas) zonder
   de onderliggende data te tonen. Het zegel is een Ed25519-token dat de partner-
   /PDA-app met alleen de publieke sleutel controleert -- dus offline. Het
   onderwerp is een paarsgewijs pseudoniem: twee venues kunnen een lid niet
   matchen. Zie server/lib/zegel.js. */
const zegel = require('./lib/zegel').maakZegel({ dataDir: DATA_DIR });
// de publieke sleutel: hiermee verifieert een partner-app een zegel zonder server.
app.get('/api/zegel/sleutel', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ sleutel: zegel.publiekeSleutel(), alg: 'ed25519' });
});
// een lid maakt een momentbewijs voor een partner: alleen de GEVRAAGDE en WARE
// feiten gaan mee (selectieve onthulling); ruwe gegevens komen er nooit in.
app.post('/api/zegel/maak', auth, (req, res) => {
  const sess = req.session;
  const partner = typeof req.body.partner === 'string' ? req.body.partner.slice(0, 64) : null;
  const gevraagd = Array.isArray(req.body.claims) && req.body.claims.length ? req.body.claims : ['lid'];
  const lft = leeftijdVan(geborenVan(sess));
  const feiten = {
    lid: true,
    leeftijd18: lft != null && lft >= 18,
    leeftijd21: lft != null && lft >= 21,
    pas: sess.tier || (sess.account && sess.account.tier) || null,
    zakelijk: sess.tier === 'business'
  };
  const claims = {};
  for (const k of gevraagd) if (Object.prototype.hasOwnProperty.call(feiten, k) && feiten[k]) claims[k] = feiten[k];
  const seed = sess.key || (sess.account && sess.account.id) || 'onbekend';
  const geldigMin = Math.max(1, Math.min(60, Number(req.body.geldigMin) || 5));
  const token = zegel.zegel({ codenaam: seed, partner, claims, geldigMin });
  res.json({ token, claims, sub: zegel.pseudoniem(seed, partner), geldigMin });
});
// een partner/PDA controleert een zegel (kan ook offline met de publieke sleutel).
app.post('/api/zegel/controleer', (req, res) => {
  res.json(zegel.controleer(String((req.body && req.body.token) || '')));
});
// een leverancier voert een officiele ID-/leeftijdscontrole uit met het Zegel:
// de server verifieert opnieuw (vertrouwt de client niet) en legt de controle
// vast in het activiteitenlog. Nooit de echte naam, alleen het bewezen feit en
// het paarsgewijze pseudoniem; RTG staat er met de handtekening garant voor.
app.post('/api/supplier/zegel/check', supplierAuth, (req, res) => {
  const r = zegel.controleer(String((req.body && req.body.token) || ''));
  const claims = r.geldig ? (r.claims || {}) : {};
  const samenvatting = r.geldig
    ? (Object.keys(claims).map(k => k === 'pas' ? 'pas ' + claims[k] : k).join(', ') || 'geen claims')
    : ('afgewezen (' + (r.reden || 'ongeldig') + ')');
  logActivity(req.supplier.code, req.actor, 'ID-/leeftijdscheck via Zegel: ' + (r.geldig ? 'geldig · ' + samenvatting : samenvatting));
  res.json(r);
});
/* Aanwezigheid: elke receptie/entree ziet hoeveel mensen er binnen zijn en de
   verdeling man/vrouw. Bewust alleen GEAGGREGEERD -- nooit per persoon, nooit
   een naam. De deur telt op en af; bij het sluiten leeg je de teller. */
function aanwezigVan(code) { const a = db.data.aanwezig = db.data.aanwezig || {}; return a[code] = a[code] || { man: 0, vrouw: 0, onbekend: 0, updated: null }; }
function aanwezigTel(a) { return { man: a.man || 0, vrouw: a.vrouw || 0, onbekend: a.onbekend || 0, binnen: (a.man || 0) + (a.vrouw || 0) + (a.onbekend || 0), updated: a.updated }; }
app.post('/api/supplier/aanwezig', supplierAuth, (req, res) => res.json({ aanwezig: aanwezigTel(aanwezigVan(req.supplier.code)) }));
app.post('/api/supplier/aanwezig/pas', supplierAuth, (req, res) => {
  const a = aanwezigVan(req.supplier.code);
  const groep = ['man', 'vrouw', 'onbekend'].includes(req.body.groep) ? req.body.groep : null;
  if (!groep) return res.status(400).json({ error: 'Kies man, vrouw of onbekend.' });
  const delta = Math.max(-1, Math.min(1, parseInt(req.body.delta, 10) || 0));
  a[groep] = Math.max(0, (a[groep] || 0) + delta);
  a.updated = new Date().toISOString();
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'aanwezig' });
  res.json({ aanwezig: aanwezigTel(a) });
});
app.post('/api/supplier/aanwezig/leeg', supplierAuth, (req, res) => {
  const a = aanwezigVan(req.supplier.code);
  a.man = 0; a.vrouw = 0; a.onbekend = 0; a.updated = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'zette de aanwezigheidsteller op nul');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'aanwezig' });
  res.json({ aanwezig: aanwezigTel(a) });
});
/* Het UI-woordenboek van een pagina in een keer naar een ACTIEVE wereldtaal:
   zo draait de hele app (elke pagina, elk scherm) in elke taal die de
   boardroom aan laat staan. De route is publiek omdat ook de voordeur vóór
   inloggen in de toesteltaal moet staan. Twee remmen begrenzen modelkosten:
   per IP én installatiebreed. De vertaallaag groepeert de regels bovendien in
   echte batches in plaats van één modelaanroep per knop te doen. */
const uiVertaalPerIp = require('./rem')({ windowMs: 60000, limit: 30 });
const uiVertaalGlobaal = require('./rem')({ windowMs: 60000, limit: 180, key: () => 'alle-ui' });
const uiBronnen = require('./lib/ui-bronnen').maakUiBronnen(PUBLIC_DIR, [path.join(PUBLIC_DIR, '..', 'index.html')]);
app.post('/api/vertaal/ui', uiVertaalPerIp, uiVertaalGlobaal, async (req, res) => {
  try {
    const naar = talen.taalVan(req.body && req.body.naar);
    let totaal = 0;
    const teksten = (Array.isArray(req.body && req.body.teksten) ? req.body.teksten : []).slice(0, 400)
      .map(t => String(t == null ? '' : t).slice(0, 300))
      .filter(t => { totaal += t.length; return totaal <= 24000; });
    const regels = await i18n.translateBatch(teksten, naar, undefined, { ai: uiBronnen.toegestaan });
    const uit = regels.map(r => r.text);
    res.json({ ok: true, naar, teksten: uit });
  } catch (e) { res.status(500).json({ error: 'Vertalen lukte even niet. Probeer het opnieuw.' }); }
});

/* ---------- partnerkanaal: boeken zonder pas ----------
   Publieke endpoints (geen login): partner opzoeken, reizen ophalen en
   boeken via een partnercode. RTG verdient niets aan een boeking; de gast
   betaalt de nettoprijs en een eventuele service gaat volledig naar de
   partner. RTG's enige inkomsten zijn de abonnementen. */

/* De klant ziet alleen totaalprijzen. Nettoprijs en service blijven interne
   administratie (db.json); RTG's aandeel is per definitie nul. */

function findPartner(code) {
  code = String(code || '').trim().toUpperCase();
  return db.data.partners.find(p => p.code === code) || null;
}

function findStaffPartner(staffCode) {
  staffCode = String(staffCode || '').trim().toUpperCase();
  return db.data.partners.find(p => p.staff && p.staff.code === staffCode) || null;
}





/* ================= LEVERANCIER-KANAAL =================
   Eén app voor alle leverancierstypes. Communiceert live (SSE) met de
   klanten-app, de website en de backoffice. Leveranciers gebruiken de app
   gratis; in ruil bieden ze RTG hun beste dynamische prijs. */

// publieke weergave van een leverancier (voor de klant)

// dashboarddata voor de ingelogde leverancier
// Schaalvast: de schermen krijgen alleen het werk van nu plus een korte staart;
// alles daarbuiten loopt via gepagineerde endpoints en totalen.

// ---- leverancier: inloggen, live-stream, dashboard ----

/* Bescherming tegen PIN-raden: na 5 foute pogingen een minuut wachten. De
   teller hangt aan het DOEL (deze pin) en wordt gedeeld door elke deur die op
   die pin uitkomt -- /api/supplier/login en /api/account/koppel allebei. Zie
   ./pinslot.js voor waarom dat een samenvoeging was en geen extra laag. */
const pinSlot = require('./pinslot').maakPinSlot({ beveilig });

// Roster van het bedrijf (voor het personeel-inlogscherm; geen PINs).

// Manager voegt personeel toe (krijgt een PIN) of verwijdert het.

/* ---- sector-slimmigheden ----
   Ophaalcodes voor bars/restaurants, kamerbeheer voor hotels, een eigen
   fotopagina voor elke partner en rechtstreeks publiceren op De Salon. */

// korte, ondubbelzinnige ophaalcode (geen 0/O, 1/I)
/* Welke zaken mogen een ophaal/bezorgdienst voeren: horeca (orders-caps)
   en zelfstandigen. Hotels/vervoer hebben hun eigen kanalen al. */
/* Tickets (activiteiten/musea) leven als boekingen met soort 'ticket', zodat
   betalen, boekhouding, timeline en export automatisch meedoen. Deze helper
   geeft de tickets van een tijdslot; verlopen onbetaalde (ouder dan 30 min)
   tellen niet mee voor de capaciteit. */

// ---- kamers (hotel/appartement): aan/uit, toevoegen, verwijderen ----
/* ---- housekeeping: status per kamer ----
   schoon / vuil / bezig / bezet / defect. Defect maakt de kamer direct
   onboekbaar en zet automatisch een klus voor onderhoud klaar. */

// ---- klussen (onderhoud): melden, oppakken, afronden ----

// ---- gevonden voorwerpen ----


// ---- fotopagina: foto's die gasten zien bij de partner ----

// ---- rechtstreeks publiceren op De Salon (als RTG-partner) ----

/* ---- De Salon voor bedrijven: volgers, aanbiedingen, polls en cijfers ----
   Het Salon-profiel is een verplicht onderdeel van elk partnerschap; deze
   endpoints geven de zaak marketinggereedschap en klantbinding. */

// lid volgt of ontvolgt een zaak

// exclusieve member-aanbieding plaatsen (klantbinding: claimen met een code)

// lid claimt een aanbieding en krijgt een persoonlijke code voor aan de kassa

// de zaak verzilvert een claimcode aan de kassa

// poll plaatsen: vraag de leden wat zij willen (marketinginzicht)


// het bedrijfsprofiel: bio instellen en de marketingcijfers van de zaak


// ---- kassa: verkopen registreren, per sector (bon, kamer, rit) ----

// dagoverzicht (Z-rapport): ontvangen vandaag, per betaalmethode en medewerker.
// Kamerlasten tellen pas mee als omzet bij het uitchecken (anders dubbel).

// ---- RTG-ophaalcode innen aan de kassa ----
// De gast toont het oplichtende scherm; het personeel slaat de code aan.
// De bestelling wordt gekoppeld, zo nodig betaald en als uitgegeven gemarkeerd.

// ---- uitchecken: alle open kamerlasten van een kamer in één keer afrekenen ----

/* ---- minibar-telling: personeel telt per kamer, kosten gaan automatisch
   op de kamerrekening en de aanvulling staat meteen op papier ---- */

// catalogusbeheer: artikelen toevoegen of verwijderen

/* ---- slimme deuren (appartementen): op afstand openen via de app ----
   Openen is tijdelijk: na 10 seconden vergrendelt de deur zichzelf weer,
   zoals een echt smart lock. Elke handeling komt in de activiteitenfeed. */


// De gearriveerde gast opent de voordeur vanuit de leden-app (digitale sleutel).

/* ---- gastchat: rechtstreeks appen met roomservice of de eigenaar ----
   Een gesprek per lid per partner, op codenaam. De gast begint vanuit de
   leden-app; het personeel antwoordt vanuit de Gastchat-tab. Beide kanten
   live via SSE, met notificaties over en weer. */
// afdelingen per sector: de gast kiest met wie hij spreekt

/* De werk-laag (vacatures, sollicitatiechat en chatvertaling) staat in
   server/kern/werk.js. VAC_SOORTEN komt daar rechtstreeks vandaan; de functies
   dragen db, i18n, mail, LANDEN en de leverancier-/realtime-helpers.
   findSupplier, sseToSupplier, notifySupplier en notify zijn hoisted functies. */
const { trChat, chatApplicant, ensureApplyChat, applyChatPubliek, applyChatVertaald, chatStuur, meldWerkgever, openVacatures, werkgeverSollicitatie, notifyApplicant } =
  maakWerk({ db, save, i18n, mail, LANDEN, findSupplier, sseToSupplier, sseToCustomer, notifySupplier, notify,
    /* Late binding: de communicatiekern wordt pas in kernlaag4 gebouwd, ver na
       deze regel. Een verwijzing zou hier voor altijd undefined zijn en de
       sollicitatiechat stil op de oude tak zetten. */
    commWerk: () => kern.commWerk });

/* De leverancier-laag (publieke weergave, dashboard/supplierState, kassa,
   gastchat, kamers/HK, deuren, tickets, De Salon, AI-zoekhulpjes, zaak-opties)
   staat in server/kern/leverancier.js. Draait na de werk-kern omdat
   supplierState werkgeverSollicitatie meeneemt; de primitieven (findSupplier,
   sse-routers, notifySupplier, logActivity, supplierAuth, ensureSupplierDefaults)
   blijven hierboven. HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES en
   ZAAK_OPTIES komen als directe export uit dezelfde module. */
const {
  publicTrip, deptsFor, chatKeyOf, validDept, zorgContact, klantSalon, publicSupplier, magBezorgen,
  ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor,
  makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor, supplierState
} = maakLeverancier({
  db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer,
  logActivity, findSupplier, connectedSupplierCodes, guestsFor, gidsHaal,
  etaMinutes, haversine, accounts, werkgeverSollicitatie,
  /* De gastchat woont sinds de verhuizing in de communicatiekern, en die wordt
     pas in kernlaag4 gebouwd -- ver na deze regel. Vandaar een functie en geen
     verwijzing: hij wordt opgehaald op het moment van AANROEPEN. Zou hier de
     waarde staan, dan stond er voor altijd undefined in en nam het zaakscherm
     stil de "geen gesprekken"-tak. Dezelfde constructie als convOf in
     kern/comm/bronnen.js, en om dezelfde reden. */
  commGastVan: () => kern.commGast
});

/* De ervaring-laag (kern/ervaring.js): tafelreserveringen, annuleren, reviews,
   favorieten, fooi, de reisagenda, rekening splitsen, wachtlijsten, RTG-punten
   en meldingsvoorkeuren. Draait na de leverancier- en sociaal-kern omdat hij
   ticketsVoorSlot, optieAan en zijnVrienden meeneemt. */
const {
  reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
  tafelplanning, reserveringTafel, reserveringKomst, walkIn,
  annuleerItem, plaatsReview, reviewsVoor, ratingVan, reviewReageer, toggleFavoriet,
  favorietenVan, isFavoriet, fooiUit, agendaVoor, maakSplits, mijnSplitsen,
  betaalSplits, zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer,
  puntenVan, verdienPunten, verzilverPunten, pasTegoedToe, herstelTegoed, puntenKoppelPlafond, voorkeurVan, zetVoorkeur
} = maakErvaring({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan,
  // de gedekte tafel (kern/tafeldek.js) wordt pas in kernlaag7 gebouwd; laat gebonden
  tafeldekVan: () => kern.tafeldek,
  /* RTG Pay wordt pas in kernlaag3 gebouwd -- ver na deze regel -- en de
     annuleerlaag heeft hem nodig om een betaalde annulering ECHT terug te
     boeken. Laat gebonden, net als de gedekte tafel hierboven. */
  payVan: () => kern.pay,
  /* codenaamVan hoort erbij: het geld van een verzilverde punt gaat naar de
     WALLET van dit lid, en die hangt aan de codenaam. */
  codenaamVan
});

/* De retail-/mode-laag (kern/retail.js): collecties, artikelen met varianten,
   voorraad, clienteling, apart leggen, paskamerverzoeken, drops, mobiele kassa,
   styling en analytics. Draait na de ervaring-kern omdat een drop-release de
   wachtlijst (meldWachtlijst) afgaat. */
const {
  isRetail: retailIsRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
  klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart,
  vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling, verkoop: retailVerkoop,
  verkoopTerug: retailVerkoopTerug, prijsVan: retailPrijsVan,
  annuleerVerkoop: retailAnnuleer, bonBeeld: retailBon, ANNULEERGRONDEN,
  voorraadZoek, retailStats, retailState, catalogus: retailCatalogus
} = maakRetail({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, ledenPrijs, gidsHaal, meldWachtlijst
});

/* De groothandel-/marktlaag (kern/groothandel.js): een brede B2B/B2C-marktplaats.
   Een groothandel levert aan onze horeca (inkoopprijs), aan leden (boodschappen)
   en aan andere groothandels, zet zijn eigen functies aan/uit, en de AI stelt op
   basis van verkoop + mise-en-place een bijbestelling voor de horeca voor. */
const {
  GROOTHANDEL_FUNCTIES, GROOTHANDEL_CATEGORIEEN, ghIsGroothandel, ghDefaults, ghFunctieAan,
  ghFunctieLijst, ghZetFunctie, ghZetProduct, ghZetVoorraad, ghMarkt, ghPlaatsBestelling,
  ghOrderVerder, ghAnnuleer, ghMijnBestellingen, ghInkomend, ghBijbestelVoorstel
} = maakGroothandel({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic,
  // geleverd bij een zaak: het keukenbrein boekt de regels als levering in
  // (kern.keuken bestaat op aanroepmoment; de kern-bag wordt verderop gevuld)
  bijGeleverd: (o) => {
    const zaak = findSupplier(o.klant.id);
    if (zaak && kern.keuken) kern.keuken.leverBinnen(zaak, o.regels, 'groothandel ' + o.groothandelNaam);
  }
});

/* De AI-bedrijfsagent (kern/agent.js): vaste leverancier koppelen, AI-inkoop-
   voorstellen op verkoop + mise en place + verwachte drukte, en het AI-week-
   rooster; de gemachtigde (manager) keurt goed, past aan of wijst af. */
const { maakAgent } = require('./kern/agent');
const { agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis } = maakAgent({
  db, crypto, findSupplier, notifySupplier, ghBijbestelVoorstel, ghPlaatsBestelling,
  accounts, weekdagFactor, SHIFT_NAMES, save, logActivity
});

/* Mode-bezorging (kern/modebezorg.js): een modewinkel zet in een tik een slimme,
   veilige bezorgdienst op. Veilig voor beide kanten (bezorgcode, foto-bewijs,
   geverifieerde koerier, live volgen, ID bij dure stukken, retour aan de deur)
   en efficient (de koerier krijgt de kortste route). */
const {
  MODEBEZORG_KETEN, mbSetup, mbInstel, mbMagLeveren, mbAanvraag, mbWinkelOverzicht,
  mbRoute, mbNeem, mbGps, mbOverhandig, mbRetour, mbMijn
} = maakModebezorg({
  db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl
});

/* De eigen mini-boardroom per zaak (kern/zaak.js): elke leverancier zet zijn
   eigen functies aan/uit en ziet een HR- en marketing-momentopname. */
const { ZAAK_CAPS, zaakFunctieAan, zaakFunctieLijst, zaakZet, zaakHr, zaakMarketing, zaakBoard } =
  maakZaak({ db, save, accounts });

/* De eigen boardroom per lid (kern/lidboard.js): elk lid zet zijn eigen
   functies aan/uit; een ouder/beheerder stuurt via dezelfde motor de boardroom
   van zijn beschermde kind bij (de route bewaakt het gezinsverband). */
/* HET LIDBOARD ALS EEN NAAM OP DE KERN, en de werkbeleid-namen apart.

   Dat onderscheid is geen opmaak. Negen lidBoard-namen gaan over EEN onderwerp --
   de eigen boardroom van een lid -- en vijf daarvan werden door zowel member als
   social aangeraakt; in de gedeelde kern stonden dus vijf losse namen waar
   "member en social hangen beide van het lidboard af" uit moest blijken. Het
   werkbeleid komt uit dezelfde motor maar is een ander onderwerp (een werkgever
   die tijdens de dienst iets dichtzet), en die namen blijven daarom los.

   lidPadFunctie en lidBoardUit blijven ook los: die worden hier in server.js zelf
   gebruikt en gaan niet naar een domein. */
const _lidboard = maakLidboard({ db, save });
const { lidPadFunctie, lidBoardUit,
  werkbeleid, werkbeleidZet, werkbeleidOverzicht, werkgeversVan,
  werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN } = _lidboard;
const lidboard = { LIDBOARD_CAPS: _lidboard.LIDBOARD_CAPS, lidBoard: _lidboard.lidBoard,
  lidBoardZet: _lidboard.lidBoardZet, lidBoardZetVeel: _lidboard.lidBoardZetVeel,
  lidBoardHerstel: _lidboard.lidBoardHerstel, lidBoardAan: _lidboard.lidBoardAan,
  lidBoardVersie: _lidboard.lidBoardVersie, lidBoardLog: _lidboard.lidBoardLog,
  lidBoardLogWis: _lidboard.lidBoardLogWis };

/* De autoverkoop-laag (kern/autoverkoop.js): een 5-sterren, exclusieve
   autoverkoop bovenop het verhuurbedrijf. Showroom, proefrit, kopen met bod,
   inruil en concierge-aflevering, en een digitaal koopcontract. */
const {
  AUTOVERKOOP_BRANDSTOF, avMagVerkopen, avZetAan, avZetAuto, avVerwijderAuto, avShowroom,
  avAanbevolen, avProefrit, avKoop, avInruil, avBeslis, avTeken, avMijnDeals, avDealerInbox
} = maakAutoverkoop({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, media });

/* De beveiligings-laag (kern/beveiliging.js): een commandocentrum + PDA voor de
   meest geavanceerde beveiligingsteams. Rooster (met AI-overname), budget,
   posten, inzetaanvragen, patrouillerondes, incidenten en een SOS-noodknop. */
const {
  BEVEILIGING_FUNCTIES, BEVEILIGING_SHIFTS, BEVEILIGING_ERNST,
  bevIsBeveiliging, bevDefaults, bevFunctieAan, bevFunctieLijst, bevZetFunctie,
  bevPosten, bevZetPost, bevVerwijderPost, bevBudget, bevZetBudget,
  bevRooster, bevZetDienst, bevSchrapDienst, bevPlanAuto,
  bevAanvraag, bevAanvraagLijst, bevBeslisAanvraag,
  bevMijnDiensten, bevInklok, bevUitklok, bevRondeStart, bevRondeCheckpoint, bevRondeKlaar,
  bevMeldIncident, bevBeslisIncident, bevSos, bevCommand,
  // de sleuf waar opzet/plaatsbronnen.js de plaatslaag in hangt (late binding)
  bevKoppelPlaats
} = maakBeveiliging({ db, save, crypto, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine });

/* De idempotentie-administratie van de betaal-naad (server/betaal.js) durable
   maken: dezelfde idempotentiesleutel geeft ook NA een herstart hetzelfde
   resultaat terug, zodat een netwerk-herhaling of dubbeltik nooit dubbel kan
   afschrijven. Compact gehouden met een FIFO-cap; de sleutelvolgorde staat in
   _keys (echte sleutels zijn geprefixt, dus botsen daar nooit mee). */
if (!db.data.betaalIdem || typeof db.data.betaalIdem !== 'object') db.data.betaalIdem = { _keys: [] };
if (!Array.isArray(db.data.betaalIdem._keys)) db.data.betaalIdem._keys = [];
betaal.koppelStore({
  get: (k) => (k === '_keys' ? undefined : db.data.betaalIdem[k]),
  set: (k, v) => {
    if (k === '_keys') return;
    if (!(k in db.data.betaalIdem)) {
      db.data.betaalIdem._keys.push(k);
      if (db.data.betaalIdem._keys.length > 50000) {
        for (const weg of db.data.betaalIdem._keys.splice(0, db.data.betaalIdem._keys.length - 50000))
          delete db.data.betaalIdem[weg];
      }
    }
    db.data.betaalIdem[k] = v;
    try { save(); } catch (e) { /* het geheugen-resultaat blijft geldig */ }
  }
});

/* De directe-betaallaag (kern/directpay.js): elk betalend lid rekent alles met
   Face ID af via de AI en de Salon, en het geld gaat rechtstreeks van de klant
   naar de leverancier (in productie een Stripe destination charge). */
const {
  DP_MIN_CENTEN, DP_MAX_CENTEN, dpBetaalDirect, dpMijnBetalingen,
  dpVerzoekMaak, dpVerzoekenVoor, dpBetaalVerzoek, dpVerzoekIntrek, dpOntvangsten, dpRegistreerMunt, dpRegistreerBevestigd
} = maakDirectpay({ db, save, crypto, findSupplier, betaal, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, logActivity,
  /* De transactie-index voor de twee geldcollecties. Ze werden hier met
     unshift+slice bijgehouden, dus zonder index (O(N) zoeken) en met een
     stille kap op de staart. Nu langs dezelfde weg als orders en boekingen. */
  directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
  betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe });

/* DE BETAALOPDRACHTEN (kern/betaalopdracht/): een rij voor alles wat het huis
   ECHT verlaat -- de SEPA van de bank, de partneruitbetaling van Pay en de
   afdracht van het fonds. EEN rij en niet drie, want anders staat het antwoord
   op "wat is geboekt maar niet aangekomen" op drie plekken en telt niemand ze
   op. Hij wordt hier gebouwd omdat hij ouder moet zijn dan zijn drie gebruikers;
   elk van hen meldt daarna zijn eigen teruggang aan (registreerTeruggang), want
   terugboeken kan alleen in het grootboek waar het geld vandaan kwam. */
/* DE GEZONDHEID VAN DE RAIL, per capability en niet per platform. Elke
   inzending zegt of hij lukte; kern/commercie/capgezondheid.js telt en rekent de
   stand. Zo is "de uitbetaalrail hapert" een eigen antwoord in plaats van een
   rood lampje over het hele huis.

   HIJ MEET EN HIJ BLOKKEERT NIET. Automatisch de geldrail dichtzetten is
   precies het soort regel dat eerst een tijd hoort mee te lopen (zie
   kern/commercie/schaduw.js); wat er nu staat is de meting, en de boardroom kan
   met de hand in quarantaine zetten. Eerst meten, dan afdwingen. */
const capGezondheid = require('./kern/commercie/capgezondheid').maakGezondheid({ db, save });
const betaalOpdrachten = require('./kern/betaalopdracht')({
  d: () => db.data, save, crypto, nu: () => Date.now(), log,
  // aanbieden bij de rail: dezelfde sleutel bij elke poging, zodat een
  // herhaling bij de provider nooit een tweede betaling wordt
  railInzenden: async (o) => {
    try {
      const uit = await betaal.maakUitbetaling({
        bedrag: o.centen, valuta: o.valuta, iban: o.bestemming, begunstigde: o.begunstigde,
        referentie: o.ledgerRef, idempotentieSleutel: o.idemSleutel, omschrijving: o.oms
      });
      capGezondheid.meld('money.payout', true);
      return uit;
    } catch (e) {
      /* De melding mag de fout niet opeten: hij gaat door naar de opdrachtenrij,
         die hem herhaalt en desnoods terugboekt. Meten is meekijken, niet
         ingrijpen. */
      capGezondheid.meld('money.payout', false, (e && e.message) || String(e));
      throw e;
    }
  }
});

/* De RTFoundation-afdracht (kern/fonds.js): van elke bevestigde maandbetaling
   van een klant gaat automatisch 30% (ex btw) naar de foundation. De afdracht
   wordt op het betaalmoment geboekt en, zodra het IBAN in de omgeving staat,
   via de betaal-naad als uitbetaling ingepland. */
const fonds = maakFonds({ db, save, bijeen, inBundel, betaal, log, env: process.env, betaalOpdrachten });

/* Munt-ontvangst (server/muntbetaal.js + kern/munten.js): RTG accepteert
   cryptomunten voor zijn eigen diensten en zet ze via een vergunninghoudende
   aanbieder meteen om naar euro's. Durende idempotentie zodat een herhaald
   verzoek na een herstart hetzelfde adres teruggeeft. */
if (!db.data.muntIdem || typeof db.data.muntIdem !== 'object') db.data.muntIdem = { _keys: [] };
if (!Array.isArray(db.data.muntIdem._keys)) db.data.muntIdem._keys = [];
muntbetaal.koppelStore({
  get: (k) => (k === '_keys' ? undefined : db.data.muntIdem[k]),
  set: (k, v) => {
    if (k === '_keys') return;
    if (!(k in db.data.muntIdem)) {
      db.data.muntIdem._keys.push(k);
      if (db.data.muntIdem._keys.length > 50000) {
        for (const weg of db.data.muntIdem._keys.splice(0, db.data.muntIdem._keys.length - 50000))
          delete db.data.muntIdem[weg];
      }
    }
    db.data.muntIdem[k] = v;
    try { save(); } catch (e) { /* het geheugen-resultaat blijft geldig */ }
  }
});
const munten = maakMunten({ db, save, muntbetaal });

/* Een bevestigde munt-ontvangst settelt de bijbehorende factuur langs de gewone
   weg: gemarkeerd als betaald, en voor abonnementen de 30%-afdracht aan de
   RTFoundation geboekt. Zo maakt het niet uit of een lid met kaart of met munten
   betaalt: de rest van het systeem ziet hetzelfde. */
/* De afwikkeling van een bevestigde betaling (munt EN kaart) staat in
   kern/settlement.js, zodat hij los te toetsen is -- dat was hier niet mogelijk
   en juist daar zat de fout: de kaartkant werd nooit afgewikkeld. */
const { maakSettlement } = require('./kern/settlement');
/* payOplaadAfronden als LATE binding: de betaalkern wordt pas verderop gebouwd
   (kernlaag), maar deze functie draait pas als er een webhook binnenkomt -- dan
   staat hij er. Zonder deze draad kan settlement een bevestigde oplading niet
   bijschrijven, en dat is precies wat er misging: kaart afgeschreven, wallet
   niet bijgeschreven, webhook antwoordde 200 ok. */
const settleFactuur = maakSettlement({ db, save, accounts, fonds, log, dpRegistreerMunt, dpRegistreerBevestigd,
  payOplaadAfronden: (a) => (kern.pay && kern.pay.oplaadAfronden ? kern.pay.oplaadAfronden(a) : null),
  // bevestigt het IBAN waarvandaan is opgeladen, zodat de wachttijd op DIE rekening vervalt
  payIbanBevestigd: (a) => (kern.pay && kern.pay.ibanBevestigd ? kern.pay.ibanBevestigd(a) : null) });

/* De maandfactuur uit het eigen RTG Pay-saldo (kern/factuursaldo.js): de derde
   betaalweg naast kaart en munten. De afschrijving loopt via pay.huisIn en de
   afwikkeling via DEZELFDE settleFactuur als hierboven, dus de bedragcontrole
   en de 30%-afdracht staan nergens een tweede keer. De betaalkern komt pas in
   de kernlaag; vandaar dezelfde late binding als payOplaadAfronden. */
const { factuurSaldo } = require('./kern/factuursaldo').maakFactuurSaldo({
  db, accounts, settleFactuur, broadcastSync,
  payVan: () => kern.pay });

/* De paspoort-/identiteitslaag (kern/paspoort.js): een gecontroleerd, veilig
   en toestemmingsgestuurd kanaal waarlangs een partner de identiteit achter een
   codenaam kan opvragen (ja/nee, ID-kaart of volledige scan), met melding en
   weigering voor het lid, en RTG-beoordeelde vrijgave bij incidenten. */
const {
  mijnStatus: paspoortStatus, vraag: paspoortVraag, beslis: paspoortBeslis,
  trekIn: paspoortTrekIn, bekijk: paspoortBekijk, dienIncidentIn: paspoortIncident,
  beoordeelIncident: paspoortBeoordeel, mijnVerzoeken: paspoortMijn,
  partnerVerzoeken: paspoortPartner, incidentenVoorOffice: paspoortIncidenten,
  /* De twee alleen-lezen vragen die andere lagen aan deze module stellen: de
     vervaldatum voor kern/levensgraaf en het geboortejaar voor
     kern/levenslijn. Ze staan hier omdat een naam die niet in de kern belandt
     ook niet bestaat: kernlaag3b vraagt `kern.paspoortVervaldatumVan` achter
     een ternary, en die viel dus stil terug op null -- de paspoortknoop van de
     levensgraaf is daardoor nooit gebouwd. Een belofte in commentaar is een
     belofte in code (LAT.md regel 6), en dit is de plek waar hij waar wordt. */
  paspoortVervaldatumVan, paspoortGeboortejaarVan
} = maakPaspoort({
  db, save, crypto, accounts, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, leesUploadDataUrl, leeftijdVan, gidsHaal
});

// gast stuurt een bericht aan een partner (per afdeling een eigen gesprek)

// gast opent het gesprek met een afdeling (en markeert het als gelezen)

// personeel antwoordt (onder eigen naam, uit het persoonlijke account)

// personeel opent een gesprek (en markeert het als gelezen)

/* ---- verbinding maken met een gast (hotel/appartement) ----
   Het hotel ziet welke leden nu live onderweg zijn en kan verbinden: de gast
   krijgt een melding, het hotel verschijnt in het onderweg-scherm van de
   gast, en het hotel volgt de aankomst live (positie en ETA). */

/* ---- solliciteren: bij elk bedrijf op dezelfde manier ----
   Openbaar formulier per bedrijf; de manager ziet de sollicitatie in de app
   en neemt aan (dan ontstaat direct een personeelsaccount met pincode) of
   wijst af. Zo wordt personeel zoeken voor elk bedrijf gelijk en simpel. */
/* De sollicitatie- en vacaturelogica (chatApplicant, ensureApplyChat,
   applyChatPubliek, chatStuur, meldWerkgever, openVacatures,
   werkgeverSollicitatie, notifyApplicant) staat in server/kern/werk.js en is
   hierboven al opgezet via maakWerk(). VAC_SOORTEN komt uit dezelfde module.
   Privacy: wie via de RTFoundation solliciteert, is voor de werkgever niet als
   zodanig herkenbaar (werkgeverSollicitatie verwijdert de interne velden). */

/* ---- AVG-rechten: inzage en vergetelheid, rechtstreeks vanuit de app ----
   Export levert alles wat op deze persoon herleidbaar is in een JSON;
   verwijderen wist of anonimiseert het en logt alle sessies van dit lid uit. */


/* ---- events: het Kantoor maakt ze, leden melden zich aan, de deur checkt in ---- */

// aan de deur: gast afvinken (elke medewerker mag dit, op eigen naam)

/* ---- het draaiboek, de event-keuken en de keukencoach ----
   De runsheet-, catering- en coach-logica staat in server/kern/events.js
   (RUN_STATIONS, ALT_IDEE en coachCache komen daar rechtstreeks vandaan). De
   rekenende functies dragen crypto (voor id's) en sectiesForOrder (voor de
   coach). sectiesForOrder is een hoisted functie en dus hier al beschikbaar. */
const { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers, coachRules } = maakEvents({ crypto, sectiesForOrder });

/* ---- dagelijkse mise en place (a la carte, geen event) ----
   De keuken voorspelt de dag: verwachte couverts uit de verkoophistorie van de
   afgelopen drie weken, de tafelcapaciteit en de weekdag; per gerecht een
   portie-aantal en een MEP-takenlijst voor het team. */


// lid meldt zich aan voor een gepubliceerd event

/* ---- partner-onboarding: bedrijven melden zichzelf aan ----
   Publiek formulier -> aanvraag in de backoffice -> bij goedkeuring maakt de
   server het bedrijf aan met een leverancierscode en een manager-PIN, en
   mailt die naar de aanvrager. Vanaf dat moment werkt de hele partner-app. */



/* ---- cv-builder (leden-app): het cv is de sleutel tot solliciteren ---- */

// De openstaande vacatures voor een ingelogd lid: dezelfde vacatures als in de
// RTFoundation, gefilterd op de paspoortleeftijd van het lid, met de landenlijst
// om ook in het buitenland te zoeken.

// RTG-lid solliciteert bij een partner; kan pas met een afgerond cv. Solliciteren
// op een gestructureerde vacature (vacatureId) is de nieuwe, gelijke weg; het
// oude vrije functieveld blijft werken voor open sollicitaties.

/* ---- beheer: alleen managers/chefs passen instellingen, tafels en menu aan ---- */

// bestellingen en reserveringen open of dicht; leden merken het direct
/* ---- boekhouding per land en genre ----
   De fiscale tabellen (LANDEN, ZZP, FIN_CAT), het peiljaar en de rekenende
   laag (financeVoor, cannedBoekhouder) staan in server/kern/fiscaal.js. Werk
   het peiljaar en de tabellen daar elk jaar bij en laat ze fiscaal toetsen. */

/* Elke zaak is baas over de eigen opties. Alles kan aan of uit, met een
   principiele uitzondering: betalen via de app staat altijd aan (daar is
   bewust geen sleutel voor). Wel kiest de zaak het moment: vooraf of achteraf. */


// ---- tafelindeling (horeca): status door iedereen, indeling door de manager ----

// ---- team oproepen: een collega of het hele bedrijf, gericht via SSE ----

// ---- security-alarm: melding met locatie naar het hele bedrijf en RTG ----

/* ---- personeelszaken: klok, verlof/ziek en de vertrouwenslijn ----
   Kennis en kunde in de zak van elk staflid: administratie die het bedrijf en
   de medewerker allebei helpt, en een vertrouwelijke lijn naar RTG. */

/* De personeelslaag (klok, vertrouwenslijn, weekrooster) staat in
   server/kern/personeel.js. SHIFT_NAMES komt daar rechtstreeks vandaan; de
   functies dragen db + accounts. */
const { urenVan, klokVan, trustVan, scheduleFor } = maakPersoneel({ db, accounts });

// backoffice: de vertrouwenspersoon leest en antwoordt

/* ---- eigen backoffice per leverancier ----
   Elk bedrijf zijn eigen controlecentrum: dagcijfers, weektrend, toppers en
   een actiecentrum, met dezelfde patronen als de RTG-backoffice maar dan
   uitsluitend over de eigen zaak. */

/* ---- zzp-boekingen: diensten en producten van zelfstandige professionals ----
   Leden boeken met datum en tijd; de zelfstandige bevestigt, levert en rondt
   af. Betalen-eerst geldt hier net zo (tenzij de zaak achteraf kiest). */
const BOEK_KETEN = ['aangevraagd', 'bevestigd', 'afgerond'];




// de zelfstandige bevestigt, rondt af of weigert (alleen vooruit in de keten)

// dienstenbeheer: de zelfstandige is baas over het eigen aanbod

/* ---- cadeaukaarten ----
   Kopen via de leden-app (Face ID) of verkopen aan de kassa; innen door de
   zaak op code. Boekhoudkundig correct: de verkoop is nog geen omzet (het
   saldo is een verplichting op de balans), de btw hoort bij de inwisseling. */
const gcCode = () => 'RTG-GC-' + crypto.randomBytes(3).toString('hex').toUpperCase();





/* De fiscale rekenlaag komt uit kern/fiscaal.js en draagt db + de reken-helpers.
   financeVoor: de maandboekhouding van de zaak; cannedBoekhouder: de AI-antwoorden.

   DE JAARGANGEN GAAN LUI MEE. Deze laag wordt hier opgebouwd, maar de
   Regelwacht -- en daarmee de fiscale jaargangen (kern/fiscaal/jaargangen.js) --
   ontstaat pas in kernlaag4c, ruim honderd regels verderop. Een directe
   verwijzing zou hier dus `undefined` opleveren en dan zou de boekhouding voor
   altijd op de lopende tabel blijven rekenen. Vandaar een functie: hij wordt pas
   uitgevoerd als er echt een rapport wordt gemaakt, en dan staat de laag er.
   Hetzelfde idioom als de bevoegdheidslaag hierboven ("lui doorgegeven"). */
const { financeVoor, cannedBoekhouder, dagrapport, shiftSamenvatting } = maakFiscaal({ db, rondEuro, btwSplit,
  jaargangen: () => kern.regelwacht && kern.regelwacht.jaargangen });


// AI-boekhouder voor het Business Pass-lid: wat is per land terug te vorderen

/* ---- AI-assistent voor de leverancier-app ----
   Begrijpt vragen EN voert acties uit: kamers op status zetten, deuren
   openen, klussen melden, dagomzet, gasten onderweg, open chats, minibar.
   Zonder API-key werkt de intent-motor; met key beantwoordt Claude ook
   vrije vragen met de bedrijfscontext. */

/* ---- weekrooster: deterministisch gegenereerd per personeelslid ---- */
// (scheduleFor + SHIFT_NAMES staan in server/kern/personeel.js, hierboven opgezet.)

// Interne teamchat binnen het bedrijf (tekst of spraakmemo).




// ---- dynamische prijs aan RTG (backoffice) ----

// ---- menukaart bijwerken (restaurant/bar/club) ----

// Welke werkplekken (keuken/bar) heeft deze bestelling nodig?
function stationsForOrder(s, o) {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    set.add(m && m.station === 'bar' ? 'bar' : 'keuken');
  }
  return [...set];
}

// welke keukensecties heeft deze bestelling nodig?
function sectiesForOrder(s, o) {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    if (m && m.station !== 'bar') set.add(m.sectie || 'warm');
  }
  return [...set];
}

// tafel op een bon zetten of aanpassen (bediening, keuken)

// keukensectie (warme kant, koude kant, snacks, dessert) meldt bezig of klaar

// ---- werkplekken: keuken- en barscherm melden hun deel bezig of klaar ----

// ---- leverancier werkt orderstatus bij → klant live op de hoogte ----

// ---- leverancier stort terug → klant krijgt melding ----

// ---- leverancier deelt live locatie → klanten met actieve rit/bestelling ----

// ---- vervoerspartner werkt de ritstatus bij → lid live op de hoogte ----
/* De vervoerslaag (ritstatusketen + slimme toewijzing) staat in
   server/kern/vervoer.js. RIT_KETEN/RIT_LEGACY/RIT_MELDING komen daar
   rechtstreeks vandaan; ritVerder en ritBezetting dragen db + de realtime-
   helpers. logActivity, broadcastSync, notify en de SSE-routers zijn al gezet. */
const { ritVerder, ritBezetting } = maakVervoer({
  db, etaMinutes, haversine, save, broadcastSync, sseToCustomer, sseToOffice, notify, logActivity
});

/* Toewijzen: het kantoor wijst toe, of een chauffeur neemt de rit zelf. */

/* Vlootbeheer (kantoor, alleen management) */
// Ritgeschiedenis, schaalvast: gepagineerd en doorzoekbaar, met het omzettotaal
// over de volledige historie (dus ook wat niet op deze pagina staat).

// Volledige ritgeschiedenis als CSV, op de server opgebouwd zodat de export
// compleet is hoe groot de historie ook wordt (token via query voor de download).


/* ================= KLANTZIJDE (leden-app) ================= */

// leveranciers voor de huidige stad/reis van het lid


// bestelling plaatsen (restaurant/bar/club), klant verschijnt onder codenaam

// bestelling betalen (Face ID op het toestel)


/* ================= LIVE REIS (onderweg) =================
   Koppelt een reizend lid en al zijn partners realtime. Het lid deelt zijn
   positie, de partners de hunne. Zo staan pre-orders klaar op het moment dat
   het lid aankomt, weet de taxi precies waar en wanneer op te halen, en ziet
   het lid live waar zijn vervoer is. Alles op codenaam, nooit op echte naam. */

// Lid start "onderweg" naar een bestemming (optioneel een partner).

// Lid deelt een nieuwe positie; partners en backoffice zien het live.



// Lid vraagt een rit aan bij een vervoerspartner (taxi/jet).

// rit betalen: hiermee wordt hij definitief en gaat hij naar de vervoerder

/* ================= BACKOFFICE (RTG) =================
   De backoffice ziet alle binnenkomende dynamische prijzen, bestellingen en
   ritten live. Demo-toegang met een vaste code. */
// In productie mag de demo-backofficecode ('RTG-OFFICE') nooit werken: zonder een
// eigen OFFICE_CODE wordt hij onraadbaar willekeurig, zodat de deur dichtblijft
// tot er een echte code is gezet. Buiten productie houden we de demo-code.
/* Zonder eigen OFFICE_CODE wordt hij onraadbaar willekeurig -- ALTIJD, niet
   alleen in productie. De terugval op 'RTG-OFFICE' hing aan dezelfde vergeten
   vlag als hierboven, en die code staat letterlijk in deze repo: iedereen die
   hem gelezen heeft kon de backoffice van deze server openen. De demo-code komt
   alleen nog terug als de demo-modus uitdrukkelijk aanstaat. */
const OFFICE_CODE = process.env.OFFICE_CODE || (DEMO ? 'RTG-OFFICE' : crypto.randomBytes(18).toString('hex'));


/* De backoffice-laag (officeAuth, officeState, pendingVerifications) staat in
   server/kern/kantoor.js en wordt verderop opgezet via maakKantoor(), na de
   AI-kern omdat officeState de conciergeInbox meeneemt. OFFICE_CODE blijft hier
   (nodig bij de startwaarschuwing en de kantoor-login). */

// De volledige tijdlijn van bestellingen en ritten: gepagineerd en doorzoekbaar
// over alles wat er ooit was, niet alleen de laatste zestig regels.

// Volledige export voor de boekhouding, op de server opgebouwd.



// Backoffice port een partner: een vriendelijke herinnering bij een blijven-liggen
// bestelling of rit. Maximaal een keer per tien minuten per regel.

// Dagbriefing: een leesbare samenvatting van de dag, opgebouwd uit de echte
// cijfers (geen AI-sleutel nodig, dus altijd beschikbaar en altijd juist).



// Het geüploade document bekijken (alleen backoffice; token via query voor <img>).

/* ---------- persoonlijke AI ----------
   De AI-laag (systeemprompt, demo-antwoorden, het Claude-antwoord en de
   doorlopende conversatie) staat in server/kern/ai.js. AI_TONE komt daar
   rechtstreeks vandaan; de functies dragen db, PERSONAS, de Claude-client,
   accounts en de realtime-helpers. broadcastSync en sseToOffice zijn hoisted. */
/* De stemming van Rahul (kern/rahul/stemming.js) en de geloofslaag
   (kern/geloof/). Allebei nodig voordat de promptlaag wordt opgebouwd, want
   die draagt ze mee in elke system prompt. */
const stemming = require('./kern/rahul/stemming')({ db, save, crypto });
const geloof = require('./kern/geloof')({ accounts });
const { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, noteerBeurt, conciergeInbox, zetServiceOverdracht } =
  maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n, ledenInhoudVan,
    stemmingVoor: (c) => stemming.stemmingVoor(c), geloofRegel: (key) => {
      const id = idVanKey(key);
      return id != null ? geloof.promptRegel(id, null) : null;
    } });

// De backoffice-laag draagt de AI-kern (conciergeInbox) mee, dus staat hij na maakAi.
const { officeAuth, kluisAuth, naamAuth, boardroomAuth, boardroomLijst, boardroomBaas, boardroomWie, magBoardroom, officeState, pendingVerifications } = maakKantoor({
  db, sessionFor, eigenaar, accounts, findSupplier, connectedSupplierCodes,
  publicSupplier, conciergeInbox, beveilig, archief, grootAantal, ledenAantal
});

/* ================= DOORLOPEND GESPREK IN DE APP =================
   Elk lid heeft één doorlopend gesprek, volledig binnen de beveiligde RTG-app.
   RTG Pass wordt beantwoord door Rahul (AI); Lifestyle en Business gaan naar
   een menselijke concierge, die in de backoffice antwoordt. Er zijn geen externe
   berichtenkoppelingen (WhatsApp/Meta) meer: alle communicatie loopt via de app
   en de push-/e-maillaag van RTG zelf. */

/* ---------- domeinmodules: aparte routers op de gedeelde kern ----------
   Elk domein is een los bestand dat zijn routes op dezelfde app registreert en
   uitsluitend via deze kern met de gedeelde data en realtime praat. Zo kan een
   domein later als eigen proces draaien zonder de routecode te veranderen. */
const kern = {
  /* Het API-spoor komt uit de poortwachters (opzet/auditspoor.js) en gaat als
     `apiSpoor` de kern in, zodat RTG Command hem kan tonen en nakijken. Hij
     wordt daar gelezen, nooit geschreven: schrijven doet de middleware. */
  apiSpoor: auditspoor.journaal,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal,
  AI_TONE, ALT_IDEE, AUTHOR_TIER, BOEK_KETEN, CLUSTER_KEY, CSP_NONCE, DATA_DIR, DEMO,
  DEMO_PASS, DEMO_SUPPLIER, DEMO_USER, DOOR_RELOCK_MS, FIN_CAT, FISCAAL_PEILJAAR, HK_STATUSES, LANDEN,
  OFFICE_CODE, PERSONAS, POS_METHODS, PRODUCTION, PUBLIC_DIR, RIT_KETEN, RIT_LEGACY, RIT_MELDING,
  RUN_STATIONS, SHIFT_NAMES, SSE_BUFFER_TTL, STAFF_SEED, TABLE_STATUSES, TOKEN_TTL_MS, UPLOAD_DIR, VAC_SOORTEN,
  ZAAK_OPTIES, ZZP, accounts, addContact, addTicket, aiFindDoor, aiFindRoom, archief, beveilig, wacht, mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, rtmail, rtmailTeam, automatisering, werkmail, antivirus, atelierweb, webmaker, webmerk, webplatform, webplatformTaal, webmakerAi, webmakerTeam, eigenaar, zaakdoos, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, mailAanname, naamlaag,
  /* Spraak naar tekst voor een live gesprek -- lokaal of helemaal niet
     (kern/spraaktekst.js). Geen state, dus rechtstreeks op de kern. */
  spraaktekst: require('./kern/spraaktekst'),
  aiSystemPrompt, alcoholGrensVan, anthropic, app, appUrl, applyChatPubliek, applyChatVertaald, auth, betaal, betaalWaarheid, betaalRegie, broadcastSync,
  bufferEvent, bus, canEngage, cannedAnswer, cannedBoekhouder, cateringDishes, rondEuro, chatApplicant,
  chatKeyOf, chatStuur, checkCred, coachCache, coachRules, conciergeInbox, connectedSupplierCodes, convOf,
  crypto, cvReady, db, bijeen, deptsFor, dirTouch, eisAccount, engageError, ensureApplyChat, foutmelder,
  ensureSupplierDefaults, etaMinutes, eventCovers, express, fallbackRunsheet, financeVoor, dagrapport, shiftSamenvatting, findPartner, findStaffPartner,
  findSupplier, forgetSession, forgetSessionDuurzaam, fs, gcCode, geborenVan, geenGast, idGeverifieerd, generateAiReply,
  guestsFor, hasContact, hasCred, haversine, i18n, initRealtime, klokVan, ledenPrijs,
  eersteBijdrageFactuur, ledenInhoudVan, leeftijdVan, leeftijdsgroepVan, leverSse, liveCodename, liveStateFor, load, logActivity, loginFails,
  mail, makeSupplierCode, managerOnly, media, meldWerkgever, memberSays, noteerBeurt, memberTemplate, myApplications, nextSseId, onboarding, boerderij, journalistiek, creator, samenwerking, handelsketen, agenda, notities, bestanden, bestandenOpslag, meet, galerij, klok, boeken, onderwijs, leerstof, bijles, vervolg, facturatie, factuurSaldo, markt,
  noteFailedTry, notify, notifyApplicant, notifySupplier, officeAuth, kluisAuth, naamAuth, boardroomAuth, boardroomLijst, boardroomBaas, boardroomWie, magBoardroom, officeState, openVacatures, optieAan,
  entreeCode, keyVanCodenaam, gidsHaal, gidsZoekCodenaam, gidsWeg, magBezorgen, parseRunsheetText, path, pendingVerifications, pickupCode, pinSlot, posDay, publicPartner, publicSupplier, ticketsVoorSlot,
  publicTrip, pushLive, registerContact, rememberSession, resolveSession, sessieregister, toestellen, bezitsbewijs, tweefactor, commercieel, commercieelStand, commercieelZet, ritBezetting, ritVerder, rtf,
  runItem, runKey, salonNaarVolgers, salonProfielCompleet, salonZichtbaar, salonItemsVan, ...ondernemerpoort, save, scheduleFor, schoon, sectiesForOrder, sendPush,
  sendPushToUser, sessionFor, sessions, setRoomHk, sortRunsheet, speelOpnieuw, sseBuffer, sseClients,
  sseSend, sseToCustomer, sseToOffice, sseToSupplier, stateFor, stationsForOrder, supplierAuth, supplierState, persoonsPoort,
  toRad, tokenHash, tooManyTries, totpOk, trChat, trustVan, unlockDoor, urenVan, validDept, veiligGelijk, logInlog,
  securityLogKeten, handelingsspoor, ankerdienst, ankerpost,
  zorgContact, klantSalon, salonClaimcode,
  // de stemming van Rahul + de geloofslaag (kern/rahul/stemming.js, kern/geloof/)
  geloof, stemmingToon: stemming.stemmingToon, stemmingZet: stemming.stemmingZet,
  stemmingVoor: stemming.stemmingVoor,
  webpush, weekdagFactor, werkgeverSollicitatie,
  // de ervaring-laag (kern/ervaring.js)
  MELDING_SCOPES, reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
  tafelplanning, reserveringTafel, reserveringKomst, walkIn,
  annuleerItem, plaatsReview, reviewsVoor, ratingVan, reviewReageer, toggleFavoriet, favorietenVan, isFavoriet,
  fooiUit, agendaVoor, maakSplits, mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst,
  meldWachtlijst, rsvpAnnuleer, puntenVan, verdienPunten, verzilverPunten, pasTegoedToe, herstelTegoed, puntenKoppelPlafond,
  voorkeurVan, zetVoorkeur,
  // de retail-/mode-laag (kern/retail.js)
  RETAIL_MATEN, RETAIL_SEIZOENEN, retailIsRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
  klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart,
  vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling, retailVerkoop, retailVerkoopTerug, retailPrijsVan, retailAnnuleer, retailBon, ANNULEERGRONDEN, voorraadZoek,
  retailStats, retailState, retailCatalogus,
  /* DE GROOTHANDEL ALS EEN NAAM. Vier van deze zestien werden door zowel member
     als supplier aangeraakt (ghMarkt, ghPlaatsBestelling, ghAnnuleer,
     ghMijnBestellingen), en dat delen is ECHT: een lid bestelt en een zaak levert.
     Precies daarom hoort er een naam te staan waar dat aan te zien is, in plaats
     van vier losse namen in een zak.
     De destructurering hierboven blijft: server.js gebruikt sommige van deze
     namen zelf en geeft ghPlaatsBestelling door aan kern/agent.js. Alleen wat de
     DOMEINEN te zien krijgen, gaat onder een naam. */
  groothandel: { GROOTHANDEL_FUNCTIES, GROOTHANDEL_CATEGORIEEN, ghIsGroothandel, ghDefaults,
    ghFunctieAan, ghFunctieLijst, ghZetFunctie, ghZetProduct, ghZetVoorraad, ghMarkt,
    ghPlaatsBestelling, ghOrderVerder, ghAnnuleer, ghMijnBestellingen, ghInkomend,
    ghBijbestelVoorstel },
  agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis,
  // de mode-bezorging (kern/modebezorg.js)
  mbSetup, mbInstel, mbMagLeveren, mbAanvraag, mbWinkelOverzicht, mbRoute, mbNeem, mbGps, mbOverhandig, mbRetour, mbMijn,
  // de eigen mini-boardroom per zaak (kern/zaak.js)
  ZAAK_CAPS, zaakFunctieAan, zaakFunctieLijst, zaakZet, zaakHr, zaakMarketing, zaakBoard,
  lidboard,
  // het werkgeversbeleid op de boardroom van het lid (alleen dichtzetten,
  // alleen tijdens de dienst, en niet in de pauze-armslag)
  werkbeleid, werkbeleidZet, werkbeleidOverzicht, werkgeversVan,
  werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN,
  // de autoverkoop-laag (kern/autoverkoop.js)
  AUTOVERKOOP_BRANDSTOF, avMagVerkopen, avZetAan, avZetAuto, avVerwijderAuto, avShowroom,
  avAanbevolen, avProefrit, avKoop, avInruil, avBeslis, avTeken, avMijnDeals, avDealerInbox,
  // de beveiligings-laag (kern/beveiliging.js)
  BEVEILIGING_FUNCTIES, BEVEILIGING_SHIFTS, BEVEILIGING_ERNST,
  bevIsBeveiliging, bevDefaults, bevFunctieAan, bevFunctieLijst, bevZetFunctie,
  bevPosten, bevZetPost, bevVerwijderPost, bevBudget, bevZetBudget,
  bevRooster, bevZetDienst, bevSchrapDienst, bevPlanAuto,
  bevAanvraag, bevAanvraagLijst, bevBeslisAanvraag,
  bevMijnDiensten, bevInklok, bevUitklok, bevRondeStart, bevRondeCheckpoint, bevRondeKlaar,
  bevMeldIncident, bevBeslisIncident, bevSos, bevCommand, bevKoppelPlaats,
  // de directe-betaallaag (kern/directpay.js)
  DP_MIN_CENTEN, DP_MAX_CENTEN, dpBetaalDirect, dpMijnBetalingen,
  dpVerzoekMaak, dpVerzoekenVoor, dpBetaalVerzoek, dpVerzoekIntrek, dpOntvangsten,
  // de RTFoundation-afdracht (kern/fonds.js)
  fonds,
  // de munt-ontvangst (kern/munten.js + server/muntbetaal.js)
  munten, muntbetaal,
  // facturen/overzichten als download (kern/factuur.js)
  factuur,
  // branchekennis voor de AI-boekhouder (kern/boekhoudkennis.js)
  boekhoudkennis,
  // wereldtalen (server/talen.js): actieve talen + taalVan voor alle chatpaden
  talen,
  PASPOORT_NIVEAUS, leesUploadDataUrl, paspoortStatus, paspoortVraag, paspoortBeslis,
  paspoortTrekIn, paspoortBekijk, paspoortIncident, paspoortBeoordeel, paspoortMijn,
  paspoortPartner, paspoortIncidenten,
  paspoortVervaldatumVan, paspoortGeboortejaarVan
};

/* De helpers en constanten uit dit bestand die de kernlagen nodig hebben, op
   EEN plek in plaats van een eigen lijstje per laag. Wat hier niet in staat maar
   wel wordt gebruikt, valt bij het opstarten meteen om. */
const hulp = {
  DATA_DIR, FISCAAL_PEILJAAR, LANDEN, PERSONAS, accounts, alcoholGrensVan, annuleerReservering,
  anthropic, app, archief, betaal, betaalOpdrachten, beveilig, capGezondheid, bijeen, bewerkCollectie, economischeBoekingEenmaal, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  broadcastSync, centen: rondEuro, crypto, db, entreeCode, inBundel, etaMinutes, facturatie, findSupplier, fonds, fooiUit,
  geborenVan, haversine, idGeverifieerd, keyVanCodenaam, klantProfiel, klokVan, ledenAantal,
  ledenPrijs, leeftijdVan, legApart, liveCodename, log, logActivity, loginFails, maakOntmoeting,
  mail, media, noteFailedTry, notify, notifySupplier, onboarding, openVacatures, optieAan,
  /* pasTegoedToe EN herstelTegoed horen als PAAR mee. Alleen de eerste stond
     hier, en dat viel niet op omdat de tweede alleen wordt geroepen als een
     betaling MISLUKT of een HERHALING is -- kern/lidacties/afrekenen.js geeft
     het verrekende puntentegoed dan terug. Bij een dubbele betaling op
     dezelfde bestelling (twee tikken, een race) viel de server daardoor met
     "herstelTegoed is not a function": het lid kreeg een 500 waar een nette
     409 hoorde, en het tegoed bleef verrekend. Nooit de ene helft van dit
     paar doorgeven zonder de andere. */
  ordersVanKlant, ordersVanZaak, pasTegoedToe, herstelTegoed, path, pickupCode, pinSlot, pushLive, rememberSession,
  reserveerTafel, rtf, rtmail, save, schoon, sessieregister, sendPush, sendPushToUser, sociaal, sseToCustomer,
  sseToOffice, sseToSupplier, supplierState, ticketsVoorSlot, verdienPunten, zetRtgai, zetServiceOverdracht, zorgContact,
  /* Voor "wie van je vrienden is er nu" (kern/spellen/presence.js): de levende
     lijst van open live-verbindingen, en dezelfde functiepoort die
     /api/member/spel zou weigeren. Ze gaan naar de KERNLAGEN en niet naar de
     kern zelf -- routers hebben ze niet nodig, en die oppervlakte houden we
     klein (zie TAKEN.md 5.14). */
  sseClients, lidBoardUit,
  /* De AI-poort (kern/aipoort.js) gaat mee de kern in: het Ondernemers-OS heeft
     hem nodig en hoort hem niet na te bouwen -- een tweede poort naar dezelfde
     AI is een poort die niemand bewaakt. */
  magAi: (req) => aiPoort.magAi(req)
};

/* De samenstelling van de kern staat in ./opzet/kernlaag1..7.js --
   aaneengesloten stukken in precies deze volgorde. Zie de kop van kernlaag1.js. */
require('./opzet/kernlaag1')(kern, hulp);
require('./opzet/kernlaag1b')(kern, hulp);
require('./opzet/kernlaag2')(kern, hulp);
require('./opzet/kernlaag2b')(kern, hulp);
require('./opzet/kernlaag3')(kern, hulp);
require('./opzet/kernlaag3c')(kern, hulp);  // de commerciele kern; NA pay, want de ronde boekt
require('./opzet/kernlaag3w')(kern, hulp);   // de vier wereldlagen; VOOR 3b, want geldbeleid leest de geldwereld
require('./opzet/kernlaag3b')(kern, hulp);
require('./opzet/kernlaag4')(kern, hulp);
require('./opzet/kernlaag4b')(kern, hulp);
require('./opzet/kernlaag4c')(kern, hulp);   // de drie kantoorkamers; NA 4b, want regering leest kern.bank
require('./opzet/kernlaag5')(kern, hulp);
require('./opzet/kernlaag5f')(kern, hulp);  // RTG Festival; hangt onder EEN naam, zie de kop daar
require('./opzet/kernlaag6')(kern, hulp);
require('./opzet/kernlaag6b')(kern, hulp);
require('./opzet/kernlaag7')(kern, hulp);
require('./opzet/kernlaag7b')(kern, hulp);   // de routers ophangen; zie de kop daar waarom dat NA alle Object.assign moet

/* JSON/SQLite/geheugen zijn al autoritatief geladen. Verwijder oude kale
   Salon-, FoundationOS-Samen- en boarding-passcodes daarom vóór een schrijvende
   instance verkeer kan aannemen. De lokale collectiemotor moet hier synchroon
   committen; als dat ooit verandert, weigert de start in plaats van een half
   gemigreerde instance vrij te geven. */
/* Een losse server begint schrijvend en migreert vóór listen(). Een
   trio-server begint bewust als standby: die mag de gedeelde SQLite-opslag niet
   wijzigen en migreert pas in /api/cluster/promote, direct na zijn verse load().
   Zo blijft opslag fail-closed zonder dat elke gezonde standby in een
   opstart-crashlus belandt. */
if (STORE !== 'postgres' && db.writable) migreerLokaleToegang();
function migreerLokaleToegang() {
  if (STORE !== 'postgres') {
    salonMigratieKlaar = false;
    rtfSamenMigratieKlaar = false;
    boardingPassMigratieKlaar = false;
    const salonMigratie = salonClaimcode.migreerAlles();
    if (salonMigratie && typeof salonMigratie.then === 'function')
      throw new Error('Lokale Salon-claimcodemigratie committe niet synchroon.');
    salonMigratieKlaar = true;
    if (!kern.samenRtf || typeof kern.samenRtf.migreerAlles !== 'function')
      throw new Error('FoundationOS Samen-migratie ontbreekt bij de opslagstart.');
    const rtfSamenMigratie = kern.samenRtf.migreerAlles();
    if (rtfSamenMigratie && typeof rtfSamenMigratie.then === 'function')
      throw new Error('Lokale FoundationOS Samen-migratie committe niet synchroon.');
    rtfSamenMigratieKlaar = true;
    if (!kern.lucht || typeof kern.lucht.migreerBoardingPasses !== 'function')
      throw new Error('TravelOS boarding-passmigratie ontbreekt bij de opslagstart.');
    const boardingMigratie = kern.lucht.migreerBoardingPasses();
    if (boardingMigratie && typeof boardingMigratie.then === 'function')
      throw new Error('Lokale TravelOS boarding-passmigratie committe niet synchroon.');
    boardingPassMigratieKlaar = true;
  }
}

/* DE TWEE SLOTEN OP PUBLIEK VERKOPEN, aan de commerce-laag gegeven als LEZERS.

   Precies dezelfde twee reads als eigenWeb.serveer hierboven doet: de
   boardroom-functie 'dom-eigendomein' en de site die op een eigen adres staat.
   Ze staan hier omdat webmaker en functies in dit bestand wonen en kern/commerce
   in kernlaag2b wordt gebouwd; een tweede lezer in de kern zou een tweede
   antwoord op dezelfde vraag zijn (LAT-regel 4).

   ER GAAT ALLEEN LEESWERK IN. kern/commerce krijgt geen manier om de functie
   aan te zetten of een domein te koppelen -- het kan alleen zien of dat al is
   gebeurd. Zonder deze regels blijft `publiek` dicht met de reden "niet vast te
   stellen", en dat is de goede kant op. */
if (kern.commerce && kern.commerce.koppelPubliek) {
  kern.commerce.koppelPubliek({
    functieAan: (id) => functies.functieAan(id, db.data && db.data.techniek && db.data.techniek.functies),
    siteVan: (zaakCode) => webmaker.siteVanZaak(zaakCode)
  });
}

/* ---------- de afsluiters en de start staan in ./opzet/start.js ----------

   Daar staan: de nette 404, de centrale foutafhandeling, de dagelijkse
   back-up, het periodieke onderhoud, de opstartwaarschuwingen, het luisteren
   op de poort, IMAP, STUN, ACME en het nette afsluiten. Alles in dat bestand
   draait EEN keer, bij de start; geen enkele route roept er iets uit aan.

   Deze aanroep hoort ONDERAAN te blijven: de 404-afsluiters worden daar
   geregistreerd, en wie in Express eerder gaat staan vangt routes af die nog
   moesten komen.

   backupData komt hiervandaan en wordt HIERBOVEN al gebruikt door de
   cluster-route (na een overname). Dat mag: die route draait pas als de server
   luistert, en dan is deze regel allang uitgevoerd. */
const { server, backupData } = require('./opzet/start')({
  app, fs, path, PUBLIC_DIR, DATA_DIR, UPLOAD_DIR,
  log, db, accounts, save, eigenaar, webpush, kern,
  checkpointSqlite, checkpointGrootboek,
  initRealtime, startGedeeld, startSqliteSync,
  startPostgres: startPostgresMetSalon, flushBijAfsluiten,
  DEMO, PRODUCTION, zetEigenaarsAccount, loginFails, pinSlot, ruimBuffer,
  // voor de kappen in de onderhoudsronde: een weggeknipte snap heeft ook een
  // bestand op schijf (zie kern/kappen.js)
  media
});

/* Naar buiten toe is dit een startscript, geen module: niets require't
   server.js. Toch geven we de app mee, zodat een gereedschap (scripts/
   routekaart.js) de ECHT geregistreerde routes kan uitlezen in plaats van ze
   uit de broncode te raden. Alleen lezen; de app draait al. */
module.exports = { app, server };
