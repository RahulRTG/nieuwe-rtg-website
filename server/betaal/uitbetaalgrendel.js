/* Harde release-gate voor geld dat het huis ECHT verlaat (audit A-P0-02).

   Een uitbetaling of terugbetaling via een echte provider (Stripe, Mollie,
   Adyen) is standaard DICHT. De stand staat in het gecommitte register
   UITBETAALGATE.json en niet in een omgevingsvariabele: een beheerder kan hem
   dus niet per ongeluk aanzetten, en openen is een zichtbare wijziging in
   review. Zonder leesbaar register geldt dicht. Sandbox, simulatie en de
   Magnaat-testrail verplaatsen geen echt geld en vallen hier buiten.

   Openen mag pas als `bewijs` naar een bestaand dossier wijst
   (test/uitbetaalgrendel.test.js houdt dat vast). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const PAD = path.join(__dirname, '..', '..', 'UITBETAALGATE.json');

function stand() {
  try {
    const r = JSON.parse(fs.readFileSync(PAD, 'utf8'));
    if (r && r.open === true && r.bewijs) return { open: true };
    return { open: false, reden: (r && r.reden) || 'register zonder reden' };
  } catch (e) {
    return { open: false, reden: 'register UITBETAALGATE.json onleesbaar: dicht' };
  }
}

function eisOpen(kanaal) {
  const s = stand();
  if (s.open) return;
  const e = new Error('Echt geld uit het huis (' + kanaal + ') is gesloten: ' + s.reden + ' Er is niets verstuurd.');
  e.code = 'UITBETAALGRENDEL_DICHT';
  e.nietVerstuurd = true;
  throw e;
}

module.exports = { stand, eisOpen, PAD };
