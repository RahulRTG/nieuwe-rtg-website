/* DE ISOLATIELAAG -- één beveiligingsvlak over zes dragers.

   Isolatie is geen functie die functies uitschakelt. Het is een per-drager
   veiligheidscontract dat beschikbare effecten verkleint, nooit stilzwijgend
   zwakker kan worden, en waarvan iedere geclaimde grens een bewijsgraad heeft.

     ./ordening.js     wat is strenger dan wat, en wanneer is dat niet te zeggen
     ./dragers.js      van wie is een stand, en wie mag hem zetten
     ./effecten.js     wat een handeling DOET, en wat een stand sluit (schaduw)
     ./besluit.js      het verklaarde besluit: waarom niet, en van wie
     ./ontsluiting.js  verlagen als protocol, met het verzoek los van het effect
     ./opslag.js       de enige deur naar db.data

   DIT BESTAND IS DE ENIGE PLEK WAAR EEN STAND VERANDERT, en dat is geen
   ordelijkheid maar de handhaving zelf. `zet()` weigert structureel elke
   verlaging: niet met een controle die je kunt vergeten mee te nemen, maar
   omdat er geen andere weg naar beneden is dan een voltooide ceremonie. Dat is
   SEC-LOCK-001 in code in plaats van in een document.

   DE STAND VAN HET HUIS WORDT GELEZEN EN NIET BEZETEN. Hij woont in
   kern/incidentcontrole.js, waar hij altijd al woonde. Deze laag krijgt hem als
   functie mee. Hem hierheen kopiëren zou twee waarheden maken over dezelfde
   stand, en dan zeggen twee schermen op een dag iets anders over of het platform
   in isolatie staat. Dat de eigenaar het huis dus niet via deze laag verlaagt is
   met opzet: die weg loopt via de incidentcontrole en zijn eigen bevestiging. */
'use strict';

const ordening = require('./ordening');
const dragers = require('./dragers');
const effecten = require('./effecten');
const leesset = require('./leesset');
const { maakBruikbaarheid } = require('./bruikbaarheid');
const { maakBesluitlaag } = require('./besluit');
const { maakOntsluiting } = require('./ontsluiting');
const maakOpslag = require('./opslag');
const { maakBeschermstand } = require('../beschermstand');

/* AFGELEID EN NIET OVERGETYPT. Hier stond de lijst met de hand, als VIERDE
   kopie van "welke dragers zijn van deze laag" -- naast dragers.js,
   routes/isolatie.js en sessiedragers.js. Uit de afleiding volgt bovendien
   vanzelf dat het huis er niet in zit: die stand woont in de incidentcontrole en
   heeft daarom geen opslagplek hier. */
const EIGEN_DRAGERS = dragers.NAMEN.filter(n =>
  n !== 'huis' && dragers.OP_NAAM[n].bron !== null);

function fout(status, tekst) { const e = new Error(tekst); e.status = status; throw e; }

