'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { bundel } = require('../scripts/bundel');
const { fixture, tick } = require('./lib/foundation-ds-fixture');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('Foundation Samen reserveert het volledige Uitstap-raakvlak', () => {
  const css = read('public/ds/componenten/samen.css');
  assert.match(css, /\.ds-uitstap-actief \.ds-samen-venster--foundation/);
  assert.match(css, /var\(--ds-doel\)/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test('de Foundation-deur verbergt ook expliciet zichtbare afstammelingen', () => {
  const css = read('public/ds/componenten/foundation.css');
  assert.match(css, /\.ds-foundation-dicht body > :not\(\.ds-foundation-toegang\):not\(\.wd-shell\) \*/);
  assert.match(css, /\.ds-foundation-dicht \.wd-shell > :not\(\.ds-foundation-toegang\) \*/);
});

test('de Foundation-deur sluit de bestaande documentinhoud ook vóór CSS geladen is', () => {
  const bron = bundel('apps/foundation/sessie.js').toString('utf8');
  assert.match(bron, /function verbergToegangAchtergrond\(slot\)/);
  assert.match(bron, /node\.hidden = true; node\.setAttribute\('inert', ''\)/);
  assert.match(bron, /function herstelToegangAchtergrond\(\)/);
});

test('Foundation door remains fail-closed and uses the canonical presentation on every host', async () => {
  for (const ds of [false, true]) {
    const f = fixture({ ds });
    const gate = f.node('#rtf-toegang-slot');
    assert.equal(gate.open, true);
    assert.equal(f.document.querySelectorAll('style').length, 0);
    const presentatie = f.document.getElementById('rtgDsRuntimeCss');
    assert.equal(!!presentatie, !ds);
    if (presentatie) { assert.equal(presentatie.tagName, 'LINK'); assert.equal(presentatie.href, '/ds/rtg-ds.css'); }
    assert.equal(gate.classList.contains('ds-foundation-toegang'), true);
    assert.deepEqual(JSON.parse(f.requests[0].opts.body), { code: 'GEZIN', token: 'TOKEN', appId: 'rtf-studie', scherm: 'app' });
    f.reply(f.requests[0], { toegestaan: true }, 403); await tick();
    assert.equal(f.document.documentElement.classList.contains('rtf-toegang-dicht'), true, '403 cannot unlock');
    const link = gate.querySelector('[data-rtf-wissel]'); link.click();
    const stored = JSON.parse(f.storage.get('rtf_sessie'));
    assert.equal(stored.token, undefined); assert.equal(stored.profiel, undefined); assert.equal(stored.wissel, 'TOKEN');
  }
});

test('valid admission removes both DS and legacy locks; session profile menu restores focus', async () => {
  const f = fixture(); f.reply(f.requests[0], { toegestaan: true, groep: 'volwassen' }); await tick();
  assert.equal(f.node('#rtf-toegang-slot'), null);
  assert.equal(f.document.documentElement.classList.contains('ds-foundation-dicht'), false);
  const bar = f.add('div'); f.session.balk(bar, { terug: 'index.html' });
  const prof = bar.querySelector('#sbProf'); assert.ok(prof.classList.contains('ds-knop'));
  prof.click(); assert.equal(prof.getAttribute('aria-expanded'), 'true');
  bar.querySelector('#sbWissel').focus(); bar.fire('keydown', { key: 'Escape' });
  assert.equal(bar.querySelector('#sbMenu').hidden, true); assert.equal(f.document.activeElement, prof);
  assert.equal(f.document.querySelectorAll('style').length, 0);
});

test('coach preserves family/age payload, escapes input, serializes DS questions and recovers failed draft', async () => {
  const f = fixture(); const chat = f.add('div'), input = f.add('textarea'), knop = f.add('button');
  f.session.coach({ kind: 'studie', chat, input, knop });
  input.value = '<img src=x onerror=bad()>'; knop.click();
  const req = f.requests.at(-1), payload = JSON.parse(req.opts.body);
  assert.equal(req.url, '/api/foundation/hulp/ai');
  assert.equal(payload.code, 'GEZIN'); assert.equal(payload.token, 'TOKEN'); assert.equal(payload.kind, 'studie'); assert.equal(payload.groep, 'volwassen');
  assert.equal(chat.querySelector('img'), null); assert.match(chat.textContent, /<img/);
  assert.equal(knop.disabled, true);
  const count = f.requests.length; input.value = 'Volgende vraag'; input.fire('keydown', { key: 'Enter' }); assert.equal(f.requests.length, count);
  f.reply(req, { error: 'Storing' }, 503); await tick();
  assert.equal(input.value, 'Volgende vraag', 'later draft must survive'); assert.equal(knop.disabled, false);
  input.value = 'Herstel mij'; knop.click(); f.reply(f.requests.at(-1), {}, 200); await tick();
  assert.equal(input.value, 'Herstel mij', 'empty positive HTTP response is not a valid answer');
  knop.click(); const retry = JSON.parse(f.requests.at(-1).opts.body);
  assert.deepEqual(retry.messages, [{ role: 'user', content: 'Herstel mij' }], 'failed questions are not duplicated in the next attempt');
  f.reply(f.requests.at(-1), { text: 'Een echte antwoordtekst' }); await tick(); assert.match(chat.textContent, /Een echte antwoordtekst/);
});

test('Samen and Family Rahul use canonical DS without changing their transport or focus return', async () => {
  const f = fixture(); const bar = f.add('div'); f.session.balk(bar); f.samen();
  assert.equal(f.document.querySelectorAll('style').length, 0);
  const trigger = f.node('.rsm-knop'); trigger.click();
  const panel = f.node('.rsm-sheet'); assert.equal(panel.hidden, false); assert.ok(panel.classList.contains('ds-samen-venster'));
  panel.fire('keydown', { key: 'Escape' }); assert.equal(panel.hidden, true); assert.equal(f.document.activeElement, trigger);
  const rahul = f.node('.rsm-rahul'); rahul.click(); const rp = f.node('.rsm-rsheet');
  const input = rp.querySelector('input'), form = rp.querySelector('form'); input.value = 'Kun je helpen?'; form.fire('submit');
  const req = f.requests.at(-1); assert.equal(req.url, '/api/rtf/rahul'); assert.deepEqual(JSON.parse(req.opts.body), { code: 'GEZIN', token: 'TOKEN', q: 'Kun je helpen?' });
  form.fire('submit'); assert.equal(f.requests.at(-1), req);
  f.reply(req, { error: 'Geen antwoord' }, 503); await tick(); assert.equal(input.value, 'Kun je helpen?');
  rp.fire('keydown', { key: 'Escape' }); assert.equal(f.document.activeElement, rahul);
});

test('alle Foundation-hosts van Samen laden de centrale presentatie vooraf', () => {
  const map = path.join(__dirname, '..', 'public/apps/foundation');
  const hosts = fs.readdirSync(map).filter(name => name.endsWith('.html')).filter(name =>
    fs.readFileSync(path.join(map, name), 'utf8').includes('src="samen.js"'));
  assert.equal(hosts.length, 56, 'een nieuw Samen-scherm vergroot expliciet de noemer');
  for (const name of hosts) {
    const html = fs.readFileSync(path.join(map, name), 'utf8');
    assert.ok(/href="\/ds\/rtg-ds\.css"/.test(html) ||
      (/href="\/ds\/tokens\.css"/.test(html) && /href="\/ds\/componenten\/samen\.css"/.test(html)),
    name + ' mist de minimale centrale Samen-presentatie');
  }
  const bron = bundel('apps/foundation/samen.js').toString('utf8');
  assert.doesNotMatch(bron, /createElement\(['"]style['"]\)|var (?:rCss|css)\s*=/,
    'Samen en Rahul bezitten geen runtime-stijl meer');
});

test('all three routes retain existing APIs and no longer execute legacy visual sheets', () => {
  for (const name of ['studie','hulpwijzer','steun']) {
    const html = read('public/apps/foundation/' + name + '.html');
    assert.match(html, /<html[^>]*data-ds/); assert.match(html, /<main\b/);
    assert.doesNotMatch(html, /<style\b|href="(?:stijl|premium)\.css"|src="\/shared\/levendekleur\.js"/);
    assert.match(html, /Sessie\.eisFamilie\(\)/); assert.match(html, /Sessie\.coach\(/); assert.match(html, /src="samen\.js"/);
    for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if (m[1].trim()) new vm.Script(m[1]);
  }
  for (const owner of ['sessie', 'samen']) new vm.Script(bundel('apps/foundation/' + owner + '.js'));
});

test('coach and Family Rahul reject explicit failure and never publish a former profile reply', async () => {
  for (const owner of ['coach', 'rahul']) {
    const f = fixture(), input = f.add('textarea'), knop = f.add('button'), chat = f.add('div');
    let send, output;
    if (owner === 'coach') { f.session.coach({ kind: 'steun', input, knop, chat }); send = text => { input.value = text; knop.click(); }; output = () => chat.textContent; }
    else { f.session.balk(f.add('div')); f.samen(); f.node('.rsm-rahul').click(); const ri = f.node('.rsm-rsheet').querySelector('input'); send = text => { ri.value = text; f.node('.rsm-rsheet').querySelector('form').fire('submit'); }; output = () => f.node('.rsm-ruit').textContent; }
    for (const failure of [{ error: 'Weigering' }, { ok: false }]) {
      send('Proef'); f.reply(f.requests.at(-1), { ...failure, text: 'ONJUIST SUCCES', antwoord: 'ONJUIST SUCCES' }); await tick();
      assert.doesNotMatch(output(), /ONJUIST SUCCES/, owner);
    }
    send('Privévraag'); const pending = f.requests.at(-1);
    f.session.zet({ code: 'ANDER', token: 'NIEUW', profiel: { id: 'kind' } });
    f.reply(pending, { text: 'OUDE PRIVÉ INHOUD', antwoord: 'OUDE PRIVÉ INHOUD' }); await tick();
    assert.doesNotMatch(output(), /OUDE PRIVÉ INHOUD/, owner);
    const count = f.requests.length; send('Nieuwe poging'); assert.equal(f.requests.length, count, 'oude owner gebruikt nooit het vorige gezinstoken');
  }
});

test('Foundation session, Samen en Rahul delen ook op een oudere host dezelfde DS-owner', () => {
  const f = fixture({ ds: false }); f.session.balk(f.add('div')); f.samen();
  assert.equal(f.document.getElementById('rtgDsRuntimeCss').href, '/ds/rtg-ds.css');
  assert.ok(f.node('.sb-balk').classList.contains('ds-foundation-sessierij'));
  assert.equal(f.document.querySelectorAll('style').length, 0);
  assert.ok(f.node('.rsm-sheet').classList.contains('ds-samen-venster'));
  assert.ok(f.node('.rsm-rsheet').classList.contains('ds-samen-venster'));
});

test('world navigation uses the existing hand owner, including cookie/event, with an offline legacy fallback', () => {
  for (const shared of [false, true]) {
    const f = fixture(), events = [];
    f.context.dispatchEvent = e => events.push(e.type);
    f.document.readyState = 'complete'; f.context.matchMedia = () => ({ matches: true });
    if (shared) vm.runInContext(read('public/shared/hand.js'), f.context);
    vm.runInContext(read('public/shared/wereldschil.js'), f.context);
    const before = f.document.documentElement.getAttribute('data-hand');
    assert.equal(before, shared ? 'rechts' : 'links');
    f.node('.ws-hand').click(); const after = before === 'rechts' ? 'links' : 'rechts';
    assert.equal(f.document.documentElement.getAttribute('data-hand'), after);
    assert.equal(f.storage.get('rtg_hand'), after);
    assert.equal(f.context.RTGWereldSchil.hand(), after);
    if (shared) { assert.equal(f.context.RTGHand.is(), after); assert.match(f.document.cookie, new RegExp('rtg_hand=' + after)); assert.equal(events.at(-1), 'rtg-hand'); }
    assert.equal(f.document.querySelectorAll('.ws-doel').length, 6);
  }
});

test('Samen accepteert uitsluitend kale interne app- en sitepaden voor meegaan', () => {
  const bron = bundel('apps/foundation/samen.js').toString('utf8').replace(/\}\)\(\);\s*$/,
    'window.__veiligSamenPad=veiligSamenPad;})();');
  const f = fixture(); f.samen(bron);
  for (const geldig of ['/apps/foundation/studie.html', '/site/hotel.html'])
    assert.equal(f.context.__veiligSamenPad(geldig), geldig);
  for (const onveilig of ['https://voorbeeld.nl/apps/a.html','//voorbeeld.nl/apps/a.html','/apps/../kantoor.html',
    '/apps/a.html?token=geheim','/apps/a.html#stap',' /apps/a.html','javascript:alert(1)'])
    assert.equal(f.context.__veiligSamenPad(onveilig), '', onveilig);
  assert.match(bron, /window\.location\.assign\(pad\)/);
  assert.doesNotMatch(bron, /location\.href\s*=/);
});
