/* Gedeelde, LEVENDE staat van de opslaglaag. Het db-object (db.data is de
   werkkopie in het geheugen, db.writable bepaalt of dit proces schrijft) en de
   externe-wijziging-callback worden door alle deelmodules (opslag, sqlite,
   postgres, gidsen, tx, index) via dit ene object gedeeld, zodat ze na load()
   dezelfde data en hook zien. */
/* DB.DATA IS EEN ACCESSOR EN GEEN GEWOON VELD, en dat is het enige punt waar de
   begroting (../opzet/begroting.js) erbij kan.

   Er zijn ELF plekken die `db.data = ...` doen -- starten.js leest de snapshot,
   sqlite en geheugen laden hun stand, postgres en redis verversen na een externe
   wijziging. Op elk van die plekken een wikkel zetten zou elf plekken zijn die
   uiteen kunnen lopen (LAT.md regel 4). Hier is het er een: wie ook toekent, de
   wikkel gaat er automatisch omheen, en wie leest krijgt hem terug.

   DE WIKKEL IS DEZELFDE VOOR DEZELFDE DATA, dus `db.data === db.data` blijft
   kloppen en er ontstaan geen twee beelden van een ding. Zonder begroting
   (of als die module niet te laden is) gaat er niets omheen en is dit een gewoon
   veld met een omweg van een functieaanroep.

   WAT ER DOOR DIE WIKKEL GEBEURT staat in begroting.js: een collectie die door
   een KLEINERE wordt vervangen binnen een verzoek, wordt gewogen voordat hij
   landt. Alles anders gaat er ongemoeid doorheen. */
const db = { writable: process.env.RTG_ROL !== 'standby' };
let ruweData = null;
Object.defineProperty(db, 'data', {
  enumerable: true,
  configurable: true,
  get() { return ruweData; },
  set(v) {
    let bewaakt = v;
    try { bewaakt = require('../opzet/begroting').bewaak(v); }
    catch (e) { bewaakt = v; }   // de opslag komt op, met of zonder begroting
    ruweData = bewaakt;
  }
});
db.data = null;
let externCb = null;
module.exports = {
  db,
  getExternCb: () => externCb,
  // De kern zet hier een functie neer die na een externe wijziging draait (bijv.
  // de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
  setExternCb: (cb) => { externCb = cb; }
};
