/* Credentiallevensloop van een LivingOS Samen-kamer. */
'use strict';

const DOEL = 'livingos-samen-kamer';
const SCOPE = ['samen.join'];
const GELDIG_MS = 12 * 3600000;
const MAX_GEBRUIK = 11;

module.exports = ({ crypto, nu = () => new Date().toISOString() }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'livingos-samen-kamer', nu });
  const alle = kamers => Object.values(kamers || {}).filter(Boolean);
  const historie = k => Array.isArray(k && k.toegang_historie) ? k.toegang_historie : [];

  /* Bearercode v2 met precies het oude gedrag: twaalf uur, elf toetreders
     naast de gastheer, en de code IS de deur (er ontstaat geen sessie). */
  const spec = (k, issuer) => ({ prefix: 'SAMEN', issuer, doel: DOEL, scope: SCOPE,
    onderwerp: { soort: 'samen-kamer', id: k.id }, geldigheid: { duurMs: GELDIG_MS },
    gebruik: { max: MAX_GEBRUIK }, afgeleid: 'geen' });

  /* Een nieuwe hash mag nergens anders staan, ook niet in de historie. */
  function uniek(kamers, maakEen) {
    const rijen = alle(kamers);
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = maakEen();
      const dubbel = rijen.some(x => bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash,
        gemaakt.toegang.code_hash) || historie(x).some(h =>
        bearer.zelfdeHash(h && h.code_hash, gemaakt.toegang.code_hash)));
      if (!dubbel) return gemaakt;
    }
    return null;
  }

  function nieuw(kamers, k, issuer) {
    k.toegang_historie = [];
    return uniek(kamers, () => bearer.maak(spec(k, issuer)));
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

  /* VERNIEUWEN en niet roteren: de gastheer krijgt een nieuwe kamercode met
     weer twaalf uur en elf plaatsen, zoals altijd. Volgnummer, geschiedenis en
     de intrekking van de oude komen uit kern/bearercode-keten.js; de uitgever
     blijft wie de code eerst uitgaf, de gastheer van nu staat er als `door`. */
  function roteer(kamers, k, actor) {
    const oud = k.toegang;
    const gemaakt = uniek(kamers, () => bearer.vernieuw(oud, spec(k, oud.issuer), actor));
    k.toegang_historie = historie(k);
    k.toegang_historie.push({ code_hash: oud.code_hash,
      ingetrokken_at: oud.ingetrokken_at, rotatie: oud.rotatie || 1 });
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
      const id = /^sk[a-f0-9]{32}$/i.test(String(k.id || ''))
        ? k.id : 'sk' + crypto.randomBytes(16).toString('hex');
      k.id = id;
      k.toegang = {
        code_hash: bearer.hash(raw), issuer: k.gastheer || 'legacy', doel: DOEL,
        scope: [...SCOPE], onderwerp: { soort: 'samen-kamer', id }, issued_at: issued,
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

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.GELDIG_MS = GELDIG_MS;
module.exports.MAX_GEBRUIK = MAX_GEBRUIK;
