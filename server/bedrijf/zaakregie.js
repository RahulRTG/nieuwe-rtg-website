/* Eigen RTG-zaken tonen binnen een expliciet gekozen WorkOS-werkruimte.

   Dit is een leesnaad, geen nieuwe bevoegdheid: de RTG-accountpoort, de
   bestaande WorkOS-deur en het brondomein moeten onafhankelijk dezelfde mens,
   werkruimte en zaak bevestigen. De projectie voert zelf geen actie uit. */
'use strict';

const { maakZaakregieContextAdapter } = require('../kern/zaakregie-context/adapter');

const tekst = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = function hangZaakregie(sctx) {
  const { app, lidVan, kern } = sctx;
  const authEenmaal = (req, res, next) => req.session ? next() : kern.auth(req, res, next);

  function fout(res, status, code, error) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).json({ error, code });
  }

  function eigenZaak(domain, id, account, tier) {
    if (domain === 'bureau') {
      if (!['lifestyle', 'business'].includes(tier)) return { forbidden: true };
      const lijst = kern.bureau.cases(account);
      const zaak = lijst && Array.isArray(lijst.zaken) ? lijst.zaken.find(x => x.id === id) : null;
      return { zaak, projecteer: 'bureau', provenance: 'bureau.cases.account-owner' };
    }
    if (domain === 'service') {
      const zaak = kern.serviceZaken.vind(id);
      return { zaak: zaak && zaak.melder === account ? zaak : null,
        projecteer: 'service', provenance: 'service.zaken.melder-owner' };
    }
    return { invalid: true };
  }

  function bronnen() {
    return {
      tenantVanWerkruimte: code => kern.tenant.register.vanWerkruimte(code),
      werkruimtesVan: account => kern.tenant.brug.werkruimtesVan(account),
      employmentVanPersoon: (account, oud) => kern.employmentVanPersoon(account, oud),
      vertegenwoordigingMijn: account => kern.vertegenwoordiging.mijn(account),
      serviceMachtigingenVan: account => kern.serviceMachtiging.lijst({ mens: account, max: 100 })
    };
  }

  app.post('/api/bedrijf/zaakregie', authEenmaal, (req, res) => {
    const sessie = req.session;
    const account = tekst(sessie && sessie.key, 160);
    if (!sessie || !sessie.account || sessie.account.actief === 0 || !/^user-\d+$/.test(account))
      return fout(res, 401, 'ZAAKREGIE_ACCOUNT_REQUIRED', 'Een actueel RTG-account is vereist.');

    const lid = lidVan(req, res);
    if (!lid) return;
    if (!lid.l || lid.l.status !== 'actief' || lid.l.rtgKey !== account)
      return fout(res, 403, 'ZAAKREGIE_MEMBERSHIP_MISMATCH',
        'Deze werkruimtesessie hoort niet bij het ingelogde RTG-account.');

    const body = req.body || {};
    const domain = tekst(body.domain, 20).toLowerCase();
    const id = tekst(body.id, 160);
    if (!id || !['bureau', 'service'].includes(domain))
      return fout(res, 400, 'ZAAKREGIE_SOURCE_REQUIRED', 'Kies een bestaande Bureau- of Servicezaak.');

    const bron = eigenZaak(domain, id, account, sessie.tier);
    if (bron.invalid) return fout(res, 400, 'ZAAKREGIE_SOURCE_REQUIRED', 'Kies een bestaande Bureau- of Servicezaak.');
    if (bron.forbidden) return fout(res, 403, 'ZAAKREGIE_PRODUCT_REQUIRED',
      'Het Privékantoor is onderdeel van de Lifestyle Pass.');
    if (!bron.zaak) return fout(res, 404, 'ZAAKREGIE_CASE_NOT_FOUND', 'Deze zaak kennen wij niet.');

    const entiteit = tekst(body.entiteit, 160);
    const adapter = maakZaakregieContextAdapter({ bronnen: bronnen(), bindingVanBron: view => ({
      schemaVersion: 1,
      account: { kind: 'rtg-account', id: account, provenance: 'rtg.auth.session' },
      workspace: { kind: 'workos-workspace', id: lid.w.code, provenance: 'workos.lidVan' },
      case: { kind: 'case-source', domain: view.source.domain, type: view.source.type,
        id: view.source.id, provenance: bron.provenance },
      legalEntity: entiteit
        ? { kind: 'concern-entity', id: entiteit, provenance: 'concern.employment' } : undefined
    }) });
    const regiebeeld = adapter[bron.projecteer](bron.zaak);
    if (regiebeeld.context.status !== 'bekend') {
      const conflict = regiebeeld.context.status === 'conflict';
      return fout(res, conflict ? 409 : 403, conflict
        ? 'ZAAKREGIE_CONTEXT_CONFLICT' : 'ZAAKREGIE_CONTEXT_UNAVAILABLE',
      'De account-, werkruimte- en zaakcontext kan niet actueel als een geheel worden bevestigd.');
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ ok: true, regiebeeld });
  });
};
