/* Magnaat Economische Motor -- de markt: vraag, levering en de dag van een
   bedrijf. De schokken staan in ./schokken.js, de arbeidsmarkt in ./arbeid.js.

   Dit is de JavaScript-helft van motor/src/magnaat.rs (RUST-MIGRATIES.json):
   Rust rekent dezelfde marktgetallen en de boekingen blijven hier. */
'use strict';
const { ECONOMISCHE_GEBEURTENISSEN, rond, begrens, som } = require('./constanten');

module.exports = (m) => {
  function aantrekkelijkheid(e, b) {
    const prijsFactor = Math.pow(11900 / Math.max(5000, b.prijs), e.instellingen.prijsElasticiteit);
    const kwaliteitFactor = begrens(b.kwaliteit / 72, .55, 1.5);
    const reputatieFactor = begrens(b.reputatie / 70, .6, 1.45);
    return prijsFactor * kwaliteitFactor * reputatieFactor;
  }

  function boekBedrijfsdag(e, b, verkoop, levering) {
    const dag = e.dag;
    const omzet = verkoop * b.prijs;
    const inkoopKas = levering * e.instellingen.inkoopPerEenheid;
    const kostprijs = verkoop * e.instellingen.inkoopPerEenheid;
    const loon = rond((b.loonMaand * b.personeel * (e.actieveSchok.id === 'arbeidstekort' ? 1.035 : 1)) / 30);
    const training = Math.min(b.trainingDag, m.kas(e, b.id));
    const impact = rond(omzet * b.impactBp / 10000);
    const rente = rond(m.creditWaarde(e, b.id + '.schuld') * e.macro.rente / 100 / 365);
    m.zorgLiquiditeit(e, b.id, inkoopKas + loon + training + impact + rente);

    const G = ECONOMISCHE_GEBEURTENISSEN, kasNu = () => m.kas(e, b.id);
    m.betaalStroom(e, 'dag:' + dag + ':omzet:' + b.id, G.VERKOOP, 'Verkoop diensten ' + b.naam, 'huishoudens', b.id, omzet, 'consumptie', 'omzet', ['vraag', 'omzet']);
    m.koopVoorraad(e, 'dag:' + dag + ':inkoop:' + b.id, b, Math.min(levering, Math.floor(kasNu() / e.instellingen.inkoopPerEenheid)));
    m.boekKostprijs(e, 'dag:' + dag + ':kostprijs:' + b.id, b, verkoop);
    m.betaalStroom(e, 'dag:' + dag + ':loon:' + b.id, G.LOON, 'Lonen ' + b.naam, b.id, 'huishoudens', Math.min(loon, kasNu()), 'loonkosten', 'looninkomen', ['arbeid']);
    m.betaalStroom(e, 'dag:' + dag + ':training:' + b.id, G.OPLEIDING, 'Opleiding en ontwikkeling ' + b.naam, b.id, 'rtf', Math.min(training, kasNu()), 'opleidingskosten', 'opleidingsopbrengsten', ['menselijk-kapitaal', 'rtf']);
    m.betaalStroom(e, 'dag:' + dag + ':impact:' + b.id, G.IMPACT, 'Maatschappelijke bijdrage ' + b.naam, b.id, 'rtf', Math.min(impact, kasNu()), 'impactkosten', 'bijdragen', ['impact', 'rtf']);
    m.betaalStroom(e, 'dag:' + dag + ':rente:' + b.id, G.RENTE, 'Rente ' + b.naam, b.id, 'bank', Math.min(rente, kasNu()), 'rentekosten', 'renteopbrengsten', ['krediet']);

    const kostenVoorBelasting = kostprijs + loon + training + impact + rente;
    const winstVoorBelasting = omzet - kostenVoorBelasting;
    const belasting = winstVoorBelasting > 0 ? rond(winstVoorBelasting * e.instellingen.vennootschapsbelastingBp / 10000) : 0;
    m.betaalStroom(e, 'dag:' + dag + ':belasting:' + b.id, G.BELASTING, 'Vennootschapsbelasting ' + b.naam, b.id, 'overheid', Math.min(belasting, kasNu()), 'belastingkosten', 'belastingopbrengsten', ['overheid', 'belasting']);

    b.omzetVandaag = omzet;
    b.kostenVandaag = kostenVoorBelasting + belasting;
    b.winstVandaag = omzet - b.kostenVandaag;
    b.kostenUitsplitsing = { kostprijs, loon, training, impact, rente, belasting };
    b.verkopenVandaag = verkoop;
    b.schuld = m.creditWaarde(e, b.id + '.schuld');
  }

  const werkenden = (e) => som(Object.values(e.bedrijven).map(b => b.personeel)) + e.macro.leverancierPersoneel;

  function verwerkOverheid(e) {
    const werkloos = Math.max(0, e.macro.beroepsbevolking - werkenden(e));
    const uitkering = Math.min(m.kas(e, 'overheid'), werkloos * 5200);
    m.betaalStroom(e, 'dag:' + e.dag + ':uitkering', ECONOMISCHE_GEBEURTENISSEN.UITKERING, 'Sociale uitkeringen', 'overheid', 'huishoudens', uitkering, 'sociale-kosten', 'overdrachtsinkomen', ['arbeid', 'stabilisator']);
  }

  function berekenMarkt(e) {
    const schok = e.actieveSchok;
    const werk = e.werk;
    const werkBonus = werk.aantal ? begrens((werk.productiviteit + werk.service + werk.controle + werk.innovatie) / (werk.aantal * 100), 0, .22) : 0;
    const bedrijven = Object.values(e.bedrijven);
    bedrijven.forEach(b => m.pasArbeidsmarktToe(e, b, schok));

    const totaalAantrekkelijk = som(bedrijven.map(b => aantrekkelijkheid(e, b) * 100000)) / 100000 || 1;
    const macroVraag = begrens(e.macro.consumentenvertrouwen / 100, .65, 1.25);
    const totaleVraag = Math.max(100, rond(e.instellingen.basisVraag * schok.vraag * macroVraag));
    const leverancierCapaciteit = rond(1100 * schok.aanbod);

    for (const b of bedrijven) {
      const trainingsFactor = begrens(b.trainingDag / Math.max(1, b.personeel * 50000), 0, .22);
      b.productiviteit = Number((b.basisProductiviteit * (1 + trainingsFactor + werkBonus)).toFixed(2));
      b.capaciteitVandaag = Math.max(0, rond(b.personeel * b.productiviteit + b.vasteCapaciteit));
      b.vraagVandaag = Math.max(0, rond(totaleVraag * aantrekkelijkheid(e, b) / totaalAantrekkelijk));
    }

    const totaalBesteld = som(bedrijven.map(b => b.bestelling));
    for (const b of bedrijven) {
      const aandeel = totaalBesteld ? b.bestelling / totaalBesteld : .5;
      const levering = Math.min(b.bestelling, rond(leverancierCapaciteit * aandeel));
      b.voorraad += levering;
      b.levergraad = b.bestelling ? rond(levering / b.bestelling * 100) : 100;
      const verkoop = Math.min(b.vraagVandaag, b.capaciteitVandaag, b.voorraad);
      b.voorraad -= verkoop;
      b.benutting = b.capaciteitVandaag ? rond(verkoop / b.capaciteitVandaag * 100) : 0;
      const druk = b.benutting > 92 ? -2.2 : b.benutting < 62 ? .4 : .8;
      const serviceBonus = werk.aantal ? werk.service / (werk.aantal * 40) : 0;
      const controleBonus = werk.aantal ? werk.controle / (werk.aantal * 55) : 0;
      b.kwaliteit = Number(begrens(b.kwaliteit + druk + serviceBonus + controleBonus, 35, 98).toFixed(1));
      b.reputatie = Number(begrens(b.reputatie + (b.kwaliteit - 70) / 80, 25, 98).toFixed(1));
      boekBedrijfsdag(e, b, verkoop, levering);
    }

    e.macro.werkloosheid = Number(begrens((e.macro.beroepsbevolking - werkenden(e)) / e.macro.beroepsbevolking * 100, 0, 40).toFixed(1));
    const vraagDruk = totaleVraag / e.instellingen.basisVraag - 1;
    const aanbodDruk = 1 - schok.aanbod;
    e.macro.inflatie = Number(begrens(2 + vraagDruk * 5.5 + aanbodDruk * 4.5 - (e.macro.werkloosheid - 5) * .06, -.5, 12).toFixed(2));
    e.macro.rente = Number(begrens(1.4 + .62 * (e.macro.inflatie - 2) - .08 * (e.macro.werkloosheid - 5), .25, 11).toFixed(2));
    e.macro.prijsindex = Number((e.macro.prijsindex * (1 + e.macro.inflatie / 100 / 365)).toFixed(3));
    e.macro.bbpVandaag = som(bedrijven.map(b => b.omzetVandaag));
    e.macro.vraagIndex = rond(totaleVraag / e.instellingen.basisVraag * 100);
    e.macro.aanbodIndex = rond(schok.aanbod * 100);
    e.macro.consumentenvertrouwen = Number(begrens(e.macro.consumentenvertrouwen + (schok.id === 'geen' ? .3 : -.7), 70, 115).toFixed(1));
    verwerkOverheid(e);

    verklaarMarkt(e, totaleVraag, werkBonus);
  }

  function verklaarMarkt(e, totaleVraag, werkBonus) {
    const schok = e.actieveSchok;
    const werk = e.werk;
    const tekst = m.profiel.teksten.werk;
    m.legUit(e, 'markt', 'Vraag en marktaandeel verdeeld', 'Prijs, kwaliteit en reputatie bepalen samen de aantrekkelijkheid. Capaciteit en voorraad begrenzen de uiteindelijke verkoop.', totaleVraag + ' gevraagde diensten', 'vraagcurve + prijselasticiteit + capaciteitsgrens');
    if (schok.id !== 'geen') m.legUit(e, 'schok', schok.naam, schok.uitleg, 'Vraag ' + rond(schok.vraag * 100) + ' · aanbod ' + rond(schok.aanbod * 100) + ' · arbeid ' + rond(schok.arbeid * 100), 'deterministisch scenarioschema');
    if (werk.aantal) m.legUit(e, 'werkvloer', tekst.titel, werk.aantal + ' voltooide dossier(s) verbeteren productiviteit, service, controle of innovatie in de volgende economische dag.', '+' + rond(werkBonus * 100) + '% productiviteitspotentieel', tekst.bron);
  }

  return { boekBedrijfsdag, verwerkOverheid, berekenMarkt, verklaarMarkt };
};
