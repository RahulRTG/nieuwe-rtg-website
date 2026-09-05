/* Accounts, deel "staff": het leverancier-personeel (PIN-accounts binnen een
   bedrijf). Aanmaken, opvragen per bedrijf, PIN verifiëren en resetten,
   deactiveren, en de koppeling aan een RTG-lid (member_id) voor de "1x
   aanmelden"-inlog over meerdere bedrijven. Afgesplitst uit accounts.js; crypto
   komt uit ./kluis, de Postgres-spiegel uit ./mirror. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');
const users = require('./users');
const testomgeving = require('../testomgeving');

/* DE VIERCIJFERIGE PERSONEELSPIN IS GEEN PRODUCTIECREDENTIAL MEER.

   Oude demo's en een groot deel van de operationele fixtures oefenen nog met
   1234/5678. Dat mag alleen binnen de expliciet aangezette, niet-productie
   Magnaat Test-omgeving. Een gewone lokale start is dus evenmin een stille
   achterdeur. Alle echte personeelsrijen worden aan een persoonlijk
   RTG-account gebonden en dragen onderstaande onbruikbare marker in de oude
   NOT NULL-kolom. De marker is geen hash en kan nooit door verifyPassword
   worden geaccepteerd. */
const ACCOUNT_ONLY_HASH = '!RTG-ACCOUNT-ONLY-v1!';
function legacyStaffPinToegestaan(env = process.env) {
  return String(env.NODE_ENV || '') !== 'production' && testomgeving.actief(env);
}
function eisLegacyStaffPin(actie) {
  if (legacyStaffPinToegestaan()) return;
  const fout = new Error('Personeel gebruikt een persoonlijk RTG-account; een viercijferige personeelspin kan hier niet worden ' + actie + '.');
  fout.code = 'RTG_STAFF_PIN_GESLOTEN';
  throw fout;
}

async function createStaff(gegevens) {
  eisLegacyStaffPin('uitgegeven');
  return schrijfStaff(gegevens, await kluis.hashPassword(String(gegevens.pin)));
}
function createStaffSync(gegevens) {
  eisLegacyStaffPin('uitgegeven');
  return schrijfStaff(gegevens, kluis.hashPasswordSync(String(gegevens.pin)));
}
/* Alleen voor de testzaai. LET OP het verschil met createStaffSync hierboven:
   die loopt OOK op een echte weg (de eigenaar-PIN bij een goedgekeurde
   bedrijfsaanmelding, kern/aanmeldingen/bedrijf.js) en houdt dus zijn eigen
   zout per rij. Zie kluis.zaaiHash. */
function createStaffZaai(gegevens) {
  eisLegacyStaffPin('gezaaid');
  return schrijfStaff(gegevens, kluis.zaaiHash(String(gegevens.pin)));
}
/* De enige echte provisioningvorm: de personeelsplek en het RTG-account
   ontstaan als een gebonden paar. Zonder bestaand positief member-id maken we
   geen half account dat later via een verborgen beheerhandeling gerepareerd
   moet worden. */
