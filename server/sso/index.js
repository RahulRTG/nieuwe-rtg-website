/* ============================================================================
   Van een gecontroleerd ID-token naar een RTG-account.

   Alles hiervoor ging over "klopt dit token". Dit bestand gaat over de vraag
   daarna, en dat is de gevaarlijkere: WIE laten we hiermee binnen, en met welke
   rechten.

   DRIE REGELS DIE HIER NIET TE OMZEILEN ZIJN

   1. SSO GEEFT NOOIT EEN BETAALDE PAS. De merkregel is dat Lifestyle en Business
      uitsluitend na een MENSELIJK besluit worden verleend. Een inlog via de
      provider van een klant is geen menselijk besluit van RTG. Een nieuw account
      krijgt dus hooguit RTG -- precies zoals zelf-registreren (routes/auth/
      account.js) -- en van een BESTAAND account blijft de pas onaangeroerd. Er
      staat hier met opzet nergens een aanroep van accounts.setTier.

   2. HET E-MAILADRES MOET BEVESTIGD ZIJN DOOR DE PROVIDER. Een provider die zijn
      gebruikers zelf een adres laat intypen, mag hier niemand mee binnenhalen.
      Zonder `email_verified: true` weigeren we -- ook al klopt het token verder.

   3. HET DOMEIN MOET BIJ DE KOPPELING HOREN. Zie koppelingen.js: zonder die
      controle kan de provider van klant A een adres van klant B claimen.

   WAT DE KOPPELING WEL KAN, EN WAT DAT BETEKENT

   Staat een domein op de lijst van een koppeling, dan neemt die organisatie
   daarmee de zeggenschap over ELK account op dat domein over -- ook accounts die
   er al waren voordat de koppeling bestond. Dat is de bedoelde werking van
   domein-gebonden SSO (de organisatie is eigenaar van haar domein), maar het is
   wel de reden dat een domein pas op die lijst mag nadat is vastgesteld dat de
   organisatie het echt bezit. Dat is een menselijke controle, geen code.

   De echte naam uit het token gaat naar de KLUIS, niet naar de operationele
   kolommen: het codenaam-ontwerp geldt ook voor identiteiten die van buiten
   komen. Zie accounts/users.js -> schrijfUser.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const S = require('../accounts/state');
const koppelingen = require('./koppelingen');

function zorgTabel(db) {
  const d = db || S.db;
  koppelingen.zorgTabel(d);
  /* De koppeling tussen "wie is dit bij de provider" en "welk RTG-account".
     We matchen op `sub` en niet op e-mail: een e-mailadres verandert (huwelijk,
     naamswijziging, een andere afdeling), `sub` is juist het veld dat de
     provider belooft stabiel te houden. Matchen op e-mail alleen zou betekenen
     dat iemand na een adreswijziging een tweede account krijgt -- en dat het
     oude, met alle gegevens erin, achterblijft zonder eigenaar. */
  d.exec(`CREATE TABLE IF NOT EXISTS sso_identiteiten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    laatste_inlog TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (org, subject)
  )`);
  d.exec('CREATE INDEX IF NOT EXISTS idx_sso_ident_user ON sso_identiteiten(user_id)');
}

function vindIdentiteit(org, subject) {
  return S.db.prepare('SELECT * FROM sso_identiteiten WHERE org = ? AND subject = ?').get(String(org), String(subject)) || null;
}
function legVast(org, subject, userId) {
  const nu = new Date().toISOString();
  S.db.prepare(`INSERT INTO sso_identiteiten (org, subject, user_id, laatste_inlog, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(org, subject) DO UPDATE SET user_id = excluded.user_id, laatste_inlog = excluded.laatste_inlog`)
    .run(String(org), String(subject), Number(userId), nu, nu);
}
/* Alles wat een organisatie via SSO heeft binnengebracht. De SCIM-laag gebruikt
   dit straks om iemand die uit dienst gaat ook echt overal weg te halen. */
function identiteitenVan(org) {
  return S.db.prepare('SELECT * FROM sso_identiteiten WHERE org = ? ORDER BY created_at').all(String(org));
}

/* Een wachtwoord dat niemand kent en niemand nodig heeft.

   createUser eist er een. Een SSO-account hoort niet met een wachtwoord te
   werken -- de provider is de enige weg naar binnen. We zetten er dus een
   willekeurige van 32 bytes op die nergens wordt getoond of bewaard. Wil de
   gebruiker later toch een eigen wachtwoord, dan is de gewone herstelweg (per
   e-mail) de aangewezen route; die bewijst tenminste dat hij bij het adres kan. */
function onbruikbaarWachtwoord() { return crypto.randomBytes(32).toString('base64'); }

/* De hoofdingang. `accounts` komt binnen als parameter zodat tests er een
   eenvoudige dubbelganger voor kunnen zetten. */
async function aanmelden(accounts, koppeling, claims) {
  if (!koppeling || !koppeling.actief) throw new Error('Deze SSO-koppeling staat uit.');

  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) throw new Error('De provider stuurde geen e-mailadres mee; zonder adres kunnen we niemand koppelen.');
  if (claims.email_verified !== true)
    throw new Error('De provider bevestigt dit e-mailadres niet (email_verified staat niet op true).');

  const domein = koppelingen.domeinVan(email);
  if (!domein || !koppeling.domeinen.includes(domein))
    throw new Error('Het adres ' + email + ' valt buiten de domeinen van deze koppeling.');

  const subject = String(claims.sub);
  const naam = String(claims.name || claims.given_name || '').trim() || email.split('@')[0];

  /* 1. kennen we dit subject al? Dan is dat het account, ongeacht het adres. */
  const bekend = vindIdentiteit(koppeling.org, subject);
  if (bekend) {
    const u = accounts.getUserById(bekend.user_id);
    if (u) { legVast(koppeling.org, subject, u.id); return { user: u, nieuw: false, gekoppeld: false }; }
    // het account is verwijderd (AVG-vergetelheid); de oude verwijzing mag weg
    S.db.prepare('DELETE FROM sso_identiteiten WHERE org = ? AND subject = ?').run(koppeling.org, subject);
  }

  /* 2. bestaat er al een RTG-account op dit adres? Dan koppelen we daaraan.
     De pas van dat account blijft staan -- SSO verandert nooit iemands pas. */
  const bestaand = accounts.findByLogin(email);
  if (bestaand) {
    legVast(koppeling.org, subject, bestaand.id);
    return { user: bestaand, nieuw: false, gekoppeld: true };
  }

  /* 3. nieuw account. Hooguit RTG, nooit een betaalde pas (regel 1 hierboven). */
  const user = await accounts.createUser({
    email, username: null, password: onbruikbaarWachtwoord(),
    tier: 'rtg', realName: naam, phone: null
  });
  /* Het adres is door de provider bevestigd; dat is precies wat onze eigen
     bevestigingsmail ook zou vaststellen, dus die stap slaan we over. */
  if (typeof accounts.setEmailVerified === 'function') accounts.setEmailVerified(user.id);
  legVast(koppeling.org, subject, user.id);
  return { user: accounts.getUserById(user.id) || user, nieuw: true, gekoppeld: false };
}

module.exports = { zorgTabel, aanmelden, vindIdentiteit, legVast, identiteitenVan, onbruikbaarWachtwoord };
