/* Herhaalbare eigen-beheerderprovisioning op dezelfde staff-tabel. De bestaande
   unieke actieve (zaak,lid)-index beschermt ook twee processen. Een oude
   deactivering of een andere rol is geen toestemming opnieuw toegang te geven. */
'use strict';
const S = require('./state');
const staff = require('./staff');
const users = require('./users');
const mirror = require('./mirror');
const bezig = new Map();
const fout = tekst => Object.assign(new Error(tekst), { status: 409 });

function bestaande(rijen, verwacht) {
  const actief = rijen.filter(s => Number(s.active) === 1);
  if (actief.length > 1 || actief.length && actief[0].role !== 'manager')
    throw fout('De bestaande personeelsplek is geen eenduidige eigen beheerder.');
  if (verwacht != null && (!actief.length || Number(actief[0].id) !== verwacht))
    throw fout('De eerder vastgelegde beheerder ontbreekt of is ingetrokken.');
  if (!actief.length && rijen.length) throw fout('Een ingetrokken personeelsplek wordt niet automatisch opnieuw aangemaakt.');
  return actief[0] || null;
}
function lokaal(code, lid) {
  return S.zin('SELECT * FROM supplier_staff WHERE supplier_code = ? AND member_id = ? ORDER BY id').all(code, lid);
}
function maak(g) {
  controleLid(g.memberId);
  return staff.createAccountStaff({ ...g, role: 'manager', func: 'Eigenaar', active: true });
}
function controleLid(id) {
  const lid = users.getUserById(id);
  if (!lid || !users.isActief(lid)) throw fout('Een actieve persoonlijke eigenaar ontbreekt.');
}
async function werk(g) {
  controleLid(g.memberId);
  if (!mirror.PGMODE) {
    const db = S.huidigeDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = bestaande(lokaal(g.supplierCode, g.memberId), g.verwachtStaffId) || maak(g);
      db.exec('COMMIT'); return r;
    } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
  }
  if (!require('./duurzaamheid').gesloten())
    throw Object.assign(new Error('Automatische provisioning vereist de transactionele PostgreSQL-accountgrens.'), { status: 503 });
  const vers = () => mirror.leesStaffVanLidVers(g.supplierCode, g.memberId);
  let oud = bestaande(await vers(), g.verwachtStaffId);
  if (oud) return oud;
  try {
    return await require('./achtergrond').buitenVerzoek(() => maak(g));
  } catch (e) {
    // Een andere instantie won dezelfde bestaande unieke sleutel. Herlezen,
    // nooit de rol verhogen of een ander staff-id als hetzelfde presenteren.
    if (e.code !== 'PG_REQUEST_CONFLICT' && !/unique|constraint/i.test(e.message || '')) throw e;
    oud = bestaande(await vers(), g.verwachtStaffId);
    if (!oud) throw e;
    return oud;
  }
}
module.exports = function maakEigenaarEenmaal(input = {}) {
  const code = typeof input.supplierCode === 'string' ? input.supplierCode.trim().toUpperCase() : '';
  if (!code || !Number.isSafeInteger(input.memberId) || input.memberId < 1 ||
      input.verwachtStaffId != null && (!Number.isSafeInteger(input.verwachtStaffId) || input.verwachtStaffId < 1))
    return Promise.reject(fout('Een exacte zaak, lid en eventuele bestaande beheerder zijn vereist.'));
  const g = { ...input, supplierCode: code }, sleutel = code + ':' + g.memberId;
  const taak = (bezig.get(sleutel) || Promise.resolve()).catch(() => {}).then(() => werk(g));
  bezig.set(sleutel, taak);
  return taak.finally(() => { if (bezig.get(sleutel) === taak) bezig.delete(sleutel); });
};
