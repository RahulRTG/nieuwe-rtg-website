/* DE DOORBELASTINGSMETER (scripts/doorbelasting.js, DOORBELASTING.json).

   De dragende toets is nummer 3 en niet de ratel: `onbekend` moet een UITKOMST
   zijn en nooit een aanname. Wie een bedrag zonder bewijs op `derdePartij` zet
   verlaagt de bijdragebasis en dus de vergoeding aan RTG; wie hem op `rtgEigen`
   zet verhoogt hem. Beide fouten zijn onzichtbaar en komen allebei iemand goed
   uit, en precies daarom hoort er een toets op te staan die zakt zodra de
   indeler begint te raden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { meet, deelIn, KLASSEN, DOEL } = require('../scripts/doorbelasting');
const eh = require('../server/kern/waarde/economischeherkomst.js');
const hs = require('../server/kern/waarde/herkomstsplitsing.js');
const { VERWACHT } = require('../scripts/lib/economiewereld.js');

/* GRONDWAARDEN, met de datum. Alleen met de hand te verschuiven. */
const GROND = {
  gezet: '2026-09-15',
  volgbaar: 26,      // geldvormen met een herkomst ernaast -- mag alleen OMHOOG
  nietVolgbaar: 182  // mag alleen OMLAAG
};

const vers = meet();

test('0. het ingecheckte register klopt met een verse meting', () => {
  assert.ok(fs.existsSync(DOEL), 'DOORBELASTING.json ontbreekt -- draai npm run doorbelasting:vast');
  const vast = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  assert.equal(vast.vorm.geldvormen, vers.vorm.geldvormen,
    'DOORBELASTING.json loopt achter op de code -- draai npm run doorbelasting:vast');
  assert.equal(vast.vorm.volgbaar, vers.vorm.volgbaar);
});

test('1. RATEL: het aantal volgbare geldvormen mag alleen omhoog', () => {
  assert.ok(vers.vorm.volgbaar >= GROND.volgbaar,
    'volgbaar zakte van ' + GROND.volgbaar + ' naar ' + vers.vorm.volgbaar +
    ' -- er is een rij die een bedrag EN een herkomst droeg, en die draagt er nu geen meer. ' +
    'Daarmee is een euro die te volgen was, niet meer te volgen.');
});

test('2. RATEL: het aantal niet-volgbare geldvormen mag alleen omlaag', () => {
  assert.ok(vers.vorm.nietVolgbaar <= GROND.nietVolgbaar,
    'nietVolgbaar steeg van ' + GROND.nietVolgbaar + ' naar ' + vers.vorm.nietVolgbaar +
    ' -- er is een geldvorm bijgekomen zonder herkomst. Dit getal hoort te dalen doordat er ' +
    'herkomst bij komt, niet te stijgen doordat er bedragen bij komen.');
});

test('3. onbekend is een UITKOMST en nooit een aanname', () => {
  /* Elk van deze zes MOET onbekend opleveren. Zodra de indeler er een naar
     rtgEigen of derdePartij duwt, verschuift de bijdragebasis op een manier die
     niemand ziet. */
  const moetOnbekend = [
    [{ totaal: 5000 }, 'bedrag zonder enig herkomstveld'],
    [{ centen: 5000, herkomst: '' }, 'herkomstveld leeg'],
    [{ centen: 5000, herkomst: 'handmatig' }, 'handmatig zegt wie het INVOERDE, niet wie het LEVERDE'],
    [{ centen: 5000, herkomst: 'onbekend' }, 'letterlijk onbekend'],
    [{ centen: 5000, herkomst: 'import' }, 'een herkomst die deze meter niet kent'],
    [{ centen: 'veel', herkomst: 'rtg' }, 'bedrag is geen getal']
  ];
  for (const [rij, waarom] of moetOnbekend) {
    const u = deelIn(rij);
    assert.equal(u.klasse, 'onbekend',
      'deze rij werd ingedeeld als "' + u.klasse + '" terwijl hij onbekend hoort te zijn (' + waarom +
      '). Reden die de indeler gaf: ' + u.reden);
  }
});

test('4. de indeler is PUUR: dezelfde invoer geeft altijd dezelfde klasse', () => {
  /* Dit is de voorwaarde onder stap 3 -- een bijdragebasis die per aanroep kan
     verschillen, is bij een geschil niets waard. */
  const rij = { centen: 12345, herkomst: 'partner' };
  const eerste = deelIn(rij);
  for (let i = 0; i < 25; i++) {
    const u = deelIn({ centen: 12345, herkomst: 'partner' });
    assert.deepEqual(u, eerste, 'de indeler gaf twee keer een ander antwoord op dezelfde rij');
  }
  assert.equal(eerste.klasse, 'derdePartij');
});

