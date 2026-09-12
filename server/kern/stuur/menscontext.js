/* DE MENSELIJKE CONTEXT -- wat de client over het scherm meestuurt, en wat
   daarvan de interpretatielaag mag bereiken.

   WAAROM DIT EEN EIGEN CONTRACT IS EN GEEN VELD. Er reizen vandaag al VIER
   vormen naar /api/fluister: `{app,deel,selectie}` (rahul-tab en app-main delen
   die), `{wereld}` (living-os-data) en `{wereld,scherm}` (reizen). Ze komen alle
   vier aan bij precies EEN lezer -- ai-live-twin.js, die er een zin van maakt.
   Een vijfde vorm erbij zetten is de fout die dit huis al eens heeft betaald;
   dit bestand NORMALISEERT wat er is in plaats van er iets naast te leggen.

   EN CONTEXT BEREIKT DE RESOLVER VANDAAG AL, ONGETYPT. rahul-tab.js plakt hem
   in de VRAAGTEKST ('...Actieve context: ' + app + ' . ' + deel). Die tekst gaat
   rechtstreeks de resolver en het model in, zonder lengtegrens, zonder vorm en
   zonder spoor. Fase 4 voegt dus geen weg toe die er niet was -- hij maakt de
   bestaande weg zichtbaar, begrensd en bewijsbaar.

   DRIE DELEN, EN ZE ZIJN NIET INWISSELBAAR:

     presentatie  PRESENTATION_CONTEXT -- waar de mens KIJKT. Vrije tekst van de
                  client, dus uitsluitend goed voor WOORDEN.
     verwijzingen OBJECT_REFERENCE -- waar hij naar WIJST. Een verwijzing is een
                  BEWERING van de client en nooit een object; zie ./menscontext-ref.js.
     interactie   PENDING_INTERACTION -- wat er in de interface OPENSTAAT.

   PENDING_INTERACTION IS NIET p.wacht, EN DAT IS DE BELANGRIJKSTE ZIN HIER.
   `p.wacht` (kern/fluister/boeken.js, ./betalen.js, ./reis/) is een voorstel dat
   de SERVER zelf heeft klaargezet, op de server bewaart, tien minuten vers houdt
   en op "ja" UITVOERT (kern/fluister/bevestig.js). PENDING_INTERACTION is wat de
   CLIENT zegt dat er op zijn scherm openstaat. Die twee gelijkstellen zou
   betekenen dat een verzonnen veld in een verzoeklichaam een uitvoerbaar
   voorstel wordt -- de client schrijft dan zijn eigen bevestiging. Er is hier
   dus geen tweede wachtmechanisme: dit deel levert WOORDEN en een afzetting van
   hoeveel opties er openstaan, en raakt `p.wacht` met geen letter aan.

   DE HARDE GRENS. Context mag een intentie VERFIJNEN en nooit een capability
   CREEREN die zonder context niet was toegestaan. Dat is hier structureel en
   niet als vuistregel: dit bestand geeft nooit een pad, een rol, een wereld of
   een bevoegdheid terug. Wat het teruggeeft zijn woorden, en ./resolver.js kan
   met woorden alleen een lijst KLEINER maken die hij binnenkrijgt.

   VLUCHTIG. Niets hier wordt bewaard. Geen db, geen save, geen profiel -- een
   scherm waar iemand gisteren naar keek, hoort morgen nergens meer te staan.
   test/menscontext.test.js toetst dat op de bron.

   DRIE STANDEN, EN ZE DELEN DE LIJST VAN ./spoor.js. Geen context -> de fase
   kwam niet aan de beurt (OVERGESLAGEN). Wel context maar er blijft niets over
   -> hij liep en hield terecht niets over (NOT_RUN). Iets bruikbaars over ->
   PASS. En PASS bewijst NIET dat de resolver hem ook gebruikt heeft; dat staat
   apart op INTENT_RESOLVED (`contextGebruikt`). */
'use strict';

/* Twee buren, en meer kent deze laag niet. ./menscontext-uit.js is wat er
   naar buiten gaat (woorden, en de regel die het gesprek in gaat);
   ./menscontext-ref.js is de ketting van verwijzing naar object. Die tweede
   staat hier en niet bij de aanroeper MET OPZET: wie `context.verwijzingen`
   rechtstreeks leest, slaat de ketting over, en dat kan alleen niet gebeuren
   als de uitslag ervan uit dezelfde deur komt als de context zelf. */
const { woordenVan, handtekening, MAX_WOORDEN } = require('./menscontext-uit');
const { canoniekeVerwijzingen } = require('./menscontext-ref');

const MAX_TEKST = 80;      /* een schermtitel, geen document */
const MAX_ITEMS = 8;       /* meer opties dan dit is geen keuze meer */

/* PLATFORMWOORDENSCHAT IS GESLOTEN, DOMEINWOORDENSCHAT NIET. Hoe de interface
   iets VRAAGT is iets van dit huis en dus opsombaar. WAT voor ding er op het
   scherm staat (factuur, rit, leerling) is domein, en een gesloten lijst
   daarvan zou de 22e capabilitylijst zijn (OS.md). Die wordt dus gesaneerd en
   niet opgesomd. */
