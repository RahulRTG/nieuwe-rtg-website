/* ECON-01 -- GELDRICHTING IS NIET HETZELFDE ALS ECONOMISCHE EIGENDOM.

   Een EIGEN toetsbestand en niet een paragraaf in test/reisherkomst.test.js, en
   dat is de hele reden dat de regel een naam heeft: hij is niet van reizen. De
   vondst kwam bij een reisterugboeking naar boven, maar dezelfde vraag komt terug
   bij een chargeback, een storno, een voucher, een correctieboeking en een
   afwikkeling met een leverancier. Een invariant die alleen in het toetsbestand
   van zijn eerste toepassing staat, wordt bij de tweede toepassing niet gevonden.

   DE DRAGENDE TOETS IS NUMMER 2 en niet nummer 1. Dat een spiegel de richting
   omdraait is met het oog te zien; dat de EIGENAAR blijft staan is de helft die
   fout gaat, en het verraderlijke is dat het TOTAAL er niet door verandert.
   Toets 2 is de enige die dat vangt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const om = require('../server/kern/waarde/omkering.js');
const eh = require('../server/kern/waarde/economischeherkomst.js');
const bb = require('../server/kern/waarde/bijdragebasis.js');

/* De heenrij uit het gemeten voorbeeld: het lid betaalt, RTG int, het hotel is
   de eigenaar. Drie partijen op een rij -- precies waarop `herkomst: 'partner'`
   ooit sneuvelde. */
const HEEN = eh.geldrij({
  bedragCenten: 96000, valuta: 'EUR',
  economischeHerkomst: 'lid', economischeEigenaar: 'derde', naarWie: 'rtg',
  grond: 'Suite met havenzicht, 3 nachten', bronObject: 'payboeking:PB-1', relatie: 'haven-suites'
});

test('1. de richting draait om en de eigenaar blijft staan -- op ALLE zes gronden', () => {
  for (const grond of Object.keys(om.GRONDEN)) {
    const r = om.keerOm(HEEN, { grond, reden: 'beproeving van ' + grond });
    assert.equal(r.ok, true, grond + ': ' + (r.waarom || ''));
    assert.equal(r.rij.bedragCenten, -96000, grond + ': het bedrag spiegelt niet');
    assert.equal(r.rij.economischeHerkomst, 'rtg', grond + ': de bron is niet de vorige ontvanger');
    assert.equal(r.rij.naarWie, 'lid', grond + ': de ontvanger is niet de vorige bron');
    assert.equal(r.rij.economischeEigenaar, 'derde',
      grond + ': DE EIGENAAR IS VERANDERD. ' + om.REGELTEKST + '. De economische oorzaak wordt ' +
      'niet achteraf herschreven omdat het geld terugloopt.');
    assert.deepEqual(om.schendingen(HEEN, r.rij), [], grond + ': de handhaver meldt iets');
  }
});

test('2. DRAGEND: de handhaver vangt de verleidelijke fout, en het TOTAAL vangt hem niet', () => {
  /* De foute redenering: "het geld gaat naar het lid, dus de eigenaar is het
     lid." Die klopt over de kasstroom en is onwaar over de eigendom. */
  const fout = eh.geldrij({
    bedragCenten: -96000, valuta: 'EUR',
    economischeHerkomst: 'rtg', economischeEigenaar: 'lid', naarWie: 'lid',
    grond: 'terugbetaling', bronObject: 'payboeking:PB-1'
  });
  const gemeld = om.schendingen(HEEN, fout);
  assert.ok(gemeld.length >= 1, 'de handhaver liet een veranderde eigenaar door');
  assert.ok(gemeld.some(x => /eigenaar veranderde/.test(x)),
    'de melding noemt de eigenaar niet: ' + JSON.stringify(gemeld));

  /* EN NU DE REDEN DAT DEZE REGEL BESTAAT: het totaal merkt er niets van. */
  const goed = om.keerOm(HEEN, { grond: 'terugbetaling', reden: 'kamer niet geleverd' }).rij;
  const metGoed = bb.bereken([HEEN, goed]);
  const metFout = bb.bereken([HEEN, fout]);
  assert.equal(metGoed.bruto, 0);
  assert.equal(metFout.bruto, 0, 'het bruto verschilt wel; dan zou een gewone controle hem al vangen');
  assert.equal(metGoed.doorbelasting, 0, 'met de juiste spiegel hoort de doorbelasting op nul te staan');
  assert.equal(metFout.doorbelasting, 96000,
    'met de foute spiegel blijft de doorbelasting staan terwijl het bruto nul is. Dat is precies ' +
    'waarom dit een REGEL is en geen detail: elke controle op het totaal slaagt, en drie losse ' +
    'posten zijn onwaar.');
  assert.notEqual(metGoed.doorbelasting, metFout.doorbelasting,
    'de twee lezingen geven hetzelfde antwoord; dan toetst dit niets');
});

