/* De betaalde zaak gebruikt dezelfde planning en abonnementeigenaar. Eerst
   een duurzame reservering, dan de idempotente account-owner, dan de koppeling.
   Een onderbreking laat een offline zaak met dezelfde code herstelbaar achter. */
'use strict';
const planZaak = require('./bedrijf-plan');
const { maakZaakabonnement } = require('../commercie/zaakabonnement');
const { aanbodGeldig } = require('./abonnementsaanbod-vorm');
const VORM = { contracten: 'lijst', aanmeldingen: 'lijst', suppliers: 'lijst', bedrijfsWensen: 'kaart', zaakAbonnement: 'kaart', tenants: 'kaart' };
const stop = (error, status = 409) => { throw Object.assign(new Error(error), { status }); };
const iso = t => typeof t === 'string' && Number.isFinite(Date.parse(t));

module.exports = ({ db, bewerkCollectie, accounts, nu, kap, bewijsKlaar }) => {
  function bron(data, id) {
    const c = data.contracten.find(c => c.id === id && c.automatischAbonnement === true);
    if (!c || !Number.isSafeInteger(c.accountId) || c.accountId < 1 || !['ACTIEF', 'OPZEGGEND'].includes(c.status) ||
        !iso(c.activering?.at) || Date.parse(c.activering.at) > Date.parse(nu()) ||
        c.eindigtOp && (!iso(c.eindigtOp) || Date.parse(c.eindigtOp) <= Date.parse(nu()))) stop('Een bewezen lopende activering ontbreekt.');
    if (!aanbodGeldig(c) || !['zaak', 'organisatie'].includes(c.aanbod.scope.soort) ||
        !['business-lite', 'business'].includes(c.pas) || c.aanbod.scope.soort === 'organisatie' && c.pas !== 'business')
      stop('De onveranderlijke overeenkomst bevat geen zakelijk abonnement.');
    const a = data.aanmeldingen.find(a => a.id === c.aanmeldingId && a.accountId === c.accountId && a.pas === c.pas);
    if (!a || a.status !== 'geaccepteerd' || !a.bedrijf) stop('De eigen geaccepteerde bedrijfsaanvraag ontbreekt.');
    if (!bewijsKlaar(a)) stop('Een medewerker moet eerst het vereiste geldige beroepsbewijs aftekenen.');
    if (c.pas === 'business' && (!a.besluit || a.besluit.besluit !== 'geaccepteerd' ||
        typeof a.besluit.door !== 'string' || a.besluit.door.trim().length < 2 ||
        /gedeelde code|RTG-personeel|^AI$|getekend en betaald contract/i.test(a.besluit.door) || !iso(a.besluit.at)))
      stop('Business vereist herleidbare menselijke toelating.', 403);
    const lid = accounts.getUserById(c.accountId);
    if (!lid || !accounts.isActief(lid)) stop('De aanvrager heeft geen actief persoonlijk RTG-account.', 403);
    return { c, a, lid };
  }
  const managers = (code, id) => accounts.listStaff(code).filter(s => s.role === 'manager' && Number(s.member_id) === id);
  async function provisioneerAutomatisch(id) {
    if (typeof bewerkCollectie !== 'function')
      return { status: 503, error: 'De duurzame bedrijfs- of accounteigenaar is nog niet aangesloten.' };
    try {
      const r = await bewerkCollectie(VORM, data => {
        const { c, a, lid } = bron(data, id), scopeCode = c.aanbod.scope.code;
        if (c.aanbod.scope.soort === 'organisatie') {
          if (a.besluit.organisatie !== scopeCode || c.organisatieCode && c.organisatieCode !== scopeCode)
            stop('De menselijke toelating en organisatiebinding moeten exact overeenkomen.', 403);
          const r = require('../commercie/organisatieabonnement')({ db: { data }, nu }).controle(c);
          if (!r.ok) stop(r.error);
          c.organisatieCode = scopeCode;
          return { ok: true, organisatieCode: scopeCode, toegang: 'bestaande-organisatierollen' };
        }
        if (typeof accounts?.maakEigenaarEenmaal !== 'function')
          stop('De duurzame accounteigenaar is nog niet aangesloten.', 503);
        let code = c.zaakCode || a.gezaakt?.code || scopeCode;
        if (scopeCode && code !== scopeCode || a.gezaakt && code !== a.gezaakt.code)
          stop('De zaakbinding is veranderd; menselijke controle nodig.');
        if (code) {
          if (!data.suppliers.some(s => s.code === code)) stop('De gereserveerde of bestaande zaak ontbreekt.');
          // Alleen de eigen reservering mag een nog niet bestaande manager afmaken.
          const eigenReservering = c.zaakCode === code && a.gezaakt?.contractId === c.id;
          if (!eigenReservering && managers(code, c.accountId).length !== 1)
            stop('Alleen de bestaande eigen beheerder kan dit zaakabonnement activeren.', 403);
          if (!a.gezaakt) a.gezaakt = { code, staffId: managers(code, c.accountId)[0].id, at: nu() };
        } else {
          const p = planZaak(a, data.suppliers, nu()); code = p.code;
          data.suppliers.push(p.supplier);
          if (p.wensen.length) data.bedrijfsWensen[code] = p.wensen;
          a.gezaakt = { code, staffId: null, at: nu(), contractId: c.id };
        }
        c.zaakCode = code;
        const za = maakZaakabonnement({ db: { data }, save() {}, nu });
        const bestaand = za.van(code);
        if (bestaand.herkomst !== 'vastgelegd' || bestaand.contractId !== c.id || bestaand.pas !== c.pas) {
          const gezet = za.zet(code, c.pas, 'abonnement:' + c.id, c.id);
          if (!gezet.ok) stop(gezet.error);
        }
        a.bijgewerkt = nu();
        return { code, memberId: c.accountId, memberTier: lid.tier, name: kap(a.naam, 60) || 'Eigenaar', staffId: a.gezaakt.staffId };
      });
      if (r.organisatieCode) return r;
      // Deze owner serialiseert read/create in de gezaghebbende accountstore.
      const st = await accounts.maakEigenaarEenmaal({ supplierCode: r.code, memberId: r.memberId,
        name: r.name, memberTier: r.memberTier, verwachtStaffId: r.staffId });
      if (!st || !Number.isSafeInteger(Number(st.id)) || Number(st.id) <= 0 || st.supplier_code !== r.code ||
          Number(st.member_id) !== r.memberId || st.role !== 'manager' || Number(st.active) !== 1)
        stop('De accounteigenaar bevestigde geen exact gebonden actieve beheerder.', 503);
      return await bewerkCollectie(VORM, data => {
        const { c, a } = bron(data, id);
        if (c.zaakCode !== r.code || a.gezaakt?.code !== r.code ||
            a.gezaakt.staffId != null && Number(a.gezaakt.staffId) !== Number(st.id) ||
            !data.suppliers.some(s => s.code === r.code) || data.zaakAbonnement[r.code]?.contractId !== c.id)
          stop('De zaak of abonnementbinding wijzigde tijdens het herstel.');
        a.gezaakt.staffId = Number(st.id); a.bijgewerkt = nu();
        return { ok: true, code: r.code, staffId: Number(st.id), toegang: 'persoonlijk-rtg-account' };
      });
    } catch (e) { return { status: e.status || 503, error: e.message || 'De zaakactivering moet veilig worden hervat.' }; }
  }
  return provisioneerAutomatisch;
};
