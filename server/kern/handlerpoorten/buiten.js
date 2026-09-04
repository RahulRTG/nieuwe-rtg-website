/* ============================================================================
   DE POORTEN DIE NIET IN DE HANDLER STAAN.

   ./lijst.js en ./lijst-identiteit.js dragen de poorten die IN een handler
   worden aangeroepen. Dit bestand draagt de drie soorten waar dat niet zo is, en
   ze verschillen echt -- elk is een ANDERE reden waarom een lezer die de handler
   afzoekt niets vindt:

     ROUTEPOORTEN   de poort staat inline en heeft niet de vorm van een poort.
                    `rtf.verifieerProfiel(req.body.code, req.body.token)` krijgt
                    geen req en geen res, maar twee velden uit het lichaam. Een
                    vorm die dat vangt, vangt elke functie met twee argumenten.
     ROUTERPOORTEN  de poort hangt op de ROUTER (`app.post(pad, huisAuth, ...)`).
                    De bewakerskaart ziet hem, maar weet niet welk veld het
                    object aanwijst -- en dat is wat een contract moet noemen.
     FAMILIES       de route wordt in een LUS gemaakt, dus zijn pad staat niet als
                    tekst in de bron. De poort is er wel.

   HET VERSCHIL MET DE PUBLIEKE LIJST, en dat is de belangrijkste zin hier.
   scripts/lib/publiekeroutes.js zegt "deze route heeft GEEN poort, en dat is een
   besluit". Deze drie zeggen "deze route heeft er WEL een, hij is alleen niet te
   zien". Die twee door elkaar halen is het duurste soort fout: een route met een
   poort als publiek boeken, of andersom. Vandaar aparte lijsten.
   ========================================================================== */
'use strict';

/* ---------------------------------------------------------------------------
   DE POORT PER ROUTE -- HANDGELEZEN, WAAR GEEN VORM HEM VINDT.

   Er blijft een rest waar geen enkele detectievorm bij kan, en niet door
   slordigheid: de poort staat INLINE in de handler, zonder de vorm van een
   poort. `const sess = rtf.verifieerProfiel(req.body.code, req.body.token);`
   krijgt geen `req` en geen `res` -- hij krijgt twee velden uit het lichaam.
   Een vorm die dat vangt, vangt ook elke andere functie met twee argumenten.

   Voor die routes is er maar één eerlijke weg: iemand leest de handler en
   schrijft op wat hij ziet. Dat is deze lijst. Elke regel hier is gelezen op
   30 augustus 2026, en de reden staat erbij in de bewoording van die handler.

   HET VERSCHIL MET DE PUBLIEKE LIJST. scripts/lib/publiekeroutes.js zegt "deze
   route heeft GEEN poort, en dat is een besluit". Deze lijst zegt "deze route
   heeft er WEL een, hij is alleen niet te zien". Die twee door elkaar halen zou
   het duurste soort fout zijn: een route met een poort als publiek boeken, of
   andersom. Vandaar twee lijsten en niet een.
   ------------------------------------------------------------------------- */
const ROUTEPOORTEN = Object.assign({},
  require('./buiten-routes').ROUTEPOORTEN,
  require('./buiten-routes-b').ROUTEPOORTEN);
{
  /* Dezelfde regel als bij de sleutellijst: een route in twee bestanden zou er
     stil een overschrijven. Zie ../../lib/idemsleutels-eenmaal.js. */
  const a = require('./buiten-routes').ROUTEPOORTEN, b = require('./buiten-routes-b').ROUTEPOORTEN;
  const dubbel = Object.keys(a).filter(k => k in b);
  if (dubbel.length) throw new Error('handlerpoorten: route in beide routelijsten: ' + dubbel.join(', '));
}

/* De handgelezen poort van een route, of null. */
function poortVanRouteHand(route) {
  return ROUTEPOORTEN[String(route)] || null;
}

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
  { segmenten: ['api', 'rtf', 'spel'], poort: 'rtfSpeler', veld: 'code',
    bron: 'server/routes/spellen.js regel 139: een lus over ACTIES hangt elke actie onder dat ' +
      'voorvoegsel op, en alle krijgen dezelfde poort',
    veldBron: 'server/routes/spellen.js regel 19: rtfSpeler() doet rtf.verifieerProfiel(req.body.code, ' +
      'req.body.token) -- dezelfde profielcontrole als gezinsPoort en rtfPoort hierboven, dus hetzelfde ' +
      'objectveld. Twee spelers met dezelfde rol krijgen op een andere code een ander antwoord.' }
];

const voorvoegselVan = (f) => '/' + f.segmenten.join('/') + '/';

/* HET OBJECTVELD VAN EEN GEGENEREERDE ROUTE.

   Waarom dit naast veldVanBewaker() staat en er niet in past: een route uit een
   lus heeft geen bewaker in de routetabel staan -- de poort zit IN de handler
   van de lus. `veldVanBewaker` kijkt naar namen die de tabel noemt en vindt daar
   dus niets, terwijl de deur er wel degelijk is.

   Dat verschil kostte 31 routes. Ze stonden als OBJECT_SCOPED "zonder
   objectveld" in de meting, met als enige reden dat de lezer op de verkeerde
   plek keek -- precies dezelfde vorm als de zeven "onvindbare bronnen" van
   keuringsregel 28, die gewoon een bewaker hadden die niet in het vocabulaire
   stond. Een gat dat verdwijnt zodra je het goed bekijkt, is geen gat; het is
   een meetfout, en die hoort te worden gerepareerd in plaats van weggestreept. */
function veldVanPad(pad) {
  const p = String(pad || '');
  for (const f of FAMILIES) {
    if (!f.veld) continue;
    if (p.startsWith(voorvoegselVan(f))) return f.veld;
  }
  return null;
}


module.exports = { ROUTEPOORTEN, poortVanRouteHand, ROUTERPOORTEN, veldVanBewaker, veldVanPad, FAMILIES, voorvoegselVan };

