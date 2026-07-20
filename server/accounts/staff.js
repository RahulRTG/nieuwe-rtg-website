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
function schrijfStaff({ supplierCode, name, role, func, memberId, memberTier }, pinHash) {
  const vals = [String(supplierCode || '').toUpperCase(), String(name).slice(0, 60), pinHash, role === 'manager' ? 'manager' : 'staff', func ? String(func).slice(0, 40) : null, new Date().toISOString(),
    memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null];
  const kolommen = 'supplier_code, name, pin_hash, role, func, created_at, member_id, member_tier';
  const id = mirror.nieuwId();
  let newId;
  if (id != null) {
    S.db.prepare(`INSERT INTO supplier_staff (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = S.db.prepare(`INSERT INTO supplier_staff (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  mirror.markStaff(newId);
  return getStaffById(newId);
}
function getStaffById(id) { return S.db.prepare('SELECT * FROM supplier_staff WHERE id = ? AND active = 1').get(id) || null; }
function listStaff(code) { return S.db.prepare('SELECT * FROM supplier_staff WHERE supplier_code = ? AND active = 1 ORDER BY (role=\'manager\') DESC, id').all(String(code || '').toUpperCase()); }
function countStaff(code) { return S.db.prepare('SELECT COUNT(*) AS c FROM supplier_staff WHERE supplier_code = ? AND active = 1').get(String(code || '').toUpperCase()).c; }
async function verifyStaffPin(id, pin) { const s = getStaffById(id); return (s && await kluis.verifyPassword(String(pin), s.pin_hash)) ? s : null; }
// Manager reset: geef een teamlid een nieuwe pincode (bij vergeten of misbruik).
async function setStaffPin(id, pin) {
  S.db.prepare('UPDATE supplier_staff SET pin_hash = ? WHERE id = ?').run(await kluis.hashPassword(String(pin)), id);
  mirror.markStaff(id);
  return getStaffById(id);
}
function deactivateStaff(id) { S.db.prepare('UPDATE supplier_staff SET active = 0 WHERE id = ?').run(id); mirror.markStaff(id); }
// Actief personeelsaccount van een lid binnen een bedrijf (voorkomt dubbel aanmelden).
function staffByMember(supplierCode, memberId) {
  if (memberId == null) return null;
  return S.db.prepare('SELECT * FROM supplier_staff WHERE supplier_code = ? AND member_id = ? AND active = 1')
    .get(String(supplierCode || '').toUpperCase(), Number(memberId)) || null;
}
// Alle actieve personeelsplekken van één RTG-lid, over alle bedrijven heen.
// Basis voor de "1x aanmelden"-inlog: log één keer in en land meteen op het
// juiste bedrijf; wie bij meer bedrijven werkt, ziet die allemaal als opties.
function staffPositions(memberId) {
  if (memberId == null) return [];
  return S.db.prepare('SELECT * FROM supplier_staff WHERE member_id = ? AND active = 1 ORDER BY supplier_code')
    .all(Number(memberId));
}
// Koppel een bestaand personeelsaccount aan een RTG-lid (voor de demo-seed en
// voor het achteraf verbinden van een naam-account met een echt RTG-account).
function setStaffMember(id, memberId, memberTier) {
  S.db.prepare('UPDATE supplier_staff SET member_id = ?, member_tier = ? WHERE id = ?')
    .run(memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null, id);
  mirror.markStaff(id);
  return getStaffById(id);
}
function publicStaff(s) { return s ? { id: s.id, name: s.name, role: s.role, func: s.func || null, lid: s.member_id != null } : null; }
function makePin() { return String(crypto.randomInt(1000, 10000)); }

module.exports = {
  createStaff, createStaffSync, getStaffById, listStaff, countStaff, verifyStaffPin,
  setStaffPin, deactivateStaff, staffByMember, staffPositions, setStaffMember, publicStaff, makePin
};
