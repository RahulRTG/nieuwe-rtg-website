/* ============================================================================
   FOUTISOLATIE PER VERZOEK -- en op EEN plek.

   Een bug in EEN route mag nooit het proces raken, en dus alle andere apps. Een
   gegooide fout in een async handler wordt niet vanzelf opgevangen: het verzoek
   blijft hangen en de fout wordt een unhandledRejection. Daarom wordt elke
   handler omhuld: een (async) fout wordt netjes next(err), de centrale
   foutafhandelaar geeft die ENE aanvraag een 500, en de rest merkt er niets van.

   WAAROM DIT EEN EIGEN MODULE IS

   Deze wikkel stond twee keer, woordelijk hetzelfde: in opzet/verzoekketen.js
   voor de app, en in foundation/basis.js voor de eigen router van de stichting
   (die wordt voor de hoofdkern gemount en kon de app-omhulling niet lenen). Het
   commentaar daar zei het zelf: "Zelfde foutisolatie als in server.js".

   Twee plekken die een waarheid vasthouden, lopen uiteen (LAT.md regel 4). Dat
   bleek meteen toen er iets bij moest: de naam behouden. Twee kopieen betekent
   die reparatie twee keer schrijven en er daarna twee keer aan denken -- en de
   tweede vergeten is precies hoe de RTFoundation al eens buiten een meting viel.

   DE NAAM VAN WAT HIJ OMHULT BLIJFT STAAN

   Dat is geen bijzaak. De router leest zijn eigen lagen uit (web/routing.js,
   leesLagen -> laagNaam) zodat te zien is WELKE bewaker voor een route hangt:
   officeAuth, supplierAuth, techAuth. Een anonieme wikkel maakt elke laag
   naamloos, en dan moet je de bewaker uit de brontekst raden. Dat werd hier met
   een regex gedaan, en die ziet niet wat via een mount of een voorvoegsel-hulpje
   hangt: vier bewijsproeven misten daardoor alle vier dezelfde 1257 routes,
   waaronder de hele RTFoundation.

   Bewust alleen de NAAM en niet de arity. De router leidt uit `fn.length === 4`
   af of een laag foutmiddleware is; deze wikkel heeft er altijd drie, en dat is
   bestaand gedrag waar routes op geregistreerd staan. Dat stilletjes veranderen
   is een tweede wijziging in een reparatie die er een hoort te zijn.
   ========================================================================== */
'use strict';

/* De wikkel om EEN functie. Geeft de functie ongemoeid terug als het er geen is
   (een pad of een optie tussen de argumenten). */
function omhul(f) {
  if (typeof f !== 'function') return f;
  const wikkel = (req, res, next) => {
    try {
      const r = f(req, res, next);
      if (r && typeof r.catch === 'function') r.catch(next);
    } catch (e) { next(e); }
  };
  /* De naam overnemen. In een try, want `name` is op een enkele exotische
     functie niet herdefinieerbaar -- en een naamloze laag is hinderlijk voor de
     meting maar mag nooit een verzoek raken. */
  try { Object.defineProperty(wikkel, 'name', { value: f.name || '', configurable: true }); }
  catch (e) { /* dan draagt deze ene laag geen naam; de rest wel */ }
  return wikkel;
}

/* Elke route-methode van een app of router omhullen. Werkt op allebei, want
   allebei dragen dezelfde zes methoden. */
function isoleer(doel) {
  for (const methode of ['get', 'post', 'put', 'delete', 'patch', 'all']) {
    if (typeof doel[methode] !== 'function') continue;
    const orig = doel[methode].bind(doel);
    doel[methode] = (...args) => orig(...args.map(omhul));
  }
  return doel;
}

module.exports = { isoleer, omhul };
