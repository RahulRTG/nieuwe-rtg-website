/* RTG Move (deelmodule): DE NAAD -- de beweging tussen twee reisonderdelen.

   WAAROM DEZE MODULE HET ONTBREKENDE STUK IS, gemeten en niet aangenomen. Dit
   huis had al: de tijdlijn van een reis over de domeinen heen
   (kern/reiswereld.js, een projectie die niets bezit), een multimodale planner
   (kern/mobiliteit/reisplan.js), een plekkenlaag (kern/plaats/), een wacht
   (kern/reiswacht.js) en een oplosser die klaarzet zonder uit te voeren
   (kern/reisoplosser.js). Wat er NERGENS stond is dit: iets dat de beweging
   TUSSEN twee opeenvolgende onderdelen uitrekent en vraagt of het plan in de
   tijd klopt. Een grep op `haalbaar|krap|overstaptijd|marge` over de reis- en
   mobiliteitskern gaf nul treffers, en de planner wordt vanuit geen enkele reis
   aangeroepen. RTG Move is daarom geen nieuwe doos maar EEN naad.

   DE VORM IS EEN VERWIJZING EN GEEN ADRES. Een onderdeel draagt een plek zoals
   kern/mobiliteit/plekken.js die al kent (`{ zaak }`, `{ halte }`, `{ lat,lng }`)
   en die wordt door DIE module opgelost. Een tweede adresboek naast dat ene zou
   twee waarheden geven over waar Sal de Mar staat (LAT.md regel 4).

   WAT HIER MET OPZET NIET GEBEURT: een BANDBREEDTE verzinnen. De verleiding is
   groot -- "verwachte aankomst 19:14-19:35" leest krachtig -- maar een band
   vraagt spreiding, en die is hier nergens gemeten. Dezelfde regel als
   kern/kosten/vooruitblik.js en INT-04: een percentage of een band verschijnt
   pas als de trefzekerheid GEMETEN is. Wat er wel staat is de marge, het
   oordeel, en wat er niet is meegewogen. Wie dat leest, weet meer dan iemand
   die een verzonnen band ziet.

   EN EEN ONBEKENDE NAAD IS NOOIT EEN GOEDE NAAD. Ontbreekt een plek of een
   tijd, dan is de uitkomst NIET_TE_BEPALEN met de ontbrekende velden erbij --
   nooit RUIM. Dat is de faalvorm die dit huis het duurst heeft betaald: een
   badge die "Motor actief" zei terwijl elke route 503 gaf. */
'use strict';

/* De uitkomsten zijn GESLOTEN, en "waarschijnlijk goed" zit er niet bij --
   dezelfde regel als de standen in BETROUWBAARHEID.md par. 3. */
const UITKOMST = {
  GEEN_BEWEGING: 'GEEN_BEWEGING',      // zelfde plek: er valt niets af te leggen
  RUIM: 'RUIM',                        // marge boven de drempel
  KRAP: 'KRAP',                        // marge positief maar onder de drempel
  ONHAALBAAR: 'ONHAALBAAR',            // de beweging past niet in de tijd
  NIET_TE_BEPALEN: 'NIET_TE_BEPALEN'   // een plek of een tijd ontbreekt
};

/* Van slecht naar goed. De reis erft de STRENGSTE naad (zie ./haalbaar), net
   zoals de stand van een rij in APPWERKT.json de strengste van haar bewijzen
   is. NIET_TE_BEPALEN staat met opzet NIET bovenaan als "ergste": onbekend is
   geen defect, het is een tekort aan gegevens -- en die twee door elkaar halen
   maakt van elke onvolledige reis een alarm. ./haalbaar telt hem apart. */
const RANG = [UITKOMST.ONHAALBAAR, UITKOMST.KRAP, UITKOMST.RUIM, UITKOMST.GEEN_BEWEGING];

/* DREMPELS, MET DE REDEN, EN EERLIJK OVER WAT ZE ZIJN: een huiskeuze en geen
   meting. Er is in dit huis geen spreidingsdata over aankomsttijden, dus deze
   getallen komen uit het ontwerp en niet uit een register. Ze staan daarom op
   EEN plek en dragen `grond: 'huiskeuze'` in het antwoord, zodat niemand ze
   later voor gemeten aanziet. */
