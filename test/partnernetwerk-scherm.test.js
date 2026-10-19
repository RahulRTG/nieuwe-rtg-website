/* PARTNER NETWORK: GEEN GETAL ZONDER BRON.

   Tot 19 oktober 2026 toonde /apps/partner-network.html vaste cijfers als live
   waarheid: "97 network fit", "96% mutual fit", partnerscores 98/94/91/100,
   "marge 18,4%", "€ 6.840", "84% vrij", "18% vaker", een tijdlijn van 12:31 tot
   12:41 en "0 escalaties". Besluit van de eigenaar: echt bouwen, en een getal
   staat er alleen als de server het uit echte gegevens rekent
   (kern/partnernetwerk.js). Deze toets zakt als een van die vaste waarden in
   het scherm terugkomt, en als een ontbrekende bron als nul wordt getoond.

   Draai los: node --test test/partnernetwerk-scherm.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(WORTEL, 'public/apps/partner-network.html'), 'utf8');
const js = fs.readFileSync(path.join(WORTEL, 'public/apps/partner-network.js'), 'utf8');
/* Wat een bezoeker leest: de tekst tussen de tags, zonder commentaar. */
const zichtbaar = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
/* En de tekst die het script zelf op het scherm zet: zijn string-letterlijken. */
const scriptTekst = (js.replace(/\/\*[\s\S]*?\*\//g, ' ').match(/'[^'\n]*'/g) || []).join(' ');

test('de oude vaste cijfers, scores en tijden staan niet meer op het scherm', () => {
  const verboden = ['network fit', 'mutual fit', 'MUTUAL FIT', '12:41', '12:38', '12:31', '18,4%', '6.840', '84%', '18%',
    'escalaties', 'Gezonde marge', 'Proof of Experience', 'KYOTO', 'Kyoto', 'Cryptografisch', 'Totale waarde', '2 september'];
  for (const v of verboden) {
    assert.ok(!zichtbaar.includes(v), 'het scherm toont weer "' + v + '"');
    assert.ok(!scriptTekst.includes(v), 'het script zet weer "' + v + '" op het scherm');
  }
  /* Losse getallen in de vaste tekst: elk getal hoort van de server te komen. */
  const getallen = (zichtbaar.match(/\b\d+(?:[.,]\d+)?%?/g) || []).filter((g) => !/^0?[1-3]$/.test(g) && g !== '01' && g !== '02' && g !== '03');
  assert.deepEqual(getallen, [], 'vaste getallen in de schermtekst: ' + getallen.join(', '));
});

test('elk getalvak wordt door de server gevuld, met bron, en "niet gemeten" is geen nul', () => {
  const vakken = [...html.matchAll(/data-getal="([a-zA-Z]+)"/g)].map((m) => m[1]);
  assert.ok(vakken.length >= 8, 'het scherm heeft zijn getalvakken');
  for (const v of vakken) assert.ok(html.includes('data-bron="' + v + '"'), v + ' toont geen bron');
  assert.match(js, /'\/api\/supplier\/netwerk\/overzicht'/, 'de getallen komen van de netwerkroute');
  assert.match(js, /'niet gemeten'/, 'een ontbrekende bron leest als "niet gemeten"');
  assert.ok(!/textContent\s*=\s*['"]0['"]/.test(js), 'nergens een nul als terugval');
});

test('de kern geeft een bron bij elk getal, en "niet gemeten" als een bron ontbreekt', () => {
  const maak = require('../server/kern/partnernetwerk');
  const opslag = { data: { tickets: { Z1: [{ id: 't1', text: 'Lamp kapot', status: 'open' }, { id: 't2', text: 'Klaar', status: 'klaar' }] } } };
  const k = maak({ db: opslag, mall: null, bureauZaak: null, samenwerking: null });
  const voor = JSON.stringify(opslag.data);
  const o = k.overzicht({ code: 'Z1', name: 'Zaak Een', rooms: [] });
  assert.equal(JSON.stringify(opslag.data), voor, 'het overzicht schrijft niets: de opslag is gelijk aan ervoor');
  for (const [naam, g] of Object.entries(o.getallen)) {
    assert.ok(g.waarde == null ? typeof g.nietGemeten === 'string' && g.nietGemeten.length > 8 : typeof g.bron === 'string',
      naam + ' heeft een bron of een reden');
  }
  assert.equal(o.getallen.klussenOpen.waarde, 1, 'een gesloten klus telt niet');
  assert.equal(o.getallen.intentiesOpen.waarde, null, 'zonder Mall geen nul maar niet gemeten');
  assert.equal(o.getallen.kamersInVerkoop.waarde, null, 'zonder kamers geen nul maar niet gemeten');
  assert.ok(o.nietGebouwd.some((x) => /Composer/.test(x.wat)), 'wat niet bestaat staat er met reden');
});
