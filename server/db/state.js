/* Gedeelde, LEVENDE staat van de opslaglaag. Het db-object (db.data is de
   werkkopie in het geheugen, db.writable bepaalt of dit proces schrijft) en de
   externe-wijziging-callback worden door alle deelmodules (opslag, sqlite,
   postgres, gidsen, tx, index) via dit ene object gedeeld, zodat ze na load()
   dezelfde data en hook zien. */
const db = { data: null, writable: process.env.RTG_ROL !== 'standby' };
let externCb = null;
module.exports = {
  db,
  getExternCb: () => externCb,
  // De kern zet hier een functie neer die na een externe wijziging draait (bijv.
  // de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
  setExternCb: (cb) => { externCb = cb; }
};
