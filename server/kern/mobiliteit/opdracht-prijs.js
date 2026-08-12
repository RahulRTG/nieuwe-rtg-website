/* Mobility OS (deelbestand): DE PRIJS van een vervoersopdracht.

   Dit stond in ./opdracht.js, dat over de vorm van een opdracht gaat -- wat hij
   IS en hoe hij ontstaat. De prijs is een eigen onderwerp: hij heeft zijn eigen
   bodem, zijn eigen eenheid (alles in centen, nooit in euro's met komma) en
   zijn eigen regel over wanneer hij vastligt. Dat laatste staat ook in de kop
   van opdracht.js, en een alinea die daar over dit bestand gaat is precies het
   teken dat er twee onderwerpen in een bestand zaten.

   DE PRIJS STAAT VAST BIJ HET AANVRAGEN. Het prijsmodel wordt op de opdracht
   GEKOPIEERD en niet als verwijzing bewaard. Zet een vervoerder morgen zijn
   tarief omhoog, dan verandert de prijs van een rit die gisteren geboekt is
   niet mee. Een verwijzing had dat wel gedaan, stil, en dat is precies het soort
   fout dat pas op een factuur zichtbaar wordt.

   ALLES IN CENTEN. Een prijs die onderweg een keer als euro's wordt gelezen,
   verschilt honderd keer -- en dat valt bij kleine bedragen niet op. */
'use strict';

// het standaard prijsmodel als een vervoerder niets heeft ingesteld (in centen)
const STANDAARD_TARIEF = { basis: 350, perKm: 220, perMin: 40, minimum: 700, wachtPerMin: 45 };

module.exports = ({ findSupplier }) => {

  /* Het tarief van deze vervoerder, of de standaard. Elk veld wordt door Number
     gehaald en niet overgenomen zoals het staat: een tarief komt uit een
     invoerveld van de vervoerder, en een tekst die daar per ongeluk in staat
     zou anders als NaN door de rekensom lopen en de prijs op de bodem zetten. */
  function tariefVan(vervoerderCode) {
    const s = vervoerderCode ? findSupplier(vervoerderCode) : null;
    const t = (s && s.settings && s.settings.mobTarief) || null;
    if (!t) return Object.assign({}, STANDAARD_TARIEF);
    return { basis: Number(t.basis) || 0, perKm: Number(t.perKm) || 0, perMin: Number(t.perMin) || 0,
      minimum: Number(t.minimum) || 0, wachtPerMin: Number(t.wachtPerMin) || 0 };
  }

  // basis + kilometers + minuten, met een bodem. Alles in centen.
  function prijsUit(tarief, km, minuten) {
    const rauw = tarief.basis + tarief.perKm * km + tarief.perMin * minuten;
    return Math.max(tarief.minimum || 0, Math.round(rauw));
  }

  return { tariefVan, prijsUit, STANDAARD_TARIEF };
};
