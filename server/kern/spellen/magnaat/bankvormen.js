/* Magnaat: DE KREDIETVORMEN -- de tabel, en waarom elke vorm er staat.

   Losgetrokken uit ./bank.js omdat twee bestanden hem nodig hebben (de prijs en
   de convenanten) en een tabel die op twee plekken staat, op twee plekken
   uiteen gaat lopen.

   ELKE VORM MAAKT EEN ANDERE MANIER VAN SPELEN MOGELIJK. Dat is de toets die ze
   moesten doorstaan; een vorm die alleen een ander getal is, staat er niet in.

   `basis` is de maandrente voor een vlekkeloos profiel; de opslagen komen er in
   ./bank.js bovenop. `dekking` zegt hoeveel je maximaal mag lenen ten opzichte
   van waar het om gaat -- bij vastgoed de waarde van de zaak, bij de rest je
   eigen vermogen. */
const VORMEN = {
  rekeningcourant: {
    naam: 'Rekening-courant', basis: 0.014, aflossend: false, looptijd: null,
    dekking: 0.35, onderpand: false, achtergesteld: false,
    /* Geen aanvraag en geen covenant: dit is de kredietlijn die er altijd is.
       De prijs ervoor is dat hij het duurst is en het kleinst. */
    automatisch: true, covenanten: []
  },
  werkkapitaal: {
    naam: 'Werkkapitaalkrediet', basis: 0.009, aflossend: false, looptijd: [3, 12],
    dekking: 0.60, onderpand: false, achtergesteld: false,
    covenanten: ['liquiditeit']
  },
  investering: {
    naam: 'Investeringslening', basis: 0.007, aflossend: true, looptijd: [12, 96],
    dekking: 1.20, onderpand: false, achtergesteld: false,
    covenanten: ['liquiditeit', 'schuldlast']
  },
  vastgoed: {
    naam: 'Vastgoedfinanciering', basis: 0.0045, aflossend: true, looptijd: [24, 180],
    dekking: 0.70, onderpand: true, achtergesteld: false,
    covenanten: ['schuldlast']
  },
  achtergesteld: {
    naam: 'Achtergestelde lening', basis: 0.018, aflossend: false, looptijd: [24, 120],
    dekking: 0.50, onderpand: false, achtergesteld: true,
    covenanten: []
  }
};
const VORMLIJST = Object.keys(VORMEN);

module.exports = { VORMEN, VORMLIJST };
