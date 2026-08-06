/* ============================================================================
   DE ROUTEBEDRADING: welke domeinen dit proces bedient, en wat er op de kern
   wordt gehangen.

   WAAROM DIT EEN EIGEN BESTAND IS

   Dit blok stond in server/server.js, dat met 212 kilobyte twintig keer over de
   eigen 10 kB-grens was -- en daar nooit op werd aangesproken, want de
   omvangregel in scripts/keuring.js keek alleen naar bestanden VLAK ONDER die
   grens en liet alles erboven lopen (zie de kop van uitschieters() daar).

   Het is ook de natuurlijke naad. Alles wat in server.js overblijft BOUWT de
   kern op; vanaf hier wordt er alleen nog opgehangen. Die twee dingen in een
   bestand maakte moeilijk te zien waar het een ophoudt -- en juist die grens
   wil je kunnen nakijken: krijgt elke router dezelfde kern, en hangt er niets
   buiten de domeinkeuze om?

   DE VOLGORDE IS GEDRAG, GEEN SMAAK. Sommige routers lezen wat een eerdere
   heeft neergezet (doos leest kern.afdelingen; de bibliothecaris wil de biebs
   die er vlak boven bij komen). De regels zijn daarom letterlijk overgenomen,
   in dezelfde volgorde, met hun eigen uitleg erbij.

   WAT ER BINNENKOMT. Alles wat dit blok nodig had, stond al IN de kern -- die
   bag wordt hierboven in server.js gevuld. Het wordt hier dus uit kern gehaald
   in plaats van als losse parameters doorgegeven: een tweede lijst zou meteen
   uit de pas kunnen lopen met de eerste, en dat is precies de dubbele
   boekhouding waar dit huis zich vaker op heeft gebrand.

   Geeft terug welke domeinen er echt zijn opgehangen; server.js gebruikt die
   lijst voor het archiveren en voor de startmelding.
   ========================================================================== */
'use strict';

