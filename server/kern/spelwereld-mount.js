/* DE SPELWERELD AAN DE LIJN -- dezelfde routes, op een ander vak.

   ./spelwereld.js maakt het vak en de doorkijk; dit bestand hangt er de ECHTE
   routebestanden aan. Daarmee gaat het gat dicht dat kern/command/zandbak.js
   zelf opschreef: "de gewone app-routes praten met de echte database, dus je
   proeft hier processen en geen schermen."

   EEN DISPATCHER EN GEEN MOUNT PER WERELD, en dat volgt uit hoe een server in
   elkaar zit. Werelden ontstaan tijdens het draaien, en een router die je NA de
   404-afhandeling ophangt wordt nooit meer bereikt -- de eerste die matcht wint.
   Dus hangt er bij het opstarten EEN handler op /spelwereld, en die zoekt de
   subrouter van deze wereld op of bouwt hem de eerste keer.

   DE URL IS DE WAARHEID, en dat is de belangrijkste keuze hier. Het alternatief
   was een sessievlag ("deze speler zit nu in een wereld"), en dat is precies wat
   VERHAAL.md grens 2 verbiedt: de scheiding moet structureel zijn en niet aan
   een vlag hangen. Met een vlag bestaat er een toestand die verkeerd kan staan,
   en dan landt een spelhandeling in productie of andersom. Met het pad kan dat
   niet: /spelwereld/p1/api/... is een ander adres dan /api/..., en er is geen
   moment waarop de server moet raden welke van de twee bedoeld werd.

   WELKE ROUTES ER MEEDOEN IS EEN LIJST EN GEEN VINKJE. Een scherm hoort hier
   alleen te staan als het als OEFENRUIMTE zinvol is; een route die geld int of
   een echte identiteit vaststelt hoort er nooit in. */
'use strict';

/* De routebestanden die een spelwereld bedient. Bewust kort beginnen: eerst
   bewijzen dat EEN scherm werkt, dan pas de rest -- een halve mount die niemand
   naloopt is erger dan geen mount. */
const ROUTES = [
  { sleutel: 'concern', pad: '../routes/concern',
    waarom: 'RTG Concern: entiteiten, vestigingen, dienstverbanden, rollen en het organigram. '
      + 'Dit IS het workforce-scherm waar VERHAAL.md om vraagt, en het is pure gegevensbewerking.' }
];

/* DE MOTOREN die per wereld opnieuw worden gebouwd, op het venster.

   Zonder deze stap kijkt het SCHERM naar het vak terwijl de MOTOR naar productie
   schrijft, en dat is de gevaarlijkste helft van een grens die er is. Een `db`
   verwisselen is niet genoeg: de kern draagt al gebouwde functies die de
   productiedatabase in hun closure hebben. Zie `kernVoor` in ./spelwereld.js. */
const MOTOREN = [
  { pad: '../kern/concern', maak: (mod, ctx) => mod(ctx) }
];

/* WAT ER NIET IN PAST, EN WAAROM DAT HIER STAAT.

   `routes/member/werk.js` -- vacatures en solliciteren, de keten van VERHAAL.md
   hoofdstuk 1 -- was de eerste kandidaat en knelde meteen op de grens. Terecht:
   zijn `chatStuur` stuurt live seintjes naar echte schermen (sseToSupplier,
   sseToCustomer) en `meldWerkgever` een echte pushmelding. In een spelwereld
   hoort dat niet te kunnen.

   De oplossing is niet die kanalen doorlaten maar ze WERELD-LOKAAL maken: een
   melding in een wereld blijft in de wereld. Dat kan pas als `commWerk` op een
   venster te bouwen is, en die hangt aan de comm-kern die zelf aan productie
   vastzit. Dat is de volgende route en niet deze. Hem half aanhangen zou een
   wereld opleveren waarin sommige knoppen stil niets doen, en dat is precies wat
   de gooiende grens moest voorkomen. */

