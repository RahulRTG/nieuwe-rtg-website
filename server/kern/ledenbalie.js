/* Kern-module "ledenbalie": de derde poort van het kantoor, naast de gewone
   backoffice en de boardroom. Hier helpt een medewerker een LID -- zoeken,
   dossier inzien, een herstel-link in gang zetten, een klacht noteren, een
   ander abonnement voorstellen.

   Drie regels waar dit bestand op gebouwd is, en waarom:

   1. DE BALIE ZIET GEEN IDENTITEIT. Geen naam, geen e-mailadres, geen
      telefoonnummer, geen document. Wel de codenaam, de pas, land en stad, lid
      sinds, de abo-stand en de open klachten. Dat is niet zuinigheid maar het
      ontwerp: de operationele kant draait op codenamen, de echte naam ligt in
      de kluis (server/accounts/). Een balie die "even de naam" mag zien maakt
      die kluis waardeloos -- dan is er een tweede kopie, met een vriendelijker
      scherm ervoor.

   2. ELKE BLIK LAAT EEN SPOOR NA. Zoeken en dossier gaan door het bestaande
      inzagejournaal (server/inzagelog.js), met een reden die iets zegt. Er komt
      geen tweede journaal bij: twee sporen van dezelfde handeling lopen uiteen
      zodra iemand er een aanpast.

   3. DE BALIE VERLEENT NIETS. Geen wachtwoord zetten (dat doet het lid zelf via
      de bestaande herstelstroom), geen pas toekennen (dat is een menselijk
      besluit via /api/aanmelding/beslis). De balie helpt; ze beslist niet.

   Twee buurbestanden, elk langs een echte scheiding afgesplitst: wie er aan de
   balie mag zitten staat in ./ledenbalie-zetels.js (toegang), wat de balie zelf
   noteert in ./ledenbalie-zaken.js (eigen administratie, raakt de kluis niet).
   Hier blijft over wat WEL in de kluis kijkt. Beide worden doorgegeven, zodat
   de bedrading een keer require't. */
'use strict';

const crypto = require('crypto');
const inzagelog = require('../inzagelog');          // het bestaande spoor, geen tweede
const { maandCentenVoor } = require('./pasprijs');  // een antwoord op "wat kost een pas"

/* Een reden moet iets zeggen. De grens ligt laag maar niet op nul, want een
   verplicht veld dat je met een punt kunt vullen is geen verplicht veld. Op
   LETTERS en cijfers geteld en niet op tekens, anders is "........." zo tien
   tekens lang. Zelfde lijn als kern/payroll/identiteit.js. */
const REDEN_MIN = 10;
const PASSEN = ['gratis', 'rtg', 'lifestyle', 'business'];

