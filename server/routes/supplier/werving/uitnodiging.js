/* Supplier-personeelsuitnodiging: 128-bit, hash-only en atomair geclaimd. */
'use strict';

const DOEL = 'workos-personeelsuitnodiging';
const SCOPE = ['supplier.staff.join'];
const DAGEN = 30;
const DUBBELTIK_MS = 5000;

module.exports = ({ kern }) => {
  const { accounts, bewerkCollectie, crypto, db, logActivity,
    notifySupplier, save } = kern;
  const bearer = require('../../../kern/bearercode')({
    crypto, namespace: 'supplier-staff-invite'
  });
  const supplierVanCode = code =>
    (db.data.suppliers || []).find(s => s.code === code) || null;
  const idemHash = waarde => crypto.createHash('sha256')
    .update('staff-invite-idem|' + String(waarde || '')).digest('hex');

  function migreerLegacy(bron) {
    for (const [supplierCode, lijst] of Object.entries(bron || {})) {
      if (!Array.isArray(lijst)) { bron[supplierCode] = []; continue; }
      for (const inv of lijst) {
        if (!inv || inv.toegang || !inv.kassacode) continue;
        const issued = Number.isFinite(Date.parse(inv.createdAt))
          ? inv.createdAt : new Date().toISOString();
        inv.id = inv.id || 'sinv-' + crypto.randomBytes(8).toString('hex');
        inv.supplierCode = supplierCode;
        inv.toegang = {
          code_hash: bearer.hash(inv.kassacode), issuer: inv.door || 'legacy', doel: DOEL,
          scope: [...SCOPE], onderwerp: { soort: 'supplier', id: supplierCode },
          issued_at: issued,
          expires_at: new Date(Number(inv.expires) ||
            (Date.parse(issued) + DAGEN * 86400000)).toISOString(),
          max_gebruik: 1, gebruik: inv.used ? 1 : 0,
          laatst_gebruikt_at: inv.usedAt || null,
          /* Een oude korte kassacode wordt niet stil als 128-bit credential
             bestempeld. Hij is direct nutteloos en moet expliciet roteren. */
          ingetrokken_at: issued, ingetrokken_door: 'migratie-n9',
          intrekreden: 'legacy credential vereist rotatie', rotatie: 1
        };
        if (inv.used) inv.claim = { memberId: inv.memberId || null, status: 'voltooid',
          at: inv.usedAt || issued, voltooid_at: inv.usedAt || issued };
        delete inv.kassacode;
        delete inv.expires;
        delete inv.used;
        delete inv.usedAt;
        delete inv.createdAt;
      }
    }
  }

  function transactie(werk) {
    const doe = bron => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron))
        throw new Error('staffInvites hoort een kaart te zijn');
      migreerLegacy(bron);
      return werk(bron);
    };
    if (typeof bewerkCollectie === 'function')
      return bewerkCollectie('staffInvites', doe);
    db.data.staffInvites = db.data.staffInvites && typeof db.data.staffInvites === 'object'
      ? db.data.staffInvites : {};
    const voor = JSON.stringify(db.data.staffInvites);
    const antwoord = doe(db.data.staffInvites);
    if (antwoord && typeof antwoord.then === 'function')
      throw new Error('staffInvites-transactie mag niet asynchroon zijn');
    if (JSON.stringify(db.data.staffInvites) !== voor && typeof save === 'function') save();
    return antwoord;
  }

  const lijstVan = (bron, code) => {
    const c = String(code || '').toUpperCase();
    if (!Array.isArray(bron[c])) bron[c] = [];
    return bron[c];
  };
  const publiek = inv => ({ id: inv.id, naam: inv.naam || null, role: inv.role,
    func: inv.func || null, supplierCode: inv.supplierCode,
    expires: Date.parse(inv.toegang.expires_at), toegang: bearer.publiek(inv.toegang),
    claim: inv.claim ? { status: inv.claim.status, at: inv.claim.at,
      voltooid_at: inv.claim.voltooid_at || null } : null });
  const vindIn = (bron, code) => bearer.vind(
    Object.values(bron).flatMap(x => Array.isArray(x) ? x : []), code,
    inv => inv && inv.toegang && inv.toegang.code_hash);
  const geldig = inv => bearer.reden(inv && inv.toegang,
    { doel: DOEL, scope: SCOPE });
  const herstelGeldig = inv => bearer.reden(inv && inv.toegang,
    { doel: DOEL, scope: SCOPE, negeerGebruik: true });

  function wervingsBasis() {
    const vast = String(process.env.APP_URL || '').trim();
    if (!vast) return process.env.NODE_ENV === 'production'
      ? { ok: false, error: 'APP_URL ontbreekt voor personeelsuitnodigingen.' }
      : { ok: true, basis: '' };
    try {
      const url = new URL(vast);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
          url.search || url.hash)
        return { ok: false, error: 'APP_URL is geen veilige vaste oorsprong.' };
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
        return { ok: false, error: 'APP_URL moet in productie HTTPS gebruiken.' };
      return { ok: true, basis: url.origin };
    } catch (e) { return { ok: false, error: 'APP_URL is geen geldige vaste oorsprong.' }; }
  }

  function wervingsLink(_req, kassacode) {
    const vast = wervingsBasis();
    if (!vast.ok) {
      const fout = new Error(vast.error);
      fout.code = 'RTG_WERVING_APP_URL';
      throw fout;
    }
    return vast.basis + '/apps/app.html#werving=' +
      encodeURIComponent(String(kassacode || ''));
  }

  const ctx = { accounts, db, crypto, bearer, logActivity, notifySupplier,
    transactie, lijstVan, publiek, vindIn, geldig, herstelGeldig, supplierVanCode,
    idemHash, doel: DOEL, scope: SCOPE, dagen: DAGEN, dubbeltikMs: DUBBELTIK_MS };
  return Object.assign({ wervingsBasis, wervingsLink },
    require('./uitnodiging-uitgifte')(ctx), require('./uitnodiging-claim')(ctx));
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
