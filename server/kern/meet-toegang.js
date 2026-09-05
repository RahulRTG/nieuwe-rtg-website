/* De deelcredential van RTG Meet.

   Een kamercode opent een vergaderruimte en is dus geen kamer-id. De kale
   code verlaat alleen uitgifte/rotatie; Meet bewaart uitsluitend de hash en
   lifecycle. Bestaande zes-teken-codes worden hash-only gemaakt maar meteen
   ingetrokken: hun lage entropie mag na de productiemigratie geen deur meer
   blijven. De gastheer kan vanuit de kamerlijst veilig een nieuwe code maken. */
'use strict';

const DOEL = 'livingos-meet-kamer';
const SCOPE = ['meet.join'];
const GELDIG_MS = 7 * 86400000;
const MAX_GEBRUIK = 12;

module.exports = ({ crypto, nu }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'meet-kamer', nu });

  function migreerLegacy(kamers) {
    for (const k of (Array.isArray(kamers) ? kamers : [])) {
      if (!k || !k.code) continue;
      if (!k.toegang) {
        const begin = Number.isFinite(Date.parse(k.op)) ? k.op : nu();
        k.toegang = {
          code_hash: bearer.hash(k.code), issuer: k.host || 'legacy', doel: DOEL,
          scope: [...SCOPE], onderwerp: { soort: 'meetkamer', id: k.id },
          issued_at: begin,
          expires_at: new Date(Date.parse(begin) + GELDIG_MS).toISOString(),
          max_gebruik: MAX_GEBRUIK,
          gebruik: Math.max(0, Math.min(MAX_GEBRUIK, (k.aanwezig || []).length)),
          laatst_gebruikt_at: null,
          ingetrokken_at: nu(), ingetrokken_door: 'systeem',
          intrekreden: 'legacy kamercode met te lage entropie', rotatie: 1
        };
      }
      if (!Array.isArray(k.toegang_historie)) k.toegang_historie = [];
      delete k.code;
    }
  }

  function bestaat(kamers, codeHash) {
    let ja = false;
    for (const k of (Array.isArray(kamers) ? kamers : [])) {
      if (k && k.toegang && bearer.zelfdeHash(k.toegang.code_hash, codeHash)) ja = true;
      for (const oud of (k && Array.isArray(k.toegang_historie) ? k.toegang_historie : []))
        if (bearer.zelfdeHash(oud && oud.code_hash, codeHash)) ja = true;
    }
    return ja;
  }

  function nieuw(kamers, k, issuer, rotatie = 1) {
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = bearer.maak({ prefix: 'MEET', issuer, doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'meetkamer', id: k.id }, geldigMs: GELDIG_MS,
        maxGebruik: MAX_GEBRUIK });
      gemaakt.toegang.rotatie = rotatie;
      if (!bestaat(kamers, gemaakt.toegang.code_hash)) return gemaakt;
    }
    return null;
  }

  /* Geen index op een bearerhash: vergelijk alle rijen en stop niet bij de
     eerste overeenkomst. Daardoor verraadt het tijdgedrag geen kamerpositie. */
  function zoek(kamers, code) {
    const codeHash = bearer.hash(String(code || '').slice(0, 100));
    let gevonden = null;
    for (const k of (Array.isArray(kamers) ? kamers : [])) {
      const gelijk = bearer.zelfdeHash(k && k.toegang && k.toegang.code_hash, codeHash);
      if (gelijk && !k.gesloten_at) gevonden = k;
    }
    return gevonden;
  }

  const reden = k => k && !k.gesloten_at
    ? bearer.reden(k.toegang, { doel: DOEL, scope: SCOPE }) : 'onbekend';
  const gebruik = k => bearer.gebruik(k.toegang);
  const intrekken = (k, actor, waarom) => bearer.intrekken(k.toegang, actor, waarom);
  const publiek = k => {
    const p = bearer.publiek(k && k.toegang);
    return p ? Object.assign(p, { stand: reden(k) ? 'gesloten' : 'actief', reden: reden(k) }) : null;
  };

  function roteer(kamers, k, issuer) {
    const vorig = k.toegang;
    const nummer = Math.max(1, Number(vorig && vorig.rotatie) || 1) + 1;
    const gemaakt = nieuw(kamers, k, issuer, nummer);
    if (!gemaakt) return null;
    if (vorig) {
      bearer.intrekken(vorig, issuer, 'Meet-code geroteerd');
      if (!Array.isArray(k.toegang_historie)) k.toegang_historie = [];
      k.toegang_historie.push(vorig);
      if (k.toegang_historie.length > 20)
        k.toegang_historie.splice(0, k.toegang_historie.length - 20);
    }
    k.toegang = gemaakt.toegang;
    return gemaakt;
  }

  return { migreerLegacy, nieuw, zoek, reden, gebruik, intrekken, publiek, roteer,
    DOEL, SCOPE, GELDIG_MS, MAX_GEBRUIK };
};
