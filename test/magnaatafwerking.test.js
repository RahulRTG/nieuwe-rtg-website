/* Magnaat V4 GAME-AFWERKING (zonder multiplayer): een eerste uur zonder
   uitleg, drie moeilijkheden, mijlpalen en een slot, en wat er gebeurde
   terwijl je weg was. De gids en het verhaal worden AFGELEID uit wat je deed;
   de moeilijkheid verschuift drie getallen en laat de keten zelf staan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');

function leven() {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  const v = {
    db, L, s: L.staat('lid'),
    st: () => db.data.magnaatLeven.lid,
    doe(b) { const r = L.actie('lid', b); if (!r.error) v.s = r; return r; },
    ok(b) { const r = v.doe(b); assert.ok(!r.error, b.actie + ': ' + r.error); return r; },
    slaap(n = 1) { for (let i = 0; i < n; i++) v.doe({ actie: 'slaap' }); return v.s; },
    wacht(dagen) { t += v.st().dagMs * dagen; v.s = L.staat('lid'); return v.s; },
    deal: (fase) => v.s.netwerk.contacten.find(d => d.fase === fase)
  };
  return v;
}
const vrijNu = (v) => v.s.vrijVandaag - (v.s.vrijVandaag % 30);

/* De eerste klant, van project tot factuur -- zoals in magnaatleven.test.js. */
function totDeFactuur(v) {
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  v.ok({ actie: 'gesprek', deal: v.deal('kans').id });
  const id = v.deal('onderhandeling').id;
  v.ok({ actie: 'voorstel', deal: id, bedrag: 800, voorschot: 25 });
  for (let i = 0; i < 30 && v.deal('overeenkomst'); i++) {
    const d = v.deal('overeenkomst');
    if (d.gedaan >= d.afspraak.minuten) { v.ok({ actie: 'lever', deal: id }); break; }
    if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'opdracht', deal: id, dag: v.s.dag, minuten: vrijNu(v) });
    v.slaap();
  }
  v.ok({ actie: 'factuur', deal: id });
  return v.st().deals.find(d => d.id === id);
}

test('de gids volgt wat je doet, stap voor stap, en verdwijnt als je eerste klant betaald heeft', () => {
  const v = leven();
  assert.equal(v.s.gids.nu, 'kies');
  assert.equal(v.s.gids.gedaan, 0);
  v.ok({ actie: 'kies', aanbod: 'websites' });
  assert.equal(v.s.gids.nu, 'plan');
  v.ok({ actie: 'plan', wat: 'project', dag: 1, minuten: 240 });
  assert.equal(v.s.gids.nu, 'dag');
  v.slaap();
  assert.equal(v.s.gids.nu, 'kans');
  const d = totDeFactuur(v);
  assert.equal(v.s.gids.nu, 'betaald');
  for (let i = 0; i < 40 && d.fase !== 'betaald'; i++) {
    if (v.s.dag > d.factuur.vervaldag && !d.factuur.herinnerd) v.doe({ actie: 'herinnering', deal: d.id });
    v.slaap();
  }
  assert.equal(v.s.gids, null, 'na de eerste betaling heb je geen gids meer nodig');
});

test('moeilijkheid: kiezen op dag 1, en daarna alleen door opnieuw te beginnen', () => {
  const v = leven();
  const edge = v.s.vandaag.volgende.map(a => a.actie);
  assert.equal(edge[0], 'kies', 'de hoofdactie blijft: kies wat je maakt');
  assert.ok(edge.includes('moeilijkheid'));
  assert.match(v.doe({ actie: 'moeilijkheid', stand: 'extreem' }).error, /licht, normaal of zwaar/);
  v.ok({ actie: 'moeilijkheid', stand: 'zwaar' });
  assert.equal(v.s.geld.bank, R.MOEILIJKHEID.zwaar.startKas);
  assert.equal(v.st().posten.find(p => p.soort === 'huur').bedrag, Math.round(65000 * 1.1));
  assert.equal(v.s.wereld.moeilijkheid, 'zwaar');
  v.ok({ actie: 'kies', aanbod: 'foto' });
  assert.ok(!v.s.vandaag.volgende.some(a => a.actie === 'moeilijkheid'));
  assert.match(v.doe({ actie: 'moeilijkheid', stand: 'licht' }).error, /begin dan opnieuw/);
  assert.match(v.doe({ actie: 'opnieuw', zeker: true, moeilijkheid: 'x' }).error, /licht, normaal of zwaar/);
  v.ok({ actie: 'opnieuw', zeker: true, moeilijkheid: 'licht' });
  assert.equal(v.s.geld.bank, R.MOEILIJKHEID.licht.startKas);
  assert.equal(v.st().posten.find(p => p.soort === 'huur').bedrag, Math.round(65000 * 0.85));
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('op licht betaalt de eerste klant eerder, op zwaar later', () => {
  const laat = (stand) => {
    const v = leven();
    if (stand !== 'normaal') v.ok({ actie: 'moeilijkheid', stand });
    v.ok({ actie: 'kies', aanbod: 'websites' });
    const d = totDeFactuur(v);
    return d.factuur.betaalDag - d.factuur.vervaldag - (d.laatGeleverd ? 7 : 0);
  };
  assert.deepEqual([laat('licht'), laat('normaal'), laat('zwaar')], [5, 10, 15]);
});

test('mijlpalen: je eerste klant en je eerste geld, een keer, met de dag', () => {
  const v = leven();
  v.ok({ actie: 'kies', aanbod: 'websites' });
  const d = totDeFactuur(v);
  assert.deepEqual(v.s.verhaal.mijlpalen.map(m => m.id), ['klant']);
  for (let i = 0; i < 40 && d.fase !== 'betaald'; i++) {
    if (v.s.dag > d.factuur.vervaldag && !d.factuur.herinnerd) v.doe({ actie: 'herinnering', deal: d.id });
    v.slaap();
  }
  assert.deepEqual(v.s.verhaal.mijlpalen.map(m => m.id), ['klant', 'geld']);
  assert.match(v.s.verhaal.mijlpalen[1].tekst, /Café De Brug betaalde factuur P001/);
  assert.equal(v.s.verhaal.slot, null, 'het slot komt pas als je van je bedrijf leeft');
  v.st().zelfstandig = v.s.dag;
  assert.match(v.L.staat('lid').verhaal.slot.tekst, /begon op een maandag met € 64,32/);
});

test('terwijl je weg was: na twee dagen of meer zie je wat er gebeurde, en na je eerste handeling niet meer', () => {
  const v = leven();
  v.ok({ actie: 'kies', aanbod: 'websites' });
  assert.equal(v.s.terwijlWeg, null);
  v.wacht(1);
  assert.equal(v.s.terwijlWeg, null, 'een dag is geen afwezigheid');
  v.wacht(4);
  assert.equal(v.s.terwijlWeg.dagen, 4);
  assert.ok(v.s.terwijlWeg.meldingen.some(m => /loon is binnen/.test(m.tekst)));
  v.ok({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: 30 });
  assert.equal(v.s.terwijlWeg, null);
});

test('een mijlpaal wordt een keer vastgelegd, ook als het moment terugkomt', () => {
  const { mijlpaal } = require('../server/kern/magnaat-leven/gids');
  const st = { dag: 4 };
  assert.equal(mijlpaal(st, 'geld', 'eerste'), true);
  st.dag = 20;
  assert.equal(mijlpaal(st, 'geld', 'tweede'), false);
  assert.deepEqual(st.mijlpalen, [{ id: 'geld', dag: 4, tekst: 'eerste' }]);
});
