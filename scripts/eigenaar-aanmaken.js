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

   Draai: npm run eigenaar            -- toont de stand, verandert niets
          npm run eigenaar -- --maak --naam="..." --geboren=1990-01-31 */
'use strict';

const crypto = require('node:crypto');

const eigenaar = require('../server/eigenaar');
const duurzaamheid = require('../server/accounts/duurzaamheid');
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
const regel = (kop, waarde) => zeg('  ' + kop.padEnd(14) + waarde);

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

async function hoofd() {
  const arg = argumenten(process.argv.slice(2));
  if (arg.hulp) return toonHulp();

  const adres = eigenaar.eigenaarEmail();
  const accounts = openKluis();
  /* init() opent rtg.db, draait de schemamigraties EN laadt de sleutels
     (secret.key, vault.key, de ring). Zonder die aanroep staat de kluissleutel op
     null en valt de eerste emailHash om -- dezelfde volgorde als server.js. */
  accounts.init();
  await accounts.startPostgres();   // zonder DATABASE_URL een no-op
  const bestaand = accounts.findByLogin(adres);

  zeg('');
  zeg('RTG -- eigenaarsaccount');
  regel('adres', adres + (process.env.RTG_OWNER_EMAIL ? '  (uit RTG_OWNER_EMAIL)' : '  (standaard uit server/eigenaar.js)'));
  regel('datamap', process.env.RTG_DATA_DIR || 'server/data');
  regel('accounts', String(accounts.count()) + ' in de kluis');
  regel('mutaties', duurzaamheid.gesloten() ? 'DICHT (productie + Postgres)' : 'open');
  regel('stand', bestaand
    ? 'account #' + bestaand.id + ' bestaat, pas ' + bestaand.tier
    : 'GEEN eigenaarsaccount -- de backoffice en de boardroom blijven dicht');

  if (!arg.maak) {
    zeg('');
    zeg(bestaand
      ? 'Er valt hier niets aan te maken. Kwijt geraakt? Dat is eigenaarherstel, niet dit script.'
      : 'Dit script toont alleen. Aanmaken doet:');
    if (!bestaand) zeg('  npm run eigenaar -- --maak --naam="Uw naam" --geboren=JJJJ-MM-DD');
    zeg('');
    return;
  }

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
    zeg('  gemaakt. Dat kan niet kloppen; kijk naar RTG_OWNER_EMAIL en de kluissleutel');
    zeg('  (vault.key) voordat u verder gaat. Het account staat er, de deur niet open.');
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
