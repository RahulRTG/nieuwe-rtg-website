/* Accounts, deel "staff": het leverancier-personeel (PIN-accounts binnen een
   bedrijf). Aanmaken, opvragen per bedrijf, PIN verifiëren en resetten,
   deactiveren, en de koppeling aan een RTG-lid (member_id) voor de "1x
   aanmelden"-inlog over meerdere bedrijven. Afgesplitst uit accounts.js; crypto
   komt uit ./kluis, de Postgres-spiegel uit ./mirror. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

async function createStaff(gegevens) {
  return schrijfStaff(gegevens, await kluis.hashPassword(String(gegevens.pin)));
}
function createStaffSync(gegevens) {
  return schrijfStaff(gegevens, kluis.hashPasswordSync(String(gegevens.pin)));
}
/* Alleen voor de demoseed in server.js: 183 rijen met een pincode die in de
   repo staat. Waarom die goedkoper mag hashen staat in ./wachtwoord.js bij
   hashDemoSync -- en die functie weigert buiten de demostand, dus deze ook.
   De ECHTE weg (een bedrijf dat zich aanmeldt, server/kern/aanmeldingen/
   bedrijf.js) blijft bij createStaffSync op volle kosten. */
function createStaffDemo(gegevens) {
  return schrijfStaff(gegevens, kluis.hashDemoSync(String(gegevens.pin)));
}
function schrijfStaff({ supplierCode, name, role, func, memberId, memberTier }, pinHash) {
  const vals = [String(supplierCode || '').toUpperCase(), String(name).slice(0, 60), pinHash, role === 'manager' ? 'manager' : 'staff', func ? String(func).slice(0, 40) : null, new Date().toISOString(),
    memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null];
  const kolommen = 'supplier_code, name, pin_hash, role, func, created_at, member_id, member_tier';
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
  return getStaffById(newId);
}
function getStaffById(id) { return S.zin('SELECT * FROM supplier_staff WHERE id = ? AND active = 1').get(id) || null; }
function listStaff(code) { return S.zin('SELECT * FROM supplier_staff WHERE supplier_code = ? AND active = 1 ORDER BY (role=\'manager\') DESC, id').all(String(code || '').toUpperCase()); }
function countStaff(code) { return S.zin('SELECT COUNT(*) AS c FROM supplier_staff WHERE supplier_code = ? AND active = 1').get(String(code || '').toUpperCase()).c; }
async function verifyStaffPin(id, pin) { const s = getStaffById(id); return (s && await kluis.verifyPassword(String(pin), s.pin_hash)) ? s : null; }
// Manager reset: geef een teamlid een nieuwe pincode (bij vergeten of misbruik).
async function setStaffPin(id, pin) {
  S.zin('UPDATE supplier_staff SET pin_hash = ? WHERE id = ?').run(await kluis.hashPassword(String(pin)), id);
  mirror.markStaff(id);
  return getStaffById(id);
}
function deactivateStaff(id) { S.zin('UPDATE supplier_staff SET active = 0 WHERE id = ?').run(id); mirror.markStaff(id); }
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
function makePin() { return String(crypto.randomInt(1000, 10000)); }

module.exports = {
  createStaff, createStaffSync, createStaffDemo, getStaffById, listStaff, countStaff, verifyStaffPin,
  setStaffPin, deactivateStaff, deactivateStaffVanZaak, staffByMember, staffPositions,
  setStaffMember, claimStaffMember, releaseStaffMember, publicStaff, makePin
};
