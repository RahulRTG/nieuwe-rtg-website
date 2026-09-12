/* VAN VERWIJZING NAAR OBJECT -- de enige weg, en hij is met opzet lang.

   ref != object != permission. Dat zijn drie dingen, en de duurste fout in deze
   hele laag is ze als een behandelen. Een OBJECT_REFERENCE uit ./menscontext.js
   is een BEWERING van de client: "ik kijk naar factuur f-1". Daaruit volgt niet
   dat f-1 bestaat, niet dat hij van deze mens is, en al helemaal niet dat deze
   mens hem mag betalen. Wie `context.verwijzingen[0].id` rechtstreeks in een
   aanroep stopt, heeft de client zijn eigen bevoegdheid laten schrijven.

   DE KETTING, en elke schakel kan alleen naar beneden:

     1  OPZOEKEN      bestaat dit ding aan de serverkant?      -> ONBEKEND
     2  BEREIK        is het van DEZE mens / DEZE huurder?     -> BUITEN_BEREIK
     3  BEVOEGDHEID   mag deze mens er dit mee?                -> GEEN_RECHT
     4  CANONIEK      pas nu bestaat er een object

   ZONDER OPZOEKER GEBEURT ER NIETS, EN DAT IS DE STAND VAN VANDAAG. Er is in
   dit huis geen register dat "geef mij object X van soort Y" over alle domeinen
   beantwoordt, en dat hoort er ook niet te komen: OBJECTMODEL.json meet 71% van
   de velden in precies EEN domein, en een generieke objecttabel is de
   `Asset`-fout opnieuw. De opzoeker wordt daarom INGESPOTEN door wie hem heeft
   -- een domeinroute die zijn eigen facturen kent -- en zolang niemand hem
   meegeeft, blijft elke verwijzing `ONOPGELOST`. Dat is geen gat dat je met een
   standaardwaarde dichtzet: een verwijzing die stilzwijgend een object wordt,
   is precies wat deze module moet uitsluiten.

   WAT ER DAN NOG WEL MAG. Een onopgeloste verwijzing levert nog steeds WOORDEN
   (./menscontext.js) waarmee de resolver de toegestane lijst kan versmallen.
   Dat is de grens in een zin: een verwijzing mag helpen ZOEKEN en nooit
   bepalen WAT ER GEBEURT.

   HIJ GOOIT NIET. Een opzoeker of een rechtencontrole die stukgaat, levert een
   stand met een reden op -- geen exceptie die de vraag van een mens laat
   omvallen. Een storing in de bewijslaag mag geen overtreding worden
   (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN). */
'use strict';

/* Gesloten lijst. Een vrije stand levert uitslagen op die geen afhandeling
   kent, en `ONOPGELOST` mag nooit als `ONBEKEND` gelezen worden: het eerste
   zegt dat er niemand keek, het tweede dat er gekeken is en niets was. */
const STANDEN = Object.freeze(['CANONIEK', 'GEEN_RECHT', 'BUITEN_BEREIK', 'ONBEKEND', 'ONOPGELOST']);

const GEEN_OPZOEKER = 'Er is geen opzoeker meegegeven; een verwijzing van de client ' +
  'wordt nooit uit zichzelf een object.';

function refUitslag(ref, stand, reden, object) {
  return { ref, stand, reden, object: stand === 'CANONIEK' ? object : null };
}

/* EEN verwijzing door de ketting. `opzoeker(ref, bereik)` geeft het object of
   iets valsigs; `bereik.eigenaarVan(object)` zegt van wie het is; `mag(object,
   ref)` is de bevoegdheidsvraag. Ontbreekt er een schakel, dan stopt het daar
   -- nooit met een aanname dat het wel goed zal zijn. */
function canoniekeVerwijzing(ref, opties) {
  const o = opties || {};
  if (typeof o.opzoeker !== 'function') return refUitslag(ref, 'ONOPGELOST', GEEN_OPZOEKER);

  let gevonden = null;
  try { gevonden = o.opzoeker(ref, o.bereik || null); }
  catch (e) { return refUitslag(ref, 'ONBEKEND', 'de opzoeker gaf een storing; dat is geen bestaand object'); }
  if (!gevonden || typeof gevonden !== 'object')
    return refUitslag(ref, 'ONBEKEND', 'de opzoeker kent dit ding niet aan de serverkant');

  /* BEREIK. Zonder een eigenaarsvraag is er geen bereik vast te stellen, en dan
     stopt het hier -- "ik kon niet kijken" is geen "het mag". */
  const bereik = o.bereik || null;
  if (!bereik || typeof bereik.eigenaarVan !== 'function')
    return refUitslag(ref, 'BUITEN_BEREIK',
      'er is geen bereikvraag meegegeven; van wie dit object is, is dus niet vastgesteld');
  let eigenaar = null;
  try { eigenaar = bereik.eigenaarVan(gevonden); } catch (e) { eigenaar = null; }
  if (!eigenaar || !bereik.sleutel || eigenaar !== bereik.sleutel)
    return refUitslag(ref, 'BUITEN_BEREIK', 'dit object hoort niet bij de mens die de vraag stelt');

  /* BEVOEGDHEID. Apart van bereik, want van jezelf zijn en ermee mogen doen is
     niet hetzelfde -- een minderjarige bezit zijn dossier en mag het niet
     verplaatsen. Ontbreekt de vraag, dan is het antwoord nee. */
  if (typeof o.mag !== 'function')
    return refUitslag(ref, 'GEEN_RECHT', 'er is geen bevoegdheidsvraag meegegeven; leeg is dicht');
  let magHet = false;
  try { magHet = o.mag(gevonden, ref) === true; } catch (e) { magHet = false; }
  if (!magHet) return refUitslag(ref, 'GEEN_RECHT', 'de bevoegdheidsvraag zei nee');

  return refUitslag(ref, 'CANONIEK', 'opgezocht, in bereik en bevoegd', gevonden);
}

/* De hele lijst. Geeft ALTIJD een rij per verwijzing terug -- een verwijzing
   die uit de uitslag verdwijnt, leest als een verwijzing die niemand heeft
   gewogen, en dat is de valse nul waar dit huis op let. */
function canoniekeVerwijzingen(verwijzingen, opties) {
  const rij = Array.isArray(verwijzingen) ? verwijzingen : [];
  return rij.map((ref) => canoniekeVerwijzing(ref, opties));
}

/* Alleen wat de hele ketting heeft gehaald. Wie deze gebruikt, kan geen
   onopgeloste verwijzing per ongeluk meenemen. */
function alleenCanoniek(uitslagen) {
  return (Array.isArray(uitslagen) ? uitslagen : [])
    .filter((u) => u && u.stand === 'CANONIEK').map((u) => u.object);
}

module.exports = { canoniekeVerwijzingen, canoniekeVerwijzing, alleenCanoniek, STANDEN, GEEN_OPZOEKER };
