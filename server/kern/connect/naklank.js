/* ============================================================================
   DE NAKLANK -- wat iets bij iemand heeft NAGELATEN, in plaats van een like.

   Zes soorten: mooi, geleerd, geholpen, geprobeerd, gemaakt, doorgegeven. Een
   maker ziet dus niet "81.204 likes" maar dat 17.841 mensen zeggen iets geleerd
   te hebben, 4.211 het probeerden en 117 daarna iemand anders hielpen. Die
   laatste vier zeggen iets; een duim zegt alleen dat er is gescrold.

   CONNECTLUS.json onderbouwt de naam; CONNECT.md bewaart de besluiten.

   VIER REGELS, EN DE EERSTE IS DE HELE REDEN DAT DE LAAG BESTAAT.

   1. ER KOMT NOOIT EEN TOTAAL. De zes worden niet opgeteld, niet gewogen en
      niet tot een cijfer verwerkt -- ook niet intern om iets op te sorteren.
      Een samengesteld getal verbergt welke van de zes bewoog, en dat is precies
      wat BEWIJSMACHINE.md en INT-04 verbieden. Wie hier `score` toevoegt, heeft
      de like teruggebouwd met zes ingangen.

   2. EEN NAKLANK HANGT AAN EEN DING, NOOIT AAN EEN MENS. Je kunt een uitleg
      waarderen; je kunt de maker niet waarderen. Zodra dit op een persoon kan
      staan, is het een reputatiecijfer -- en de reputatielaag die dit huis wel
      toestaat is contextgebonden en per vaardigheid, niet een getal per mens.

   3. `geholpen` IS DE ENIGE MET EEN GEVOLG BUITEN DEZE MODULE. Wie hem geeft,
      zegt: ik ben hierdoor geholpen. Dat schrijft een regel in het dossier van
      de MAKER op de trede `onderwezen` -- de enige trede die een mens niet zelf
      kan zetten (./leerdossier.js). Daarom loopt hij langs de haak `bijHelp` en
      niet langs een tweede schrijver: een dossierregel die hier zou ontstaan,
      omzeilt de grendel die dat bestand juist heeft.

      EN DE MAKER KOMT NOOIT UIT HET VERZOEK. Hier stond `opties.maker`, met de
      codenaam uit het lijf van de aanroep -- en daarmee kon iedereen een regel
      `onderwezen` in het dossier van een WILLEKEURIG ander schrijven, precies
      in de trede die als enige bewijskracht heeft. De lusproef vond het omdat
      de zelf-weigering niet aansloeg: `maker` was een string die de client had
      verzonnen, dus hij was per definitie nooit gelijk aan de gever.

      De maker wordt daarom OPGEZOCHT, met `makerVan(id)` die de bedrading
      meegeeft. Kan die het ding niet thuisbrengen, dan wordt de naklank gewoon
      geteld -- hij gaat over het DING en niet over de mens -- maar de haak
      loopt NIET, met de reden in `dossierReden`. Dat is de eerlijke uitkomst
      vandaag: geen van de twee aangesloten bronnen draagt een maker (leerstof
      is van dit huis, een buurtactiviteit van een afdeling), dus er is
      niemand om de regel bij te schrijven. Een laag die dat gat vult met wat
      de client zegt, verzint bewijs.

   4. DE MAKER ZIET AANTALLEN EN GEEN NAMEN. Wie wat gaf, is voor de gever zelf
      (om het terug te kunnen nemen) en voor niemand anders. Een lijst namen
      onder een bijdrage is een volgerslijst met een ander etiket, en STAGE.md
      houdt de fanladder tegen om dezelfde reden.

   TERUGNEMEN KAN ALTIJD EN LAAT NIETS ACHTER. Wat wel achterblijft is een
   dossierregel bij de maker die al bestond -- die wordt niet teruggedraaid, en
   dat is geen slordigheid: dat iemand ooit door dit werk geholpen is, is een
   feit over het verleden en geen stand die meebeweegt.
   ========================================================================== */
'use strict';

const { SOORTEN } = require('./naklanklijst');

const OP_ID = new Map(SOORTEN.map(s => [s.id, s]));
const soort = (id) => OP_ID.get(String(id == null ? '' : id)) || null;

module.exports = ({ db, save, bijHelp, makerVan }) => {
  const bak = () => {
    const d = db.data || (db.data = {});
    if (!d.connect) d.connect = {};
    if (!d.connect.naklank) d.connect.naklank = {};
    return d.connect.naklank;
  };
  /* EEN plek waar staat wie wat gaf, en de aantallen worden eruit AFGELEID.
     Twee plekken (een teller plus een lijst) lopen uiteen zodra een terugname
     de ene wel en de andere niet raakt -- LAT-regel 4, en hier zou het gevolg
     een maker zijn die naar een getal kijkt dat nergens meer op slaat. */
  const van = (item) => {
    const b = bak(), k = String(item || '');
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
       deze weg zijn eigen `onderwezen` zetten. */
    let dossier = null, dossierReden = null;
    if (s.id === 'geholpen') {
      if (!werk || !werk.sleutel || !werk.onderwerp) {
        dossierReden = 'Deze naklank is geteld, maar er kon geen regel bij een maker worden geschreven: ' +
          'dit huis weet niet van wie dit werk is. Zolang dat zo is, ontstaat de trede "Doorgegeven" niet ' +
          '-- en dat is beter dan hem op naam van iemand zetten die de gever heeft opgegeven.';
      } else if (nieuw && bijHelp) {
        dossier = bijHelp({ maker: String(werk.sleutel), onderwerp: String(werk.onderwerp),
          bron: 'naklank:' + String(item) });
      }
    }
    return { ok: true, nieuw, soort: s.id, dossier, dossierReden };
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
    /* Peilen en niet aanmaken -- zelfde correctie als in ./horizon.js. Een
       tellerrij die ontstaat doordat iemand kijkt, laat de opslag groeien met
       een rij per bekeken ding. */
    const k = String(item || '');
    const rij = (k && db.data && db.data.connect && db.data.connect.naklank
      && db.data.connect.naklank[k]) || {};
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
