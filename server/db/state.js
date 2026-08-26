/* Gedeelde, LEVENDE staat van de opslaglaag. Het db-object (db.data is de
   werkkopie in het geheugen, db.writable bepaalt of dit proces schrijft) en de
   externe-wijziging-callback worden door alle deelmodules (opslag, sqlite,
   postgres, gidsen, tx, index) via dit ene object gedeeld, zodat ze na load()
   dezelfde data en hook zien.

   WRITABLE EN LEIDER ZIJN TWEE DINGEN, en dat is nieuw sinds de kleefroutering
   (server/trio-kleef.js). Tot dan viel het samen: er was precies EEN schrijvende
   server, dus "mag ik schrijven?" en "ben ik degene die de backup maakt?" was
   dezelfde vraag. In spreidingsmodus nemen alle gezonde servers verkeer aan en
   schrijven ze allemaal -- maar de klussen die per INSTALLATIE een keer horen te
   gebeuren (de backup, de zelfzorgautomaat, het routinewerk van de RTG-AI)
   blijven bij een. Anders trekken drie servers tegelijk aan dezelfde bestanden.

   Buiten spreidingsmodus zijn ze gelijk, en daarom staat er ook dezelfde
   beginwaarde: wie niets aanzet, merkt van dit onderscheid niets. */
const db = { data: null, writable: process.env.RTG_ROL !== 'standby', leider: process.env.RTG_ROL !== 'standby' };
let externCb = null;
module.exports = {
  db,
  getExternCb: () => externCb,
  // De kern zet hier een functie neer die na een externe wijziging draait (bijv.
  // de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
  setExternCb: (cb) => { externCb = cb; }
};
