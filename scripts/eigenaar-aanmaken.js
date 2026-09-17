#!/usr/bin/env node
/* HET EIGENAARSACCOUNT AANMAKEN -- een bewuste handeling, geen opstartneveneffect.

   WAAROM DIT BESTAAT. server/eigenaar.js legt vast dat de eigenaar de
   RTG-Backoffice opent "met zijn eigen accountlogin, zonder aparte code", en de
   code komt die belofte na: kern/kantoor/index.js laat hem door officeAuth op
   zijn LEDENtoken, kern/eenaccount/afgeleid.js LEIDT de kantoorsleutel voor hem
   af (eigenaarKantoor), en kern/kantoor/boardroom.js herkent hem als baas. Alle
   drie hangen ze aan eigenaar.isEigenaar(), en die vergelijkt het adres van een
   BESTAAND account met eigenaarEmail(). Zonder dat account is de hele keten waar
   en opent er niets -- niet omdat een deur dicht zit, maar omdat er niemand is
   om als in te loggen.

   EN HET ONTSTOND NERGENS MEER. Het werd aangemaakt door zetEigenaarsAccount()
   in server.js, achter `if (DEMO)`. Sinds server/testomgeving.js gaat DEMO
   alleen nog aan met RTG_MAGNAAT_TEST=1 (of NODE_ENV=test + RTG_DEMO=1), want de
   vier echte werelden kennen geen demostand meer. Op een gewone start --
   lokaal, staging, productie -- draait die bootstrap dus nooit. Dat was terecht
   voor de demo-LEDEN en de demo-ZAKEN die eraan hingen; het eigenaarsaccount
   ging als bijvangst mee, en dat was niemands besluit.

   Wat overbleef is de registratie met RTG_OWNER_BOOTSTRAP
   (routes/auth/aanmeldcontrole.js). Die werkt en blijft bestaan, maar hij vraagt
   dat de sleutel in de omgeving van de DRAAIENDE server staat, en hij antwoordt
   bij een ontbrekende sleutel met hetzelfde 409 als bij een bestaand account --
   "Er bestaat al een account met dit e-mailadres", terwijl er niets is. Dat is
   daar met opzet zo (of het eigenaarsadres bezet is gaat een buitenstaander
   niet aan), maar het is een slecht bericht voor de eigenaar zelf.

   WAAROM DIT GEEN ROUTE IS. Die bootstrap-grendel beschermt een PUBLIEKE route
   tegen het open internet; het adres is niet geheim. Dit script beschermt
   zichzelf op een andere manier: het draait op de machine en leest
   RTG_DATA_DIR, waar vault.key en secret.key liggen. Wie dat kan, kan de kluis
   sowieso al openen -- daar valt met een tweede sleutel niets aan toe te voegen.
   Een nieuwe HTTP-route zou dat juist wel doen: een deur erbij die er vandaag
   niet is.

   WAT DIT SCRIPT NIET DOET, en dat is de helft van het ontwerp:

   - GEEN PAS. Het account krijgt `rtg`, net als elke zelf-registratie
     (aanmeldcontrole.js klemt daar naar dezelfde waarde). Lifestyle en Business
     ontstaan uitsluitend in kern/aanmeldingen/besluit.js, na een besluit van een
     HERLEIDBAAR mens -- CLAUDE.md, en die regel weigert daar zelfs de gedeelde
     kantoorcode. Een script is geen mens en laat geen spoor in de aanmeldingen
     na; een pas hier uitdelen zou de enige plek waar die regel woont omzeilen.
   - GEEN VERIFICATIE. setVerification(..., 'verified') betekent in dit huis dat
     een mens een identiteitsbewijs heeft GEZIEN (A3, kern/volwassen.js). Dat is
     hier niet gebeurd, dus staat het er niet. De demo-bootstrap zette het wel,
     en dat mocht daar omdat alles eromheen ook verzonnen was.
   - GEEN KANTOORSLEUTEL AAN DE SLEUTELBOS. De demo-bootstrap schreef er een in
     db.data.accountRollen; dat hoeft niet en het hoort niet. Voor de eigenaar
     wordt die sleutel AFGELEID (kern/eenaccount/afgeleid.js legt uit waarom: aan
     iets wat je al BENT valt niets te koppelen, en een tweede kopie loopt
     gegarandeerd uit de pas met het origineel).
   - GEEN WACHTWOORD VAN EEN BESTAAND ACCOUNT VERVANGEN. Bestaat het adres al,
     dan stopt dit script. De weg terug naar een account zonder toestel is
     eigenaarherstel (server/kern/eigenaarherstel.js), met quorum en wachttijd.

   DE DIAGNOSE MEET, EN DAT KWAM UIT EEN VERKEERDE RAAD IN DIT BESTAND ZELF.
   Bij "isEigenaar() zegt nee terwijl het account er staat" stuurde dit script de
   lezer naar vault.key. Dat is juist de oorzaak die zijn eigen waarneming al
   bijna uitsluit: inloggen gaat op email_hash (een HMAC met de GEPINDE sleutel,
   die met opzet niet meeroteert -- accounts/onderhoud.js roteer), eigenaarschap
   op enc_email (dat met de RING wordt geopend). Werkt de inlog op het ADRES, dan
   klopt de gepinde sleutel dus nog. Wat er dan stuk is, zit in de ring of in de
   binding aan de rij -- en welke van die twee is te TELLEN (onderhoud.stand) in
   plaats van te raden. Kan de telling het niet onderscheiden, met een enkele rij
   in de kluis, dan zegt het script dat en kiest het er geen.

   Draai: npm run eigenaar            -- toont de stand, verandert niets
          npm run eigenaar -- --maak --naam="..." --geboren=1990-01-31 */
