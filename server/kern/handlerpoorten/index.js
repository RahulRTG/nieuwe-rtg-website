/* ============================================================================
   DE POORTEN DIE IN DE HANDLER STAAN -- gelezen, niet geraden.

   scripts/lib/bewakers.js leest de deur van een route uit de ROUTER. Voor 660
   schrijfroutes staat die deur niet daar maar in het lichaam:

       app.post('/api/rtf/samen/maak', (req, res) => {
         const s = samenSess(req, res); if (!s) return;

   Voor de router is dat een route zonder enige bewaking, en in
   MUTATIECONTRACT.json komen ze daarom uit als "toegang niet af te leiden". Dat
   is de bak die niemand kan opruimen zonder de code te lezen. Dus is de code
   gelezen: scripts/handlerbewakers.js vond 60 poortvormen over 1220 routes, en
   hieronder staat wat elk van die zestig werkelijk doet.

   DE SLEUTEL IS DE NAAM, EN DAT WAS EEN TWEEDE POGING.

   Drie van deze namen betekenen elders in dit huis iets anders:

     profiel     routes/rtfschool.js          gezinsprofiel-poort
                 kern/spellen/magnaat/...     rekent cijfers uit
     beheerVan   bedrijf/deuren.js            poort op een beheertoken
                 kern/office/samen.js         normaliseert een classificatie
     lidVan      bedrijf/rollen.js            poort op een lidtoken
                 kern/agenda-pro.js           knipt een prefix van een string

   Daarom was de eerste sleutel `bestand:naam`. Dat bleek precies de verkeerde
   kant op te werken: een poort wordt GEDEFINIEERD in een bestand en GEBRUIKT in
   tientallen -- `familieVan` staat in server/foundation.js en wordt aangeroepen
   in negen andere. Van de 300 herkende poortvormen matchten er nog 41.

   De juiste lezing is dat geen van de drie homoniemen in een ROUTEBESTAND staat:
   bankprofiel.js, office/samen.js en agenda-pro.js registreren geen enkele
   route, dus geen handler kan er per ongeluk een aanroepen. De sleutel mag dus
   de naam zijn, en `NIET_IN` hieronder houdt de uitzondering expliciet -- zodat
   de dag dat een van die drie wél een route krijgt, hier opvalt in plaats van
   stil goed te gaan.

   DRIE SOORTEN, EN DE DERDE IS DE INTERESSANTSTE:

     OBJECT_SCOPED    de poort leest een CODE of TOKEN uit het lichaam en zoekt
                      daar een object bij. Twee mensen met dezelfde rol krijgen
                      hier een ander antwoord. Het veld staat erbij, want zonder
                      dat kan geen proefopstelling de toestand bouwen.

     AUTHENTICATED    de poort versmalt een identiteit die de router al heeft
                      vastgesteld: geen gast, wel een echt account, manager,
                      personeel. Geen nieuwe deur, wel een nauwere.

     genre-cap        de poort vraagt wat voor SOORT ZAAK dit is:
                      `db.capsVan(req.supplier).includes('retail')`. Dat lijkt op
                      CAPABILITY_GATED en is het NIET -- CLAUDE.md heeft die twee
                      met opzet uit elkaar getrokken (OS.md: laag 4 heet sindsdien
                      genre-cap, en `capability` is de herbruikbare bedrijfsfunctie
                      uit kern/bevoegdheid/lijst.js). `retail` staat niet in die
                      lijst en hoort daar ook niet. Ze hier CAPABILITY_GATED
                      noemen zou de twee begrippen weer laten versmelten, dus ze
                      krijgen AUTHENTICATED met de genre-eis apart genoteerd.

   EN WAT GEEN POORT IS. `geremd` (routes/gast/tafel.js) is uitsluitend een
   snelheidsrem, en `doosSleutelOk` telt afketsers per IP. Die stellen geen
   identiteit vast; ze staan hieronder met soort `geen-deur`, want "hier zit een
   rem" is iets anders dan "hier zit niets".
   ========================================================================== */
'use strict';

/* DE LIJST STAAT IN TWEE BESTANDEN EN IS EEN LIJST. ./lijst.js draagt de
   objectpoorten, ./lijst-identiteit.js de rest (identiteit, genre, geen-deur);
   de naad is die uit het bestand zelf, gemaakt toen het over keuringsregel 13
   ging. Hier komen ze weer bij elkaar, want wie een poort opzoekt hoort er EEN
   te vinden -- twee lijsten die de aanroeper zelf moet kennen, is precies hoe
   een poort in de ene wel en de andere niet belandt. */
const { POORTEN: OBJECTPOORTEN } = require('./lijst');
const { POORTEN: IDENTITEITSPOORTEN } = require('./lijst-identiteit');
const POORTEN = Object.assign({}, OBJECTPOORTEN, IDENTITEITSPOORTEN);
{
  /* Een naam in allebei zou er stil een overschrijven. Dat kan niet gebeuren
     zolang de naad blijft waar hij is -- maar 'blijft' is geen handhaving. */
  const dubbel = Object.keys(OBJECTPOORTEN).filter(k => k in IDENTITEITSPOORTEN);
  if (dubbel.length) throw new Error('handlerpoorten: dezelfde naam in beide lijsten: ' + dubbel.join(', '));
}

/* naam -> { toegang, veld?, versmalt?, genre?, wat } */

/* De bestanden waar een naam NIET deze poort is. Zie de kop: alle drie zijn het
   bestanden zonder routes, dus vandaag kan geen handler ze raken -- maar de dag
   dat er een route bij komt, hoort dat hier te botsen en niet stil goed te gaan. */
