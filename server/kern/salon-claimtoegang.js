/* Credentialvorm en legacy-afbouw voor Salon-claims. De handelingen staan in
   salon-claimcode.js; dit bestand bezit alleen de hash-, doel- en
   levenscyclusregels die uitgifte, rotatie en verzilvering exact delen. */
'use strict';

const DOEL = 'salon-aanbieding-verzilveren';
const SCOPE = ['salon.deal.verzilveren'];
const JAAR = 366 * 86400000;

module.exports = ({ crypto, nu }) => {
  const iso = t => new Date(t == null ? nu() : t).toISOString();
  const bearer = require('./bearercode')({ crypto, namespace: 'salon-deal-claim', nu: () => iso() });
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const gelijk = (a, b) => bearer.zelfdeHash(a, b);
  const lidHash = key => afdruk('salon-claim-lid-v1|' + String(key || ''));
  const rijen = bron => Array.isArray(bron) ? bron : [];
  const claims = p => p && p.deal && Array.isArray(p.deal.claims) ? p.deal.claims : [];
  const historie = c => Array.isArray(c && c.historie) ? c.historie : [];
  const idem = waarde => {
    const s = String(waarde || '').trim();
    return s.length >= 16 && s.length <= 200 ? s : null;
  };
  const aanbiedingGeldig = p => !(p.deal.geldigTot &&
    Date.parse(p.deal.geldigTot + 'T23:59:59.999Z') < nu());
  const geldigMs = p => {
    const einde = p.deal.geldigTot ? Date.parse(p.deal.geldigTot + 'T23:59:59.999Z') : nu() + JAAR;
    return Math.max(1000, Math.min(JAAR, einde - nu()));
  };
  const onderwerp = (p, c) => ({ soort: 'salon-deal-claim', id: c.id,
    post_id: String(p.id), partner_code: String(p.partnerCode || ''), lid_hash: lidHash(c.key) });
  const onderwerpKlopt = (p, c) => {
    const o = c && c.toegang && c.toegang.onderwerp;
    return !!(o && o.soort === 'salon-deal-claim' && o.id === c.id &&
      o.post_id === String(p.id) && o.partner_code === String(p.partnerCode || '') &&
      gelijk(o.lid_hash, lidHash(c.key)));
  };
  function vindPost(posts, postId) {
    const id = Number(postId);
    return Number.isFinite(id) ? posts.find(p => Number(p && p.id) === id) || null : null;
  }
  function vindVanLid(p, key) {
    const h = lidHash(key);
    return claims(p).find(c => c && ((c.key && c.key === key) ||
      (c.toegang && c.toegang.onderwerp && gelijk(c.toegang.onderwerp.lid_hash, h)))) || null;
  }
  function bestaat(posts, id, codeHash, negeer) {
    let botsing = false;
    for (const p of posts) for (const c of claims(p)) {
      if (c === negeer) continue;
      if (c && c.id === id) botsing = true;
      if (gelijk(c && c.toegang && c.toegang.code_hash, codeHash)) botsing = true;
      for (const oud of historie(c)) if (gelijk(oud && oud.code_hash, codeHash)) botsing = true;
    }
    return botsing;
  }
  function maakToegang(posts, p, c) {
    for (let poging = 0; poging < 8; poging++) {
      c.id = c.id || 'sc_' + crypto.randomBytes(16).toString('hex');
      const gemaakt = bearer.maak({ prefix: 'SAL', issuer: 'salon:' + p.partnerCode,
        doel: DOEL, scope: SCOPE, onderwerp: onderwerp(p, c),
        geldigMs: geldigMs(p), maxGebruik: 1 });
      if (!bestaat(posts, c.id, gemaakt.toegang.code_hash, c)) return gemaakt;
      c.id = null;
    }
    throw new Error('Kon geen unieke Salon-claimcredential maken.');
  }
  function stand(p, c) {
    if (!c) return null;
    if (c.status === 'legacy-gesloten') return 'legacy-gesloten';
    if (!onderwerpKlopt(p, c)) return 'ongeldig';
    const reden = bearer.reden(c.toegang, { doel: DOEL, scope: SCOPE });
    if (c.verzilvering || reden === 'opgebruikt') return 'verzilverd';
    if (reden === 'ingetrokken') return 'ingetrokken';
    if (reden === 'verlopen') return 'verlopen';
    return reden ? 'ongeldig' : 'actief';
  }
  const publiek = (p, c) => c ? { status: stand(p, c), issued_at: c.toegang && c.toegang.issued_at,
    expires_at: c.toegang && c.toegang.expires_at,
    gebruikt_at: c.verzilvering && c.verzilvering.at,
    ingetrokken_at: c.toegang && c.toegang.ingetrokken_at,
    rotatie: c.toegang && c.toegang.rotatie } : null;

  function migreerLegacy(posts) {
    let gewijzigd = false;
    for (const p of rijen(posts)) for (const c of claims(p)) {
      if (!c || !Object.prototype.hasOwnProperty.call(c, 'code')) continue;
      const raw = c.code;
      c.id = c.id || 'legacy_' + afdruk(String(p.id) + '|' + String(c.key) + '|' + String(raw)).slice(0, 32);
      const op = c.at && Number.isFinite(Date.parse(c.at)) ? c.at : iso();
      c.toegang = { code_hash: bearer.hash(raw), issuer: 'salon:' + String(p.partnerCode || ''),
        doel: DOEL, scope: [...SCOPE], onderwerp: onderwerp(p, c), issued_at: op,
        expires_at: iso(Math.max(nu(), Date.parse(op)) + 1000), max_gebruik: 1,
        gebruik: c.used ? 1 : 0, laatst_gebruikt_at: c.usedAt || null,
        ingetrokken_at: iso(), ingetrokken_door: 'legacy-migratie',
        intrekreden: 'oude korte of kaal opgeslagen Salon-code gesloten', rotatie: 1 };
      c.historie = historie(c); c.status = c.used ? 'verzilverd' : 'legacy-gesloten';
      if (c.used) c.verzilvering = c.verzilvering || { idem_hash: afdruk('legacy|' + c.id),
        fingerprint_hash: afdruk('legacy-code|' + bearer.hash(raw)), actor_hash: null,
        at: c.usedAt || iso() };
      delete c.code; delete c.used; delete c.usedAt;
      gewijzigd = true;
    }
    return gewijzigd;
  }

  return { iso, bearer, afdruk, gelijk, lidHash, rijen, claims, historie, idem,
    aanbiedingGeldig, onderwerpKlopt, vindPost, vindVanLid, maakToegang,
    stand, publiek, migreerLegacy, DOEL, SCOPE };
};

module.exports.DOEL = DOEL;
