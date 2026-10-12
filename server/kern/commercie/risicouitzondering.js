/* DE UITZONDERINGSPROCEDURE VOOR ONOMKEERBARE GELDHANDELINGEN -- een gesloten
   toelating per handeling, en geen algemene schakelaar.

   Eigenaarsbesluit 2B-aangepast (11 oktober 2026). Vanaf de omkeerbaarheidsgrens van
   ./besluit.js gaat een geldhandeling alleen door als zij terug te draaien is (de tabel
   in ./geldomkeer.js). Een tweede handtekening maakt dat niet waar.

   Eigenaarsbesluit 2C (11 oktober 2026) opent deze procedure voor PRECIES EEN handeling:
   de incassoronde (`GELD_INNEN`, klasse geld-reeks). Daar mag een ronde boven de grens
   door met een expliciete RISICOGOEDKEURING. Voor alle andere handelingen -- ook de
   teruggave van een reis -- blijft zij dicht. Daarom is dit een LIJST en geen knop: een
   knop zou alles tegelijk openzetten, en een nieuwe regel in deze lijst is een nieuw
   besluit met een eigen bron.

   Drie dingen liggen vast:
   - een risicogoedkeuring is een eigen stap, op naam (de sleutel uit de sessie), met een
     reden, niet door de aanvrager en niet door wie de tweede handtekening zet;
   - zij geldt voor precies EEN voornemen, dus een ronde, en is niet herbruikbaar
     (../voornemen/keuring.js legt het voornemen erbij en weegt alleen de eigen);
   - zij beweert NOOIT dat de handeling omkeerbaar is: de uitslag draagt
     `omkeerbaar: false` en de soort 'onomkeerbaar, uitzondering met risicogoedkeuring'.

   Deze module verleent niets: zij zegt alleen of een risicogoedkeuring hier GELDT. */
'use strict';

const SOORT = 'onomkeerbaar, uitzondering met risicogoedkeuring';

/* DE TOELATING. Gesloten; elke regel noemt zijn besluit. */
const TOELATING = Object.freeze({
  GELD_INNEN: Object.freeze({ klasse: 'geld-reeks', bron: 'eigenaarsbesluit 2C, 11 oktober 2026',
    wat: 'een incassoronde boven de omkeerbaarheidsgrens, per ronde met een risicogoedkeuring' }),
});

/* DE WEG staat erbij, en hij is met opzet smal: afwijzen met de reden. Hier stond eerst
   ook "splits haar" en "handel het buiten het systeem af" -- dat is opknippen onder een
   controlegrens en geld buiten het spoor, precies wat deze grens moet voorkomen. */
const DICHT = 'De uitzonderingsprocedure voor onomkeerbare transacties staat voor deze handeling dicht ' +
  '(eigenaarsbesluit 2B-aangepast en 2C, 11 oktober 2026: alleen de incassoronde is toegelaten). De weg nu: ' +
  'wijs de handeling af met die reden. Of zo\'n handeling toch door mag, is een besluit van de eigenaar.';

function stand(handeling) {
  const t = TOELATING[String(handeling || '')];
  return t ? { open: true, bron: t.bron, reden: null } : { open: false, reden: DICHT };
}

/* Het antwoord voor ./besluit.js, met de zin erbij zodat het besluit hem niet hoeft op te
   bouwen: een weigering opent altijd met de grens en zegt dat deze handeling niet terug kan. */
function toets(v) {
  const r = toetsKaal(v);
  if (r.ok) return r;
  return { ok: false, reden: 'Vanaf ' + (v.grens || 'de omkeerbaarheidsgrens') + ' alleen als de handeling terug te draaien ' +
    'is, en deze is dat niet. ' + r.reden };
}

function toetsKaal({ handeling, risico, actor, goedgekeurdDoor }) {
  const g = stand(handeling);
  if (!g.open) return { ok: false, reden: g.reden };
  const r = risico || null;
  const door = r && r.door ? String(r.door).slice(0, 80) : '';
  const reden = r && r.reden ? String(r.reden).trim().slice(0, 400) : '';
  if (!door || reden.length < 10)
    return { ok: false, reden: 'Boven de grens vraagt deze handeling een risicogoedkeuring op naam met een reden van ' +
      'ten minste tien tekens (' + g.bron + '); die is er niet.' };
  if (actor != null && (door === String(actor) || (r.naam && r.naam === String(actor))))
    return { ok: false, reden: 'Wie de handeling aanvraagt, geeft er niet zelf de risicogoedkeuring voor.' };
  /* En niet wie de tweede handtekening zette: die gaat over bevoegdheid, deze over
     risico, en twee vragen met een antwoord van dezelfde mens zijn er een. */
  if (goedgekeurdDoor != null && door === String(goedgekeurdDoor))
    return { ok: false, reden: 'Wie de tweede handtekening zette, geeft niet ook de risicogoedkeuring.' };
  return { ok: true, uitzondering: { soort: SOORT, door, naam: r.naam || null, reden, bron: g.bron, omkeerbaar: false,
    zin: 'Onomkeerbaar, uitzondering met risicogoedkeuring van ' + (r.naam || door) + ' (' + g.bron + ').' } };
}

module.exports = { toets, stand, TOELATING, SOORT, DICHT };
