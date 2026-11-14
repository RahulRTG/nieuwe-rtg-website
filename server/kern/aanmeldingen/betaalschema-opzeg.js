/* De bestaande opzeg-eigenaar, nu op exacte contractbinding. Betaalstart en
   opzegging delen de contract-/schemaverzameling; geen bestaande provider-
   opdracht, factuur of betalingsbewijs wordt door opzeggen gewist. */
'use strict';
const { maakContracten } = require('../commercie/contract');
const VORM = { contracten: 'lijst', aanmeldingen: 'lijst', lidmaatschapBetalingen: 'lijst', betaalWaarheid: 'kaart' };
const fout = (status, error) => ({ status, error });
module.exports = ({ db, save, nu, bewerkCollectie }) => {
  function pasToe(waarden, aanmeldingId, b, motor) {
    const rijen = waarden.lidmaatschapBetalingen.filter(r => r.aanmeldingId === aanmeldingId &&
      (!b.contractId || r.contractId === b.contractId));
    if (rijen.length !== 1) return fout(409, 'Kies de exacte overeenkomst; deze aanmelding heeft geen eenduidig betaalschema.');
    const rij = rijen[0], c = motor.vind(rij.contractId);
    if (!c || c.aanmeldingId !== aanmeldingId) return fout(404, 'De gekoppelde overeenkomst ontbreekt.');
    if (c.automatischAbonnement && !b.contractId) return fout(409, 'De exacte overeenkomst is vereist voor opzegging.');
    if (b.accountId != null) {
      const a = waarden.aanmeldingen.find(x => x.id === aanmeldingId && Number(x.accountId) === b.accountId);
      if (!a || c.accountId != null && c.accountId !== b.accountId) return fout(404, 'De eigen overeenkomst ontbreekt.');
    }
    if (!motor.LOPEND.has(c.status)) return fout(409, 'Deze overeenkomst loopt niet meer.');
    if (typeof b.controle === 'function') {
      const error = b.controle(c, motor);
      if (error) return fout(409, error);
    }
    if (!Array.isArray(rij.termijnen)) return fout(409, 'Het betaalschema vraagt controle.');
    if (c.status === motor.STATUS.OPZEGGEND) return { ok: true, alOpgezegd: true,
      contract: motor.publiek(c), eindigtOp: c.eindigtOp, vervallen: 0 };
    const r = motor.zegOp(c);
    if (r.error) return fout(400, r.error);
    const opdrachten = Object.values(waarden.betaalWaarheid || {}).filter(w => w?.context?.contractId === c.id);
    const gestart = t => t.status !== 'gepland' || t.betaalWaarheidId || t.invoiceId || t.setup || t.providerId || t.betaaldAt ||
      opdrachten.some(w => w.context?.invoiceId === t.invoiceId || w.context?.termijn === (t.nr ?? t.maand));
    const voor = rij.termijnen.length;
    rij.termijnen = rij.termijnen.filter(t => !Number.isFinite(Date.parse(t.vervalt)) ||
      Date.parse(t.vervalt) < Date.parse(c.eindigtOp) || gestart(t));
    return { ok: true, alOpgezegd: false, contract: motor.publiek(c), eindigtOp: c.eindigtOp,
      vervallen: voor - rij.termijnen.length };
  }
  return function zegOpLidmaatschap(id, bevestiging = {}) {
    const aanmeldingId = String(id || ''), b = bevestiging || {};
    if (typeof bewerkCollectie === 'function') {
      try {
        const r = bewerkCollectie(VORM, waarden => {
          const lokaal = { data: waarden };
          return pasToe(waarden, aanmeldingId, b, maakContracten({ db: lokaal, save() {}, nu }));
        });
        return r && typeof r.then === 'function' ? r.catch(() => fout(503, 'De opzegging is niet bevestigd. Controleer de stand en herhaal dezelfde bevestiging.')) : r;
      } catch (_) { return fout(503, 'De opzegging is niet bevestigd. Controleer de stand en herhaal dezelfde bevestiging.'); }
    }
    // De oude interne seed-/legacy-opbouw heeft niet altijd een typed store.
    // Automatische overeenkomsten mogen nooit via die onbeschermde terugval.
    const kandidaten = (db.data.contracten || []).filter(c => c.aanmeldingId === aanmeldingId);
    if (kandidaten.some(c => c.automatischAbonnement)) return fout(503, 'De duurzame opzegroute is niet aangesloten.');
    const r = pasToe({ ...db.data, aanmeldingen: db.data.aanmeldingen || [],
      lidmaatschapBetalingen: db.data.lidmaatschapBetalingen || [] }, aanmeldingId, b,
    maakContracten({ db, save, nu }));
    if (r.ok) save();
    return r;
  };
};
