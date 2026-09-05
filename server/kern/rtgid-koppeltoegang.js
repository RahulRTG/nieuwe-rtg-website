/* De twee credentials van een RTG-iD-koppeling.

   De code die een mens overtypt en de statusknop waarmee de dienst wacht zijn
   allebei bearers. De oude uitvoering bewaarde beide kaal: een ID-code van
   circa 40 bits en een `koppelId` van circa 48 bits. Die laatste gaf na een
   bevestiging zelfs het identiteitstoken terug. Daarom worden ze hier samen
   behandeld: 128 bits, alleen een namespaced hash op schijf, doel/scope,
   verval, gebruiksteller, intrekking en rotatie.

   De statuscredential WORDT na bevestiging het kortlevende id-token. De dienst
   bezit de kale waarde al; de server hoeft haar dus nooit tijdelijk kaal op te
   slaan om haar later nog eens terug te kunnen geven. */
'use strict';

const KOPPEL_DOEL = 'rtgid-koppelen';
const STATUS_DOEL = 'rtgid-status';
const KOPPEL_SCOPE = ['rtgid.koppeling.bekijken', 'rtgid.koppeling.bevestigen'];
const STATUS_SCOPE = ['rtgid.status.lezen', 'rtgid.identiteit.eenmalig'];
const STATUS_TTL_MS = 25 * 60 * 1000;
const STATUS_MAX_GEBRUIK = 500;

