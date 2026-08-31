/* ============================================================================
   DOELBINDING -- waarvoor mag dit gegeven gebruikt worden?

   DE TOETS DIE DE TWEE REGISTERS AAN ELKAAR HOUDT staat in 1. ./doelen.js
   noemt per doel welke GEGEVENS het mag raken, en die namen komen uit
   ./gegevenssoorten.js. Twee lijsten die naar elkaar wijzen zonder handhaver
   zijn binnen een jaar twee lijsten die dat niet meer doen -- en dan weigert de
   poort een gegeven dat gewoon hernoemd is, of laat hij er een door die niet
   meer bestaat. Zelfde reden als de `bron`-toets op de gegevenskaart.

   EN DE TOETS DIE ERTOE DOET VOOR EEN MENS staat in 2: alleen een doel met
   grond `toestemming` is te weigeren. Een kaart die zegt "u kunt elk doel
   weigeren" liegt -- uw adres gebruiken om uw bestelling te bezorgen is de
   uitvoering van wat u zelf vroeg. De grond is dus geen etiket maar het
   scharnier, en hij moet uit de code komen en niet uit een zin.

   Draai los: node --test test/doelbinding.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DOELEN, GRONDEN, doelenVoor } = require('../server/kern/identiteit/doelen');
const { SOORTEN } = require('../server/kern/identiteit/gegevenssoorten');
const { maakDoelpoort } = require('../server/kern/identiteit/doelpoort');

const SOORT_IDS = new Set(SOORTEN.map(s => s.id));

const poort = (aan = []) => maakDoelpoort({
  commercieel: { standVan: () => ({ soorten: ['aanbiedingen', 'onderzoek', 'partners']
    .map(id => ({ id, aan: aan.includes(id) })) }) }
});

/* ---------------------------------------------------------------------------
   1. DE HANDHAVER: de twee registers wijzen naar elkaar en dat blijft kloppen.
   ------------------------------------------------------------------------- */
test('1. elk doel noemt gegevens die echt bestaan', () => {
  assert.ok(DOELEN.length >= 8, 'het register is niet leeg');
  for (const d of DOELEN) {
    assert.ok(GRONDEN[d.grond], d.id + ' heeft een onbekende grond: ' + d.grond);
    assert.ok(d.gegevens.length, d.id + ' raakt geen enkel gegeven; dan is het geen doel');
    for (const g of d.gegevens) {
      assert.ok(SOORT_IDS.has(g),
        d.id + ' noemt gegeven "' + g + '", en dat staat niet in gegevenssoorten.js');
    }
  }
});

test('1b. en elk gegeven heeft minstens een doel -- of het valt op', () => {
  /* Een gegeven zonder doel is niet per se fout, maar het is wel een gegeven
     waarvan niemand kan zeggen waarvoor RTG het heeft. Dat hoort op te vallen
     in plaats van stil te blijven staan. */
  const zonder = SOORTEN.filter(s => doelenVoor(s.id).length === 0).map(s => s.id);
  assert.deepEqual(zonder, [],
    'deze gegevens hebben geen enkel doel: ' + zonder.join(', ') + ' -- geef ze er een, of haal ze weg');
});

test('1c. een doel met toestemming wijst naar een echte postsoort', () => {
  const { SOORTEN: POST } = require('../server/kern/identiteit/commercieel');
  const ids = new Set(POST.map(p => p.id));
  for (const d of DOELEN.filter(x => GRONDEN[x.grond].weigerbaar)) {
    assert.ok(d.viaPost, d.id + ' is weigerbaar maar zegt niet waar die toestemming woont');
    assert.ok(ids.has(d.viaPost),
      d.id + ' wijst naar postsoort "' + d.viaPost + '", en die bestaat niet');
  }
});

/* ---------------------------------------------------------------------------
   2. DE GROND IS HET SCHARNIER.
   ------------------------------------------------------------------------- */
test('2. alleen toestemming is te weigeren, en die staat standaard uit', () => {
  const p = poort();
  for (const d of DOELEN) {
    const uit = p.beoordeel('lid-1', d.id, d.gegevens[0]);
    if (GRONDEN[d.grond].weigerbaar) {
      assert.equal(uit.uitkomst, 'geweigerd',
        d.id + ' staat aan zonder dat iemand ja zei; dat is een opt-out waar een opt-in hoort');
    } else {
      assert.equal(uit.uitkomst, 'toegestaan',
        d.id + ' wordt geweigerd terwijl het de uitvoering is van wat het lid zelf vroeg');
    }
  }
});

