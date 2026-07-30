/* ============================================================================
   De SCIM-sleutel van een organisatie: het wachtwoord waarmee de IdP van een
   klant onze provisioning-deur opendoet.

   Dit is een van de zwaarste geheimen in het hele systeem. Wie hem heeft, kan
   binnen die organisatie accounts aanmaken en uitzetten. Daarom:

   - Hij wordt EEN KEER getoond, bij het aanmaken, en daarna nooit meer. Wie
     hem kwijt is, draait een nieuwe. Een beheerscherm dat sleutels kan tonen,
     is een scherm dat sleutels lekt zodra iemand meekijkt.
   - In de database staat alleen een SHA-256 van de sleutel. Niet scrypt zoals
     bij wachtwoorden: een SCIM-sleutel is 32 willekeurige bytes en dus niet te
     raden, en hij wordt bij ELK verzoek van de IdP gecontroleerd -- scrypt zou
     die deur in een trage deur veranderen. Bij een menselijk wachtwoord ligt
     dat andersom, en daar staat scrypt dan ook.
   - Vergelijken gebeurt tijdveilig. Het verschil tussen "eerste teken fout" en
     "laatste teken fout" is meetbaar als je het niet doet.

   Een organisatie heeft er hoogstens een. Een nieuwe draaien vervangt de oude
   meteen -- dat is ook precies wat je wilt als je vermoedt dat hij gelekt is.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const S = require('../accounts/state');

const PREFIX = 'rtgscim_';

function zorgTabel(db) {
  (db || S.db).exec(`CREATE TABLE IF NOT EXISTS scim_sleutels (
    org TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    hint TEXT NOT NULL,
    laatst_gebruikt TEXT,
    created_at TEXT NOT NULL
  )`);
}

const hashVan = (sleutel) => crypto.createHash('sha256').update(String(sleutel)).digest('hex');

/* Een nieuwe sleutel draaien. Het antwoord bevat de sleutel in leesbare vorm --
   dit is het enige moment waarop dat gebeurt. */
function draai(org) {
  const o = String(org || '').trim().toLowerCase();
  if (!o) throw new Error('Geef de organisatie op.');
  const sleutel = PREFIX + crypto.randomBytes(32).toString('base64url');
  // de hint is genoeg om sleutels uit elkaar te houden, te weinig om te raden
  const hint = sleutel.slice(0, PREFIX.length + 4) + '...' + sleutel.slice(-4);
  S.db.prepare(`INSERT INTO scim_sleutels (org, hash, hint, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(org) DO UPDATE SET hash = excluded.hash, hint = excluded.hint,
    created_at = excluded.created_at, laatst_gebruikt = NULL`)
    .run(o, hashVan(sleutel), hint, new Date().toISOString());
  return { org: o, sleutel, hint };
}

function weg(org) {
  const o = String(org || '').trim().toLowerCase();
  const had = S.db.prepare('SELECT org FROM scim_sleutels WHERE org = ?').get(o);
  if (!had) return false;
  S.db.prepare('DELETE FROM scim_sleutels WHERE org = ?').run(o);
  return true;
}

function stand(org) {
  const r = S.db.prepare('SELECT org, hint, laatst_gebruikt, created_at FROM scim_sleutels WHERE org = ?')
    .get(String(org || '').trim().toLowerCase());
  return r || null;
}

/* Bij welke organisatie hoort deze sleutel? Geeft de org terug, of null.

   We zoeken op de hash en niet door de lijst te lopen: een gelijkheidsvraag op
   een primaire sleutel is constant qua tijd voor de aanvaller. De timingSafe-
   vergelijking daarna is de tweede laag, voor het geval de opslaglaag ooit iets
   anders doet. */
function vanSleutel(sleutel) {
  const s = String(sleutel || '');
  if (!s.startsWith(PREFIX) || s.length < PREFIX.length + 20) return null;
  const h = hashVan(s);
  const r = S.db.prepare('SELECT org, hash FROM scim_sleutels WHERE hash = ?').get(h);
  if (!r) return null;
  const a = Buffer.from(r.hash, 'hex'), b = Buffer.from(h, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { S.db.prepare('UPDATE scim_sleutels SET laatst_gebruikt = ? WHERE org = ?').run(new Date().toISOString(), r.org); }
  catch (e) { /* de sleutel werkt; het bijhouden van het tijdstip mag falen */ }
  return r.org;
}

module.exports = { zorgTabel, draai, weg, stand, vanSleutel, PREFIX };
