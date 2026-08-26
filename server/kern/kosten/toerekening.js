/* STROOM EN SERVERHUUR VERDELEN -- eerst over de WERELDEN, dan pas over mensen.

   Hier stond een verdeling over alle dragers tegelijk: leden, zaken en de
   gezinnen van de RTFoundation in één pot, naar hun aandeel in het gemeten
   verbruik. Dat rekende netjes en het klopte niet. De RTFoundation is geen
   kostenpost van RTG maar een eigen rechtspersoon met een eigen vermogen, en
   een gedeelde pot laat kosten van de ene entiteit in het resultaat van de
   andere landen. Zie kern/economie/werelden.js voor waarom dat drie dingen
   tegelijk kapotmaakt.

   DUS TWEE STAPPEN, EN DE VOLGORDE IS HET HELE PUNT:

     1. De nota van de infrastructuur staat in de wereld die hem betaalt
        (rtg-intern: RTG koopt de machines). Hij wordt eerst verdeeld over de
        VIER WERELDEN, naar hun gemeten verbruik. Dat levert per wereld één
        bedrag: wat kost deze economie ons deze maand.
     2. Elk werelddeel wordt daarna binnen ZIJN EIGEN wereld over de dragers
        verdeeld. Een gezin krijgt dus nooit een cent uit het deel van de zaken,
        en andersom.

   REKENKUNDIG IS STAP 2 HETZELFDE ALS DE OUDE VERDELING; dat hoort erbij en
   het is geen argument tegen. Wat verandert is niet het getal van een lid maar
   de VRAAG DIE ERONDER LIGT: van wie is deze kost, en wie mag hem betalen. Die
   vraag werd hiervoor niet gesteld, en daarom kon hij ook niet fout beantwoord
   worden -- hij bestond niet.

   EN ELK WERELDDEEL GAAT LANGS DE FIREWALL. RTG mag de stichting alleen iets in
   rekening brengen als daar een relatie voor is vastgelegd, met grondslag en
   plafond (kern/economie/relaties.js). Is die er niet, dan is dat GEEN fout en
   ook geen nul: het bedrag blijft dan gewoon bij RTG, en dat staat erbij. De
   familie ziet nog steeds wat zij kost -- alleen niet als iets dat zij betaalt.

   Zonder economielaag (een ctx die hem niet meekrijgt) doet deze module
   NIETS in plaats van terug te vallen op de oude gedeelde pot. Een firewall die
   wegvalt als hij ontbreekt, is geen firewall. */
'use strict';

const { toegerekend, plafond } = require('./soorten');

/* Hele centen verdelen zonder dat er een cent zoekraakt: ieder krijgt zijn deel
   naar beneden afgerond, en de overgebleven centen gaan één voor één naar de
   grootste resten. Zonder deze stap telt de som van de delen niet op tot de
   nota, en dan is de vraag welke gebruiker die cent had moeten hebben. Wordt
   twee keer gebruikt: over de werelden en binnen elke wereld. */
