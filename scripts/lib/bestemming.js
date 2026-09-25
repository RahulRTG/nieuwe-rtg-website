/* ============================================================================
   BEREIKBAAR: KWAM DE JUISTE ACTOR OP DE BEDOELDE BESTEMMING?

   WAAROM. Op 24 september 2026 bleken vier rijen van APPWERKT.json `bereikbaar =
   BEWEZEN` te dragen terwijl een lid de app nooit bereikte: Routedossier,
   Decision Room, Project Room en RTG One stuurden een lid door naar een
   kantoorscherm (de kantoordeur of het RTG Kantoor). De meter herkende een deur
   alleen als een selector OP de pagina; een deur via een DOORVERWIJZING ging er
   dwars doorheen. "Er verscheen een pagina" werd gelezen als "de app is bereikt".

   DE IDENTITEIT BESTAAT AL. SCHERMEIGENAAR.json noemt per scherm zijn
   capability, zijn rol (eigenaar, schil, alias, tweede-ingang) en zijn
   doelgroep. Daarmee is de vraag niet "is de url gelijk" -- RTG heeft tabs,
   aliassen en canonieke doorverwijzingen, en url-gelijkheid zou die allemaal
   afkeuren -- maar "is de landing DEZELFDE capability als de ingang". Een alias
   draagt geen capability maar een verwijzing (`naar`); die wordt gevolgd.

   DRIE UITKOMSTEN, en ze krijgen geen nieuwe betekenis:
     dezelfde capability           de bestemming is bereikt (ook via een andere url)
     een andere capability         nooit BEWEZEN. Komt een ANDERE persona die de
                                   proef kent wel op de bedoelde capability, dan
                                   is het de bestaande uitkomst "verkeerd
                                   geadresseerd" (DEFECT, dezelfde zin als bij een
                                   dichte deur). Anders NIET_GETEST met de reden.
     niet te identificeren         een andere url en een van beide schermen staat
                                   niet in het register: NIET_GETEST, want een
                                   bestemming die je niet kunt benoemen, kun je
                                   niet als bereikt bewijzen.

   EN DE PERSONA, ALS BEVINDING EN NIET ALS OORDEEL. APPWERKT meet met de persona
   van de wereld (PERSONA_VAN_WERELD); SCHERMEIGENAAR.json noemt een doelgroep.
   Die twee spreken elkaar op dertien schermen tegen, en welke van de twee de
   waarheid is, is geen meetvraag: "vanuit welke wereld testen we" en "voor wie
   is dit scherm bedoeld" hoeven niet hetzelfde begrip te zijn. De afwijking
   wordt daarom vastgelegd MET beide bronnen, en verandert geen enkel bewijs.
   ========================================================================== */
'use strict';

function schermpad(pad) {
  return String(pad || '').split('#')[0].split('?')[0].replace(/^\/+/, '');
}

/* De capability van een scherm, met aliassen gevolgd (hooguit een paar
   stappen, zodat een kring in het register geen eindeloze lus wordt). */
function capabilityVan(pad, register, diepte = 0) {
  const v = register[schermpad(pad)];
  if (!v || diepte > 4) return null;
  if (v.rol === 'alias' && v.naar) return capabilityVan(v.naar, register, diepte + 1);
  return v.capability || null;
}

function vergelijk(ingang, landing, register) {
  const ingangCap = capabilityVan(ingang, register);
  const landingCap = capabilityVan(landing, register);
  if (schermpad(ingang) === schermpad(landing)) return { uitkomst: 'zelfde-scherm', ingangCap, landingCap };
  if (!ingangCap || !landingCap) return { uitkomst: 'onbekend', ingangCap, landingCap };
  return { uitkomst: ingangCap === landingCap ? 'zelfde-capability' : 'andere-capability', ingangCap, landingCap };
}

const BEREIKT = new Set(['zelfde-scherm', 'zelfde-capability']);

/* Het oordeel over bereikbaar voor een rij die zonder poort en zonder fout
   opende. `anderen` zijn de landingen van de andere bekende persona's op
   dezelfde ingang, en worden alleen gebruikt als de bestemming verkeerd was. */
function beoordeel({ ingang, landing, register, persona, anderen }) {
  const v = vergelijk(ingang, landing, register);
  if (BEREIKT.has(v.uitkomst)) {
    return { status: 'BEWEZEN', bestemming: v,
      reden: 'opent voor een ' + persona + ' zonder poort en zonder fout' +
        (v.uitkomst === 'zelfde-capability' ? ', via ' + schermpad(landing) + ' (dezelfde capability ' + v.ingangCap + ')' : '') };
  }
  if (v.uitkomst === 'onbekend') {
    return { status: 'NIET_GETEST', bestemming: v,
      reden: 'de ingang ' + schermpad(ingang) + ' landt op ' + schermpad(landing) +
        ', en een van beide staat niet in SCHERMEIGENAAR.json; een bestemming die niet te benoemen is, is niet als bereikt te bewijzen' };
  }
  const opener = (anderen || []).find((a) => a && a.persona !== persona && BEREIKT.has(vergelijk(ingang, a.landing, register).uitkomst));
  if (opener) {
    /* De bestaande uitkomst "verkeerd geadresseerd", met dezelfde zin als bij
       een dichte deur op de pagina zelf (scripts/appwerkt.js, meetRij). */
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', bestemming: v,
      reden: 'de wereld toont deze ingang aan een ' + persona + ', maar de deur gaat alleen open voor een ' + opener.persona +
        ': een ' + persona + ' wordt doorgestuurd naar ' + schermpad(landing) + ' (' + v.landingCap + ')' };
  }
  return { status: 'NIET_GETEST', bestemming: v,
    reden: 'landt op ' + schermpad(landing) + ' (' + v.landingCap + ') in plaats van op ' + v.ingangCap +
      '; een doorverwijzing naar een andere capability is geen bereikte bestemming, en geen van de bekende sessies komt er wel' };
}

/* Welke doelgroepen een persona van de proef dekt. Dit is een AANNAME en staat
   daarom hier uitgeschreven: een Lifestyle- of Business-lid is een lid, een
   kind of gezin van de RTFoundation is een gezinssessie, en `publiek` past bij
   iedereen. Wat hier niet staat, is een afwijking. */
const DEKT = {
  lid: new Set(['lid', 'lifestyle-lid', 'business-lid', 'publiek']),
  gezin: new Set(['rtf-gezin', 'rtf-kind', 'publiek']),
  zaak: new Set(['zaak', 'publiek']),
  kantoor: new Set(['kantoor', 'publiek'])
};

function personaAfwijking(persona, ingang, register) {
  const v = register[schermpad(ingang)];
  const doelgroep = v && v.doelgroep;
  if (!doelgroep) return null;
  if ((DEKT[persona] || new Set()).has(doelgroep)) return null;
  return { gebruikt: persona, bronGebruikt: 'PERSONA_VAN_WERELD in scripts/appwerkt.js (de wereld uit MAPPEN)',
    verwacht: doelgroep, bronVerwacht: 'SCHERMEIGENAAR.json' };
}

module.exports = { schermpad, capabilityVan, vergelijk, beoordeel, personaAfwijking, DEKT };
