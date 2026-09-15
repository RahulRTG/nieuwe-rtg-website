/* DE TOEREKENING VAN DE IDEMPOTENTIEPROEF -- belandt VOORWERK in het vak van de
   gemeten handeling?

   WAT ER MISGING, en het stond als GERUSTHEID in de bron. scripts/lib/idemproef.js
   doet voor de drie gewogen oproepen eerst twee dingen die echt schrijven: een
   pasladder-ijkoproep (om te zien welke pas de deur opent) en een VOORZIENING (die
   het onderwerp aanmaakt waarop gemeten wordt). De kop beweerde dat dit de meting
   niet vertroebelt, "want staatVan geeft het verschil PER oproep". Dat is niet zo:
   `staatVan` schuift zijn ijkpunt alleen op wanneer hij wordt AANGEROEPEN, en dat
   gebeurt uitsluitend voor de drie. Alles wat het voorwerk schreef belandde dus in
   `opslag.a` -- het vak waaruit kern/stuur/gevolg.js leest wat een handeling
   AANRAAKT.

   HET ECHTE GEVAL: /api/pay/verzoek/intrek kreeg `payIdem` en `payIdemAfdruk`
   toegerekend terwijl verzoekIntrek() geen metIdem aanroept en de route geen sleutel
   meegeeft. Beide kwamen van de voorziening, die het klompje eerst langs
   /api/pay/verzoek aanmaakt. Gemeten met twee peilingen op dezelfde route:

     zonder herijk : {"a":{"payVerzoeken":1,"payIdem":1,"payIdemAfdruk":1}}
     met herijk    : {"a":{"payVerzoeken":"gewijzigd","payIdem":"gewijzigd"}}

   payIdemAfdruk was volledig van het voorwerk, en payVerzoeken ging van "1 rij
   erbij" (de aangemaakte klompje) naar "gewijzigd" -- en dat laatste is exact wat
   intrekken doet.

   WAAROM DEZE TOETS DE ECHTE FUNCTIE DRAAIT en niet de bron leest: draaiIdemproef
   krijgt zijn post, zijn staatVan en zijn voorziening MEE, dus de eigenschap is met
   nagemaakte onderdelen af te dwingen zonder server. Een lexicale toets ("staat er
   herijk in het bestand") zou groen blijven bij een herijk die op de verkeerde plek
   hangt.

   Draai los: node --test test/idemtoerekening.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { draaiIdemproef } = require('../scripts/lib/idemproef');

/* Een nagemaakte wereld met EEN teller per collectie. Elke schrijfactie hoogt hem
   op; de `staat` die met een antwoord meekomt is een momentopname. Zo is een
   "verschil" hier hetzelfde soort ding als in de echte proef: welke collecties
   bewogen tussen twee momenten. */
function maakWereld() {
  const boek = {};
  const stand = () => ({ ...boek });
  const schrijf = (naam) => { boek[naam] = (boek[naam] || 0) + 1; };
  return { stand, schrijf };
}

/* Het verschil tussen twee standen: alleen de namen die bewogen. Dezelfde vorm als
   staatlog.verschil, zonder de ruisijking die hier niets te doen heeft. */
function verschil(oud, nieuw) {
  const uit = {};
  for (const naam of Object.keys(nieuw || {}))
    if ((nieuw[naam] || 0) !== ((oud || {})[naam] || 0)) uit[naam] = nieuw[naam] - ((oud || {})[naam] || 0);
  return uit;
}

/* De proef opzetten zoals scripts/idemproef-route.js dat doet, maar met de
   nagemaakte wereld. `metHerijk` staat aan of uit -- dat is de mutatie. */
