/* Magnaat: DE BEURS -- belangen die openbaar te koop staan.

   WAT ER AL WAS EN WAT ERBIJ KOMT. ./aandeel.js kent het BELANG: een deel van
   een vestiging, dat elke maand meedeelt in het resultaat -- winst en verlies
   allebei. Dat IS het dividend, en het is er continu; een aparte
   dividenduitkering zou dezelfde euro een tweede keer uitbetalen.
   ./aandeel-acties.js kent het GESPREK: een voorstel aan een genoemde
   tegenpartij, die ja of nee zegt.

   Wat ontbrak is een MARKT: een plek waar een belang openbaar te koop staat en
   iedereen het kan nemen. Dat verschil is niet cosmetisch. Bij een voorstel kies
   je je tegenpartij en weet de rest van de tafel van niets; op een beurs is de
   prijs PUBLIEK, en daarmee wordt hij informatie. Wie ziet dat een concurrent
   een vijfde van zijn beste zaak wegzet, weet dat hij geld nodig heeft.

   EEN MARKT IS EEN POMPVLAK, en dat is de reden dat er een prijsband op zit.
   Twee spelers die onderling een procent voor een miljoen verhandelen, verplaatsen
   geld zonder dat er iets tegenover staat -- op zichzelf een overdracht en dus
   geen pomp, maar in combinatie met de waardering (een grotere kas leent meer)
   is het de eerste steen van een lus. De band hangt aan dezelfde waardering die
   de eindstand gebruikt: je mag een belang tussen de helft en het dubbele van
   zijn rekenkundige waarde verhandelen, en daarbuiten is het geen prijs maar een
   overboeking met een aandeel eraan geniet.

   DRIE DINGEN DIE DEZE LAAG NIET DOET, met opzet:
     - GEEN ZEGGENSCHAP. Dezelfde regel als bij de deelnemingen: een belang geeft
       recht op resultaat en niet op de knoppen. Een stemlaag zou een tweede spel
       zijn.
     - GEEN KOERS DIE ZELF BEWEEGT. Er is geen orderboek met een laatste koers
       die op- en neerloopt; de waarde van een belang volgt uit de vestiging.
       Een koers die van handel afhangt is een tweede waardering naast die van
       de eindstand, en twee waarderingen lopen uiteen.
     - GEEN SHORTS, GEEN HEFBOOM. Je verkoopt wat je hebt.

   HET AANBOD VERVALT ALS DE ZAAK VAN EIGENAAR WISSELT of als de aanbieder zijn
   belang kwijtraakt. Zonder die regel staat er een order op iets wat niet meer
   van hem is. */
const rond = (n) => Math.round(n);

const PRIJSBAND = [0.5, 2.0];
const LOOPTIJD = 6;          // maanden dat een aanbod open blijft staan

