/* ============================================================================
   De SAML-kant van de federatiepoort: opslag, het verzoek, en de twee dingen
   die een antwoord eenmalig maken.

   WAAROM DIT NIET IN sso/koppelingen.js STAAT. Een koppeling is een
   organisatie bij een provider; of dat via OIDC of via SAML loopt is een
   EIGENSCHAP van die koppeling en geen tweede soort. De tabel krijgt daarom
   kolommen erbij en geen tweede tabel ernaast -- anders bestaat er straks een
   organisatie die twee keer bestaat en waarvan de domeinlijsten uiteenlopen.
   Dat is dezelfde regel die de tenantlaag draagt: geen vierde identiteitsmodel.

   TWEE TABELLEN DIE ALLEEN MAAR NEE ZEGGEN

   1. `saml_verzoeken` -- wat WIJ hebben gestuurd. Zonder deze tabel is er geen
      InResponseTo om tegen te controleren, en dan is elke assertie die ergens
      is opgevangen hier opnieuw bruikbaar. Een rij wordt bij gebruik meteen
      verwijderd: een verzoek is voor een keer.

      Dit sluit de ONGEVRAAGDE inlog af (IdP-initiated SSO). Dat model bestaat
      en sommige providers bieden het aan; het valt hier af omdat het precies de
      controle weghaalt die een gestolen assertie waardeloos maakt. Wie het ooit
      wil, bouwt het als een aparte, expliciet aangezette stand -- niet door
      deze controle zachter te maken.

   2. `saml_gebruikt` -- welke asserties al zijn ingewisseld. Een assertie mag
      binnen zijn geldigheidsduur maar EEN keer werken. De rijen vervallen
      vanzelf zodra de assertie zelf verlopen is; ze worden bij elke inlog
      opgeruimd, want een tabel die alleen groeit is een lek dat zich als een
      voorziening voordoet.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const zlib = require('zlib');
const S = require('../../accounts/state');

function zorgTabel(db) {
  const d = db || S.db;
  /* De SAML-velden hangen aan de bestaande koppelingtabel. ADD COLUMN faalt
     als de kolom er al is; dat is hier de normale toestand en geen fout. */
  for (const kolom of ['soort TEXT NOT NULL DEFAULT \'oidc\'', 'saml_entity_id TEXT',
    'saml_sso_url TEXT', 'saml_cert TEXT']) {
    try { d.exec('ALTER TABLE sso_koppelingen ADD COLUMN ' + kolom); } catch (e) { /* stond er al */ }
  }
  d.exec(`CREATE TABLE IF NOT EXISTS saml_verzoeken (
    id TEXT PRIMARY KEY, org TEXT NOT NULL, terug TEXT, tot INTEGER NOT NULL)`);
  d.exec(`CREATE TABLE IF NOT EXISTS saml_gebruikt (
    assertie_id TEXT NOT NULL, org TEXT NOT NULL, tot INTEGER NOT NULL,
    PRIMARY KEY (assertie_id, org))`);
}

const VERZOEK_MS = 600000;               // tien minuten, net als de OIDC-state

/* Een SAML-ID moet met een letter of _ beginnen; een kaal hex-getal mag niet. */
function nieuwId() { return '_' + crypto.randomBytes(20).toString('hex'); }

function bewaarVerzoek(org, terug) {
  const id = nieuwId();
  S.db.prepare('DELETE FROM saml_verzoeken WHERE tot < ?').run(Date.now());
  S.db.prepare('INSERT INTO saml_verzoeken (id, org, terug, tot) VALUES (?, ?, ?, ?)')
    .run(id, String(org), String(terug || '/'), Date.now() + VERZOEK_MS);
  return id;
}
/* Ophalen EN meteen weghalen: een verzoek is voor een keer. Twee antwoorden op
   hetzelfde verzoek is per definitie een herhaling. */
function neemVerzoekBijId(id) {
  const r = S.db.prepare('SELECT * FROM saml_verzoeken WHERE id = ?').get(String(id || ''));
  if (!r) return null;
  S.db.prepare('DELETE FROM saml_verzoeken WHERE id = ?').run(r.id);
  return r.tot < Date.now() ? null : r;
}
/* De org komt UIT de rij en niet uit het verzoek van de bezoeker. Dat is geen
   detail: als de aanroeper de org zou meegeven, kon iemand een verzoek-ID van
   organisatie A inleveren met de koppeling van organisatie B erbij, en dan
   wordt de assertie tegen het verkeerde certificaat gehouden. */
