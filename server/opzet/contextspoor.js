/* HET CONTEXTSPOOR -- welke kernnaam reikt welk verzoek werkelijk aan.

   WAAROM DIT BESTAAT. De aanroepgraaf (AANROEPGRAAF.json) kan 20.961 aanroepen
   niet herleiden, en dat is geen tekort van de meter: dit huis geeft zijn
   modules niet via `require` door maar via een contextobject dat in
   server/opzet/ wordt samengesteld. `k.instantMutate()` is statisch dus niet te
   volgen zonder de hele opbouw na te spelen. Een op de zes aanroepen loopt zo.

   Wat statisch niet kan, kan wel TIJDENS het draaien. De domeingrens
   (./domeingrens.js) is een Proxy waar elke toegang tot dat contextobject
   langskomt -- een echt choke point, en het enige. Deze module noteert daar wat
   er langsgaat, en koppelt het aan het verzoek dat op dat moment loopt
   (./handeling.js draagt pad en methode in een async-context).

   DRIE DINGEN DIE HIJ NIET IS.

   Hij staat UIT. Alleen met RTG_CONTEXTPROEF=1 doet hij iets, net als de
   meldstand van de domeingrens ernaast en om dezelfde reden: in de gewone keten
   en niet in een tweede opstartpad, want een pad dat je niet draait is een pad
   dat niet werkt. Zonder de vlag kost hij een booleaanse vergelijking.

   Hij zegt "REIKTE NAAR" en niet "riep aan". Een `get` op de Proxy betekent dat
   de code de naam heeft opgehaald. Meestal is dat om hem aan te roepen, maar
   niet altijd -- `const { save } = kern` haalt hem op zonder hem te gebruiken.
   Dat onderscheid staat in de uitslag en wordt niet weggepoetst, want het is
   precies het soort verschil dat een meter geloofwaardig houdt.

   Hij VERZINT GEEN VERZOEK. Reikt iets naar de kern buiten een verzoek om (bij
   het opstarten, in een achtergrondtaak), dan komt dat onder '(buiten een
   verzoek)' te staan en niet bij het laatste verzoek dat toevallig langskwam --
   dezelfde regel als de drager in kern/kosten/haak.js. */
'use strict';

const AAN = process.env.RTG_CONTEXTPROEF === '1';
const UIT_PAD = process.env.RTG_CONTEXTPROEF_UIT || '';

/* "METHODE pad" -> Map(domein + '.' + naam -> aantal). Een Map en geen object:
   een kernnaam als `constructor` of `__proto__` hoort geen bijzondere betekenis
   te krijgen. */
const spoor = new Map();
const BUITEN = '(buiten een verzoek)';
let handeling = null, handelingGeprobeerd = false;

function huidigVerzoek() {
  if (!handelingGeprobeerd) {
    handelingGeprobeerd = true;
    try { handeling = require('./handeling'); } catch (e) { handeling = null; }
  }
  if (!handeling || typeof handeling.huidige !== 'function') return BUITEN;
  let h = null;
  try { h = handeling.huidige(); } catch (e) { h = null; }
  if (!h || !h.pad) return BUITEN;
  return (h.methode || '?') + ' ' + h.pad;
}

function noteer(domein, naam) {
  if (!AAN) return;
  const sleutel = huidigVerzoek();
  let per = spoor.get(sleutel);
  if (!per) { per = new Map(); spoor.set(sleutel, per); }
  const naamSleutel = domein + '.' + naam;
  per.set(naamSleutel, (per.get(naamSleutel) || 0) + 1);
  plan();
}

function uitslag() {
  const perVerzoek = [];
  for (const [sleutel, per] of spoor) {
    perVerzoek.push({
      verzoek: sleutel,
      namen: [...per].sort((a, b) => b[1] - a[1]).map(([naam, aantal]) => ({ naam, aantal }))
    });
  }
  perVerzoek.sort((a, b) => b.namen.length - a.namen.length);
  const alleNamen = new Set();
  for (const v of perVerzoek) for (const n of v.namen) alleNamen.add(n.naam);
  return {
    aan: AAN,
    uitleg: 'Welke naam op het contextobject door welk verzoek is opgehaald, gemeten in de domeingrens-Proxy. "Reikte naar", niet "riep aan".',
    verzoeken: perVerzoek.length,
    namen: alleNamen.size,
    buitenEenVerzoek: (spoor.get(BUITEN) || new Map()).size,
    perVerzoek
  };
}

/* WEGSCHRIJVEN MAG NIET OP AFSLUITEN LEUNEN, en dat is hier meteen gebleken:
   scripts/lib/wegwerpserver.js ruimt zijn server op met SIGKILL, en dat sein is
   niet af te vangen. `process.on('exit')` draait dan nooit en het spoor van een
   hele ronde verdwijnt -- zonder foutmelding, want er is niemand meer om er een
   te geven.

   Daarom schrijft hij TIJDENS het draaien, hooguit een keer per 750 ms en
   alleen als er iets veranderd is. Een lopende meting kost dan af en toe een
   bestandsschrijf; wat er kwijt kan raken is minder dan een seconde, en de
   aanroeper wacht na het doden even zodat ook die laatste ronde binnen is.

   Een aparte route om het spoor uit te lezen zou ook kunnen, maar dan draagt de
   productieserver een uitleespunt voor een meting -- precies een deur die
   niemand nodig heeft. */
const SCHRIJFRUST = 750;
let laatsteSchrijf = 0, vuil = false, klok = null;

function schrijf() {
  if (!AAN || !UIT_PAD) return;
  try {
    require('fs').writeFileSync(UIT_PAD, JSON.stringify(uitslag(), null, 1) + '\n');
    vuil = false; laatsteSchrijf = Date.now();
  } catch (e) { /* een meting mag een verzoek nooit laten omvallen */ }
}

function plan() {
  if (!AAN || !UIT_PAD) return;
  vuil = true;
  if (klok) return;
  const wacht = Math.max(0, SCHRIJFRUST - (Date.now() - laatsteSchrijf));
  klok = setTimeout(() => { klok = null; if (vuil) schrijf(); }, wacht);
  /* unref: een meting houdt een proces nooit in leven. */
  if (typeof klok.unref === 'function') klok.unref();
}

if (AAN && UIT_PAD) {
  process.on('exit', schrijf);
  for (const sein of ['SIGINT', 'SIGTERM']) process.on(sein, () => { schrijf(); process.exit(0); });
}

module.exports = { AAN, noteer, uitslag, schrijf };
