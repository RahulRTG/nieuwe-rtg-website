/* DE HERZEGELING ALS ZUIVERE REKENING (server/lib/ankerherzegel.js).

   Naast test/ankerherzegel.test.js (die het geheel met een echte ankerdienst
   en ontvanger draait) houdt dit bestand elke weigertak van plan, dektPrecies
   en verklaar vast op een zelfgebouwde zegelketen: een plan zonder geraakte
   regels is leeg, een begrensd venster telt zijn volgnummers vanaf de teller,
   en elk record dat niet precies uitlegt wat er veranderde -- niet getekend,
   ander bereik, een gat, een extra wijziging ná de wissing -- verklaart
   niets. Twee wissingen na elkaar vormen een ketting van oud naar nieuw. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const hz = require('../server/lib/ankerherzegel');

const { zegelVan } = hz;
const kaal = r => { const { zegel, ...rest } = r; return rest; };

/* Een keten zoals het API-spoor hem draagt: elke regel wijst naar de zegel van
   zijn voorganger en zegelt zichzelf. */
function keten(actoren, beginVorig = null) {
  const uit = [];
  let vorig = beginVorig;
  actoren.forEach((actor, i) => {
    const r = { id: 'r' + i, actor, actie: 'POST /x' + i, vorig };
    r.zegel = zegelVan(r);
    uit.push(r); vorig = r.zegel;
  });
  return uit;
}
/* Wat wisActor doet: de actor naar "gewist" en de keten opnieuw. */
function wis(lijst, actor) {
  const uit = [];
  let vorig = lijst.length ? lijst[0].vorig : null;
  for (const r of lijst) {
    const k = { ...kaal(r), vorig };
    if (k.actor === actor) k.actor = 'gewist';
    k.zegel = zegelVan(k);
    uit.push(k); vorig = k.zegel;
  }
  return uit;
}
/* Herreken de zegels vanaf index i (na een vervalsing). */
function herzegelVanaf(lijst, i) {
  for (let j = i; j < lijst.length; j++) {
    lijst[j] = { ...kaal(lijst[j]), vorig: j ? lijst[j - 1].zegel : lijst[j].vorig };
    lijst[j].zegel = zegelVan(kaal(lijst[j]));
  }
  return lijst;
}
const ACT = ['blijf', 'wis', 'blijf', 'blijf', 'wis', 'blijf'];

test('plan: niets te wissen geeft een leeg plan zonder kop', () => {
  const l = keten(ACT);
  for (const [lijst, actor] of [[null, 'wis'], ['geen lijst', 'wis'], [l, ''], [l, null], [l, 'niemand'], [[], 'wis']])
    assert.deepEqual(hz.plan(lijst, 6, actor), { regels: [], kopVoor: null }, String(actor));
});

test('plan: het bereik begint bij de eerste gewiste regel en loopt tot de kop', () => {
  const l = keten(ACT);
  const p = hz.plan(l, 6, 'wis');
  assert.deepEqual(p.regels.map(g => g.nr), [2, 3, 4, 5, 6]);
  assert.deepEqual(p.regels.map(g => g.gewist), [true, false, false, true, false]);
  assert.deepEqual(p.kopVoor, { nr: 6, hash: l[5].zegel });
  const na = wis(l, 'wis');
  p.regels.forEach(g => { assert.equal(g.oud, l[g.nr - 1].zegel); assert.equal(g.nieuw, na[g.nr - 1].zegel); });
});

test('plan: een begrensd venster telt de volgnummers vanaf de teller', () => {
  const l = keten(['blijf', 'wis', 'blijf'], 'zegel-van-regel-97');
  const p = hz.plan(l, 100, 'wis');
  assert.deepEqual(p.regels.map(g => g.nr), [99, 100]);
  assert.equal(p.kopVoor.nr, 100);
  assert.equal(p.regels[0].nieuw, wis(l, 'wis')[1].zegel, 'de eerste regel houdt zijn oude voorganger buiten het venster');
  assert.deepEqual(hz.plan(l, 'onzin', 'wis').regels.map(g => g.nr), [2, 3], 'een onleesbare teller valt terug op de lengte');
  assert.deepEqual(hz.plan(l, 1, 'wis').regels.map(g => g.nr), [2, 3], 'een teller kleiner dan het venster ook');
});