const ID = /^\/([a-z0-9][a-z0-9-]{0,39})(\/.*)?$/;

module.exports = function maakSpelwereldMount({ spelwereld, kern, Router, log }) {
  /* De gebouwde subrouters, per wereld. Bewaard omdat het bouwen de
     routebestanden opnieuw uitvoert, en dat hoeft maar een keer per wereld. */
  const routers = new Map();

  /* De motoren van EEN wereld, vers op het venster. Wat ze nodig hebben komt uit
     de echte kern, met uitzondering van `db` -- dat is het hele punt. */
  function motorenVoor(v) {
    const ctx = { db: v, save: kern.save, crypto: kern.crypto, schoon: kern.schoon,
      findSupplier: () => null, ondernemingVind: () => null };
    let uit = {};
    for (const m of MOTOREN) uit = Object.assign(uit, m.maak(require(m.pad), ctx));
    return uit;
  }

  function bouw(id) {
    const v = spelwereld.venster(id);
    if (!v) return null;
    const router = Router();
    /* DE ROUTER IS DE `app` VOOR DIT BESTAND. Een routefabriek doet niets anders
       dan `app.post(...)` aanroepen, dus een router is een geldige app -- en zo
       hangt dezelfde code twee keer: een keer op productie en een keer hier. */
    const eigen = Object.assign({ app: router }, motorenVoor(v));
    const wereldKern = spelwereld.kernVoor(kern, id, eigen);
    for (const r of ROUTES) {
      try {
        require(r.pad)(wereldKern);
      } catch (e) {
        /* HIJ ZWIJGT NIET. Een routebestand dat hier omvalt, valt om op een naam
           die in een spelwereld niet bestaat -- en dat is een BEVINDING: die
           route hoort niet in een oefenruimte, of dat kanaal moet wereld-lokaal
           worden. Stil overslaan zou een halve wereld opleveren waarin sommige
           knoppen niets doen. */
        if (log) log('[spelwereld] ' + id + ': ' + r.sleutel + ' kan hier niet draaien -- ' + e.message);
        throw e;
      }
    }
    return router;
  }

  /* De handler die op /spelwereld hangt. Hij knipt de wereld-id van het pad en
     laat de rest aan de subrouter -- de mount van deze server matcht op een
     letterlijk voorvoegsel en kent geen :params, dus dat gebeurt hier. */
  function handler(req, res, next) {
    const url = String(req.url || '/');
    const vraag = url.indexOf('?');
    const pad = vraag === -1 ? url : url.slice(0, vraag);
    const m = ID.exec(pad);
    if (!m) return res.status(404).json({ error: 'Geen spelwereld genoemd.' });
    const id = m[1];
    /* EEN ANTWOORD OP "BESTAAT DEZE WERELD". Hier stond die vraag twee keer --
       een keer in de handler en een keer in `bouw` -- en dan is er een tweede
       antwoord dat uit de pas kan lopen. Een mutatie die de eerste weghaalde
       veranderde niets, en dat is het teken. `bouw` geeft null als de wereld er
       niet is, en dat is de enige plek waar het staat. */
    let router = routers.get(id);
    if (!router) {
      router = bouw(id);
      if (!router) return res.status(404).json({ error: 'Die spelwereld bestaat niet (meer).' });
      routers.set(id, router);
    }
    req.url = (m[2] || '/') + (vraag === -1 ? '' : url.slice(vraag));
    /* WAAR JE BENT, op het verzoek. Een route mag weten dat hij in een wereld
       draait -- niet om anders te rekenen, maar om het te kunnen tonen. */
    req.spelwereld = id;
    return router(req, res, next);
  }

  /* Een wereld die weg is, hoort ook zijn router kwijt te raken -- anders blijft
     een verwijderde wereld bereikbaar zolang het proces leeft. */
  const vergeet = (id) => routers.delete(id);

  return { handler, bouw, vergeet, motorenVoor, ROUTES, MOTOREN,
    aantalGebouwd: () => routers.size };
};
