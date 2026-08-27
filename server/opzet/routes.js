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
  const ALLE_DOMEINEN = ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk', 'wereld'];
  const gekozenDomeinen = (process.env.RTG_DOMAINS || ALLE_DOMEINEN.join(','))
    .split(',').map(s => s.trim()).filter(s => s && s !== '-'); // '-' = bewust geen domeinen (vloot)
  for (const naam of gekozenDomeinen) {
    if (!ALLE_DOMEINEN.includes(naam)) { console.warn('[start] onbekend domein overgeslagen:', naam); continue; }
    require('../routes/' + naam)(grens(naam));
  }
  // De verplichte onboarding + het contract raken leden, gasten, de eigenaar en
  // leveranciers; net als de infra-endpoints draait dit altijd mee.
  /* Fouten uit de browser: bewust zonder auth, want een fout die het inloggen
     sloopt komt nooit binnen achter een poort die inloggen vereist. Hij gaat
     wel door de domeingrens: hij raakt alleen app, express en tooManyTries, en
     die staan alle drie in de gedeelde interface. */
  // RTG Concern (CONCERN.md): naast de domeinen om dezelfde reden als SSO --
  // het raakt member, supplier en staff, en hoort in elk daarvan half thuis.
  require('../routes/concern')(grens('concern'));
  /* Het vakbewijs (kern/vakbewijs.js + kern/persoonseis.js): naast de domeinen
     om dezelfde reden als concern -- het stuk is van het LID, RTG tekent het af
     in het kantoor, en de zaak wil weten of haar ploeg erdoor komt. */
  require('../routes/vakbewijs')(grens('vakbewijs'));
  require('../routes/fout')(grens('fout'));
  require('../routes/onboarding')(grens('onboarding'));
  /* De adresopzoeker hoort bij het invullen van een adres (de intake en het
     gegevensgesprek) en draait daarom net als de onboarding altijd mee. */
  require('../routes/adres')(grens('adres'));
  require('../routes/aanmeldgesprek')(grens('aanmeldgesprek'));
  require('../routes/kantoorgesprek')(grens('kantoorgesprek'));
  /* SSO staat naast de auth-routes en niet erin: het is een tweede weg naar
     binnen, met een eigen levensloop (koppelingen, providers), en het moet ook
     draaien als het auth-domein apart is opgestart. */
  require('../routes/sso')(grens('sso'));
  /* De SAML-kant van dezelfde poort. Apart bestand omdat het vervoer anders is
     (een POST met een formulier in plaats van een code in de URL), maar hij komt
     uit op hetzelfde claimcontract en loopt daarna door sso/binnenkomst.js. */
  require('../routes/sso-saml')(grens('sso'));
  /* SCIM: de provisioning-deur voor de IdP van een klant. Eigen auth (een sleutel
     per organisatie), dus bewust naast de gewone routes en niet in een domein. */
  require('../routes/scim')(grens('scim'));
  // Guest OS: de poort is de tafel-QR en geen sessie, dus naast de domeinen (zie routes/gast.js).
  require('../routes/gast')(grens('gast'));
  // RTG Evening OS: een avond als plan over meerdere domeinen, dus naast de domeinen.
  require('../routes/avond')(grens('avond'));
  require('../routes/meting')(grens('meting'));
  require('../routes/algpin')(grens('algpin'));
  require('../routes/werkbeleid')(grens('werkbeleid'));
  /* RTG Commerce (kern/commerce/, COMMERCE.md): de verkooplaag boven de
     domeinen. Alleen lezen en een mand; bevestigen en betalen blijven bij de
     domeinen die er al over gaan. De kern eronder is in kernlaag2 gemonteerd,
     vlak achter de Mall die hij leest. */
  require('../routes/commerce')(grens('commerce'));
  /* De routers die aan meer dan een domein hangen -- van sleutelwoorden tot
     de ledenbalie -- staan in ./routes-dwars.js. Alleen `grens` gaat mee: dat
     is precies waarom dat blok als geheel kon verhuizen. */
  require('./routes-dwars')(grens);
  /* De wervingslink /werken/<code>: een werkgever nodigt iemand uit die nog
     geen RTG-account heeft, langs dezelfde uitnodiging als de kassacode van
     routes/supplier/werving. */
  Object.assign(kern, require('../routes/werving')(grens('werving')));

  /* De rest -- de kern-aanbouw met de routers die erbij horen -- staat in
     ./aanbouw.js. Daar wordt de kern nog VERDER gevuld (Object.assign) en
     hangen de routers die op die aanvulling leunen. Twee bestanden en niet een,
     omdat een van 14 kB weer over dezelfde grens gaat die dit hele werk in gang
     zette. */
  require('./aanbouw')(kern, grens);
  console.log('[start] domeinen actief:', gekozenDomeinen.join(', '));

  return gekozenDomeinen;
};
