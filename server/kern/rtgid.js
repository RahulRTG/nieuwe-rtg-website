/* RTG iD: de eigen digitale identiteit van het ecosysteem, gebouwd als
   DigiD-vervanger op de bestaande identiteitskluis. Beter, sneller,
   efficienter en veiliger door ontwerp:

   - Sneller: een dienst start een inlog en krijgt een koppelcode; het lid
     bevestigt met een tik in de eigen app (die al met passkey/inlog is
     beveiligd). Geen wachtwoord, geen sms.
   - Veiliger (phishing-bestendig): de code loopt van het scherm van de
     dienst NAAR het lid, en het lid ziet in de eigen app welke dienst er
     aanklopt en welke gegevens die vraagt, voor er iets gebeurt. Een
     opgevangen code is binnen twee minuten waardeloos; tokens staan
     alleen gehasht op de server en leven kort.
   - Efficienter (selectieve deling): een dienst krijgt alleen de gevraagde
     en toegestane attributen. Wie alleen "18 of ouder" hoeft te weten,
     krijgt een bewijs 18plus en nooit de geboortedatum.
   - Beter: een volledig inzagelog (wie vroeg wat, wanneer), actieve
     sessies die het lid per dienst kan intrekken, en machtigingen
     (mantelzorg): een ander mag tijdelijk namens u inloggen, herroepbaar,
     en elke inlog namens u staat in uw eigen log.

   Opslag in db.data.rtgid; maakRtgid(state) volgt het vaste kern-patroon. */

const KOPPEL_TTL_MS = 2 * 60 * 1000;      // een koppelcode leeft twee minuten
const SESSIE_TTL_MS = 20 * 60 * 1000;     // een iD-sessie bij een dienst: twintig minuten
const MAX_LOG = 100, MAX_KOPPELS = 300, MAX_SESSIES = 300;
const ATTRIBUTEN = ['codenaam', '18plus', 'leeftijd', 'nationaliteit', 'naam'];