module.exports = function maakIsolatie({ db, save, functies, klok, huisStand, beveilig }) {
  const opslag = maakOpslag({ db });
  const beschermstand = maakBeschermstand({ functies });
  const laag = maakBesluitlaag({ functies, beschermstand });
  const ontsluiting = maakOntsluiting({ opslag, save, klok, ordening });
  const nu = () => (klok && klok.datum ? klok.datum() : new Date());
  /* Lui: de meter roept besluit() aan, en die hangt aan de laag die hier nog
     wordt opgebouwd. Hem hier meteen bouwen zou een halve laag meegeven. */
  let bruikbaarMem = null;
  const bruikbaar = { overStanden: (standen) => {
    if (!bruikbaarMem) bruikbaarMem = maakBruikbaarheid({ isolatie: naarBuiten, functies });
    return bruikbaarMem.overStanden(standen);
  } };

  /* ---------- lezen ---------- */

  function huis() {
    try { const m = typeof huisStand === 'function' ? huisStand() : huisStand; return m || 'normaal'; }
    catch (e) {
      /* De huisstand niet kunnen lezen is niet hetzelfde als "het huis staat op
         normaal". Een onbekende waarde gaat door dezelfde deur als in
         kern/incidentcontrole.js: hij leest als beschermd, niet als normaal. */
      return 'onbekend:' + String(e.message || 'onleesbaar').slice(0, 30);
    }
  }

  function standVan(drager, sleutel) {
    if (drager === 'huis') return huis();
    if (!EIGEN_DRAGERS.includes(drager)) return null;
    if (!sleutel) return null;
    const kaart = opslag.tak(drager);
    const rij = kaart[String(sleutel)];
    return rij ? rij.stand : null;
  }

  /* DE CONTEXT. De enige plek waar drager-kennis wordt samengesteld, zodat de
     rest van het huis met standen werkt en niet met leden. Wat er niet in staat
     is even belangrijk als wat er wel in staat: geen naam, geen adres, geen rol
     -- alleen sleutels en standen. */
  function context({ organisatie, identiteit, sessie, apparaat } = {}) {
    const sleutels = { organisatie, identiteit, sessie, apparaat };
    const standen = { huis: huis() };
    for (const d of EIGEN_DRAGERS) standen[d] = standVan(d, sleutels[d]);
    return { standen, sleutels, opgesteld: nu().toISOString() };
  }

  function besluit({ pad, methode, context: ctx }) { return laag.besluit({ pad, methode, context: ctx }); }

  /* ---------- zetten ---------- */

  function spoor(regel) {
    const s = opslag.tak('spoor');
    s.unshift(Object.assign({ at: nu().toISOString() }, regel));
    if (s.length > 2000) s.length = 2000;
  }

  /* Het zetten en het aanvragen van een ontsluiting staan in ./zetten.js: dat is
     de handhaving en dit de bedrading. Zie daar waarom er geen andere weg naar
     beneden is dan een voltooide ceremonie. */
  const { zet, vraagOntsluiting, voltooiOntsluiting } = require('./zetten')({ opslag, save, beveilig, nu, standVan,
    spoor, fout, EIGEN_DRAGERS, ontsluiting });

  /* De ceremonie van het HUIS staat in ./huisceremonie.js: het is het enige
     stuk van deze laag dat over een stand gaat die zij niet bezit. */
  const huisdeel = require('./huisceremonie')({ ontsluiting, spoor, save, beveilig, fout });

  /* ---------- het overzicht ---------- */
  function overzicht() {
    const perDrager = {};
    for (const d of EIGEN_DRAGERS) {
      const kaart = opslag.tak(d);
      const rijen = Object.entries(kaart);
      perDrager[d] = { aantal: rijen.length,
        perStand: rijen.reduce((a, [, v]) => { a[v.stand] = (a[v.stand] || 0) + 1; return a; }, {}) };
    }
    return {
      huis: huis(),
      dragers: dragers.DRAGERS,
      /* Een drager zonder bron is een gat met een naam, en dat hoort in het
         overzicht en niet in een voetnoot. */
      dragersZonderBron: dragers.DRAGERS.filter(d => d.bron === null).map(d => ({ naam: d.naam, waarom: d.nietGebouwd })),
      perDrager,
      openOntsluitingen: ontsluiting.open(),
      spoor: opslag.tak('spoor').slice(0, 50),
      /* WAT ER NOG WERKT, naast wat er dichtgaat. Wie besluit een klant dicht te
         zetten, hoort te zien wat die klant dat kost -- en de tellingen hierboven
         zeggen alleen hoeveel er weg is, wat het gevoel geeft dat meer beter is. */
      bruikbaarheid: bruikbaar.overStanden(['normaal', 'beschermd', 'isolatie']),
      effectmodel: { handhaaft: false,
        waarom: 'het effectmodel loopt in de schaduw naast de beschermstand. CONTROLPLANE.md: een ' +
          'nieuwe handhavingsregel loopt eerst mee zonder te blokkeren -- je kunt niet afdwingen wat ' +
          'nooit in de schaduw heeft gelopen.',
        effecten: effecten.EFFECTEN }
    };
  }

  const naarBuiten = { context, besluit, standVan, zet, vraagOntsluiting, voltooiOntsluiting,
    vraagHuisOntsluiting: huisdeel.vraagHuisOntsluiting,
    huisCeremoniePoort: huisdeel.huisCeremoniePoort,
    ontsluiting, overzicht, ordening, dragers, effecten, leesset, beschermstand,
    effectieveStand: laag.effectieveStand };
  return naarBuiten;
};
