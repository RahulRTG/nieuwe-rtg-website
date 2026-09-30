'use strict';
/* ============================================================================
   DE REKENING ACHTER DE OVERGANGSVORM -- los van het inlezen, en dat is geen
   netheid maar toetsbaarheid.

   scripts/overgangsvorm.js leest de boom en levert per overgang per dimensie
   een stand. Deze module krijgt die standen en rekent: wat is de kern die in
   ALLE overgangen staat, welke dimensies zijn een dilemma, wat laat een
   gemeenschappelijke vorm zonder een dimensie ten onrechte slagen, en houden
   de voorgestelde families stand. Omdat hij alleen standen krijgt, is hij te
   voeren met verzonnen overgangen waarvan je WEET wat eruit hoort te komen --
   een meter die alleen op de echte boom draait, is een meter die je nooit hebt
   zien uitslaan (LAT-regel 10, en objectmodel.js splitst om dezelfde reden
   lees() van analyse()).

   DRIE STANDEN, EN ZE BETEKENEN NIET HETZELFDE.

     poort    de drager WEIGERT de overgang als aan deze dimensie niet is
              voldaan. Dit is de sterkste stand, en de enige waar de
              mutatieproef op rust: een vorm die deze dimensie niet draagt, kan
              die weigering niet meer uitdrukken.
     draagt   de drager legt deze dimensie vast of gebruikt haar, maar weigert
              er niet op.
     afwezig  de drager kent haar niet. Altijd met een reden.

   Een overgang ZONDER drager doet niet mee aan de noemer en staat er apart
   bij. Een lege overgang meetellen zou "niets in alle overgangen" garanderen
   -- een uitslag die de meter zelf veroorzaakt (dezelfde regel als in
   scripts/planvorm.js voor een leeg domein).
   ========================================================================== */

const AANWEZIG = new Set(['poort', 'draagt']);

const aanwezig = (o, d) => !!(o.dimensies[d] && AANWEZIG.has(o.dimensies[d].stand));
const poortOp = (o, d) => !!(o.dimensies[d] && o.dimensies[d].stand === 'poort');

function kernVan(overgangen, dimensies) {
  if (!overgangen.length) return [];
  return dimensies.filter(d => overgangen.every(o => aanwezig(o, d)));
}

/* EEN DILEMMA is een dimensie die ergens een POORT is en ergens AFWEZIG. Voor
   zo'n dimensie heeft een gemeenschappelijke vorm twee uitgangen en allebei
   zijn ze fout: laat hij haar weg, dan slaagt de overgang met de poort ten
   onrechte; neemt hij haar verplicht op, dan moet de overgang zonder haar een
   waarde VERZINNEN. Dat laatste is geen detail -- een verzonnen `bewijs` op
   een overgang die geen bewijs kent, is een bewering zonder grond. */
function dilemmas(overgangen, dimensies) {
  const uit = [];
  for (const d of dimensies) {
    const poort = overgangen.filter(o => poortOp(o, d)).map(o => o.id);
    const afwezig = overgangen.filter(o => !aanwezig(o, d)).map(o => o.id);
    if (poort.length && afwezig.length) uit.push({ dimensie: d, poortIn: poort, afwezigIn: afwezig });
  }
  return uit;
}

/* DE MUTATIEPROEF. Neem de gemeenschappelijke vorm -- de kern, of een
   kandidaat die een voorsteller kiest -- en haal er een dimensie uit. Welke
   bestaande overgang slaagt dan ten onrechte? Precies de overgangen waar die
   dimensie een POORT is: hun weigering rust op iets wat de vorm niet meer kan
   dragen. De proef draait over ELKE dimensie en niet alleen over de twee die
   de vraag noemt (bewijs, bevoegdheid), want een proef die alleen kijkt waar
   hij iets verwacht, vindt alleen wat hij verwacht. */