async function draai({ metHerijk, metVoorziening = true, metDoodToken = false, metNaInlog = false }) {
  const w = maakWereld();
  const PAD = '/api/proef/intrek';

  /* EEN TOKEN DAT ONDERWEG STERFT. `metDoodToken` laat de eerste GEMETEN oproep een
     401 geven -- precies de situatie waarin de echte proef opnieuw inlogt. De 401
     schrijft zelf niets: een geweigerde oproep hoort niets achter te laten, en zou
     hij dat wel doen, dan meet deze toets zijn eigen fixture. */
  let eenmalig401 = metDoodToken;

  /* De gemeten route WIJZIGT alleen zijn onderwerp; hij maakt niets aan. Dat is de
     hele aanname die de toerekening moet respecteren. */
  const post = async (pad, lijf) => {
    if (eenmalig401 && lijf && lijf.idem) { eenmalig401 = false; return { status: 401, staat: w.stand(), body: {} }; }
    /* De gemeten route EN de pasladder-ijkoproep gaan naar hetzelfde pad -- zo werkt
       de echte proef ook, die de deur eerst op dat pad probeert. De voorziening gaat
       naar haar eigen pad en raakt twee collecties die de route zelf nooit raakt. */
    if (pad === PAD) w.schrijf('onderwerpen');
    else { w.schrijf('voorwerkSleutels'); w.schrijf('voorwerkAfdruk'); }
    return { status: 200, staat: w.stand(), body: {} };
  };

  let vorige = w.stand();
  const staatVan = (antwoord) => {
    if (!antwoord || antwoord.staat == null) return {};
    const d = verschil(vorige, antwoord.staat);
    vorige = antwoord.staat;
    return d;
  };
  const herijk = metHerijk ? (antwoord) => { if (antwoord && antwoord.staat != null) vorige = antwoord.staat; } : null;

  /* DE INLOG SCHRIJFT, en dat is gemeten en niet verzonnen: /api/login zet een rij in
     `sessions` (14 september 2026, wegwerpserver met RTG_STAATLOG=2). De sleutelbos
     onthoudt de stand die het ANTWOORD van die inlog droeg; `naInlog` geeft daarmee de
     NAMEN terug die deze inlog raakte -- dezelfde weg als in scripts/idemproef-route.js,
     hier nagemaakt. Hij schuift het ijkpunt met opzet niet op: zie toets 4. */
  let inlogStaat = null;
  const hernieuw = async () => { w.schrijf('sessions'); inlogStaat = w.stand(); return true; };
  const naInlog = metNaInlog ? ({ voor }) => (voor == null || inlogStaat == null ? [] : Object.keys(verschil(voor, inlogStaat))) : null;

  const uit = await draaiIdemproef({
    post, routes: [{ methode: 'POST', pad: PAD, rol: 'member' }],
    tokenVoor: () => 'token', lijfVoor: () => ({}), staatVan, herijk, hernieuw, naInlog,
    metenZonderSleutel: false, pasladder: ['member', 'lifestyle'],
    /* DE VOORZIENING SCHRIJFT, net als in het echt: zij maakt het onderwerp aan en
       raakt daarbij twee collecties die de gemeten route zelf nooit aanraakt. */
    voorzieningVoor: !metVoorziening ? null
      : (pad) => (pad === PAD ? (async ({ post: p }) => { await p('/api/proef/maak', {}, 'token'); return { id: 'x1' }; }) : null)
  });
  /* De sleutel is "POST <pad>" en niet het pad alleen -- dat kostte de eerste versie
     van deze toets drie valse rode lampjes. */
  const rij = uit.perRoute['POST ' + PAD] || {};
  /* De opslag EN de melding erover: toets 4 heeft beide nodig, en de andere toetsen
     lezen alleen `a`/`b`/`c` -- dus een extra veld erbij stoort daar niets. */
  return Object.assign({}, rij.opslag || {}, { inlogOnderweg: rij.inlogOnderweg });
}

test('1. ZONDER herijk lekt het voorwerk in het vak van de gemeten handeling', async () => {
  /* DE NULMETING. Zonder herijk hoort het voorwerk in `a` te staan -- niet omdat dat
     goed is, maar omdat deze toets pas iets bewijst als hij de fout kan zien. Een
     toets die alleen de gerepareerde kant kent, zou ook groen staan bij een herijk
     die niets doet. */
  const opslag = await draai({ metHerijk: false });
  const a = opslag.a || {};
  const namen = Object.keys(a).sort();
  assert.ok(namen.includes('voorwerkSleutels') && namen.includes('voorwerkAfdruk'),
    'de nulmeting klopt niet: zonder herijk hoort het voorwerk juist WEL in `a` te staan, ' +
    'en hier staat: ' + namen.join(', '));
  /* EN DE TWEEDE LEK, die uit de pasladder komt: de ijkoproep raakt hetzelfde pad, dus
     `onderwerpen` staat op TWEE terwijl de gemeten oproep er maar een deed. Dit is de
     lek waarvan de bron beweerde dat hij niet bestond. */
  assert.equal(a.onderwerpen, 2,
    'zonder herijk hoort de ijkoproep mee te tellen in `onderwerpen` (verwacht 2, kreeg ' +
    a.onderwerpen + ')');
});