module.exports = ({ crypto, nu, koppelTtlMs }) => {
  const codeBearer = require('./bearercode')({ crypto, namespace: 'rtgid-koppelcode', nu });
  const statusBearer = require('./bearercode')({ crypto, namespace: 'rtgid-status', nu });
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const rijen = s => Array.isArray(s && s.koppels) ? s.koppels : [];
  const historie = k => Array.isArray(k && k.code_historie) ? k.code_historie : [];
  const statusHistorie = k => Array.isArray(k && k.status_historie) ? k.status_historie : [];

  const onderwerpKlopt = (toegang, k) => !!(toegang && toegang.onderwerp &&
    toegang.onderwerp.soort === 'rtgid-koppel' && toegang.onderwerp.id === k.id);
  const codeReden = k => {
    const reden = codeBearer.reden(k && k.koppel_toegang,
      { doel: KOPPEL_DOEL, scope: KOPPEL_SCOPE });
    return reden || (onderwerpKlopt(k.koppel_toegang, k) ? null : 'verkeerd-onderwerp');
  };
  const statusReden = k => {
    const reden = statusBearer.reden(k && k.status_toegang,
      { doel: STATUS_DOEL, scope: STATUS_SCOPE });
    return reden || (onderwerpKlopt(k.status_toegang, k) ? null : 'verkeerd-onderwerp');
  };

  function bestaat(s, codeHash, statusHash, id) {
    let botsing = false;
    for (const k of rijen(s)) {
      if (k && k.id === id) botsing = true;
      if (codeBearer.zelfdeHash(k && k.koppel_toegang && k.koppel_toegang.code_hash, codeHash)) botsing = true;
      for (const oud of historie(k)) if (codeBearer.zelfdeHash(oud && oud.code_hash, codeHash)) botsing = true;
      if (statusBearer.zelfdeHash(k && k.status_toegang && k.status_toegang.code_hash, statusHash)) botsing = true;
      for (const oud of statusHistorie(k))
        if (statusBearer.zelfdeHash(oud && oud.code_hash, statusHash)) botsing = true;
    }
    return botsing;
  }

  function nieuw(s, invoer) {
    for (let poging = 0; poging < 8; poging++) {
      const id = 'ki_' + crypto.randomBytes(16).toString('hex');
      const onderwerp = { soort: 'rtgid-koppel', id };
      const code = codeBearer.maak({ prefix: 'ID', issuer: invoer.dienst,
        doel: KOPPEL_DOEL, scope: KOPPEL_SCOPE, onderwerp,
        geldigMs: koppelTtlMs, maxGebruik: 1 });
      const status = statusBearer.maak({ prefix: 'RID', issuer: invoer.dienst,
        doel: STATUS_DOEL, scope: STATUS_SCOPE, onderwerp,
        geldigMs: STATUS_TTL_MS, maxGebruik: STATUS_MAX_GEBRUIK });
      if (bestaat(s, code.toegang.code_hash, status.toegang.code_hash, id)) continue;
      return { code: code.code, statusToken: status.code, koppel: {
        id, dienst: invoer.dienst, attributen: invoer.attributen, eis: invoer.eis,
        status: 'wacht', gemaakt: code.toegang.issued_at,
        verloopt: Date.parse(code.toegang.expires_at),
        koppel_toegang: code.toegang, status_toegang: status.toegang,
        code_historie: [], status_historie: [], kijkers: [], uitgifte: invoer.uitgifte || null
      } };
    }
    throw new Error('Kon geen unieke RTG-iD-credentials maken.');
  }

  function zoekCode(s, kaleCode) {
    const gezocht = codeBearer.hash(String(kaleCode || '').trim().slice(0, 100));
    let gevonden = null;
    for (const k of rijen(s)) {
      if (codeBearer.zelfdeHash(k && k.koppel_toegang && k.koppel_toegang.code_hash, gezocht)) gevonden = k;
      // Ook oude hashes vergelijken: een ingetrokken code mag geen tijdsignaal geven.
      for (const oud of historie(k)) codeBearer.zelfdeHash(oud && oud.code_hash, gezocht);
    }
    return gevonden;
  }

  function zoekStatus(s, kaleCode) {
    const gezocht = statusBearer.hash(String(kaleCode || '').trim().slice(0, 100));
    let gevonden = null;
    for (const k of rijen(s)) {
      if (statusBearer.zelfdeHash(k && k.status_toegang && k.status_toegang.code_hash, gezocht)) gevonden = k;
      for (const oud of statusHistorie(k)) statusBearer.zelfdeHash(oud && oud.code_hash, gezocht);
    }
    return gevonden;
  }
  function zoekStatusOoit(s, kaleCode) {
    const gezocht = statusBearer.hash(String(kaleCode || '').trim().slice(0, 100));
    let gevonden = null;
    for (const k of rijen(s)) {
      if (statusBearer.zelfdeHash(k && k.status_toegang && k.status_toegang.code_hash, gezocht)) gevonden = k;
      for (const oud of statusHistorie(k))
        if (statusBearer.zelfdeHash(oud && oud.code_hash, gezocht)) gevonden = k;
    }
    return gevonden;
  }

  const kijkerHash = key => afdruk('rtgid-kijker-v1|' + String(key || ''));
  function noteerKijker(k, key) {
    const h = kijkerHash(key);
    k.kijkers = Array.isArray(k.kijkers) ? k.kijkers : [];
    if (!k.kijkers.includes(h)) k.kijkers.push(h);
    if (k.kijkers.length > 8) k.kijkers.splice(0, k.kijkers.length - 8);
    return h;
  }
  const gezienDoor = (k, key) => Array.isArray(k && k.kijkers) && k.kijkers.includes(kijkerHash(key));

  function gebruikCode(k, key) {
    if (codeReden(k)) return false;
    if (!gezienDoor(k, key)) return false;
    codeBearer.gebruik(k.koppel_toegang);
    k.koppel_toegang.onderwerp.lid_hash = kijkerHash(key);
    codeBearer.intrekken(k.koppel_toegang, 'rtgid', 'koppeling afgehandeld');
    return true;
  }
  function sluitCode(k, actor, reden) {
    if (k && k.koppel_toegang) codeBearer.intrekken(k.koppel_toegang, actor, reden);
  }
  function gebruikStatus(k) {
    if (statusReden(k)) return false;
    statusBearer.gebruik(k.status_toegang);
    return true;
  }

  function roteer(s, k, issuer, uitgifte) {
    const oudeCode = k.koppel_toegang, oudeStatus = k.status_toegang;
    const nummer = Math.max(1, Number(oudeCode && oudeCode.rotatie) || 1) + 1;
    for (let poging = 0; poging < 8; poging++) {
      const code = codeBearer.maak({ prefix: 'ID', issuer,
        doel: KOPPEL_DOEL, scope: KOPPEL_SCOPE,
        onderwerp: { soort: 'rtgid-koppel', id: k.id },
        geldigMs: koppelTtlMs, maxGebruik: 1 });
      const status = statusBearer.maak({ prefix: 'RID', issuer,
        doel: STATUS_DOEL, scope: STATUS_SCOPE,
        onderwerp: { soort: 'rtgid-koppel', id: k.id },
        geldigMs: STATUS_TTL_MS, maxGebruik: STATUS_MAX_GEBRUIK });
      code.toegang.rotatie = nummer;
      status.toegang.rotatie = Math.max(1, Number(oudeStatus && oudeStatus.rotatie) || 1) + 1;
      if (bestaat(s, code.toegang.code_hash, status.toegang.code_hash, null)) continue;
      if (oudeCode) {
        codeBearer.intrekken(oudeCode, issuer, 'koppelcode geroteerd');
        k.code_historie = historie(k);
        k.code_historie.push(oudeCode);
        if (k.code_historie.length > 20) k.code_historie.splice(0, k.code_historie.length - 20);
      }
      if (oudeStatus) {
        statusBearer.intrekken(oudeStatus, issuer, 'statuscredential geroteerd');
        k.status_historie = statusHistorie(k);
        k.status_historie.push(oudeStatus);
        if (k.status_historie.length > 20) k.status_historie.splice(0, k.status_historie.length - 20);
      }
      k.koppel_toegang = code.toegang;
      k.status_toegang = status.toegang;
      k.verloopt = Date.parse(code.toegang.expires_at);
      k.kijkers = [];
      k.laatste_rotatie = uitgifte;
      return { code: code.code, statusToken: status.code };
    }
    throw new Error('Kon geen unieke RTG-iD-koppelcode roteren.');
  }

  function trekAllesIn(k, actor, reden) {
    sluitCode(k, actor, reden);
    if (k && k.status_toegang) statusBearer.intrekken(k.status_toegang, actor, reden);
  }

  function migreerLegacy(s) {
    let gewijzigd = false;
    for (const k of rijen(s)) {
      if (!k || (!Object.prototype.hasOwnProperty.call(k, 'code') &&
          !Object.prototype.hasOwnProperty.call(k, 'tokenEenmalig'))) continue;
      const at = nu();
      if (k.code) {
        k.code_historie = historie(k);
        k.code_historie.push({ code_hash: codeBearer.hash(k.code), issuer: k.dienst || 'legacy',
          doel: KOPPEL_DOEL, scope: [...KOPPEL_SCOPE],
          onderwerp: { soort: 'rtgid-koppel', id: k.id }, issued_at: k.gemaakt || at,
          expires_at: new Date(Math.max(Date.parse(at), Number(k.verloopt) || 0)).toISOString(),
          max_gebruik: 1, gebruik: 0, laatst_gebruikt_at: null,
          ingetrokken_at: at, ingetrokken_door: 'legacy-migratie',
          intrekreden: 'oude korte of kale RTG-iD-code gesloten', rotatie: 1 });
      }
      delete k.code;
      delete k.tokenEenmalig;
      if (k.status === 'wacht' || k.status === 'bevestigd') k.status = 'legacy-gesloten';
      k.legacy_gesloten_at = at;
      gewijzigd = true;
    }
    return gewijzigd;
  }

  return { nieuw, zoekCode, zoekStatus, zoekStatusOoit, codeReden, statusReden, noteerKijker,
    gezienDoor, gebruikCode, sluitCode, gebruikStatus, roteer, trekAllesIn,
    migreerLegacy, kijkerHash, codePubliek: codeBearer.publiek,
    statusPubliek: statusBearer.publiek, statusHash: statusBearer.hash,
    zelfdeStatusHash: statusBearer.zelfdeHash, KOPPEL_DOEL, STATUS_DOEL };
};

module.exports.KOPPEL_DOEL = KOPPEL_DOEL;
module.exports.STATUS_DOEL = STATUS_DOEL;
