/* KAN DEZE HANDELING NA COMMIT EEN KANTOORBANK WIJZIGEN?
   (server/kern/isolatie/kantoorbank.js)

   DE VRAAG DIE DEZE SUITE AFDWINGT is met opzet NIET "zit deze route in het
   bankdomein". Dat tweede vermengt handelingstype met domeincontext, en daarmee wordt
   het effectmodel juist minder waar op het moment dat je het voor causaliteit wilt
   gebruiken: een leesroute of een regel-instelling die in het bankdomein woont, beweegt
   zelf geen geld.

   WAT ER GEREPAREERD IS, in twee richtingen tegelijk. Vier kantoor-bankroutes droegen
   GELD_BEWEGEN (/draai, /leden, /mislukking, /nood) en geen van die vier verplaatst een
   euro -- ze kregen het omdat de collectie `bankregie` als geld was ingedeeld. En de
   routes die WEL een geldpositie wijzigen stonden op `onbekend`, want de
   idempotentieproef komt er niet langs.

   DE VIER BEWERINGEN VAN DEZE SUITE:

     1 de tabel is GESLOTEN over zijn bereik: elke /api/office/bank/-route heeft een
       antwoord, dus een nieuwe route zakt tot iemand de vraag beantwoordt;
     2 elke `true` draagt werkelijk GELD_BEWEGEN in het effectmodel;
     3 een `false` krijgt GELD_BEWEGEN nooit uit een VERKLARING (uit een meting mag het
       wel: als de proef een geldcollectie zag bewegen, dan bewoog die);
     4 het gevolgcontract en deze tabel spreken elkaar niet tegen.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { KANTOORBANK, BEREIK, geldpositieVan, klassenVan } = require('../server/kern/isolatie/kantoorbank');
const effecten = require('../server/kern/isolatie/effecten');
const effectcollecties = require('../server/kern/isolatie/effectcollecties');
const { alleRoutes } = require('../scripts/lib/routes');

const kantoorbank = () => {
  const uit = new Map();
  for (const r of alleRoutes()) if (BEREIK.test(r.pad)) uit.set(r.pad, r.methode);
  return uit;
};

test('1. DE TABEL IS GESLOTEN: elke kantoor-bankroute heeft een antwoord', () => {
  /* Een tabel die stilletjes achterloopt op de code is geen verklaring maar een
     momentopname. Een nieuwe route hoort deze toets te laten zakken tot iemand de vraag
     beantwoordt -- niet tot iemand hem stil op `false` zet. */
  const paden = [...kantoorbank().keys()];
  assert.ok(paden.length >= 35, 'de routelijst hoort de kantoorbank te vinden (' + paden.length + ')');
  const zonderAntwoord = paden.filter(p => geldpositieVan(p).kan === null).sort();
  assert.deepStrictEqual(zonderAntwoord, [],
    'deze routes hebben geen antwoord op "kan dit een geldpositie wijzigen": ' + zonderAntwoord.join(', '));

  /* En andersom: de tabel noemt geen route die niet bestaat. Een verklaring over een
     verdwenen route is een alibi -- zelfde regel als BEKEND_OPEN in
     test/mutatiecontract.test.js. */
  const spook = Object.keys(KANTOORBANK).filter(p => !kantoorbank().has(p)).sort();
  assert.deepStrictEqual(spook, [], 'de tabel verklaart routes die niet bestaan: ' + spook.join(', '));
});

test('2. elke `true` draagt werkelijk GELD_BEWEGEN', () => {
  const ja = Object.keys(KANTOORBANK).filter(p => KANTOORBANK[p][0]);
  assert.ok(ja.length >= 5, 'er horen geldbewegende kantoorroutes te zijn (' + ja.length + ')');
  for (const p of ja) {
    const uit = effecten.effectenVan(p, 'POST', null);
    assert.ok((uit.effecten || []).includes('GELD_BEWEGEN'),
      p + ': verklaard als geldbewegend maar het effectmodel zegt ' + JSON.stringify(uit.effecten));
    assert.ok(uit.gronden.some(g => /^geldpositie:/.test(g)),
      p + ': de grond van deze verklaring hoort in de uitslag te staan');
  }
  /* De route waar de gouden keten het geld werkelijk beweegt, staat erbij. Die stond op
     `onbekend` terwijl de aanvraag ernaast GELD_BEWEGEN miste en een SSO-label droeg. */
  assert.ok(ja.includes('/api/office/bank/handtekening/bevestig'));
});