test('5. elke indeling draagt een reden', () => {
  const rijen = [{ totaal: 1 }, { centen: -50 }, { btwCenten: 210 },
    { centen: 100, herkomst: 'rtg' }, { centen: 100, herkomst: 'provider' }];
  for (const r of rijen) {
    const u = deelIn(r);
    assert.ok(u.reden && u.reden.length > 5,
      'indeling zonder reden is bij een geschil niets waard: ' + JSON.stringify(r));
    assert.ok(KLASSEN.includes(u.klasse), 'onbekende klasse ' + u.klasse);
  }
});

test('6. een lege noemer leest nooit als volledig geclassificeerd', () => {
  const b = vers.euros;
  if (b.rijen === 0) {
    assert.ok(b.waaromGeen && b.waaromGeen.length > 30,
      'de opslag draagt geen bedragen, en dan hoort er een REDEN te staan -- anders leest een ' +
      'lege uitslag als een schone uitslag');
  }
  assert.ok(!/percentageGeclassificeerd|dekkingPct/.test(JSON.stringify(vers)),
    'de uitslag draagt een samengesteld dekkingspercentage; over een lege noemer is dat fictie');
});

/* HET VERSCHIL TUSSEN EEN GETAL EN EEN ZIN, en waarom deze toets het maakt.
   De eerste vorm hiervan zocht het woord "bijdragebasis" in de hele
   geserialiseerde uitslag, en zakte zodra de meter in zijn eigen `grens` UITLEGT
   dat hij er geen berekent. Dat is de fout uit BEWIJSMACHINE.md par. 6a: een
   geldige uitslag op het verkeerde experiment -- de toets mat de woordenschat
   van het proza in plaats van de structuur van de uitslag.

   Wat hij moet bewaken is dat er geen BEDRAG onder zo'n naam naar buiten komt.
   Dus: in een SLEUTEL mag het woord nooit staan, en in een WAARDE alleen als die
   waarde in een verklaard prozaveld zit. Zet iemand er morgen
   `bijdragebasisCenten: 481200` bij, of `{ wat: 'bijdragebasis', centen: 481200 }`,
   dan zakt hij nog steeds -- en dat zijn de twee vormen waarin het echt fout gaat. */
const PROZA = new Set(['wat', 'hoe', 'grens', 'regel', 'reden', 'waarom', 'waaromGeen',
  'waaromGeenTotaal', 'waaromNietVolgbaar']);

function loopUitslag(waarde, sleutel, bezoek) {
  bezoek(sleutel, waarde);
  if (Array.isArray(waarde)) { for (const v of waarde) loopUitslag(v, sleutel, bezoek); return; }
  if (waarde && typeof waarde === 'object') {
    for (const [k, v] of Object.entries(waarde)) loopUitslag(v, k, bezoek);
  }
}

test('7. de meter berekent GEEN bijdragebasis', () => {
  const verboden = ['bijdragebasis', 'contributionBase', 'vergoedingCenten', 'feeCenten'];
  const fouten = [];
  loopUitslag(vers, null, (sleutel, waarde) => {
    for (const w of verboden) {
      if (sleutel && sleutel.toLowerCase().includes(w.toLowerCase())) {
        fouten.push('de uitslag draagt een VELD "' + sleutel + '"');
      }
      if (typeof waarde === 'string' && waarde.includes(w) && !PROZA.has(sleutel)) {
        fouten.push('het veld "' + sleutel + '" draagt het woord "' + w +
          '" en staat niet in de verklaarde prozavelden (' + [...PROZA].join(', ') + ')');
      }
    }
  });
  assert.deepEqual(fouten, [],
    fouten.join('; ') + '. Een basis uitrekenen over een noemer die grotendeels onbekend is, ' +
    'levert een getal op dat er precies zo uitziet als een getal dat klopt. Dat is stap 3 en die ' +
    'mag pas als deze meter laat zien dat de invoer er is.');
});

/* ============================================================================
   DE GEZAAIDE WERELD ALS NORM -- besluit van de eigenaar, 15 september 2026.
   De norm is een deterministische wereld en niet de productiedata: die laatste
   verandert voortdurend van samenstelling, en een regressie die alleen zichtbaar
   is als er toevallig een yen in de data zit, is geen regressietoets.
   ========================================================================== */

test('8. de gezaaide wereld is DETERMINISTISCH', () => {
  /* Zonder dit is de norm een momentopname. Twee metingen in hetzelfde proces
     moeten byte voor byte gelijk zijn; een Date.now() of een Math.random()
     ergens in de keten laat dit zakken. */
  const a = JSON.stringify(meet().norm);
  const b = JSON.stringify(meet().norm);
  assert.equal(a, b, 'twee metingen van de gezaaide wereld verschillen -- er zit iets ' +
    'niet-deterministisch in de keten (een tijdstip, een toeval, een teller die elders al liep)');
});

