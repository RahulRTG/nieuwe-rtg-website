/* NAKLANK: mooi, geleerd, geholpen, geprobeerd, gemaakt of doorgegeven.
   CONNECTLUS.json onderbouwt de naam; CONNECT.md bewaart de besluiten.

   De zes aantallen blijven apart, zonder totaalscore of ranglijst. Naklank
   hangt aan een werk, nooit aan een persoon. De maker ziet aantallen; alleen
   de gever ziet zijn eigen keuzes en kan die terugnemen.

   Maker en onderwerp komen uitsluitend uit makerVan(id), gekoppeld aan
   mediaos/werkherkomst.js. Onbekend werk kan waardering krijgen, maar geen
   dossierregel; dossierReden legt uit waarom. De bijOverdracht-haak bewaakt
   de dossiergrendel: deze module schrijft nooit zelf in het leerdossier.
   Een al bestaande dossierregel blijft staan na terugname van waardering,
   omdat hij een gebeurtenis vastlegt en geen actuele waarderingsstand. */
'use strict';

const { SOORTEN } = require('./naklanklijst');

const OP_ID = new Map(SOORTEN.map(s => [s.id, s]));
const soort = (id) => OP_ID.get(String(id == null ? '' : id)) || null;

module.exports = ({ opslag, save, bijOverdracht, makerVan }) => {
  /* EEN plek waar staat wie wat gaf, en de aantallen worden eruit AFGELEID.
     Twee plekken (een teller plus een lijst) lopen uiteen zodra een terugname
     de ene wel en de andere niet raakt -- LAT-regel 4, en hier zou het gevolg
     een maker zijn die naar een getal kijkt dat nergens meer op slaat. */
  const van = (item) => {
    const b = opslag.bak('naklank'), k = String(item || '');
    if (!k) return null;
    if (!b[k]) b[k] = {};
    return b[k];
  };

  /* GEVEN. Idempotent: twee keer dezelfde naklank van dezelfde mens is een
     naklank, geen twee. De tweede aanroep is dus geen fout maar een bevestiging
     -- kern/mutatie.js noemt dat een tweede handeling die met opzet niets doet. */
  /* `opties` staat er nog en wordt MET OPZET niet gelezen. Hij droeg `maker` en
     `onderwerp`, en dat was het lek uit regel 3 van de kop. De parameter blijft
     staan zodat een oude aanroeper geen fout krijgt maar ook niets bereikt --
     en test/connect.test.js 24 houdt vast dat wat erin zit wordt genegeerd. */
  function geef(item, sleutel, soortId, opties) { // eslint-disable-line no-unused-vars
    const s = soort(soortId);
    if (!s) return { ok: false, reden: 'Die naklank bestaat niet. Kies uit: ' + SOORTEN.map(x => x.id).join(', ') + '.' };
    const key = String(sleutel || '');
    if (!String(item || '') || !key) return { ok: false, reden: 'Een naklank hangt aan een ding en aan een codenaam; een van beide ontbreekt.' };

    /* DE MAKER WORDT OPGEZOCHT EN NIET AANGENOMEN -- zie regel 3 in de kop.
       `makerVan` geeft `{ sleutel, onderwerp }` of niets; ook het ONDERWERP
       komt daarvandaan, want anders schrijft de gever de tekst van een regel in
       andermans dossier. */
    let werk = null;
    try { werk = makerVan ? makerVan(String(item)) : null; }
    catch (e) { werk = null; }

    if (werk && String(werk.sleutel || '') === key) {
      return { ok: false, reden: s.id === 'geholpen'
        ? 'U kunt niet zeggen dat u door uw eigen werk geholpen bent. Deze naklank komt van iemand anders, en dat is precies wat hem iets waard maakt.'
        : 'Een naklank op uw eigen bijdrage telt niet mee.' };
    }

    /* PAS HIER de rij aanmaken, en niet bovenaan. `van()` schrijft, en hij
       stond voor alle weigeringen: een naklank op je eigen werk werd netjes
       geweigerd en liet toch een lege rij achter. Dezelfde faalvorm als de drie
       lezers die hun rij aanmaakten -- de opslag groeit door aanroepen die
       niets mochten. */
    const rij = van(item);
    if (!rij[s.id]) rij[s.id] = {};
    const nieuw = !rij[s.id][key];
    if (nieuw) rij[s.id][key] = new Date().toISOString();
    if (save) save();

    /* De enige uitgang naar een andere module, en hij loopt via een HAAK die de
       aanroeper meegeeft. Zou deze module zelf in het dossier schrijven, dan
       had zij de schrijfgrendel van leerdossier.js omzeild en kon iedereen via
       deze weg zijn eigen `gebruikt` zetten. */
    let dossier = null, dossierReden = null;
    if (!s.trede) {
      /* `mooi` komt hier terecht, en met opzet. Waardering is AANDACHT, en wij
         tellen aandacht niet als ontwikkeling -- dus er ontstaat geen regel bij
         de maker. Dat staat er hardop bij in plaats van stil te blijven: een
         gever die dit niet leest, denkt dat hij iets voor de maker heeft
         gedaan wat hij niet heeft gedaan. */
      dossierReden = 'Deze naklank telt mee als waardering en niet als ontwikkeling: hij schrijft niets in ' +
        'het dossier van de maker. Bereik en bijval zijn aandacht; wat wel telt is dat iemand er iets MEE doet.';
    } else if (!werk || !werk.sleutel || !werk.onderwerp) {
      dossierReden = 'Deze naklank is geteld, maar er kon geen regel bij een maker worden geschreven: ' +
        'dit huis weet niet van wie dit werk is. Zolang dat zo is, ontstaat de trede "' + s.trede + '" niet ' +
        '-- en dat is beter dan hem op naam van iemand zetten die de gever heeft opgegeven.';
    } else if (nieuw && bijOverdracht) {
      /* DE BRON DRAAGT DE TREDE EN NIET DE SOORT, en dat is de regel van
         ./tredenlijst.js in de praktijk. Vier van de zes soorten landen op
         `gebruikt`; met de soort in de bron zou EEN werk vier keer "gebruikt"
         kunnen opleveren, en dan telt het dossier hoe vaak in plaats van DAT.
         Overgangen, nooit volumes. */
      dossier = bijOverdracht({ maker: String(werk.sleutel), onderwerp: String(werk.onderwerp),
        trede: s.trede, bron: 'naklank:' + String(item) + ':' + s.trede });
    }
    return { ok: true, nieuw, soort: s.id, trede: s.trede, dossier, dossierReden };
  }

  /* TERUGNEMEN. Werkt altijd, ook op een soort die niet meer bestaat, en geeft
     geen fout als er niets stond -- een uitweg met voorwaarden is geen uitweg. */
  function neemTerug(item, sleutel, soortId) {
    const rij = van(item), key = String(sleutel || ''), id = String(soortId || '');
    if (rij && rij[id] && rij[id][key]) { delete rij[id][key]; if (save) save(); return { ok: true, weg: true }; }
    return { ok: true, weg: false };
  }

  /* WAT DE MAKER ZIET: zes aantallen, en wat ze NIET zeggen. Dat tweede staat
     er even groot bij, want een leeg vak wordt gevuld met iemands eigen indruk
     (SERVICE.md par. 12). */
  function tel(item, sleutel) {
    /* Peilen en niet aanmaken -- zie de kop van ./opslag.js. Een tellerrij die
       ontstaat doordat iemand kijkt, laat de opslag groeien met een rij per
       bekeken ding. */
    const k = String(item || '');
    const rij = (k && (opslag.peil('naklank') || {})[k]) || {};
    const key = String(sleutel || '');
    return {
      soorten: SOORTEN.map(s => ({
        soort: s.id, naam: s.naam, teken: s.teken, grond: s.grond,
        aantal: Object.keys(rij[s.id] || {}).length,
        vanMij: !!(key && rij[s.id] && rij[s.id][key])
      })),
      /* Er is met opzet GEEN veld `totaal` en GEEN veld `score`. */
      nietGemeten: 'Deze zes worden niet opgeteld en niet tot een cijfer verwerkt: dan zou weer onzichtbaar ' +
        'zijn welke van de zes bewoog. Er staat ook niet bij WIE iets gaf -- dat is voor de gever zelf.'
    };
  }

  return { geef, neemTerug, tel, SOORTEN, soort };
};
