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
                 elke ronde leest hij verder mee en verantwoordt hij dat in
                 zijn journaal. Zelfzorg houdt een eigen opslaggrens en wordt
                 niet als los neveneffect gestart. De terug-knop geeft het
                 roer weer aan de mens.

   Drempels en tempo zijn instelbaar (RTGAI_MS, RTGAI_DREMPEL_WAARNEMINGEN,
   RTGAI_DREMPEL_DOMEINEN) zodat tests en demo's snel kunnen schakelen. */

const DREMPEL_WAARNEMINGEN = Number(process.env.RTGAI_DREMPEL_WAARNEMINGEN || 2000);
const DREMPEL_DOMEINEN = Number(process.env.RTGAI_DREMPEL_DOMEINEN || 12);
const TRAIN_MS = Number(process.env.RTGAI_MS || 60000);

module.exports = ({ db, save, bewerkCollectie }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/rtgai', bezit: { rtgai: 'kaart' } });
  const nieuw = () => ({ fase: 'meelezen', gestart: Date.now(), waarnemingen: 0, domeinen: {},
    fouten: 0, rondes: 0, roerSinds: null, roerRondes: 0, journaal: [] });
  const vul = (s) => {
    const basis = nieuw();
    for (const k of Object.keys(basis)) if (s[k] == null) s[k] = basis[k];
    if (!s.domeinen || typeof s.domeinen !== 'object') s.domeinen = {};
    if (!Array.isArray(s.journaal)) s.journaal = [];
    return s;
  };
  const S = () => {
    return vul(eigen.bak('rtgai', b => Object.assign(b, nieuw())));
  };
  const schrijf = (s, tekst, soort) => {
    s.journaal.unshift({ at: Date.now(), soort: soort || 'info', tekst: String(tekst).slice(0, 200) });
    if (s.journaal.length > 200) s.journaal.length = 200;
  };

  const legeTelling = () => ({ waarnemingen: 0, domeinen: {}, fouten: 0 });
  let wacht = legeTelling(), onderweg = null, autoBezig = null;
  const telToe = (s, tel) => {
    s.waarnemingen += tel.waarnemingen;
    s.fouten += tel.fouten;
    for (const k of Object.keys(tel.domeinen)) s.domeinen[k] = (s.domeinen[k] || 0) + tel.domeinen[k];
  };
  const telTerug = (tel) => {
    wacht.waarnemingen += tel.waarnemingen; wacht.fouten += tel.fouten;
    for (const k of Object.keys(tel.domeinen)) wacht.domeinen[k] = (wacht.domeinen[k] || 0) + tel.domeinen[k];
  };
  const neemTelling = () => { const tel = wacht; wacht = legeTelling(); return tel; };
  function beeld() {
    const opgeslagen = eigen.kijk('rtgai') || {};
    const s = vul(Object.assign(nieuw(), JSON.parse(JSON.stringify(opgeslagen))));
    if (onderweg) telToe(s, onderweg);
    telToe(s, wacht);
    return s;
  }

  /* ---- 1. meelezen: goedkoop tellen, nooit iets doen ---- */
  function lees(methode, pad, status) {
    const m = String(pad || '').match(/^\/api\/([a-z-]+)/);
    if (!m) return;
    wacht.waarnemingen += 1;
    wacht.domeinen[m[1]] = (wacht.domeinen[m[1]] || 0) + 1;
    if (status >= 500) wacht.fouten += 1;
  }

  /* ---- 2+3. de trainingsronde: gereedheid opbouwen en klaar-melden ---- */
  function gereedheidVan(s) {
    const dekking = Math.min(1, Object.keys(s.domeinen).length / DREMPEL_DOMEINEN);
    const ervaring = Math.min(1, s.waarnemingen / DREMPEL_WAARNEMINGEN);
    return { dekking, ervaring, procent: Math.round(Math.min(dekking, ervaring) * 100) };
  }
  const gereedheid = () => gereedheidVan(beeld());
  function trainStaat(s, door) {
    s.rondes += 1;
    const g = gereedheidVan(s);
    if (s.fase === 'meelezen') {
      if (g.procent >= 100) {
        s.fase = 'klaar-voor-roer';
        schrijf(s, 'Ik heb ' + s.waarnemingen + ' gebeurtenissen over ' + Object.keys(s.domeinen).length +
          ' domeinen meegelezen en ben er klaar voor. Het roer is aan u: de knop staat in het RTG Kantoor.', 'klaar');
      } else if (s.rondes % 5 === 1) {
        schrijf(s, 'Trainingsronde ' + s.rondes + ': ' + s.waarnemingen + ' waarnemingen, ' +
          Object.keys(s.domeinen).length + ' domeinen, gereedheid ' + g.procent + '%.', 'training');
      }
    }
    /* ---- 4. aan het roer: een aantoonbare ronde, zonder losse nevensave ---- */
    /* db.leider en niet db.writable: in spreidingsmodus schrijven alle servers,
       en dan zou het roer-routinewerk drie keer per ronde draaien. */
    if (s.fase === 'aan-het-roer' && db.leider !== false) {
      s.roerRondes += 1;
      schrijf(s, 'Roer-ronde ' + s.roerRondes +
        ': de zelfstandige zelfzorg blijft onder haar eigen veilige opslaggrens. Alles draait door.', 'roer');
    }
    return { fase: s.fase, gereedheid: g, door: door || 'automaat' };
  }

  function train(door) {
    if (typeof bewerkCollectie !== 'function') {
      const tel = neemTelling(), s = S();
      try { telToe(s, tel); const uit = trainStaat(s, door); save(); return uit; }
      catch (e) { telTerug(tel); throw e; }
    }
    if (autoBezig) return autoBezig.then(() => train(door));
    const tel = neemTelling(); onderweg = tel;
    let uit;
    try {
      uit = bewerkCollectie('rtgai', bron => { const s = vul(bron); telToe(s, tel); return trainStaat(s, door); });
    } catch (e) { onderweg = null; telTerug(tel); throw e; }
    if (!uit || typeof uit.then !== 'function') { onderweg = null; return uit; }
    autoBezig = Promise.resolve(uit).catch(e => { telTerug(tel); throw e; })
      .finally(() => { onderweg = null; autoBezig = null; });
    return autoBezig;
  }

  /* ---- de knop: alleen een MENS in het RTG Kantoor draait het roer ---- */
  function roerGeef(door) {
    const s = S();
    if (s.fase === 'aan-het-roer') return { status: 200, ok: true, al: true, fase: s.fase };
    if (s.fase !== 'klaar-voor-roer') {
      return { status: 400, error: 'De RTG AI is nog aan het meelezen (gereedheid ' + gereedheid().procent + '%). Hij meldt zich zodra hij er klaar voor is.' };
    }
    s.fase = 'aan-het-roer'; s.roerSinds = Date.now();
    schrijf(s, 'Het roer is mij gegeven door ' + String(door || 'het kantoor').slice(0, 40) + '. Ik draai het routinewerk automatisch door en blijf meelezen.', 'roer');
    save();
    return { status: 200, ok: true, fase: s.fase };
  }
  function roerTerug(door) {
    const s = S();
    if (s.fase !== 'aan-het-roer') return { status: 400, error: 'De RTG AI staat niet aan het roer.' };
    s.fase = 'klaar-voor-roer'; s.roerSinds = null;
    schrijf(s, 'Het roer is terug bij ' + String(door || 'het kantoor').slice(0, 40) + '. Ik lees weer alleen mee en blijf klaarstaan.', 'roer');
    save();
    return { status: 200, ok: true, fase: s.fase };
  }

  function status() {
    const s = beeld();
    const g = gereedheidVan(s);
    return { fase: s.fase, gestart: s.gestart, waarnemingen: s.waarnemingen,
      domeinen: Object.keys(s.domeinen).length, fouten: s.fouten, rondes: s.rondes,
      gereedheid: g, drempels: { waarnemingen: DREMPEL_WAARNEMINGEN, domeinen: DREMPEL_DOMEINEN },
      roerSinds: s.roerSinds, roerRondes: s.roerRondes, journaal: s.journaal.slice(0, 20) };
  }

  /* Andere kantoormotoren mogen hun eigen, aantoonbare stap in hetzelfde
     RTG-AI-journaal zetten. De tellingen blijven in de aparte RAM-batch; deze
     kleine journaalmutatie reist mee met de lopende requestcommit. */
  function noteer(tekst, soort) {
    schrijf(S(), tekst, soort);
    save();
    return true;
  }

  let timer = null;
  function autoStart() {
    if (!TRAIN_MS) return null;
    timer = setInterval(() => {
      try { const uit = train('automaat'); if (uit && typeof uit.catch === 'function') uit.catch(() => {}); }
      catch (e) { /* nooit de server omtrekken */ }
    }, TRAIN_MS);
    if (timer.unref) timer.unref();
    return timer;
  }

  return { rtgai: { lees, train, status, noteer, roerGeef, roerTerug, autoStart } };
};
