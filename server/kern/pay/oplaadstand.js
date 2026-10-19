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

/* DE ENE VERTALING VAN STAND NAAR ZIN, voor elk geldpad dat via de
   betaalwaarheid loopt (opladen, storten; directpay hoort hier ook).
   `wat` is het onderwerp in de zin ('betaling', 'storting'); de rest is gelijk,
   zodat drie plekken niet uit elkaar lopen. Geweigerd is AF, niet onderweg. */
const hoofd = (w) => 'De ' + (w || 'betaling');
function zinNa(stand, wat) {
  if (stand === 'GEWEIGERD' || stand === 'GEANNULEERD') return hoofd(wat) + ' is niet gelukt. Er is niets afgeschreven en niets bijgeschreven.';
  if (stand === 'CONTROLE_NODIG') return hoofd(wat) + ' ligt bij RTG ter controle. Betaal niet opnieuw.';
  return WACHT;
}

/* Het antwoord als begin() gooit. `alGestart`: de betaling had VOOR deze
   poging al een providerId -- dan liep hij al, en zegt een mislukte navraag
   niets nieuws. Anders weten we werkelijk niet wat de rail deed. */
function naFout(r, e, alGestart, id, wat) {
  if (e && e.code === 'BETAAL_AFHANDELING_MISLUKT')
    return { status: 502, betalingId: id, error: hoofd(wat) + ' is bevestigd maar nog niet bijgeschreven; dat gebeurt vanzelf.' };
  if (alGestart && r && LOPEND.includes(r.status))
    return { status: 402, betalingId: id, lopend: true, error: WACHT, betaalStatus: r.providerStatus || null };
  return { status: 502, betalingId: id, onbekend: true,
    error: hoofd(wat) + ' gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.' };
}

module.exports = { zinNa, naFout, LOPEND };