test('2. MET herijk staat er in `a` alleen nog wat de gemeten handeling zelf deed', async () => {
  const opslag = await draai({ metHerijk: true });
  const a = opslag.a || {};
  const namen = Object.keys(a).sort();
  assert.deepStrictEqual(namen, ['onderwerpen'],
    'na de herijking hoort `a` alleen de collectie te dragen die de route zelf raakt; ' +
    'gevonden: ' + namen.join(', '));
  for (const lek of ['voorwerkSleutels', 'voorwerkAfdruk'])
    assert.ok(!namen.includes(lek), lek + ' is van het voorwerk en hoort niet aan deze handeling ' +
      'toegerekend te worden -- dit is het geval van /api/pay/verzoek/intrek');
  /* EN HET GETAL KLOPT OOK: een, en niet twee. Alleen de namen toetsen zou een
     herijking doorlaten die de voorziening wel afvangt en de ijkoproep niet. */
  assert.equal(a.onderwerpen, 1,
    'de gemeten oproep deed EEN schrijfactie; staat hier 2, dan telt de ijkoproep nog mee');
});

test('2b. de pasladder-ijkoproep is GEEN lek: dezelfde route, dus hetzelfde effect', async () => {
  /* DEZE TOETS STOND ER OMGEKEERD IN, en dat was mijn eigen fout (14 september 2026).
     Hij eiste dat de herijking ook de pasladder-ijkoproep wegstreepte -- ik had de
     scheidslijn verkeerd getrokken.

     De herijking bestaat om werk weg te houden dat de proef zelf deed AAN EEN ANDERE
     ROUTE. De voorziening doet dat (zij maakt met /api/pay/verzoek een klompje en
     daarna wordt /api/pay/verzoek/intrek gemeten), en daar hoort zij dus te blijven.
     De pasladder-ijkoproep stuurt hetzelfde lijf naar DEZELFDE route om te zien welke
     pas erdoor komt: wat die verandert, verandert deze handeling -- alleen een oproep
     eerder.

     WAT DE OMGEKEERDE REGEL KOSTTE. /api/member/ai/tegoed is idempotent per lid: de
     eerste oproep maakt de tegoedregel aan, de volgende niet meer. Met een herijking na
     de ijkoproep deed die oproep het werk, werd het weggestreept, en kwam er
     `opslag: {}` uit de meting -- terwijl de ronde van main er `aiTegoed: 1` had. De
     afleidingslaag verloor daarmee haar tweede bron, en test/effectdekking.test.js
     toets 2 zakte erop. Een reparatie die een echt effect onzichtbaar maakt, is erger
     dan de fout die zij opruimde.

     Dus: zonder voorziening hoort `a` het werk van de ijkoproep TE DRAGEN, met of
     zonder herijk. Zet de herijking terug na de pasladder en deze toets zakt. */
  const zonder = await draai({ metHerijk: false, metVoorziening: false });
  assert.equal((zonder.a || {}).onderwerpen, 2,
    'de nulmeting klopt niet: de ijkoproep en de gemeten oproep raken dezelfde route');
  const met = await draai({ metHerijk: true, metVoorziening: false });
  assert.equal((met.a || {}).onderwerpen, 2,
    'de herijking streept de ijkoproep weg, en die raakt DEZELFDE route -- dan verdwijnt ' +
    'het effect van de gemeten handeling zelf uit `a`');
  assert.deepStrictEqual(Object.keys(met.a || {}).sort(), ['onderwerpen'],
    'zonder voorziening hoort er niets anders in `a` te staan');
});