'use strict';

const crypto = require('node:crypto');

const eigenaar = require('../server/eigenaar');
const duurzaamheid = require('../server/accounts/duurzaamheid');
const testomgeving = require('../server/testomgeving');
const { leeftijdVan, LID_MIN_LEEFTIJD, LID_MAX_LEEFTIJD } = require('../server/lib/leeftijd');
const { schoon } = require('../server/kern/util');

const MIN_WACHTWOORD = 12;          // strenger dan de zes van de voordeur; zie hieronder
const WACHTWOORD_ENV = 'RTG_EIGENAAR_WACHTWOORD';

/* De kluis wordt LAAT geopend: require('../server/accounts') maakt bij een lege
   datamap meteen secret.key en vault.key aan, en dat hoort niet te gebeuren
   omdat iemand --hulp intikte. Hier staat dus alleen de handgreep. */
let kluis = null;
const openKluis = () => (kluis || (kluis = require('../server/accounts')));

const zeg = (s) => console.log(s === undefined ? '' : s);
const regel = (kop, waarde) => zeg('  ' + kop.padEnd(17) + waarde);

/* HOE IS DIT ACCOUNT GEVONDEN? Dat is geen weetje maar de scharniervraag van de
   diagnose hieronder.

   accounts.findByLogin() zoekt eerst op `email_hash`, en pas als dat niets geeft
   op de inlognaam. Die hash is een HMAC met de GEPINDE kluissleutel (S.VAULT) en
   loopt met opzet NIET mee in een sleutelrotatie -- anders kon niemand na een
   rotatie nog op zijn e-mailadres inloggen (zie accounts/onderhoud.js roteer).

   Daaruit volgt precies een ding, en het scheelt de lezer een verkeerde
   zoektocht: is het account op zijn E-MAILADRES gevonden, dan is de gepinde
   sleutel nog dezelfde als die waarmee de hash ooit is gemaakt. Een "de
   vault.key is veranderd" verklaart dan NIETS -- dan was dit account op zijn
   adres helemaal niet meer te vinden en zou inloggen ook niet meer werken. */
function hoeGevonden(accounts, adres, bestaand) {
  if (!bestaand) return null;
  try {
    const opAdres = accounts.findByLogin(adres);
    if (opAdres && opAdres.id === bestaand.id) {
      const opNaam = accounts.findByLogin(String(bestaand.username || ''));
      // alleen "op de hash" als de naam-terugval het niet ook al verklaart
      if (!(opNaam && opNaam.id === bestaand.id && String(bestaand.username || '').includes('@'))) return 'e-mailhash';
    }
  } catch (e) { return null; }
  return 'inlognaam';
}

