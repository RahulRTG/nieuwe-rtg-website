/* ============================================================================
   De Trust Fabric, laag 1: de bedrading van de blootstellingsmeter.

   Dun met opzet. register.js, blootstelling.js en gewoonte.js zijn pure
   functies die met verzonnen invoer te ijken zijn; dit bestandje is het enige
   dat een opslag kent, en het doet verder niets.

   TWEE WERKWOORDEN, EN DE VOLGORDE ERTUSSEN IS DE HELE BEVEILIGING:

     weeg(actor, soort, aantal)      VOOR de handeling -- meten, niets bewaren
     voltooid(actor, soort, aantal)  NA de handeling  -- pas dan telt hij mee

   Wie `voltooid` aanroept voordat de handeling is gelukt, opent de aanval die
   in gewoonte.js beschreven staat: dan verzet een aanvaller zijn eigen normaal
   met pogingen die allemaal zijn tegengehouden. Daarom staan het meten en het
   onthouden in twee functies en niet in een.

   LAAG 1 MEET EN BLOKKEERT NIET. Er is nog geen step-up (laag 3), en een
   drempel zonder tweede moment zou alleen maar een deur dichtgooien met een
   getal erbij. Wat deze laag oplevert is het GETAL waar laag 3 op staat, en
   dat getal reist mee in het antwoord zodat een scherm het nu al kan tonen.
   ========================================================================== */
'use strict';

const blootstelling = require('./blootstelling');
const gewoonte = require('./gewoonte');
const tempo = require('./tempo');
const register = require('./register');
const verificatie = require('./verificatie');
const stapop = require('./stapop');
const tweedemoment = require('./tweedemoment');
const bon = require('./bon');

