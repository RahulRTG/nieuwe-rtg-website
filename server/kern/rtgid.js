/* RTG iD: de eigen digitale identiteit van het ecosysteem, gebouwd als
   DigiD-vervanger op de bestaande identiteitskluis. Beter, sneller,
   efficienter en veiliger door ontwerp:

   - Sneller: een dienst start een inlog en krijgt een koppelcode; het lid
     bevestigt in de eigen app met zijn passkey -- gezicht, vinger of pincode
     op het eigen toestel. Geen wachtwoord, geen sms.
   - Het is de PERSOON die bevestigt, niet het toestel. Een tik alleen bewees
     dat iemand de telefoon had waarop de sessie leeft; een geleend of gestolen
     toestel met een openstaande app kon dus een identiteit weggeven. De
     passkey-ceremonie hangt bovendien aan DEZE koppel, dus een opgevangen
     assertie past niet op een andere inlog. Zie bevestig() hieronder.
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

const { idVanKey } = require('../lib/lidsleutel');
const { bestaat } = require('./betrouwbaarheid');

const KOPPEL_TTL_MS = 2 * 60 * 1000;      // een koppelcode leeft twee minuten
const SESSIE_TTL_MS = 20 * 60 * 1000;     // een iD-sessie bij een dienst: twintig minuten
const MAX_LOG = 100, MAX_KOPPELS = 300, MAX_SESSIES = 300;
const ATTRIBUTEN = ['codenaam', '18plus', 'leeftijd', 'nationaliteit', 'naam'];

function maakRtgid({ db, save, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam, stapOp, passkeysVan }) {
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
    const id = idVanKey(key);
    if (id == null) return null;
    try { return accounts.getUserById(id); } catch (e) { return null; }
  }
  const codenaamUit = key => ((typeof gidsHaal === 'function' ? gidsHaal(key) : null) || {}).codename || 'lid';

  /* Wat een dienst te horen krijgt en waar dat op rust, staat apart in
     ./rtgid-claims.js: selectieve deling, het afgeleide 18plus-bewijs, de
     herkomst van de leeftijd en het betrouwbaarheidsniveau. Dit bestand gaat
     over WIE er aanklopt en of het lid akkoord gaat; dat over WAT er dan de
     deur uit mag. De gedeelde helpers gaan mee via de context. */
  const { niveauVoor, attributenVoor } = require('./rtgid-claims')({
    accounts, accountVanKey, codenaamUit, leeftijdVan });

  /* ---- de dienst-kant: een inlog starten en de uitkomst ophalen ---- */
  function start(b) {
    const s = S();
    const dienst = schoon(b.dienst, 60);
    if (!dienst) return { status: 400, error: 'Welke dienst vraagt de inlog?' };
    const gevraagd = (Array.isArray(b.attributen) ? b.attributen : []).filter(a => ATTRIBUTEN.includes(a));
    if (!gevraagd.length) gevraagd.push('codenaam');
    /* Een dienst mag een betrouwbaarheidsniveau eisen: niet alleen "is dit lid
       18+", maar "en hoe hard weet u dat". Een eis die niet bestaat wordt hier
       geweigerd en niet stil genegeerd -- anders is een typefout in de eis
       precies zo goed als geen eis, en faalt de strengste vraag het stilst. */
    const eis = b.minBetrouwbaarheid ? String(b.minBetrouwbaarheid) : null;
    if (eis && !bestaat(eis)) return { status: 400, error: 'Onbekend betrouwbaarheidsniveau: ' + eis + '.' };
    const k = { id: 'k' + crypto.randomBytes(6).toString('hex'), code: codeMaak(), dienst,
      attributen: gevraagd, eis, status: 'wacht', gemaakt: iso(), verloopt: nu() + KOPPEL_TTL_MS };
    s.koppels.unshift(k); cap(s.koppels, MAX_KOPPELS); save();
    return { status: 200, koppelId: k.id, code: k.code, dienst, attributen: gevraagd,
      minBetrouwbaarheid: eis, verloopt: iso(k.verloopt) };
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

  /* De app-kant -- de code opzoeken, bevestigen met een passkey, weigeren --
     staat in ./rtgid-bevestigen.js. Daar woont ook de passkey-eis zelf: dat is
     de enige plek waar een identiteit de deur uit gaat, en die plek hoort de
     eis te dragen. */
  const { koppelZoek, bevestig, weiger } = require('./rtgid-bevestigen')({
    S, save, nu, iso, crypto, schoon, hash, cap, logVan, codenaamUit, accountVanKey,
    niveauVoor, stapOp, passkeysVan, MAX_LOG, MAX_SESSIES, SESSIE_TTL_MS });

  /* Inzage, regie (intrekken) en de mantelzorg-machtigingen staan apart, in
     ./rtgid-regie.js; de gedeelde interne helpers gaan mee via de context. */
  const { inzage, intrek, machtig, machtigIntrek } = require('./rtgid-regie')({
    S, save, nu, iso, schoon, keyVanCodenaam, crypto, codenaamUit, logVan, cap, ATTRIBUTEN, MAX_LOG });

  return { rtgid: { start, statusVan, wie, koppelZoek, bevestig, weiger, inzage, intrek, machtig, machtigIntrek } };
}

module.exports = { maakRtgid };
