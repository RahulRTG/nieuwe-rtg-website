'use strict';
/* Voer de echte helpers uit: een bronassert op een routesuffix bewees niet
   waar fetch terechtkwam. Geen server/mock-UI: dit bewijst uitsluitend de
   requestgrens, inclusief de aparte gegevenspoort en begrensde herhaling. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const definities = [
  { naam: 'Sport', bestand: 'public/apps/sport.html', begin: 'const api=', eind: 'const eur=',
    prefix: '/api/member/sport', routes: ['/bord', '/stand', '/plattegrond', '/ticket/koop', '/tickets', '/momenten', '/sponsors', '/sponsor'] },
  { naam: 'Media', bestand: 'public/apps/media/wereld.js', begin: '  function api(', eind: '  var meldT',
    prefix: '/api/mediaos', routes: ['/wereld', '/bewaar', '/bieb'] },
  { naam: 'Vlucht', bestand: 'public/apps/vluchten-voorzijde.js', begin: 'const api =', eind: 'const START_VIEW',
    prefix: '/api/member/vluchten', routes: ['/bord', '/boek', '/mijn', '/incheck', '/pass/roteer', '/pass/intrek', '/charter'] }
];
function bron(d) {
  const tekst = fs.readFileSync(path.join(__dirname, '..', d.bestand), 'utf8');
  const begin = tekst.indexOf(d.begin), eind = tekst.indexOf(d.eind, begin);
  assert.ok(begin >= 0 && eind > begin, 'de echte helper moet herkenbaar blijven: ' + d.naam);
  return tekst.slice(begin, eind);
}
function laad(d, fetch, poort, verander = s => s) {
  return vm.runInNewContext(verander(bron(d)) + '\napi;', { fetch, TOKEN: 'test-lid', window: { RTGGegevensPoort: poort } });
}
const antwoord = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
// Echte Experience-client; alleen DOM en transport vormen de testgrens.
function experienceScherm(verwerk, token = 'lid-a') {
  const calls = [];
  function node(tag) {
    return { tag, children: [], dataset: {}, attrs: {}, events: {}, className: '',
      appendChild(c) { this.children.push(c); return c; },
      replaceChildren() { this.children = []; },
      replaceWith(c) { oud.vervanger = c; },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k]; },
      addEventListener(k, f) { this.events[k] = f; }, showModal() {}, close() {} };
  }
  const body = node('body'), oud = node('span');
  body.attrs['data-rtg-world'] = 'travel';
  const window = { addEventListener() {}, RTGId: (() => { let i = 0; return () => token + '-' + ++i; })() };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/experience-kernel.js'), 'utf8'), {
    window, document: { body, readyState: 'complete', createElement: node,
      querySelector: s => s === '.os-switcher__state' ? oud : null },
    localStorage: { getItem: () => token }, location: { pathname: '/apps/rtg.html', search: '' },
    async fetch(url, options) {
      const call = { route: url.slice('/api/experience/'.length), body: JSON.parse(options.body),
        authorization: options.headers.Authorization };
      calls.push(call);
      const r = await verwerk(call, calls);
      return antwoord(r.status || 200, r.body);
    }
  }, { filename: 'public/shared/experience-kernel.js' });
  function vind(cls, n = body) {
    if (n.className.split(' ').includes(cls)) return n;
    for (const c of n.children) { const match = vind(cls, c); if (match) return match; }
  }
  const klaar = () => new Promise(resolve => setImmediate(resolve));
  return { calls, api: window.RTGExperience, klaar, vind,
    async open() { await klaar(); oud.vervanger.events.click(); },
    async klik() { const knop = vind('xp-action'); assert.ok(knop); assert.notEqual(knop.disabled, true);
      knop.events.click(); await klaar(); } };
}
function experienceBeeld(titel = 'Vlucht om 19:30') {
  return { currentWorld: 'travel', currentContext: { id: 'persoonlijk' },
    contexts: [{ id: 'persoonlijk', label: 'Persoonlijk' }], manifests: { travel: { name: 'Reizen' } },
    projection: { attention: [{ id: 'aandacht-1', title: titel, lifecycle: 'OPEN', severity: 'INFO' }],
      attentionSummary: { open: 1 }, completeness: { status: 'COMPLETE' }, provenance: { sources: ['reis'] } } };
}
function experienceAntwoord(call, calls, execute, bootstrap = () => experienceBeeld()) {
  if (call.route === 'bootstrap') return { body: bootstrap() };
  if (call.route === 'evidence') return { body: { evidence: [] } };
  if (call.route === 'intent/preview') return { body: { preview: {
    id: 'preview-' + calls.filter(c => c.route === 'intent/preview').length } } };
  assert.equal(call.route, 'intent/execute'); return execute(call);
}
test('Experience: serverstatus en foutcode blijven beschikbaar voor gericht herstel', async () => {
  const s = experienceScherm((call, calls) => experienceAntwoord(call, calls,
    () => ({ status: 409, body: { code: 'STALE_ATTENTION', error: 'Bron gewijzigd.' } })));
  await s.klaar();
  await assert.rejects(s.api.execute({ previewId: 'oud' }), e => {
    assert.equal(e.status, 409); assert.equal(e.code, 'STALE_ATTENTION');
    assert.equal(e.message, 'Bron gewijzigd.'); return true;
  });
});
test('Experience: gewijzigde aandacht laadt de bron opnieuw en vraagt twee nieuwe menselijke stappen', async () => {
  let gewijzigd = false, uitvoeringen = 0;
  const s = experienceScherm((call, calls) => experienceAntwoord(call, calls, () => {
    uitvoeringen++; gewijzigd = true;
    return uitvoeringen === 1 ? { status: 409, body: { code: 'STALE_ATTENTION', error: 'Bron gewijzigd.' } }
      : { body: { ok: true } };
  }, () => experienceBeeld(gewijzigd ? 'Vlucht om 17:00' : 'Vlucht om 19:30')));
  await s.open(); await s.klik(); await s.klik();
  assert.equal(s.api.bootstrap().projection.attention[0].title, 'Vlucht om 17:00');
  assert.match(s.vind('xp-flash').textContent, /gewijzigd.*bevestig opnieuw/i);
  assert.equal(s.vind('xp-flash').attrs.role, 'status');
  assert.equal(s.vind('xp-action').textContent, 'Gezien');
  assert.equal(uitvoeringen, 1, 'vernieuwen voert nooit automatisch uit');
  await s.klik();
  assert.equal(uitvoeringen, 1, 'ook de eerste nieuwe klik maakt alleen een preview');
  assert.equal(s.vind('xp-action').textContent, 'Bevestig gezien');
  await s.klik();
  const verzonden = s.calls.filter(c => c.route === 'intent/execute');
  assert.equal(verzonden.length, 2);
  assert.notEqual(verzonden[0].body.previewId, verzonden[1].body.previewId);
  assert.notEqual(verzonden[0].body.idempotencyKey, verzonden[1].body.idempotencyKey);
});
test('Experience: verdwenen aandacht vóór preview vernieuwt zonder uitvoering', async () => {
  const s = experienceScherm((call, calls) => call.route === 'intent/preview'
    ? { status: 409, body: { code: 'STALE_ATTENTION', error: 'Verdwenen.' } }
    : experienceAntwoord(call, calls, () => { throw new Error('mag niet uitvoeren'); }));
  await s.open(); await s.klik();
  assert.equal(s.calls.filter(c => c.route === 'bootstrap').length, 2);
  assert.equal(s.calls.filter(c => c.route === 'intent/execute').length, 0);
  assert.match(s.vind('xp-flash').textContent, /gewijzigd/);
});
test('Experience: na mislukte bronvernieuwing mag de oude getoonde aandacht geen nieuwe preview krijgen', async () => {
  let gewijzigd = false, herladen = 0;
  const s = experienceScherm((call, calls) => experienceAntwoord(call, calls, () => {
    gewijzigd = true; return { status: 409, body: { code: 'STALE_ATTENTION', error: 'Bron gewijzigd.' } };
  }, () => { if (gewijzigd && ++herladen === 1) throw new Error('Offline');
    return experienceBeeld(gewijzigd ? 'Vlucht om 17:00' : 'Vlucht om 19:30'); }));
  await s.open(); await s.klik(); await s.klik();
  assert.match(s.vind('xp-flash').textContent, /niet.*opgehaald/i);
  await s.open(); await s.klik();
  assert.equal(s.calls.filter(c => c.route === 'intent/preview').length, 1,
    'opnieuw openen en klikken probeert alleen de actuele bron te laden');
  assert.equal(s.calls.filter(c => c.route === 'intent/execute').length, 1);
  assert.equal(s.api.bootstrap().projection.attention[0].title, 'Vlucht om 17:00');
  await s.klik();
  assert.equal(s.calls.filter(c => c.route === 'intent/preview').length, 2);
});
for (const fout of ['netwerk', 'UNAUTHORIZED', 'FORBIDDEN', 'STALE_CONTEXT']) {
  test('Experience: ' + fout + ' vervangt geen bevestiging of herhaalsleutel en wisselt geen account', async () => {
    let pogingen = 0;
    const s = experienceScherm((call, calls) => experienceAntwoord(call, calls, () => {
      if (++pogingen > 1) return { body: { ok: true, replay: true } };
      if (fout === 'netwerk') throw new Error('Verbinding verbroken na verzenden');
      return { status: fout === 'UNAUTHORIZED' ? 401 : fout === 'FORBIDDEN' ? 403 : 409,
        body: { code: fout, error: 'Aanvraag geweigerd.' } };
    }));
    await s.open(); await s.klik(); await s.klik();
    assert.equal(s.calls.filter(c => c.route === 'bootstrap').length, 1);
    assert.equal(s.calls.filter(c => c.route === 'intent/preview').length, 1);
    assert.equal(pogingen, 1, 'geen automatische herhaling na een fout');
    await s.klik();
    const uitvoer = s.calls.filter(c => c.route === 'intent/execute');
    assert.deepEqual(uitvoer[1], uitvoer[0], 'een mogelijk uitgevoerde aanvraag wordt exact herhaald');
    assert.ok(s.calls.every(c => c.authorization === 'Bearer lid-a'), 'herstel verandert de actor niet');
    const ander = experienceScherm((call, calls) => experienceAntwoord(call, calls,
      () => ({ body: { ok: true } })), 'lid-b');
    await ander.open(); await ander.klik();
    assert.equal(ander.calls.filter(c => c.route === 'intent/execute').length, 0,
      'een ander account erft geen bevestiging');
    await ander.klik();
    const tweede = ander.calls.find(c => c.route === 'intent/execute');
    assert.equal(tweede.authorization, 'Bearer lid-b');
    assert.notEqual(tweede.body.idempotencyKey, uitvoer[0].body.idempotencyKey);
  });
}
function verzoek(pad, opties, verwacht, body) {
  assert.equal(pad, verwacht, 'geen dubbele prefix of relatieve route');
  assert.equal(opties.method, 'POST');
  assert.equal(opties.headers.Authorization, 'Bearer test-lid');
  assert.equal(opties.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(opties.body), body);
}
for (const d of definities) {
  async function controle(verander) {
    for (const suffix of d.routes) {
      const pad = d.prefix + suffix, body = { id: 'test-object', aantal: 2 };
      let n = 0;
      const api = laad(d, async (p, o) => { n++; verzoek(p, o, pad, body); return antwoord(200, { id: 'antwoord' }); }, null, verander);
      assert.equal((await api(pad, body)).id, 'antwoord');
      assert.equal(n, 1);
    }
  }
  test(d.naam + ': exacte API-route, actor en inhoud blijven behouden', () => controle());
  test(d.naam + ': de requestproef detecteert prefix- en autorisatiemutaties', async () => {
    await assert.rejects(controle(s => s.replace('fetch(pad,', "fetch('" + d.prefix + "' + pad,")), /dubbele prefix/);
    await assert.rejects(controle(s => s.replace(/Authorization:\s*'Bearer '\s*\+\s*TOKEN/, "Authorization: 'Bearer ander'")), /Bearer ander/);
  });
}
for (const d of definities.filter(x => x.naam !== 'Media')) {
  test(d.naam + ': gegevenspoort opent eigen route en hervat uitsluitend de oorspronkelijke aanvraag', async () => {
    const pad = d.prefix + (d.naam === 'Sport' ? '/ticket/koop' : '/boek');
    const body = { id: 'vlucht-of-wedstrijd', idem: 'vaste-aanvraag' }, stappen = [];
    let poorten = 0;
    const api = laad(d, async (p, o) => {
      stappen.push(p);
      if (p === '/api/gegevens/start') {
        verzoek(p, o, p, { soort: 'vlucht' });
        return antwoord(200, { klaar: true });
      }
      verzoek(p, o, pad, body);
      return stappen.length === 1 ? antwoord(428, { error: 'Paspoortgegevens ontbreken.', soort: 'vlucht' }) : antwoord(200, { boeking: 'bevestigd' });
    }, { vang(data, status, opnieuw, call) {
      if (status !== 428) return null;
      poorten++;
      return call('/api/gegevens/start', { soort: data.soort }).then(() => opnieuw());
    } });
    assert.equal((await api(pad, body)).boeking, 'bevestigd');
    assert.deepEqual(stappen, [pad, '/api/gegevens/start', pad]);
    assert.equal(poorten, 1);
  });
  test(d.naam + ': tweede 428 wordt niet eindeloos herhaald en gewone fout blijft afgewezen', async () => {
    let n = 0, poorten = 0;
    const api = laad(d, async () => { n++; return antwoord(428, { error: 'Nog steeds gegevens nodig.' }); },
      { vang(data, status, opnieuw) { poorten++; return opnieuw(); } });
    await assert.rejects(api(d.prefix + '/boek', {}), /Nog steeds gegevens nodig/);
    assert.equal(n, 2); assert.equal(poorten, 1);
    const fout = laad(d, async () => antwoord(403, { error: 'Niet bevoegd.' }));
    await assert.rejects(fout(d.prefix + '/boek', {}), /Niet bevoegd/);
  });
}
