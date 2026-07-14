/* De sessie-opslag als een `maak…(state)`-fabriek: een in-memory Map voor
   snelheid, gespiegeld in db.data.sessions zodat ingelogde gebruikers een
   serverherstart overleven. Alleen de sha256-hash van het token wordt bewaard;
   wie db.json in handen krijgt heeft daarmee nog geen bruikbare tokens. Sessies
   verlopen na 30 dagen zonder gebruik.

   De fabriek geeft de Map terug (`sessions`) zodat het herstel- en migratiepad
   in server.js er ongewijzigd op blijft werken; het gedrag is identiek aan de
   oude inline-versie. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Hoeveel gelijktijdige sessies we bewaren. Vroeger stond dit hard op 400, wat
// bij een echte lancering de 401e ingelogde gebruiker de oudste eruit liet
// gooien (stille uitlog). Nu een productie-ruime, instelbare bovengrens die
// alleen als vangnet knijpt; verlopen sessies gaan sowieso eerst weg.
const MAX_SESSIONS = Math.max(400, Number(process.env.RTG_MAX_SESSIONS) || 50000);

function maakSessies({ db, save, crypto }) {
  const sessions = new Map(); // hash -> { tier, key, at, ... }

  function tokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }

  // Verwijder een hash uit beide opslagplaatsen (Map + snapshot).
  function verwijder(h) { sessions.delete(h); delete db.data.sessions[h]; }

  function rememberSession(token, sess) {
    sess.at = new Date().toISOString();
    const h = tokenHash(token);
    sessions.set(h, sess);
    db.data.sessions[h] = sess;
    let toks = Object.keys(db.data.sessions);
    if (toks.length > MAX_SESSIONS) {
      // 1) verlopen sessies weg (die horen er toch niet meer te zijn)
      const nu = Date.now();
      for (const t of toks) {
        if (t === h) continue; // de zojuist gezette sessie nooit
        if (nu - new Date(db.data.sessions[t].at || 0).getTime() > TOKEN_TTL_MS) verwijder(t);
      }
      // 2) nog te veel? Dan als vangnet de oudste eruit (mag zelden gebeuren).
      toks = Object.keys(db.data.sessions);
      if (toks.length > MAX_SESSIONS) {
        toks.sort((a, b) => new Date(db.data.sessions[a].at || 0) - new Date(db.data.sessions[b].at || 0));
        for (const t of toks.slice(0, toks.length - MAX_SESSIONS)) verwijder(t);
      }
    }
    save();
  }

  // hash is de map-sleutel (zie rememberSession); aanroepers geven de hash door
  function forgetSession(hash) {
    sessions.delete(hash);
    if (db.data.sessions) { delete db.data.sessions[hash]; save(); }
  }

  // Centrale sessie-opzoeking: hasht het token, controleert het verloop en
  // schuift het venster op bij actief gebruik (hooguit eens per uur wegschrijven).
  function sessionFor(token) {
    if (!token) return null;
    const h = tokenHash(token);
    const sess = sessions.get(h);
    if (!sess) return null;
    const age = Date.now() - new Date(sess.at || 0).getTime();
    if (age > TOKEN_TTL_MS) { forgetSession(h); return null; }
    if (age > 60 * 60 * 1000) { sess.at = new Date().toISOString(); save(); }
    return sess;
  }

  return { sessions, tokenHash, rememberSession, forgetSession, sessionFor, TOKEN_TTL_MS };
}

module.exports = { maakSessies, TOKEN_TTL_MS };