test('teTekenen: het tekendoel plus de kanonieke vorm zonder handtekening', () => {
  const rec = { journaal: 'apiSpoor', regels: [], handtekening: 'sig' };
  const b = hz.teTekenen(rec, x => JSON.stringify(x));
  assert.ok(Buffer.isBuffer(b));
  assert.equal(b.toString('utf8'), hz.TEKENDOEL + JSON.stringify({ journaal: 'apiSpoor', regels: [] }));
  assert.equal(hz.TEKENDOEL, 'rtg-herzegeling-v1\n');
});

/* Een wissing en zijn record, klaar voor dektPrecies en verklaar. */
function wereld() {
  const voor = keten(ACT);
  const p = hz.plan(voor, 6, 'wis');
  const na = wis(voor, 'wis');
  const rec = { journaal: 'apiSpoor', regels: p.regels, getekend: true };
  return { voor, na, rec, anker: { nr: 6, hash: voor[5].zegel } };
}
const geldig = r => r.getekend === true;

test('dektPrecies: een echte wissing wordt precies gedekt', () => {
  const w = wereld();
  assert.equal(hz.dektPrecies([w.rec], w.na, 6), null);
  assert.equal(hz.dektPrecies([w.rec], w.na.slice(3), 6), null, 'regels die uit het venster schoven tellen niet');
  assert.equal(hz.dektPrecies([w.rec], 'geen lijst', 6), null, 'zonder venster is er niets tegen te spreken');
});

test('dektPrecies: een record zonder regels, of dat niet bij een gewiste regel begint', () => {
  const w = wereld();
  assert.equal(hz.dektPrecies([{ regels: [] }], w.na, 6), 'een record noemt geen regels');
  assert.equal(hz.dektPrecies([{}], w.na, 6), 'een record noemt geen regels');
  assert.equal(hz.dektPrecies([{ regels: w.rec.regels.slice(1) }], w.na, 6), 'het bereik begint niet bij een gewiste regel');
});

test('dektPrecies: een bereik met een gat', () => {
  const w = wereld();
  const gat = [w.rec.regels[0], ...w.rec.regels.slice(2)];
  assert.equal(hz.dektPrecies([{ regels: gat }], w.na, 6), 'het bereik is niet aaneengesloten');
});

test('dektPrecies: een regel met een andere zegel dan vastgelegd, of die niet met zijn inhoud klopt', () => {
  const w = wereld();
  const anders = w.na.map(r => ({ ...r }));
  anders[2].zegel = 'f'.repeat(32);
  assert.equal(hz.dektPrecies([w.rec], anders, 6), 'regel 3 heeft niet de zegel die de herzegeling vastlegde');
  const inhoud = w.na.map(r => ({ ...r }));
  inhoud[2].actie = 'DELETE /alles';   // zegel blijft staan, inhoud niet
  assert.equal(hz.dektPrecies([w.rec], inhoud, 6), 'regel 3 klopt niet met zijn eigen zegel');
});

test('dektPrecies: een vervalste voorganger van het bereik valt op', () => {
  const w = wereld();
  const na = w.na.map(r => ({ ...r }));
  na[0] = { ...kaal(na[0]), actie: 'vervalst' }; na[0].zegel = zegelVan(na[0]);
  assert.equal(hz.dektPrecies([w.rec], na, 6), 'de regel vóór het bereik is na de wissing gewijzigd');
});

test('dektPrecies: een als gewist gemerkte regel die toch een actor draagt', () => {
  const w = wereld();
  /* Het record noemt regel 3 (blijf) als gewist, met de zegel die er nu staat. */
  const vals = { regels: [{ nr: 3, oud: w.voor[2].zegel, nieuw: w.na[2].zegel, gewist: true }] };
  assert.equal(hz.dektPrecies([vals], w.na, 6), 'regel 3 staat als gewist maar draagt een actor');
});

test('dektPrecies: een niet-gewiste regel die na de wissing nog inhoudelijk veranderde', () => {
  const w = wereld();
  const na = w.na.map(r => ({ ...r }));
  na[3].actie = 'POST /vervalst';
  herzegelVanaf(na, 3);
  const rec = { regels: w.rec.regels.map(g => ({ ...g, nieuw: na[g.nr - 1].zegel })) };
  assert.equal(hz.dektPrecies([rec], na, 6), 'regel 4 is méér veranderd dan zijn keten');
});

test('verklaar: een getekende herzegeling verklaart de herschrijving', () => {
  const w = wereld();
  const uit = hz.verklaar({ naam: 'apiSpoor', anker: w.anker, lijst: w.na, totaal: 6, records: [null, w.rec],
    geldig, huidigeHash: w.na[5].zegel });
  assert.deepEqual(uit, { verklaard: true, gebruikt: [w.rec] });
});