test('3. een richting die niet omdraait wordt gemeld', () => {
  const zelfdeRichting = eh.geldrij({
    bedragCenten: -96000, valuta: 'EUR',
    economischeHerkomst: 'lid', economischeEigenaar: 'derde', naarWie: 'rtg',
    grond: 'terugbetaling'
  });
  const gemeld = om.schendingen(HEEN, zelfdeRichting);
  assert.ok(gemeld.some(x => /richting draaide niet om/.test(x)),
    'een spiegel die dezelfde kant op wijst kwam erdoor: ' + JSON.stringify(gemeld));
});

test('4. een omkering zonder grond of zonder reden wordt geweigerd', () => {
  for (const g of [undefined, '', 'zomaar', 'refund']) {
    const r = om.keerOm(HEEN, { grond: g, reden: 'een geldige reden' });
    assert.equal(r.ok, false,
      'grond ' + JSON.stringify(g) + ' werd toegestaan. De grondenlijst is gesloten omdat "een ' +
      'omkering" een economisch oordeel is: wie een zevende geval tegenkomt, hoort te beslissen ' +
      'of het een omkering is of een NIEUWE gebeurtenis met een eigen grond.');
  }
  for (const reden of [undefined, '', '  ', 'ok']) {
    const r = om.keerOm(HEEN, { grond: 'terugbetaling', reden });
    assert.equal(r.ok, false, 'reden ' + JSON.stringify(reden) + ' werd toegestaan');
  }
});

test('5. een rij met een ONBEKENDE eigenaar omkeren verdubbelt de onwetendheid', () => {
  const vaag = eh.geldrij({ bedragCenten: 5000, valuta: 'EUR', economischeHerkomst: 'lid', naarWie: 'rtg' });
  assert.equal(vaag.economischeEigenaar, eh.ONBEKEND);
  const r = om.keerOm(vaag, { grond: 'correctie', reden: 'stond verkeerd' });
  assert.equal(r.ok, true, 'de spiegel zelf mag gemaakt worden');
  const gemeld = om.schendingen(vaag, r.rij);
  assert.ok(gemeld.some(x => /geen vastgestelde eigenaar/.test(x)),
    'een omkering van iets onbekends werd stil goedgekeurd. Dan staat er straks twee keer ' +
    'onwetendheid in de boeken in plaats van nul: ' + JSON.stringify(gemeld));
});

test('6. de reisterugboeking GEBRUIKT de regel en schrijft hem niet over', () => {
  /* Een regel die op twee plekken staat, drijft op de tweede plek af. Deze toets
     leest de CODE van de reislaag (zonder commentaar) en eist dat hij de
     omkering niet met de hand nabouwt. */
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const pad = require.resolve('../server/kern/reisbureau-terugboeking.js');
  const code = zonderCommentaar(fs.readFileSync(pad, 'utf8'), { soort: 'js' });
  assert.match(code, /require\('\.\/waarde\/omkering'\)/,
    'de reislaag laadt kern/waarde/omkering.js niet; dan staat ECON-01 er waarschijnlijk nog een ' +
    'tweede keer met de hand in');
  assert.ok(!/economischeHerkomst:\s*'rtg'/.test(code),
    'de reislaag typt de omgedraaide richting met de hand. Dat is precies de tweede plek waar ' +
    'ECON-01 kan afdrijven zonder dat iemand het merkt.');
  assert.ok(!/naarWie:\s*'lid'/.test(code), 'idem voor de bestemming van de spiegel');
});
