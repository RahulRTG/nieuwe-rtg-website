/* RTG OV, deelbestand "incheckcode" (travelos.ov_incheckcode): de oplichtende
   code waarmee het personeel van EEN vervoerder een betaalde rit op naam van
   het lid start.

   De oude code was drie random bytes (24 bits), stond kaal in een Map in het
   procesgeheugen -- dus niet gedeeld over instances -- en ELKE OV-zaak kon hem
   verzilveren. Nu:
   - een 128-bit bearer (kern/bearercode.js), kaal alleen in het antwoord op
     POST /api/ov/code; op schijf de SHA-256 in `ovIncheckToegang`, per lid;
   - gebonden aan het lid (houderhash) EN aan de vervoerder die het lid koos:
     issuer, doel en scope, vijf minuten geldig, max_gebruik 1;
   - opnieuw vragen roteert (de vorige gaat ingetrokken de historie in), en het
     lid trekt hem in als het scherm sluit (POST /api/ov/code/intrek);
   - de dienst claimt in EEN collectietransactie (PostgreSQL: advisory lock +
     FOR UPDATE): constant-time zoeken over elke hash, een treffer bij een
     andere vervoerder telt niet, en "al ingecheckt" wordt BINNEN het slot
     gekeurd voordat het gebruik telt. Pas daarna start de rit; zonder claim
     start er geen. */
'use strict';

const DOEL = 'ov-incheck';
const SCOPE = Object.freeze(['ov.dienst.incheck']);
const HISTORIE = 12;

module.exports = (ctx) => {
  const { crypto, bewerkCollectie, CODE_TTL_MS } = ctx;
  const nu = ctx.nu || (() => new Date().toISOString());
  if (typeof bewerkCollectie !== 'function') throw new Error('De OV-incheckcode vereist een collectietransactie.');
  const bearer = require('../bearercode')({ crypto, namespace: 'travelos.ov_incheckcode', nu });
  const houder = key => crypto.createHash('sha256').update('rtg-ov-incheck-houder-v1|' + String(key || '')).digest('hex');
  const transactie = werk => bewerkCollectie('ovIncheckToegang', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('ovIncheckToegang hoort een kaart te zijn');
    return werk(bron);
  });
  const opzij = (r, door, waarom) => {
    if (!r.toegang) return;
    bearer.intrekken(r.toegang, door, waarom);
    r.historie.push(r.toegang);
    if (r.historie.length > HISTORIE) r.historie.splice(0, r.historie.length - HISTORIE);
    r.toegang = null;
  };

  // `zaak` is de vervoerder die het lid koos; het lid is de enige issuer.
  function uitgeven({ key, zaak }) {
    const h = houder(key);
    return transactie(bron => {
      const r = bron[h] || (bron[h] = { houder_hash: h, key, toegang: null, historie: [] });
      const rotatie = Math.max(0, ...[r.toegang, ...r.historie].filter(Boolean).map(t => Number(t.rotatie) || 0)) + 1;
      opzij(r, h, 'nieuwe incheckcode');
      const g = bearer.maak({ prefix: 'OVI', issuer: 'rtg.lid.ov', doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'ov-incheck', houder_hash: h, zaak }, geldigMs: CODE_TTL_MS, maxGebruik: 1 });
      g.toegang.rotatie = rotatie;
      r.toegang = g.toegang;
      return { status: 200, ok: true, eenmalig: true, code: g.code, zaak, geldigS: CODE_TTL_MS / 1000,
        toegang: bearer.publiek(g.toegang) };
    });
  }

  function intrekken({ key }) {
    const h = houder(key);
    return transactie(bron => {
      const r = bron[h];
      if (r) opzij(r, h, 'ingetrokken door het lid');
      return { status: 200, ok: true };
    });
  }

  /* `controleer(key)` draait BINNEN het slot en geeft een weigering of null. */
  function claim({ code, zaak, controleer }) {
    const kale = String(code || '').trim().slice(0, 80);
    if (!kale) return { status: 400, error: 'Geen code.' };
    const gezocht = bearer.hash(kale);
    return transactie(bron => {
      let r = null;
      for (const x of Object.values(bron))
        if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) r = x;
      const t = r && r.toegang, ow = (t && t.onderwerp) || {};
      if (!t || ow.zaak !== zaak || ow.houder_hash !== r.houder_hash || houder(r.key) !== r.houder_hash)
        return { status: 404, error: 'Onbekende of verlopen code.' };
      const reden = bearer.reden(t, { doel: DOEL, scope: SCOPE });
      if (reden) return { status: 404, error: 'Onbekende of verlopen code.' };
      const fout = controleer(r.key);
      if (fout) return fout;
      bearer.gebruik(t);
      opzij(r, zaak, 'verzilverd');
      return { status: 200, ok: true, key: r.key };
    });
  }

  return { uitgeven, intrekken, claim, DOEL, SCOPE };
};