test('2b. en na toestemming gaat precies dat ene doel open', () => {
  const p = poort(['aanbiedingen']);
  assert.equal(p.beoordeel('lid-1', 'aanbiedingen', 'email').uitkomst, 'toegestaan');
  assert.equal(p.beoordeel('lid-1', 'meedenken', 'email').uitkomst, 'geweigerd',
    'ja tegen aanbiedingen is geen ja tegen enquetes');
  assert.equal(p.beoordeel('lid-1', 'partnerpost', 'email').uitkomst, 'geweigerd');
});

/* ---------------------------------------------------------------------------
   3. DE KERN VAN DOELBINDING: het gegeven bestaat, het doel bestaat, en toch
   mag het niet -- want dit doel is niet waarvoor dit gegeven er is.
   ------------------------------------------------------------------------- */
test('3. een gegeven dat niet bij het doel hoort, wordt geweigerd', () => {
  const p = poort();
  const uit = p.beoordeel('lid-1', 'inloggen', 'adres');
  assert.equal(uit.uitkomst, 'geweigerd', 'uw adres heeft niets met inloggen te maken');
  assert.match(uit.reden, /hoort niet bij dit doel/);
  assert.equal(p.beoordeel('lid-1', 'leveren', 'adres').uitkomst, 'toegestaan',
    'terwijl hetzelfde gegeven voor bezorgen juist wel mag');
});

test('3b. onbekend is geen synoniem van geweigerd', () => {
  /* CONTROLPLANE.md is hier expliciet: een storing hoort niet te klinken als
     een overtreding, en een fout van de aanroeper hoort niet te klinken als een
     beslissing over het lid. */
  const p = poort();
  assert.equal(p.beoordeel('lid-1', 'bestaat-niet', 'email').uitkomst, 'onbekend');
  const stuk = maakDoelpoort({ commercieel: { standVan: () => { throw new Error('stuk'); } } });
  assert.equal(stuk.beoordeel('lid-1', 'aanbiedingen', 'email').uitkomst, 'storing');
  const geen = maakDoelpoort({});
  assert.equal(geen.beoordeel('lid-1', 'aanbiedingen', 'email').uitkomst, 'storing');
});

/* ---------------------------------------------------------------------------
   4. DE SCHADUW WEIGERT NOOIT -- en telt wel.
   ------------------------------------------------------------------------- */
test('4. in de schaduw gaat alles door, en wordt het geteld', () => {
  const oud = process.env.RTG_DOELBINDING;
  delete process.env.RTG_DOELBINDING;
  try {
    const p = poort();
    const r = p.mag('lid-1', 'inloggen', 'adres');
    assert.equal(r.uitkomst, 'geweigerd', 'het oordeel is wel geveld');
    assert.equal(r.mag, true, 'maar er wordt niets tegengehouden');
    assert.equal(r.stand, 'schaduw');
    assert.equal(p.meter().tellers.geweigerd, 1, 'en het is geteld, anders valt er niets te beslissen');
  } finally { if (oud === undefined) delete process.env.RTG_DOELBINDING; else process.env.RTG_DOELBINDING = oud; }
});

test('4b. in de stand afdwingen houdt hij echt tegen', () => {
  const oud = process.env.RTG_DOELBINDING;
  process.env.RTG_DOELBINDING = 'afdwingen';
  try {
    const p = poort();
    assert.equal(p.mag('lid-1', 'inloggen', 'adres').mag, false, 'nu wordt het wel tegengehouden');
    assert.equal(p.mag('lid-1', 'leveren', 'adres').mag, true, 'en wat wel mag gaat gewoon door');
    /* EEN STORING WEIGERT NOOIT, ook niet hier. Weten we het niet, dan zetten
       we de app niet stil om een reden die niets met het lid te maken heeft. */
    const stuk = maakDoelpoort({ commercieel: { standVan: () => { throw new Error('stuk'); } } });
    assert.equal(stuk.mag('lid-1', 'aanbiedingen', 'email').mag, true,
      'een kapotte toestemmingslaag is geen overtreding van het lid');
  } finally { if (oud === undefined) delete process.env.RTG_DOELBINDING; else process.env.RTG_DOELBINDING = oud; }
});

