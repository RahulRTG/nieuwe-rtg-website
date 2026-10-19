/* RTG Pay: wat het lid hoort over een oplading die niet meteen rond is.
   Uit ./opladen.js gehaald (dat zat tegen de 10 kB), en met een reden erbij.

   EEN LOPENDE OPLADING IS NIET ONBEKEND. Bleef de bank hangen ("traag"), dan
   hoorde het lid "wacht op bevestiging" -- en bij DEZELFDE tik nog eens, of na
   een crash, een kale 502 "geen uitsluitsel". De betaalwaarheid wist het
   wel: de betaling stond vast en wachtte op de klant; alleen het navragen bij
   de rail mislukte (haalBetaling). Dat is geen nieuw nieuws, dus geen nieuwe
   uitkomst: de wachtzin blijft, en er start nooit een tweede oplading
   (test/dekking-hangend.test.js; gemeld door FoundationOS bij link:geven). */
'use strict';

const LOPEND = ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING'];
const WACHT = 'De betaling wacht op bevestiging.';

/* De zin bij de stand NA begin(): geweigerd is AF, niet onderweg. */
function zinNa(stand) {
  if (stand === 'GEWEIGERD' || stand === 'GEANNULEERD') return 'De betaling is niet gelukt. Er is niets afgeschreven en niets bijgeschreven.';
  if (stand === 'CONTROLE_NODIG') return 'De betaling ligt bij RTG ter controle. Betaal niet opnieuw.';
  return WACHT;
}

/* Het antwoord als begin() gooit. `alGestart`: de betaling had VOOR deze
   poging al een providerId -- dan liep hij al, en zegt een mislukte navraag
   niets nieuws. Anders weten we werkelijk niet wat de rail deed. */
function naFout(r, e, alGestart, id) {
  if (e && e.code === 'BETAAL_AFHANDELING_MISLUKT')
    return { status: 502, betalingId: id, error: 'De betaling is bevestigd maar nog niet bijgeschreven; dat gebeurt vanzelf.' };
  if (alGestart && r && LOPEND.includes(r.status))
    return { status: 402, betalingId: id, lopend: true, error: WACHT, betaalStatus: r.providerStatus || null };
  return { status: 502, betalingId: id, onbekend: true,
    error: 'De betaling gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.' };
}

module.exports = { zinNa, naFout, LOPEND };