/* De stand van de identiteitskluis: hoeveel rijen gaan open, hoeveel niet, en
   hoeveel sleutels zitten er in de ring. Dat onderscheidt een storing die de
   HELE tabel raakt (een verdwenen vault.ring na een rotatie) van een die alleen
   DEZE rij raakt (een blob die niet meer bij zijn rij-id hoort).

   Geen eigen crypto en geen eigen telling: dit is accounts/onderhoud.js stand(),
   dezelfde functie die het onderhoud zelf gebruikt. */
function kluisStand() {
  try {
    const S = require('../server/accounts/state');
    const db = S.huidigeDb();
    if (!db) return null;
    return require('../server/accounts/onderhoud').stand(db);
  } catch (e) { return null; }
}

function argumenten(argv) {
  const uit = { maak: false, hulp: false };
  for (const a of argv) {
    if (a === '--maak') { uit.maak = true; continue; }
    if (a === '--hulp' || a === '--help' || a === '-h') { uit.hulp = true; continue; }
    const m = /^--([a-z]+)=([\s\S]*)$/.exec(a);
    if (m) uit[m[1]] = m[2];
  }
  return uit;
}

/* Een wachtwoord dat niemand hoeft te onthouden en niemand hoeft te bedenken.
   Rejection sampling via crypto.randomInt: een modulo over randomBytes trekt de
   eerste tekens van het alfabet scheef, en dat is precies de soort verzwakking
   die je bij een wachtwoord nooit terugziet. Zonder I, l, O, 0 en 1, want dit
   wordt een keer met de hand overgetypt. */
function verzinWachtwoord() {
  const alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let uit = '';
  for (let i = 0; i < 24; i++) uit += alfabet[crypto.randomInt(0, alfabet.length)];
  return uit.replace(/(.{6})(?=.)/g, '$1-');
}

function stop(bericht, uitleg) {
  zeg('');
  zeg('GEWEIGERD -- ' + bericht);
  for (const r of [].concat(uitleg || [])) zeg('  ' + r);
  zeg('');
  process.exitCode = 1;
  return false;
}

function toonHulp() {
  zeg('');
  zeg('  npm run eigenaar');
  zeg('      toont de stand van het eigenaarsaccount en verandert niets.');
  zeg('');
  zeg('  npm run eigenaar -- --maak --naam="Rahul Imran Ismail" --geboren=1990-01-31');
  zeg('      maakt het account aan op het adres uit RTG_OWNER_EMAIL.');
  zeg('      --telefoon=  is optioneel (net als bij de gewone aanmelding).');
  zeg('');
  zeg('  Het wachtwoord komt uit ' + WACHTWOORD_ENV + ' als die gezet is; anders');
  zeg('  verzint dit script er een en toont hem EEN keer. Geef hem niet mee op de');
  zeg('  opdrachtregel: die belandt in de geschiedenis van uw shell.');
  zeg('');
}

/* De productiegrendel van de identiteitscache (server/accounts/duurzaamheid.js).
   Met NODE_ENV=production EN een DATABASE_URL zijn ALLE accountmutaties dicht --
   ook die van de registratieroute -- omdat users/staff nog niet meedoen aan de
   atomaire requestcommit. Dat is geen grendel om heen te werken, en dit script
   doet dat niet. Het zegt wat er aan de hand is en wat wel kan: dit script draait
   BUITEN een verzoek, dus er is geen requesttransactie om aan deel te nemen, en
   het spiegelt zelf naar Postgres voordat het afsluit. */
function grendelUitleg() {
  return [
    'NODE_ENV=production en DATABASE_URL staan allebei: accountmutaties zijn dicht',
    '(server/accounts/duurzaamheid.js). Dat geldt voor elke schrijver, ook voor',
    '/api/auth/register -- er is in deze modus geen enkele weg naar een eerste account.',
    '',
    'Draai dit script tegen dezelfde gegevens met NODE_ENV leeg:',
    '  RTG_DATA_DIR=... DATABASE_URL=... node scripts/eigenaar-aanmaken.js --maak ...',
    'Het schrijft dan naar de kluis en wacht tot de Postgres-spiegel klaar is.'
  ];
}

/* Waar het eigenaarsadres vandaan komt. Begint op de ingebouwde standaard en
   wordt hieronder bijgesteld; hij staat op modulehoogte omdat hoofd() hem zet en
   diagnose() hem leest. */