function maakRtgid({ db, save, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam }) {
  const nu = () => Date.now();
  const iso = t => new Date(t == null ? Date.now() : t).toISOString();
  const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
  // de koppelcode zonder verwarrende tekens (geen O/0, I/1)
  const CODE_TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeMaak = () => 'ID-' + Array.from(crypto.randomBytes(5)).map(b => CODE_TEKENS[b % CODE_TEKENS.length]).join('');

  function S() {
    if (!db.data.rtgid || typeof db.data.rtgid !== 'object')
      db.data.rtgid = { koppels: [], sessies: [], logs: {}, machtigingen: [] };
    return db.data.rtgid;
  }
  const cap = (l, m) => { if (l.length > m) l.length = m; };
  function logVan(key) { const s = S(); if (!s.logs[key]) s.logs[key] = []; return s.logs[key]; }

  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  const codenaamUit = key => ((typeof gidsHaal === 'function' ? gidsHaal(key) : null) || {}).codename || 'lid';

  /* Selectieve deling: alleen de gevraagde attributen worden berekend en
     geleverd; 18plus is een afgeleid bewijs zonder de geboortedatum. */
  function attributenVoor(key, gevraagd) {
    const u = accountVanKey(key);
    const md = u ? (accounts.getMemberState(u.id) || {}) : {};
    const geboren = md.geboren || null;
    const lft = geboren && typeof leeftijdVan === 'function' ? leeftijdVan(geboren) : null;
    const uit = { geverifieerd: !!(u && u.verified === 'verified') };
    for (const a of gevraagd) {
      if (a === 'codenaam') uit.codenaam = codenaamUit(key);
      else if (a === '18plus') uit['18plus'] = lft != null ? lft >= 18 : null;
      else if (a === 'leeftijd') uit.leeftijd = lft;
      else if (a === 'nationaliteit') uit.nationaliteit = md.nationaliteit || null;
      else if (a === 'naam') uit.naam = u ? accounts.realNameOf(u) : null;
    }
    return uit;
  }

  /* ---- de dienst-kant: een inlog starten en de uitkomst ophalen ---- */
  function start(b) {
    const s = S();
    const dienst = schoon(b.dienst, 60);
    if (!dienst) return { status: 400, error: 'Welke dienst vraagt de inlog?' };
    const gevraagd = (Array.isArray(b.attributen) ? b.attributen : []).filter(a => ATTRIBUTEN.includes(a));
    if (!gevraagd.length) gevraagd.push('codenaam');
    const k = { id: 'k' + crypto.randomBytes(6).toString('hex'), code: codeMaak(), dienst,
      attributen: gevraagd, status: 'wacht', gemaakt: iso(), verloopt: nu() + KOPPEL_TTL_MS };
    s.koppels.unshift(k); cap(s.koppels, MAX_KOPPELS); save();
    return { status: 200, koppelId: k.id, code: k.code, dienst, attributen: gevraagd, verloopt: iso(k.verloopt) };
  }
  function statusVan(koppelId) {
    const s = S();
    const k = s.koppels.find(x => x.id === String(koppelId || ''));
    if (!k) return { status: 404, error: 'Deze inlog bestaat niet.' };
    if (k.status === 'wacht' && nu() > k.verloopt) { k.status = 'verlopen'; save(); }
    const uit = { status: 200, stand: k.status, dienst: k.dienst };
    // het token gaat precies een keer over de lijn en verdwijnt daarna
    if (k.status === 'bevestigd' && k.tokenEenmalig) { uit.idToken = k.tokenEenmalig; delete k.tokenEenmalig; save(); }
    return uit;
  }
  function wie(idToken) {
    const s = S();
    const h = hash(String(idToken || ''));
    const sess = s.sessies.find(x => x.tokenHash === h);
    if (!sess || sess.ingetrokken || nu() > sess.verloopt)
      return { status: 403, error: 'Deze iD-sessie is niet (meer) geldig.' };
    return { status: 200, dienst: sess.dienst, attributen: attributenVoor(sess.memberKey, sess.attributen),
      namens: sess.namens || undefined, verloopt: iso(sess.verloopt) };
  }

  /* ---- de app-kant: de code opzoeken, bevestigen of weigeren ---- */
  function koppelZoek(key, code) {
    const s = S();
    const c = schoon(code, 20).toUpperCase();
    const k = s.koppels.find(x => x.code === c && x.status === 'wacht');
    if (!k || nu() > k.verloopt) return { status: 404, error: 'Geen wachtende inlog met die code; codes leven twee minuten.' };
    // de machtigingen waarmee dit lid ook namens een ander kan inloggen
    const machtigingen = s.machtigingen.filter(m => m.naarKey === key && !m.ingetrokken && nu() <= m.tot)
      .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), dienst: m.dienst }));
    return { status: 200, koppelId: k.id, dienst: k.dienst, attributen: k.attributen, machtigingen };
  }
  function bevestig(key, koppelId, machtigingId) {
    const s = S();
    const k = s.koppels.find(x => x.id === String(koppelId || ''));
    if (!k || k.status !== 'wacht') return { status: 404, error: 'Deze inlog wacht niet (meer).' };
    if (nu() > k.verloopt) { k.status = 'verlopen'; save(); return { status: 410, error: 'De code is verlopen; laat de dienst een nieuwe tonen.' }; }
    let voorKey = key, namens = null;
    if (machtigingId) {
      const m = s.machtigingen.find(x => x.id === String(machtigingId));
      if (!m || m.naarKey !== key || m.ingetrokken || nu() > m.tot) return { status: 403, error: 'Deze machtiging is niet (meer) geldig.' };
      if (m.dienst !== k.dienst) return { status: 403, error: 'Deze machtiging geldt voor ' + m.dienst + ', niet voor ' + k.dienst + '.' };
      voorKey = m.vanKey; namens = codenaamUit(key);
    }
    const raw = crypto.randomBytes(24).toString('hex');
    const sess = { tokenHash: hash(raw), dienst: k.dienst, memberKey: voorKey, attributen: k.attributen,
      namens, gemaakt: iso(), verloopt: nu() + SESSIE_TTL_MS, ingetrokken: false };
    s.sessies.unshift(sess); cap(s.sessies, MAX_SESSIES);
    k.status = 'bevestigd'; k.tokenEenmalig = raw;
    const log = logVan(voorKey);
    log.unshift({ om: iso(), dienst: k.dienst, attributen: k.attributen,
      soort: namens ? 'inlog door gemachtigde ' + namens : 'inlog' });
    cap(log, MAX_LOG); save();
    return { status: 200, ok: true, dienst: k.dienst, namens: namens || undefined };
  }
  function weiger(key, koppelId) {
    const s = S();
    const k = s.koppels.find(x => x.id === String(koppelId || ''));
    if (!k || k.status !== 'wacht') return { status: 404, error: 'Deze inlog wacht niet (meer).' };
    k.status = 'geweigerd'; save();
    return { status: 200, ok: true };
  }

  /* ---- inzage en regie: het log, actieve sessies en intrekken ---- */
  function inzage(key) {
    const s = S();
    const t = nu();
    return { status: 200,
      log: logVan(key).slice(0, MAX_LOG),
      sessies: s.sessies.filter(x => x.memberKey === key && !x.ingetrokken && t <= x.verloopt)
        .map(x => ({ dienst: x.dienst, attributen: x.attributen, namens: x.namens || null, verloopt: iso(x.verloopt) })),
      machtigingen: s.machtigingen.filter(m => (m.vanKey === key || m.naarKey === key) && !m.ingetrokken && t <= m.tot)
        .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), naar: codenaamUit(m.naarKey), dienst: m.dienst, tot: iso(m.tot), ik: m.vanKey === key ? 'geef' : 'krijg' })),
      attributen: ATTRIBUTEN };
  }
  function intrek(key, dienst) {
    const s = S();
    const d = schoon(dienst, 60);
    let n = 0;
    for (const x of s.sessies) if (x.memberKey === key && x.dienst === d && !x.ingetrokken) { x.ingetrokken = true; n++; }
    const log = logVan(key);
    log.unshift({ om: iso(), dienst: d, attributen: [], soort: 'toegang ingetrokken' });
    cap(log, MAX_LOG); save();
    return { status: 200, ok: true, ingetrokken: n };
  }

  /* ---- machtigen (mantelzorg): tijdelijk, per dienst, herroepbaar ---- */
  async function machtig(key, b) {
    const s = S();
    const dienst = schoon(b.dienst, 60);
    const dagen = Math.round(Number(b.dagen));
    if (!dienst) return { status: 400, error: 'Voor welke dienst geldt de machtiging?' };
    if (!(dagen >= 1 && dagen <= 90)) return { status: 400, error: 'Een machtiging geldt 1 tot 90 dagen.' };
    let doelKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(schoon(b.codenaam, 60)) : null; doelKey = t && t.key; } catch (e) {}
    if (!doelKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doelKey === key) return { status: 400, error: 'Uzelf machtigen hoeft niet.' };
    const m = { id: 'm' + crypto.randomBytes(5).toString('hex'), vanKey: key, naarKey: doelKey,
      dienst, gemaakt: iso(), tot: nu() + dagen * 86400000, ingetrokken: false };
    s.machtigingen.unshift(m); cap(s.machtigingen, 200);
    const log = logVan(key);
    log.unshift({ om: iso(), dienst, attributen: [], soort: 'machtiging aan ' + codenaamUit(doelKey) + ' (' + dagen + ' dagen)' });
    cap(log, MAX_LOG); save();
    return { status: 200, ok: true, machtiging: { id: m.id, naar: codenaamUit(doelKey), dienst, tot: iso(m.tot) } };
  }
  function machtigIntrek(key, mId) {
    const s = S();
    const m = s.machtigingen.find(x => x.id === String(mId || ''));
    if (!m || (m.vanKey !== key && m.naarKey !== key)) return { status: 404, error: 'Machtiging niet gevonden.' };
    m.ingetrokken = true;
    // ook de lopende sessies die er op draaien gaan dicht
    for (const x of s.sessies) if (x.memberKey === m.vanKey && x.namens && !x.ingetrokken) x.ingetrokken = true;
    save();
    return { status: 200, ok: true };
  }

  return { rtgid: { start, statusVan, wie, koppelZoek, bevestig, weiger, inzage, intrek, machtig, machtigIntrek } };
}

module.exports = { maakRtgid };
