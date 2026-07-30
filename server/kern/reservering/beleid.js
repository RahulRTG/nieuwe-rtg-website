/* Reserverings-beleid (kern/reservering): de gedeelde spelregels voor élke
   reservering op het platform, los van de sector die hem maakt.

   Drie afspraken, bewust:
   1) Bedenktijd. Een reservering is 24 uur lang niet definitief: de leverancier
      "wacht" die dag, en het lid kan in die tijd kosteloos annuleren. Daarna
      staat hij vast (definitief). Zo overhaast niemand iets, en houdt de zaak
      grip.
   2) Last-minute. Reserveert iemand voor een moment binnen 24 uur, dan is er
      geen bedenktijd - hij is meteen definitief (anders zou de bedenktijd
      voorbij het bezoek lopen). Kosteloos annuleren blijft, want het lid koos
      niet zelf voor "per direct".
   3) Per direct. Wie niet wil wachten, kan de bedenktijd overslaan: de
      reservering is meteen definitief. Maar wie hem daarna tóch annuleert,
      betaalt een kleine annuleer-straf (de prijs voor het overslaan). Bij een
      gewone of last-minute reservering is annuleren gratis.

   Los daarvan mag een zaak (bv. horeca) een aanbetaling vragen; tot die betaald
   is, blijft de reservering "wacht op aanbetaling". De betaling zelf loopt via
   de gewone Pay-laag, hier staan alleen de regels.

   Pure functies, geen state, geen afhankelijkheden - zo overal testbaar en
   herbruikbaar (horeca-tafels, care, activiteiten, ...). */

const UUR = 60 * 60 * 1000;
const BEDENKTIJD_MS = 24 * UUR;              // 24 uur aan de leverancierskant
const LASTMINUTE_MS = 24 * UUR;              // binnen 24u tot het bezoek = last-minute
const DIRECT_ANNULEER_BOETE_CENTEN = 100;    // €1 straf bij annuleren van een per-direct reservering

/* Het geplande moment (datum + tijd) als tijdstip in ms. Ontbreekt de tijd,
   dan nemen we het begin van de dag (defensief, nooit NaN doorgeven). */
function startTijd(datum, tijd) {
  const t = /^\d{2}:\d{2}$/.test(String(tijd || '')) ? tijd : '00:00';
  const ms = new Date(String(datum || '') + 'T' + t + ':00').getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isLastMinute(datum, tijd, nu) {
  const start = startTijd(datum, tijd);
  return start > 0 && (start - nu) <= LASTMINUTE_MS;
}

/* De begintoestand van een nieuwe reservering: welke velden het beleid eraan
   hangt. De aanroeper voegt ze samen met zijn eigen reservering-object. */
function beginToestand({ datum, tijd, perDirect, aanbetalingCenten, nu }) {
  const lastMinute = isLastMinute(datum, tijd, nu);
  const direct = !!perDirect || lastMinute;      // geen bedenktijd nodig
  const aanbetaling = Math.max(0, Math.round(aanbetalingCenten || 0));
  return {
    perDirect: !!perDirect,
    lastMinute,
    // 24u bedenktijd, tenzij per-direct of last-minute (dan meteen voorbij)
    bedenktijdTot: direct ? nu : nu + BEDENKTIJD_MS,
    definitief: direct,
    // aanbetaling: tot die binnen is, staat de reservering "in afwachting"
    aanbetalingCenten: aanbetaling,
    aanbetaald: aanbetaling === 0
  };
}

/* Sweep: laat een reservering waarvan de bedenktijd voorbij is definitief
   worden. Geeft true terug als er iets veranderde (dan hoeft de aanroeper maar
   één keer op te slaan). Muteert het object in-place. */
function rijp(reservering, nu) {
  if (reservering && !reservering.definitief && reservering.bedenktijdTot && nu >= reservering.bedenktijdTot) {
    reservering.definitief = true;
    return true;
  }
  return false;
}

/* De annuleer-straf in centen: alleen een per-direct reservering die de
   bedenktijd oversloeg kost iets. Een gewone (nog in bedenktijd of al rijp) of
   last-minute reservering annuleer je gratis. */
function annuleerBoeteCenten(reservering) {
  return (reservering && reservering.perDirect && !reservering.lastMinute) ? DIRECT_ANNULEER_BOETE_CENTEN : 0;
}

/* Wacht deze reservering nog op een aanbetaling? (dan is hij nog niet "hard"). */
function wachtOpAanbetaling(reservering) {
  return !!(reservering && reservering.aanbetalingCenten > 0 && !reservering.aanbetaald);
}

module.exports = {
  BEDENKTIJD_MS, LASTMINUTE_MS, DIRECT_ANNULEER_BOETE_CENTEN,
  startTijd, isLastMinute, beginToestand, rijp, annuleerBoeteCenten, wachtOpAanbetaling
};
