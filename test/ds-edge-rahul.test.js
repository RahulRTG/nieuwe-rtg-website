/* De echte Edge-modus kiest bestaande Rahul-bediening op het moment van
   verzenden. Deze ontwikkelcontrole bewijst routering en foutafhandeling,
   niet browserlayout, serverautorisatie of menselijke Experience-kwaliteit. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '..', 'public/ds/edge-modi.js'), 'utf8');
const afgehandeld = () => new Promise(resolve => setImmediate(resolve));

function maak({ token = 'test-lid', hook } = {}) {
  const modi = {}, bladen = [], verzoeken = [];
  let tokenLezingen = 0;
  function el(tag, klasse, attrs = {}) {
    return {
      tag, klasse, attrs, kinderen: [], events: {}, value: '',
      appendChild(child) { this.kinderen.push(child); return child; },
      addEventListener(naam, fn) { this.events[naam] = fn; },
      setAttribute(naam, waarde) { this.attrs[naam] = waarde; },
      click() { if (this.events.click) this.events.click(); }, focus() {}
    };
  }
  const balk = el('nav');
  const window = {
    RTGDs: { token() { tokenLezingen++; return token; },
      hulp: { el, svg: x => x, lippen: () => '', ICONEN: {} },
      edge: { registreer: (naam, fn) => { modi[naam] = fn; }, terug() {},
        delen: { balk: () => balk, knop: () => el('button'), lijst: regels => ({ regels }),
          openBlad: (titel, bron, inhoud) => { bladen.push({ titel, bron, inhoud }); } }
      }
    }
  };
  if (hook) window.RTGMetgezel = { rahul: hook };
  vm.runInNewContext(bron, {
    window, document: { createDocumentFragment: () => el('fragment') },
    setTimeout: fn => fn(),
    fetch: async (url, opties) => {
      verzoeken.push({ url, opties });
      return { json: async () => ({ antwoord: 'Bestaand ledenantwoord' }) };
    }
  });
  modi.rahul();
  const veld = balk.kinderen.find(x => x.tag === 'input');
  const stuur = balk.kinderen.find(x => x.attrs['aria-label'] === 'Verstuur');
  return { window, veld, stuur, bladen, verzoeken, tokenLezingen: () => tokenLezingen,
    verstuur(q, toetsenbord = false) {
      veld.value = q;
      if (toetsenbord) {
        let voorkomen = false;
        veld.events.keydown({ key: 'Enter', preventDefault() { voorkomen = true; } });
        assert.equal(voorkomen, true);
      } else stuur.click();
    }
  };
}

test('Edge draagt vragen over aan bestaande Rahul-bediening, ook zonder ledentoken', async () => {
  for (const token of [null, 'lid']) {
    const vragen = [];
    const ui = maak({ token, hook(q) { vragen.push(q); } });
    ui.verstuur('  Help met deze zaak  ', true);
    await afgehandeld();
    assert.deepEqual(vragen, ['Help met deze zaak']);
    assert.equal(ui.tokenLezingen(), 0, 'de bestaande eigenaar kiest actor en bevoegdheden');
    assert.equal(ui.verzoeken.length, 0, 'geen tweede AI-request uit de Edge');
    assert.equal(ui.bladen.length, 0, 'geen tweede antwoordweergave');
  }
});

test('de Edge zoekt de hook opnieuw op bij verzenden, niet alleen tijdens initialisatie', async () => {
  const ui = maak({ token: null }), vragen = [];
  ui.window.RTGMetgezel = { rahul: q => vragen.push(q) };
  ui.verstuur('Later geladen bediening');
  await afgehandeld();
  assert.deepEqual(vragen, ['Later geladen bediening']);
  assert.equal(ui.verzoeken.length, 0);
});

test('mislukte overdracht behoudt invoer en probeert geen tweede uitvoeringsweg', async () => {
  for (const soort of ['throw', 'reject', 'niet-overgenomen']) {
    const ui = maak({ hook() {
      if (soort === 'niet-overgenomen') return Promise.resolve(false);
      if (soort === 'reject') return Promise.reject(Error('Niet beschikbaar'));
      throw Error('Niet beschikbaar');
    } });
    ui.verstuur('Mijn vraag');
    await afgehandeld();
    assert.equal(ui.veld.value, 'Mijn vraag');
    assert.equal(ui.tokenLezingen(), 0);
    assert.equal(ui.verzoeken.length, 0);
    assert.equal(ui.bladen.length, 1);
    assert.equal(ui.bladen[0].inhoud.attrs.role, 'status');
    assert.match(ui.bladen[0].inhoud.textContent, /vraag blijft/);
  }
});

test('zonder gedeelde Rahul-bediening blijft het bestaande ledencontract intact', async () => {
  const ui = maak();
  const context = { verwijzingen: [{ soort: 'reisaanvraag', id: 'aanvraag-1' }] };
  ui.window.RTGEdgeBlikveld = { voorRahul: () => context };
  ui.verstuur('Bekijk mijn aanvraag');
  await afgehandeld();
  assert.equal(ui.verzoeken.length, 1);
  const { url, opties } = ui.verzoeken[0];
  assert.equal(url, '/api/fluister');
  assert.equal(opties.method, 'POST');
  assert.equal(opties.headers.Authorization, 'Bearer test-lid');
  assert.deepEqual(JSON.parse(opties.body), { q: 'Bekijk mijn aanvraag', context });
  assert.equal(ui.bladen[0].inhoud.textContent, 'Bestaand ledenantwoord');
});

test('anonieme of lege vragen starten geen transport', async () => {
  const ui = maak({ token: null });
  ui.verstuur('   ');
  assert.equal(ui.bladen.length, 0);
  ui.verstuur('Vraag');
  await afgehandeld();
  assert.equal(ui.verzoeken.length, 0);
  assert.match(ui.bladen[0].inhoud.kinderen[0].textContent, /Log in/);
  assert.equal(ui.bladen[0].inhoud.kinderen[1].regels[0].href, '/apps/app.html');
});

// Geen vriendelijker hookstub: voer ook de bestaande Rahul-tab zelf uit,
// inclusief de echte accountgebonden sessieopslag. DOM/transport blijven
// testgrenzen; serverautorisatie en browsergeometrie vragen aparte bewijzen.
function echteRahul({ soort = 'supplier' } = {}) {
  const verzoeken = [], wachtenden = [], beslissingen = [];
  let gewist = 0;
  function node() {
    const kinderen = new Map(), klassen = new Set();
    return { value: '', innerHTML: '', hidden: false, textContent: '', dataset: {},
      classList: { add: k => klassen.add(k), remove: k => klassen.delete(k),
        toggle(k, aan) { if (aan) klassen.add(k); else klassen.delete(k); } },
      appendChild() {}, insertAdjacentHTML() {}, setAttribute() {}, focus() {}, remove() { this.removed = true; },
      querySelector(k) { if (!kinderen.has(k)) kinderen.set(k, node()); return kinderen.get(k); },
      querySelectorAll: () => []
    };
  }
  const host = node(); host.querySelector = () => null;
  const tokenData = new Map([['rtg_' + (soort === 'supplier' ? 'sup' : 'member') + '_token', 'actor-A']]);
  function opslag(map = new Map()) {
    return { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  }
  const document = {
    body: node(), head: node(), createElement: () => node(), getElementById: () => null, addEventListener() {},
    querySelector: k => k === '.wk-tabs' ? host : null
  };
  const context = { app: 'Werkblad', deel: 'Aanvraag', verwijzingen: [{ soort: 'aanvraag', id: '123' }] };
  const env = {
    document, localStorage: opslag(tokenData), sessionStorage: opslag(),
    crypto: require('node:crypto').webcrypto, TextEncoder,
    addEventListener() {}, setTimeout: fn => fn(),
    RTGRahulSession: require('../public/shared/rahul-tab/session'),
    RTGRahulTabHelpers: { tekst: x => String(x), context: () => context, suggesties: () => [],
      bericht: b => b.tekst, noot: () => '', werk() {} },
    RTGRahulApproval: { create: () => ({ clear() { gewist++; }, confirm() {}, show: (...args) => beslissingen.push(args) }) },
    fetch: (url, opties) => new Promise((resolve, reject) => {
      verzoeken.push({ url, opties, resolve: (data, status = 200) => resolve({ ok: status >= 200 && status < 300, status, json: async () => data }), reject });
      for (const fn of wachtenden.splice(0)) fn();
    })
  };
  env.window = env;
  // Ook de werkelijke resethelper, geen nagebouwde accountwissel in de fixture.
  const helpers = env.RTGRahulTabHelpers;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/shared/rahul-tab/helpers.js'), 'utf8'), env);
  helpers.wis = env.RTGRahulTabHelpers.wis;
  helpers.begin = env.RTGRahulTabHelpers.begin;
  helpers.actueel = env.RTGRahulTabHelpers.actueel;
  env.RTGRahulTabHelpers = helpers;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/shared/rahul-tab.js'), 'utf8'), env);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/shared/rahul-tab/workspace.js'), 'utf8'), env);
  return { window: env, context, verzoeken, beslissingen, tokenData, gewist: () => gewist,
    veld: env.__rahulTabCommand.page.querySelector('input'),
    log: env.__rahulTabCommand.page.querySelector('.rtg-command-log'),
    async wachtOpVraag(aantal = 1) {
      if (verzoeken.length < aantal) await new Promise(resolve => wachtenden.push(resolve));
      return verzoeken[aantal - 1];
    }
  };
}

test('echte Rahul-hook meldt ontbrekende helpers aan de Edge en kan daarna herstellen', { timeout: 5000 }, async () => {
  const r = echteRahul(), helpers = r.window.RTGRahulTabHelpers;
  r.window.RTGRahulTabHelpers = null;
  let resultaat;
  const ui = maak({ token: null, hook: q => (resultaat = r.window.RTGMetgezel.rahul(q)) });
  ui.verstuur('Bewaar deze vraag');
  assert.equal(await resultaat, false);
  await afgehandeld();
  assert.equal(r.verzoeken.length, 0);
  assert.equal(ui.veld.value, 'Bewaar deze vraag');
  assert.match(ui.bladen[0].inhoud.textContent, /vraag blijft/);
  r.window.RTGRahulTabHelpers = helpers;
  ui.verstuur(ui.veld.value);
  const req = await r.wachtOpVraag();
  assert.equal(req.url, '/api/supplier/ai');
  assert.equal(req.opties.headers.Authorization, 'Bearer actor-A');
  assert.deepEqual(JSON.parse(req.opties.body), { q: 'Bewaar deze vraag', context: r.context });
  req.resolve({ antwoord: 'Via de bestaande zaakbediening' });
  assert.equal(await resultaat, true);
  assert.equal(ui.verzoeken.length, 0);
  assert.match(r.log.innerHTML, /Via de bestaande zaakbediening/);
  assert.equal(r.beslissingen.length, 1, 'bestaande goedkeuringslaag ontvangt het resultaat');
});

test('echte Rahul-hook neemt bij gelijktijdige ingangen slechts één vraag over', { timeout: 5000 }, async () => {
  const r = echteRahul({ soort: 'member' });
  r.veld.value = 'Onverzonden werkbladdraft';
  const eerste = r.window.RTGMetgezel.rahul('Eerste vraag');
  const tweede = r.window.RTGMetgezel.rahul('Tweede vraag');
  const req = await r.wachtOpVraag();
  assert.equal(await tweede, false);
  assert.equal(req.url, '/api/fluister');
  assert.equal(JSON.parse(req.opties.body).q, 'Eerste vraag');
  assert.equal(r.verzoeken.length, 1);
  assert.equal(r.veld.value, 'Onverzonden werkbladdraft');
  assert.equal(await r.window.RTGMetgezel.rahul('Derde vraag'), false);
  req.resolve({ antwoord: 'Eerste antwoord' });
  assert.equal(await eerste, true);
  const retry = r.window.RTGMetgezel.rahul('Tweede vraag');
  // De tweede fetch is een gevolg van sessiehashing: wacht op het verzoek.
  (await r.wachtOpVraag(2)).resolve({ antwoord: 'Tweede antwoord' });
  assert.equal(await retry, true);
  assert.equal(r.verzoeken.length, 2);
});

test('echte Rahul-hook geeft async openfouten terug zonder te verzenden', { timeout: 5000 }, async () => {
  const r = echteRahul();
  r.window.RTGRahulSession = { create: () => ({ read: async () => { throw Error('Sessie onbereikbaar'); } }) };
  assert.equal(await r.window.RTGMetgezel.rahul('Vraag'), false);
  assert.equal(r.verzoeken.length, 0);
});

test('een antwoord van de vorige actor komt niet in gesprek of goedkeuring van de nieuwe actor', { timeout: 5000 }, async () => {
  const r = echteRahul();
  const vraag = r.window.RTGMetgezel.rahul('Vraag actor A');
  const req = await r.wachtOpVraag();
  r.tokenData.set('rtg_sup_token', 'actor-B');
  req.resolve({ antwoord: 'Vertrouwelijk antwoord van A', gedaan: true });
  assert.equal(await vraag, true);
  assert.doesNotMatch(r.log.innerHTML, /Vertrouwelijk antwoord|Vraag actor A/);
  assert.equal(r.beslissingen.length, 0);
});

test('actorwissel wist ook de bestaande concept- en resultaatpresentatie, geen verzoek nodig', { timeout: 5000 }, async () => {
  const r = echteRahul(), page = r.window.__rahulTabCommand.page;
  let twinGewist = 0, kompas;
  r.window.RTGLiveTwin = { clear() { twinGewist++; }, context() {} };
  r.window.RTGKompas = { toon(d) { kompas = d; } };
  await r.window.RTGMetgezel.rahul();
  r.veld.value = 'Privéconcept van actor A';
  page.querySelector('[data-done]').textContent = 'Uitvoering voor actor A';
  r.tokenData.set('rtg_sup_token', 'actor-B');
  assert.equal(await r.window.RTGMetgezel.rahul(), true);
  assert.equal(r.veld.value, '');
  assert.equal(page.querySelector('.rtg-conceptwerk').removed, true);
  assert.equal(page.querySelector('[data-done]').textContent, 'Geen uitvoering in deze sessie');
  assert.equal(page.querySelector('[data-ai-state]').textContent, 'Nog geen actuele route gecontroleerd');
  assert.equal(twinGewist, 1);
  assert.equal(kompas, null);
  assert.equal(r.verzoeken.length, 0);
});

test('een late antwoordselectie geeft geen nieuw concept of goedkeuring voor een ander object', { timeout: 5000 }, async () => {
  const r = echteRahul({ soort: 'member' });
  let concepten = 0;
  r.window.RTGRahulTabHelpers.werk = () => { concepten++; };
  const eerste = r.window.RTGMetgezel.rahul('Bekijk aanvraag 123');
  const req = await r.wachtOpVraag();
  // Mutatie van dezelfde objectreferentie tijdens transport: ook die moet
  // verschillen van de vastgelegde context die daadwerkelijk is verzonden.
  r.context.verwijzingen[0].id = '456';
  req.resolve({ antwoord: 'Voorstel voor aanvraag 123', gedaan: true, taak: { concept: { id: 'oud', bewerkbaar: true } } });
  assert.equal(await eerste, true);
  assert.equal(JSON.parse(req.opties.body).context.verwijzingen[0].id, '123');
  assert.doesNotMatch(r.log.innerHTML, /Voorstel voor aanvraag 123/);
  assert.match(r.log.innerHTML, /niet aan de huidige selectie/);
  assert.equal(concepten, 0);
  assert.equal(r.beslissingen.length, 0);
  assert.notEqual(r.window.__rahulTabCommand.page.querySelector('[data-done]').textContent, 'Laatste opdracht uitgevoerd en vastgelegd');
  const volgende = r.window.RTGMetgezel.rahul('Bekijk aanvraag 456');
  (await r.wachtOpVraag(2)).resolve({ antwoord: 'Actueel voorstel voor 456' });
  assert.equal(await volgende, true);
  assert.match(r.log.innerHTML, /Actueel voorstel voor 456/);
  assert.equal(concepten, 1);
  assert.equal(r.beslissingen.length, 1);
});

test('zonder geladen contextcontrole wordt een antwoord niet stilzwijgend een uitvoerbaar voorstel', { timeout: 5000 }, async () => {
  const r = echteRahul();
  r.window.RTGLiveTwin = null;
  const vraag = r.window.RTGMetgezel.rahul('Wacht op de bestaande contextlaag');
  (await r.wachtOpVraag()).resolve({ antwoord: 'Nog niet gebonden aan de selectie' });
  assert.equal(await vraag, true);
  assert.equal(r.beslissingen.length, 0);
  assert.match(r.log.innerHTML, /niet aan de huidige selectie/);
});

test('een nieuwe vraag wist het oude voorstel maar behoudt het veilige werkconcept', { timeout: 5000 }, async () => {
  const r = echteRahul({ soort: 'member' }), page = r.window.__rahulTabCommand.page;
  const eerste = r.window.RTGMetgezel.rahul('Eerst');
  (await r.wachtOpVraag()).resolve({ antwoord: 'Eerste voorstel', gedaan: true });
  await eerste;
  assert.equal(r.gewist(), 1);
  assert.equal(r.beslissingen.length, 1);
  const volgende = r.window.RTGMetgezel.rahul('Opnieuw');
  const req = await r.wachtOpVraag(2);
  assert.equal(r.gewist(), 2, 'oude actie al ingetrokken terwijl het nieuwe verzoek nog wacht');
  assert.notEqual(page.querySelector('.rtg-conceptwerk').removed, true,
    'een niet-uitvoerbaar werkconcept blijft de actieve context');
  assert.equal(page.querySelector('[data-done]').textContent, 'Geen actuele uitvoeringsbevestiging');
  req.reject(Error('Offline'));
  await volgende;
  assert.equal(r.beslissingen.length, 1, 'geen herpublicatie van de oude actie');
});

test('HTTP- en productfouten publiceren geen concept, akkoord of uitvoeringsclaim', { timeout: 5000 }, async () => {
  for (const [status, extra] of [[500, {}], [401, {}], [200, { error: 'Niet toegestaan' }], [200, { ok: false }]]) {
    const r = echteRahul({ soort: 'member' });
    let concepten = 0;
    r.window.RTGRahulTabHelpers.werk = () => { concepten++; };
    const vraag = r.window.RTGMetgezel.rahul('Mijn opdracht');
    (await r.wachtOpVraag()).resolve({ antwoord: 'Onterecht resultaat', gedaan: true,
      taak: { concept: { id: 'ongeldig', bewerkbaar: true } }, ...extra }, status);
    await vraag;
    assert.equal(concepten, 0);
    assert.equal(r.beslissingen.length, 0);
    assert.match(r.log.innerHTML, /Mijn opdracht/, 'de fout verwijdert niet ook de gebruikersvraag');
    assert.doesNotMatch(r.log.innerHTML, /Onterecht resultaat/);
    assert.equal(r.window.__rahulTabCommand.page.querySelector('[data-done]').textContent, 'Geen actuele uitvoeringsbevestiging');
  }
});
