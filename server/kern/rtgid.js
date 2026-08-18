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
const { NIVEAUS, niveauVan, voldoet, bestaat } = require('./betrouwbaarheid');

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

  /* Het betrouwbaarheidsniveau van dit lid. Er wordt niets nieuws gevraagd of
     bewaard: kern/betrouwbaarheid.js geeft alleen een naam aan de stand die het
     ledendossier al draagt. */
  function niveauVoor(key) {
    const u = accountVanKey(key);
    const md = u ? (accounts.getMemberState(u.id) || {}) : {};
    return niveauVan({ account: u, verified: u && u.verified, faceMatch: md.faceMatch });
  }

  /* Selectieve deling: alleen de gevraagde attributen worden berekend en
     geleverd; 18plus is een afgeleid bewijs zonder de geboortedatum. */
  function attributenVoor(key, gevraagd) {
    const u = accountVanKey(key);
    const md = u ? (accounts.getMemberState(u.id) || {}) : {};
    const geboren = md.geboren || null;
    const lft = geboren && typeof leeftijdVan === 'function' ? leeftijdVan(geboren) : null;
    const uit = { geverifieerd: !!(u && u.verified === 'verified'),
      betrouwbaarheid: niveauVan({ account: u, verified: u && u.verified, faceMatch: md.faceMatch }) };
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

  /* ---- de app-kant: de code opzoeken, bevestigen of weigeren ---- */
  function koppelZoek(key, code) {
    const s = S();
    const c = schoon(code, 20).toUpperCase();
    const k = s.koppels.find(x => x.code === c && x.status === 'wacht');
    if (!k || nu() > k.verloopt) return { status: 404, error: 'Geen wachtende inlog met die code; codes leven twee minuten.' };
    // de machtigingen waarmee dit lid ook namens een ander kan inloggen
    const machtigingen = s.machtigingen.filter(m => m.naarKey === key && !m.ingetrokken && nu() <= m.tot)
      .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), dienst: m.dienst }));
    /* Hoeveel passkeys dit lid heeft, gaat mee. Bevestigen kan niet zonder, en
       een scherm dat dat pas bij de knop ontdekt, laat iemand tegen een dichte
       deur lopen zonder te zeggen welke sleutel eraan hoort. */
    const u = accountVanKey(key);
    /* De eis en of dit lid hem haalt, gaan allebei mee. Alleen de eis tonen zou
       het lid laten uitzoeken waar hij staat; alleen "kan niet" tonen laat hem
       raden waarom. */
    const mijn = niveauVoor(key);
    return { status: 200, koppelId: k.id, dienst: k.dienst, attributen: k.attributen, machtigingen,
      passkeys: typeof passkeysVan === 'function' ? passkeysVan(u) : 0, eigenAccount: !!u,
      minBetrouwbaarheid: k.eis || null, betrouwbaarheid: mijn, haaltEis: voldoet(mijn, k.eis) };
  }
  /* Bevestigen vraagt ALTIJD een passkey, en die eis staat HIER en niet in de
     route.

     Waarom hier: dit is de enige plek waar een iD-inlog wordt bevestigd. Zou de
     eis in routes/rtgid.js staan, dan draagt hij de deur en niet de handeling
     -- en de eerstvolgende die een tweede weg naar bevestigen bouwt (een
     scan-knop, een sneltoets, een AI-actie) heeft de eis stilletjes niet.

     Waarom een tik in de app niet genoeg was: die tik bewijst dat iemand het
     TOESTEL heeft waarop de sessie leeft. Een gestolen of geleende telefoon met
     een openstaande app kon dus een identiteit weggeven. De passkey bewijst de
     PERSOON, en de ceremonie is aan deze koppel gebonden (zie
     kern/webauthn.js), dus een assertie van elders past er niet op.

     Wat dit kost, en dat is bewust: een demo-persona of gast heeft geen eigen
     account en kan dus geen passkey maken. Die kan met RTG iD niet meer
     bevestigen, en krijgt dat met zoveel woorden te horen in plaats van een
     vage weigering. */
  async function bevestig(key, koppelId, machtigingId, bewijs) {
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
    /* De passkey van wie er STAAT, niet van wie hij vertegenwoordigt: bij een
       machtiging tekent de gemachtigde met zijn eigen sleutel. Anders zou een
       machtiging betekenen dat iemand met de biometrie van een ander bevestigt,
       en dat kan niet bestaan. */
    /* Het niveau van wie er GEDEELD wordt, niet van wie er staat: bij een
       machtiging vraagt de dienst zekerheid over de persoon wiens identiteit
       hij krijgt. En deze controle staat VOOR de passkey, want om iemands
       gezicht vragen voor een bevestiging die toch afvalt, is onbeleefd. */
    if (k.eis) {
      const n = niveauVoor(voorKey);
      if (!voldoet(n, k.eis)) {
        const eisNaam = (NIVEAUS.find(x => x.id === k.eis) || {}).naam || k.eis;
        return { status: 403, error: k.dienst + ' vraagt betrouwbaarheidsniveau ' + k.eis + ' (' + eisNaam +
          ')' + (namens ? ' voor de persoon namens wie u inlogt' : '') + '; u staat op ' + n.id + ' (' + n.naam + ').' };
      }
    }
    const ik = accountVanKey(key);
    if (!ik) return { status: 403, error: 'Bevestigen met RTG iD vraagt een passkey, en die hoort bij een eigen RTG-account. Een demo-persona of gast heeft er geen.' };
    if (typeof stapOp !== 'function') return { status: 500, error: 'De passkey-controle is niet aangesloten; bevestigen kan nu niet.' };
    const bewijsUit = await stapOp({ user: ik, doel: k.id, bewijs: bewijs || {} });
    if (!bewijsUit || bewijsUit.error) return bewijsUit || { status: 401, error: 'De passkey kon niet worden geverifieerd.' };
    /* De koppel kan tijdens de ceremonie zijn verlopen of door een tweede
       tabblad zijn afgehandeld; na een await is de eerdere controle een
       momentopname van daarnet. */
    if (k.status !== 'wacht') return { status: 409, error: 'Deze inlog is inmiddels afgehandeld.' };
    if (nu() > k.verloopt) { k.status = 'verlopen'; save(); return { status: 410, error: 'De code is tijdens het bevestigen verlopen; laat de dienst een nieuwe tonen.' }; }
    const raw = crypto.randomBytes(24).toString('hex');
    const sess = { tokenHash: hash(raw), dienst: k.dienst, memberKey: voorKey, attributen: k.attributen,
      namens, gemaakt: iso(), verloopt: nu() + SESSIE_TTL_MS, ingetrokken: false };
    s.sessies.unshift(sess); cap(s.sessies, MAX_SESSIES);
    k.status = 'bevestigd'; k.tokenEenmalig = raw;
    const log = logVan(voorKey);
    log.unshift({ om: iso(), dienst: k.dienst, attributen: k.attributen, met: 'passkey',
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

  /* Inzage, regie (intrekken) en de mantelzorg-machtigingen staan apart, in
     ./rtgid-regie.js; de gedeelde interne helpers gaan mee via de context. */
  const { inzage, intrek, machtig, machtigIntrek } = require('./rtgid-regie')({
    S, save, nu, iso, schoon, keyVanCodenaam, crypto, codenaamUit, logVan, cap, ATTRIBUTEN, MAX_LOG });

  return { rtgid: { start, statusVan, wie, koppelZoek, bevestig, weiger, inzage, intrek, machtig, machtigIntrek } };
}

module.exports = { maakRtgid };
