/* STROOM EN SERVERHUUR VERDELEN -- en er eerlijk bij zetten dat het een
   verdeling is.

   Van de negen kostensoorten zijn er zeven per gebruiker te meten. Twee niet, en
   dat is geen tekortkoming die met beter meten over gaat: een lid deelt een
   machine met duizend anderen en er hangt geen stroommeter aan zijn sessie. Wat
   er wél is, is de NOTA van de hoster en van de energieleverancier
   (./huisrekening.js). Die verdelen we.

   DE SLEUTEL, EN WAAROM DEZE. Een verdeling heeft een maatstaf nodig, en er is
   er geen die perfect is. Wij nemen het AANDEEL IN DE GEMETEN DIRECTE KOSTEN:
   wie een tiende van alle gemeten kosten van die maand veroorzaakte, krijgt een
   tiende van de stroom. Dat is de enige maatstaf die voor alle soorten bestaat
   en die meebeweegt met echt gebruik. Hij is niet volmaakt -- externe
   AI-tokens draaien op de stroom van de aanbieder en niet op die van ons, dus
   voor een AI-zware gebruiker rekent deze sleutel aan de hoge kant. Dat staat
   hier omdat het waar is, niet omdat het onbelangrijk is: wie een betere
   sleutel heeft, verandert hem HIER, op één plek, en niet in het overzicht.

   HET HUIS DOET MEE IN DE SLEUTEL. Verbruik zonder eigenaar (cronrondes,
   achtergrondwerk, bezoekers zonder account) krijgt dus zijn eigen deel van de
   stroom, en dat deel gaat NIET naar de leden. Anders zou de rekening van het
   huis stilletjes bij de gebruikers landen, en dat is precies de vorm van
   "onze kosten laten betalen" die niemand kan navertellen.

   GEEN NOTA, GEEN VERDELING. Ontbreekt de rekening van die maand, dan komt er
   geen bedrag maar een reden. Nul euro stroom is geen eerlijke uitkomst.

   EN DE GRAAD IS ALTIJD 'VERMOED'. ./soorten.js zet daar een plafond op dat
   deze module niet kan omzeilen. Elk ander bord zou hier een getal neerzetten
   dat er net zo uitziet als een meting; dit zet er de sleutel bij, en de nota
   waar het uit komt. */
'use strict';

const { toegerekend, plafond } = require('./soorten');

/* Hele centen verdelen zonder dat er een cent zoekraakt: ieder krijgt zijn
   afgeronde deel naar beneden, en de overgebleven centen gaan één voor één naar
   de grootste resten. Zonder deze stap telt de som van de delen niet op tot de
   nota, en dan is de vraag welke gebruiker die cent had moeten hebben. */
function verdeelCenten(totaal, gewichten) {
  const som = gewichten.reduce((a, g) => a + g.gewicht, 0);
  if (!(som > 0) || !(totaal > 0)) return gewichten.map(g => Object.assign({}, g, { centen: 0 }));
  const rauw = gewichten.map(g => Object.assign({}, g, { exact: totaal * g.gewicht / som }));
  const uit = rauw.map(g => Object.assign({}, g, { centen: Math.floor(g.exact) }));
  let rest = totaal - uit.reduce((a, g) => a + g.centen, 0);
  const volgorde = uit.map((g, i) => ({ i, r: g.exact - Math.floor(g.exact) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < volgorde.length && rest > 0; k++) { uit[volgorde[k].i].centen++; rest--; }
  return uit;
}

module.exports = (ctx) => {
  const { huisrekening, directeKostenPerDrager } = ctx;

  /* Voor één periode: per drager per toegerekende soort een bedrag, of de reden
     dat er geen bedrag is. `directe` is de uitkomst van ./overzicht.js voor
     alle dragers: { drager -> millicenten aan gemeten kosten }. */
  function verdeling(periode) {
    const directe = directeKostenPerDrager(periode);
    const dragers = Object.keys(directe);
    const gewichten = dragers.map(dr => ({ drager: dr, gewicht: directe[dr] || 0 }));
    const som = gewichten.reduce((a, g) => a + g.gewicht, 0);
    const perDrager = {};
    const regels = [];
    for (const s of toegerekend()) {
      const post = huisrekening.postVan(periode, s.id);
      if (!post) {
        regels.push({ soort: s.id, naam: s.naam, centen: null, graad: 'onbekend',
          waarom: 'Er is voor ' + periode + ' geen nota ingevoerd voor ' + s.naam.toLowerCase() + '; zonder nota wordt er niets verdeeld.' });
        continue;
      }
      if (!(som > 0)) {
        regels.push({ soort: s.id, naam: s.naam, centen: post.centen, graad: 'onbekend',
          waarom: 'Er is in deze maand geen gemeten verbruik, dus er is geen sleutel om ' + s.naam.toLowerCase() + ' over te verdelen.' });
        continue;
      }
      const delen = verdeelCenten(post.centen, gewichten);
      for (const deel of delen) {
        if (!perDrager[deel.drager]) perDrager[deel.drager] = [];
        /* De graad komt uit ./soorten.js en wordt hier niet ingetikt: we vragen
           de hoogste die een gemeten regel zou krijgen en laten het plafond van
           de soort hem terugzetten. Zo bepaalt één plek hoe hard een verdeling
           mag heten, en verandert dat mee als iemand daar ooit aan draait. */
        perDrager[deel.drager].push({ soort: s.id, naam: s.naam, centen: deel.centen, graad: plafond(s.id, 'gemeten'),
          sleutel: { aandeel: som > 0 ? Math.round(deel.gewicht / som * 1e6) / 1e6 : 0,
            uitleg: 'Aandeel in de gemeten directe kosten van deze maand.' },
          bron: post.bron, nota: { centen: post.centen, gezetOp: post.gezetOp } });
      }
      regels.push({ soort: s.id, naam: s.naam, centen: post.centen, graad: plafond(s.id, 'gemeten'), bron: post.bron,
        verdeeldOver: dragers.length });
    }
    return { periode, regels, perDrager, sleutelSom: som };
  }

  /* Alleen de regels van één drager. Geeft een lege lijst als er niets te
     verdelen viel -- de reden staat dan in verdeling().regels. Heet niet
     voorDrager: er staan er in deze map drie die zo zouden heten en ze
     antwoorden op drie verschillende vragen. */
  function verdeeldVoor(periode, drager) {
    return verdeling(periode).perDrager[String(drager || '')] || [];
  }

  return { verdeling, verdeeldVoor, verdeelCenten };
};
