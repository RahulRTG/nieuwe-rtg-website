'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { alleRoutes, haal, rolproefBudget, draaiRolcontrole, rolproefGeslaagd } = require('../scripts/beproeving');
const { VERHALEN } = require('../scripts/verhalen');

function rolwereld(afwijking) {
  const { FIXTURE_ROUTES } = require('../scripts/lib/rolproeffixtures');
  const routes = [...Array.from({ length: 451 }, (_, i) => ({
    methode: 'POST', pad: '/api/rolcontract/' + i, rol: 'member'
  })), ...FIXTURE_ROUTES];
  const tokens = { member: 'lid', supplier: 'zaak', office: 'kantoor' };
  const gezien = []; let saldo = 0, geschiedenis = 0;
  const post = async (pad, lijf, token) => {
    gezien.push({ pad, lijf, token });
    const afwijkend = afwijking?.(pad, lijf, token);
    if (afwijkend) return afwijkend;
    let data = {};
    if (pad === '/api/auth/register') data = { token: 'apart-verificatielid' };
    else if (pad === '/api/techniek/inloggen') data = { token: 'eigenaar', eigenaar: true };
    else if (pad === '/api/techniek/functie') data = { status: 'ongewijzigd' };
    else if (pad === '/api/auth/me' && token === tokens.member) data = { user: { id: 42 } };
    else if (pad === '/api/supplier/backoffice' && token === tokens.supplier) data = { toppers: [], alerts: [],
      alertBron: { schema: 1, bereik: 'zaakcommand-signalen', sha256: 'a'.repeat(64) } };
    else if (pad === '/api/office/state' && token === tokens.office) data = { state: {} };
    else if (pad === '/api/pay/oplaad' && token === tokens.member) { saldo += lijf.centen; geschiedenis++; }
    else if (pad === '/api/pay/overzicht' && token === tokens.member) data = { saldo, geschiedenis, aanMij: [], vanMij: [] };
    else if (pad === '/api/verkoop/mijn' && token === tokens.member) data = { deals: [] };
    else if (pad === '/api/site/mijn' || pad === '/api/supplier/site/mijn') data = { lijst: [] };
    else if (pad.endsWith('/bewaar')) data = { design: { id: token + '-site' } };
    else if (!pad.endsWith('/publiceer')) {
      const r = routes.find(r => r.pad === pad);
      const eigenaar = r?.functie === 'verificatie' ? 'apart-verificatielid'
        : r?.rol === 'kantoor-op-naam' ? 'kantoor-op-naam' : tokens[r?.rol];
      if (!r || token !== eigenaar) return { status: 403, data: { error: 'Geen bevoegdheid.' } };
    }
    return { status: 200, data };
  };
  return { gezien, routes, draai: maxPogingen => draaiRolcontrole({
    post, postT: post, vraag: (_methode, pad, lijf, token) => post(pad, lijf, token),
    basis: 'http://127.0.0.1:1234', routes, tokens, proeflid: { token: tokens.member },
    kantoorVoor: async () => 'kantoor-op-naam', maxPogingen
  }) };
}

test('de E3-standaard meet ook na poging 900; alleen een expliciet positief budget begrenst', async () => {
  assert.equal(rolproefBudget({}), 0, 'nul betekent geen begrenzing in de gedeelde rolproef');
  assert.equal(rolproefBudget({ ROLPROEF_MAX: '0' }), 0, 'de bestaande expliciete onbeperkte stand blijft geldig');
  assert.equal(rolproefBudget({ ROLPROEF_MAX: '900' }), 900);
  for (const waarde of ['-1', 'NaN', '1.5']) assert.throws(() => rolproefBudget({ ROLPROEF_MAX: waarde }));
  const w = rolwereld(), r = await w.draai(rolproefBudget({}));
  assert.ok(r.pogingen > 900);
  assert.equal(Object.keys(r.perRoute).length, w.routes.length);
  assert.deepEqual(r.bevindingen.onbeslist, []);
  assert.equal(rolproefGeslaagd(r), true);
});

test('een beperkt E3-budget blijft rood en bewaart alle ongemeten routes en ruwe antwoorden', async () => {
  const r = await rolwereld().draai(900);
  assert.equal(r.pogingen, 900);
  assert.ok(r.bevindingen.onbeslist.length > 0);
  assert.equal(rolproefGeslaagd(r), false);
  const bewaard = JSON.parse(JSON.stringify({ rolproef: r })).rolproef;
  assert.deepEqual(bewaard.bevindingen.onbeslist, r.bevindingen.onbeslist);
  assert.deepEqual(bewaard.perRoute['POST /api/rolcontract/0'].antwoorden.map(a =>
    [a.status, a.eigenVoor, a.eigenNa]), [[403, 200, 200], [403, 200, 200]]);
  assert.deepEqual(bewaard.perRoute['POST /api/rolcontract/450'].antwoorden, []);
  const bron = require('node:fs').readFileSync(require.resolve('../scripts/beproeving'), 'utf8');
  assert.match(bron, /rolproef:\s*rp,/, 'de echte LAATSTE_METING-producent bewaart deze ruwe rolrijen');
});