test('3. een `false` krijgt GELD_BEWEGEN nooit uit een VERKLARING', () => {
  /* Uit een METING mag het wel: zag de proef een geldcollectie bewegen, dan bewoog die,
     en een verklaring die een meting overstemt is de rangorde die effecten.js verbiedt.
     Wat hier wordt afgedwongen is dat de tabel zelf niets toevoegt op een nee. */
  const nee = Object.keys(KANTOORBANK).filter(p => !KANTOORBANK[p][0]);
  assert.ok(nee.length >= 25, 'de meeste kantoor-bankroutes bewegen geen geld (' + nee.length + ')');
  for (const p of nee) {
    const uit = effecten.effectenVan(p, 'POST', null);
    assert.ok(!uit.gronden.some(g => /^geldpositie:/.test(g)),
      p + ': een nee hoort niets toe te voegen, en voegt toe');
  }
});

test('4. DE VERVALSING KOMT NIET TERUG: bankregie is geen geld', () => {
  /* De bediening van de bankkant is een STAND en geen positie. Zou hij weer als geld
     worden ingedeeld, dan dragen vier bankschakelaars opnieuw GELD_BEWEGEN. */
  const rij = effectcollecties.effectVan('bankregie');
  assert.ok(rij, 'bankregie hoort ingedeeld te zijn');
  assert.notStrictEqual(rij.effect, 'GELD_BEWEGEN',
    'bankregie is de bediening van de bankkant: een stand, geen positie');
  /* En de correctie mag geen VERSOEPELING zijn: wat hij nu draagt hoort net als
     GELD_BEWEGEN in BESCHERMD_SLUIT te staan, anders gaat er iets open dat dicht was. */
  assert.ok(effecten.BESCHERMD_SLUIT.includes(rij.effect),
    'de nieuwe klasse van bankregie (' + rij.effect + ') zit niet in BESCHERMD_SLUIT; ' +
    'dan is deze waarheidscorrectie een versoepeling');
  for (const p of ['/api/office/bank/draai', '/api/office/bank/leden',
    '/api/office/bank/nood', '/api/office/bank/mislukking']) {
    const uit = effecten.effectenVan(p, 'POST', null);
    assert.ok(!(uit.effecten || []).includes('GELD_BEWEGEN'),
      p + ' is een bankstand en draagt weer GELD_BEWEGEN');
  }
});

test('5. `sso` matcht op woordgrenzen en niet op de letters in inca-sso', () => {
  /* /api/office/bank/incasso droeg VERTROUWENSRELATIE_AANGAAN met de grond "een
     blijvende relatie met iets buiten de sessie" -- op de grootste geldweg van dit huis,
     en /incasso/dossier is zelfs een LEESroute. Een grond die onzin is, is erger dan
     geen grond: hij overleeft het nakijken. */
  for (const p of ['/api/office/bank/incasso', '/api/office/bank/incasso/dossier']) {
    const uit = effecten.effectenVan(p, 'POST', null);
    assert.ok(!(uit.effecten || []).includes('VERTROUWENSRELATIE_AANGAAN'),
      p + ': draagt weer een SSO-label op de letters in "incasso"');
  }
  /* En de tegenproef: een ECHT sso-pad hoort het nog steeds te dragen, anders is de
     reparatie een gat in plaats van een correctie. */
  const echt = effecten.effectenVan('/api/sso/haal', 'POST', null);
  assert.ok((echt.effecten || []).includes('VERTROUWENSRELATIE_AANGAAN'),
    'een echt sso-pad hoort zijn label te houden');
});

