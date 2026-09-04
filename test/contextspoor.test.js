/* HET CONTEXTSPOOR STAAT UIT, EN ZWIJGT ALS HET AAN STAAT.

   Deze meting hangt in een HEET PAD: de domeingrens-Proxy waar elke toegang tot
   het contextobject langskomt, dus tienduizenden keren per opstart en opnieuw
   bij elk verzoek dat laat bindt. Zo'n plek verdient twee garanties, en geen van
   beide mag op oplettendheid rusten:

     1 zonder de vlag doet hij NIETS -- geen bestand, geen geheugen, geen
       gedrag dat van een meting afhangt;
     2 met de vlag aan verandert hij het ANTWOORD van de grens niet. Een meter
       die meet wat hij zelf veroorzaakt, meet niets.

   De tweede is de scherpste. Een grens die iets doorlaat omdat er toevallig een
   meting aanstaat, is geen grens meer -- en dat zou hier makkelijk kunnen
   gebeuren, want de haak zit precies vóór de regel die weigert. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const PAD = path.join(__dirname, '..', 'server', 'opzet');

function versLaden(env) {
  const oud = { ...process.env };
  Object.assign(process.env, env);
  for (const naam of ['contextspoor', 'domeingrens']) delete require.cache[require.resolve(path.join(PAD, naam))];
  const spoor = require(path.join(PAD, 'contextspoor'));
  const grens = require(path.join(PAD, 'domeingrens'));
  process.env = oud;
  return { spoor, grens };
}

test('1. zonder de vlag staat het spoor uit en noteert het niets', () => {
  const { spoor } = versLaden({ RTG_CONTEXTPROEF: '' });
  assert.strictEqual(spoor.AAN, false, 'het contextspoor hoort standaard uit te staan');
  spoor.noteer('proef', 'watDanOok');
  const u = spoor.uitslag();
  assert.strictEqual(u.verzoeken, 0, 'met de vlag uit hoort noteer() niets te bewaren');
});

test('2. met de vlag aan noteert hij wel', () => {
  const { spoor } = versLaden({ RTG_CONTEXTPROEF: '1' });
  assert.strictEqual(spoor.AAN, true);
  spoor.noteer('proef', 'watDanOok');
  const u = spoor.uitslag();
  assert.ok(u.verzoeken >= 1, 'met de vlag aan hoort noteer() wel te bewaren');
  assert.ok(u.perVerzoek.some(v => v.namen.some(n => n.naam === 'proef.watDanOok')));
});

test('3. de grens weigert precies hetzelfde, met of zonder de meting', () => {
  /* Een naam die in de kern ZIT maar niet is opgeschreven, hoort te gooien --
     in beide standen. Zou de meting hem doorlaten, dan koopt een meetronde
     stilletjes een grensovertreding af. */
  for (const stand of ['', '1']) {
    const { grens } = versLaden({ RTG_CONTEXTPROEF: stand, RTG_GRENS_MELD: '' });
    const kern = { app: 'ja', vanEenAnder: 'nee' };
    const doorkijk = grens.maakDoorkijk(kern, 'proef', []);
    assert.strictEqual(doorkijk.app, 'ja', 'de interface hoort door te laten (vlag=' + (stand || 'uit') + ')');
    assert.throws(() => doorkijk.vanEenAnder, /domeingrens/,
      'een naam buiten de lijst hoort te gooien, ook met de meting aan (vlag=' + (stand || 'uit') + ')');
    assert.strictEqual(doorkijk.bestaatNiet, undefined, 'wat niet in de kern zit blijft undefined');
  }
});
