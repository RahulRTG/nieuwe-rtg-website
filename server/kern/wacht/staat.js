/* De Wacht, gedeelde staat en grenswaarden.

   Alles wat de vier taken (meters, afweer, hygiene, raadkamer) samen nodig
   hebben staat hier: de getallen waar het gedrag op draait, en de ene plek
   waar de opslag wordt opgezet. Zo staat een drempel op één plek in plaats van
   verspreid over de modules die hem gebruiken. */

const RING = 180;                       // metingen in de grafiek (~30 min bij 10s)
const QUARANTAINE_MS = 60 * 60000;      // een indringer een uur afgesneden
const RAAD_MAX = 100;                   // audit-staart van voorstellen
const OUD_BESLUIT_MS = 24 * 60 * 60000; // afgehandeld voorstel ouder dan een dag -> opruimbaar
const AANVAL_DREMPEL = 3;               // vanaf zoveel treffers stelt de AI afsnijden voor
const LASTAFWORP_MS = 2 * 60000;        // een getripte zekering blijft 2 min dicht en dooft dan vanzelf
const L7_DREMPEL = 3000;                // verzoeken/10s (aggregaat) waarboven de deur op een kier gaat
const TOP_AFSNIJDEN = 5;                // zoveel felste bronnen gaan bij een piek meteen in quarantaine
const RAND_VERS_MS = 5 * 60000;         // randverkeer jonger dan dit telt als "de eerste linie staat"

/* De enige acties die "accepteren" mag uitvoeren. Alles daarbuiten wordt
   geweigerd: de AI kan dus niets draaien wat hier niet expliciet in staat. Deze
   lijst is de grens tussen adviseren en besturen, en hoort daarom kort te
   blijven. */
const TOEGESTAAN = new Set(['quarantaine', 'vrij', 'hygiene', 'zekering', 'drempel', 'lastafworp']);

/* De opslag van de Wacht, met alle vakjes gegarandeerd aanwezig. Elke functie
   begint hiermee, zodat geen enkele plek hoeft te controleren of een lijst al
   bestaat. */
function maakW(db) {
  return function W() {
    if (!db.data.wacht) db.data.wacht = {};
    const w = db.data.wacht;
    if (!Array.isArray(w.grafiek)) w.grafiek = [];
    if (!w.quarantaine) w.quarantaine = {};       // bron -> { reden, sinds, tot }
    if (!Array.isArray(w.raad)) w.raad = [];      // voorstellen
    if (!w.hygiene) w.hygiene = { laatst: null, totaalOpgeruimd: 0 };
    if (!w.drempels) w.drempels = {};
    if (!w.lastafworp) w.lastafworp = { actief: false }; // automatische L7-zekering
    return w;
  };
}

module.exports = {
  RING, QUARANTAINE_MS, RAAD_MAX, OUD_BESLUIT_MS, AANVAL_DREMPEL,
  LASTAFWORP_MS, L7_DREMPEL, TOP_AFSNIJDEN, RAND_VERS_MS, TOEGESTAAN, maakW
};
