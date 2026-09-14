/* WAT EEN ROUTE MET `velden` BELOOFT, EN WAT DE AFDRUK ERVAN MAAKT.
   -----------------------------------------------------------------
   Deze toets verandert niets aan het gedrag. Hij pint vast wat er vandaag
   gebeurt, omdat twee lijsten over dezelfde vraag gaan en elkaar niet kennen:

     POSITIEF, per route   lib/idemsleutels.js   { velden: ['a','b'] }
                           "deze velden identificeren dit verzoek"
     NEGATIEF, globaal     lib/idem-kast.js      BUITEN_AFDRUK, zes namen
                           "deze velden identificeren NOOIT iets"

   Ze besturen twee verschillende dingen. `velden` bouwt de AFGELEIDE SLEUTEL
   (idem-sleutelbepaling.js:111-115); BUITEN_AFDRUK bouwt de AFDRUK, en die
   bindt een sleutel aan een lijf (idem-poort.js:131 -- verschilt de afdruk bij
   dezelfde sleutel, dan 409).

   GEMETEN GEVOLG, en het is de reden dat deze toets bestaat: een lijfveld dat
   in GEEN van beide lijsten staat laat de sleutel gelijk en de afdruk
   verschillen. Een tweede aanroep met zo'n veld erbij krijgt dus geen
   deduplicatie maar een 409 "deze idem-sleutel is al gebruikt voor een ander
   verzoek". De verklaring zegt "vier velden bepalen dit verzoek", de afdruk
   zegt "alles behalve zes namen" -- en bij elk extra veld winnen ze van elkaar.

   DIT WORDT HIER MET OPZET NIET GEREPAREERD. De reparatie zou zijn dat de
   afdruk zich naar `velden` voegt, en dat maakt twee verzoeken die RTG vandaag
   als VERSCHILLEND ziet voortaan gelijk. Dat is precies de richting die het
   ontwerp van het semantische identiteitscontract GEVAARLIJK noemt (oud
   verschillend + nieuw gelijk: een geldige tweede opdracht kan verdwijnen), en
   het is dezelfde soort wijziging die hier eerder de pizza-fout opleverde. Het
   hoort een BESLUIT per capability te zijn, niet een stille bijstelling.

   Wat deze toets dus doet: hij zakt zodra iemand een van de twee lijsten
   verandert zonder de ander, of de voorrangsregel van de eigen sleutel
   aanraakt. Dan is de val zichtbaar in plaats van stil. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { verklaardeSleutel } = require('../server/lib/idem-sleutelbepaling');
const { afdrukVan, BUITEN_AFDRUK } = require('../server/lib/idem-kast');
const { SLEUTELS } = require('../server/lib/idemsleutels');

/* Een route die `velden` verklaart en die alle vier zijn velden ook echt uit
   het lijf leest (server/kern/woningonderhoud.js, meld()). */
const PAD = '/api/home/onderhoud/meld';
const verzoek = body => ({ method: 'POST', path: PAD, body });
const BASIS = { titel: 'Kraan lekt', plek: 'keuken', urgentie: 'hoog', notitie: 'druppelt sinds maandag' };
const met = extra => Object.assign({}, BASIS, extra);

test('de verklaring van deze route noemt vier velden, en notitie is er een van', () => {
  const v = SLEUTELS['POST ' + PAD];
  assert.ok(v && Array.isArray(v.velden), 'deze route hoort een { velden: [...] }-verklaring te dragen');
  assert.deepStrictEqual(v.velden.slice().sort(), ['notitie', 'plek', 'titel', 'urgentie']);
});

test('notitie staat OOK in de globale uitsluitlijst -- dat is de overlap', () => {
  assert.ok(BUITEN_AFDRUK.has('notitie'),
    'zodra notitie uit BUITEN_AFDRUK verdwijnt verandert de betekenis van elke afdruk in dit huis');
});

