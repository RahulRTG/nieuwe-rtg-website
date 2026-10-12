/* VERSHEID VAN DE SCHERMCONTEXT: wanneer de client het blikveld las (`op`, in
   milliseconden sinds 1970), en of dat nog zegt wat de mens NU voor zich heeft.

   Dit is een RELEVANTIEgrens en geen veiligheidsgrens. Een client die `op`
   weglaat, valt terug op het gedrag van voor 12 oktober 2026, en wat er van een
   object in de prompt komt wordt bij elke vraag opnieuw op de server gelezen
   (./menscontext-opzoek.js) -- een oude WAARDE kan via deze weg dus nooit
   binnenkomen, alleen een oude schermtitel. De ruimte naar voren vangt een klok
   die iets voorloopt; meer dan twee minuten is geen klok maar een verzinsel. */
'use strict';

const MAX_OUDERDOM_MS = 10 * 60 * 1000;
const MAX_VOORUIT_MS = 2 * 60 * 1000;

/* Geeft null als het leesmoment bruikbaar is, en anders de reden in woorden. */
function verouderd(opRuw, nu) {
  const op = Number(opRuw), t = nu != null ? nu : Date.now();
  if (!Number.isFinite(op)) return 'het leesmoment (op) is geen tijd';
  if (t - op > MAX_OUDERDOM_MS) return 'het schermbeeld is ouder dan tien minuten';
  if (op - t > MAX_VOORUIT_MS) return 'het leesmoment (op) ligt in de toekomst';
  return null;
}

module.exports = { verouderd, MAX_OUDERDOM_MS, MAX_VOORUIT_MS };
