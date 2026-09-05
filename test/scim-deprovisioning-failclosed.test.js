/* SCIM UIT DIENST -- een 2xx is een bevestiging dat OOK Werk OS dicht is.

   Deze toets injecteert de storing op de naad zelf. Een gewone zonnige
   integratietoets kan nooit aantonen wat de route doet wanneer de tenantbrug
   gooit of expliciet zegt dat zij niet kon intrekken. PATCH, PUT en DELETE
   mogen in die gevallen geen 200/204 teruggeven: de IdP moet kunnen herhalen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const scim = require('../server/scim');
const accountState = require('../server/accounts/state');
const hangScim = require('../server/routes/scim');
const hangScimGroepen = require('../server/routes/scim-groepen');
const maakTenantbrug = require('../server/kern/tenant/brug');

function monteer(deprovisioneer) {
  const routes = {};
  const app = {};
  for (const methode of ['get', 'post', 'patch', 'put', 'delete']) {
    app[methode] = (pad, ...handlers) => { routes[methode.toUpperCase() + ' ' + pad] = handlers; };
  }
  hangScim({
    app,
    accounts: { emailOf: () => 'vertrekker@klant.test' },
    scimUserSync: {
      zetActief(org, id, aan) {
        const u = scim.zetActief({ emailOf: () => 'vertrekker@klant.test' }, org, id, aan);
        if (!aan) {
          try {
            const uit = deprovisioneer(org, 'user-' + u.id);
            if (!uit || uit.ok !== true) throw new Error('intrekking niet bevestigd');
          } catch (oorzaak) {
            const e = new Error('De intrekking in Werk OS kon niet worden bevestigd. Probeer de deprovisioning opnieuw.');
            e.status = 503; e.cause = oorzaak; throw e;
          }
        }
        return u;
      },
      ronde() { return { bekeken: 0, hersteld: 0 }; }
    },
    tenant: {
      register: { haal: () => ({ org: 'O-KLANT', actief: true, werkruimtes: ['W1'] }) },
      brug: { deprovisioneer }
    }
  });
  return routes;
}

function antwoord() {
  return {
    code: 200,
    body: null,
    headers: {},
    status(code) { this.code = code; return this; },
    set(naam, waarde) { this.headers[String(naam).toLowerCase()] = waarde; return this; },
    json(body) { this.body = body; return this; },
    end() { this.einde = true; return this; }
  };
}

function verzoek(methode) {
  return {
    scimOrg: 'O-KLANT',
    params: { id: '7' },
    body: methode === 'PATCH'
      ? { Operations: [{ op: 'replace', path: 'active', value: false }] }
      : { active: false },
    get: () => ''
  };
}

function laatste(routes, methode, bron) {
  const handlers = routes[methode + ' /api/scim/v2/' + (bron || 'Users') + '/:id'];
  assert.ok(handlers && handlers.length, 'de ' + methode + '-route is gemonteerd');
  return handlers[handlers.length - 1];
}

function monteerGroepen(uitClaims) {
  const routes = {};
  const app = {};
  for (const methode of ['get', 'post', 'patch', 'put', 'delete']) {
    app[methode] = (pad, ...handlers) => { routes[methode.toUpperCase() + ' ' + pad] = handlers; };
  }
  let groep = { id: '1', org: 'O-KLANT', naam: 'Managers', leden: ['9'] };
  const wachtend = new Set();
  const groepen = {
    vind: (_org, id) => groep && String(id) === groep.id ? Object.assign({}, groep, { leden: groep.leden.slice() }) : null,
    opNaam: (_org, naam) => groep && naam === groep.naam ? groep : null,
    lijst: () => groep ? [groep] : [],
    schoonLeden: leden => (leden || []).map(v => String(v && typeof v === 'object' ? v.value : v)),
    uitPatch: scim.groepen.uitPatch,
    markeerSync: (_org, ids) => { for (const id of ids || []) wachtend.add(String(id)); },
    wachtendeSync: () => [...wachtend],
    syncKlaar: (_org, id) => wachtend.delete(String(id)),
    groepenVan: (_org, id) => groep && groep.leden.includes(String(id)) ? [groep.naam] : [],
    zetLeden: (_org, _id, leden) => (groep = Object.assign({}, groep, { leden: leden.slice() })),
    hernoem: (_org, _id, naam) => (groep = Object.assign({}, groep, { naam })),
    haalWeg: () => { const oud = groep; groep = null; return oud; },
    maak: () => { throw new Error('niet nodig in deze toets'); }
  };
  const stuurScim = (res, status, body) => res.status(status).json(body);
  const stuurFout = (res, status, detail) => stuurScim(res, status, { detail });
  hangScimGroepen({
    app, kern: {
      tenant: {
        register: { haal: () => ({ org: 'O-KLANT', werkruimtes: ['W1'] }) },
        brug: { uitClaims }
      }
    },
    accounts: { getUserById: id => ({ id }) },
    scim: { groepen },
    vorm: { groep: g => g, lijst: r => r }, filter: { ontleed: () => ({ soort: 'alles' }) },
    log: { info() {}, error() {} }, BASIS: '/api/scim/v2', remmen() {}, scimAuth() {}, stuurScim, stuurFout
  });
  return { routes, stand: () => ({ groep, wachtend: [...wachtend] }) };
}

function monteerEchteGroepen(uitClaims) {
  const routes = {};
  const app = {};
  for (const methode of ['get', 'post', 'patch', 'put', 'delete']) {
    app[methode] = (pad, ...handlers) => { routes[methode.toUpperCase() + ' ' + pad] = handlers; };
  }
  const stuurScim = (res, status, body) => res.status(status).json(body);
  hangScimGroepen({
    app, kern: {
      tenant: {
        register: { haal: () => ({ org: 'O-KLANT', werkruimtes: ['W1'] }) },
        brug: { uitClaims }
      }
    },
    accounts: { getUserById: id => ({ id }) }, scim,
    vorm: { groep: g => g, lijst: r => r }, filter: { ontleed: () => ({ soort: 'alles' }) },
    log: { info() {}, error() {} }, BASIS: '/api/scim/v2', remmen() {}, scimAuth() {}, stuurScim,
    stuurFout: (res, status, detail) => stuurScim(res, status, { detail })
  });
  return routes;
}

test('SCIM PATCH, PUT en DELETE geven 503 wanneer Werk OS intrekken gooit', () => {
  const oud = scim.zetActief;
  scim.zetActief = () => ({ id: 7, actief: 0 });
  try {
    const routes = monteer(() => { throw new Error('opslag tijdelijk niet schrijfbaar'); });
    for (const methode of ['PATCH', 'PUT', 'DELETE']) {
      const res = antwoord();
      laatste(routes, methode)(verzoek(methode), res);
      assert.equal(res.code, 503, methode + ' mag geen succesvolle deprovisioning bevestigen');
      assert.equal(res.headers['retry-after'], '30');
      assert.match(res.body && res.body.detail || '', /Werk OS|intrekking|deprovision/i);
      assert.equal(res.einde, undefined, methode + ' mag niet alsnog eindigen als 204');
    }
  } finally {
    scim.zetActief = oud;
  }
});

test('ook een expliciete ok:false uit de tenantbrug wordt een herhaalbare 503', () => {
  const oud = scim.zetActief;
  scim.zetActief = () => ({ id: 8, actief: 0 });
  try {
    const routes = monteer(() => ({ ok: false, reden: 'tenantopslag niet bevestigd', geraakt: [] }));
    const res = antwoord();
    laatste(routes, 'PATCH')(verzoek('PATCH'), res);
    assert.equal(res.code, 503);
    assert.match(res.body && res.body.detail || '', /Werk OS|intrekking|deprovision/i);
  } finally {
    scim.zetActief = oud;
  }
});

test('een retry bevestigt de opslag opnieuw nadat de eerste cascade-save gooide', () => {
  const lid = {
    id: 'L1', rtgKey: 'user-9', status: 'actief', token: 'lid-geheim',
    rollen: [{ id: 'directie', bron: 'idp' }]
  };
  const db = { data: { werkruimtes: { W1: { code: 'W1', leden: { L1: lid }, journaal: [] } } } };
  const register = { haal: () => ({ org: 'O-KLANT', werkruimtes: ['W1'] }) };
  let schrijfPogingen = 0;
  const brug = maakTenantbrug({ db, register, save() {
    schrijfPogingen++;
    if (schrijfPogingen === 1) throw new Error('eerste opslagpoging mislukt');
  } });

  assert.throws(() => brug.deprovisioneer('O-KLANT', 'user-9'), /opslagpoging mislukt/);
  assert.equal(lid.status, 'uit dienst', 'de fail-closed RAM-stand blijft al dicht');
  assert.equal(lid.token, null);

  const herhaald = brug.deprovisioneer('O-KLANT', 'user-9');
  assert.equal(herhaald.ok, true);
  assert.equal(herhaald.bevestigd, 1, 'dezelfde koppeling is opnieuw ter opslag aangeboden');
  assert.equal(schrijfPogingen, 2, 'de retry slaat save niet over omdat RAM al dicht staat');
});

test('SCIM Group PATCH geeft 503 en houdt een verwijderd lid vast voor de retry', () => {
  let poging = 0;
  const { routes, stand } = monteerGroepen(() => {
    poging++;
    if (poging === 1) throw new Error('Werk OS tijdelijk niet schrijfbaar');
    return { ok: true, werkruimtes: [{ werkruimte: 'W1' }] };
  });
  const handel = laatste(routes, 'PATCH', 'Groups');
  const req = { scimOrg: 'O-KLANT', params: { id: '1' },
    body: { Operations: [{ op: 'remove', path: 'members' }] } };

  const eerste = antwoord();
  handel(req, eerste);
  assert.equal(eerste.code, 503, 'de ingetrokken Werk OS-rol is nog niet bevestigd');
  assert.deepEqual(stand(), { groep: { id: '1', org: 'O-KLANT', naam: 'Managers', leden: [] }, wachtend: ['9'] });

  const tweede = antwoord();
  handel(req, tweede);
  assert.equal(tweede.code, 200, 'de identieke retry verwerkt ook het reeds verwijderde lid');
  assert.deepEqual(stand().wachtend, []);
  assert.equal(poging, 2);
});

test('SCIM Group DELETE geeft geen 204 bij Werk OS-fout en is daarna veilig idempotent', () => {
  let poging = 0;
  const { routes, stand } = monteerGroepen(() => {
    poging++;
    if (poging === 1) return { ok: false, reden: 'cascade niet bevestigd', werkruimtes: [] };
    return { ok: true, werkruimtes: [{ werkruimte: 'W1' }] };
  });
  const handel = laatste(routes, 'DELETE', 'Groups');
  const req = { scimOrg: 'O-KLANT', params: { id: '1' }, body: {} };

  const eerste = antwoord();
  handel(req, eerste);
  assert.equal(eerste.code, 503);
  assert.equal(eerste.einde, undefined, 'geen 204 zolang de cascade faalt');
  assert.equal(stand().groep, null, 'de retry moet dus uit de blijvende markering lezen');
  assert.deepEqual(stand().wachtend, ['9']);

  const tweede = antwoord();
  handel(req, tweede);
  assert.equal(tweede.code, 204);
  assert.equal(tweede.einde, true);
  assert.deepEqual(stand().wachtend, []);
});

test('Group create laat bij 400/409 niets achter en alleen een echte 503-create is herstelbaar', () => {
  const oudeDb = accountState.db;
  const db = new DatabaseSync(':memory:');
  accountState.db = db;
  let syncPogingen = 0;
  try {
    scim.groepen.zorgTabel(db);
    const routes = monteerEchteGroepen(() => {
      syncPogingen++;
      if (syncPogingen === 1) throw new Error('Werk OS tijdelijk niet schrijfbaar');
      return { ok: true, werkruimtes: [{ werkruimte: 'W1' }] };
    });
    const handel = routes['POST /api/scim/v2/Groups'].at(-1);

    const ongeldig = antwoord();
    handel({ scimOrg: 'O-KLANT', body: { displayName: 'Ongeldig',
      members: [{ value: '10', type: 'Group' }] } }, ongeldig);
    assert.equal(ongeldig.code, 400);
    assert.equal(scim.groepen.opNaam('O-KLANT', 'Ongeldig'), null);
    assert.deepEqual(scim.groepen.wachtendeSync('O-KLANT'), []);
    assert.equal(syncPogingen, 0, 'validatiefout raakt de tenantbrug niet');

    scim.groepen.maak('O-KLANT', 'Bestaand', ['9']);
    const dubbel = antwoord();
    handel({ scimOrg: 'O-KLANT', body: { displayName: 'Bestaand', members: [{ value: '9' }] } }, dubbel);
    assert.equal(dubbel.code, 409);
    assert.deepEqual(scim.groepen.wachtendeSync('O-KLANT'), []);
    assert.deepEqual(scim.groepen.opNaam('O-KLANT', 'Bestaand').leden, ['9']);
    assert.equal(syncPogingen, 0, 'gewone duplicate verandert geen Werk OS-rol');

    const body = { displayName: 'Retry', externalId: 'idp-retry-1', members: [{ value: '10' }] };
    const eerste = antwoord();
    handel({ scimOrg: 'O-KLANT', body }, eerste);
    assert.equal(eerste.code, 503);
    const bewaard = scim.groepen.opNaam('O-KLANT', 'Retry');
    assert.ok(bewaard, 'groep en marker zijn samen bewaard voor een echte retry');
    assert.deepEqual(scim.groepen.wachtendeSync('O-KLANT'), ['10']);
    assert.equal(scim.groepen.isCreateRetry('O-KLANT', bewaard, body.displayName, body.members, body.externalId), true);

    const herhaald = antwoord();
    handel({ scimOrg: 'O-KLANT', body }, herhaald);
    assert.equal(herhaald.code, 200, 'de exacte retry hervat de opgeslagen create');
    assert.deepEqual(scim.groepen.wachtendeSync('O-KLANT'), []);
    assert.equal(scim.groepen.isCreateRetry('O-KLANT', bewaard, body.displayName, body.members, body.externalId), false);
    assert.equal(syncPogingen, 2);
  } finally {
    try { db.close(); } catch (_) {}
    accountState.db = oudeDb;
  }
});
