/* DE STANDEN VAN EEN PARTNERAFREKENING OVER STRIPE CONNECT, en de enige
   overgangen die ertussen bestaan.

   Een gesloten tabel en geen `status = x` op willekeurige plekken: een
   uitbetaling die van `betaald` terug naar `onderweg` kan, laat een herhaalde of
   te late melding een afgerekend bedrag opnieuw in beweging zetten.

     aangevraagd   RTG heeft besloten af te rekenen; het partnersaldo is
                   gereserveerd. Er is nog niets bij Stripe.
     ingediend     de transfer naar het verbonden account staat. Het geld is
                   van het platform naar de partner zijn Stripe-saldo.
     onderweg      de payout van dat saldo naar de bank van de partner loopt.
     betaald       Stripe meldt de payout als betaald. Eindstand, op een na:
     teruggedraaid de transfer is teruggedraaid; het geld is terug bij het
                   platform. Kan ook NA betaald (Stripe staat dat toe; het saldo
                   van het verbonden account gaat dan negatief) -- en precies
                   daarom moet die overgang bestaan in plaats van te worden
                   genegeerd.
     mislukt       de transfer of de payout is definitief mislukt.
     geannuleerd   de payout is geannuleerd, of de aanvraag is vóór indienen
                   ingetrokken.

   WAT MISLUKT NA DE TRANSFER BETEKENT, want dat is de valkuil. Een payout die
   mislukt, laat het geld op het Stripe-saldo van de PARTNER staan, niet bij RTG.
   Uit het oogpunt van het grootboek van RTG is de transfer dan nog steeds
   gebeurd; er komt dus GEEN terugboeking, maar een bevinding (het geld staat bij
   de partner en niet op zijn bank). Alleen `teruggedraaid` en een mislukking
   vóór de transfer brengen geld terug naar RTG. */
'use strict';

const STANDEN = Object.freeze(['aangevraagd', 'ingediend', 'onderweg', 'betaald', 'teruggedraaid', 'mislukt', 'geannuleerd']);
const EIND = Object.freeze(['teruggedraaid', 'mislukt', 'geannuleerd']);

const OVERGANG = Object.freeze({
  aangevraagd: ['ingediend', 'mislukt', 'geannuleerd'],
  ingediend: ['onderweg', 'teruggedraaid', 'mislukt'],
  onderweg: ['betaald', 'mislukt', 'geannuleerd', 'teruggedraaid'],
  betaald: ['teruggedraaid'],
  teruggedraaid: [],
  mislukt: ['teruggedraaid'],
  geannuleerd: ['teruggedraaid']
});

/* Mag dit? Dezelfde stand is geen overgang maar een herhaling, en die is altijd
   veilig (`zelfde: true`): een tweede melding van dezelfde uitkomst verandert
   niets. */
function mag(van, naar) {
  if (!STANDEN.includes(van) || !STANDEN.includes(naar)) return { mag: false, reden: 'onbekende stand' };
  if (van === naar) return { mag: true, zelfde: true };
  return (OVERGANG[van] || []).includes(naar) ? { mag: true } : { mag: false, reden: van + ' -> ' + naar + ' bestaat niet' };
}

/* Het pad van een stand naar een latere, voor een melding die een tussenstap
   overslaat (een `payout.paid` voor een afrekening waarvan de payout-id bij een
   crash nooit is vastgelegd). Alleen VOORUIT langs de hoofdlijn; nooit via een
   eindstand. */
const HOOFDLIJN = ['aangevraagd', 'ingediend', 'onderweg', 'betaald'];
function pad(van, naar) {
  const a = HOOFDLIJN.indexOf(van), b = HOOFDLIJN.indexOf(naar);
  if (a < 0 || b < 0 || b <= a) return null;
  return HOOFDLIJN.slice(a + 1, b + 1);
}

module.exports = { STANDEN, EIND, OVERGANG, mag, pad };