function verdeelCenten(totaal, gewichten) {
  const som = gewichten.reduce((a, g) => a + g.gewicht, 0);
  if (!(som > 0) || !(totaal > 0)) return gewichten.map(g => Object.assign({}, g, { centen: 0 }));
  const uit = gewichten.map(g => {
    const exact = totaal * g.gewicht / som;
    return Object.assign({}, g, { exact, centen: Math.floor(exact) });
  });
  let rest = totaal - uit.reduce((a, g) => a + g.centen, 0);
  const volgorde = uit.map((g, i) => ({ i, r: g.exact - Math.floor(g.exact) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < volgorde.length && rest > 0; k++) { uit[volgorde[k].i].centen++; rest--; }
  return uit;
}

module.exports = (ctx) => {
  const { huisrekening, directeKostenPerDrager, economie } = ctx;

  /* De dragers van een maand, gegroepeerd op hun wereld, met per wereld het
     gewicht. Een wereld zonder verbruik blijft in de lijst staan met gewicht 0:
     dan is in het beeld te zien dat hij nul kostte, en niet dat hij ontbrak. */
  function perWereld(periode) {
    const directe = directeKostenPerDrager(periode);
    const uit = {};
    for (const w of economie.WERELDEN) uit[w.id] = { gewicht: 0, dragers: [] };
    for (const dr of Object.keys(directe)) {
      const w = economie.wereldVan(dr);
      const rij = uit[w] || (uit[w] = { gewicht: 0, dragers: [] });
      const g = directe[dr] || 0;
      rij.gewicht += g;
      rij.dragers.push({ drager: dr, gewicht: g });
    }
    return uit;
  }

  /* Mag de infrastructuurwereld dit bedrag bij deze wereld neerleggen? Binnen de
     eigen wereld altijd; daarbuiten alleen met een vastgelegde relatie. */
  function poort(wereldId, centen) {
    if (wereldId === economie.INFRA_WERELD) {
      return { ok: true, code: 'eigen-wereld', uitleg: 'Dit is de wereld die de nota zelf betaalt.' };
    }
    return economie.magBelasten({ van: economie.INFRA_WERELD, naar: wereldId, centen });
  }

  function verdeling(periode) {
    if (!economie) return { periode, regels: [], perDrager: {}, wereldposten: [], sleutelSom: 0 };
    const groepen = perWereld(periode);
    const wereldIds = economie.WERELDEN.map(w => w.id);
    const somAlles = wereldIds.reduce((a, id) => a + groepen[id].gewicht, 0);
    const perDrager = {};
    const regels = [];
    const wereldposten = [];

    for (const s of toegerekend()) {
      const post = huisrekening.postVan(periode, s.id);
      if (!post) {
        regels.push({ soort: s.id, naam: s.naam, centen: null, graad: 'onbekend',
          waarom: 'Er is voor ' + periode + ' geen nota ingevoerd voor ' + s.naam.toLowerCase() + '; zonder nota wordt er niets verdeeld.' });
        continue;
      }
      if (!(somAlles > 0)) {
        regels.push({ soort: s.id, naam: s.naam, centen: post.centen, graad: 'onbekend',
          waarom: 'Er is in deze maand geen gemeten verbruik, dus er is geen sleutel om ' + s.naam.toLowerCase() + ' over te verdelen.' });
        continue;
      }

      // stap 1: de nota over de werelden
      const wDelen = verdeelCenten(post.centen, wereldIds.map(id => ({ wereld: id, gewicht: groepen[id].gewicht })));
      for (const wd of wDelen) {
        const fw = poort(wd.wereld, wd.centen);
        /* Wie draagt dit bedrag uiteindelijk? Mag het niet door, dan blijft het
           bij de wereld die de nota betaalde. Dat is de eerlijke uitkomst: RTG
           heeft de stroom gekocht, en zonder afspraak stuurt hij niemand een
           rekening. */
        const betaaldDoor = fw.ok ? wd.wereld : economie.INFRA_WERELD;
        wereldposten.push({ soort: s.id, naam: s.naam, wereld: wd.wereld, centen: wd.centen,
          graad: plafond(s.id, 'gemeten'), doorbelastbaar: !!fw.ok, betaaldDoor,
          firewall: { code: fw.code, uitleg: fw.uitleg, hoeWel: fw.hoeWel || null,
            plafondCenten: fw.plafondCenten == null ? null : fw.plafondCenten },
          bron: post.bron });

        // stap 2: het werelddeel binnen die wereld over de dragers
        const delen = verdeelCenten(wd.centen, groepen[wd.wereld].dragers);
        for (const deel of delen) {
          if (!perDrager[deel.drager]) perDrager[deel.drager] = [];
          perDrager[deel.drager].push({ soort: s.id, naam: s.naam, centen: deel.centen,
            /* De graad komt uit ./soorten.js en wordt hier niet ingetikt: het
               plafond van de soort bepaalt op één plek hoe hard een verdeling
               mag heten. */
            graad: plafond(s.id, 'gemeten'),
            wereld: wd.wereld, betaaldDoor, doorbelastbaar: !!fw.ok,
            sleutel: { aandeelInWereld: groepen[wd.wereld].gewicht > 0
                ? Math.round(deel.gewicht / groepen[wd.wereld].gewicht * 1e6) / 1e6 : 0,
              aandeelWereldInNota: somAlles > 0 ? Math.round(groepen[wd.wereld].gewicht / somAlles * 1e6) / 1e6 : 0,
              uitleg: 'Eerst de nota over de vier werelden naar hun gemeten verbruik, daarna binnen deze wereld over de gebruikers.' },
            bron: post.bron, nota: { centen: post.centen, gezetOp: post.gezetOp } });
        }
      }
      regels.push({ soort: s.id, naam: s.naam, centen: post.centen, graad: plafond(s.id, 'gemeten'),
        bron: post.bron, verdeeldOverWerelden: wereldIds.length });
    }
    return { periode, regels, wereldposten, perDrager, sleutelSom: somAlles,
      gewichtPerWereld: wereldIds.map(id => ({ wereld: id, gewicht: groepen[id].gewicht, dragers: groepen[id].dragers.length })) };
  }

  /* Alleen de regels van één drager. Heet niet voorDrager: er staan er in deze
     map drie die zo zouden heten en ze beantwoorden drie verschillende vragen. */
  function verdeeldVoor(periode, drager) {
    return verdeling(periode).perDrager[String(drager || '')] || [];
  }

  return { verdeling, verdeeldVoor, verdeelCenten, perWereld };
};
