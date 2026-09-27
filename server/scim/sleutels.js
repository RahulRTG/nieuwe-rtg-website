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

   EN HIJ VERVALT (CODECREDENTIALS.json, identity.scim_bearer_sleutel). Een
   sleutel met de volledige provisioning- en uitdienstmacht over een tenant
   geldt standaard 90 dagen en nooit langer dan 365; daarna draait de eigenaar
   een nieuwe. Gebruik wordt niet geteld maar begrensd door die vervaldatum,
   de rem per minuut op de SCIM-deur, de ene organisatie waar hij bij hoort en
   intrekken of draaien. Een sleutel van voor deze regel (vervalt_at leeg)
   vervalt op LEGACY_TOT: een werkende IdP breekt niet vandaag, en "nooit"
   bestaat niet meer -- die datum is een open besluit van de eigenaar.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const S = require('../accounts/state');

const PREFIX = 'rtgscim_';
const DAGEN_STANDAARD = 90;
const DAGEN_MAX = 365;
const LEGACY_TOT = '2026-12-31T23:59:59.000Z';
const vervaltVan = (r) => (r && r.vervalt_at) || LEGACY_TOT;

function zorgTabel(db) {
  (db || S.db).exec(`CREATE TABLE IF NOT EXISTS scim_sleutels (
    org TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    hint TEXT NOT NULL,
    laatst_gebruikt TEXT,
    created_at TEXT NOT NULL
  )`);
  /* vervalt_at komt er met migratie 11 bij (migraties/lijst.js) en niet hier:
     migratie 3 roept deze definitie aan en wordt nooit gewijzigd. */
}

/* Een dagtelling is een geheel getal van 1 tot DAGEN_MAX; weglaten geeft de
   standaard, en een ongeldige waarde wordt geweigerd en niet afgekapt. */
function geldigheid(dagen) {
  if (dagen == null || dagen === '') return DAGEN_STANDAARD;
  const d = Number(dagen);
  return Number.isInteger(d) && d >= 1 && d <= DAGEN_MAX ? d : null;
}

const hashVan = (sleutel) => crypto.createHash('sha256').update(String(sleutel)).digest('hex');

/* Een nieuwe sleutel draaien. Het antwoord bevat de sleutel in leesbare vorm --
   dit is het enige moment waarop dat gebeurt. */
function draai(org, opties) {
  const o = String(org || '').trim().toLowerCase();
  if (!o) throw new Error('Geef de organisatie op.');
  const dagen = geldigheid((opties || {}).dagen);
  if (!dagen) throw Object.assign(new Error('Een SCIM-sleutel geldt 1 tot ' + DAGEN_MAX + ' dagen.'), { status: 400 });
  const nu = Date.now();
  const vervalt = new Date(nu + dagen * 86400000).toISOString();
  const sleutel = PREFIX + crypto.randomBytes(32).toString('base64url');
  // de hint is genoeg om sleutels uit elkaar te houden, te weinig om te raden
  const hint = sleutel.slice(0, PREFIX.length + 4) + '...' + sleutel.slice(-4);
  S.huidigeDb().prepare(`INSERT INTO scim_sleutels (org, hash, hint, created_at, vervalt_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(org) DO UPDATE SET hash = excluded.hash, hint = excluded.hint,
    created_at = excluded.created_at, vervalt_at = excluded.vervalt_at, laatst_gebruikt = NULL`)
    .run(o, hashVan(sleutel), hint, new Date(nu).toISOString(), vervalt);
  return { org: o, sleutel, hint, vervalt };
}

function weg(org) {
  const o = String(org || '').trim().toLowerCase();
  const had = S.huidigeDb().prepare('SELECT org FROM scim_sleutels WHERE org = ?').get(o);
  if (!had) return false;
  S.huidigeDb().prepare('DELETE FROM scim_sleutels WHERE org = ?').run(o);
  return true;
}

function stand(org) {
  const r = S.huidigeDb().prepare('SELECT org, hint, laatst_gebruikt, created_at, vervalt_at FROM scim_sleutels WHERE org = ?')
    .get(String(org || '').trim().toLowerCase());
  return r ? { ...r, vervalt_at: vervaltVan(r), legacy: !r.vervalt_at,
    doel: 'scim-provisioning', scope: r.org } : null;
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
  const r = S.huidigeDb().prepare('SELECT org, hash, vervalt_at FROM scim_sleutels WHERE hash = ?').get(h);
  if (!r) return null;
  const a = Buffer.from(r.hash, 'hex'), b = Buffer.from(h, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!(Date.parse(vervaltVan(r)) > Date.now())) return null;   // verlopen = geen sleutel
  try { S.huidigeDb().prepare('UPDATE scim_sleutels SET laatst_gebruikt = ? WHERE org = ?').run(new Date().toISOString(), r.org); }
  catch (e) { /* de sleutel werkt; het bijhouden van het tijdstip mag falen */ }
  return r.org;
}

module.exports = { zorgTabel, draai, weg, stand, vanSleutel, PREFIX, DAGEN_STANDAARD, DAGEN_MAX, LEGACY_TOT };
