/* SSO EN WERK OS -- authenticatie is pas zakelijke toegang na groepssync.

   De provider kan de persoon correct hebben aangemeld terwijl de tenantbrug
   faalt. Dan mag er geen overdrachtsbewijs ontstaan: dat bewijs wordt anders
   een gewone RTG-sessie waarmee /api/bedrijf/mijn bestaande lid-tokens weer
   kan ophalen. Wij kiezen hier de strikte, expliciete scheiding: bij een echte
   tenant faalt de hele SSO-overdracht tijdelijk; er wordt dus ook geen
   persoonlijke sessie uitgegeven die per ongeluk als zakelijke ingang dient. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const sso = require('../server/sso');
const scimGroepen = require('../server/scim/groepen');
const binnenkomst = require('../server/sso/binnenkomst');

function opzet(uitClaims) {
  const stand = { bewijs: 0, redirect: 0, succeslog: 0 };
  const kern = {
    db: { data: { werkruimtes: {} } },
    eigenaar: { isEigenaar: () => false },
    accounts: {
      issueActionToken() { stand.bewijs++; return 'bewijs'; }
    },
    tenant: {
      register: { haal: () => ({ org: 'O-KLANT', actief: true, werkruimtes: ['W1'] }) },
      brug: { uitClaims }
    },
    logInlog(_soort, gelukt) { if (gelukt) stand.succeslog++; }
  };
  const res = { redirect() { stand.redirect++; } };
  return { kern, res, stand };
}

async function metAangemeldePersoon(werk) {
  const oud = sso.aanmelden;
  const oudeGroepen = scimGroepen.groepenVan;
  const oudeKlaar = scimGroepen.syncKlaar;
  sso.aanmelden = async () => ({
    user: { id: 41, codename: 'LID-41', tier: 'rtg' },
    nieuw: false,
    gekoppeld: false
  });
  scimGroepen.groepenVan = () => [];
  scimGroepen.syncKlaar = () => {};
  try { return await werk(); } finally {
    sso.aanmelden = oud;
    scimGroepen.groepenVan = oudeGroepen;
    scimGroepen.syncKlaar = oudeKlaar;
  }
}

test('een geworpen groepssync geeft geen bewijs, redirect of persoonlijke sessie', async () => {
  await metAangemeldePersoon(async () => {
    const { kern, res, stand } = opzet(() => { throw new Error('tenantopslag stuk'); });
    await assert.rejects(
      () => binnenkomst.binnen(kern, { org: 'O-KLANT' }, { groups: ['Managers'] }, {}, res, '/', 'oidc'),
      e => e && e.code === 'SSO_WERKSYNC' && e.status === 503
    );
    assert.deepEqual(stand, { bewijs: 0, redirect: 0, succeslog: 0 });
  });
});

test('ok:false uit de groepsbrug is evenzeer fail-closed', async () => {
  await metAangemeldePersoon(async () => {
    const { kern, res, stand } = opzet(() => ({ ok: false, reden: 'tenant staat niet veilig open', werkruimtes: [] }));
    await assert.rejects(
      () => binnenkomst.binnen(kern, { org: 'O-KLANT' }, { groups: [] }, {}, res, '/', 'saml'),
      e => e && e.code === 'SSO_WERKSYNC' && e.status === 503
    );
    assert.deepEqual(stand, { bewijs: 0, redirect: 0, succeslog: 0 });
  });
});

test('OIDC en SAML delen een tijdelijk antwoord voor een mislukte zakelijke sync', () => {
  const fout = Object.assign(new Error('intern detail'), { code: 'SSO_WERKSYNC', status: 503 });
  const antwoord = binnenkomst.foutAntwoord(fout);
  assert.equal(antwoord.status, 503);
  assert.equal(antwoord.retryAfter, '30');
  assert.match(antwoord.bericht, /zakelijke toegang/i);
  assert.equal(antwoord.bericht.includes('intern detail'), false, 'intern detail lekt niet naar de browser');
});

test('persoonlijke SSO zonder tenant blijft alleen open bij bewezen scheiding van Werk OS', async () => {
  await metAangemeldePersoon(async () => {
    const { kern, res, stand } = opzet(() => { throw new Error('mag niet worden aangeroepen'); });
    kern.tenant.register.haal = () => null;

    await binnenkomst.binnen(kern, { org: 'O-PERSOONLIJK' }, { groups: [] }, {}, res, '/', 'oidc');
    assert.deepEqual(stand, { bewijs: 1, redirect: 1, succeslog: 1 },
      'zonder een Werk OS-koppeling mag de gewone RTG-overdracht blijven bestaan');
  });
});

test('persoonlijke SSO zonder tenant blijft dicht zodra hetzelfde account Werk OS kan openen', async () => {
  await metAangemeldePersoon(async () => {
    const { kern, res, stand } = opzet(() => { throw new Error('mag niet worden aangeroepen'); });
    kern.tenant.register.haal = () => null;
    kern.db.data.werkruimtes.W1 = {
      leden: { L1: { id: 'L1', rtgKey: 'user-41', status: 'actief', token: 'lid-geheim' } }
    };

    await assert.rejects(
      () => binnenkomst.binnen(kern, { org: 'O-PERSOONLIJK' }, { groups: [] }, {}, res, '/', 'saml'),
      e => e && e.code === 'SSO_WERKSYNC' && e.status === 503
    );
    assert.deepEqual(stand, { bewijs: 0, redirect: 0, succeslog: 0 });
  });
});

test('een geslaagde zakelijke SSO-sync rondt ook een wachtende SCIM-groepssync af', async () => {
  await metAangemeldePersoon(async () => {
    const { kern, res, stand } = opzet(() => ({ ok: true, werkruimtes: [{ werkruimte: 'W1' }] }));
    let afgerond = null;
    scimGroepen.syncKlaar = (org, id) => { afgerond = { org, id }; };

    await binnenkomst.binnen(kern, { org: 'O-KLANT' }, { groups: ['Managers'] }, {}, res, '/', 'oidc');
    assert.deepEqual(afgerond, { org: 'O-KLANT', id: 41 });
    assert.deepEqual(stand, { bewijs: 1, redirect: 1, succeslog: 1 });
  });
});
