/* HET BEVOEGDHEIDSBORD: wat de boardroom te zien krijgt.

   Afgesplitst van ./index.js, en de snede loopt langs het ONDERWERP en niet
   langs een getal: `mag()` daar velt een OORDEEL over een handeling die iemand
   nu wil doen, dit bestand tekent een BEELD van de hele lijst. Dat zijn twee
   dingen. Het oordeel wordt honderden keren per dag gevraagd door de poort van
   RTG Pay; het beeld een paar keer per week door een bestuurder die wil zien
   waar de grens loopt tussen "gebouwd" en "toegestaan".

   Dat die twee niet hetzelfde zijn, is precies het punt van dit bord. Een
   handeling kan technisch klaar zijn en toch dicht staan omdat de vergunning
   ontbreekt, en andersom.

   HET BORD TOONT HET GELDENDE GEZICHT en niet de kale lijstregel. Bij een
   afhankelijk vermogen (WALLET_SALDO, LID_UITBETALING) staat er dus 'besluit'
   of 'rail' naar gelang de terugstortstand, met `hangtAf` erbij zodat een
   bestuurder ziet WAAROM het dat nu is. Zou hier de rauwe regel staan, dan las
   het bord 'afhankelijk' -- een woord dat niets zegt over wat er op dit moment
   geldt.

   Alles komt binnen als functie; dit bestand houdt zelf geen stand vast en
   beslist niets. */
'use strict';

const { VERMOGENS } = require('./lijst');

module.exports = ({ vergunningStand, railVan, partnerRails, stand, vermogen, mag }) =>
  function matrix({ land } = {}) {
    const v = vergunningStand();
    return {
      status: 200,
      rail: railVan(),
      vergunning: v.er ? { soort: v.soort, nummer: v.nummer, entiteit: v.entiteit, landen: v.landen, tot: v.tot, verlopen: v.verlopen } : null,
      partnerRails: partnerRails() || {},
      terugstorting: stand(),
      regels: Object.keys(VERMOGENS).map(id => {
        const f = vermogen(id);
        const r = mag(id, { land });
        return { id, naam: f.naam, soort: f.soort, nodig: f.eigenNodig || f.nodig || null,
          partnerRail: f.partnerRail || null, mag: r.mag, reden: r.reden || null, via: r.via || null,
          besluit: f.besluit || null, hangtAf: f.hangtAf || null };
      })
    };
  };
