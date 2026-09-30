/* ============================================================================
   De koppelingen: welke organisatie logt in bij welke identiteitsprovider.

   Een koppeling is een gevoelig ding. Wie er een mag aanmaken, bepaalt wie er
   binnenkomt -- dus dit wordt uitsluitend door de eigenaar beheerd (zie
   routes/sso.js), nooit door een klant zelf.

   DE DOMEINLIJST IS DE KERN VAN DE VEILIGHEID, NIET EEN GEMAKJE.

   Een identiteitsprovider kan in een token elk e-mailadres zetten dat hij wil.
   Dat is geen fout in het protocol: hij is de baas over ZIJN gebruikers. Maar
   het betekent dat de provider van klant A, zonder deze lijst, een token kan
   afgeven dat "directeur@klantB.nl" beweert te zijn -- en dan zouden wij die
   persoon als de directeur van klant B binnenlaten. Dat is de klassieke
   SSO-overname, en hij is met een verkeerd ingestelde koppeling zo gebeurd.

   Daarom mag elke koppeling alleen identiteiten bevestigen in domeinen die op
   zijn eigen lijst staan, en mag een domein bij hoogstens EEN koppeling horen.
   Een adres dat buiten de lijst valt, wordt geweigerd -- ook als het token
   verder perfect klopt.

   Het client-geheim gaat versleuteld de database in, met een eigen sleutel per
   organisatie, een vervaldatum en rotatie met overlap (./clientgeheim.js, besluit
   B16). Het is een wachtwoord van ons bij de provider; wie de database steelt,
   hoort er niets aan te hebben, en geen route geeft het terug.
   ========================================================================== */
'use strict';
const S = require('../accounts/state');
const clientgeheim = require('./clientgeheim');
const rotatie = require('./clientgeheim-rotatie');

function zorgTabel(db) {
  (db || S.db).exec(`CREATE TABLE IF NOT EXISTS sso_koppelingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org TEXT NOT NULL UNIQUE,
    naam TEXT NOT NULL,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    enc_client_secret TEXT,
    domeinen TEXT NOT NULL,
    actief INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`);
}

/* Een domein normaliseren tot waar we op vergelijken: kleine letters, geen
   punt ervoor, geen @. "@Klant.NL" en "klant.nl" zijn hetzelfde domein. */
function schoonDomein(d) {
  return String(d || '').trim().toLowerCase().replace(/^@+/, '').replace(/^\.+|\.+$/g, '');
}
function lijstDomeinen(waarde) {
  const rauw = Array.isArray(waarde) ? waarde : String(waarde || '').split(/[,\s;]+/);
  const uit = [];
  for (const d of rauw) {
    const s = schoonDomein(d);
    // een domein zonder punt is geen domein; "nl" zou een half land binnenlaten
    if (s && s.includes('.') && !uit.includes(s)) uit.push(s);
  }
  return uit;
}
function domeinVan(email) {
  const m = String(email || '').trim().toLowerCase().match(/^[^@\s]+@([^@\s]+)$/);
  return m ? schoonDomein(m[1]) : null;
}

function rij2koppeling(r) {
  if (!r) return null;
  return {
    id: r.id, org: r.org, naam: r.naam, issuer: r.issuer, clientId: r.client_id,
    domeinen: lijstDomeinen(r.domeinen), actief: !!r.actief, aangemaakt: r.created_at
  };
}
/* Het geheim komt er ALLEEN uit voor de tokenruil (geheimenVoorRuil), en dan als
   lijst geldige geheimen of een reden waarom de inlog dicht is. Een rij in de
   oude opslag wordt hier bij het laden herzegeld naar de sleutel per tenant. */
const norm = (org) => String(org || '').trim().toLowerCase();
function geheimWaarde(org) {
  const o = norm(org);
  const r = S.db.prepare('SELECT enc_client_secret FROM sso_koppelingen WHERE org = ?').get(o);
  if (!r) return undefined;
  const nieuw = clientgeheim.migreer(o, r.enc_client_secret);
  if (!nieuw) return r.enc_client_secret;
  S.db.prepare('UPDATE sso_koppelingen SET enc_client_secret = ? WHERE org = ?').run(nieuw, o);
  return nieuw;
}
function geheimenVoorRuil(org) { return clientgeheim.geldige(norm(org), geheimWaarde(org)); }
function geheimStand(org) {
  const w = geheimWaarde(org);
  return w === undefined ? null : clientgeheim.stand(norm(org), w);
}
function schrijfGeheim(o, waarde) {
  S.db.prepare('UPDATE sso_koppelingen SET enc_client_secret = ? WHERE org = ?').run(waarde, o);
}
/* Roteren met overlap, alleen via de eigenaarsroutes. Bestaat de koppeling niet,
   dan null: een geheim hoort bij een organisatie. */
function roteerGeheim(org, geheim, opties) {
  const w = geheimWaarde(org);
  if (w === undefined) return null;
  const uit = rotatie.roteer(norm(org), geheim, w, opties);
  schrijfGeheim(norm(org), uit.waarde);
  return { ongewijzigd: uit.ongewijzigd, stand: clientgeheim.stand(norm(org), uit.waarde) };
}
function sluitOverlap(org) {
  const w = geheimWaarde(org);
  if (w === undefined) return null;
  schrijfGeheim(norm(org), rotatie.sluitOverlap(norm(org), w));
  return clientgeheim.stand(norm(org), geheimWaarde(org));
}