module.exports = ({ wieHeeft, waarde, eigenDeel, uitgegeven, MAX_DEEL }) => {
  /* De orders die openstaan. Hij heet `openstaand` en niet `open`, en dat is
     dezelfde reden als bij `staatOpen` in ./onderzoek.js: `open` is in deze map
     al de naam van de GROTE actie waarmee je een vestiging opent. Twee
     zusterbestanden met dezelfde kale naam voor twee verschillende dingen is
     precies waar scripts/kruisscan.js voor bestaat, en die sloeg hier ook aan. */
  const openstaand = (st) => (st.beurs || []).filter(o => o.status === 'open');

  /* WAT EEN PROCENT VAN DEZE ZAAK RE KENKUNDIG WAARD IS. Uit dezelfde
     `waarde()` als de eindstand en het onderpand -- een tweede waardering naast
     die ene is een tweede antwoord op dezelfde vraag. */
  const stukPrijs = (v, deel) => waarde(v) * (deel / 100);

  /* Van wie is dit aanbod, en klopt het nog? Een order die niet meer gedekt is
     -- de zaak verkocht, het belang weg -- hoort te vervallen en niet stil te
     blijven staan. */
  function gedekt(st, o) {
    const w = wieHeeft(st, o.vestiging);
    if (!w) return false;
    if (o.eigenaar) return w.speler === o.verkoper;
    const eigen = (st.deelnemingen || [])
      .filter(d => d.status === 'loopt' && d.vestiging === o.vestiging && d.houder === o.verkoper)
      .reduce((n, d) => n + d.deel, 0);
    return eigen >= o.deel;
  }

  /* De verlopen en ongedekte orders opruimen. Draait aan het begin van elke
     maand, want een beurs met dode orders is geen beurs. */
  function opschonen(st) {
    let weg = 0;
    for (const o of openstaand(st)) {
      if (st.maand >= o.tot || !gedekt(st, o)) { o.status = 'vervallen'; o.tot = st.maand; weg++; }
    }
    return weg;
  }

  /* Wat er te koop staat. PUBLIEK: dat is het hele punt van een beurs. De
     codenaam van de verkoper hoort erbij -- wie iets aanbiedt, doet dat in het
     openbaar -- maar zijn kas en zijn boeken uiteraard niet. */
  function beeld(st, mij, codenaamVan) {
    opschonen(st);
    return openstaand(st).map(o => {
      const w = wieHeeft(st, o.vestiging);
      const eerlijk = w ? stukPrijs(w.v, o.deel) : 0;
      return { id: o.id, vestiging: o.vestiging, naam: w ? w.v.naam : null,
        sector: w ? w.v.sector : null, deel: o.deel, prijs: o.prijs,
        verkoper: codenaamVan(o.verkoper), vanMij: o.verkoper === mij,
        eigenaarsdeel: !!o.eigenaar, tot: o.tot,
        /* WAT HET RE KENKUNDIG WAARD IS, ernaast. Zonder dat getal is een prijs
           een bedrag zonder maat, en dan is onderhandelen raden over iets wat de
           motor gewoon weet. */
        rekenwaarde: rond(eerlijk),
        verhouding: eerlijk > 0 ? Math.round((o.prijs / eerlijk) * 100) / 100 : null };
    });
  }

  /* De grenzen van een aanbod, op een plek. Geeft een foutregel terug of null;
     zo staat de reden in de actie en niet in drie ifs verspreid. */
  function keur(st, h, v, deel, prijs, eigenaar) {
    if (!(deel > 0) || deel > MAX_DEEL) return 'Een belang loopt van 1 tot ' + MAX_DEEL + ' procent.';
    if (eigenaar) {
      const alUit = uitgegeven(st, v.id);
      if (alUit + deel > MAX_DEEL)
        return 'Er zit al ' + alUit + '% bij anderen; hoogstens ' + MAX_DEEL + '% gaat weg.';
    } else {
      const eigen = (st.deelnemingen || [])
        .filter(d => d.status === 'loopt' && d.vestiging === v.id && d.houder === h)
        .reduce((n, d) => n + d.deel, 0);
      if (eigen < deel) return 'Je hebt daar maar ' + eigen + '% van.';
    }
    const eerlijk = stukPrijs(v, deel);
    if (!(prijs > 0)) return 'Een prijs is een bedrag.';
    if (prijs < eerlijk * PRIJSBAND[0] || prijs > eerlijk * PRIJSBAND[1])
      return 'Dat belang is rekenkundig ' + rond(eerlijk) + ' waard; een prijs hoort tussen ' +
        rond(eerlijk * PRIJSBAND[0]) + ' en ' + rond(eerlijk * PRIJSBAND[1]) + ' te liggen.';
    return null;
  }

  return { openstaand, opschonen, beeld, keur, stukPrijs, gedekt };
};
/* De twee vaste getallen staan NAAST de fabriek en niet erin: ze horen bij de
   markt en niet bij een exemplaar ervan, en de toetsen en de meters lezen ze
   zonder de laag te hoeven bouwen. Dezelfde reden als bij ./beheer.js, waar het
   omgekeerd fout ging en het tarief `NaN` werd. */
Object.assign(module.exports, { PRIJSBAND, LOOPTIJD });
