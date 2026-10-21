'use strict';

/* Alleen de bestaande wegwerpserver van rolproef-route gebruikt deze opbouw.
   De twee standaard-uit functies gaan langs hun gewone eigenaarbesluit; er
   verandert geen servervlag of productiestandaard. De positieve controles
   gebeuren VOOR de vingerafdruk, met hetzelfde lijf als de latere kruisproef.
   Een mislukte opbouw blijft ruwe ontbrekende/negatieve bewijsinformatie. */
const { ROUTES: VERIFICATIE_ROUTES, PNG } = require('./verificatie-isolatie');
const FIXTURE_ROUTES = [
  ...VERIFICATIE_ROUTES.map(pad => ({ methode: 'POST', pad, rol: 'member', functie: 'verificatie' })),
  { methode: 'POST', pad: '/api/leerhuis/doe', rol: 'member', functie: 'leerhuis' },
  { methode: 'POST', pad: '/api/leerhuis/lees', rol: 'member', functie: 'leerhuis' },
  { methode: 'POST', pad: '/api/office/leerhuis/open', rol: 'kantoor-op-naam', functie: 'leerhuis' },
  { methode: 'POST', pad: '/api/site/domein', rol: 'member', functie: 'dom-eigendomein' },
  { methode: 'POST', pad: '/api/supplier/site/domein', rol: 'supplier', functie: 'dom-eigendomein' }
];
const sleutel = r => r.methode + ' ' + r.pad;
const geslaagd = r => Number.isInteger(r?.status) && r.status >= 200 && r.status < 300;

async function maakRolfixtures({ post, basis, tokens, proeflid, kantoorVoor }) {
  const fixtures = Object.fromEntries(FIXTURE_ROUTES.map(r => [sleutel(r), {
    lijf: {}, eigenRoute: { methode: r.methode, pad: r.pad, status: 0, reden: 'fixture niet opgebouwd' }
  }]));
  const eis = (r, stap) => {
    if (!geslaagd(r)) throw new Error(stap + ' gaf ' + (r?.status || 0));
    return r.data || {};
  };
  async function positief(pad, lijf, token) {
    const rij = fixtures['POST ' + pad];
    rij.lijf = lijf;
    const r = await post(pad, lijf, token);
    rij.eigenRoute = { methode: 'POST', pad, status: Number.isInteger(r?.status) ? r.status : 0 };
    return r;
  }
  let eigenaar;
  async function schakel(id) {
    if (!eigenaar) {
      const login = eis(await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }), 'eigenaarinlog');
      if (!login.token || !login.eigenaar) throw new Error('geen technische eigenaar');
      eigenaar = login.token;
    }
    const verzoek = eis(await post('/api/techniek/functie', { id, aan: true }, eigenaar), 'schakelverzoek ' + id);
    if (verzoek.status === 'wacht') {
      const besluit = eis(await post('/api/techniek/functie/besluit', { verzoekId: verzoek.verzoekId }, eigenaar), 'schakelbesluit ' + id);
      if (besluit.status !== 'akkoord') throw new Error('geen akkoord voor ' + id);
    } else if (verzoek.status !== 'ongewijzigd') throw new Error('geen akkoord voor ' + id);
  }
  async function groep(functie, bouw) {
    try { await schakel(functie); await bouw(); }
    catch (e) {
      for (const r of FIXTURE_ROUTES.filter(r => r.functie === functie)) {
        const rij = fixtures[sleutel(r)];
        if (!geslaagd(rij.eigenRoute)) rij.eigenRoute.reden = String(e.message || e);
      }
    }
  }
  // Upload zet verified terug naar pending: gebruik nooit het gekeurde
  // proeflid waarop de financiële ijking van de rolronde berust.
  try {
    const { nieuwLid } = require('./voltooiwereld');
    const verificatielid = await nieuwLid({ post }, 'rol-verificatie');
    for (const pad of VERIFICATIE_ROUTES)
      await positief(pad, pad.endsWith('/status') ? {} : { image: PNG }, verificatielid.token);
  } catch (e) {
    for (const pad of VERIFICATIE_ROUTES) fixtures['POST ' + pad].eigenRoute.reden = String(e.message || e);
  }
  await groep('leerhuis', async () => {
    if (!proeflid?.token) throw new Error('geen eigen proeflid voor Academy');
    const user = eis(await post('/api/auth/me', {}, proeflid.token), 'proeflid').user;
    if (!Number.isInteger(user?.id)) throw new Error('proeflid heeft geen account-id');
    const kantoor = await (kantoorVoor || require('../../test/helper').kantoorAlsPersoon)(basis);
    if (!kantoor) throw new Error('geen kantoor op naam');
    const org = 'ROLPROEF-ACADEMY';
    eis(await positief('/api/office/leerhuis/open', {
      id: org, soort: 'RTG', naam: 'Lokale rolproef Academy', eigenaar: 'user-' + user.id
    }, kantoor), 'Academy openen');
    eis(await positief('/api/leerhuis/doe', { org, actie: 'relatieZet',
      invoer: { persoon: 'lid:' + user.id, soort: 'EMPLOYEE' }, sleutel: 'rolproef-relatie' }, proeflid.token), 'Academy handeling');
    await positief('/api/leerhuis/lees', { org, vraag: 'mijn' }, proeflid.token);
  });
  await groep('dom-eigendomein', async () => {
    for (const [rol, prefix, token] of [['member', '/api/site', proeflid?.token],
      ['supplier', '/api/supplier/site', tokens.supplier]]) {
      if (!token) throw new Error('geen eigen ' + rol + ' voor domein');
      const site = eis(await post(prefix + '/bewaar', { design: { titel: 'Lokale rolproef ' + rol,
        blokken: [{ type: 'kop', tekst: 'Lokale rolproef' }] } }, token), 'site bewaren ' + rol);
      if (!site.design?.id) throw new Error('geen eigen site-id voor ' + rol);
      const id = site.design.id;
      eis(await post(prefix + '/publiceer', { id, adres: 'rolproef-' + rol }, token), 'site publiceren ' + rol);
      // Een gereserveerde testnaam: geen DNS, certificaat of extern verzoek.
      await positief(prefix + '/domein', { id, domein: 'rolproef-' + rol + '.example.test' }, token);
    }
  });
  return fixtures;
}

module.exports = { FIXTURE_ROUTES, maakRolfixtures };
