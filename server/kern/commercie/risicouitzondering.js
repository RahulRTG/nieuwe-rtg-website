/* DE UITZONDERINGSPROCEDURE VOOR ONOMKEERBARE GELDHANDELINGEN -- standaard DICHT.

   Eigenaarsbesluit 2B-aangepast (11 oktober 2026). Vanaf de omkeerbaarheidsgrens van
   ./besluit.js (BELEID.omkeerbaarBovenCenten) mag een geldhandeling alleen door als zij
   terug te draaien is. Een tweede handtekening veranderde dat tot die dag stil: de
   keuring na het aftekenen gaf `omkeerbaar: true` mee, ook voor een teruggave of een
   incassoronde die per definitie niet terug kan. Dat is eruit; een onomkeerbare
   handeling boven de grens wordt nu GEWEIGERD.

   Voor de gevallen waarin dat toch moet, is er deze procedure, en drie dingen liggen
   vast:
   - een RISICOGOEDKEURING is een eigen stap, op naam en met een reden, en zij is niet de
     tweede handtekening (die gaat over bevoegdheid, deze over risico);
   - zij beweert NOOIT dat de handeling omkeerbaar is -- de uitslag draagt
     `omkeerbaar: false` en de soort 'onomkeerbaar, uitzondering met risicogoedkeuring';
   - zij werkt alleen als de GRENDEL open staat, en die staat dicht. Er is met opzet nog
     geen schakelaar: de procedure wacht op een afzonderlijke goedkeuring van de
     eigenaar, en een knop bouwen die hij nog niet heeft goedgekeurd is hem alvast
     omzetten. Zonder grendel (de standaard) is het antwoord dicht, met de reden.

   Deze module beslist niets over bevoegdheid en verleent niets: zij zegt alleen of een
   risicogoedkeuring in deze stand GELDT. Het besluit blijft van ./besluit.js. */
'use strict';

const SOORT = 'onomkeerbaar, uitzondering met risicogoedkeuring';
/* DE WEG staat erbij, en hij is met opzet smal: afwijzen met de reden. Hier stond eerst
   ook "splits haar" en "handel het buiten het systeem af" -- dat is opknippen onder een
   controlegrens en geld buiten het spoor, precies wat deze grens moet voorkomen. */
const DICHT = 'De uitzonderingsprocedure voor onomkeerbare transacties staat dicht (eigenaarsbesluit ' +
  '2B-aangepast, 11 oktober 2026); de eigenaar heeft hem nog niet geopend. De weg nu: wijs de handeling ' +
  'af met die reden. Of zo\'n handeling toch door mag, is een besluit van de eigenaar.';

/* `grendel` is een functie die { open, reden } geeft, of niets -- en niets is dicht. */
function stand(grendel) {
  let g = null;
  try { g = typeof grendel === 'function' ? grendel() : null; } catch (e) { g = null; }
  return g && g.open === true ? { open: true, reden: g.reden || null } : { open: false, reden: DICHT };
}

function toets({ grendel, risico, actor, goedgekeurdDoor }) {
  const g = stand(grendel);
  if (!g.open) return { ok: false, reden: g.reden };
  const r = risico || null;
  const door = r && r.door ? String(r.door).slice(0, 60) : '';
  const reden = r && r.reden ? String(r.reden).trim().slice(0, 400) : '';
  if (!door || reden.length < 10)
    return { ok: false, reden: 'De uitzonderingsprocedure staat open, maar er is geen risicogoedkeuring op naam ' +
      'met een reden van ten minste tien tekens.' };
  if (actor != null && door === String(actor))
    return { ok: false, reden: 'Wie de handeling aanvraagt, geeft er niet zelf de risicogoedkeuring voor.' };
  /* En niet wie de tweede handtekening zette: die gaat over bevoegdheid, deze over
     risico, en twee vragen met een antwoord van dezelfde mens zijn er een. */
  if (goedgekeurdDoor != null && door === String(goedgekeurdDoor))
    return { ok: false, reden: 'Wie de tweede handtekening zette, geeft niet ook de risicogoedkeuring.' };
  return { ok: true, uitzondering: { soort: SOORT, door, reden, omkeerbaar: false } };
}

module.exports = { toets, stand, SOORT, DICHT };
