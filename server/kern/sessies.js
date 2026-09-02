/* De sessie-opslag als een `maak…(state)`-fabriek: een in-memory Map voor
   snelheid, gespiegeld in db.data.sessions zodat ingelogde gebruikers een
   serverherstart overleven. Alleen de sha256-hash van het token wordt bewaard;
   wie db.json in handen krijgt heeft daarmee nog geen bruikbare tokens. Sessies
   verlopen na 30 dagen zonder gebruik.

   De fabriek geeft de Map terug (`sessions`) zodat het herstel- en migratiepad
   in server.js er ongewijzigd op blijft werken; het gedrag is identiek aan de
   oude inline-versie. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const klok = require('../lib/klok');
// Hoeveel gelijktijdige sessies we bewaren. Vroeger stond dit hard op 400, wat
// bij een echte lancering de 401e ingelogde gebruiker de oudste eruit liet
// gooien (stille uitlog). Nu een productie-ruime, instelbare bovengrens die
// alleen als vangnet knijpt; verlopen sessies gaan sowieso eerst weg.
const MAX_SESSIONS = Math.max(400, Number(process.env.RTG_MAX_SESSIONS) || 50000);

function maakSessies({ db, save, crypto, sessieIngetrokken }) {
  const sessions = new Map(); // hash -> { tier, key, at, ... }
  const bron = crypto.randomBytes(12).toString('hex');
  const KANAAL = 'rtg:sessies:v1';
  let bus = null;
  let gekoppeld = false;

  function tokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }

  function geldigeHash(h) { return /^[a-f0-9]{64}$/.test(String(h || '')); }
  function geldigeSessie(sess) {
    if (!sess || typeof sess !== 'object' || Array.isArray(sess)) return false;
    if (!Number.isFinite(new Date(sess.at || 0).getTime())) return false;
    try { return Buffer.byteLength(JSON.stringify(sess)) <= 16 * 1024; }
    catch (e) { return false; }
  }

  function sessieBak() {
    if (!db.data.sessions || typeof db.data.sessions !== 'object' || Array.isArray(db.data.sessions)) db.data.sessions = {};
    return db.data.sessions;
  }

  function zend(actie, hash, sess) {
    if (!bus) return;
    /* Met een sessie erbij gaat er iets over een MENS de bus over; zonder
       alleen een hash die verdwijnt. Dat verschil hoort in de envelop. */
    bus.publish(KANAAL, Object.assign({ versie: 1, bron, actie, hash,
      envelop: { classificatie: sess ? 'persoonsgegeven' : 'intern' } }, sess ? { sess } : {}));
  }

  // Verwijder een hash uit beide opslagplaatsen (Map + snapshot).
  function verwijder(h, delen = false) {
    sessions.delete(h);
    delete sessieBak()[h];
    if (delen) zend('weg', h);
  }

  function rememberSession(token, sess) {
    sess.at = klok.datum().toISOString();
    /* ELKE SESSIE KRIJGT EEN IDENTITEIT (MIJN RTG blok 1). Voor een lid-token
       komt de sid uit het token zelf; hier moet hij worden gezet, want deze
       sessies bestaan alleen als record. Zonder sid kan een werksessie niet in
       "waar ben ik aanwezig" staan en dus ook niet worden gesloten -- en juist
       een werkplek op een gedeelde computer is er een die je wilt kunnen
       afsluiten. */
    if (!sess.sid) sess.sid = crypto.randomBytes(9).toString('base64url');
    const h = tokenHash(token);
    sessions.set(h, sess);
    sessieBak()[h] = sess;
    let toks = Object.keys(sessieBak());
    if (toks.length > MAX_SESSIONS) {
      // 1) verlopen sessies weg (die horen er toch niet meer te zijn)
      const nu = klok.nu();
      for (const t of toks) {
        if (t === h) continue; // de zojuist gezette sessie nooit
        if (nu - new Date(sessieBak()[t].at || 0).getTime() > TOKEN_TTL_MS) verwijder(t, true);
      }
      // 2) nog te veel? Dan als vangnet de oudste eruit (mag zelden gebeuren).
      toks = Object.keys(sessieBak());
      if (toks.length > MAX_SESSIONS) {
        toks.sort((a, b) => new Date(sessieBak()[a].at || 0) - new Date(sessieBak()[b].at || 0));
        for (const t of toks.slice(0, toks.length - MAX_SESSIONS)) verwijder(t, true);
      }
    }
    save();
    zend('zet', h, sess);
  }

  // hash is de map-sleutel (zie rememberSession); aanroepers geven de hash door
  function forgetSession(hash) {
    if (!geldigeHash(hash)) return;
    verwijder(hash, true);
    save();
  }

  // Centrale sessie-opzoeking: hasht het token, controleert het verloop en
  // schuift het venster op bij actief gebruik (hooguit eens per uur wegschrijven).
  function sessionFor(token) {
    if (!token) return null;
    const h = tokenHash(token);
    const sess = sessions.get(h);
    if (!sess) return null;
    const age = klok.nu() - new Date(sess.at || 0).getTime();
    if (age > TOKEN_TTL_MS) { forgetSession(h); return null; }
    /* EEN INTREKKING OP DE SID GELDT OOK HIER. Dit huis heeft twee soorten
       sessies (staatloos lid-token en dit record), en zonder deze regel zou
       "sluit deze sessie" alleen op de eerste soort werken -- terwijl het
       scherm ze naast elkaar toont. Een knop die op de ene rij werkt en op de
       andere niet, is erger dan geen knop. */
    if (sess.sid && typeof sessieIngetrokken === 'function' && sessieIngetrokken(sess.sid)) {
      forgetSession(h); return null;
    }
    if (age > 60 * 60 * 1000) {
      sess.at = klok.datum().toISOString();
      sessieBak()[h] = sess;
      save();
      zend('zet', h, sess);
    }
    return sess;
  }

  /* Redis is de snelle invalidatielaag, niet de autoriteit. Elk proces past
     een geldige mutatie meteen op zijn lokale index en databasespiegel toe;
     save() wordt hier bewust niet aangeroepen, anders zou ieder ontvangen
     bericht opnieuw een volledige gedeelde snapshot schrijven. */
  function koppelBus(nieuweBus) {
    if (gekoppeld || !nieuweBus || typeof nieuweBus.subscribe !== 'function' || typeof nieuweBus.publish !== 'function') return false;
    bus = nieuweBus;
    gekoppeld = true;
    bus.subscribe(KANAAL, bericht => {
      if (!bericht || bericht.versie !== 1 || bericht.bron === bron || !geldigeHash(bericht.hash)) return;
      if (bericht.actie === 'weg') {
        verwijder(bericht.hash, false);
      } else if (bericht.actie === 'zet' && geldigeSessie(bericht.sess)) {
        const sess = Object.assign({}, bericht.sess);
        sessions.set(bericht.hash, sess);
        sessieBak()[bericht.hash] = sess;
      }
    });
    return true;
  }

  /* Een Postgres/Redis-snapshot kan ook verwijderingen bevatten. Alleen
     ontbrekende entries toevoegen liet ingetrokken tokens in de Map leven;
     volledig herbouwen maakt de lokale index exact gelijk aan de bron. */
  function herbouwSessions() {
    const bronSessies = sessieBak();
    sessions.clear();
    for (const [h, sess] of Object.entries(bronSessies)) {
      if (geldigeHash(h) && geldigeSessie(sess)) sessions.set(h, sess);
    }
    return sessions.size;
  }

  return { sessions, tokenHash, rememberSession, forgetSession, sessionFor,
    koppelBus, herbouwSessions, TOKEN_TTL_MS };
}

module.exports = { maakSessies, TOKEN_TTL_MS };
