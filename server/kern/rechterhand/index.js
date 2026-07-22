/* Kern-module "rechterhand": de extra premium ROS-apps van de Lifestyle Pass,
   naast De Rechterhand-suite. Vier losse apps op hetzelfde prive-dossier per lid
   (db.data.lifestyle[key]): Reisboek (reisdossiers + draaiboek), Cellier (de
   wijnkelder met drinkvenster), Table (prive-diners en events) en Maison
   (huishouden en staf). Elke deelmodule krijgt dezelfde gedeelde helpers en een
   L(key) die het dossier opzet. Gedeelde context vanuit server.js. */
module.exports = ({ db, save, crypto, liveCodename, anthropic, DATA_DIR }) => {
  const fs = require('fs');
  const path = require('path');
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const getal = (v, max) => Math.max(0, Math.min(max || 1e11, Math.round(Number(v) || 0)));

  /* Versleuteling-at-rest voor de gevoeligste velden (Nalatenschap): waar iets
     ligt, contactgegevens en persoonlijke wensen. AES-256-GCM met een sleutel die
     apart in de datamap staat (lifestyle.key), buiten de database. Waarden krijgen
     een "enc:"-prefix; oude platte waarden blijven leesbaar (zachte migratie). */
  function laadSleutel() {
    const dir = DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const f = path.join(dir, 'lifestyle.key');
    try { if (fs.existsSync(f)) return fs.readFileSync(f); } catch (e) {}
    const k = crypto.randomBytes(32);
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, k, { mode: 0o600 }); } catch (e) {}
    return k;
  }
  const SLEUTEL = laadSleutel();
  function enc(text) {
    if (text == null || text === '') return text;
    try {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', SLEUTEL, iv);
      const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
      return 'enc:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    } catch (e) { return text; }
  }
  function dec(blob) {
    if (typeof blob !== 'string' || !blob.startsWith('enc:')) return blob;
    try {
      const buf = Buffer.from(blob.slice(4), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', SLEUTEL, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { return ''; }
  }

  // hetzelfde dossier als De Rechterhand; wij zorgen alleen dat onze lijsten bestaan
  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    const l = db.data.lifestyle[key];
    if (!Array.isArray(l.reizen)) l.reizen = [];
    if (!Array.isArray(l.cellier)) l.cellier = [];
    if (!Array.isArray(l.tables)) l.tables = [];
    if (!l.maison || typeof l.maison !== 'object') l.maison = { staf: [], taken: [], logboek: [] };
    if (!l.hangar || typeof l.hangar !== 'object') l.hangar = { toestellen: [], vluchten: [] };
    if (!Array.isArray(l.entourage)) l.entourage = [];
    if (!l.attenties || typeof l.attenties !== 'object') l.attenties = { relaties: [], giften: [] };
    return l;
  }

  const ctx = { db, save, rid, nu, schoon, isDatum, getal, L, liveCodename, enc, dec };
  const api = Object.assign({},
    require('./reisboek')(ctx),
    require('./cellier')(ctx),
    require('./table')(ctx),
    require('./maison')(ctx),
    require('./garderobe')(ctx),
    require('./mecenaat')(ctx),
    require('./nalatenschap')(ctx),
    require('./logboek')(ctx),
    require('./cercle')(ctx),
    require('./hangar')(ctx),
    require('./entourage')(ctx),
    require('./attenties')(ctx)
  );

  /* Rahul als adviseur binnen elke app (in de u-vorm) staat apart, in ./ai.js;
     die krijgt de opgebouwde api en de helpers mee. */
  api.rechterhandAI = require('./ai')({ api, anthropic, schoon });
  return api;
};