module.exports = function hangRoutesOp(kern) {
  const { db, save, crypto, schoon, sseToCustomer, accounts, anthropic,
    beveilig, logboek, fs, path, DATA_DIR, rtf, gidsHaal, keyVanCodenaam, leeftijdVan, leeftijdInstr } = kern;

  /* DE DOMEINGRENS. Elke router krijgt vanaf hier geen kern meer maar een
     DOORKIJK op de kern die alleen doorlaat wat dat domein in GRENZEN.json heeft
     opgeschreven (server/opzet/domeingrens.js). Reikt een domein daarbuiten, dan
     gooit het bij de eerste aanraking met een fout die het domein en de naam
     noemt -- geen undefined, want daar slaat code stil overheen.

     Het is een Proxy en geen kopie omdat de kern LATE BINDING doet: sommige
     routers noemen een naam die er bij het ophangen nog niet is (zie de kop van
     routes/supplier/genrepuls.js). Een kopie bevriest dat.

     De belofte hieronder -- "met RTG_DOMAINS draait dit proces alleen die
     domeinen" -- is hier voor het eerst meer dan een belofte: een domein KAN nu
     niet meer bij het werk van een ander. */
  const grens = require('./domeingrens').maakVoor(kern);
  /* Welke domeinen dit proces bedient. Standaard alle (een proces, gedeeld
     geheugen, zoals nu). Met RTG_DOMAINS=member,social draait dit proces alleen
     die domeinen; een gateway (server/poort.js) stuurt de padprefixen dan naar
     het juiste domeinproces. De infra-endpoints (health, stream, push, cluster,
     translate) en de foundation-mount zitten in de kern en draaien altijd mee. */
  const ALLE_DOMEINEN = ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk'];
  const gekozenDomeinen = (process.env.RTG_DOMAINS || ALLE_DOMEINEN.join(','))
    .split(',').map(s => s.trim()).filter(s => s && s !== '-'); // '-' = bewust geen domeinen (vloot)
  for (const naam of gekozenDomeinen) {
    if (!ALLE_DOMEINEN.includes(naam)) { console.warn('[start] onbekend domein overgeslagen:', naam); continue; }
    require('../routes/' + naam)(grens(naam));
  }
  // De verplichte onboarding + het contract raken leden, gasten, de eigenaar en
  // leveranciers; net als de infra-endpoints draait dit altijd mee.
  require('../routes/onboarding')(grens('onboarding'));
  require('../routes/aanmeldgesprek')(grens('aanmeldgesprek'));
  require('../routes/kantoorgesprek')(grens('kantoorgesprek'));
  /* SSO staat naast de auth-routes en niet erin: het is een tweede weg naar
     binnen, met een eigen levensloop (koppelingen, providers), en het moet ook
     draaien als het auth-domein apart is opgestart. */
  require('../routes/sso')(grens('sso'));
  /* SCIM: de provisioning-deur voor de IdP van een klant. Eigen auth (een sleutel
     per organisatie), dus bewust naast de gewone routes en niet in een domein. */
  require('../routes/scim')(grens('scim'));
  require('../routes/meting')(grens('meting'));
  require('../routes/algpin')(grens('algpin'));
  require('../routes/werkbeleid')(grens('werkbeleid'));
  require('../routes/sleutelwoorden')(grens('sleutelwoorden'));
  require('../routes/agenda')(grens('agenda'));
  require('../routes/notities')(grens('notities'));
  require('../routes/bestanden')(grens('bestanden'));
  require('../routes/meet')(grens('meet'));
  require('../routes/galerij')(grens('galerij'));
  require('../routes/klok')(grens('klok'));
  require('../routes/vertaal')(grens('vertaal'));
  require('../routes/memo')(grens('memo'));
  require('../routes/boeken')(grens('boeken'));
  require('../routes/onderwijs')(grens('onderwijs'));
  require('../routes/leerstof')(grens('leerstof'));
  require('../routes/bijles')(grens('bijles'));
  require('../routes/facturatie')(grens('facturatie'));
  require('../routes/rtmail')(grens('rtmail'));
  require('../routes/rtmail-vak')(grens('rtmail-vak'));
  require('../routes/rtmail-schrijf')(grens('rtmail-schrijf'));
  require('../routes/rtmail-bestuur')(grens('rtmail-bestuur'));
  require('../routes/rtmail-team')(grens('rtmail-team'));
  require('../routes/werkmail')(grens('werkmail'));
  require('../routes/mailpost')(grens('mailpost'));
  require('../routes/payroll')(grens('payroll'));
  require('../routes/huis')(grens('huis'));
  require('../routes/muziek')(grens('muziek'));
  require('../routes/muziek-samen')(grens('muziek-samen'));
  require('../routes/atelierweb')(grens('atelierweb'));
  require('../routes/webmaker')(grens('webmaker'));
  require('../routes/journalistiek')(grens('journalistiek'));
  require('../routes/markt')(grens('markt'));
  require('../routes/borden')(grens('borden'));
  require('../routes/spellen')(grens('spellen'));
  require('../routes/leren')(grens('leren'));
  /* De RTF-bieb-routes (de kern staat al bij de Mall-bibliotheken). */
  require('../routes/rtfbieb')(grens('rtfbieb'));
  /* De Geloof & Wijsheid-Bibliotheek-routes (kern staat al hierboven). */
  require('../routes/geloofbieb')(grens('geloofbieb'));
  /* Het RTF-kantoor, Clubs & steden en het Onderzoekslab (kern staat al hierboven). */
  require('../routes/rtfkantoor')(grens('rtfkantoor'));
  /* De twee werkplekken RTG en RTF (kern staat al hierboven). */
  require('../routes/werkplek')(grens('werkplek'));
  /* Het RTG Werk OS: de werkplek van een hele organisatie (server/bedrijf/).
     Staat naast werkplek.js en niet erin: dat is het beeld van RTG en RTF zelf,
     dit is een werkruimte die ook aan een andere organisatie te geven is. */
  require('../routes/bedrijf')(grens('bedrijf'));
  require('../routes/labfonds')(grens('labfonds'));
  require('../routes/aanmeldingen')(grens('aanmeldingen'));
  require('../routes/ledenregister')(grens('ledenregister'));

  /* De rest -- de kern-aanbouw met de routers die erbij horen -- staat in
     ./aanbouw.js. Daar wordt de kern nog VERDER gevuld (Object.assign) en
     hangen de routers die op die aanvulling leunen. Twee bestanden en niet een,
     omdat een van 14 kB weer over dezelfde grens gaat die dit hele werk in gang
     zette. */
  require('./aanbouw')(kern);
  console.log('[start] domeinen actief:', gekozenDomeinen.join(', '));

  return gekozenDomeinen;
};