function createAccountStaff(gegevens) {
  const memberId = Number(gegevens && gegevens.memberId);
  const lid = Number.isSafeInteger(memberId) && memberId > 0
    ? users.getUserById(memberId) : null;
  if (!lid || !users.isActief(lid)) {
    const fout = new Error('Een personeelsplek vraagt een bestaand persoonlijk RTG-account.');
    fout.code = 'RTG_STAFF_ACCOUNT_REQUIRED';
    throw fout;
  }
  return schrijfStaff({ ...gegevens, memberId, memberTier: lid.tier }, ACCOUNT_ONLY_HASH);
}
function schrijfStaff({ supplierCode, name, role, func, memberId, memberTier, active = true }, pinHash) {
  const vals = [String(supplierCode || '').toUpperCase(), String(name).slice(0, 60), pinHash, role === 'manager' ? 'manager' : 'staff', func ? String(func).slice(0, 40) : null, new Date().toISOString(),
    memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null,
    active === false ? 0 : 1];
  const kolommen = 'supplier_code, name, pin_hash, role, func, created_at, member_id, member_tier, active';
  const id = mirror.nieuwId();
  let newId;
  if (id != null) {
    S.zin(`INSERT INTO supplier_staff (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = S.zin(`INSERT INTO supplier_staff (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  mirror.markStaff(newId);
  return getStaffByIdAny(newId);
}
function getStaffById(id) { return S.zin('SELECT * FROM supplier_staff WHERE id = ? AND active = 1').get(id) || null; }
/* Provisioning maakt een rij bewust inactief. Alleen de uitnodigingssaga mag
   zo'n exacte rij terugvinden en na een duurzaam voltooide claim activeren;
   alle gewone login-/roosterpaden blijven getStaffById gebruiken. */
function getStaffByIdAny(id) { return S.zin('SELECT * FROM supplier_staff WHERE id = ?').get(id) || null; }
function listStaff(code) { return S.zin('SELECT * FROM supplier_staff WHERE supplier_code = ? AND active = 1 ORDER BY (role=\'manager\') DESC, id').all(String(code || '').toUpperCase()); }
function countStaff(code) { return S.zin('SELECT COUNT(*) AS c FROM supplier_staff WHERE supplier_code = ? AND active = 1').get(String(code || '').toUpperCase()).c; }
async function verifyStaffPin(id, pin) {
  if (!legacyStaffPinToegestaan()) return null;
  const s = getStaffById(id);
  if (!s || s.pin_hash === ACCOUNT_ONLY_HASH) return null;
  return await kluis.verifyPassword(String(pin), s.pin_hash) ? s : null;
}
// Manager reset: geef een teamlid een nieuwe pincode (bij vergeten of misbruik).
async function setStaffPin(id, pin) {
  eisLegacyStaffPin('gereset');
  S.zin('UPDATE supplier_staff SET pin_hash = ? WHERE id = ?').run(await kluis.hashPassword(String(pin)), id);
  mirror.markStaff(id);
  return getStaffById(id);
}
function deactivateStaff(id) { S.zin('UPDATE supplier_staff SET active = 0 WHERE id = ?').run(id); mirror.markStaff(id); }
function activateStaff(id) {
  const info = S.zin('UPDATE supplier_staff SET active = 1 WHERE id = ? AND active = 0').run(id);
  if (info.changes) mirror.markStaff(id);
  return getStaffById(id);
}
/* Al het personeel van één zaak in één keer inactief zetten. Nodig wanneer een
   zaak uit de catalogus verdwijnt: bleef het personeel staan, dan hield de kluis
   namen en pincodes vast van een bedrijf dat niet meer bestaat -- en die mensen
   konden nog inloggen op een PDA van een zaak die nergens meer te vinden was.

   Deactiveren en niet verwijderen, en dat is geen halfheid maar de enige vorm
   die overleeft: flushMirror in ./mirror kent wel deleteUser maar GEEN
   deleteStaff, dus een DELETE hier zou lokaal slagen en bij de eerstvolgende
   pullAlles() gewoon weer uit Postgres terugkomen ("Postgres wint"). Een rij op
   active = 0 wordt wel netjes mee gespiegeld. Alles wat personeel opvraagt
   (getStaffById, listStaff, countStaff, verifyStaffPin, staffPositions) filtert
   op active = 1, dus de toegang is hiermee dicht. */
function deactivateStaffVanZaak(code) {
  const rijen = S.zin('SELECT id FROM supplier_staff WHERE supplier_code = ? AND active = 1')
    .all(String(code || '').toUpperCase());
  for (const r of rijen) deactivateStaff(r.id);
  return rijen.length;
}
// Actief personeelsaccount van een lid binnen een bedrijf (voorkomt dubbel aanmelden).
function staffByMember(supplierCode, memberId) {
  if (memberId == null) return null;
  return S.zin('SELECT * FROM supplier_staff WHERE supplier_code = ? AND member_id = ? AND active = 1')
    .get(String(supplierCode || '').toUpperCase(), Number(memberId)) || null;
}
// Alle actieve personeelsplekken van één RTG-lid, over alle bedrijven heen.
// Basis voor de "1x aanmelden"-inlog: log één keer in en land meteen op het
// juiste bedrijf; wie bij meer bedrijven werkt, ziet die allemaal als opties.
function staffPositions(memberId) {
  if (memberId == null) return [];
  return S.zin('SELECT * FROM supplier_staff WHERE member_id = ? AND active = 1 ORDER BY supplier_code')
    .all(Number(memberId));
}
// Koppel een bestaand personeelsaccount aan een RTG-lid (voor de demo-seed en
// voor het achteraf verbinden van een naam-account met een echt RTG-account).
function setStaffMember(id, memberId, memberTier) {
  S.zin('UPDATE supplier_staff SET member_id = ?, member_tier = ? WHERE id = ?')
    .run(memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null, id);
  mirror.markStaff(id);
  return getStaffById(id);
}
/* Een nog ongekoppelde personeelsplek eenmalig claimen. De voorwaarde staat in
   DE UPDATE en niet alleen in JavaScript: twee gelijktijdige juiste PIN-pogingen
   kunnen daardoor nooit allebei de laatste schrijver worden. Dezelfde eigenaar
   mag de handeling veilig herhalen. */
function claimStaffMember(id, memberId, memberTier) {
  const lid = Number(memberId);
  if (!Number.isInteger(lid) || lid <= 0) return null;
  const info = S.zin(`UPDATE supplier_staff SET member_id = ?, member_tier = ?
    WHERE id = ? AND active = 1 AND (member_id IS NULL OR member_id = ?)`)
    .run(lid, memberTier ? String(memberTier).slice(0, 20) : null, id, lid);
  if (info.changes) mirror.markStaff(id);
  const staff = getStaffById(id);
  return staff && Number(staff.member_id) === lid ? staff : null;
}
/* Ontkoppel uitsluitend de eigenaar die de plek nu bezit. De member-id staat
   in de UPDATE, zodat een verouderd verzoek nooit de koppeling van een later
   gekoppeld account kan losmaken. */
function releaseStaffMember(id, memberId) {
  const lid = Number(memberId);
  if (!Number.isSafeInteger(lid) || lid < 1) return false;
  const info = S.zin(`UPDATE supplier_staff SET member_id = NULL, member_tier = NULL
    WHERE id = ? AND active = 1 AND member_id = ?`).run(id, lid);
  if (!info.changes) return false;
  mirror.markStaff(id);
  return true;
}
function publicStaff(s) { return s ? { id: s.id, name: s.name, role: s.role, func: s.func || null, lid: s.member_id != null } : null; }
function makePin() { eisLegacyStaffPin('uitgegeven'); return String(crypto.randomInt(1000, 10000)); }

module.exports = {
  createStaff, createStaffSync, createStaffZaai, createAccountStaff,
  legacyStaffPinToegestaan, ACCOUNT_ONLY_HASH, getStaffById, getStaffByIdAny,
  listStaff, countStaff, verifyStaffPin, setStaffPin, activateStaff, deactivateStaff,
  deactivateStaffVanZaak, staffByMember, staffPositions,
  setStaffMember, claimStaffMember, releaseStaffMember, publicStaff, makePin
};