test('4c. een typefout in de stand valt terug op schaduw en zegt dat', () => {
  const oud = process.env.RTG_DOELBINDING;
  process.env.RTG_DOELBINDING = 'afdwingn';
  try {
    const p = poort();
    const s = p.standVan();
    assert.equal(s.stand, 'schaduw');
    assert.match(s.reden, /onbekende waarde/);
    assert.equal(p.mag('lid-1', 'inloggen', 'adres').mag, true);
  } finally { if (oud === undefined) delete process.env.RTG_DOELBINDING; else process.env.RTG_DOELBINDING = oud; }
});

test('4d. de meter toont geen percentage zolang er niets langskwam', () => {
  const p = poort();
  assert.equal(p.meter().aandeelGeweigerd, null,
    'nul zou lezen als "alles gaat goed" terwijl er niets is gemeten');
  p.mag('lid-1', 'inloggen', 'email');
  assert.equal(p.meter().aandeelGeweigerd, 0, 'en daarna is nul wel een uitslag');
});

/* ---------------------------------------------------------------------------
   5. DE MATRIX STAAT VAST, en dat is geen dubbeling maar een besluit.

   Een mutatie die `identiteitsbewijs` toevoegde aan het doel
   `toestemmingsbewijs` OVERLEEFDE alle toetsen hierboven: het gegeven bestaat,
   het doel bestaat, en dus was er niets dat piepte. Precies zo verwatert
   dataminimalisatie -- niet met een besluit, maar met een regel erbij omdat het
   handig uitkwam.

   Machinaal is niet te bepalen welk doel welk gegeven NODIG heeft; dat is een
   afweging. Wat wel kan is hem VASTLEGGEN, zoals GRENZEN.json en WETTEN.json
   dat doen: verbreedt iemand een doel, dan zakt deze toets en moet hij hier
   opschrijven dat hij het wilde. Een regel erbij is dan een handeling en geen
   detail.

   Wie deze lijst aanpast: zeg in de commit WAAROM dat doel dat gegeven nodig
   heeft. Kan dat niet in een zin, dan heeft het het niet nodig.
   ------------------------------------------------------------------------- */
const MATRIX = {
  'inloggen': ['codenaam', 'email', 'naam', 'sessies', 'toestelbinding', 'tweefactor'],
  'herstel': ['email', 'telefoon', 'tweefactor'],
  'leveren': ['adres', 'codenaam', 'naam', 'telefoon'],
  'leeftijdspoort': ['geboortedatum', 'identiteitsbewijs'],
  'fraude': ['codenaam', 'sessies', 'toestelbinding'],
  'administratie': ['adres', 'facturen', 'naam'],
  'verantwoording': ['codenaam', 'inzagejournaal'],
  'toestemmingsbewijs': ['codenaam', 'post'],
  'aanbiedingen': ['email', 'naam', 'telefoon'],
  'meedenken': ['email', 'naam'],
  'partnerpost': ['email', 'telefoon']
};

test('5. geen enkel doel raakt meer gegevens dan hier is vastgelegd', () => {
  const nu = Object.fromEntries(DOELEN.map(d => [d.id, d.gegevens.slice().sort()]));
  for (const [doel, verwacht] of Object.entries(MATRIX)) {
    assert.ok(nu[doel], 'het doel ' + doel + ' is verdwenen; haal hem ook hier weg');
    const erbij = nu[doel].filter(g => !verwacht.includes(g));
    assert.deepEqual(erbij, [],
      'het doel ' + doel + ' raakt er gegevens bij: ' + erbij.join(', ') +
      ' -- dat is een besluit over dataminimalisatie, dus zet het hier neer met de reden in de commit');
    const eraf = verwacht.filter(g => !nu[doel].includes(g));
    assert.deepEqual(eraf, [],
      'het doel ' + doel + ' raakt deze gegevens niet meer: ' + eraf.join(', ') + ' -- werk deze lijst bij');
  }
  const nieuwe = Object.keys(nu).filter(d => !MATRIX[d]);
  assert.deepEqual(nieuwe, [],
    'nieuw doel zonder vastgelegde matrix: ' + nieuwe.join(', ') + ' -- zet erbij welke gegevens het raakt en waarom');
});
