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
   afhankelijk vermogen staat er dus 'besluit', 'rail' of 'stand' naar gelang
   zijn eigen schakelaar, met `hangtAf` erbij zodat een bestuurder ziet WAAROM
   het dat nu is. Zou hier de rauwe regel staan, dan las het bord 'afhankelijk'
   -- een woord dat niets zegt over wat er op dit moment geldt.

   EN DE SCHAKELAARS STAAN ER VOLUIT BIJ, allemaal. Er stond er eerst een
   (`terugstorting`), en toen de tweede erbij kwam zou een bestuurder een
   vermogen dicht zien staan zonder ergens op het bord te kunnen zien welke knop
   dat doet. Een bord dat een gevolg toont zonder zijn oorzaak, stuurt iemand op
   zoek in de code.

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
      /* `terugstorting` blijft als eigen veld staan omdat de boardroom-schermen
         hem bij naam lezen; `standen` is de volledige kaart. */
      terugstorting: stand('terugstorting'),
      standen: Object.fromEntries([...new Set(Object.values(VERMOGENS)
        .map(f => f && f.hangtAf).filter(Boolean))].map(naam => [naam, stand(naam)])),
      regels: Object.keys(VERMOGENS).map(id => {
        const f = vermogen(id);
        const r = mag(id, { land });
        return { id, naam: f.naam, soort: f.soort, nodig: f.eigenNodig || f.nodig || null,
          partnerRail: f.partnerRail || null, mag: r.mag, reden: r.reden || null, via: r.via || null,
          besluit: f.besluit || null, hangtAf: f.hangtAf || null };
      })
    };
  };