test('E3 bouwt de bestaande eigen fixtures vóór ijking; een mislukte positieve controle blijft onbeslist', async () => {
  const w = rolwereld((pad, _lijf, token) => pad === '/api/verify/upload' && token === 'apart-verificatielid'
    ? { status: 503, data: { error: 'Proefuitval.' } } : null);
  const r = await w.draai(0);
  const rij = r.perRoute['POST /api/verify/upload'];
  assert.equal(rij.eigenRoute.status, 503);
  assert.equal(rij.acl, 'onbeslist');
  assert.equal(rolproefGeslaagd(r), false);
  assert.ok(r.bevindingen.onbeslist.includes('POST /api/verify/upload'));
  assert.equal(r.perRoute['POST /api/verify/status'].eigenRoute.status, 200);
  const ijking = w.gezien.findIndex(x => x.pad === '/api/pay/oplaad');
  assert.ok(ijking > w.gezien.findIndex(x => x.pad === '/api/supplier/site/domein'));
});

test('de antwoordadapter bewaart een niet-JSON weigering voor de lekscan', async () => {
  const { EventEmitter } = require('node:events');
  const { weegAntwoord } = require('../scripts/lib/rolproef');
  const vraag = (_opties, antwoord) => {
    const req = new EventEmitter();
    req.setTimeout = () => {}; req.write = () => {};
    req.end = () => queueMicrotask(() => {
      const res = new EventEmitter(); res.statusCode = 403; antwoord(res);
      res.emit('data', 'Dit dossier hoort bij jan@voorbeeld.nl'); res.emit('end');
    });
    return req;
  };
  const r = await haal('POST', '/api/proef', 'tok', {}, {}, vraag);
  assert.equal(r.status, 403);
  assert.equal(r.data, 'Dit dossier hoort bij jan@voorbeeld.nl');
  assert.equal(weegAntwoord(r.status, r.data).lek, 'e-mailadres');
});

test('de storm ontvangt de HTTP-methode die de server registreert', () => {
  const routes = alleRoutes();
  assert.ok(routes.length > 100);
  for (const r of routes) assert.match(r.methode, /^(GET|POST|PUT|DELETE)$/);
  assert.ok(routes.some(r => r.pad === '/api/state' && r.methode === 'POST'));
  assert.ok(routes.some(r => r.pad === '/api/metrics' && r.methode === 'GET'));
});

test('herhaalde geldverhalen blijven binnen de walletlimiet en controleren elke boeking', async () => {
  const p = { ploeg: { beursA: { token: 'A' }, beursB: { token: 'B' } } };
  const saldi = { A: 0, B: 0 }, sleutels = new Set();
  let stortingen = 0, overboekingen = 0, eisen = 0;
  const wb = {
    eis(naam, ok, fout) { eisen++; assert.ok(ok, naam + ': ' + fout); },
    async stap(_naam, _m, pad, token, lijf) {
      if (pad === '/api/verify/status') return { data: { status: 'verified' } };
      if (pad === '/api/pay/overzicht') return { data: { saldo: saldi[token], codenaam: token } };
      if (pad === '/api/pay/oplaad' && !sleutels.has(lijf.idem)) {
        assert.ok(saldi[token] + lijf.centen <= 1000000, 'de proef stort zelf de wallet vol');
        saldi[token] += lijf.centen; stortingen++;
      }
      if (pad === '/api/pay/stuur' && !sleutels.has(lijf.idem)) {
        assert.ok(saldi[token] >= lijf.centen);
        saldi[token] -= lijf.centen; saldi[lijf.aan] += lijf.centen; overboekingen++;
      }
      if (lijf.idem) sleutels.add(lijf.idem);
      return { data: {} };
    }
  };
  for (let i = 0; i < 12; i++) await VERHALEN.find(v => v.id === 'portemonnee-klopt').doe(wb, p);
  assert.equal(stortingen, 1);
  assert.equal(overboekingen, 72);
  assert.ok(eisen >= 84);
  assert.deepEqual(saldi, { A: 200000, B: 0 });
});

test('het onderweg-verhaal maakt van een positie alleen een voorstel en bevestigt aankomst apart', async () => {
  const verhaal = VERHALEN.find(v => v.id === 'onderweg-en-aankomen');
  const bestemming = { code: 'PONTO', loc: { lat: 38.92, lng: 1.44 } };
  const aanroepen = [];
  const wb = {
    eis(naam, ok, fout) { assert.ok(ok, naam + ': ' + fout); },
    async stap(naam, methode, pad, token, body) {
      aanroepen.push({ naam, methode, pad, token, body });
      if (pad === '/api/live/start') return { data: { live: { active: true, dest: bestemming } } };
      if (pad === '/api/live/update' && body.lat !== bestemming.loc.lat) {
        return { data: { live: { active: true, nabij: false, arrived: false } } };
      }
      if (pad === '/api/live/update') {
        return { data: { live: { active: true, nabij: true, arrived: false } } };
      }
      /* Het verhaal (uit #444) leest de bevestigde aankomst ook terug en
         bevestigt haar een tweede keer: beide moeten dezelfde stand geven. */
      if (pad === '/api/live/aangekomen' || pad === '/api/live/state') {
        return { data: { live: { active: true, nabij: false, arrived: true, aankomstDoor: 'lid',
          aankomstAt: '2026-10-04T10:00:00.000Z' } } };
      }
      assert.fail('onverwachte verhaalstap: ' + pad);
    }
  };

  await verhaal.doe(wb, { ploeg: { gast: { token: 'lid-token' } }, supCode: 'PONTO' });

  assert.deepEqual(aanroepen.map(r => r.pad), [
    '/api/live/start',
    '/api/live/update',
    '/api/live/update',
    '/api/live/aangekomen',
    '/api/live/state',
    '/api/live/aangekomen'
  ]);
  assert.equal(aanroepen.at(-1).token, 'lid-token');
});
