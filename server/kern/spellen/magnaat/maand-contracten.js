/* Magnaat: DE CONTRACTAFWIKKELING -- wie er deze maand betaalt en wie er boet.

   Afgesplitst van ./maand.js. Dat bestand rekent de MAAND van een wereld: de
   drukte, de bedrijven, de rente, de Foundation. Dit stuk gaat over EEN ding --
   wat er over de lopende contracten heen en weer gaat -- en het is precies het
   stuk waar de boekhouding moet kloppen tot op de euro.

   DE LEVERANCIER IS AL BETAALD: zijn contractomzet zit in zijn maand (zie
   ./stap.js). Hier gaat alleen de andere kant rond -- de afnemer betaalt, en
   boetes lopen van leverancier naar afnemer. Zo staat elk bedrag EEN keer op
   een rekening, en klopt de som over alle spelers. */
const H = require('./handel');
const { naarCenten, euroTonen } = require('./centen');
const { beweeg } = require('./boekhouding');

module.exports = ({ rond }) => {
  /* WAT ELK CONTRACT DEZE MAAND BETAALT, EEN KEER, in eurocenten (./centen.js).
     Dat bedrag gaat bij de afnemer eraf (wikkelAf hieronder) en de som ervan is
     precies wat de leverancier aan contractomzet krijgt (./stap.js, via
     `betalingCenten` op zijn toezegging). Voor ronde A2.1 rekende de
     leverancier zijn omzet over het totaal van zijn contracten en betaalde elke
     afnemer zijn eigen deel, en dan liepen de twee kanten een fractie uiteen. */
  function betalingen(actief, leverDeel, toezegging) {
    const betaling = {};
    for (const c of actief) {
      betaling[c.id] = naarCenten(H.afwikkelen(c, { geleverd: c.eenheden * (leverDeel[c.leverancierId] || 0), kwaliteit: 0 }).betaling);
      const t = toezegging[c.leverancierId];
      t.betalingCenten = (t.betalingCenten || 0) + betaling[c.id];
    }
    return betaling;
  }

  /* `betaling` is per contract het bedrag van `betalingen` hierboven. */
  function wikkelAf(st, actief, leverDeel, kwaliteitVan, betaling) {
    const contractRegels = {};
    for (const c of actief) {
      const r = H.afwikkelen(c, { geleverd: c.eenheden * (leverDeel[c.leverancierId] || 0),
        kwaliteit: kwaliteitVan[c.leverancierId] === undefined ? 0 : kwaliteitVan[c.leverancierId] });
      const bedrag = betaling[c.id];
      beweeg(st, { soort: 'CONTRACT_BETALING', van: ['kas', c.afnemer], naar: ['contract', c.id], bedrag, omschrijving: 'Betaling contract' });
      c.betaald += bedrag; c.ontvangen += bedrag;
      if (r.boete > 0) {
        const boete = naarCenten(r.boete);
        beweeg(st, { soort: 'CONTRACT_BOETE', van: ['kas', c.leverancier], naar: ['kas', c.afnemer], bedrag: boete, omschrijving: 'Boete wegens tekort' });
        c.boetes += boete;
        c.maandenTekort++;
      } else c.maandenGeleverd++;
      const regel = { id: c.id, soort: c.soort, geleverd: rond(r.geleverd), toegezegd: c.eenheden,
        bedrag: euroTonen(bedrag), boete: rond(r.boete), tekort: r.tekort, onderMaat: r.onderMaat };
      for (const kant of ['leverancier', 'afnemer'])
        (contractRegels[c[kant]] = contractRegels[c[kant]] || []).push(Object.assign({ rol: kant }, regel));
      if (st.maand + 1 >= c.eindMaand) c.status = 'afgelopen';
    }
    return contractRegels;
  }

  /* HET MAANDRESULTAAT VAN EEN VESTIGING ALS GELD (geldkaart G12): acht
     gebeurtenissen, elk al een keer afgerond (./centen.js, maandDelen). Het
     contractdeel komt per contract van de overlopende rekening waarop de
     afnemer in wikkelAf betaalt; de som is precies `d.CONTRACT_BETALING`. */
  function boekResultaat(st, h, vestigingId, d, actief, betaling) {
    beweeg(st, { soort: 'VERKOOP', van: ['macro', 'huishoudens'], naar: ['kas', h], bedrag: d.VERKOOP });
    for (const c of actief) {
      if (c.leverancierId === vestigingId) { beweeg(st, { soort: 'CONTRACT_BETALING', van: ['contract', c.id], naar: ['kas', h], bedrag: betaling[c.id] }); }
    }
    beweeg(st, { soort: 'INKOOP', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.INKOOP });
    beweeg(st, { soort: 'LOON', van: ['kas', h], naar: ['macro', 'huishoudens'], bedrag: d.LOON });
    beweeg(st, { soort: 'VASTE_LASTEN', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.VASTE_LASTEN });
    beweeg(st, { soort: 'HUUR', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.HUUR });
    beweeg(st, { soort: 'MARKETING', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.MARKETING });
    beweeg(st, { soort: 'ONDERHOUD', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.ONDERHOUD });
  }

  return { wikkelAf, betalingen, boekResultaat };
};
