'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/apps/foundation/index.html'), 'utf8');
const begin = html.indexOf('// ---- verplichte onboarding + contract');
const einde = html.indexOf('\nfunction esc(t)', begin);
assert.ok(begin >= 0 && einde > begin, 'het echte RTF-onboardingblok is aanwezig');
const bron = html.slice(begin, einde);

function element(tag = 'div') {
  let tekst = '';
  return {
    tag, children: [], dataset: {}, events: {}, value: '', checked: false, hidden: true,
    get textContent() { return tekst; },
    set textContent(value) { tekst = value; this.children = []; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(event, fn) { this.events[event] = fn; },
    querySelectorAll(selector) {
      assert.equal(selector, 'input[data-veld]');
      const gevonden = [];
      function bezoek(node) {
        if (node.tag === 'input' && node.dataset.veld) gevonden.push(node);
        node.children.forEach(bezoek);
      }
      this.children.forEach(bezoek);
      return gevonden;
    }
  };
}

function status(versie, extra = {}) {
  return { klaar: false, velden: [], contract: {
    versie, titel: 'Overeenkomst ' + versie, tekst: 'Contracttekst ' + versie, ondertekend: false
  }, ...extra };
}

function scherm(antwoord) {
  const nodes = Object.fromEntries(['rtfOnb', 'rtfOnbVelden', 'rtfOnbCTitel', 'rtfOnbCTekst',
    'rtfOnbAkk', 'rtfOnbFout', 'rtfOnbDoe', 'rtfOnbNaam'].map(id => [id, element()]));
  const calls = [];
  const context = vm.createContext({
    $: selector => nodes[selector.slice(1)],
    Sessie: { huidig: () => ({ code: 'GEZIN', token: 'gezinstoken' }) },
    document: {
      createElement: element,
      querySelectorAll(selector) {
        assert.equal(selector, '#rtfOnbVelden input[data-veld]');
        return nodes.rtfOnbVelden.querySelectorAll('input[data-veld]');
      }
    },
    async fetch(url, options) {
      const call = { url, body: JSON.parse(options.body), method: options.method };
      calls.push(call);
      const r = await antwoord(call);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    }
  });
  vm.runInContext(bron, context, { filename: 'foundation/index.html:onboarding' });
  return { nodes, calls, context, toon: st => context.tekenOnbRtf(st),
    teken: () => nodes.rtfOnbDoe.events.click() };
}

test('ondertekenen verstuurt de getoonde versie, ook als opslaan een nieuwere versie teruggeeft', async () => {
  const s = scherm(call => call.url.endsWith('/opslaan')
    ? { status: 200, body: status(8) }
    : { status: 200, body: { ...status(7), klaar: true } });
  s.toon(status(7, { velden: [{ id: 'email', label: 'E-mail', type: 'email', waarde: 'ouder@example.test' }] }));
  s.nodes.rtfOnbNaam.value = ' Sam Ouder ';
  s.nodes.rtfOnbAkk.checked = true;
  await s.teken();
  assert.deepEqual(s.calls.map(c => c.url), ['/api/rtf/onboarding/opslaan', '/api/rtf/onboarding/teken']);
  assert.deepEqual(s.calls[1].body, { code: 'GEZIN', token: 'gezinstoken',
    naam: 'Sam Ouder', akkoord: true, expectedVersion: 7 });
  assert.equal(s.nodes.rtfOnb.hidden, true);
});

test('een gewijzigde getoonde versie wist het oude akkoordvinkje', () => {
  const s = scherm(() => { throw new Error('geen verzoek verwacht'); });
  s.toon(status(7));
  s.nodes.rtfOnbAkk.checked = true;
  s.toon(status(7));
  assert.equal(s.nodes.rtfOnbAkk.checked, true, 'dezelfde tekst opnieuw tekenen wist de invoer niet');
  s.toon(status(8));
  assert.equal(s.nodes.rtfOnbAkk.checked, false, 'een akkoord voor versie 7 geldt niet voor versie 8');
  assert.equal(s.nodes.rtfOnbCTekst.textContent, 'Contracttekst 8');
  assert.equal(s.calls.length, 0);
});

for (const versie of [7, undefined]) {
  test((versie === undefined ? 'ontbrekende' : 'verouderde') + ' versie: 409 vernieuwt de tekst zonder automatisch te tekenen', async () => {
    const s = scherm(call => call.url.endsWith('/teken')
      ? { status: 409, body: { code: 'version_conflict', error: 'Lees de nieuwe overeenkomst.' } }
      : { status: 200, body: status(8) });
    s.toon(status(versie));
    s.nodes.rtfOnbNaam.value = 'Sam Ouder';
    s.nodes.rtfOnbAkk.checked = true;
    await s.teken();
    assert.deepEqual(s.calls.map(c => c.url), ['/api/rtf/onboarding/teken', '/api/rtf/onboarding/status']);
    assert.equal(s.nodes.rtfOnb.hidden, false);
    assert.equal(s.nodes.rtfOnbCTekst.textContent, 'Contracttekst 8');
    assert.equal(s.nodes.rtfOnbAkk.checked, false);
    assert.equal(s.nodes.rtfOnbNaam.value, 'Sam Ouder');
    assert.match(s.nodes.rtfOnbFout.textContent, /overeenkomst|versie/);
  });
}

test('de API-fout behoudt status en code voor een gerichte herstelhandeling', async () => {
  const s = scherm(() => ({ status: 409, body: { code: 'name_conflict', error: 'Deze versie is al op een andere naam getekend.' } }));
  await assert.rejects(s.context.onbApiRtf('/teken', {}), error => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'name_conflict');
    assert.match(error.message, /andere naam/);
    return true;
  });
});

test('een naamconflict meldt de weigering en probeert de bestaande ontvangst niet te vervangen', async () => {
  const s = scherm(() => ({ status: 409, body: { code: 'name_conflict', error: 'Deze versie is al op een andere naam getekend.' } }));
  s.toon(status(7));
  s.nodes.rtfOnbNaam.value = 'Andere Ouder';
  s.nodes.rtfOnbAkk.checked = true;
  await s.teken();
  assert.deepEqual(s.calls.map(c => c.url), ['/api/rtf/onboarding/teken']);
  assert.equal(s.nodes.rtfOnbCTekst.textContent, 'Contracttekst 7');
  assert.equal(s.nodes.rtfOnbNaam.value, 'Andere Ouder');
  assert.equal(s.nodes.rtfOnb.hidden, false);
  assert.match(s.nodes.rtfOnbFout.textContent, /andere naam/);
});
