'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('negen Horeca-schermen gebruiken de centrale niet-interactieve melding met hun bestaande statusdoel', () => {
  for (const naam of ['bar', 'vloer', 'haccp', 'club', 'events', 'hotel', 'expeditie', 'bezorg', 'beheer']) {
    const html = read('public/apps/horeca-' + naam + '.html');
    const doel = [...html.matchAll(/<div\b[^>]*\bid="melding"[^>]*>/g)];
    assert.equal(doel.length, 1, naam + ': één bestaand meldingsdoel');
    assert.match(doel[0][0], /class="melding ds-melding"/);
    assert.match(doel[0][0], /role="status"/);
    assert.doesNotMatch(html, /ds-horeca-melding/);
  }
  assert.doesNotMatch(read('public/ds/componenten/horeca.css'), /ds-horeca-melding/);
  assert.match(read('public/ds/rtg-ds.css'), /componenten\/melding\.css/);
  const css = read('public/ds/componenten/melding.css');
  assert.match(css, /\.ds-melding\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.ds-melding\.toon,\s*\.ds-melding\.zie\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /\.ds-melding--blijft\s*\{[^}]*pointer-events:\s*auto/,
    'de blijvende mediapoort houdt haar bestaande sluitbediening');
});

test('de echte Horeca-owner behoudt tekst, zie-status en timervervanging op hetzelfde DOM-doel', () => {
  const klassen = new Set(['melding', 'ds-melding']), timers = new Map(); let nr = 0;
  const doel = { textContent: '', classList: { add: k => klassen.add(k), remove: k => klassen.delete(k) } };
  const c = { window: {}, localStorage: { getItem: () => null },
    document: { getElementById: id => { assert.equal(id, 'melding'); return doel; } },
    setTimeout(fn, ms) { assert.equal(ms, 3000); timers.set(++nr, fn); return nr; },
    clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(read('public/apps/horeca/kern.js'), c);
  c.window.RTGHoreca.meld('Geen lijn. Uw handeling staat op dit toestel.');
  assert.equal(doel.textContent, 'Geen lijn. Uw handeling staat op dit toestel.');
  assert.equal(klassen.has('zie'), true); assert.equal(timers.size, 1);
  c.window.RTGHoreca.meld('<Geen HTML>');
  assert.equal(doel.textContent, '<Geen HTML>'); assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(klassen.has('zie'), false); assert.equal(klassen.has('ds-melding'), true);
  assert.equal(doel.textContent, '<Geen HTML>', 'de bestaande eigenaar wijzigt uitsluitend de zichtbare status');
});