test('een genoemd veld telt WEL mee voor de afgeleide sleutel', () => {
  const a = verklaardeSleutel(verzoek(BASIS));
  const b = verklaardeSleutel(verzoek(met({ notitie: 'druppelt sinds dinsdag' })));
  assert.ok(a && b, 'zonder eigen sleutel hoort de verklaring een sleutel te leveren');
  assert.notStrictEqual(a, b, 'twee meldingen die in hun notitie verschillen zijn twee verzoeken');
});

test('datzelfde veld telt NIET mee voor de afdruk', () => {
  assert.strictEqual(afdrukVan(BASIS), afdrukVan(met({ notitie: 'druppelt sinds dinsdag' })));
});

test('en juist daarom botsen ze niet: verschillende sleutel, dus de afdruk komt niet aan bod', () => {
  const a = verklaardeSleutel(verzoek(BASIS));
  const b = verklaardeSleutel(verzoek(met({ notitie: 'anders' })));
  assert.notStrictEqual(a, b);
  /* De afdruk doet alleen iets bij een GELIJKE sleutel (idem-poort.js:130-133).
     Bij een afgeleide sleutel volgt uit "zelfde sleutel" dat alle genoemde
     velden gelijk zijn, dus ook de notitie, dus ook de afdruk. */
});

test('DE VAL: een veld buiten BEIDE lijsten maakt van een dubbeltik een 409', () => {
  for (const veld of ['bron', 'client']) {
    const tweede = met({ [veld]: 'app' });
    assert.strictEqual(verklaardeSleutel(verzoek(BASIS)), verklaardeSleutel(verzoek(tweede)),
      veld + ' staat niet in velden, dus de sleutel hoort gelijk te blijven');
    assert.notStrictEqual(afdrukVan(BASIS), afdrukVan(tweede),
      veld + ' staat niet in BUITEN_AFDRUK, dus de afdruk hoort te verschillen');
    /* gelijke sleutel + andere afdruk === 409 in idem-poort.js:131 */
  }
});

test('een veld dat WEL in de uitsluitlijst staat maar niet in velden: gewoon dedup', () => {
  for (const veld of ['omschrijving', 'toelichting']) {
    const tweede = met({ [veld]: 'x' });
    assert.strictEqual(verklaardeSleutel(verzoek(BASIS)), verklaardeSleutel(verzoek(tweede)));
    assert.strictEqual(afdrukVan(BASIS), afdrukVan(tweede));
  }
});

test('een eigen sleutel van de aanroeper zet de verklaring volledig opzij', () => {
  for (const naam of ['idempotentieSleutel', 'idem']) {
    assert.strictEqual(verklaardeSleutel(verzoek(met({ [naam]: 'abc-123' }))), null,
      'wie zelf een sleutel meestuurt heeft al gesproken (idem-sleutelbepaling.js:107-109)');
  }
});

test('DE ALGEMENE VORM: dit geldt voor ELKE route die velden verklaart', () => {
  const metVelden = Object.entries(SLEUTELS).filter(([, v]) => Array.isArray(v.velden));
  assert.ok(metVelden.length > 0, 'er hoort ten minste een route met benoemde identiteitsvelden te zijn');

  /* Een naam die in geen van beide lijsten staat -- lang en onwaarschijnlijk,
     zodat hij nooit toevallig een echt veld van een route is. */
  const vreemd = 'ditVeldStaatInGeenEnkeleLijst';
  assert.ok(!BUITEN_AFDRUK.has(vreemd));

  for (const [route, v] of metVelden) {
    if (v.velden.includes(vreemd)) continue;
    const pad = route.replace(/^POST /, '');
    const lijf = {};
    for (const veld of v.velden) lijf[veld] = 'x';
    const tweede = Object.assign({}, lijf, { [vreemd]: 'y' });

    const s1 = verklaardeSleutel({ method: 'POST', path: pad, body: lijf });
    const s2 = verklaardeSleutel({ method: 'POST', path: pad, body: tweede });
    assert.strictEqual(s1, s2, route + ': een veld buiten `velden` hoort de sleutel niet te raken');
    assert.notStrictEqual(afdrukVan(lijf), afdrukVan(tweede),
      route + ': een veld buiten BUITEN_AFDRUK hoort de afdruk wel te raken');
  }
});