test('6. het gevolgcontract en deze tabel spreken elkaar niet tegen', () => {
  /* Twee lagen die per route over dezelfde werkwoorden praten, moeten het eens zijn --
     anders is de een een alibi voor de ander. De regel is asymmetrisch en dat is de
     bedoeling: het contract mag MEER verklaren (het is rijker), maar wat deze tabel
     bevestigt mag het contract niet UITSLUITEN. */
  const { CONTRACTEN } = require('../server/kern/stuur/gevolgcontract/register');
  let nagekeken = 0;
  for (const pad of Object.keys(CONTRACTEN)) {
    const g = geldpositieVan(pad);
    if (g.kan === null) continue;
    nagekeken++;
    const c = CONTRACTEN[pad];
    const veroorzaakt = Array.isArray(c.veroorzaakt) ? c.veroorzaakt : [];
    const nooit = Array.isArray(c.nooit) ? c.nooit : [];
    if (g.kan === true) {
      assert.ok(!nooit.includes('GELD_BEWEGEN'),
        pad + ': de tabel zegt dat dit een geldpositie wijzigt en het contract sluit GELD_BEWEGEN uit');
    } else {
      assert.ok(!veroorzaakt.includes('GELD_BEWEGEN'),
        pad + ': het contract claimt GELD_BEWEGEN terwijl de tabel zegt dat er geen positie wijzigt');
    }
  }
  assert.ok(nagekeken >= 2, 'er horen contracten binnen het bereik van de tabel te vallen (' + nagekeken + ')');
});

test('7. een `nee` mag de METING niet tegenspreken -- en die controle kan zakken', () => {
  /* DE GEVAARLIJKE RICHTING. Een mens die "hier wijzigt geen positie" verklaart terwijl
     de proef een geldcollectie zag bewegen, zet een verklaring boven een meting. Dat is
     precies de rangorde die effecten.js verbiedt, en het is erger dan een ontbrekende
     verklaring: het ziet eruit als nagekeken.

     EN DEZE BEWERING IS VANDAAG LEEG, dus staat er een zelfijking onder. Geen enkele
     nee-route heeft nu een als geld ingedeelde collectie gemeten (hun collecties zijn
     kantoorAudit, bankregie, fiscaalRegels en zo). Een lege bewering die niet kan zakken
     is precies wat scripts/tandeloos.js telt, dus wordt hier BEWEZEN dat de controle
     aanslaat op een geval dat wel fout is. */
  const proefmeting = require('../server/kern/isolatie/proefmeting');
  const geldCollectiesVan = (cols) => [...(cols || [])].filter(c => {
    const r = effectcollecties.effectVan(c);
    return r && r.effect === 'GELD_BEWEGEN';
  });

  /* de zelfijking: op een verzonnen paar slaat hij WEL aan */
  assert.deepStrictEqual(geldCollectiesVan(['kantoorAudit', 'bankSaldi']), ['bankSaldi'],
    'de controle ziet een geldcollectie niet; dan meet hij niets in de echte ronde ook');
  assert.deepStrictEqual(geldCollectiesVan(['kantoorAudit']), []);

  /* en dan de echte ronde */
  for (const p of Object.keys(KANTOORBANK).filter(x => !KANTOORBANK[x][0])) {
    const geld = geldCollectiesVan(proefmeting.collectiesVan(p));
    assert.deepStrictEqual(geld, [],
      p + ': verklaard als "wijzigt geen geldpositie" terwijl de proef ' + geld.join(', ') +
      ' zag bewegen. Een verklaring hoort een meting niet te overstemmen');
  }
});