function neemVerzoek(id, org) {
  const r = neemVerzoekBijId(id);
  return r && r.org === String(org) ? r : null;
}

/* Eenmalig gebruik van een assertie. Geeft false als hij al gebruikt is. */
function markeerGebruikt(assertieId, org, tot) {
  if (!assertieId) return false;         // geen ID = niet te ontdubbelen = weigeren
  S.db.prepare('DELETE FROM saml_gebruikt WHERE tot < ?').run(Date.now());
  try {
    S.db.prepare('INSERT INTO saml_gebruikt (assertie_id, org, tot) VALUES (?, ?, ?)')
      .run(String(assertieId), String(org), Number(tot) || Date.now() + VERZOEK_MS);
    return true;
  } catch (e) { return false; }          // schending van de sleutel = al gebruikt
}

/* Het AuthnRequest voor de HTTP-Redirect-binding: gedeflate, base64, in de URL.

   Hij wordt NIET ondertekend, en dat is een keuze met een reden. Een
   ondertekend verzoek bewijst aan de provider dat het van ons komt; het zegt
   niets over de veiligheid van het ANTWOORD, en dat is de kant waar de aanval
   zit. Providers die het eisen, kunnen hier niet terecht -- dat staat liever
   hier dan dat er een halve ondertekening komt die niemand controleert. */
function verzoekUrl(koppeling, { acs, entityId, terug }) {
  const id = bewaarVerzoek(koppeling.org, terug);
  const xml = '<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"' +
    ' xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"' +
    ' ID="' + id + '" Version="2.0" IssueInstant="' + new Date().toISOString() + '"' +
    ' Destination="' + esc(koppeling.samlSsoUrl) + '"' +
    ' ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"' +
    ' AssertionConsumerServiceURL="' + esc(acs) + '">' +
    '<saml:Issuer>' + esc(entityId) + '</saml:Issuer>' +
    '</samlp:AuthnRequest>';
  const ingepakt = zlib.deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
  const scheiding = koppeling.samlSsoUrl.includes('?') ? '&' : '?';
  return { id, url: koppeling.samlSsoUrl + scheiding + 'SAMLRequest=' + encodeURIComponent(ingepakt) +
    '&RelayState=' + encodeURIComponent(id) };
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/* De SAML-velden van een koppeling zetten. Alle drie of geen: een koppeling met
   een SSO-adres en zonder certificaat zou een deur zijn zonder slot. */
function zetSaml({ org, entityId, ssoUrl, certificaat }) {
  const o = String(org || '').trim().toLowerCase();
  const rij = S.db.prepare('SELECT id FROM sso_koppelingen WHERE org = ?').get(o);
  if (!rij) throw new Error('Maak eerst de koppeling voor "' + o + '" aan.');
  const e = String(entityId || '').trim();
  const u = String(ssoUrl || '').trim();
  const c = String(certificaat || '').trim();
  if (!e) throw new Error('Geef de entityID van de provider; daar wordt de Issuer van elke assertie tegen gehouden.');
  if (!/^https:\/\//i.test(u)) throw new Error('Het SSO-adres van de provider moet een https-adres zijn.');
  if (!c) throw new Error('Zonder het ondertekencertificaat van de provider valt er niets te controleren.');
  /* Nu al proberen te lezen: een certificaat dat pas bij de eerste inlog
     onleesbaar blijkt, is een storing op het slechtste moment. */
  require('./handtekening').sleutelUit(c);
  S.db.prepare('UPDATE sso_koppelingen SET soort = ?, saml_entity_id = ?, saml_sso_url = ?, saml_cert = ? WHERE org = ?')
    .run('saml', e, u, c, o);
  return samlVan(o);
}
function samlVan(org) {
  const r = S.db.prepare('SELECT org, naam, soort, saml_entity_id, saml_sso_url, saml_cert, actief FROM sso_koppelingen WHERE org = ?')
    .get(String(org || '').trim().toLowerCase());
  if (!r || r.soort !== 'saml') return null;
  return { org: r.org, naam: r.naam, soort: 'saml', samlEntityId: r.saml_entity_id,
    samlSsoUrl: r.saml_sso_url, samlCert: r.saml_cert, actief: !!r.actief };
}

module.exports = { zorgTabel, bewaarVerzoek, neemVerzoek, neemVerzoekBijId, markeerGebruikt, verzoekUrl, zetSaml, samlVan, nieuwId, VERZOEK_MS };