function mutatieproef(overgangen, dimensies, vorm) {
  const inVorm = new Set(vorm || dimensies);
  return dimensies.map(d => {
    const tenOnrechte = overgangen.filter(o => poortOp(o, d)).map(o => o.id);
    const verzonnen = inVorm.has(d) ? overgangen.filter(o => !aanwezig(o, d)).map(o => o.id) : [];
    return {
      dimensie: d,
      inVorm: inVorm.has(d),
      /* haal d eruit: deze slagen ten onrechte */
      zonderDimensieSlaagtTenOnrechte: tenOnrechte,
      /* zit d er verplicht in: deze moeten hem verzinnen */
      metDimensieVerzonnen: verzonnen
    };
  });
}

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const samen = [...A].filter(x => B.has(x)).length;
  const unie = new Set([...A, ...B]).size;
  return unie ? samen / unie : 0;
};

/* DE FAMILIES. Twee toetsen, en de tweede bestaat om de eerste te kunnen
   verwerpen.

   A. DE HYPOTHESE. Een voorsteller deelt de overgangen in (toestand, kennis,
      overdracht). Per familie: de kern, de dilemma's, en of de leden meer op
      elkaar lijken dan op de rest. Een familie die intern niet sterker lijkt
      dan naar buiten, is een indeling en geen familie.
   B. DE AFGELEIDE INDELING. Zonder hypothese: groepen uit de gelijkenis zelf
      (volledige koppeling, drempel `drempel`). Valt die samen met A, dan is A
      gevonden. Valt hij anders uit, dan is A verklaard -- en dat staat er dan
      bij in plaats van dat de hypothese de uitslag draagt. */
function families(overgangen, dimensies, indeling, drempel) {
  const profiel = new Map(overgangen.map(o => [o.id, dimensies.filter(d => aanwezig(o, d))]));
  const ids = overgangen.map(o => o.id);
  const sim = (a, b) => jaccard(profiel.get(a), profiel.get(b));
  const gem = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  const r3 = (x) => x === null ? null : Number(x.toFixed(3));

  const hypothese = Object.entries(indeling || {}).map(([naam, ledenAlle]) => {
    const leden = ledenAlle.filter(id => profiel.has(id));
    const binnen = [], buiten = [];
    for (const a of leden) for (const b of ids) {
      if (a === b) continue;
      (leden.includes(b) ? binnen : buiten).push(sim(a, b));
    }
    const lid = overgangen.filter(o => leden.includes(o.id));
    const gb = gem(binnen), gu = gem(buiten);
    return {
      familie: naam, leden, zonderDrager: ledenAlle.filter(id => !profiel.has(id)),
      kern: kernVan(lid, dimensies),
      dilemmas: dilemmas(lid, dimensies).map(x => x.dimensie),
      gelijkenisBinnen: r3(gb), gelijkenisBuiten: r3(gu),
      /* TWEE OORDELEN, en ze worden hier uit elkaar gehouden omdat de eerste
         versie ze samen `houdtStand` noemde op grond van alleen het eerste --
         en toen stond er "houdt stand" naast een familie met zes dilemma's.
         `onderscheidt`: lijken de leden meer op elkaar dan op de rest?
         `dilemmavrij`: kan EEN vorm deze familie dragen zonder dat een lid ten
         onrechte slaagt of iets verzint? Een familie met een lid heeft geen
         binnengelijkenis -- niet te toetsen, en dat is geen ja. */
      onderscheidt: gb === null ? null : gb > (gu === null ? 0 : gu),
      dilemmavrij: dilemmas(lid, dimensies).length === 0,
      houdtStand: gb === null ? null : (gb > (gu === null ? 0 : gu)) && dilemmas(lid, dimensies).length === 0
    };
  });

  // B. volledige koppeling: twee groepen gaan samen als ELK paar ertussen boven
  // de drempel ligt. Grof, en de goede kant om grof te zijn: hij verwerpt
  // eerder een groep dan dat hij er een verzint.
  let groepen = ids.map(id => [id]);
  for (;;) {
    let best = null;
    for (let i = 0; i < groepen.length; i++) for (let j = i + 1; j < groepen.length; j++) {
      let min = 1;
      for (const a of groepen[i]) for (const b of groepen[j]) min = Math.min(min, sim(a, b));
      if (min >= drempel && (!best || min > best.min)) best = { i, j, min };
    }
    if (!best) break;
    groepen[best.i] = groepen[best.i].concat(groepen[best.j]);
    groepen.splice(best.j, 1);
  }
  groepen = groepen.map(g => g.sort()).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));

  // Valt de afgeleide indeling samen met de hypothese? Per hypothesefamilie:
  // zitten al haar leden (met drager) in EEN afgeleide groep, en bevat die
  // groep niets van een andere familie?
  const groepVan = new Map();
  groepen.forEach((g, i) => g.forEach(id => groepVan.set(id, i)));
  const samen = hypothese.map(h => {
    const gs = new Set(h.leden.map(id => groepVan.get(id)));
    const eenGroep = gs.size === 1;
    const zuiver = eenGroep && groepen[[...gs][0]].every(id => h.leden.includes(id));
    return { familie: h.familie, afgeleideGroepen: gs.size, zuiver };
  });

  const paren = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    paren.push({ paar: [ids[i], ids[j]], gelijkenis: r3(sim(ids[i], ids[j])) });
  paren.sort((a, b) => b.gelijkenis - a.gelijkenis);

  /* De afgeleide groepen krijgen DEZELFDE twee vragen als de hypothese. Zo kan
     de meter ook zeggen: de voorgestelde families houden niet, maar de data
     vindt ANDERE families die wel houden -- een uitkomst die anders onder
     "geen" zou verdwijnen. */
  const afgeleideGroepen = groepen.map(g => {
    const lid = overgangen.filter(o => g.includes(o.id));
    return { leden: g, kern: kernVan(lid, dimensies), dilemmas: dilemmas(lid, dimensies).map(x => x.dimensie) };
  });

  return { hypothese, afgeleid: { drempel, groepen: afgeleideGroepen }, samenvallen: samen, paren };
}

/* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN. Drie uitkomsten, en de
   eerste is met opzet de zwaarste om te halen:

     UNIVERSEEL        er is geen enkel dilemma: elke dimensie die ergens
                       weigert, staat overal. Dan mag er een gedeelde overgang
                       komen, met precies die kern.
     FAMILIES          geen universele overgang, maar elke hypothesefamilie
                       is dilemmavrij EN onderscheidt zich van de rest.
     ANDERE_FAMILIES   de hypothese houdt niet, maar de groepen die de data
                       zelf vormt zijn wel dilemmavrij. Dan is de indeling
                       verkeerd en de gedachte niet.
     GEEN              geen universele overgang, en de families houden ook
                       niet. Wat overleeft is een verklaring van werkwoorden --
                       de uitslag die dit huis bij Asset, Koopbaar, Career,
                       Moment, Manier en de planningsgrond al had. */
function oordeel(overgangen, dimensies, indeling, drempel) {
  const kern = kernVan(overgangen, dimensies);
  const dil = dilemmas(overgangen, dimensies);
  const fam = families(overgangen, dimensies, indeling, drempel);
  const toetsbaar = fam.hypothese.filter(h => h.houdtStand !== null);
  const familiesHouden = toetsbaar.length > 0 && toetsbaar.every(h => h.houdtStand === true);
  /* Andere families: minstens twee afgeleide groepen met meer dan een lid, en
     elke groep met meer dan een lid dilemmavrij. Een losse overgang die nergens
     bij hoort, telt niet tegen -- maar ook niet mee. */
  const meer = fam.afgeleid.groepen.filter(g => g.leden.length > 1);
  const andereHouden = meer.length >= 2 && meer.every(g => g.dilemmas.length === 0);
  const uitkomst = dil.length === 0 ? 'UNIVERSEEL' : familiesHouden ? 'FAMILIES'
    : andereHouden ? 'ANDERE_FAMILIES' : 'GEEN';
  return {
    uitkomst, kern, dilemmas: dil,
    mutatieproef: mutatieproef(overgangen, dimensies, kern),
    families: fam
  };
}

module.exports = { kernVan, dilemmas, mutatieproef, families, oordeel, jaccard, aanwezig, poortOp };