module.exports = ({ db, save, accounts, onboarding, geldPasprijzen, magBoardroom, herstelStart }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const kort = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = s => String(s).replace(/[^\p{L}\p{N}]/gu, '').length;
  const wie = d => kort((d && d.naam) || (typeof d === 'string' ? d : '') || 'balie', 60);
  const pasVan = t => (t === 'guest' ? 'gratis' : (PASSEN.includes(t) ? t : 'rtg'));
  const redenOf = reden => { const r = kort(reden, 300); return inhoud(r) >= REDEN_MIN ? r : null; };
  const geenReden = { status: 400, error: 'Noteer waarvoor u dit doet. Het lid kan die reden later opvragen.' };
  const geenLid = { status: 404, error: 'Dit lid kennen we niet.' };
  function lidOf(id) {
    try { return id == null ? null : (accounts.getUserById(Number(id)) || null); } catch (e) { return null; }
  }

  const zetels = require('./ledenbalie-zetels')({ db, save, accounts, magBoardroom });
  const zaken = require('./ledenbalie-zaken')({ db, save, inzagelog,
    hulp: { nu, rid, kort, inhoud, wie, redenOf, lidOf, pasVan, PASSEN, REDEN_MIN, geenReden, geenLid } });

  /* DE STEUNCODE: waarmee een lid zich aan de balie meldt zonder zijn naam te
     noemen. Afgeleid uit de key plus een zout dat per installatie eenmalig
     wordt aangemaakt -- niet per lid opgeslagen, want dan was er een tweede
     lijst om te bewaren en te wissen. Het zout is er omdat een code die
     rechtstreeks uit het account-id volgt door iedereen na te rekenen is.

     Let op wat dit NIET is: een bewijs. De steuncode vindt iemand, hij
     bevestigt niemand. Alles wat erna komt (herstel, voorstel) loopt langs het
     lid zelf of langs een mens. */
  function zout() {
    if (!db.data.balieSteunZout) { db.data.balieSteunZout = crypto.randomBytes(16).toString('hex'); save(); }
    return db.data.balieSteunZout;
  }
  function steuncodeVan(key) {
    return 'RTG-' + crypto.createHash('sha256').update(zout() + '|' + String(key))
      .digest('hex').slice(0, 6).toUpperCase();
  }

  // de stad komt uit het onboardingprofiel, net als in kern/ledenregister.js
  function stadVan(key) {
    const p = ((onboarding && onboarding.store && onboarding.store().profielen) || {})[key];
    const w = p && p.velden && p.velden.woonplaats;
    return w ? String(w).trim() : null;
  }

  /* ---------- zoeken ---------- */
  /* Op codenaam of op steuncode. `door` hoort niet bij de zoekvraag maar bij
     het spoor: zonder wie er keek is een journaalregel een half antwoord. */
  function balieZoek({ codenaam, steuncode, door } = {}) {
    const c = kort(codenaam, 60).toLowerCase();
    const s = kort(steuncode, 20).toUpperCase().replace(/\s+/g, '');
    if (!c && !s) return { status: 400, error: 'Zoek op codenaam of op de steuncode van het lid.' };
    if (c && c.length < 2) return { status: 400, error: 'Geef minstens twee tekens van de codenaam.' };
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const treffers = rijen.filter(r =>
      (c && String(r.codename || '').toLowerCase().includes(c)) || (s && steuncodeVan(r.key) === s)
    ).slice(0, 20).map(r => {
      const u = lidOf(r.id);
      return { id: r.id, key: r.key, codename: r.codename || null, pas: pasVan(r.tier),
        land: r.land || null, stad: stadVan(r.key), sinds: (u && u.created_at) || null };
    });
    /* Een lijstscherm hoort als EEN regel in het journaal (zie noteerVeel);
       twintig losse regels per zoekopdracht verdrinken het echte signaal. */
    try {
      inzagelog.noteerVeel({ door, overIds: treffers.map(t => t.id),
        waarom: 'Ledenbalie: lid opzoeken', bron: 'ledenbalie/zoek' });
    } catch (e) {}
    return { ok: true, treffers };
  }

  /* ---------- dossier ---------- */
  function balieDossier(id, { door, reden } = {}) {
    const r = redenOf(reden);
    if (!r) return geenReden;
    const u = lidOf(id);
    if (!u) return geenLid;
    try {
      inzagelog.noteer({ door, over: { id: u.id, codenaam: u.codename }, waarom: r, bron: 'ledenbalie/dossier' });
    } catch (e) {}
    /* Veld voor veld opgebouwd, nooit een spread van de accountrij. Dat is het
       verschil tussen "we tonen deze acht dingen" en "we tonen alles wat er
       morgen aan kolommen bij komt" -- en die kolom is een keer het
       telefoonnummer. */
    return { ok: true, lid: {
      codename: u.codename || null,
      pas: pasVan(u.tier),
      land: (accounts.getMemberState ? (accounts.getMemberState(u.id) || {}) : {}).land || null,
      stad: stadVan('user-' + u.id),
      sinds: u.created_at || null,
      abo: aboVan(u),
      klachten: zaken.klachtenVan(u.id),
      steuncode: steuncodeVan('user-' + u.id)
    } };
  }

  function aboVan(u) {
    const pas = pasVan(u.tier);
    const passen = (() => { try { const p = geldPasprijzen && geldPasprijzen(); return (p && p.passen) || null; } catch (e) { return null; } })();
    const centen = maandCentenVoor(passen, pas);
    return { pas, pasNaam: (passen && passen[pas] && passen[pas].naam) || pas,
      opMaat: pas === 'business',                       // Business heeft geen bedrag: op maat
      maandbijdrage: centen == null ? null : Math.round(centen) / 100,
      status: pas === 'gratis' ? 'gratis app' : 'lopend',
      voorstellen: zaken.voorstellenVan(u.id) };
  }

  /* ---------- wachtwoordherstel ---------- */
  /* De balie zet GEEN wachtwoord en ziet het adres niet. Ze zet de bestaande
     stroom in gang (/api/auth/forgot in routes/auth/herstel.js): het lid krijgt
     zelf de link per e-mail en een code op zijn telefoon. Dat is meteen het
     antwoord op "hoe weet u dat u de rekeninghouder spreekt" -- dat weet de
     balie niet, en daarom komt het bericht bij het lid uit en niet hier.

     herstelStart komt uit de bedrading en krijgt de accountrij mee; die laag
     kent het adres (accounts.emailOf) en dit bestand daarom juist niet.
     Ontbreekt hij, dan zeggen we dat luid: een balie die denkt te hebben
     geholpen terwijl er niets is verstuurd, is erger dan een balie die
     weigert. */
  function balieHerstel(id, { door, reden } = {}) {
    const r = redenOf(reden);
    if (!r) return geenReden;
    const u = lidOf(id);
    if (!u) return geenLid;
    if (typeof herstelStart !== 'function')
      return { status: 500, error: 'De herstelstroom is niet aangesloten. Meld dit; er is niets verstuurd.' };
    try {
      inzagelog.noteer({ door, over: { id: u.id, codenaam: u.codename }, waarom: r, bron: 'ledenbalie/herstel' });
    } catch (e) {}
    try {
      const p = herstelStart(u);
      if (p && typeof p.catch === 'function') p.catch(e => console.error('[ledenbalie] herstel', e));
    } catch (e) {
      console.error('[ledenbalie] herstel', e);
      return { status: 500, error: 'Het herstelbericht kon niet worden verstuurd.' };
    }
    return { ok: true, verstuurd: true };
  }

  return {
    // toegang (./ledenbalie-zetels.js) en de eigen administratie (./ledenbalie-zaken.js)
    balieZetels: zetels.balieZetels, balieZetelZet: zetels.balieZetelZet,
    balieZetelWeg: zetels.balieZetelWeg, magBalie: zetels.magBalie,
    balieKlachtOpen: zaken.balieKlachtOpen, balieKlachtStatus: zaken.balieKlachtStatus,
    balieAboVoorstel: zaken.balieAboVoorstel,
    // het werk dat in de kluis kijkt
    balieZoek, balieDossier, balieHerstel,
    // zodat de app van het lid dezelfde steuncode toont als de balie zoekt
    balieSteuncode: steuncodeVan
  };
};
