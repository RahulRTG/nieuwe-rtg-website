/* De credential van een festivalgroep.

   De kale code bestaat alleen in het antwoord op uitgifte of rotatie. De
   festivalcollectie bewaart een namespaced SHA-256-hash en de volledige
   lifecycle. Zoeken vergelijkt ieder kandidaat met timingSafeEqual en stopt
   niet zodra er een treffer is. */
'use strict';

const DOEL = 'festivalos-groep';
const SCOPE = ['festival.group.join'];
const MAX_LEDEN = 50;
const MAX_GELDIG_MS = 366 * 86400000;

module.exports = ({ crypto, nu }) => {
  const bearer = require('../bearercode')({ crypto, namespace: 'festival-groep', nu });

  const rijen = festivals => {
    const uit = [];
    for (const f of Object.values(festivals || {})) {
      for (const e of Object.values((f && f.edities) || {})) {
        for (const g of Object.values((e && e.groepen) || {})) uit.push({ f, e, g });
      }
    }
    return uit;
  };

  function eindVan(e, begin) {
    const datums = (Array.isArray(e && e.dagen) ? e.dagen : [])
      .map(d => Date.parse(String((d || {}).datum || '') + 'T23:59:59.999Z'))
      .filter(Number.isFinite);
    const gewenst = datums.length ? Math.max(...datums) + 7 * 86400000
      : Date.parse(begin) + 90 * 86400000;
    return new Date(Math.min(Date.parse(begin) + MAX_GELDIG_MS,
      Math.max(Date.parse(begin) + 1000, gewenst))).toISOString();
  }

  /* Bestaande tien-teken-codes worden bij de eerste autoritatieve
     festivaltransactie hash-only gemaakt en direct ingetrokken. Hun circa
     vijftig bits zijn niet sterk genoeg voor een deur; een groepslid moet de
     code expliciet roteren voordat iemand opnieuw kan aansluiten. */
  function migreerLegacy(festivals) {
    for (const { e, g } of rijen(festivals)) {
      if (!g || !g.code) continue;
      if (!g.toegang) {
        const issuedAt = Number.isFinite(Date.parse(g.at)) ? g.at : nu();
        g.toegang = {
          code_hash: bearer.hash(g.code), issuer: g.maker || 'legacy', doel: DOEL,
          scope: [...SCOPE], onderwerp: { soort: 'festivalgroep', id: g.id },
          issued_at: issuedAt, expires_at: eindVan(e, issuedAt),
          max_gebruik: MAX_LEDEN - 1,
          gebruik: Math.max(0, Math.min(MAX_LEDEN - 1, (g.leden || []).length - 1)),
          laatst_gebruikt_at: null,
          ingetrokken_at: nu(), ingetrokken_door: 'legacy-migratie',
          intrekreden: g.beeindigd ? 'groep beeindigd' : 'legacy code vereist rotatie',
          rotatie: 1
        };
      }
      delete g.code;
    }
  }

  function bestaat(festivals, codeHash) {
    let gevonden = false;
    for (const { g } of rijen(festivals)) {
      if (g && g.toegang && bearer.zelfdeHash(g.toegang.code_hash, codeHash)) gevonden = true;
      for (const oud of (g && Array.isArray(g.toegang_historie) ? g.toegang_historie : [])) {
        if (bearer.zelfdeHash(oud && oud.code_hash, codeHash)) gevonden = true;
      }
    }
    return gevonden;
  }

  function nieuw(festivals, e, g, issuer, rotatie = 1) {
    for (let poging = 0; poging < 8; poging++) {
      const begin = nu();
      const gemaakt = bearer.maak({ prefix: 'GRP', issuer, doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'festivalgroep', id: g.id },
        geldigMs: Date.parse(eindVan(e, begin)) - Date.parse(begin), maxGebruik: MAX_LEDEN - 1 });
      gemaakt.toegang.rotatie = rotatie;
      if (!bestaat(festivals, gemaakt.toegang.code_hash)) return gemaakt;
    }
    return null;
  }

  /* Ook bij een doel-edition loopt de vergelijking langs alle rijen. Het doel
     bepaalt alleen welke treffers bruikbaar zijn; het tijdgedrag onthult niet
     op welke plek in de collectie een hash stond. */
  function zoek(festivals, code, fid, eid) {
    const codeHash = bearer.hash(String(code || '').slice(0, 100));
    const uit = [];
    for (const rij of rijen(festivals)) {
      const gelijk = bearer.zelfdeHash(rij.g && rij.g.toegang && rij.g.toegang.code_hash, codeHash);
      const juistePlek = (!fid && !eid) || (rij.f.id === String(fid) && rij.e.id === String(eid));
      if (gelijk && juistePlek && !rij.g.beeindigd) uit.push(rij);
    }
    return uit;
  }

  const reden = g => g && !g.beeindigd
    ? bearer.reden(g.toegang, { doel: DOEL, scope: SCOPE }) : 'onbekend';
  const gebruik = g => bearer.gebruik(g.toegang);
  const intrekken = (g, actor, waarom) => bearer.intrekken(g.toegang, actor, waarom);
  const publiek = g => {
    const toegang = bearer.publiek(g && g.toegang);
    return toegang ? Object.assign(toegang, { stand: reden(g) ? 'gesloten' : 'actief', reden: reden(g) }) : null;
  };

  function roteer(festivals, e, g, issuer) {
    const vorig = g.toegang;
    const nummer = Math.max(1, Number(vorig && vorig.rotatie) || 1) + 1;
    const gemaakt = nieuw(festivals, e, g, issuer, nummer);
    if (!gemaakt) return null;
    if (vorig) {
      bearer.intrekken(vorig, issuer, 'groepscode geroteerd');
      if (!Array.isArray(g.toegang_historie)) g.toegang_historie = [];
      g.toegang_historie.push(vorig);
      if (g.toegang_historie.length > 20) g.toegang_historie.splice(0, g.toegang_historie.length - 20);
    }
    g.toegang = gemaakt.toegang;
    return gemaakt;
  }

  return { migreerLegacy, nieuw, zoek, reden, gebruik, intrekken, publiek, roteer,
    MAX_LEDEN, DOEL, SCOPE };
};
