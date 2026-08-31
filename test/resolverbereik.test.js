/* HET BEREIK VAN DE RESOLVER (scripts/resolverbereik.js).

   test/stuur-resolver-taal.test.js bewaakt de dekking op 27 met de hand
   geschreven zinnen. Dat is nuttig en het is zwak bewijs: wie de vragen kiest,
   kiest het resultaat. Deze suite draait dat om -- zij genereert een vraag voor
   ELK pad dat een rol mag bedienen, in zeven vervormingen, en eist dat het pad
   in het werkveld overleeft.

   HET CORPUS GROEIT DUS MEE MET HET PLATFORM. Een nieuwe route brengt zijn eigen
   proef mee; niemand hoeft een lijst bij te werken, en niemand kan een route
   toevoegen die onvindbaar is zonder dat deze toets zakt.

   DE EIS IS 100 EN NIET "HOOG". Een gemist vermogen laat de AI "dat kan ik niet"
   zeggen over iets dat de gebruiker gewoon mag; dat is een leugen met een
   technische oorzaak en van buiten niet te zien. Compactheid is een kostenpost
   en staat hier daarom niet in de toets, alleen in de meter. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bouw, VORMEN } = require('../scripts/resolverbereik');

const R = bouw();

test('0. de meting deugt: er zijn echte paden en zeven vervormingen', () => {
  assert.ok(!R.fout, R.fout);
  assert.ok(R.paden > 100, 'te weinig toegestane paden om iets te bewijzen: ' + R.paden);
  assert.ok(Object.keys(VORMEN).length >= 7, 'te weinig vervormingen');
});

test('1. DEKKING IS 100% PER VERVORMING, en per vorm apart zodat een gemiddelde niets verbergt', () => {
  for (const [naam, v] of Object.entries(R.vormen)) {
    const uitleg = v.gemist.slice(0, 5)
      .map(g => g.pad + ' <- "' + g.zin + '" (' + g.kreeg + ' paden)').join('\n    ');
    assert.equal(v.dekking, 100,
      'vervorming "' + naam + '" verbergt ' + v.gemist.length + ' vermogen(s):\n    ' + uitleg);
  }
});

test('2. de zwaarste vervormingen zijn er echt bij, want die vinden de gaten', () => {
  for (const nodig of ['alleen domein', 'typefout', 'alleen werkwoord'])
    assert.ok(R.vormen[nodig], 'vervorming "' + nodig + '" ontbreekt -- juist die vond de afkapgrens en de dunne-bewijsregel');
});

test('3. de terugval is niet de enige reden dat de dekking klopt', () => {
  /* Als elke vervorming zou terugvallen op de volledige lijst, was 100% dekking
     een tautologie: dan bewijst deze suite alleen dat de lijst compleet is. Er
     moet dus minstens een vorm zijn die WEL versmalt en toch alles vindt. */
  const versmallend = Object.entries(R.vormen).filter(([, v]) => v.versmaldPct >= 90);
  assert.ok(versmallend.length >= 3,
    'te weinig vervormingen versmallen echt; dan is 100% dekking een tautologie');
});

test('4. en er is minstens een vorm waarin de resolver NIET het pad zelf terugkrijgt', () => {
  /* "eigen woorden" bouwt de zin uit de padsegmenten en is dus deels een
     identiteitstest. "mensenwoorden" gaat over de omgekeerde brug, en "typefout"
     vervormt elk woord. Zonder die twee zou deze meter zichzelf feliciteren. */
  assert.ok(R.vormen['mensenwoorden'] && R.vormen['typefout']);
  assert.equal(R.vormen['mensenwoorden'].dekking, 100);
  assert.equal(R.vormen['typefout'].dekking, 100);
});

/* DE RATEL OP RESOLVERBEREIK.json. Deze toets bestond als bouwcontrole; wat er
   ontbrak was een grondwaarde, en daardoor hing het register aan geen enkele
   ratel (de norm noemt dat `metingenZonderRatel`). De dekking is het getal dat
   telt: hij mag dalen noch stiekem kleiner gemeten worden. */
test('9. de dekking van RESOLVERBEREIK.json zakt niet', () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const b = path2.join(__dirname, '..', 'RESOLVERBEREIK.json');
  if (!fs2.existsSync(b)) return;
  const u = JSON.parse(fs2.readFileSync(b, 'utf8'));
  assert.ok(u.laagste >= 100,
    'de dekking staat op ' + u.laagste + '%; hij stond op 100 en een gemiste capability is ' +
    'precies de faalvorm waar deze meter voor bestaat');
  assert.ok(u.paden >= 176,
    'het corpus is kleiner geworden (' + u.paden + ' paden); een dekking van 100% over minder ' +
    'paden is geen gelijke uitslag');
});
