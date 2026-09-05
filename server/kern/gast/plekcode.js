/* De gedrukte plekcode is een langdurige bearer credential, geen instelling.
   Daarom staat alleen haar afdruk in de opslag en heeft iedere uitgifte een
   eigenaar, doel, scope, eindtijd, intrekking en expliciet rotatiepad. */
'use strict';

const JAAR_MS = 366 * 24 * 60 * 60 * 1000;

module.exports = ({ db, save, crypto, horeca }) => {
  const { H, Hlees, nu } = horeca;
  const afdruk = (waarde) => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const datum = (waarde) => Number.isFinite(Date.parse(waarde)) ? new Date(waarde).toISOString() : null;
  const plusJaar = (waarde) => new Date(Date.parse(waarde) + JAAR_MS).toISOString();
  const uitgever = (wie) => ({
    soort: 'supplier-staff',
    id: String((wie && (wie.staffId || wie.id || wie.naam || wie.name)) || 'onbekend').slice(0, 80)
  });

  function gelijk(a, b) {
    if (!/^[a-f0-9]{64}$/.test(String(a || '')) || !/^[a-f0-9]{64}$/.test(String(b || ''))) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }

  function normaliseer(zaakcode, plek, rij) {
    if (!rij || typeof rij !== 'object') return false;
    const voor = JSON.stringify(rij);
    if (!rij.hash && rij.token) rij.hash = afdruk(rij.token);
    delete rij.token;
    rij.soort = rij.soort === 'kamer' ? 'kamer' : 'tafel';
    rij.issuedAt = datum(rij.issuedAt) || datum(rij.at) || nu();
    rij.expiresAt = datum(rij.expiresAt) || plusJaar(rij.issuedAt);
    rij.issuer = rij.issuer || { soort: 'migratie', id: 'legacy' };
    rij.purpose = 'gast-horeca-plek';
    rij.scope = { zaakcode: String(zaakcode), plek: String(plek), soort: rij.soort };
    rij.maxUses = Number.isInteger(rij.maxUses) && rij.maxUses > 0 ? rij.maxUses : null;
    rij.useCount = Math.max(0, Number(rij.useCount) || 0);
    rij.revokedAt = datum(rij.revokedAt);
    return voor !== JSON.stringify(rij);
  }

  function migreerLeesbareCodes() {
    let gewijzigd = false;
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      const qr = (doos.instel && doos.instel.qr) || {};
      for (const [plek, rij] of Object.entries(qr)) gewijzigd = normaliseer(zaakcode, plek, rij) || gewijzigd;
    }
    if (gewijzigd) save();
  }

  const actief = (rij) => !!rij && !rij.revokedAt && Date.parse(rij.expiresAt) > Date.parse(nu()) &&
    (rij.maxUses == null || rij.useCount < rij.maxUses);
  const publiek = (rij) => ({
    issuedAt: rij.issuedAt, expiresAt: rij.expiresAt, issuer: rij.issuer,
    purpose: rij.purpose, scope: rij.scope, maxUses: rij.maxUses,
    useCount: rij.useCount, revokedAt: rij.revokedAt
  });

  function bewaarOude(h, plek, rij, reden, door) {
    if (!rij) return;
    if (!Array.isArray(h.instel.qrHistorie)) h.instel.qrHistorie = [];
    h.instel.qrHistorie.unshift(Object.assign(publiek(rij), {
      plek, hash: rij.hash, revokedAt: rij.revokedAt || nu(), revokedBy: uitgever(door),
      revokeReason: String(reden || 'rotatie').slice(0, 120)
    }));
    h.instel.qrHistorie = h.instel.qrHistorie.slice(0, 250);
  }

  function geefUit(zaakcode, naam, { soort = 'tafel', vernieuw = false, door = null } = {}) {
    if (!['tafel', 'kamer'].includes(soort)) return { status: 400, error: 'Een QR hoort bij een tafel of een kamer.' };
    const plek = String(naam || '').trim();
    if (!plek) return { status: 400, error: soort === 'kamer' ? 'Voor welke kamer?' : 'Voor welke tafel?' };
    const h = H(zaakcode);
    if (!h.instel.qr) h.instel.qr = {};
    const bestaand = h.instel.qr[plek];
    if (bestaand) normaliseer(zaakcode, plek, bestaand);
    if (bestaand && !vernieuw) {
      if (!actief(bestaand)) return { status: 409, code: 'qr-vernieuwen', error: 'Deze plekcode is verlopen of ingetrokken. Geef een nieuwe code uit.' };
      return Object.assign({ plek, tafel: plek, soort: bestaand.soort, token: null,
        bestaand: true, herdrukbaar: false }, publiek(bestaand));
    }
    if (bestaand) bewaarOude(h, plek, bestaand, 'rotatie', door);
    const token = crypto.randomBytes(16).toString('hex');
    const issuedAt = nu();
    const rij = {
      hash: afdruk(token), soort, issuedAt, expiresAt: plusJaar(issuedAt), issuer: uitgever(door),
      purpose: 'gast-horeca-plek', scope: { zaakcode: String(zaakcode), plek, soort },
      maxUses: null, useCount: 0, revokedAt: null
    };
    h.instel.qr[plek] = rij;
    save();
    return Object.assign({ plek, tafel: plek, soort, token, vernieuwd: !!bestaand,
      bestaand: false, herdrukbaar: true }, publiek(rij));
  }

  function trekIn(zaakcode, naam, { door = null, reden = null } = {}) {
    const plek = String(naam || '').trim();
    const h = Hlees(zaakcode);
    const rij = h.instel && h.instel.qr && h.instel.qr[plek];
    if (!rij) return { status: 404, error: 'Voor deze plek bestaat geen code.' };
    normaliseer(zaakcode, plek, rij);
    if (!rij.revokedAt) {
      rij.revokedAt = nu();
      rij.revokedBy = uitgever(door);
      rij.revokeReason = String(reden || 'handmatig ingetrokken').slice(0, 120);
      save();
    }
    return Object.assign({ ok: true, plek, soort: rij.soort }, publiek(rij));
  }

  function vind(token) {
    const invoer = String(token || '').trim();
    if (invoer.length < 12) return null;
    const hash = afdruk(invoer);
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      const qr = (doos.instel && doos.instel.qr) || {};
      for (const [plek, rij] of Object.entries(qr)) {
        normaliseer(zaakcode, plek, rij);
        if (!gelijk(rij.hash, hash)) continue;
        if (!actief(rij)) return null;
        rij.useCount += 1;
        rij.lastUsedAt = nu();
        save();
        return { zaakcode, plek, tafel: plek, soort: rij.soort };
      }
    }
    return null;
  }

  migreerLeesbareCodes();
  return { geefUit, trekIn, vind, afdruk, actief, JAAR_MS };
};
