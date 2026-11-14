/* Serverbronnen voor het individuele aanbod. Browserprijzen, account-id's en
   rolclaims zijn nooit input van de reken- of bevoegdheidsbeslissing. */
'use strict';
const { LOPEND } = require('../commercie/contract');
const { capsVan } = require('../commercie/capaciteiten');
const { abonnementsAanbod } = require('../pasprijs');
const { plan } = require('../commercie/abonnementsverrekening');

module.exports = ({ db, accounts }) => {
  function scopeVoor(accountId, { pas, aanmelding, input = {}, bestaandAanbod, collecties }) {
    if (pas !== 'business-lite' && pas !== 'business')
      return { soort: 'persoon', code: null, capaciteiten: capsVan(pas) };
    // Bestaande zaakmomentopnamen behouden hun eigen grens. Alleen NIEUWE
    // Business-aanbiedingen gebruiken de expliciet menselijk toegelaten org.
    if (pas === 'business' && (!bestaandAanbod || bestaandAanbod.scope.soort === 'organisatie')) {
      const tenantLezer = require('../tenant/lezen')({ db: collecties ? { data: collecties } : db });
      const code = aanmelding?.besluit?.organisatie, t = typeof code === 'string' && tenantLezer.haal(code);
      if (!aanmelding || aanmelding.accountId !== accountId || !t || t.org !== code || t.actief === false ||
          t.levensloop && t.levensloop.stand !== 'actief')
        return { status: 409, error: 'De menselijke toelating moet de eigen bestaande actieve organisatie vastleggen. Vraag RTG om controle; er wordt niets automatisch omgezet.' };
      return { soort: 'organisatie', code: t.org, capaciteiten: capsVan(pas) };
    }
    const code = String((aanmelding && aanmelding.gezaakt && aanmelding.gezaakt.code) || input.zaakCode || '').toUpperCase();
    if (code) {
      const posities = accounts.listStaff(code);
      if (!posities.some(s => Number(s.member_id) === accountId && s.role === 'manager'))
        return { status: 403, error: 'Alleen de bevoegde beheerder kan het bedrijfsabonnement aanvaarden.' };
      if (!(db.data.suppliers || []).some(s => s.code === code))
        return { status: 409, error: 'De gekoppelde zaak ontbreekt.' };
    } else if (!aanmelding || !aanmelding.bedrijf) {
      return { status: 409, error: 'Vul eerst de eigen bedrijfsaanvraag in.' };
    }
    return { soort: 'zaak', code: code || null, capaciteiten: capsVan(pas) };
  }
  function prijsVoor(pas, { frequentie, aanmelding }) {
    const md = aanmelding && accounts.getMemberState(Number(aanmelding.accountId));
    return abonnementsAanbod(pas, { frequentie, aanmelding, btwProfiel: (md && md.btwProfiel) || 'nl-21' });
  }
  function verrekeningVoor(accountId, { contracten, aanmeldingen, op, doelCenten, scope, pas }) {
    const eigen = new Set(aanmeldingen.filter(a => Number(a.accountId) === accountId).map(a => String(a.id)));
    const kandidaten = contracten.filter(c => eigen.has(String(c.aanmeldingId)) && LOPEND.has(c.status) &&
      (!c.eindigtOp || Date.parse(c.eindigtOp) > Date.parse(op)) &&
      (scope.soort === 'persoon' ? !c.aanbod || c.aanbod.scope.soort === 'persoon'
        : c.aanbod?.scope?.soort === scope.soort &&
          (scope.soort === 'zaak' ? c.zaakCode || c.aanbod.scope.code : c.organisatieCode || c.aanbod.scope.code) === scope.code));
    if (kandidaten.length > 1) return { status: 409, error: 'Meerdere lopende afspraken vragen eerst controle; er is niets verrekend.' };
    if (!kandidaten.length) return { ok: true, bronContractId: null, regels: [], creditCenten: 0, teBetalenCenten: doelCenten, overCenten: 0 };
    const c = kandidaten[0], md = accounts.getMemberState(accountId);
    const ladder = require('../pasladder').LADDER;
    if (ladder.findIndex(t => t.id === pas) < ladder.findIndex(t => t.id === c.pas))
      return { status: 409, error: 'Dit is een lagere pas, geen directe upgrade. Uw bestaande afspraak blijft gelden; gebruik opzeggen of vraag RTG om een passende vervolgafspraak.' };
    if (Object.values(db.data.betaalWaarheid || {}).some(w => w.context?.contractId === c.id &&
        !['BEVESTIGD', 'TERUGBETAALD'].includes(w.status)))
      return { status: 409, error: 'Rond eerst de bestaande betaling of betwisting af voordat een nieuwe verrekening wordt aangeboden.' };
    const r = plan({ contract: { ...c, accountId }, facturen: (md && md.invoices) || [],
      betaalWaarheid: db.data.betaalWaarheid || {}, contracten, op, doelCenten });
    return r.ok ? { ...r, bronContractId: c.id }
      : { ...r, status: 409, error: 'De betaalde ongebruikte periode kan niet automatisch worden vastgesteld. RTG moet de bronstukken controleren.' };
  }
  return { scopeVoor, prijsVoor, verrekeningVoor };
};
