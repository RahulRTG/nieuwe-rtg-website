/* DE OGEN: hoeveel onafhankelijke mensen moeten hier voor tekenen.

   Dit huis kent het vier-ogenprincipe op vijf plekken -- de documentenuitgifte
   (kern/uitgifte.js), de naheffingsaanslag, het bezwaar daarop, het dwangbevel
   en het kwijtscheldingsvoorstel. Alle vijf hielden ze dezelfde regel vast:
   dezelfde ogen tellen nooit dubbel, wie iets opmaakt stelt het niet vast.

   En alle vijf schreven ze die regel ZELF op. Vier keer bijna hetzelfde:

     const gelijk = (a, b) => String(a||'').trim().toLowerCase() === ...
     u.handtekeningen.some(h => h.door.toLowerCase() === wie.toLowerCase())

   De tweede trimt niet. EERLIJK OVER WAT DAT WEL EN NIET BETEKENDE: in
   kern/uitgifte.js was dat niet uit te buiten, want de naam gaat daar eerst
   door `schoon()` en die trimt al -- aan beide kanten van de vergelijking. Er
   is dus geen gat gedicht en het is geen reparatie van een fout die iemand ooit
   had kunnen maken.

   Wat het WEL is: dezelfde waarheid op vier plekken, in vier formuleringen die
   nu al niet letterlijk gelijk zijn. Dat is LAT.md regel 4, en de reden dat die
   regel bestaat is niet dat het vandaag misgaat maar dat het morgen misgaat --
   iemand haalt `schoon()` weg, of voegt een vijfde plek toe met weer een eigen
   variant. Een regel die op vier plekken staat, is een regel die niemand kan
   veranderen zonder er drie te vergeten.

   WAT HIER WEL EN NIET STAAT. Hier staat HOEVEEL handtekeningen een handeling
   vraagt en WANNEER twee handtekeningen van dezelfde persoon zijn. Hier staat
   NIET wie mag inloggen, wat een beheerder heeft uitgezet, of wat RTG zelf mag
   -- dat zijn de twee assen die er al zijn (middleware/functieschakelaars.js en
   kern/bevoegdheid/). Dit is geen derde rechtenmodel (CONCERN.md verbiedt dat
   met zoveel woorden) maar de telling van handtekeningen die die assen al
   veronderstelden en nergens opschreven.

   DE DREMPELS STAAN ER, MAAR STAAN LEEG. `drempels` is de plek waar "boven dit
   bedrag zes ogen" komt te staan. Er staat vandaag niets in, en dat is met
   opzet: welk bedrag zwaarder toezicht verdient, is een bestuurlijk besluit en
   geen technische keuze. Een verzonnen grens die stilzwijgend gaat gelden is
   erger dan geen grens, want dan denkt iedereen dat er over is nagedacht. */
'use strict';

/* DE ENE VERGELIJKING. Trimt en negeert hoofdletters: "A. Bakker" en
   "a. bakker " zijn dezelfde persoon. Een lege naam is NOOIT gelijk aan een
   andere lege naam -- anders zouden twee ongetekende plekken elkaar opheffen. */
function zelfdeOgen(a, b) {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  return x.length > 0 && x === y;
}

/* Mag deze persoon nog meetekenen? Krijgt de namen die er al staan (of één
   naam) en de naam die erbij wil. Geeft een weigering met reden, want een
   handtekening die wordt geweigerd zonder uitleg is een knop die stuk lijkt. */
function magMeetekenen(alGetekend, wie, wat) {
  const naam = String(wie || '').trim();
  if (naam.length < 2) return { status: 400, error: 'Een handtekening staat altijd op naam.' };
  const eerder = (Array.isArray(alGetekend) ? alGetekend : [alGetekend])
    .filter(x => x != null).map(x => (typeof x === 'string' ? x : x.door));
  if (eerder.some(d => zelfdeOgen(d, naam))) return { status: 409,
    error: 'Dezelfde ogen tellen niet dubbel: een ANDERE ' + (wat || 'collega') + ' moet meetekenen.' };
  return { ok: true, naam };
}

/* HET REGISTER: wat elke handeling vandaag vraagt. Bewust een lijst en geen
   getal per module -- dat was juist het probleem. `ogen` is het aantal OGEN
   (4 = twee mensen, 6 = drie), `omkeerbaar` zegt wat er nog kan als het fout
   was, en `drempels` is leeg tot iemand een grens vaststelt. */
const HANDELINGEN = {
  'naheffing.vaststellen': { ogen: 4, wat: 'inspecteur',
    omschrijving: 'Een naheffingsaanslag vaststellen',
    omkeerbaar: 'intrekbaar zolang hij niet is betaald', drempels: [] },
  'naheffing.bezwaar': { ogen: 6, wat: 'inspecteur',
    omschrijving: 'Beslissen op een bezwaar',
    omkeerbaar: 'nee -- een besluit op bezwaar staat', drempels: [],
    let: 'Zes ogen: wie hem opmaakte en wie hem vaststelde beslissen allebei niet op het bezwaar.' },
  'naheffing.dwangbevel': { ogen: 4, wat: 'ambtenaar',
    omschrijving: 'Een dwangbevel uitvaardigen',
    omkeerbaar: 'de invordering is te stoppen', drempels: [] },
  'kwijtschelding.besluit': { ogen: 4, wat: 'ambtenaar',
    omschrijving: 'Kwijtschelding toekennen',
    omkeerbaar: 'nee -- kwijtgescholden is kwijt', drempels: [] },
  'uitgifte.vrijgeven': { ogen: null, wat: 'collega',
    omschrijving: 'Officiele documentatie overschrijven',
    omkeerbaar: 'nee -- wat weg is, is weg', drempels: [],
    let: 'Het aantal ogen kiest de aanvrager zelf (4 of 6); daarom staat er hier geen vast getal.' }
};

/* Wat een handeling vraagt, gegeven een bedrag. Zolang `drempels` leeg is, is
   het antwoord altijd het basisaantal -- en zegt hij dat er geen bedrag-grens
   is vastgesteld, zodat een scherm dat niet zelf hoeft te verzinnen. */
function eist(sleutel, opties) {
  const h = HANDELINGEN[sleutel];
  if (!h) return { sleutel, bekend: false, ogen: null,
    let: 'Deze handeling staat niet in het ogenregister; er is dus niets over vastgelegd.' };
  const bedrag = Number((opties || {}).bedragCenten);
  let ogen = h.ogen;
  let grond = 'het basisaantal voor deze handeling';
  for (const d of h.drempels) {
    if (Number.isFinite(bedrag) && bedrag >= d.bovenCenten && (ogen === null || d.ogen > ogen)) {
      ogen = d.ogen; grond = 'boven ' + (d.bovenCenten / 100) + ' euro';
    }
  }
  return { sleutel, bekend: true, ogen, grond, wat: h.wat,
    omschrijving: h.omschrijving, omkeerbaar: h.omkeerbaar,
    drempelsVastgesteld: h.drempels.length > 0,
    let: h.let || (h.drempels.length ? null : 'Er is geen bedrag-grens vastgesteld voor deze handeling.') };
}

const alles = () => Object.keys(HANDELINGEN).map(k => eist(k));

module.exports = { zelfdeOgen, magMeetekenen, eist, alles, HANDELINGEN };
