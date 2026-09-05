/* De productie-identiteit van WerkOS.

   Een RTG-account is de enige drager. De werkruimtecode kiest uitsluitend de
   grens waarbinnen dat account wil werken; zij bewijst zelf niets. Voor ieder
   verzoek worden tenant en werkruimtes opnieuw uit PostgreSQL in de lopende
   requestbaseline gezet. De gewone requestcommit blijft daarna de ENIGE
   schrijfweg, zodat een rechtenbesluit en de domeinmutatie dezelfde CAS-basis
   delen.

   Ontwikkeling houdt voorlopig de oude tokenstroom. Dat is geen productie-
   terugval: ontbreekt de verse-basishook in productie, dan gaat de deur dicht. */
'use strict';

const maakLegacyTokenMigratie = require('./legacy-token-migratie');

const CODE_OPSLAG = 'WORKOS_AUTHORITY_UNAVAILABLE';
const CODE_CONTEXT = 'WORKOS_WORKSPACE_REQUIRED';
const CODE_TOEGANG = 'WORKOS_WORKSPACE_FORBIDDEN';

const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const codeVan = req => String((req.body || {}).werkruimte || '').trim().toUpperCase();

function volledigPad(req) {
  const basis = String(req.baseUrl || '');
  const pad = String(req.path || req.url || '').split('?')[0];
  return (basis + pad).replace(/\/+$/, '') || '/';
}

function tenantVoor(data, code) {
  const gevonden = Object.values((data && data.tenants) || {})
    .filter(t => Array.isArray(t.werkruimtes) && t.werkruimtes.includes(code));
  return gevonden.length === 1 ? gevonden[0] : (gevonden.length ? false : null);
}

function tenantOpen(t) {
  if (t === false || (t && t.actief === false)) return false;
  const stand = t && t.levensloop && t.levensloop.stand;
  return !stand || stand === 'actief' || stand === 'opzegging';
}

module.exports = function maakProductieIdentiteit({ app, auth, db, bewerkCollectie, productie } = {}) {
  const isProductie = productie == null
    ? String(process.env.NODE_ENV || '') === 'production' : productie === true;
  const tokenMigratie = maakLegacyTokenMigratie({ bewerkCollectie, productie: isProductie });

  function fout(res, status, code, error) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).json({ error, code });
  }

  async function laadContext(req, res, next, opties) {
    if (!db || typeof db.verversVerzoekCollectie !== 'function') {
      return fout(res, 503, CODE_OPSLAG,
        'De actuele WerkOS-identiteit kan niet uit de autoritatieve opslag worden gelezen.');
    }
    try {
      /* Altijd dezelfde alfabetische volgorde als de multi-collectiecommit. */
      await db.verversVerzoekCollectie('tenants');
      await db.verversVerzoekCollectie('werkruimtes');
    } catch (_) {
      return fout(res, 503, CODE_OPSLAG,
        'De actuele WerkOS-identiteit kan niet uit de autoritatieve opslag worden gelezen.');
    }

    const sessie = req.session;
    if (!sessie || !sessie.account || !/^user-\d+$/.test(String(sessie.key || '')) ||
        sessie.account.actief === 0) {
      return fout(res, 401, CODE_TOEGANG, 'Een actueel RTG-account is vereist.');
    }

    /* Oude bearers reizen in productie ook niet meer als ongebruikte ballast
       door middleware/logging. Zij zijn geen alternatieve bevoegdheid. */
    if (String((req.body || {}).beheerToken || '') || String((req.body || {}).lidToken || '')) {
      return fout(res, 400, 'WORKOS_LEGACY_TOKEN_REJECTED',
        'WerkOS accepteert hier geen beheer- of lid-token; gebruik uw RTG-account.');
    }

    const pad = volledigPad(req);
    const vrij = (opties && opties.zonderWerkruimte) || [];
    let code = codeVan(req);
    const dochterMaken = pad === '/api/bedrijf/werkruimte/maak' &&
      String((req.body || {}).moeder || '').trim();
    if (dochterMaken) {
      const moeder = String(req.body.moeder).trim().toUpperCase();
      if (code && code !== moeder)
        return fout(res, 400, CODE_CONTEXT, 'Kies de moederwerkruimte expliciet als werkruimte.');
      code = moeder;
      req.body.werkruimte = moeder;
    }
    if (!code && vrij.includes(pad)) {
      req.werkosContext = { accountKey: sessie.key, account: sessie.account,
        werkruimtes: (db.data && db.data.werkruimtes) || {}, tenant: null,
        autoritatief: true, zonderWerkruimte: true };
      return next();
    }
    if (!code) return fout(res, 400, CODE_CONTEXT, 'Kies een werkruimte voor deze handeling.');

    const ruimtes = (db.data && db.data.werkruimtes) || {};
    const w = heeft(ruimtes, code) ? ruimtes[code] : null;
    const t = w ? tenantVoor(db.data, code) : null;
    if (!w || !tenantOpen(t))
      return fout(res, 403, CODE_TOEGANG, 'Geen actieve toegang tot deze werkruimte.');

    const toetreden = pad === '/api/bedrijf/lid/aanmeld';
    const leden = Object.values(w.leden || {});
    const l = leden.find(x => x && x.rtgKey === sessie.key) || null;
    if (!toetreden && (!l || l.status !== 'actief'))
      return fout(res, 403, CODE_TOEGANG, 'Geen actieve toegang tot deze werkruimte.');

    req.werkosContext = { accountKey: sessie.key, account: sessie.account,
      werkruimtes: ruimtes, werkruimte: w, lid: l, tenant: t || null,
      autoritatief: true, toetreden };
    return next();
  }

  function hang(prefix, opties) {
    if (!app || typeof app.use !== 'function') throw new Error('WerkOS-productie-identiteit mist de router.');
    app.use(prefix, (req, res, next) => {
      if (!isProductie) return next();
      if (typeof auth !== 'function')
        return fout(res, 503, CODE_OPSLAG, 'De centrale RTG-accountpoort ontbreekt.');
      return auth(req, res, () => {
        Promise.resolve(laadContext(req, res, next, opties)).catch(() =>
          fout(res, 503, CODE_OPSLAG,
            'De actuele WerkOS-identiteit kan niet uit de autoritatieve opslag worden gelezen.'));
      });
    });
  }

  /* Bewust wel onderdeel van dezelfde cutover, maar nog niet bij opstart
     aangeroepen. Zonder de autoritatieve collectietransactie faalt deze methode
     hard; de centrale productiegrendel blijft dicht totdat zowel die schrijfweg
     als de verse leesbaseline echt door PostgreSQL worden geleverd. */
  return { hang, laadContext, migreerLegacyTokens: tokenMigratie.migreerAlles,
    productie: isProductie };
};

module.exports.CODE_OPSLAG = CODE_OPSLAG;
module.exports.CODE_CONTEXT = CODE_CONTEXT;
module.exports.CODE_TOEGANG = CODE_TOEGANG;
module.exports.codeVan = codeVan;
module.exports.tenantVoor = tenantVoor;
module.exports.tenantOpen = tenantOpen;
