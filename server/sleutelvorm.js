/* ============================================================================
   DE CANONIEKE VORM VAN EEN IDEMPOTENTIESLEUTEL.

   Eigen module omdat betaal.js en muntbetaal.js hem allebei nodig hebben, en
   twee kopieen van een security-vergelijking vroeg of laat uiteenlopen -- dat is
   precies de fout die wet RTG-038 beschrijft, een laag hoger.
   ========================================================================== */
'use strict';

/* WAAROM DEZE VORM, EN WAAROM NORMALISEREN IN PLAATS VAN WEIGEREN.

   Wet RTG-038 op de geldketen, en hier is de schade het grootst: bij een token
   kost een tweede schrijfwijze toegang, hier kost hij een TWEEDE AFSCHRIJVING.

   De sleutel komt van de client. `idem` reist van de app via
   kern/pay/opladen.js ('pay-oplaad:' + codenaam + ':' + idem) hierheen, en gaat
   dan byte-exact naar twee vergelijkingen: onze eigen haalOp() en de
   idempotencyKey van de betaalprovider. Allebei kijken naar bytes. Dus:

       idem = "abc"      -> afschrijving
       idem = " abc"     -> tweede afschrijving, want andere bytes
       idem = "abc\n"    -> derde

   Een formulierveld dat een spatie meestuurt, een client die na een time-out
   opnieuw probeert met een net iets anders opgebouwde sleutel: dat is precies
   het geval waarvoor idempotentie bestaat, en het werkte niet.

   HIER NORMALISEREN WE, EN WEIGEREN WE NIET. Dat is de andere helft van de wet
   dan bij het sessietoken, en met opzet. Weigeren zou betekenen dat een retry
   met een spatie een FOUT krijgt -- terwijl de bedoeling van die retry juist is
   "doe dit niet nog een keer". Samenvoegen IS hier het gewenste gedrag: twee
   verzoeken die alleen in witruimte verschillen zijn hetzelfde verzoek. Bij een
   token is dat andersom: daar bestaat geen legitieme reden om er een spatie voor
   te zetten, dus daar is hard weigeren juist.

   NFC omdat Unicode twee schrijfwijzen voor hetzelfde teken kent (e + accent is
   dezelfde letter als de samengestelde vorm). Stuurtekens en een lege sleutel
   weigeren we wel: die zijn nooit bedoeld, en een lege sleutel zou stilzwijgend
   een verse willekeurige sleutel worden -- dus een tweede betaling.

   HOOFDLETTERS LATEN WE MET RUST, en dat is een besluit en geen vergeten regel.
   Case-vouwen zou "abc" en "ABC" samenvoegen, en dat is hier de gevaarlijke
   kant op: een sleutel is vaak base64 of hex uit een client, en daar zijn "aB"
   en "Ab" ECHT twee verschillende sleutels. Ze gelijkstellen betekent dat de
   tweede betaling stilzwijgend als herhaling wordt gezien en dus NIET gebeurt --
   geld dat niet aankomt, en niemand ziet een fout. Een dubbele afschrijving valt
   op en is terug te draaien; een betaling die stil verdwijnt niet. Bij twijfel
   dus liever twee sleutels dan een. */
function canoniekeSleutel(waarde) {
  const k = String(waarde == null ? '' : waarde).normalize('NFC').trim();
  if (!k || k.length > 255) return null;
  if (/[\u0000-\u001f\u007f]/.test(k)) return null;
  return k;
}

module.exports = { canoniekeSleutel };
