/* RTG Festival (deelmodule): DE CODE VAN EEN PAS (festivalos.toegangspas).

   Een pas is een toegangsbewijs op bezit: de poort scant de code van de drager.
   De oude code was tien tekens uit 32 (~50 bits), stond kaal op de pas en werd
   lineair vergeleken. Nu:
   - een 128-bit bearer (kern/bearercode.js), kaal alleen in het antwoord op de
     uitgifte (POST /api/festival/pas, de verkoop) en op het tonen door de
     drager zelf (POST /api/festival/gast/pas/toon, dat roteert); op de pas staat
     alleen `toegang` met de SHA-256;
   - issuer, doel en scope, verval aan het eind van de editie (laatste dag + een
     nacht), max_gebruik = het plafond van de bearerlaag: een weekendpas scant
     vaak, dus binnenkomen wordt GETELD en niet begrensd;
   - intrekken en roteren lopen, net als de scan, in EEN collectietransactie op
     `festivals` (PostgreSQL: advisory lock + FOR UPDATE), zodat twee poorten
     een pas niet tegelijk "binnen" zetten en een intrekking nooit half wint;
   - zoeken vergelijkt elke hash van de editie met timingSafeEqual en stopt niet
     bij een treffer.
   Oude kale codes worden bij de eerste transactie van de pas gehaald en NIET
   gehonoreerd; de drager toont in de app een nieuwe, de organisator kan een
   nieuwe pas uitgeven. Zonder collectietransactie (unittoetsen van de kern)
   draait dezelfde bewerking synchroon op de werkkopie, met herstel bij een fout. */
'use strict';

const DOEL = 'festival-toegang';
const SCOPE = Object.freeze(['festival.poort.scan']);
const PLAFOND = 10000;
const DAG = 86400000;

module.exports = (ctx) => {
  const { db, save, bewerkCollectie, crypto } = ctx;
  const nu = ctx.pasKlok || (() => new Date().toISOString());
  const bearer = require('../bearercode')({ crypto, namespace: 'festivalos.toegangspas', nu });
  const afdruk = s => crypto.createHash('sha256').update('rtg-festivalpas-drager-v1|' + String(s || '')).digest('hex');

  function migreer(bron) {
    for (const f of Object.values(bron || {}))
      for (const e of Object.values((f && f.edities) || {}))
        for (const p of Object.values((e && e.passen) || {}))
          if (p && Object.prototype.hasOwnProperty.call(p, 'code')) { delete p.code; p.codeLegacy = true; if (!p.toegang) p.toegang = null; }
  }
  function transactie(werk) {
    const doe = bron => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('festivals hoort een kaart te zijn');
      migreer(bron);
      return werk(bron);
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('festivals', doe);
    // de collectie is van ./model.js; zonder collectie is er ook geen pas
    const bron = db.data.festivals && typeof db.data.festivals === 'object' ? db.data.festivals : {};
    const voor = JSON.stringify(bron);
    try {
      const uit = doe(bron);
      if (JSON.stringify(bron) !== voor) save();
      return uit;
    } catch (e) {
      for (const k of Object.keys(bron)) delete bron[k];
      Object.assign(bron, JSON.parse(voor));
      throw e;
    }
  }
  const editieIn = (bron, fid, eid) => {
    const f = bron[String(fid || '')];
    return (f && f.edities && f.edities[String(eid || '')]) || null;
  };

  // Geeft de pas een (nieuwe) code; de vorige gaat ingetrokken de historie in.
  function geef(e, p, issuer) {
    const vorig = p.toegang;
    if (vorig) {
      bearer.intrekken(vorig, issuer, 'nieuwe pascode');
      p.toegang_historie = (p.toegang_historie || []).concat([vorig]).slice(-12);
    }
    const eind = Math.max(0, ...(e.dagen || []).map(d => Date.parse(String((d || {}).datum) + 'T23:59:59.999Z')).filter(Number.isFinite));
    const tot = eind ? eind + DAG : Date.parse(nu()) + 90 * DAG;
    const g = bearer.maak({ prefix: 'FP', issuer, doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'festivalpas', id: p.id, drager_hash: afdruk(p.drager) },
      geldigMs: tot - Date.parse(nu()), maxGebruik: PLAFOND });
    g.toegang.rotatie = ((vorig && vorig.rotatie) || 0) + 1;
    p.toegang = g.toegang;
    return g.code;
  }

  // Constant-time: elke pas van de editie wordt vergeleken.
  const opCode = (e, code) => bearer.vind(Object.values((e && e.passen) || {}),
    String(code || '').slice(0, 80), p => p && p.toegang && p.toegang.code_hash);

  // null = de code mag de poort door; anders de reden (ingetrokken, verlopen, ...)
  function reden(p) {
    if (!p || !p.toegang) return 'onbekend';
    const ow = p.toegang.onderwerp || {};
    if (ow.id !== p.id || ow.drager_hash !== afdruk(p.drager)) return 'verkeerd-onderwerp';
    return bearer.reden(p.toegang, { doel: DOEL, scope: SCOPE });
  }
  const telBinnen = p => bearer.gebruik(p.toegang);
  const trekIn = (p, door, waarom) => { if (p.toegang) bearer.intrekken(p.toegang, door, waarom); };

  const beeld = p => ({ id: p.id, drager: p.drager, soort: p.soort, product: p.product || null,
    rechten: p.rechten, ingetrokken: !!p.ingetrokken, redenIntrekking: p.redenIntrekking || null,
    at: p.at, codeLegacy: !!p.codeLegacy, toegang: bearer.publiek(p.toegang) });

  return { transactie, editieIn, geef, opCode, reden, telBinnen, trekIn, beeld, afdruk, DOEL, SCOPE };
};
module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
