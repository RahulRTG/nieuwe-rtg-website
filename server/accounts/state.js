/* Gedeelde, LEVENDE staat van de accounts-laag. init() (in ./index) opent de
   SQLite-database en laadt de twee sleutels en zet ze hier neer; alle deelmodules
   (kluis, mirror, users, staff) lezen ze via dit object uit, zodat ze na init
   dezelfde handle en sleutels zien. Één proces, één set. */
/* VAULT is de OORSPRONKELIJKE kluissleutel en blijft gepind: de zoek-hashes op
   e-mail en telefoon (HMAC in ./kluis) zijn ermee berekend, en die staan in de
   database als opzoeksleutel. Roteerde die mee, dan zou niemand meer op zijn
   e-mailadres kunnen inloggen.

   RING is de keyring voor de VERSLEUTELING, nieuwste sleutel eerst. Zegelen gebeurt
   altijd met RING[0]; lezen probeert de sleutels op volgorde, zodat blobs van voor
   een rotatie gewoon opengaan. VAULT is altijd de laatste in de ring. Zonder
   rotatie is RING dus [VAULT] en gedraagt alles zich als voorheen. */
module.exports = { db: null, SECRET: null, VAULT: null, RING: null };
