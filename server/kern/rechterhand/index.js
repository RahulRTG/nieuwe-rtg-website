/* Kern-module "rechterhand": de extra premium ROS-apps van de Lifestyle Pass,
   naast De Rechterhand-suite. Vier losse apps op hetzelfde prive-dossier per lid
   (db.data.lifestyle[key]): Reisboek (reisdossiers + draaiboek), Cellier (de
   wijnkelder met drinkvenster), Table (prive-diners en events) en Maison
   (huishouden en staf). Elke deelmodule krijgt dezelfde gedeelde helpers en een
   L(key) die het dossier opzet. Gedeelde context vanuit server.js. */
module.exports = ({ db, save, crypto, liveCodename }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const getal = (v, max) => Math.max(0, Math.min(max || 1e11, Math.round(Number(v) || 0)));

  // hetzelfde dossier als De Rechterhand; wij zorgen alleen dat onze vier lijsten bestaan
  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    const l = db.data.lifestyle[key];
    if (!Array.isArray(l.reizen)) l.reizen = [];
    if (!Array.isArray(l.cellier)) l.cellier = [];
    if (!Array.isArray(l.tables)) l.tables = [];
    if (!l.maison || typeof l.maison !== 'object') l.maison = { staf: [], taken: [], logboek: [] };
    return l;
  }

  const ctx = { db, save, rid, nu, schoon, isDatum, getal, L, liveCodename };
  return Object.assign({},
    require('./reisboek')(ctx),
    require('./cellier')(ctx),
    require('./table')(ctx),
    require('./maison')(ctx)
  );
};
