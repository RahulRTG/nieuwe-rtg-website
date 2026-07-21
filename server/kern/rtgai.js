/* De RTG AI van het RTG Kantoor: een stuurman die het roer pas krijgt als
   twee dingen waar zijn. De fasen, bewust in deze volgorde:

   1. MEELEZEN   De AI doet niets. Hij leest alleen mee met al het verkeer
                 (methode, pad-domein, status) en telt wat hij ziet.
   2. TRAINEN    Uit het meelezen bouwt hij zijn gereedheid op: dekking
                 (hoeveel domeinen heeft hij gezien) en ervaring (hoeveel
                 verkeer). Elke trainingsronde schrijft hij in zijn journaal.
   3. KLAAR      Vindt hij zichzelf klaar (dekking en ervaring vol), dan
                 MELDT hij dat en vraagt om het roer. Hij neemt het NOOIT
                 zelf: de AI adviseert, de mens beslist. Dat is een
                 merkprincipe en staat hier hard in de code.
   4. AAN HET ROER  Pas na de knop in het RTG Kantoor draait hij door:
                 elke ronde leest hij verder mee EN doet hij het veilige
                 routinewerk (opruimen, bescherm-scan, reparatie-check via
                 de zelfzorg-laag), vlekkeloos en met een journaalregel per
                 ronde. De terug-knop geeft het roer weer aan de mens.

   Drempels en tempo zijn instelbaar (RTGAI_MS, RTGAI_DREMPEL_WAARNEMINGEN,
   RTGAI_DREMPEL_DOMEINEN) zodat tests en demo's snel kunnen schakelen. */

const DREMPEL_WAARNEMINGEN = Number(process.env.RTGAI_DREMPEL_WAARNEMINGEN || 2000);
const DREMPEL_DOMEINEN = Number(process.env.RTGAI_DREMPEL_DOMEINEN || 12);
const TRAIN_MS = Number(process.env.RTGAI_MS || 60000);

module.exports = ({ db, save, zelfzorgVan }) => {
  const S = () => {
    if (!db.data.rtgai || typeof db.data.rtgai !== 'object') {
      db.data.rtgai = { fase: 'meelezen', gestart: Date.now(), waarnemingen: 0, domeinen: {},
        fouten: 0, rondes: 0, roerSinds: null, roerRondes: 0, journaal: [] };
    }
    if (!Array.isArray(db.data.rtgai.journaal)) db.data.rtgai.journaal = [];
    return db.data.rtgai;
  };
  const schrijf = (tekst, soort) => {
    const s = S();
    s.journaal.unshift({ at: Date.now(), soort: soort || 'info', tekst: String(tekst).slice(0, 200) });
    if (s.journaal.length > 200) s.journaal.length = 200;
  };

  /* ---- 1. meelezen: goedkoop tellen, nooit iets doen ---- */
  function lees(methode, pad, status) {
    const s = S();
    const m = String(pad || '').match(/^\/api\/([a-z-]+)/);
    if (!m) return;
    s.waarnemingen += 1;
    s.domeinen[m[1]] = (s.domeinen[m[1]] || 0) + 1;
    if (status >= 500) s.fouten += 1;
    // bewust geen save() per verzoek; de trainingsronde bewaart
  }

  /* ---- 2+3. de trainingsronde: gereedheid opbouwen en klaar-melden ---- */
  function gereedheid() {
    const s = S();
    const dekking = Math.min(1, Object.keys(s.domeinen).length / DREMPEL_DOMEINEN);
    const ervaring = Math.min(1, s.waarnemingen / DREMPEL_WAARNEMINGEN);
    return { dekking, ervaring, procent: Math.round(Math.min(dekking, ervaring) * 100) };
  }
  function train(door) {
    const s = S();
    s.rondes += 1;
    const g = gereedheid();
    if (s.fase === 'meelezen') {
      if (g.procent >= 100) {
        s.fase = 'klaar-voor-roer';
        schrijf('Ik heb ' + s.waarnemingen + ' gebeurtenissen over ' + Object.keys(s.domeinen).length +
          ' domeinen meegelezen en ben er klaar voor. Het roer is aan u: de knop staat in het RTG Kantoor.', 'klaar');
      } else if (s.rondes % 5 === 1) {
        schrijf('Trainingsronde ' + s.rondes + ': ' + s.waarnemingen + ' waarnemingen, ' +
          Object.keys(s.domeinen).length + ' domeinen, gereedheid ' + g.procent + '%.', 'training');
      }
    }
    /* ---- 4. aan het roer: het veilige routinewerk, elke ronde ---- */
    if (s.fase === 'aan-het-roer' && db.writable !== false) {
      s.roerRondes += 1;
      const zz = zelfzorgVan ? zelfzorgVan() : null;
      const acties = [];
      try { const r = zz.opruim('rtg-ai'); acties.push('opgeruimd (' + ((r && r.acties && r.acties.length) || 0) + ')'); } catch (e) { acties.push('opruimen overgeslagen'); }
      try { const r = zz.bescherm('rtg-ai'); acties.push('beschermd (' + ((r && r.acties && r.acties.length) || 0) + ')'); } catch (e) { acties.push('bescherm-scan overgeslagen'); }
      schrijf('Roer-ronde ' + s.roerRondes + ': ' + acties.join(', ') + '. Alles draait door.', 'roer');
    }
    save();
    return { fase: s.fase, gereedheid: g, door: door || 'automaat' };
  }

  /* ---- de knop: alleen een MENS in het RTG Kantoor draait het roer ---- */
  function roerGeef(door) {
    const s = S();
    if (s.fase === 'aan-het-roer') return { status: 200, ok: true, al: true, fase: s.fase };
    if (s.fase !== 'klaar-voor-roer') {
      return { status: 400, error: 'De RTG AI is nog aan het meelezen (gereedheid ' + gereedheid().procent + '%). Hij meldt zich zodra hij er klaar voor is.' };
    }
    s.fase = 'aan-het-roer'; s.roerSinds = Date.now();
    schrijf('Het roer is mij gegeven door ' + String(door || 'het kantoor').slice(0, 40) + '. Ik draai het routinewerk automatisch door en blijf meelezen.', 'roer');
    save();
    return { status: 200, ok: true, fase: s.fase };
  }
  function roerTerug(door) {
    const s = S();
    if (s.fase !== 'aan-het-roer') return { status: 400, error: 'De RTG AI staat niet aan het roer.' };
    s.fase = 'klaar-voor-roer'; s.roerSinds = null;
    schrijf('Het roer is terug bij ' + String(door || 'het kantoor').slice(0, 40) + '. Ik lees weer alleen mee en blijf klaarstaan.', 'roer');
    save();
    return { status: 200, ok: true, fase: s.fase };
  }

  function status() {
    const s = S();
    const g = gereedheid();
    return { fase: s.fase, gestart: s.gestart, waarnemingen: s.waarnemingen,
      domeinen: Object.keys(s.domeinen).length, fouten: s.fouten, rondes: s.rondes,
      gereedheid: g, drempels: { waarnemingen: DREMPEL_WAARNEMINGEN, domeinen: DREMPEL_DOMEINEN },
      roerSinds: s.roerSinds, roerRondes: s.roerRondes, journaal: s.journaal.slice(0, 20) };
  }

  let timer = null;
  function autoStart() {
    if (!TRAIN_MS) return null;
    timer = setInterval(() => { try { train('automaat'); } catch (e) { /* nooit de server omtrekken */ } }, TRAIN_MS);
    if (timer.unref) timer.unref();
    return timer;
  }

  return { rtgai: { lees, train, status, roerGeef, roerTerug, autoStart } };
};
