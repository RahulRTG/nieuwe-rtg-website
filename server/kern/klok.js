/* RTG Klok: wekkers en timers die op de SERVER aftellen, zoals de
   Thuiswacht -- valt je telefoon uit of zit de app dicht, dan gaat het
   alarm juist wel af (SSE naar het open scherm, webpush naar de zak).
   En omdat het gewone routes zijn, kan Rahul ze ook zetten: "maak me
   morgen om 7 uur wakker" is een aanroep, geen kunstje.

   De veegtimer kijkt elke 15 seconden en is unref'd: hij houdt geen
   test of afsluitend proces wakker. */

const MAX_WEKKERS = 20;
const MAX_TIMERS = 10;
const MAX_DUUR_S = 24 * 3600;

function maakKlok({ db, save, crypto, schoon, sseToCustomer, sendPushToUser }) {
  const id = () => 'k' + crypto.randomBytes(5).toString('hex');

  function bord(key) {
    if (!db.data.klok || typeof db.data.klok !== 'object') db.data.klok = {};
    const k = 'lid:' + key;
    if (!db.data.klok[k]) db.data.klok[k] = { wekkers: [], timers: [] };
    return db.data.klok[k];
  }
  function seintje(key, data) {
    try { sseToCustomer(key, 'klok', data); } catch (e) {}
    try { if (sendPushToUser) sendPushToUser(key, { title: data.titel, body: data.tekst, tag: 'klok' }); } catch (e) {}
  }

  function klokLijst(key) {
    const b = bord(key);
    return { wekkers: b.wekkers, timers: b.timers.map(t => ({ ...t,
      overS: t.af ? 0 : Math.max(0, Math.round((Date.parse(t.eindOp) - Date.now()) / 1000)) })) };
  }

  /* ---- wekkers: een tijd, optioneel vaste dagen (0=zondag..6=zaterdag) ---- */
  function klokWekker(key, { id: wid, tijd, dagen, label, aan, weg }) {
    const b = bord(key);
    if (wid && weg) { b.wekkers = b.wekkers.filter(w => w.id !== String(wid)); save(); return { ok: true }; }
    if (wid) {
      const w = b.wekkers.find(x => x.id === String(wid));
      if (!w) return { status: 404, error: 'Die wekker bestaat niet.' };
      if (aan !== undefined) w.aan = !!aan;
      if (tijd !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(tijd))) return { status: 400, error: 'Geef een tijd als 07:00.' }; w.tijd = tijd; }
      if (label !== undefined) w.label = schoon(String(label || ''), 60);
      if (dagen !== undefined) w.dagen = maakDagen(dagen);
      save();
      return { ok: true };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(tijd || ''))) return { status: 400, error: 'Geef een tijd als 07:00.' };
    if (b.wekkers.length >= MAX_WEKKERS) return { status: 409, error: 'U heeft al ' + MAX_WEKKERS + ' wekkers.' };
    const w = { id: id(), tijd, dagen: maakDagen(dagen), label: schoon(String(label || ''), 60),
      aan: true, laatstAf: null };
    b.wekkers.push(w); save();
    return { id: w.id };
  }
  const maakDagen = d => Array.isArray(d) ? [...new Set(d.map(Number).filter(x => x >= 0 && x <= 6))].sort() : [];

  /* ---- timers: een duur; de server rekent het einde uit en onthoudt het ---- */
  function klokTimer(key, { id: tid, duurS, label, weg }) {
    const b = bord(key);
    if (tid && weg) { b.timers = b.timers.filter(t => t.id !== String(tid)); save(); return { ok: true }; }
    duurS = Math.round(Number(duurS));
    if (!Number.isFinite(duurS) || duurS < 5 || duurS > MAX_DUUR_S)
      return { status: 400, error: 'Een timer loopt van 5 seconden tot 24 uur.' };
    if (b.timers.length >= MAX_TIMERS) return { status: 409, error: 'Er lopen al ' + MAX_TIMERS + ' timers.' };
    const t = { id: id(), label: schoon(String(label || ''), 60), duurS,
      eindOp: new Date(Date.now() + duurS * 1000).toISOString(), af: false, op: new Date().toISOString() };
    b.timers.push(t); save();
    return { id: t.id, eindOp: t.eindOp };
  }

  /* ---- de veegtimer: de server is de klok ---- */
  function veeg() {
    const nu = new Date();
    const hhmm = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
    const vandaag = nu.toISOString().slice(0, 10);
    const dag = nu.getDay();
    let anders = false;
    for (const k of Object.keys(db.data.klok || {})) {
      const key = k.replace(/^lid:/, '');
      const b = db.data.klok[k];
      for (const w of b.wekkers || []) {
        if (!w.aan || w.tijd !== hhmm || w.laatstAf === vandaag) continue;
        if (w.dagen.length && !w.dagen.includes(dag)) continue;
        w.laatstAf = vandaag;
        if (!w.dagen.length) w.aan = false;   // een losse wekker gaat een keer af
        anders = true;
        seintje(key, { kind: 'wekker', id: w.id, titel: 'Wekker', tekst: w.label || ('Het is ' + w.tijd + '.') });
      }
      for (const t of b.timers || []) {
        if (t.af || Date.parse(t.eindOp) > Date.now()) continue;
        t.af = true;
        anders = true;
        seintje(key, { kind: 'timer', id: t.id, titel: 'Timer', tekst: t.label || 'De timer is afgelopen.' });
      }
    }
    if (anders) save();
  }
  const timer = setInterval(veeg, 15000);
  if (timer.unref) timer.unref();

  return { klokLijst, klokWekker, klokTimer, klokVeeg: veeg };
}

module.exports = { maakKlok };
