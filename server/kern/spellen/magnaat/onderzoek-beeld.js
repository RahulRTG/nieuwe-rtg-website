/* Magnaat: WAT EEN SPELER VAN ZIJN ONDERZOEK ZIET.

   Afgesplitst van ./onderzoek-acties.js op de naad die daar al lag: dat bestand
   gaat over wat een speler DOET (starten, budget, uitrollen, subsidie) en dit
   over wat hij WEET. Dat tweede is een eigen onderwerp -- het gaat over de grens
   tussen spelers -- en het groeide mee met elke uitbreiding van de laag, tot het
   bestand over de 10 kB-grens ging die scripts/check.js bewaakt.

   VAN EEN ANDER ZIE JE NIETS. Welke kant een concurrent op onderzoekt, hoeveel
   budget hij erin steekt en hoe het bij hem uitpakte, is precies het soort
   kennis waar hij voor betaalt. Deze functie krijgt een speler mee en levert
   alleen diens eigen beeld; er is geen tweede ingang met een vlag erbij. */
const O = require('./onderzoek');

const rond = (n) => Math.round(n);

module.exports = ({ lopend, af, klaarVan }) => {
  /* WAT EEN SPELER ZIET: de hele boom met wat open staat, wat loopt en wat af
     is, plus per vestiging wat er draait. Van een ander niets -- welke kant een
     concurrent op onderzoekt, is precies het soort kennis waar hij voor betaalt. */
  return function beeld(st, h) {
    const klaar = klaarVan(st, h);
    const loopt = lopend(st, h);
    const gedaan = af(st, h);
    /* ALLEEN DE TAKKEN VAN DE SECTOREN WAAR JE IN ZIT, plus de stam. De rest van
       de boom bestaat wel, maar niet voor jou -- en een scherm dat vijfendertig
       knopen toont waarvan je er vijf kunt gebruiken, is geen keuze maar een
       catalogus. */
    const mijnSectoren = new Set((st.vestigingen[h] || []).map(v => v.sector));
    const zichtbaar = O.KNOPEN.filter(s => !O.BOOM[s].sector || mijnSectoren.has(O.BOOM[s].sector));
    return {
      boom: zichtbaar.map(sleutel => {
        const k = O.BOOM[sleutel];
        const bezig = loopt.find(o => o.sleutel === sleutel);
        const gereed = gedaan.find(o => o.sleutel === sleutel);
        return { sleutel, naam: k.naam, pad: k.pad, sector: k.sector, uitleg: k.uitleg,
          onzeker: k.onzeker || undefined,
          /* WAT HET BIJ JOU GEWORDEN IS, naast wat het BEDOELDE. Allebei, want
             het verschil tussen die twee is precies de informatie waarop een
             speler zijn plan bijstelt. */
          uitkomst: gereed ? gereed.uitkomst : null,
          werkelijk: gereed ? gereed.effect : null,
          anderVeld: gereed ? gereed.anderVeld || null : null,
          kosten: k.kosten, duur: k.duur, deel: k.implementatie, effect: k.effect,
          vereist: k.vereist, open: O.staatOpen(sleutel, klaar),
          staat: klaar.includes(sleutel) ? 'klaar' : bezig ? 'loopt' : O.staatOpen(sleutel, klaar) ? 'open' : 'dicht',
          voortgang: bezig ? Math.round(bezig.voortgang * 100) : null,
          budget: bezig ? bezig.budget : null, id: bezig ? bezig.id : null,
          subsidie: bezig ? rond(bezig.subsidieToegekend || 0) : null };
      }),
      tegelijk: O.TEGELIJK, bezig: loopt.length,
      /* WAT UITROLLEN HIER KOST, per vestiging. Sinds de uitrol een deel van de
         bouwsom is, is er geen bedrag meer dat voor alle panden geldt -- en een
         boom die alleen een percentage toont, laat de speler zelf rekenen. */
      uitgerold: (st.vestigingen[h] || []).map(v => ({ vestiging: v.id, naam: v.naam,
        tech: (v.tech || []).slice(),
        uitrol: Object.fromEntries(O.KNOPEN.map(s => [s, O.uitrolkosten(v, s)])) }))
    };
  };
};
