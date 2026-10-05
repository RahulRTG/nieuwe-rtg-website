/* Credentiallevensloop van een Samen-kamer, in twee profielen: LivingOS
   (`samen`) en FoundationOS (`rtf`). Ze verschilden alleen in deze constanten;
   de FoundationOS-kopie (samenrtf-toegang.js) is daarom opgeheven. De gezins- en
   vriendschapscontrole van FoundationOS blijft een tweede poort in samenrtf.js;
   deze laag bezit uitsluitend het eenmalige deelgeheim en zijn levensloop. */
'use strict';

const klok = require('../lib/klok');

const PROFIELEN = Object.freeze({
  samen: Object.freeze({ doel: 'livingos-samen-kamer', scope: Object.freeze(['samen.join']),
    geldigMs: 12 * 3600000, soort: 'samen-kamer', idVoor: 'sk', prefix: 'SAMEN' }),
  rtf: Object.freeze({ doel: 'foundationos-samen-kamer', scope: Object.freeze(['rtf.samen.join']),
    geldigMs: 6 * 3600000, soort: 'rtf-samen-kamer', idVoor: 'rsk', prefix: 'RTFSAMEN' })
});
const MAX_GEBRUIK = 11;

module.exports = ({ crypto, nu = () => klok.datum().toISOString(), profiel = 'samen' }) => {
  const P = PROFIELEN[profiel];
  if (!P) throw new Error('samen-toegang kent geen profiel ' + profiel);
  const DOEL = P.doel, SCOPE = P.scope, GELDIG_MS = P.geldigMs;
  const bearer = require('./bearercode')({ crypto, namespace: DOEL, nu });
  const alle = kamers => Object.values(kamers || {}).filter(Boolean);
  const historie = k => Array.isArray(k && k.toegang_historie) ? k.toegang_historie : [];

  function uniekeNieuwe(kamers, k, issuer, rotatie) {
    const rijen = alle(kamers);
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = bearer.maak({ prefix: P.prefix, issuer, doel: DOEL, scope: SCOPE,
        onderwerp: { soort: P.soort, id: k.id }, geldigMs: GELDIG_MS,
        maxGebruik: MAX_GEBRUIK });
      gemaakt.toegang.rotatie = rotatie || 1;
      const dubbel = rijen.some(x => bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash,
        gemaakt.toegang.code_hash) || historie(x).some(h =>
        bearer.zelfdeHash(h && h.code_hash, gemaakt.toegang.code_hash)));
      if (!dubbel) return gemaakt;
    }
    return null;
  }

  function nieuw(kamers, k, issuer) {
    k.toegang_historie = [];
    return uniekeNieuwe(kamers, k, issuer, 1);
  }

  function zoek(kamers, code) {
    return bearer.vind(alle(kamers), code,
      k => k && k.toegang && k.toegang.code_hash);
  }

  function reden(k) {
    if (!k || k.gesloten_at) return 'gesloten';
    return bearer.reden(k.toegang, { doel: DOEL, scope: SCOPE });
  }

  function gebruik(k) { bearer.gebruik(k.toegang); }

  function intrekken(k, actor, waarom) {
    if (k && k.toegang) bearer.intrekken(k.toegang, actor, waarom);
  }

  function roteer(kamers, k, actor) {
    intrekken(k, actor, 'geroteerd');
    k.toegang_historie = historie(k);
    k.toegang_historie.push({ code_hash: k.toegang.code_hash,
      ingetrokken_at: k.toegang.ingetrokken_at, rotatie: k.toegang.rotatie || 1 });
    const gemaakt = uniekeNieuwe(kamers, k, actor, (k.toegang.rotatie || 1) + 1);
    if (gemaakt) k.toegang = gemaakt.toegang;
    return gemaakt;
  }

  const publiek = k => {
    const t = k && k.toegang;
    return t ? Object.assign(bearer.publiek(t), { stand: reden(k) || 'actief' }) : null;
  };

  function migreerLegacy(kamers) {
    for (const [sleutel, k] of Object.entries(kamers || {})) {
      if (!k || k.toegang) continue;
      const raw = String(k.code || sleutel || '');
      const issued = Number.isFinite(Number(k.at))
        ? new Date(Number(k.at)).toISOString() : nu();
      const id = new RegExp('^' + P.idVoor + '[a-f0-9]{32}$', 'i').test(String(k.id || ''))
        ? k.id : P.idVoor + crypto.randomBytes(16).toString('hex');
      k.id = id;
      k.toegang = {
        code_hash: bearer.hash(raw), issuer: k.gastheer || 'legacy', doel: DOEL,
        scope: [...SCOPE], onderwerp: { soort: P.soort, id }, issued_at: issued,
        expires_at: new Date(Date.parse(issued) + GELDIG_MS).toISOString(),
        max_gebruik: MAX_GEBRUIK, gebruik: Math.max(0, (k.leden || []).length - 1),
        laatst_gebruikt_at: null, ingetrokken_at: issued,
        ingetrokken_door: 'legacy-migratie', intrekreden: 'legacy code vereist rotatie',
        rotatie: 1
      };
      k.toegang_historie = [];
      k.gesloten_at = k.gesloten_at || issued;
      delete k.code;
      if (sleutel !== id) { delete kamers[sleutel]; kamers[id] = k; }
    }
  }

  return { nieuw, zoek, reden, gebruik, intrekken, roteer, publiek, migreerLegacy };
};

module.exports.PROFIELEN = PROFIELEN;
module.exports.MAX_GEBRUIK = MAX_GEBRUIK;
