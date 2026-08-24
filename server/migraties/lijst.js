/* ============================================================================
   De migraties, op nummer. Een genummerde migratie wordt NOOIT gewijzigd nadat
   hij ergens heeft gedraaid -- dan zou dezelfde versie op twee installaties iets
   anders betekenen, en dat is precies de verwarring waar versienummers voor
   bestaan. Een vergissing corrigeer je met een NIEUW nummer.

   Elke migratie is bovendien idempotent geschreven (CREATE TABLE IF NOT EXISTS,
   kolommen alleen toevoegen als ze ontbreken). Dat is niet dubbelop met het
   grootboek maar de vangnet eronder: bestaande installaties draaiden dit schema
   al voor deze laag bestond, en die moeten migratie 1 kunnen "draaien" zonder
   dat er iets gebeurt.
   ========================================================================== */
'use strict';

/* Een kolom toevoegen als hij er nog niet is. SQLite kent geen
   ADD COLUMN IF NOT EXISTS, dus we kijken eerst. */
function voegKolomToe(db, tabel, naam, definitie) {
  const kolommen = db.prepare('PRAGMA table_info(' + tabel + ')').all().map(c => c.name);
  if (!kolommen.includes(naam)) db.exec('ALTER TABLE ' + tabel + ' ADD COLUMN ' + naam + ' ' + definitie);
}

/* ---------- 1: de accountlaag zoals hij was ---------- */
function accountsBasis(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_hash TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'rtg',
    codename TEXT,
    enc_name TEXT,
    enc_email TEXT,
    enc_phone TEXT,
    phone_hash TEXT,
    created_at TEXT NOT NULL,
    verified TEXT NOT NULL DEFAULT 'unverified',
    id_doc TEXT,
    member_state TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    reset_hash TEXT,
    reset_expires INTEGER
  )`);
  /* Voor databases die van voor de kolommen hierboven stammen. */
  for (const [n, d] of [['email_hash', 'TEXT'], ['enc_name', 'TEXT'], ['enc_email', 'TEXT'],
    ['enc_phone', 'TEXT'], ['phone_hash', 'TEXT'], ['verified', "TEXT NOT NULL DEFAULT 'unverified'"],
    ['id_doc', 'TEXT'], ['member_state', 'TEXT'], ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
    ['reset_hash', 'TEXT'], ['reset_expires', 'INTEGER']]) voegKolomToe(db, 'users', n, d);

  /* Inloggen op gebruikersnaam gebeurt hoofdletter-ongevoelig (lower(username)).
     De UNIQUE-index op username is hoofdlettergevoelig en kan die zoekopdracht
     niet bedienen, dus zonder deze expressie-index scant elke gebruikersnaam-
     login (en elke MISLUKTE login, die door de e-mail-tak heen valt) de hele
     tabel. Bij een miljoen leden is dat ~170 ms per poging; met de index < 1 ms. */
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(lower(username))');

  /* Ingetrokken sessietokens ("uitgelogd"). Sessietokens zijn staatloos
     ondertekend, dus er valt server-side niets weg te gooien bij uitloggen.
     Deze tabel is de tegenhanger; zie accounts/tokens.js. */
  db.exec(`CREATE TABLE IF NOT EXISTS ingetrokken_tokens (
    hash TEXT PRIMARY KEY,
    verloopt INTEGER NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS supplier_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_code TEXT NOT NULL,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`);
  for (const [n, d] of [['func', 'TEXT'], ['member_id', 'INTEGER'], ['member_tier', 'TEXT']])
    voegKolomToe(db, 'supplier_staff', n, d);
  db.exec('CREATE INDEX IF NOT EXISTS idx_staff_supplier ON supplier_staff(supplier_code)');
}

/* ---------- de lijst ----------

   De sso- en scim-tabellen krijgen hun definitie NIET hier maar in hun eigen
   module. Dat is met opzet: een tabeldefinitie hoort bij de code die hem
   gebruikt, anders lopen ze uit elkaar. De migratie roept die definitie aan en
   legt alleen vast DAT hij is gedraaid. De require staat in de functie zodat
   het laden van deze lijst geen halve serverstart wordt. */
const MIGRATIES = [
  { n: 1, naam: 'accounts-basis', op: accountsBasis },
  { n: 2, naam: 'sso-koppelingen-en-identiteiten', op: (db) => require('../sso').zorgTabel(db) },
  { n: 3, naam: 'scim-sleutels', op: (db) => require('../scim').zorgTabel(db) },
  /* De aan/uit-vlag op een account: uit dienst gemeld door de IdP van een klant
     moet elke lopende sessie meteen wegnemen. Zie accounts/tokens.js. */
  { n: 4, naam: 'account-actief', op: (db) => voegKolomToe(db, 'users', 'actief', 'INTEGER NOT NULL DEFAULT 1') },
  /* Een wachtwoordwijziging hoort ELKE lopende sessie te beeindigen. Tokens zijn
     hier staatloos, dus er valt niets weg te gooien; wat wel kan is een grens per
     account. Alles wat VOOR die grens is uitgegeven, geldt niet meer. Zonder dit
     bleef wie eenmaal binnen was dertig dagen binnen -- ook na een volledig
     herstel, en juist dan wil je hem eruit. Zie accounts/tokens.js. */
  { n: 5, naam: 'sessies-vanaf', op: (db) => voegKolomToe(db, 'users', 'sessies_vanaf', 'INTEGER NOT NULL DEFAULT 0') },
  /* De SAML-kant van de federatiepoort. De velden hangen aan de BESTAANDE
     koppelingtabel en niet aan een tweede: of een organisatie via OIDC of via
     SAML binnenkomt, is een eigenschap van die koppeling. Twee tabellen zouden
     betekenen dat dezelfde organisatie twee keer bestaat, met twee
     domeinlijsten die uiteen kunnen lopen -- en de domeinlijst IS de
     beveiliging (zie sso/koppelingen.js). */
  { n: 6, naam: 'saml-federatiepoort', op: (db) => require('../sso/saml').zorgTabel(db) }
];

module.exports = { MIGRATIES, voegKolomToe, accountsBasis };
