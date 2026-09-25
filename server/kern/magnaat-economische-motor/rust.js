/* Magnaat Economische Motor -- de brug naar de Rust-rekenmotor.

   Rust rekent alleen de marktgetallen (motor/src/magnaat.rs) en bezit geen
   journaal en geen staat. Alle boekingen blijven hier, ook als Rust rekende;
   daarom verandert een nieuw veld op een gebeurtenis aan de Rust-kant niets. */
'use strict';

const RUST_BEDRIJF_GETALLEN = [
  'productiviteit', 'capaciteitVandaag', 'vraagVandaag', 'levering', 'voorraad',
  'levergraad', 'verkoop', 'benutting', 'kwaliteit', 'reputatie'
];
const RUST_MACRO_GETALLEN = [
  'werkloosheid', 'inflatie', 'rente', 'prijsindex', 'bbpVandaag',
  'vraagIndex', 'aanbodIndex', 'consumentenvertrouwen'
];

module.exports = (m) => {
  function motorInvoer(e, bedrijven) {
    return {
      werk: {
        aantal: e.werk.aantal, productiviteit: e.werk.productiviteit,
        service: e.werk.service, controle: e.werk.controle, innovatie: e.werk.innovatie
      },
      schok: { id: e.actieveSchok.id, vraag: e.actieveSchok.vraag, aanbod: e.actieveSchok.aanbod },
      macro: {
        consumentenvertrouwen: e.macro.consumentenvertrouwen,
        beroepsbevolking: e.macro.beroepsbevolking,
        leverancierPersoneel: e.macro.leverancierPersoneel,
        prijsindex: e.macro.prijsindex
      },
      instellingen: { basisVraag: e.instellingen.basisVraag, prijsElasticiteit: e.instellingen.prijsElasticiteit },
      bedrijven: bedrijven.map(b => ({
        id: b.id, personeel: b.personeel, basisProductiviteit: b.basisProductiviteit,
        trainingDag: b.trainingDag, prijs: b.prijs, kwaliteit: b.kwaliteit,
        reputatie: b.reputatie, vasteCapaciteit: b.vasteCapaciteit,
        bestelling: b.bestelling, voorraad: b.voorraad
      }))
    };
  }

  /* Bereid alleen het kleine rekenmodel voor. De vorige versie maakte vóór
     iedere HTTP-call een structuredClone van het volledige grootboek,
     journaal en de historie. Dat was veilig maar werd per dag duurder. Deze
     kopie bevat uitsluitend de velden die Rust leest; de levende staat wordt
     pas na een geldig antwoord en een mutatieversie-check synchroon gewijzigd. */
  function rustInvoerVoor(e, schok) {
    const reken = {
      dag: e.dag + 1,
      actieveSchok: schok,
      werk: Object.assign({}, e.werk),
      macro: Object.assign({}, e.macro),
      instellingen: Object.assign({}, e.instellingen),
      bedrijven: Object.fromEntries(Object.entries(e.bedrijven).map(([id, b]) => [id, Object.assign({}, b)])),
      verklaringen: []
    };
    const bedrijven = Object.values(reken.bedrijven);
    bedrijven.forEach(b => m.pasArbeidsmarktToe(reken, b, schok));
    return motorInvoer(reken, bedrijven);
  }

  function valideerRustAntwoord(antwoord, bedrijven) {
    if (!Array.isArray(antwoord.bedrijven) || antwoord.bedrijven.length !== bedrijven.length) {
      throw new Error('Rust-motor gaf niet alle bedrijven terug.');
    }
    const perId = new Map(antwoord.bedrijven.map(b => [b && b.id, b]));
    for (const b of bedrijven) {
      const r = perId.get(b.id);
      if (!r || RUST_BEDRIJF_GETALLEN.some(k => !Number.isFinite(r[k]))) {
        throw new Error('Rust-motor gaf een ongeldige uitkomst voor ' + b.id + '.');
      }
    }
    if (!antwoord.macro || RUST_MACRO_GETALLEN.some(k => !Number.isFinite(antwoord.macro[k]))) {
      throw new Error('Rust-motor gaf ongeldige macro-indices terug.');
    }
    if (!Number.isFinite(antwoord.totaleVraag) || !Number.isFinite(antwoord.werkBonus)) {
      throw new Error('Rust-motor gaf ongeldige markttotalen terug.');
    }
  }

  function pasRustAntwoordToe(e, antwoord) {
    const bedrijven = Object.values(e.bedrijven);
    bedrijven.forEach(b => m.pasArbeidsmarktToe(e, b, e.actieveSchok));
    const perId = new Map(antwoord.bedrijven.map(b => [b && b.id, b]));
    for (const b of bedrijven) {
      const r = perId.get(b.id);
      b.productiviteit = r.productiviteit;
      b.capaciteitVandaag = r.capaciteitVandaag;
      b.vraagVandaag = r.vraagVandaag;
      b.voorraad = r.voorraad;
      b.levergraad = r.levergraad;
      b.benutting = r.benutting;
      b.kwaliteit = r.kwaliteit;
      b.reputatie = r.reputatie;
      m.boekBedrijfsdag(e, b, r.verkoop, r.levering);
    }
    for (const k of RUST_MACRO_GETALLEN) e.macro[k] = antwoord.macro[k];
    m.verwerkOverheid(e);
    m.verklaarMarkt(e, antwoord.totaleVraag, antwoord.werkBonus);
  }

  return { rustInvoerVoor, valideerRustAntwoord, pasRustAntwoordToe };
};
