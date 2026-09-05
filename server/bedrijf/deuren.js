/* DE TWEE DEUREN VAN EEN WERKRUIMTE -- wie mag hier bij, en wat er onderweg
   geteld wordt.

   Ze staan in een eigen bestand om dezelfde reden als routes/tenant/poort.js:
   een deur die tussen honderd routes staat, wordt op een dag door de honderd
   en eerste route overgeslagen. En omdat er inmiddels twee dingen AAN deze
   deuren hangen die er allebei alleen hier volledig kunnen hangen -- het
   contractquotum en de organisatiemeting -- is dit geen hulpbestand meer maar
   de plek waar de laag zijn grens trekt.

   `kern` komt binnen als het hele kernobject en niet als losse stukken: de
   tenantlaag bestaat op montagetijd nog niet, dus hij wordt lui gelezen. */
'use strict';

const metingTenant = require('../meting-tenant');
const scimUserSync = require('../scim/user-sync');

module.exports = ({ kern, W, eigenVeld }) => {
  const PRODUCTIE = String(process.env.NODE_ENV || '') === 'production';
  function rtgAccountOpen(l, req) {
    if (PRODUCTIE) {
      const c = req && req.werkosContext;
      return !!(c && c.autoritatief && c.lid === l && req.session &&
        req.session.key === l.rtgKey && req.session.account && req.session.account.actief !== 0 &&
        !scimUserSync.geblokkeerd(l.rtgKey));
    }
    if (!l || !l.rtgKey) return true;
    if (scimUserSync.geblokkeerd(l.rtgKey)) return false;
    const m = /^user-(\d+)$/.exec(String(l.rtgKey));
    if (!m) return true;
    try {
      if (!kern.accounts || typeof kern.accounts.getUserById !== 'function')
        return process.env.NODE_ENV !== 'production';
      const u = kern.accounts.getUserById(Number(m[1]));
      return !!u && u.actief !== 0;
    } catch (_) { return false; }
  }
  /* De twee sleutels, precies zoals bij de schoollaag: een beheer-token voor
     wie de werkruimte opende, en een lid-token per medewerker. Ze staan naast
     elkaar en niet in elkaar: een beheerder is geen medewerker met extra
     vinkjes maar een aparte sleutel, zodat "wie deed dit" nooit vaag wordt. */
  function ruimteVan(req) {
    if (PRODUCTIE) {
      const c = req && req.werkosContext;
      return c && c.autoritatief ? c.werkruimte || null : null;
    }
    return eigenVeld(W(), String((req.body || {}).werkruimte || '').trim().toUpperCase()) || null;
  }
  /* HET QUOTUM VAN DE TENANT, op de twee deuren en niet op 104 routes.

     Elke route van deze laag komt langs beheerVan() of lidVan(); daar tellen is
     dus de enige plek waar het volledig is, en de enige plek waar het niet
     vergeten kan worden bij route 105. De laag zelf weet niets van contracten:
     hij vraagt het aan kern.tenant als die er is, en werkt gewoon door als die
     er niet is (een werkruimte zonder tenant heeft geen contractgrens).

     De UITVOER telt nooit mee en wordt nooit geweigerd. Die zet `geenQuotum` op
     het verzoek (routes/tenant.js), want exit-recht dat op een teller kan
     stuklopen is geen recht. */
  /* EN DE METING KRIJGT HIER ZIJN ORGANISATIE, om dezelfde reden als het quotum
     hierboven: dit zijn de twee deuren, en de tenant is toch al opgezocht. Wat
     er wel en niet mee geteld wordt -- aantallen en geen tijdreeks per klant,
     en nooit mee naar Prometheus -- staat in ../meting-tenant.js. */
  function quotumOk(req, res, w) {
    if (req.geenQuotum || !kern.tenant) return true;
    const t = kern.tenant.register.vanWerkruimte(w.code);
    metingTenant.volg(req, res, t ? t.org : null);
    if (!t) return true;
    const uit = kern.tenant.contract.tel(t.org);
    if (uit.ok) return true;
    res.status(429).json({ error: uit.reden, quotum: { gebruikt: uit.gebruikt, grens: uit.grens } });
    return false;
  }

  function beheerVan(req, res) {
    const w = ruimteVan(req);
    if (PRODUCTIE) {
      const l = req.werkosContext && req.werkosContext.lid;
      const rechten = l && kern.bedrijf && typeof kern.bedrijf.rechtenVan === 'function'
        ? kern.bedrijf.rechtenVan(l) : [];
      if (!w || !l || l.status !== 'actief' || !rtgAccountOpen(l, req) || !rechten.includes('werkruimte')) {
        res.status(403).json({ error: 'Geen actieve beheerbevoegdheid voor deze werkruimte.' });
        return null;
      }
      return quotumOk(req, res, w) ? w : null;
    }
    if (!w || w.beheerToken !== String((req.body || {}).beheerToken || '')) {
      res.status(403).json({ error: 'Onbekende werkruimte of verkeerd beheer-token.' });
      return null;
    }
    return quotumOk(req, res, w) ? w : null;
  }
  function lidVan(req, res) {
    const w = ruimteVan(req);
    if (PRODUCTIE) {
      const l = req.werkosContext && req.werkosContext.lid;
      if (!w || !l || l.status !== 'actief' || !rtgAccountOpen(l, req)) {
        res.status(403).json({ error: 'Geen actieve toegang tot deze werkruimte.' }); return null;
      }
      return quotumOk(req, res, w) ? { w, l } : null;
    }
    const tok = String(req.body.lidToken || '');
    const l = w && tok ? Object.values(w.leden || {}).find(x => x.token === tok) : null;
    if (!l) { res.status(403).json({ error: 'Onbekende werkruimte of verkeerd lid-token.' }); return null; }
    if (l.status !== 'actief') { res.status(403).json({ error: 'Dit lidmaatschap staat op ' + l.status + '.' }); return null; }
    if (!rtgAccountOpen(l, req)) {
      res.status(403).json({ error: 'Deze zakelijke toegang wordt ingetrokken en is niet beschikbaar.' }); return null;
    }
    return quotumOk(req, res, w) ? { w, l } : null;
  }

  return { ruimteVan, quotumOk, beheerVan, lidVan, rtgAccountOpen };
};
