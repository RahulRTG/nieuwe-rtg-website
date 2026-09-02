/* DE KAART VAN HET STUUR -- welke paden mag de AI kiezen, hier en nu.

   Afgesplitst van ../stuur.js, dat over de tienduizend bytes ging. De snede
   loopt langs een echte naad: dat bestand doet de AANROEP (met de inlog, de
   remmen en de bevestiging), en dit bepaalt de LIJST waaruit gekozen mag worden.
   Die twee schuiven om verschillende redenen -- de eerste als er iets aan de
   uitvoering verandert, de tweede zodra er een laag bij komt die mag versmallen.

   En er is er inmiddels een bij gekomen: de isolatiestand en de herkomst van de
   invoer. Zie hieronder waarom die hier horen en niet bij de aanroep. */
'use strict';

const beleid = require('./beleid');
const { toegestanePaden } = beleid;
const { maakIsolatiefilter } = require('./isolatiefilter');
const besmetting = require('./besmetting');

module.exports = function maakStuurPaden({ VERBODEN, stuurUit, isolatie }) {
  /* ---- de kaart van het stuur: alle POST-paden die dit proces kent ----
     Rechtstreeks uit de router gelezen (dus nooit een verouderde lijst),
     gefilterd op de verbodslijst en desgewenst op een prefix per rol. */
  /* `bronnen` zijn de KANALEN die aan deze opdracht hebben bijgedragen
     (../isolatie/herkomst.js, geboekt door ./besmetting.js). Zat daar
     onvertrouwde inhoud bij, dan versmalt de lijst OOK zonder dat er een
     beveiligingsstand geldt: de invariant "onvertrouwde inhoud vergroot nooit de
     beschikbare capabilities" staat los van isolatie. Een mail die geld wil laten
     bewegen, hoort ook op een doodgewone dinsdag te worden tegengehouden.

     GEEN BRONNEN MEEGEVEN IS NIET GEEN BRONNEN HEBBEN, en dat verschil kostte
     deze laag zijn hele dekking: de enige productie-aanroeper riep hem met drie
     argumenten aan, dus `bronnen` was altijd `undefined` en de herkomstbranche
     draaide nooit. De regel stond en werkte nergens. Een aanroeper die het
     argument weglaat, krijgt daarom nu het VERTROUWDE begin en niet een lege
     lijst -- hetzelfde gedrag, maar uitgesproken in plaats van per ongeluk. */
  function stuurPaden(app, wereld, context, bronnen) {
    if (stuurUit()) return [];
    const uit = [];
    const stack = (app && app._router && app._router.stack) || [];
    for (const laag of stack) {
      const r = laag.route;
      if (!r || !r.methods || !r.methods.post) continue;
      const pad = r.path;
      if (typeof pad !== 'string' || !pad.startsWith('/api/')) continue;
      if (VERBODEN.some(re => re.test(pad))) continue;
      uit.push(pad);
    }
    const toegestaan = toegestanePaden([...new Set(uit)].sort(), wereld);

    /* DE ISOLATIESTAND VERSMALT WAT ER OVERBLIJFT -- en dit is de enige plek waar
       dat hoort te gebeuren. `toegestanePaden` zegt wat het BELEID toestaat;
       daaronder ligt de vraag of er op dit moment een beveiligingsstand geldt
       voor deze aanroeper. Bevoegd zijn en beschikbaar zijn vallen tijdens een
       incident uit elkaar, en zonder deze regel merkt het stuur dat pas bij de
       HTTP-aanroep -- dus na de belofte aan de gebruiker, en dat is de slechtst
       denkbare plek voor een weigering.

       Zonder isolatielaag (een opstelling zonder kern.isolatie) verandert er
       niets: `versmal` geeft de lijst onaangeraakt terug en zegt dat. */
    const laag = typeof isolatie === 'function' ? isolatie() : isolatie;
    if (!laag || !context) return toegestaan;
    const filter = maakIsolatiefilter({ isolatie: laag, beleid });
    const uitslag = filter.versmal(toegestaan, context, wereld, bronnen || besmetting.START);
    /* De weggevallen paden reizen mee als eigenschap van de lijst en niet als
       tweede teruggave: elke bestaande aanroeper krijgt zo nog steeds gewoon een
       array, en wie de reden wil tonen kan erbij. EXECUTIE.md blok 0: een
       versmalling die het gevraagde vermogen VERBERGT is de gevaarlijkste
       faalvorm van deze laag. */
    const lijst = uitslag.paden.slice();
    Object.defineProperty(lijst, 'isolatie', { value: {
      actief: uitslag.actief, weggevallen: uitslag.weggevallen,
      uitleg: filter.uitleg(uitslag.weggevallen)
    }, enumerable: false });
    return lijst;
  }

  return { stuurPaden };
};
