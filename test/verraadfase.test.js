/* DE OPSTARTPOORT VAN DE VERRAADSMOTOR.

   server/lib/verraadfase.js houdt de sabotage tegen zolang de server nog niet
   luistert. Zonder die poort komt een server met `schrijf-faalt` niet eens op
   (de opstart schrijft ook), en dan meet een sabotageronde niets.

   Wat hier bewezen moet worden is niet dat de poort dichtzit, maar dat hij OPEN
   gaat: een poort die per ongeluk nooit opengaat, laat elke ronde groen melden
   over een sabotage die nooit heeft toegeslagen. Dat ziet eruit als bewijs.

   Elke bewering draait in een EIGEN proces: de motor leest RTG_VERRAAD een keer
   bij het laden, en de fase is procesbrede toestand.

   Draai los: node --test test/verraadfase.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* IN DIT PROCES OOK, en niet alleen in kindprocessen. Twee redenen. Een: de
   mutatiemotor leest de requires van een toetsbestand om te weten welke module
   hij mag muteren, en een require in een string ziet hij niet -- zonder deze
   regel staat deze toets als "geen module gevonden" in MUTATIES.json en telt hij
   als ongemeten. Twee: de poort hoort ook zonder RTG_VERRAAD te werken, en dat
   is hier goedkoop te zeggen. */
const fase = require('../server/lib/verraadfase');
function inProces(env, code) {
  return execFileSync(process.execPath, ['-e', code],
    { cwd: WORTEL, env: { ...process.env, ...env }, encoding: 'utf8' }).trim();
}

test('de poort staat dicht tot iemand hem opent, ook zonder RTG_VERRAAD', () => {
  assert.equal(fase.stand().verkeerAan, false, 'een vers proces luistert nog niet');
  fase.zetVerkeerAan();
  assert.equal(fase.stand().verkeerAan, true);
  fase.zetVerkeerAan();
  assert.equal(fase.stand().verkeerAan, true, 'en een tweede keer verandert niets');
});

test('tijdens de opstart slaat het verraad niet toe, en dat wordt geteld', () => {
  const uit = inProces({ RTG_VERRAAD: 'schrijf-faalt' },
    "const f=require('./server/lib/verraadfase');" +
    "const voor=f.sla('schrijf-faalt');" +
    "console.log(JSON.stringify({ voor, stand: f.stand() }));");
  const r = JSON.parse(uit);
  assert.equal(r.voor, false, 'voor het luisteren slaat hij niet toe');
  assert.equal(r.stand.verkeerAan, false);
  assert.equal(r.stand.overgeslagen, 1, 'en de overslag is geteld, niet verzwegen');
});

test('zodra de server luistert gaat de poort OPEN -- dit is de bewering die telt', () => {
  const uit = inProces({ RTG_VERRAAD: 'schrijf-faalt' },
    "const f=require('./server/lib/verraadfase');" +
    "f.sla('schrijf-faalt');" +          // opstart: overgeslagen
    "f.zetVerkeerAan();" +
    "const na=f.sla('schrijf-faalt');" +
    "console.log(JSON.stringify({ na, stand: f.stand() }));");
  const r = JSON.parse(uit);
  assert.equal(r.na, true, 'na het luisteren slaat hij WEL toe');
  assert.equal(r.stand.verkeerAan, true);
  assert.equal(r.stand.overgeslagen, 1, 'en telt de opstartoverslag niet door');
});

test('zonder RTG_VERRAAD telt een gewone start niet als onderdrukte sabotage', () => {
  /* Anders zou elke normale opstart een getal opleveren dat suggereert dat er
     sabotage is tegengehouden. Dan is de teller ruis en leest niemand hem. */
  const uit = inProces({ RTG_VERRAAD: '' },
    "const f=require('./server/lib/verraadfase');" +
    "for (let i=0;i<5;i++) f.sla('schrijf-faalt');" +
    "console.log(JSON.stringify(f.stand()));");
  const r = JSON.parse(uit);
  assert.equal(r.overgeslagen, 0);
});

test('de kale motor blijft ongepoort -- die is wat test/verraad.test.js meet', () => {
  /* Het onderscheid met betekenis: verraad.sla is de motor, verraadfase.sla is
     de motor achter de poort. Zou de poort in de motor zitten, dan zou elke
     bestaande motortoets buiten een server op false vallen. */
  const uit = inProces({ RTG_VERRAAD: 'schrijf-faalt' },
    "const v=require('./server/lib/verraad');" +
    "console.log(JSON.stringify({ kaal: v.sla('schrijf-faalt') }));");
  assert.equal(JSON.parse(uit).kaal, true, 'zonder poort slaat de motor gewoon toe');
});