function lijst() {
  return S.db.prepare('SELECT * FROM sso_koppelingen ORDER BY naam').all().map(rij2koppeling);
}
/* EEN ORG IS HOOFDLETTERONGEVOELIG, en die regel hoort HIER te staan.

   zet() bewaart de org in kleine letters. vind() zocht op de ruwe tekst, en dat
   ging op twee plekken mis waar niemand naar keek. (1) De beheerroute voor de
   SCIM-sleutel geeft door wat de eigenaar intypt: wie "O-KLANT" typte bij het
   aanmaken EN bij het sleutelverzoek, kreeg "maak eerst de koppeling aan" te
   zien terwijl die er gewoon stond. (2) De tenantlaag draagt de org in
   hoofdletters (kern/tenant/register.js) en vroeg hier of er een koppeling was
   -- het antwoord was altijd nee, en de bewering "eigen identiteitsprovider"
   stond dus bij iedereen op onwaar.

   Normaliseren bij het LEZEN en niet bij elke aanroeper: een regel die je op
   vier plaatsen moet onthouden, wordt op de vijfde vergeten. */
function vind(org) {
  const o = String(org || '').trim().toLowerCase();
  return rij2koppeling(S.db.prepare('SELECT * FROM sso_koppelingen WHERE org = ?').get(o));
}
/* Waar hoort dit e-mailadres thuis? Dit stuurt "typ je werkmail" naar de juiste
   provider. Alleen actieve koppelingen tellen: een uitgezette koppeling hoort
   niemand meer binnen te laten. */
function vindVoorEmail(email) {
  const d = domeinVan(email);
  if (!d) return null;
  for (const k of lijst()) if (k.actief && k.domeinen.includes(d)) return k;
  return null;
}

/* Een domein mag bij hoogstens een koppeling horen; anders bepaalt de volgorde
   in de tabel wie een adres mag claimen, en dat is geen beveiliging. */
function domeinBotsing(domeinen, eigenOrg) {
  for (const k of lijst()) {
    if (k.org === eigenOrg) continue;
    const botst = domeinen.filter(d => k.domeinen.includes(d));
    if (botst.length) return { org: k.org, domeinen: botst };
  }
  return null;
}

function zet({ org, naam, issuer, clientId, clientSecret, domeinen, actief, geheimOpties }) {
  const o = String(org || '').trim().toLowerCase();
  if (!o) throw new Error('Een koppeling hoort bij een organisatie; geef een org mee.');
  const doms = lijstDomeinen(domeinen);
  if (!doms.length) throw new Error('Geef minstens een e-maildomein op: zonder domeinlijst mag deze provider iedereen claimen.');
  const botsing = domeinBotsing(doms, o);
  if (botsing) throw new Error('Domein ' + botsing.domeinen.join(', ') + ' hoort al bij organisatie "' + botsing.org + '".');
  if (!/^https:\/\//i.test(String(issuer || ''))) throw new Error('De issuer moet een https-adres zijn.');
  if (!String(clientId || '').trim()) throw new Error('Geef de client-id die de provider ons heeft gegeven.');

  const bestaat = S.db.prepare('SELECT id, enc_client_secret FROM sso_koppelingen WHERE org = ?').get(o);
  /* Geen nieuw geheim bij een wijziging = het oude blijft staan (herzegeld als het
     nog in de oude opslag stond). Een nieuw geheim is een rotatie met overlap, en
     zonder sleutel weigert die VOOR er iets geschreven wordt. */
  const oud = bestaat ? bestaat.enc_client_secret : null;
  const geheim = clientSecret
    ? rotatie.roteer(o, clientSecret, oud, geheimOpties).waarde
    : (clientgeheim.migreer(o, oud) || oud);
  const aan = actief === undefined ? 1 : (actief ? 1 : 0);
  if (bestaat) {
    S.db.prepare(`UPDATE sso_koppelingen SET naam = ?, issuer = ?, client_id = ?, enc_client_secret = ?,
      domeinen = ?, actief = ? WHERE org = ?`)
      .run(String(naam || o), String(issuer).trim(), String(clientId).trim(), geheim, doms.join(','), aan, o);
  } else {
    S.db.prepare(`INSERT INTO sso_koppelingen (org, naam, issuer, client_id, enc_client_secret, domeinen, actief, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(o, String(naam || o), String(issuer).trim(), String(clientId).trim(), geheim, doms.join(','), aan, new Date().toISOString());
  }
  return vind(o);
}

function weg(org) {
  const o = String(org || '').trim().toLowerCase();
  const had = vind(o);
  if (!had) return null;
  S.db.prepare('DELETE FROM sso_koppelingen WHERE org = ?').run(o);
  return had;
}

module.exports = { zorgTabel, lijst, vind, vindVoorEmail, zet, weg, geheimenVoorRuil, geheimStand, roteerGeheim,
  sluitOverlap, lijstDomeinen, domeinVan, schoonDomein };