let herkomst = 'de standaard uit server/eigenaar.js';

/* De overdrachtswaarde uit de OPERATIONELE opslag, los van de kluis. Faalt dit,
   dan zeggen we dat -- een diagnose die stilletjes 'geen overdracht' meldt
   terwijl hij niet kon kijken, wijst de verkeerde kant op. */
async function leesOverdracht() {
  try {
    const dbm = require('../server/db');
    if (typeof dbm.load === 'function') await dbm.load();
    const t = dbm.db && dbm.db.data && dbm.db.data.techniek;
    return (t && t.eigenaarEmail) || null;
  } catch (e) {
    herkomst = 'ONBEKEND -- de opslag kon niet gelezen worden (' + (e && e.message ? e.message : e) + ')';
    return null;
  }
}

/* DE DIAGNOSE. Hij stelt precies de vraag die de kantoordeur en de boardroom
   stellen -- eigenaar.isEigenaar() -- en niet een eigen benadering daarvan. Zegt
   die nee terwijl er wel een account staat, dan zoekt hij UIT waarom, in plaats
   van de lezer te laten raden.

   Wat hij NOOIT doet is andermans identiteit tonen. Er komt precies een adres op
   het scherm: dat van de eigenaar, en dat kent degene die dit draait al. */
function diagnose(accounts, adres, bestaand) {
  if (!bestaand) {
    regel('account', 'GEEN -- er staat niets op dit adres');
    zeg('');
    zeg('  De backoffice en de boardroom blijven dicht zolang dit account niet bestaat:');
    zeg('  eigenaar.isEigenaar() vergelijkt het adres van een BESTAAND account.');
    zeg('');
    zeg('  Aanmaken doet:');
    zeg('    npm run eigenaar -- --maak --naam="Uw naam" --geboren=JJJJ-MM-DD');
    zeg('');
    return;
  }

  const gelezen = (() => { try { return accounts.emailOf(bestaand); } catch (e) { return null; } })();
  const klopt = eigenaar.isEigenaar(accounts, bestaand);
  /* Twee metingen die alleen de NEE-tak nodig heeft, maar die hier worden gedaan
     omdat ze over dit account gaan en niet over de uitleg eronder. */
  const gevonden = hoeGevonden(accounts, adres, bestaand);
  const stand = kluisStand();
  /* `verified` is een TEKSTkolom met 'unverified' als standaard, dus een ja/nee-test
     erop is ALTIJD ja -- die stond hier even en meldde elk vers account als
     geverifieerd. De waarde zelf tonen is korter en het liegt niet. */
  regel('account', '#' + bestaand.id + '  pas ' + bestaand.tier +
    '  identiteit ' + (bestaand.verified || 'onbekend') +
    (accounts.isActief(bestaand) ? '' : '  NIET ACTIEF'));
  regel('isEigenaar()', klopt
    ? 'JA -- backoffice en boardroom staan open op dit account'
    : 'NEE -- en dat is precies waarom de deur dichtblijft');

  /* De sleutelbos, want "het kantoor gaat niet open" kan hier ook vandaan komen.
     De afgeleide sleutel van de eigenaar wordt op dezelfde plek berekend als in
     de app (kern/eenaccount/afgeleid.js), niet nagebouwd. */
  try {
    const dbm = require('../server/db');
    const afgeleid = require('../server/kern/eenaccount/afgeleid')({ db: dbm.db, accounts });
    const bos = ((dbm.db.data || {}).accountRollen || {})['user-' + bestaand.id] || [];
    const gekoppeld = bos.filter(r => r && r.rol === 'kantoor').length > 0;
    regel('kantoorsleutel', afgeleid.eigenaarKantoor('user-' + bestaand.id)
      ? 'afgeleid (via het eigenaarschap)'
      : (gekoppeld ? 'gekoppeld met de backoffice-code' : 'GEEN -- geen afgeleide en geen gekoppelde'));
  } catch (e) { regel('kantoorsleutel', 'niet vast te stellen (' + (e && e.message ? e.message : e) + ')'); }

  if (klopt) {
    zeg('');
    zeg('  De deur staat open op dit account. Komt u er tóch niet in, dan zit het niet');
    zeg('  in het eigenaarschap maar in de weg ernaartoe: log in als lid en open de');
    zeg('  werk-kiezer (/api/account/rollen toont de rol, /api/account/start opent hem).');
    if (bestaand.tier !== 'business' && bestaand.tier !== 'lifestyle') {
      zeg('');
      zeg('  Let op: uw PAS is ' + bestaand.tier + ' en niet business of lifestyle. Eigenaarschap');
      zeg('  en pas zijn twee dingen -- het eerste opent het kantoor, het tweede de');
      zeg('  betaalde functies. Een pas ontstaat in kern/aanmeldingen/besluit.js, na een');
      zeg('  besluit van een herleidbaar mens; dat mag u nu zelf zijn.');
    }
    zeg('');
    return;
  }

  zeg('');
  zeg('  WAAROM isEigenaar() NEE ZEGT -- gemeten, niet geraden:');
  if (gelezen == null) {
    zeg('   - De e-mail van dit account is NIET UIT DE KLUIS TE LEZEN. Het inloggen werkt');
    zeg('     nog (dat gaat op een hash), maar het huis kan niet meer zien wie u bent.');
    zeg('');
    /* WAAROM HIER NIET GEWOON "KIJK NAAR VAULT.KEY" STAAT.

       Dat stond er wel, en het wees de lezer naar de ene oorzaak die door zijn
       eigen waarneming al bijna is uitgesloten. Het inloggen gaat op email_hash,
       een HMAC met de GEPINDE sleutel; het eigenaarschap gaat op enc_email, dat
       met de RING wordt geopend. Die twee zijn met opzet losgekoppeld, zodat een
       sleutelrotatie niemand buitensluit (accounts/onderhoud.js, roteer).

       Dus: is dit account op zijn adres gevonden, dan klopt de gepinde sleutel
       nog. Wat er dan stuk is, zit in de RING of in de BINDING -- en welke van
       die twee is te meten in plaats van te raden. */
    if (gevonden === 'e-mailhash') {
      zeg('     Dit account is op zijn E-MAILADRES gevonden. Daaruit volgt dat de gepinde');
      zeg('     kluissleutel nog dezelfde is als die waarmee de hash is gemaakt -- anders');
      zeg('     was het op dat adres niet te vinden en kon u ook niet meer inloggen.');
      zeg('     Een veranderde vault.key verklaart dit dus NIET.');
    } else {
      zeg('     Dit account is op zijn INLOGNAAM gevonden en niet op het adres. Dan kan de');
      zeg('     gepinde kluissleutel wel degelijk zijn veranderd; kijk naar vault.key en');
      zeg('     RTG_VAULT_KEY, en of die tussen instances gelijk is.');
    }
    zeg('');
    if (stand) {
      zeg('     De kluis, geteld: ' + stand.rijen + ' rijen -- ' + stand.gebonden + ' gebonden, '
        + stand.ongebonden + ' ongebonden, ' + stand.onleesbaar + ' ONLEESBAAR'
        + ' (' + stand.sleutels + ' sleutel' + (stand.sleutels === 1 ? '' : 's') + ' in de ring).');
      /* EEN ONDERSCHEID DAT JE MET EEN RIJ NIET KUNT MAKEN, MAAK JE NIET.

         "Meer rijen dan deze staan dicht" wijst naar de ring, "alleen deze rij"
         naar de binding -- maar op een installatie met precies EEN account zien
         die twee er identiek uit: onleesbaar is dan hoe dan ook 1. Hier iets
         kiezen zou een gok zijn met de toon van een meting. */
      if (stand.rijen <= 1) {
        zeg('     Er staat maar een rij in de kluis, dus deze telling kan de twee mogelijke');
        zeg('     oorzaken NIET uit elkaar houden. Ze zijn allebei nog open:');
        zeg('       * de RING: na een sleutelrotatie wordt er met een nieuwe sleutel verzegeld,');
        zeg('         en die staat in vault.ring (of RTG_VAULT_RING). Raakt dat kwijt, dan');
        zeg('         blijft inloggen werken en gaat de kluis dicht -- precies dit beeld.');
        zeg('       * de BINDING: een RTGV2-waarde hoort bij (tabel, kolom, rij-id), dus een');
        zeg('         rij die een ander id kreeg (herimport, restore, opnieuw ingevoegd) gaat');
        zeg('         niet meer open terwijl de hash blijft werken.');
        zeg('     Kijk eerst of vault.ring bestaat en of RTG_VAULT_RING gezet is.');
      } else if (stand.onleesbaar > 1) {
        zeg('     Meer rijen dan deze staan dicht. Dat wijst op de RING en niet op deze rij:');
        zeg('     na een sleutelrotatie wordt er met een NIEUWE sleutel verzegeld, en die');
        zeg('     staat in vault.ring (of RTG_VAULT_RING). Raakt dat bestand kwijt -- een');
        zeg('     datamap die per deploy verdwijnt, een tweede instance zonder de ring --');
        zeg('     dan blijft inloggen werken en gaat de kluis dicht. Precies dit beeld.');
        zeg('     Zet de ring terug; herzegelen repareert dit NIET (accounts/onderhoud.js');
        zeg('     laat een onleesbare kolom met opzet staan, want overschrijven zou de');
        zeg('     gegevens vernietigen zodra de sleutel later alsnog terugkomt).');
      } else {
        zeg('     Alleen DEZE rij staat dicht. Dan is het de BINDING en niet de sleutel: een');
        zeg('     RTGV2-waarde is verzegeld aan (tabel, kolom, rij-id), dus een rij die een');
        zeg('     ander id heeft gekregen -- een herimport, een restore, een spiegel die de');
        zeg('     rij opnieuw heeft ingevoegd -- gaat niet meer open, terwijl de hash en dus');
        zeg('     het inloggen gewoon blijven werken.');
      }
    } else {
      zeg('     De stand van de kluis was hier niet op te nemen, dus welke van de twee het');
      zeg('     is (de ring, of de binding van deze ene rij) staat hier niet vast.');
    }
  } else if (gelezen.trim().toLowerCase() !== String(adres).trim().toLowerCase()) {
    zeg('   - Het account dat op dit adres gevonden wordt, draagt in de kluis een ANDER');
    zeg('     adres. Inloggen gaat op de e-mailhash, eigenaarschap op de kluiswaarde;');
    zeg('     die twee lopen hier uiteen.');
  } else {
    zeg('   - Adres en kluiswaarde komen overeen en toch zegt isEigenaar() nee. Dat hoort');
    zeg('     niet te kunnen; noteer deze uitslag voordat u iets verandert.');
  }
  zeg('');
  zeg('   Staat er hierboven een ander eigenaarsadres dan u verwacht, kijk dan eerst naar');
  zeg('   de herkomst: een overdracht vanuit de boardroom wint van RTG_OWNER_EMAIL, en');
  zeg('   die overdracht overleeft een herstart.');
  zeg('');
}

