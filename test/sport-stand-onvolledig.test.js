/* DE STAND VAN SPORT MET EEN ONVOLLEDIG ANTWOORD (public/apps/sport.html).

   api() maakt van een lijf dat geen JSON is een leeg object: een 502 met HTML,
   een verbroken verbinding, of -- in WebKit -- een verzoek dat afbreekt omdat
   de pagina al verder navigeert. laadBord() tekende die lege "stand" toch, en
   tekenStand() gooide "undefined is not an object (evaluating
   'd.tabel.slice')" (test/reisschermen.e2e.js in de WebKit-job, run
   38359884995). Een onvolledige stand hoort weg te vallen of een melding te
   geven, nooit een fout.

   Draai los: node --test test/sport-stand-onvolledig.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '../public/apps/sport.html'), 'utf8');
/* De drie stukken die over de stand gaan, letterlijk uit de pagina. */
const stuk = (begin, eind) => {
  const i = HTML.indexOf(begin);
  assert.ok(i >= 0, begin + ' staat niet in sport.html');
  const j = HTML.indexOf(eind, i + begin.length);
  assert.ok(j > i, 'geen einde na ' + begin);
  return HTML.slice(i, j);
};

function scherm(antwoord) {
  const inhoud = { innerHTML: '' };
  const ctx = { CLUB: 'X', $: () => inhoud, esc: s => String(s),
    api: () => Promise.resolve(antwoord), console };
  vm.runInNewContext(stuk('const heeftTabel=', 'async function laadTickets') + ';this.laadStand=laadStand;this.tekenStand=tekenStand;this.heeftTabel=heeftTabel;', ctx);
  return { ctx, inhoud };
}

test('een leeg of onvolledig antwoord op /stand geeft een melding en geen TypeError', async () => {
  for (const antwoord of [{}, { competitie: 'x' }, { tabel: null }, { tabel: 'geen lijst' }]) {
    const s = scherm(antwoord);
    await s.ctx.laadStand();
    assert.match(s.inhoud.innerHTML, /onvolledig/, JSON.stringify(antwoord));
  }
});

test('een volledige stand wordt getekend zoals altijd', async () => {
  const s = scherm({ competitie: 'Eerste klasse', team: 'A', tabel: [{ team: 'A', g: 1, w: 1, gl: 0, v: 0, dv: 2, dt: 0, p: 3 }] });
  await s.ctx.laadStand();
  assert.match(s.inhoud.innerHTML, /Eerste klasse/);
  assert.match(s.inhoud.innerHTML, /class="eigen"/);
});

test('het bord neemt alleen een stand met een tabel over', () => {
  assert.match(stuk('async function laadBord', 'function tekenStand'),
    /stand=heeftTabel\(s\)\?s:null/, 'het bord tekent een lege stand niet');
  const s = scherm({});
  assert.equal(s.ctx.heeftTabel({}), false);
  assert.equal(s.ctx.heeftTabel(null), false);
  assert.equal(s.ctx.heeftTabel({ tabel: [] }), true);
});