const INTERACTIES = Object.freeze(['vergelijking', 'keuze', 'formulier', 'selectie', 'onbekend']);

const CONTRACTSLEUTELS = Object.freeze(['presentatie', 'verwijzingen', 'interactie',
  'app', 'deel', 'selectie', 'wereld', 'scherm']);

/* Vrije tekst van een client: lengte af, besturingstekens weg, en verder niets
   veranderen -- een ingelezen waarde wordt nooit stilletjes verbeterd. */
function tekst(x) {
  if (typeof x !== 'string') return '';
  return x.replace(/[^\S ]|[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEKST);
}

/* Een sleutel: alleen wat een woord kan zijn. Een `soort` die leestekens of
   spaties draagt, is geen soort maar een zin. */
function naarWoord(x) {
  return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

function lijst(x) {
  return Array.isArray(x) ? x.slice(0, MAX_ITEMS) : [];
}

/* WAT ER VAN EEN VERWIJZING OVERBLIJFT: een soort en een id, en verder niets.
   Een client die er een `bedrag`, een `eigenaar` of een `magBetalen` bij zet,
   raakt die kwijt -- de server kijkt dat zelf op, of het bestaat niet. */
function verwijzing(v) {
  if (!v || typeof v !== 'object') return null;
  const soort = naarWoord(v.soort || v.type || v.kind);
  const id = tekst(String(v.id == null ? '' : v.id)).slice(0, 40);
  if (!soort && !id) return null;
  return { soort: soort || 'onbekend', id: id || '' };
}

/* DE SANERING. Geeft altijd dezelfde vorm terug, ook als er niets bruikbaars
   in zat -- een lezer die op `null` moet controleren, vergeet dat een keer. */
function saneer(ruw, opties) {
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw))
    return { stand: 'OVERGESLAGEN', context: null, woorden: [], gewist: [],
      reden: 'Er is geen context meegestuurd; de fase kwam niet aan de beurt.' };

  const gewist = [];
  const p = ruw.presentatie && typeof ruw.presentatie === 'object' ? ruw.presentatie : ruw;
  /* De bestaande vier vormen komen hier bij elkaar: app/deel/selectie van de
     Rahul-tab, wereld/scherm van de reis- en living-schermen. */
  const presentatie = { app: tekst(p.app), scherm: tekst(p.scherm || p.deel),
    wereld: naarWoord(p.wereld), selectie: tekst(p.selectie) };

  const verwijzingen = lijst(ruw.verwijzingen).map(verwijzing).filter(Boolean);

  const ri = ruw.interactie && typeof ruw.interactie === 'object' ? ruw.interactie : null;
  let interactie = null;
  if (ri) {
    const soort = naarWoord(ri.soort);
    const opties = lijst(ri.opties)
      .map((o) => tekst(typeof o === 'string' ? o : (o && o.label))).filter(Boolean);
    interactie = { soort: INTERACTIES.includes(soort) ? soort : 'onbekend',
      opties, gekozen: tekst(ri.gekozen) };
    if (soort && !INTERACTIES.includes(soort))
      gewist.push({ sleutel: 'interactie.soort',
        reden: 'geen bekende interactievorm; genormaliseerd naar onbekend' });
  }

  /* Welke sleutels er zijn weggegooid. Stil weggooien zou betekenen dat een
     client denkt iets te hebben meegegeven wat nooit is aangekomen. */
  for (const k of Object.keys(ruw))
    if (!CONTRACTSLEUTELS.includes(k))
      gewist.push({ sleutel: k, reden: 'staat niet in het contract van drie delen' });

  const woorden = woordenVan({ presentatie, verwijzingen, interactie });
  const iets = woorden.length || verwijzingen.length || (interactie && interactie.opties.length);
  if (!iets)
    return { stand: 'NOT_RUN', context: null, woorden: [], gewist,
      reden: 'Er was context, maar er bleef na de sanering niets bruikbaars over.' };

  /* DE KETTING LOOPT HIER EN NIET BIJ DE AANROEPER (./menscontext-ref.js).
     Zonder opzoeker komt elke verwijzing terug als ONOPGELOST, en dat is de
     stand van vandaag: er is geen register dat "geef mij object X van soort Y"
     over alle domeinen beantwoordt, en dat hoort er ook niet te komen. Het
     staat er dus MET de reden in plaats van als leeg veld. */
  return { stand: 'PASS', context: { presentatie, verwijzingen, interactie }, woorden, gewist,
    verwijzingenUitslag: canoniekeVerwijzingen(verwijzingen, opties),
    reden: 'De context is gesaneerd tot het contract van drie delen.' };
}

module.exports = { saneer, woordenVan, handtekening, INTERACTIES, CONTRACTSLEUTELS,
  MAX_TEKST, MAX_ITEMS, MAX_WOORDEN };