test('8. elke NEE-route draagt ook zijn EIGEN klasse, of een lege lijst met een grond', () => {
  /* De tweede helft van de tabel. "Deze route beweegt geen geld" is een antwoord op EEN
     vraag; wat zij dan wel doet is een tweede, en een leeg vak daar is geen antwoord maar
     een stilte. Sinds 13 september bestaan de vier werkwoorden die dat kunnen zeggen. */
  const woorden = require('../server/kern/isolatie/effectwoorden').NAMEN;
  const nee = Object.keys(KANTOORBANK).filter(p => !KANTOORBANK[p][0]);
  let metWoord = 0;
  for (const p of nee) {
    const k = klassenVan(p);
    assert.ok(Array.isArray(k), p + ': de derde kolom hoort een lijst te zijn, ook als hij leeg is');
    for (const w of k) assert.ok(woorden.includes(w), p + ': onbekend werkwoord ' + w);
    if (k.length) metWoord++;
  }
  /* GEEN DREMPEL OP HET AANTAL, en dat is een besluit: een getal kiezen dat net haalt is
     achterstevoren toetsen. De echte invariant is dat elke nee-route OF een werkwoord
     draagt OF een grond die uitlegt waarom er geen past -- /gezond leest een systeemstand,
     /bevoegdheid een matrix per land. Hoeveel het er zijn, is dan een uitkomst en geen eis.
     Vandaag: 25 van de 32 met een woord, 7 met opzet zonder. */
  for (const p of nee) if (!klassenVan(p).length)
    assert.ok(KANTOORBANK[p][1].length > 10,
      p + ': geen klasse EN geen grond is een leeg vak, en dat is precies wat deze tabel moet voorkomen');
  assert.ok(metWoord > 0, 'geen enkele nee-route draagt een klasse; dan doet de tweede kolom niets');
});

test('9. `[]` en `null` lijken NIET op elkaar, en het effectmodel blijft fail-closed', () => {
  /* `[]` betekent "verklaard, en geen van de werkwoorden past"; `null` betekent "hierover
     is niets verklaard". Wie beide als leeg leest, heeft een bron gebouwd die zwijgen als
     antwoord geeft. */
  assert.deepStrictEqual(klassenVan('/api/office/bank/gezond'), []);
  assert.strictEqual(klassenVan('/api/bank/sepa'), null, 'buiten de tabel hoort null te komen');

  /* EN DE GRENS DIE DAARUIT VOLGT: een declaratie zonder werkwoord blijft in het
     effectmodel `onbekend`, want dat bestand mag nooit een lege lijst teruggeven -- dan
     keurt het goed wat het niet begrijpt. De verklaring is niet verloren, zij woont hier. */
  const uit = effecten.effectenVan('/api/office/bank/gezond', 'POST', null);
  assert.strictEqual(uit.graad, 'onbekend');
  assert.strictEqual(uit.effecten, null, 'het effectmodel hoort nooit [] terug te geven');
});

test('10. de vier nieuwe werkwoorden landen echt, en elk met zijn standbesluit', () => {
  const sluiting = require('../server/kern/isolatie/standsluiting');
  const verwacht = {
    PLAFOND_WIJZIGEN: '/api/office/bank/rekening/rood',
    CONFIGUREREN: '/api/office/bank/modus',
    VOORSTEL_MAKEN: '/api/office/bank/salaris/voorstel',
    LEZEN_ANDERMANS: '/api/office/bank/afschrift'
  };
  for (const [woord, pad] of Object.entries(verwacht)) {
    const uit = effecten.effectenVan(pad, 'POST', null);
    assert.ok((uit.effecten || []).includes(woord), pad + ' draagt ' + woord + ' niet: ' +
      JSON.stringify(uit.effecten));
  }
  /* DE STANDBESLUITEN, en ze staan hier omdat ze anders alleen in commentaar bestaan.
     `isolatie` sluit alles behalve LEZEN_EIGEN, dus alle vier gaan daar dicht; `beschermd`
     sluit een expliciete lijst en daar is per woord over besloten. */
  for (const w of Object.keys(verwacht))
    assert.ok(sluiting.TREDE_SLUIT.isolatie.includes(w), w + ' blijft open in isolatie');
  assert.ok(sluiting.BESCHERMD_SLUIT.includes('PLAFOND_WIJZIGEN'),
    'een limiet verhogen hoort in de beschermstand dicht te gaan');
  assert.ok(sluiting.BESCHERMD_SLUIT.includes('CONFIGUREREN'));
  assert.ok(!sluiting.BESCHERMD_SLUIT.includes('LEZEN_ANDERMANS'),
    'beschermd bevriest mutaties en bevoorrechte handelingen; lezen is geen van beide');
  assert.ok(!sluiting.BESCHERMD_SLUIT.includes('VOORSTEL_MAKEN'),
    'een voorstel verandert niets; het tegenhouden stopt geen effect');
});