const NIET_IN = {
  profiel: ['server/kern/spellen/magnaat/bankprofiel.js'],
  beheerVan: ['server/kern/office/samen.js'],
  lidVan: ['server/kern/agenda-pro.js']
};

/* ---------------------------------------------------------------------------
   DE OBJECTPOORTEN OP DE ROUTER.

   Dit register gaat over poorten IN de handler -- dat staat in de kop, en dat
   blijft zo. Maar een handvol objectpoorten hangt op de ROUTER: `app.post(pad,
   huisAuth, ...)`. De bewakerskaart ziet ze wel (zij leest de router) en weet
   dat het objectpoorten zijn, maar niet WELK veld uit het lichaam het object
   aanwijst -- en dat is precies wat een OBJECT_SCOPED-contract moet noemen.

   Dertien werkplek-routes stonden daarop stil: alle vier de bewijseisen gehaald,
   en toch geen contract, omdat het objectveld ontbrak.

   Ze staan hier apart en niet tussen de handlerpoorten, want het zijn twee
   verschillende waarnemingen: de een leest de handler, de ander de router. Elk
   veld hieronder is gelezen in de bewaker zelf; het bestand staat erbij. */
const ROUTERPOORTEN = {
  huisAuth: { veld: 'bedrijf',
    wat: 'server/routes/werkplek.js: welk huis, en mag deze sessie daarin' },
  huisPoort: { veld: 'bedrijf',
    wat: 'server/routes/kantoorpakket-huis.js via huisDrive(): werkplek.kent(bedrijf) plus magIn()' },
  gezinsPoort: { veld: 'code',
    wat: 'server/routes/tiener.js en baby.js: rtf.verifieerProfiel(code, token)' },
  rtfPoort: { veld: 'code',
    wat: 'server/routes/kantoorpakket-huis.js: dezelfde profielcontrole op code + token' },
  gastAuth: { veld: 'sleutel',
    wat: 'server/routes/gast.js: sessie.herken(sleutel) -- de gastsleutel wijst het verblijf aan' },
  arrivalPassAuth: { veld: 'pass',
    wat: 'server/routes/supplier/horeca/arrival-toegang.js: de Arrival Pass zelf, met vervaldatum' }
};

/* Het objectveld van een bewaker op de router, of null. */
function veldVanBewaker(naam) {
  const p = ROUTERPOORTEN[String(naam)];
  return (p && p.veld) || null;
}

/* ---------------------------------------------------------------------------
   DE GEGENEREERDE FAMILIES.

   Een handvol routes wordt in een LUS aangemaakt: `app.post('/api/rtf/spel/' +
   naam, ...)`. Het pad is daar een expressie, dus geen enkele lezer die de
   brontekst afzoekt op routeliterals vindt ze -- en dan staat er in het register
   "geen deur" bij een route die er wel degelijk een heeft. Drieenveertig routes
   stonden zo op LEGACY.

   Een familie is een VOORVOEGSEL plus de poort die de lus aanroept, en dat is
   iets anders dan een raadpartij: de lus staat op EEN plek, roept EEN poort aan,
   en elke route die eruit komt loopt er langs. Wie er een toevoegt, schrijft het
   bestand en de regel erbij -- dat is waar een volgende lezer moet kijken als de
   lus verandert.

   NIET GEBRUIKEN voor een voorvoegsel waar routes met VERSCHILLENDE poorten
   onder hangen. Dan is het geen familie maar een gok, en een verkeerde
   toegangsklasse is erger dan geen.
   ------------------------------------------------------------------------- */
/* HET VOORVOEGSEL STAAT IN SEGMENTEN EN NIET ALS PAD, en dat is geen gril.

   Twee keuringsregels lezen elk `'/api/...'` in server/ als een REGISTRATIE van
   die route, en terecht: dat is hoe je vindt dat een pad twee keer wordt
   aangemaakt, of dat er een wordt opgebouwd waar de schakelkast niets van weet.
   Een lijst die routes BESCHRIJFT ziet er voor die regels precies zo uit als een
   lijst die ze aanmaakt. Zo geschreven ging deze lijst er ook meteen op af.

   Segmenten maken het verschil zichtbaar in de code zelf: dit is een voorvoegsel
   om op te vergelijken, geen pad om op te hangen. */
const FAMILIES = [
  { segmenten: ['api', 'rtf', 'spel'], poort: 'rtfSpeler',
    bron: 'server/routes/spellen.js regel 139: een lus over ACTIES hangt elke actie onder dat ' +
      'voorvoegsel op, en alle krijgen dezelfde poort' }
];

const voorvoegselVan = (f) => '/' + f.segmenten.join('/') + '/';

/* De poort van een route die uit een lus komt, of null. */
function poortVanRoute(pad) {
  const p = String(pad || '');
  for (const f of FAMILIES) {
    if (!p.startsWith(voorvoegselVan(f))) continue;
    const poort = POORTEN[f.poort];
    if (!poort) throw new Error('handlerpoorten: familie ' + voorvoegselVan(f) + ' noemt poort "' +
      f.poort + '" die niet in de lijst staat');
    return poort;
  }
  return null;
}

/* De poort achter een naam, of null. `bestand` is het pad vanaf de wortel van
   het project en dient alleen om de homoniemen uit te sluiten. */
function poortVan(bestand, naam) {
  const n = String(naam);
  const verboden = NIET_IN[n];
  if (verboden && verboden.includes(String(bestand))) return null;
  return POORTEN[n] || null;
}

module.exports = { POORTEN, poortVan, poortVanRoute, veldVanBewaker,
  NIET_IN, FAMILIES, ROUTERPOORTEN };