test('verklaar: geen herzegeling, of geen enkele getekend door deze installatie', () => {
  const w = wereld();
  const basis = { naam: 'apiSpoor', anker: w.anker, lijst: w.na, totaal: 6, geldig, huidigeHash: w.na[5].zegel };
  assert.deepEqual(hz.verklaar({ ...basis, records: undefined }),
    { verklaard: false, reden: 'er is geen herzegeling die deze herschrijving uitlegt' });
  assert.deepEqual(hz.verklaar({ ...basis, records: [{ ...w.rec, journaal: 'ander' }] }).reden,
    'er is geen herzegeling die deze herschrijving uitlegt', 'een record van een ander journaal telt niet');
  assert.deepEqual(hz.verklaar({ ...basis, records: [{ ...w.rec, getekend: 'ja' }] }),
    { verklaard: false, reden: 'er is een herzegeling, maar geen enkele is door deze installatie getekend' });
});

test('verklaar: het anker staat niet in een getekend record', () => {
  const w = wereld();
  const r = hz.verklaar({ naam: 'apiSpoor', anker: { nr: 1, hash: w.voor[0].zegel }, lijst: w.na, totaal: 6,
    records: [{ journaal: 'apiSpoor', getekend: true }, w.rec], geldig, huidigeHash: w.na[0].zegel });
  assert.deepEqual(r, { verklaard: false, reden: 'geen getekende herzegeling noemt de geankerde regel 1 met zijn oude zegel' });
  const vreemd = hz.verklaar({ naam: 'apiSpoor', anker: { nr: 6, hash: 'andere-hash' }, lijst: w.na, totaal: 6,
    records: [w.rec], geldig, huidigeHash: w.na[5].zegel });
  assert.equal(vreemd.verklaard, false, 'een anker met een andere oude zegel staat er niet in');
});

test('verklaar: de ketting komt niet uit bij de huidige zegel', () => {
  const w = wereld();
  const r = hz.verklaar({ naam: 'apiSpoor', anker: w.anker, lijst: w.na, totaal: 6, records: [w.rec], geldig,
    huidigeHash: 'e'.repeat(32) });
  assert.deepEqual(r, { verklaard: false, reden: 'de herzegelingen komen niet uit bij de zegel die er nu staat' });
});

test('verklaar: een getekend record dat de stand niet precies dekt, verklaart niets', () => {
  const w = wereld();
  const na = w.na.map(r => ({ ...r }));
  na[3].actie = 'POST /vervalst';
  herzegelVanaf(na, 3);
  const rec = { ...w.rec, regels: w.rec.regels.map(g => ({ ...g, nieuw: na[g.nr - 1].zegel })) };
  const r = hz.verklaar({ naam: 'apiSpoor', anker: w.anker, lijst: na, totaal: 6, records: [rec], geldig, huidigeHash: na[5].zegel });
  assert.equal(r.verklaard, false);
  assert.equal(r.reden, 'de herzegeling dekt de huidige stand niet precies: regel 4 is méér veranderd dan zijn keten');
});

test('verklaar: twee wissingen na elkaar vormen een ketting van oud naar nieuw', () => {
  const voor = keten(['blijf', 'a', 'blijf', 'b', 'blijf']);
  const p1 = hz.plan(voor, 5, 'a');
  const tussen = wis(voor, 'a');
  const p2 = hz.plan(tussen, 5, 'b');
  const na = wis(tussen, 'b');
  const r1 = { journaal: 'apiSpoor', regels: p1.regels, getekend: true };
  const r2 = { journaal: 'apiSpoor', regels: p2.regels, getekend: true };
  const uit = hz.verklaar({ naam: 'apiSpoor', anker: { nr: 5, hash: voor[4].zegel }, lijst: na, totaal: 5,
    records: [r1, r2], geldig, huidigeHash: na[4].zegel });
  assert.deepEqual(uit, { verklaard: true, gebruikt: [r1, r2] });
  /* Met alleen de tweede komt het anker er niet in voor. */
  assert.equal(hz.verklaar({ naam: 'apiSpoor', anker: { nr: 5, hash: voor[4].zegel }, lijst: na, totaal: 5,
    records: [r2], geldig, huidigeHash: na[4].zegel }).verklaard, false);
});