test('9. de wereld draagt wat zij over zichzelf verklaart', () => {
  const n = meet().norm;
  assert.equal(n.rijen, VERWACHT.rijen,
    'de wereld telt ' + n.rijen + ' rijen en verklaart er ' + VERWACHT.rijen);
  assert.equal(n.nietVolgbaar, VERWACHT.nietVolgbaar,
    'de wereld heeft ' + n.nietVolgbaar + ' niet-volgbare rijen en verklaart er ' + VERWACHT.nietVolgbaar +
    '. Die staan er MET OPZET: verdwijnen ze, dan toetst deze wereld niet meer of de meter een gat ZIET.');
  assert.ok(n.klopt, 'de wereld wijkt af van haar eigen verklaring');
});

test('10. RATEL op de norm: volgbaar alleen omhoog, niet-volgbaar alleen omlaag', () => {
  /* De twee tanden van het migratiepad: 12,5% -> 25% -> 70%. Ze staan hier op de
     GEZAAIDE wereld en niet op de productiedata, want alleen die eerste is een
     norm. */
  const GROND = { gezet: '2026-09-15', volgbaar: 18, nietVolgbaar: 4 };
  const n = meet().norm;
  assert.ok(n.volgbaar >= GROND.volgbaar,
    'volgbaar zakte van ' + GROND.volgbaar + ' naar ' + n.volgbaar +
    ' -- een rij die te volgen was, is dat niet meer');
  assert.ok(n.nietVolgbaar <= GROND.nietVolgbaar,
    'nietVolgbaar steeg van ' + GROND.nietVolgbaar + ' naar ' + n.nietVolgbaar +
    ' -- dit getal hoort te dalen doordat er herkomst bij komt, niet te stijgen doordat er rijen bij komen');
});

test('11. elke niet-volgbare rij draagt een REDEN', () => {
  for (const g of meet().norm.gaten) {
    assert.ok(g.waarom && g.waarom.length > 20,
      'een gat zonder reden leest als een restpost in plaats van als een werklijst: ' + JSON.stringify(g));
  }
});

/* ============================================================================
   DE PRIMITIEF -- herkomst, eigenaar en bestemming zijn DRIE vragen.
   ========================================================================== */

test('12. herkomst, eigenaar en naarWie worden nooit uit elkaar afgeleid', () => {
  /* Het voorbeeld waarop `herkomst: "partner"` sneuvelde: een klant betaalt,
     RTG int, het hotel is de eigenaar. Drie verschillende partijen op EEN rij. */
  const r = eh.geldrij({ bedragCenten: 80000, valuta: 'EUR',
    economischeHerkomst: 'lid', economischeEigenaar: 'derde', naarWie: 'rtg' });
  assert.equal(r.economischeHerkomst, 'lid');
  assert.equal(r.economischeEigenaar, 'derde');
  assert.equal(r.naarWie, 'rtg');

  /* En andersom: wie er maar EEN meegeeft, krijgt de andere twee NIET cadeau. */
  const half = eh.geldrij({ bedragCenten: 80000, economischeHerkomst: 'lid' });
  assert.equal(half.economischeEigenaar, eh.ONBEKEND,
    'de eigenaar is afgeleid uit de herkomst -- dat is precies de fout waar deze module tegen bestaat');
  assert.equal(half.naarWie, eh.ONBEKEND);
});

test('13. een onbekende partijsoort wordt ONBEKEND en nooit "waarschijnlijk derde"', () => {
  for (const verzonnen of ['import', 'partner', 'extern', 'PARTNER', ' ', '', null, undefined, 42]) {
    const r = eh.geldrij({ bedragCenten: 100, economischeEigenaar: verzonnen });
    assert.equal(r.economischeEigenaar, eh.ONBEKEND,
      'de soort ' + JSON.stringify(verzonnen) + ' werd ' + r.economischeEigenaar +
      ' in plaats van onbekend. Een fout naar `derde` verlaagt de bijdragebasis, een fout naar ' +
      '`rtg` verhoogt hem, en allebei zijn onzichtbaar.');
  }
});

test('14. een bedrag dat geen getal is, is ONBEKEND en geen nul', () => {
  for (const geen of ['veel', null, undefined, NaN, {}]) {
    const r = eh.geldrij({ bedragCenten: geen });
    assert.equal(r.bedragCenten, null,
      'een onleesbaar bedrag werd ' + r.bedragCenten + '; nul is een BEDRAG en onwetendheid niet');
    assert.equal(eh.volgbaar(r), false);
  }
  /* Nul zelf is wel een bedrag. */
  assert.equal(eh.geldrij({ bedragCenten: 0 }).bedragCenten, 0);
});

