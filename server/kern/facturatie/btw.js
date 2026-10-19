/* Facturatie (deelmodule): het BTW-TARIEF van een factuur en van elke regel.
   Afgesplitst uit ./motor.js: de motor nummert, bewaart en boekt; dit is de
   fiscale vraag welk tarief er op een regel hoort, en die komt uit dezelfde
   bron als de maandboekhouding van de zaak (kern/fiscaal/tarief.js). Twee
   plekken die een tarief kennen, lopen uiteen (LAT.md regel 4). */
'use strict';
const REGELSOM = require('../regelsom');

module.exports = ({ db, scho }) => {
  /* HET TARIEF KOMT UIT DE FISCALE LAAG, niet uit een lijstje hier.
     Hier stond `LAAG_BTW_TYPES.includes(type) ? 9 : 21` -- twee vaste getallen
     die nergens naar het LAND van de zaak keken, terwijl de maandboekhouding
     van diezelfde zaak wel de landentabel gebruikte. Sal de Mar op Ibiza (land
     ES) boekte 10% en factureerde 9%. Zie de kop van kern/fiscaal/tarief.js. */
  const tarief = require('../fiscaal/tarief');
  const capsVan = (s) => { try { return db.capsVan(s); } catch (e) { return []; } };
  function standaardBtw(supplier) {
    if (!supplier) return tarief.tariefVan(null, 'standaard');
    return tarief.tariefVan(supplier, tarief.basisCat(supplier, capsVan(supplier)));
  }
  /* En PER REGEL, want een glas wijn in een restaurant is geen eten. Zonder
     deze stap zou de bon alles op het lage tarief zetten terwijl de boekhouding
     de bar apart telt -- dan lopen ze alsnog uiteen, alleen subtieler. */
  function regelBtw(supplier, omschrijving, basis) {
    return tarief.tariefVan(supplier, tarief.catVanItem(supplier, omschrijving, basis));
  }

  /* Reken de regels door. De som zelf staat in kern/regelsom.js, want de
     offertebouwer rekent hem ook -- en een offerte die anders afrondt dan de
     factuur die eruit voortkomt, is een verschil dat niemand kan uitleggen.
     Reist er een verkoper mee, dan krijgt de som een opzoeker die het tarief
     van elke regel uit de fiscale laag haalt (zie regelBtw hierboven); de
     berekening zelf blijft op die ene plek. */
  const verwerkRegels = (regels, btwStandaard, verkoper) => {
    const basis = verkoper ? tarief.basisCat(verkoper, capsVan(verkoper)) : null;
    const perRegel = basis ? (omschrijving) => regelBtw(verkoper, omschrijving, basis) : null;
    return REGELSOM.verwerkRegels(regels, btwStandaard, scho, perRegel);
  };
  return { standaardBtw, regelBtw, verwerkRegels };
};