async function hoofd() {
  const arg = argumenten(process.argv.slice(2));
  if (arg.hulp) return toonHulp();

  const accounts = openKluis();
  /* init() opent rtg.db, draait de schemamigraties EN laadt de sleutels
     (secret.key, vault.key, de ring). Zonder die aanroep staat de kluissleutel op
     null en valt de eerste emailHash om -- dezelfde volgorde als server.js. */
  accounts.init();
  await accounts.startPostgres();   // zonder DATABASE_URL een no-op

  /* HET OVERGEDRAGEN EIGENAARSCHAP, en dat is geen bijzaak.

     server.js leest bij het opstarten `db.data.techniek.eigenaarEmail` en zet dat
     in de eigenaar-module VOOR de routers laden (de overdracht vanuit de
     boardroom). Staat daar een ander adres, dan is de eigenaar van dit platform
     iemand anders -- en dan gaan de kantoordeur en de boardroom voor u dicht
     terwijl u gewoon kunt inloggen. Dit script moet in dezelfde volgorde lezen,
     anders diagnosticeert het een platform dat niet draait. */
  const overdracht = await leesOverdracht();
  if (overdracht && eigenaar.zetEigenaarEmail(overdracht)) herkomst = 'overgedragen vanuit de boardroom';
  else if (process.env.RTG_OWNER_EMAIL) herkomst = 'uit RTG_OWNER_EMAIL';

  const adres = eigenaar.eigenaarEmail();
  const bestaand = accounts.findByLogin(adres);
  const stand = testomgeving.status(process.env);

  zeg('');
  zeg('RTG -- eigenaarsaccount');
  regel('eigenaarsadres', adres);
  regel('  herkomst', herkomst);
  regel('datamap', process.env.RTG_DATA_DIR || 'server/data');
  regel('omgeving', stand.omgeving + (stand.testomgeving
    ? '  (MAGNAAT TEST: synthetische leden, zaken en een wachtwoord uit de repo)' : ''));
  regel('accounts', String(accounts.count()) + ' in de kluis');
  regel('mutaties', duurzaamheid.gesloten() ? 'DICHT (productie + Postgres)' : 'open');
  regel('kantoorcode', process.env.OFFICE_CODE
    ? 'gezet' : 'NIET gezet -- willekeurig en na elke herstart anders');

  if (!arg.maak) { diagnose(accounts, adres, bestaand); return; }

  if (duurzaamheid.gesloten()) return stop('accountmutaties zijn gesloten in deze modus.', grendelUitleg());
  if (bestaand) {
    return stop('er is al een account op ' + adres + ' (#' + bestaand.id + ').', [
      'Dit script overschrijft niets en vervangt geen wachtwoord -- dat zou van een',
      'opstarthulp een achterdeur maken.',
      'Wachtwoord kwijt: /api/auth/reset. Toestel kwijt: server/kern/eigenaarherstel.js.']);
  }

  const naam = schoon(arg.naam, 80);
  if (!naam) return stop('--naam ontbreekt.', ['De echte naam gaat versleuteld de kluis in en wordt in de backoffice (KYC) getoond.']);

  const geboren = String(arg.geboren || '').slice(0, 10);
  const lft = leeftijdVan(geboren);
  if (lft == null) return stop('--geboren ontbreekt of is geen JJJJ-MM-DD.',
    ['De geboortedatum stuurt de leeftijdsgroep en de 18+-poort; zonder datum staat die dicht.']);
  if (lft < LID_MIN_LEEFTIJD || lft > LID_MAX_LEEFTIJD)
    return stop('die geboortedatum kan niet (' + lft + ' jaar).',
      ['RTG kan vanaf ' + LID_MIN_LEEFTIJD + ' jaar; boven de ' + LID_MAX_LEEFTIJD + ' is het een typefout in het jaartal.']);

  /* Dezelfde regel als bij de gewone aanmelding: te kort om te kloppen = weglaten
     in plaats van weigeren. Een telefoonnummer hoort niet bij een account maar bij
     een handeling waar een derde partij bij komt (kern/gegevenspoort.js). */
  const telefoonIn = String(arg.telefoon || '').trim().slice(0, 30);
  const telefoon = telefoonIn.replace(/\D/g, '').length >= 8 ? telefoonIn : null;

  /* MIN_WACHTWOORD is 12 en niet de 6 van de voordeur, en dat is geen strengheid
     om de strengheid: dit ene account opent de technische pagina, de boardroom en
     de hoofdzekering. Waar de grens hoger ligt, staat hij hier -- niet als tweede
     lezing van de regel van de voordeur, maar als een eigen eis bij een eigen deur. */
  const gegeven = String(process.env[WACHTWOORD_ENV] || '');
  const verzonnen = !gegeven;
  const wachtwoord = gegeven || verzinWachtwoord();
  if (wachtwoord.length < MIN_WACHTWOORD)
    return stop(WACHTWOORD_ENV + ' is korter dan ' + MIN_WACHTWOORD + ' tekens.',
      ['Laat hem leeg, dan verzint dit script er een en toont hem een keer.']);

  let user;
  try {
    user = await accounts.createUser({ email: adres, username: null, password: wachtwoord,
      tier: 'rtg', realName: naam, phone: telefoon });
  } catch (e) {
    return stop('de kluis nam het account niet aan: ' + (e && e.message ? e.message : e),
      ['Draait er een tweede schrijver op dezelfde datamap? Zet die even stil en probeer opnieuw.']);
  }

  /* De startinhoud komt uit kern/lid.js en niet uit een kopie hier: memberTemplate
     is de plek waar staat dat een nieuw account LEEG begint (geen demo-reis, geen
     geerfde facturen), en eersteBijdrageFactuur maakt de eigen maandbijdrage op
     naam en maand. Zo ontstaat hier geen tweede SOORT account.

     Wat de route daarnaast in de ledenstaat zet en dit script niet, is het
     bewijs van de bevestigingsmail (`emailBevestiging`) -- er is hier geen
     mail-laag om er een te versturen, en een bewijs neerzetten voor een mail
     die nooit vertrok is erger dan het veld leeg laten. Geslacht, land en
     plaats zijn optionele velden van het formulier; die vult u in de app. */
  const lid = require('../server/kern/lid').maakLid({ accounts, db: { data: {} } });
  const md = lid.memberTemplate();
  const eerste = lid.eersteBijdrageFactuur(user.tier, user.id, user.created_at);
  if (eerste) md.invoices = [eerste];
  md.geboren = geboren;
  accounts.saveMemberState(user.id, md);

  /* DE PROEF, en niet de aanname. Het hele punt van dit script is dat
     isEigenaar() voortaan waar is; dat wordt hier GEVRAAGD aan dezelfde functie
     die de kantoordeur en de boardroom gebruiken. Zegt die nee, dan is het
     account gemaakt maar het doel gemist, en dat hoort hardop. */
  const klopt = eigenaar.isEigenaar(accounts, accounts.getUserById(user.id));
  accounts.checkpoint();            // de WAL in het hoofdbestand drukken

  zeg('');
  zeg(klopt ? 'AANGEMAAKT' : 'AANGEMAAKT, MAAR HET ADRES KLOPT NIET');
  regel('account', '#' + user.id + '  codenaam ' + user.codename);
  regel('adres', adres);
  regel('pas', user.tier + '  (Lifestyle/Business komen uit een menselijk besluit)');
  regel('wachtwoord', verzonnen ? wachtwoord : 'uit ' + WACHTWOORD_ENV + ' (niet getoond)');
  regel('eigenaar?', klopt ? 'ja -- backoffice en boardroom staan open op dit account' : 'NEE');
  if (verzonnen) {
    zeg('');
    zeg('  Dit wachtwoord wordt nooit meer getoond. Bewaar het nu, en zet er in de app');
    zeg('  een passkey naast (server/webauthn/) zodat u het niet meer nodig heeft.');
  }
  if (!klopt) {
    zeg('');
    zeg('  eigenaar.isEigenaar() zegt nee over het account dat zojuist op dat adres is');
    zeg('  gemaakt. Dat kan niet kloppen. Draai `npm run eigenaar` zonder argumenten');
    zeg('  voordat u verder gaat: die telt de kluis en noemt de oorzaak, in plaats van');
    zeg('  u een sleutel te laten zoeken. Het account staat er, de deur niet open.');
    process.exitCode = 1;
  }

  zeg('');
  zeg('  Wat er NIET is gebeurd, en waarom:');
  zeg('   - geen bevestigingsmail: dit script heeft geen mail-laag. Log in en vraag hem');
  zeg('     opnieuw aan (/api/auth/resend); inloggen werkt ook zonder.');
  zeg('   - geen identiteitsverificatie: die betekent dat een mens uw paspoort heeft');
  zeg('     gezien. Tot dan is de 18+-poort dicht (kern/volwassen.js).');
  zeg('   - geen pas boven RTG: dien een aanmelding in en beslis erover in de');
  zeg('     backoffice. Dat besluit eist een herleidbaar persoon, en dat bent u nu.');
  zeg('');
  zeg('  De weg naar binnen: log in met dit adres, en de kantoorrol staat in de');
  zeg('  werk-kiezer (/api/account/rollen toont hem afgeleid, /api/account/start opent hem).');
  zeg('');
}

hoofd()
  .catch(e => { zeg(''); zeg('MISLUKT -- ' + (e && e.stack ? e.stack : e)); zeg(''); process.exitCode = 1; })
  /* Afsluiten met de spiegel LEEG: zonder DATABASE_URL is dit een no-op, en met
     een DATABASE_URL is het het verschil tussen een account dat in Postgres staat
     en een account dat alleen in de lokale cache stond toen het proces stopte. */
  .finally(async () => { if (kluis) { try { await kluis.flushBijAfsluiten(); } catch (e) {} } });