test('15. valuta worden nooit bij elkaar opgeteld', () => {
  const s = hs.naarEigenaar([
    eh.geldrij({ bedragCenten: 1000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'rtg' }),
    eh.geldrij({ bedragCenten: 5000, valuta: 'JPY', economischeHerkomst: 'lid', economischeEigenaar: 'rtg' })
  ]);
  assert.equal(s.eenValuta, null, 'twee valuta leverden een totaal op');
  assert.ok(s.waaromGeenTotaal && /koers/.test(s.waaromGeenTotaal),
    'er staat geen reden bij waarom er geen totaal is');
  /* De yen heeft geen honderdsten (kern/payroll/valuta.js). 5000 JPY bij 1000
     EUR optellen is een factor honderd mis, en dat is niet met een komma te
     repareren. */
  const eenSoort = hs.naarEigenaar([
    eh.geldrij({ bedragCenten: 1000, valuta: 'EUR', economischeHerkomst: 'lid', economischeEigenaar: 'rtg' })
  ]);
  assert.equal(eenSoort.eenValuta, 'EUR');
});

test('16. de onbekende post loopt nooit negatief', () => {
  /* DIT IS DE BUG DIE DE GEZAAIDE WERELD BINNEN EEN MINUUT VOND. Terugbetalingen
     komen toe aan het LID, en `lid` viel in de restbak omdat splits alleen rtg,
     derde, overheid en psp kende. De onbekende post stond daardoor op -52260:
     een negatief gat, en dat is het soort getal waar niemand op klikt omdat het
     klein lijkt. */
  const n = meet().norm;
  assert.ok(n.splitsing.perEigenaar.onbekend >= 0,
    'de onbekende post staat op ' + n.splitsing.perEigenaar.onbekend + '. Een negatieve onbekende ' +
    'post betekent dat er een BEKENDE partijsoort in de restbak valt -- kijk welke soort geen eigen bak heeft.');
  assert.ok(Object.prototype.hasOwnProperty.call(n.splitsing.perEigenaar, 'aanDeKlant'),
    'de bak `aanDeKlant` is weg; dan vallen terugbetalingen weer in de restpost');
});

test('17. de primitieve laag kent geen tarief', () => {
  /* COMMENTAAR IS GEEN CODE, en deze toets maakte dat verschil eerst niet. De kop
     van de primitief LEGT UIT waarom er geen vergoeding en geen percentage in
     staat, en daar zakte hij op -- terwijl juist die uitleg is wat je wilt houden.
     Dat is de klasse uit METERKLASSE.md: 60 van de 73 scripts leiden betekenis af
     uit de VORM van code zonder commentaar te scheiden, en dit was er bijna de
     61ste van. Er wordt daarom gelezen met scripts/lib/bron.js -- de bestaande
     scheider, die ook strings en regex-letterlijken kent -- en niet met een
     eigen zoek-en-vervang die op het eerste schuine streepje struikelt. */
  const { zonderCommentaar } = require('../scripts/lib/bron');

  /* BEIDE BESTANDEN, want de laag is er twee geworden. De splitsing is uit de
     primitief gehaald toen die over keuringsregel 13 kwam, en een tariefwacht
     die maar de helft van zijn laag leest, bewaakt niets: juist de TELLING is
     de plek waar een percentage vanzelf logisch voelt. */
  const bestanden = ['../server/kern/waarde/economischeherkomst.js',
    '../server/kern/waarde/herkomstsplitsing.js'];
  let geijkt = false;

  for (const b of bestanden) {
    const rauw = fs.readFileSync(require.resolve(b), 'utf8');
    const code = zonderCommentaar(rauw, { soort: 'js' });
    assert.ok(code.length < rauw.length - 300,
      b + ': de commentaarscheider haalde vrijwel niets weg (' + rauw.length + ' -> ' + code.length +
      ') -- dan leest deze toets de uitleg als code en bewijst hij niets');
    if (rauw.includes('vergoeding') && !code.includes('vergoeding')) geijkt = true;

    for (const verboden of ['0.20', '0,20', 'vergoeding', 'royalty', 'percentage', 'tarief']) {
      assert.ok(!code.includes(verboden),
        b + ' draagt "' + verboden + '" in de CODE (niet in een toelichting). Zodra hier een tarief ' +
        'staat is dit geen primitief meer maar beleid, en dan zit het percentage op de plek waar de ' +
        'waarheid hoort te staan.');
    }
  }

  /* Zelfijking: er MOET ergens een toelichting staan die het woord draagt,
     anders bewijst de scheiding hierboven niets -- een instrument dat niet kan
     uitslaan, is geen instrument. */
  assert.ok(geijkt,
    'geen van beide bestanden noemt "vergoeding" in een toelichting -- dan is niet aangetoond dat ' +
    'deze toets commentaar en code werkelijk uit elkaar houdt');
});
