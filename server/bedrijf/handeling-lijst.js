/* RTG Werk OS: DE TABEL met werkwoorden die de commandobalk mag voorstellen.

   Apart van ./handeling.js om dezelfde reden als rollen-register.js: dit is een
   lijst die je in een blik wilt overzien als je er een werkwoord bijzet, en dat
   bestand gaat over de werking eromheen.

   DE LIJST IS GESLOTEN, en dat is de kern. Er is geen algemene "voer maar uit":
   elke regel is een werkwoord dat iemand met dat recht ook met de hand had
   mogen doen, met de rechtencontrole en de samenvatting ernaast. Wie er een
   bijzet, schrijft ook de uitvoering in handeling.js -- er is met opzet geen
   generieke weg die elke nieuwe regel meteen uitvoerbaar maakt.

   DE ZEEF IS EEN REGEL EN GEEN MODEL. CLAUDE.md legt dat vast: controleerbare
   extractie gebruikt geen model. Wat de zeef niet begrijpt wordt geen plan, en
   dan komt er een eerlijk "dit begrijp ik niet" in plaats van een gok die
   iemand bevestigt omdat er nu eenmaal een knop staat. */
'use strict';

const HANDELINGEN = {
  'taak.maak': {
    recht: 'project', wat: 'een taak aanmaken',
    zeef: [/^(?:maak|zet|nieuwe?)\s+(?:een\s+)?taak[:\s]+(.{3,120})$/i, /^taak[:\s]+(.{3,120})$/i],
    velden: (m) => ({ titel: m[1].trim() }),
    samenvat: (v) => 'Een nieuwe taak "' + v.titel + '" in de kolom "te doen", op uw naam.',
    raakt: () => [{ soort: 'taak', wat: 'er komt er een bij' }]
  },
  'ticket.maak': {
    recht: 'service', wat: 'een serviceticket openen',
    zeef: [/^(?:maak|open|nieuwe?)\s+(?:een\s+)?ticket[:\s]+(.{3,120})$/i, /^ticket[:\s]+(.{3,120})$/i],
    velden: (m) => ({ titel: m[1].trim() }),
    samenvat: (v) => 'Een nieuw serviceticket "' + v.titel + '" met de standaard-SLA.',
    raakt: () => [{ soort: 'ticket', wat: 'er komt er een bij' }]
  }
};


module.exports = { HANDELINGEN };