const DREMPEL = {
  ruimMin: 30,        // minuten marge waarboven een naad ruim heet
  zelfdePlekM: 150,   // binnen deze afstand valt er niets af te leggen
  grond: 'huiskeuze'
};

const minuten = (ms) => Math.round(ms / 60000);

/* Een tijdstip uit een tijdlijnregel. Een onderdeel kent soms een DAG en soms
   een dag met een UUR (kern/reiswereld.js zet `tijd` alleen waar het domein er
   een kent). Zonder uur is er geen tijdstip -- hier 00:00 aannemen zou een
   hotelovernachting om middernacht laten beginnen en elke naad eromheen
   verzinnen. Dus: geen uur, geen tijdstip. */
function tijdstip(dag, uur) {
  if (!dag || !uur || !/^\d{2}:\d{2}/.test(String(uur))) return null;
  const t = Date.parse(String(dag).slice(0, 10) + 'T' + String(uur).slice(0, 5) + ':00Z');
  return Number.isFinite(t) ? t : null;
}

/* DE NAAD ZELF.

   `van`  -- het onderdeel dat je verlaat: { plek, klaarAt }
   `naar` -- het onderdeel dat je moet halen: { plek, nodigAt }
   `reisTijd(vanPlek, naarPlek)` -- levert { minuten, modus, bron } of null.
       Hij wordt INGESPOTEN en niet geimporteerd: de echte rekenaar is
       kern/mobiliteit/reisplan of kern/navigatie, en die kennen elkaar niet.
       Geeft hij null, dan weet Move het niet en zegt dat.
   `afstandM(a, b)` -- optioneel; alleen om "zelfde plek" vast te stellen. */
function naad({ van, naar, reisTijd, afstandM }) {
  const mist = [];
  if (!van || !van.plek) mist.push('plek-van');
  if (!naar || !naar.plek) mist.push('plek-naar');
  if (!van || !van.klaarAt) mist.push('tijd-van');
  if (!naar || !naar.nodigAt) mist.push('tijd-naar');
  if (mist.length) {
    return { uitkomst: UITKOMST.NIET_TE_BEPALEN, mist,
      waarom: 'Zonder ' + mist.join(' en ') + ' valt deze overgang niet te rekenen.' };
  }

  /* Zelfde plek: geen beweging, en dus ook geen marge-oordeel. Een naad van een
     hotel naar het restaurant IN dat hotel is geen krappe overstap. */
  const dM = typeof afstandM === 'function' ? afstandM(van.plek, naar.plek) : null;
  if (dM != null && dM <= DREMPEL.zelfdePlekM) {
    return { uitkomst: UITKOMST.GEEN_BEWEGING, afstandM: Math.round(dM),
      waarom: 'Begin- en eindpunt liggen op dezelfde plek.' };
  }

  const rit = reisTijd(van.plek, naar.plek);
  if (!rit || !Number.isFinite(rit.minuten)) {
    return { uitkomst: UITKOMST.NIET_TE_BEPALEN, mist: ['reistijd'],
      waarom: 'Er is geen reistijd te berekenen tussen deze twee punten.' };
  }

  const beschikbaar = minuten(naar.nodigAt - van.klaarAt);
  const marge = beschikbaar - rit.minuten;
  const uitkomst = marge < 0 ? UITKOMST.ONHAALBAAR
    : marge < DREMPEL.ruimMin ? UITKOMST.KRAP : UITKOMST.RUIM;

  return {
    uitkomst, beschikbaarMin: beschikbaar, nodigMin: rit.minuten, margeMin: marge,
    modus: rit.modus || null, bron: rit.bron || null,
    drempel: { ruimMin: DREMPEL.ruimMin, grond: DREMPEL.grond },
    /* WAT ER NIET IS MEEGEWOGEN hoort in het antwoord en niet in een voetnoot.
       Een marge van twaalf minuten leest heel anders als je weet dat er geen
       dienstregeling, geen live verkeer en geen inchecktijd in zit. */
    nietGewogen: ['dienstregeling', 'live verkeer op dit traject', 'in- en uitstaptijd',
      'wachttijd bij overdracht']
  };
}

module.exports = { naad, UITKOMST, RANG, DREMPEL, tijdstip };
