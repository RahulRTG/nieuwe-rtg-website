/* DE IDEM-LAAG VAN RTG PAY, en de poort voor nieuw werk erin.

   Idempotentie die een herstart overleeft: dezelfde knop twee keer indrukken
   (dubbeltik, haperend netwerk, retry) geeft exact hetzelfde antwoord en boekt
   nooit dubbel -- en dezelfde sleutel met een ANDER verzoek geeft een 409 in
   plaats van stil het oude antwoord. Zie ../../lib/idem.js.

   DUURZAAM: geld is de enige laag waar bevestigen voor duurzaamheid een belofte
   is die de opslag nog niet heeft gedaan. Boeking en idem-sleutel zitten al in
   EEN bundel (lib/idem.js); deze vlag maakt die bundel ook duurzaam
   (scripts/check.js regel 47 noemt dit bestand daarom).

   DE VRIJGAVEPOORT (./vrijgavepoort.js): elk NIEUW stuk werk in deze laag vraagt
   `geld.intern_saldo`, na het opzoeken van een herhaling en voor het werk. Niet
   in de waardepoort en niet in de boeking: daar komt ook de afwikkeling langs
   van geld dat al vaststond, en een noodstop houdt nieuw geld tegen zonder
   bevestigd geld te laten liggen. `vrijgave` mag een toets meegeven; standaard
   het ene exemplaar per proces.

   Uit ./index.js gehaald (keuringsregel 13): dat bestand is de MONTAGE van de
   laag, dit is EEN onderdeel ervan met een eigen belofte. */
'use strict';

module.exports = function maakIdemlaag({ d, save, bijeen, geldModus, vrijgave, betaal }) {
  const vrijgavePoort = require('./vrijgavepoort').maakPayVrijgave({ vrijgave, betaal });
  const metIdem = require('../../lib/idem')({ d, save, naam: 'payIdem', bijeen, duurzaam: true,
    sleutelPlicht: () => geldModus === 'motor', poort: vrijgavePoort.intern });
  return { metIdem, vrijgavePoort };
};