test('3. de herijking VERZINT niets: wat de handeling wel doet, blijft staan', async () => {
  /* De gevaarlijkste faalvorm van een reparatie als deze is niet dat zij te weinig
     wegneemt maar te veel: een herijking die ook na de GEMETEN oproep zou schuiven,
     maakt elk vak leeg en dan lijkt elke route "raakt niets aan". Dat is de valse nul
     waar kern/stuur/gevolg.js in zijn eigen kop tegen waarschuwt. */
  const opslag = await draai({ metHerijk: true });
  assert.ok(Object.keys(opslag.a || {}).length > 0,
    'na de herijking is `a` helemaal leeg -- dan is de reparatie doorgeschoten en leest ' +
    'elke route als "verandert niets", wat erger is dan de fout zelf');
});

test('4. een verse inlog ONDERWEG wordt niet aan de route toegerekend', async () => {
  /* DE VIERDE WEG WAARLANGS VREEMD WERK IN `opslag.a` KOMT, en de eerste die niet uit
     het voorwerk van de route komt maar uit de opstelling: verloopt een token, dan logt
     de proef opnieuw in en doet de oproep over. Die inlog schrijft.

     GEMETEN op 14 september 2026 (wegwerpserver, RTG_STAATLOG=2, ruis geijkt op een
     leesroute): /api/login geeft {"sessions":1} en /api/auth/login -- de keten die een
     eigenrol nodig heeft -- {"securityLog":2,"sessiecontext":1,"foundation":2}. Geen van
     de vier staat in de ruislijst.

     WAT HET KOSTTE. `sessions` is in server/kern/isolatie/effectcollecties.js ingedeeld
     als IDENTITEIT_WIJZIGEN, en de ronde van 14 september droeg hem op acht routes --
     waarvan er EEN (/api/logout) hem werkelijk schrijft. /api/mall en vijf
     rtfos-routes "wijzigden identiteit" omdat de proef er tussendoor opnieuw had
     ingelogd. Dat is geen ruis in een teller maar een verzonnen effect in de laag die
     over bevoegdheid gaat. */
  const zonder = await draai({ metHerijk: true, metVoorziening: false, metDoodToken: true, metNaInlog: false });
  assert.ok(Object.keys(zonder.a || {}).includes('sessions'),
    'de nulmeting klopt niet: zonder herijking na de inlog hoort `sessions` juist WEL in ' +
    '`a` te staan, en hier staat: ' + Object.keys(zonder.a || {}).join(', '));

  const met = await draai({ metHerijk: true, metVoorziening: false, metDoodToken: true, metNaInlog: true });
  assert.deepStrictEqual(Object.keys(met.a || {}).sort(), ['onderwerpen'],
    'na de herijking hoort er van de inlog niets meer in `a` te staan; gevonden: ' +
    Object.keys(met.a || {}).join(', '));

  /* EN HET WERK VAN DE ROUTE ZELF BLIJFT STAAN -- dezelfde valkuil als in toets 3: een
     zeef die te veel wegneemt, maakt van een schrijfroute een route die niets doet.
     TWEE, want de pasladder-ijkoproep raakt dezelfde route (toets 2b), en juist dat is
     de reden dat hier de NAMEN van de inlog worden weggelaten en niet het IJKPUNT wordt
     opgeschoven. Nagemeten met een opgeschoven ijkpunt: dan staat hier 1, en op
     /api/member/ai/tegoed -- idempotent per lid -- blijft er `{}` over. */
  assert.equal((met.a || {}).onderwerpen, 2,
    'de ijkoproep en de herhaalde oproep raken allebei deze route; staat hier minder, ' +
    'dan neemt de zeef het effect van de handeling zelf mee');

  /* EN DE WEGLATING STAAT IN HET REGISTER. Een zeef die stil wegvangt, is niet na te
     lopen: wie de opslag van zo'n route leest, hoort te zien dat er een inlog tussendoor
     kwam en welke namen daarbij zijn weggelaten. */
  assert.deepStrictEqual(met.inlogOnderweg, ['sessions'],
    'de route hoort te melden dat er onderweg is ingelogd en welke collecties dat raakte');
  assert.equal(zonder.inlogOnderweg, undefined,
    'zonder de zeef valt er niets weg en hoort er dus ook niets gemeld te worden');
});
