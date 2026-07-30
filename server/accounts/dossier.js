/* Accounts, deel "dossier": alles wat OM een account heen hangt in plaats van het
   account zelf. De ledeninhoud per persoon (het dossier: gesprekken, boekingen,
   facturen, geboortedatum), de identiteitsverificatie, de twee lijsten die het
   kantoor eruit leest, en de AVG-vergetelheid.

   Afgesplitst uit ./users.js, dat daarmee onder de 10 KB van keuringsregel 13
   komt. Zelfde patroon als ./tokens.js: dit deel krijgt getUserById mee en
   ./users.js exporteert de functies gewoon door, dus aanroepers blijven
   require('./users') (of accounts.js) gebruiken en merken niets.

   De kluiskolom member_state gaat via ./gebonden de database in: versleuteld EN
   gebonden aan de rij, zodat een dossier niet naar een ander lid te verplaatsen
   is. Selecteer daarom altijd `id` mee bij een member_state-query -- dat id is de
   helft van de context. */
const S = require('./state');
const gebonden = require('./gebonden');
const mirror = require('./mirror');

function maakDossier(getUserById) {
  /* ---------- ledeninhoud per persoon (eigen boekingen/betalingen) ---------- */
  function getMemberState(userId) {
    const row = S.db.prepare('SELECT id, member_state FROM users WHERE id = ?').get(userId);
    if (!row || !row.member_state) return null;
    try { return JSON.parse(gebonden.lees('member_state', row)); } catch (e) { return null; }
  }
  /* Het ledendossier gaat versleuteld de kolom in. Dat is geen luxe: hier staan
     de gesprekken met Rahul, de boekingen, de facturen en de geboortedatum, en
     ze staan in DEZELFDE rij als de identiteit. Bleef dit platte tekst, dan zou
     wie de accountdatabase in handen krijgt het hele dossier kunnen lezen, terwijl
     de naam ernaast wel versleuteld is. Dat maakt het codenaam-ontwerp waardeloos.
     De Postgres-spiegel kopieert de kolom ongewijzigd en erft de bescherming. */
  function saveMemberState(userId, obj) {
    S.db.prepare('UPDATE users SET member_state = ? WHERE id = ?').run(gebonden.zegel('member_state', userId, JSON.stringify(obj)), userId);
    mirror.markUser(userId);
  }

  /* ---------- identiteitsverificatie ---------- */
  function setVerification(userId, status, docFilename) {
    if (docFilename !== undefined) S.db.prepare('UPDATE users SET verified = ?, id_doc = ? WHERE id = ?').run(status, docFilename, userId);
    else S.db.prepare('UPDATE users SET verified = ? WHERE id = ?').run(status, userId);
    mirror.markUser(userId);
    return getUserById(userId);
  }
  function listByVerification(status) {
    return S.db.prepare('SELECT * FROM users WHERE verified = ? ORDER BY created_at DESC').all(status);
  }

  /* Gesprekken in de app per account, voor de concierge-inbox. */
  function conversations() {
    const rows = S.db.prepare('SELECT id, tier, codename, member_state FROM users WHERE member_state IS NOT NULL').all();
    return rows.map(r => {
      let md = {}; try { md = JSON.parse(gebonden.lees('member_state', r)) || {}; } catch (e) {}
      return { id: r.id, tier: r.tier, codename: r.codename, conversation: md.conversation || [], needsConcierge: !!md.needsConcierge };
    }).filter(x => x.conversation.length);
  }

  /* De leden voor het ledenregister (kantoor): codenaam, pas en de facetten
     (geslacht v/m/x, land) uit de member_state. Nooit de echte naam -- die blijft
     in de kluis. Begrensd (de boardroom leest een venster, geen miljoenen rijen);
     met een echt grootboek (Postgres) zou dit aggregatie-per-facet worden. */
  function ledenRegisterRijen(limit) {
    const n = Math.max(1, Math.min(Number(limit) || 5000, 20000));
    const rows = S.db.prepare('SELECT id, tier, codename, member_state FROM users ORDER BY codename ASC LIMIT ?').all(n);
    return rows.map(r => {
      let md = {}; try { md = r.member_state ? (JSON.parse(gebonden.lees('member_state', r)) || {}) : {}; } catch (e) {}
      const gs = String(md.geslacht || '').toLowerCase();
      return { id: r.id, key: 'user-' + r.id, tier: r.tier || 'rtg', codename: r.codename || null,
        geslacht: (gs === 'v' || gs === 'm' || gs === 'x') ? gs : null, land: md.land || null };
    });
  }

  /* AVG-vergetelheid: verwijdert het account definitief. Geeft de bestandsnaam
     van een eventueel geupload identiteitsdocument terug, zodat de server die
     ook van schijf kan wissen. */
  function deleteUser(id) {
    const u = getUserById(id);
    if (!u) return null;
    S.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    mirror.markDelete(id);
    return u.id_doc || null;
  }

  return { getMemberState, saveMemberState, setVerification, listByVerification,
    conversations, ledenRegisterRijen, deleteUser };
}

module.exports = { maakDossier };
