/* Geen organisatieledger: één bestaande overeenkomst geeft productrechten
   aan de actuele, uitsluitend door de tenant-owner beheerde bindingen. Rollen
   blijven waar ze waren. Een losse zaakovereenkomst wordt nooit stil vervangen. */
'use strict';
const { aanbodGeldig } = require('../aanmeldingen/abonnementsaanbod-vorm');
const ISO = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const LOPEND = ['ACTIEF', 'VERLENGBAAR', 'OPZEGGEND'];
const fout = reden => ({ ok: false, controleNodig: true, status: 409, error: reden });

module.exports = ({ db, nu }) => {
  const lezen = require('../tenant/lezen')({ db });
  const alle = () => Array.isArray(db.data.contracten) ? db.data.contracten : [];
  const tijd = () => new Date(nu()).getTime();
  function scope(c, org) {
    return c?.automatischAbonnement === true && c.pas === 'business' &&
      c.aanbod?.scope?.soort === 'organisatie' && c.aanbod.scope.code === org;
  }
  function vervangen(oud, c) {
    return oud?.id !== c.id && oud?.status === 'GEEINDIGD' && oud.vervangenDoor === c.id &&
      oud.accountId === c.accountId && oud.eindigtOp === c.activering?.at &&
      c.verrekening?.status === 'TOEGEPAST' && c.verrekening.bronContractId === oud.id &&
      c.aanbod?.verrekening?.bronContractId === oud.id;
  }
  function einde(c) {
    return c?.status === 'GEEINDIGD' && !c.vervangenDoor && ISO(c.eindigtOp) && Date.parse(c.eindigtOp) <= tijd();
  }
  const zaakClaims = code => lezen.alle().filter(t => Array.isArray(t.zaken) && t.zaken.includes(code));
  function controleZaak(code) {
    if (code == null) return { ok: true }; // een nieuwe, nog ongebonden zaak
    if (typeof code !== 'string' || !code.trim()) return fout('De zaak voor deze afzonderlijke verplichting ontbreekt.');
    const sleutel = code.trim().toUpperCase(), claims = zaakClaims(sleutel), tenant = lezen.vanZaak(sleutel);
    if (claims.length && !tenant) return fout('De organisatiebinding van deze zaak is niet eenduidig.');
    if (!tenant) return { ok: true };
    const vrijVoorstel = c => c.status === 'GEEINDIGD' && !c.activering && !c.organisatieCode &&
      c.verrekening?.status === 'VRIJGEGEVEN' && c.intrekking?.reden === 'eigen-voorstel-voor-betaalstart' &&
      ISO(c.intrekking.at) && Date.parse(c.intrekking.at) <= tijd();
    const contracten = alle().filter(c => scope(c, tenant.org) || c?.organisatieCode === tenant.org);
    function gesloten(c, gezien = new Set()) {
      if (einde(c) || vrijVoorstel(c)) return true;
      if (gezien.has(c.id) || gezien.size >= 64) return false;
      const opvolgers = contracten.filter(n => scope(n, tenant.org) && aanbodGeldig(n) && vervangen(c, n));
      return opvolgers.length === 1 && gesloten(opvolgers[0], new Set([...gezien, c.id]));
    }
    if (contracten.some(c => !gesloten(c)))
      return fout('Deze zaak valt onder een lopend of voorgesteld organisatieabonnement; geen afzonderlijke zaakverplichting zonder controle.');
    return { ok: true };
  }
  function eigenZaakbinding(code) {
    const rij = db.data.zaakAbonnement?.[code];
    const rows = alle().filter(c => c.id === rij?.contractId);
    if (rows.length !== 1) return false;
    const c = rows[0];
    return c.automatischAbonnement === true && c.pas === rij.pas && aanbodGeldig(c) &&
      c.aanbod.scope.soort === 'zaak' && c.zaakCode === code &&
      (!c.aanbod.scope.code || c.aanbod.scope.code === code) &&
      ISO(c.activering?.at) && Date.parse(c.activering.at) <= tijd();
  }
  function controle(c, { voorstel = false } = {}) {
    const org = c?.aanbod?.scope?.code, tenant = lezen.haal(org);
    if (!scope(c, org) || !aanbodGeldig(c) || !tenant || tenant.actief === false ||
        !Array.isArray(tenant.zaken) || !Array.isArray(tenant.werkruimtes) ||
        voorstel && tenant.levensloop?.stand && tenant.levensloop.stand !== 'actief')
      return fout('De bestaande actieve organisatie en onveranderlijke Business-overeenkomst zijn niet bewezen.');
    const exacteBron = oud => vervangen(oud, c) || voorstel && oud?.accountId === c.accountId &&
      LOPEND.includes(oud.status) && c.aanbod.verrekening.bronContractId === oud.id &&
      (!oud.eindigtOp || ISO(oud.eindigtOp) && Date.parse(oud.eindigtOp) > tijd());
    for (const code of tenant.zaken) {
      if (lezen.vanZaak(code) !== tenant) return fout('Een zaak is niet eenduidig aan deze organisatie gebonden.');
      const r = db.data.zaakAbonnement?.[code];
      if (!r) continue;
      const oud = alle().filter(x => x.id === r.contractId);
      if (oud.length !== 1 || !exacteBron(oud[0]) && !einde(oud[0]))
        return fout('Deze organisatie heeft nog een afzonderlijk zaakabonnement; een exacte upgradeovereenkomst of controle is nodig.');
    }
    const pendingMeenemen = voorstel || c.organisatieCode !== org;
    const anderen = alle().filter(x => x.id !== c.id && scope(x, org) &&
      (x.organisatieCode === org || LOPEND.includes(x.status) ||
        pendingMeenemen && ['AANGEBODEN', 'GEACCEPTEERD'].includes(x.status)));
    if (anderen.some(x => !exacteBron(x) && !einde(x)))
      return fout('Er bestaat al een andere organisatieovereenkomst; een exacte upgradeovereenkomst of controle is nodig.');
    return { ok: true, tenant };
  }
  function vanOrganisatie(org) {
    const tenant = lezen.haal(org), code = String(org || '').trim().toUpperCase();
    const rows = alle().filter(c => scope(c, code) && c.organisatieCode === code);
    if (!rows.length) return null;
    let top = rows.filter(c => !rows.some(n => vervangen(c, n)));
    if (top.length > 1) {
      const nietEinde = top.filter(c => !einde(c));
      // Een nieuwe overeenkomst na normaal einde heeft geen upgradepijl. De
      // aantoonbaar geëindigde historie blijft bewaard maar is geen tweede pas.
      top = nietEinde.length ? nietEinde : top.sort((a, b) => b.eindigtOp.localeCompare(a.eindigtOp)).slice(0, 1);
    }
    if (top.length !== 1 || !tenant) return { ...fout('De geactiveerde organisatiebinding vraagt controle.'), tenant, contract: null };
    const c = top[0], r = controle(c);
    if (!r.ok || !ISO(c.activering?.at) || Date.parse(c.activering.at) > tijd())
      return { ...(r.ok ? fout('De organisatieactivering is niet bewezen.') : r), tenant, contract: c };
    return { ok: true, tenant, contract: c };
  }
  function vanZaak(code) {
    const sleutel = String(code || '').trim().toUpperCase(), tenant = lezen.vanZaak(sleutel);
    // Na een normaal org-einde kan een afzonderlijk, opnieuw gesloten
    // zaakcontract volgen. Dat is geen automatische downgrade of creditoverzet.
    if (tenant && controleZaak(sleutel).ok && eigenZaakbinding(sleutel)) return null;
    if (tenant) return vanOrganisatie(tenant.org);
    // Een onleesbare/dubbele tenantbinding is geen aanleiding voor legacyrechten.
    const claims = zaakClaims(sleutel);
    if (claims.some(t => alle().some(c => scope(c, t.org) && c.organisatieCode === t.org)))
      return { ...fout('De organisatiebinding van deze zaak is niet eenduidig.'), tenant: null, contract: null };
    return null;
  }
  function zaken() {
    return [...new Set(lezen.alle().filter(t => vanOrganisatie(t.org))
      .flatMap(t => Array.isArray(t.zaken) ? t.zaken : []))];
  }
  return { controle, controleZaak, vanOrganisatie, vanZaak, zaken };
};