module.exports = ({ db, save }) => {
  /* De bak hangt buiten de werkruimtes, en dat is een besluit: een gewoonte is
     een gegeven OVER een actor en geen inhoud VAN een werkruimte. Stond hij
     erin, dan reisde hij mee in de uitvoer van die werkruimte -- en dan zou een
     tenant bij het vertrek een gedragsreeks van zijn mensen meekrijgen die
     nooit voor hem bedoeld was. Dezelfde les als bij de herstelproefruimtes. */
  const bak = () => (db.data.vertrouwen = db.data.vertrouwen || { gewoonte: {} });

  /* De tempo-afspraak van een soort; null als hij er geen heeft. Uit het
     register en niet uit de opslag: een budget dat een aanvaller kan verzetten
     is geen budget (zie de kop van tempo.js). */
  const tempoRegel = (soort) => (register.soort(soort) || {}).tempo || null;

  function weeg(actor, soort, aantal) {
    return blootstelling.meet({ soort, aantal }, gewoonte.lees(bak(), actor, soort),
      tempo.meet(bak(), actor, soort, aantal, tempoRegel(soort)));
  }

  /* Een catalogus (soort, aantal, checksum) omrekenen naar een omvang. Deze
     regel staat hier en niet bij de aanroeper: hoe je een uitvoer TELT is een
     eigenschap van de meter, en twee plekken die dat elk anders doen leveren
     twee verschillende omvangen voor dezelfde handeling (LAT.md regel 4). */
  function weegCatalogus(actor, soort, catalogus, ver) {
    const n = (catalogus || []).reduce((t, c) => t + (Number(c && c.aantal) || 0), 0);
    const b = weeg(actor, soort, n);
    /* Laag 3 reist mee in hetzelfde antwoord. Dat is geen gemak maar een regel:
       een scherm dat de omvang toont zonder het oordeel erbij, laat de lezer
       zelf een grens verzinnen -- en dan staan er twee grenzen in dit huis. */
    return Object.assign(b, { stapop: stapop.beoordeel(b, ver === undefined ? null : ver) });
  }

  /* De verificatie bij het inloggen, en de leeskant bij een handeling. */
  function verifieer(sessie, wat) { const r = verificatie.noteer(bak(), sessie, wat); if (r) save(); return r; }
  function verificatieVan(sessie) { return verificatie.lees(bak(), sessie); }
  const geenPersoon = (waarom) => verificatie.zonderPersoon(waarom);

  function voltooid(actor, soort, aantal) {
    const n = gewoonte.noteer(bak(), actor, soort, aantal);
    const t = tempo.noteer(bak(), actor, soort, aantal, tempoRegel(soort));
    if (n !== null || t !== null) save();
    return n;
  }

  /* DE POORT: de enige plek waar een route hoeft te vragen "mag dit nu door".
     Hij bundelt laag 1, 2 en 3 en het tweede moment, zodat een deur niet zelf
     een drempel gaat verzinnen -- dan staan er twee grenzen in dit huis.

     TWEE MANIEREN OM ER DOORHEEN TE KOMEN, en het verschil zit in stapop.js en
     niet hier: een ZWARE handeling wordt vanzelf doorgelaten zodra de sessie
     weer vers en hard is geverifieerd (dus na een bevestiging een kwartier
     lang), en een UITZONDERLIJKE nooit -- die houdt `nodig` altijd waar en
     vraagt dus elke keer een bon die aan deze ene handeling vastzit.

     428 en niet 403: dit is geen weigering maar een VOORWAARDE. De aanroeper
     krijgt de zin, de redenen en de bon terug en kan het afmaken. */
  function poort({ actor, sessie, soort, aantal, doel, bon, ver }) {
    const b = weeg(actor, soort, aantal);
    /* DE OPSLAG WEET HET, TENZIJ DE DEUR HET BETER WEET. Een sleuteldeur heeft
       geen sessie, en een lege opzoeking levert null: "niet vastgelegd". Daar
       staat aantoonbaar geen mens, en dat verschil beslist alles in stapop.js.
       Alleen de deur zelf weet het, dus mag hij het meegeven (geenPersoon). */
    const gezien = ver !== undefined && ver !== null ? ver : (sessie ? verificatieVan(sessie) : null);
    const st = stapop.beoordeel(b, gezien);
    b.stapop = st;
    /* EEN ONGEWOGEN HANDELING IS GEEN STILTE MAAR EEN GETAL. stapop.js laat hem
       door -- anders vraagt het systeem bij elke onbekende handeling -- maar de
       Trust State telt hem, en dat getal hoort naar nul door soorten in het
       register te zetten. Zonder deze teller zou de onzekerheid nergens meer
       opduiken zodra het verzoek voorbij is. */
    if (st.onzeker) { const k = bak(); k.ongewogen = (Number(k.ongewogen) || 0) + 1; save(); }
    if (!st.nodig) return { door: true, blootstelling: b, verificatie: gezien };
    if (!st.mogelijk) return { door: false, status: 403,
      antwoord: { error: st.zin, waarom: st.waarom, blootstelling: b } };

    const vraagOpnieuw = (fout) => {
      const vr = tweedemoment.vraag(bak(), { sessie, soort, aantal, doel });
      save();
      return { door: false, status: 428, antwoord: { error: fout || st.zin, zin: st.zin,
        waarom: st.waarom, bevestiging: vr, blootstelling: b } };
    };
    if (!bon) return vraagOpnieuw(null);
    const v = tweedemoment.verzilver(bak(), { sessie, soort, aantal, doel, id: bon });
    save();
    return v.ok ? { door: true, blootstelling: b, verificatie: gezien, bevestigd: true } : vraagOpnieuw(v.reden);
  }

  /* DE BON SCHRIJVEN, na afloop. Apart van poort() en met opzet: de poort weet
     nog niet of de handeling is gelukt, en een bon die "uitgevoerd" beweert
     voordat dat vaststaat, is precies de bewering zonder bron waar deze hele
     laag tegen is. De aanroeper roept dit dus NA de handeling aan, met de
     uitslag erbij. */
  function schrijfBon(gegevens) {
    const b = bon.schrijf(bak(), gegevens);
    save();
    return b;
  }
  /* De bon uit een poortuitslag plus de afloop. Zo hoeft een deur de vier
     metingen niet zelf weer bij elkaar te zoeken -- en kan hij ze ook niet per
     ongeluk anders samenstellen dan de poort ze heeft gedaan. */
  function bonNaPoort(uitslag, extra) {
    const u = uitslag || {};
    return schrijfBon(Object.assign({ blootstelling: u.blootstelling, verificatie: u.verificatie,
      stapop: u.blootstelling && u.blootstelling.stapop, bevestigd: !!u.bevestigd }, extra || {}));
  }
  /* De leeskant (laag 6, 7 en 8) staat in ./rapport.js, en dat is geen
     opdeling om de lengte: daar staat geen save(), en dat is met een oogopslag
     te zien in plaats van te moeten geloven. */
  const lees = require('./rapport')({ db, bak });

  /* De bon oplossen. De aanroeper (routes/vertrouwen.js) heeft de mens al
     opnieuw geverifieerd; zie de kop van tweedemoment.js. */
  function losBon(id, sessie) { const u = tweedemoment.los(bak(), id, sessie); save(); return u; }

  /* HET VERGEETRECHT, EN HET IS ER EEN. Hier stond een `vergeet` die alleen de
     gewoonte wiste; de apparatenlijst en de sessie bleven staan. Dat is precies
     de fout die de keuring aanwees toen hij meldde dat de naam `vergeet` in drie
     kernmodules stond: drie plekken met dezelfde naam betekende hier dat er ook
     drie ANTWOORDEN op dezelfde vraag waren, en de bovenste dekte er maar een.
     Nu draagt alleen deze functie die naam en wist hij allebei de sporen; de
     modules eronder heten vergeetActor en vergeetSessie. Wie vergeten wordt,
     laat niets achter -- anders overleeft het profiel de persoon. */
  function vergeet(actor, sessie) {
    let weg = gewoonte.vergeetActor(bak(), actor);
    weg += tempo.vergeetActor(bak(), actor);
    weg += verificatie.vergeetSessie(bak(), sessie, actor);
    if (weg) save();
    return weg;
  }

  return Object.assign({ weeg, weegCatalogus, voltooid, vergeet, verifieer, verificatieVan,
    geenPersoon, poort, losBon, schrijfBon, bonNaPoort, register,
    NIET_GEDEKT: gewoonte.NIET_GEDEKT.concat(tempo.NIET_GEDEKT) }, lees);
};
