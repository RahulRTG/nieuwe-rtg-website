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
async function draai({ metHerijk, metVoorziening = true }) {
  const w = maakWereld();
  const PAD = '/api/proef/intrek';

  /* De gemeten route WIJZIGT alleen zijn onderwerp; hij maakt niets aan. Dat is de
     hele aanname die de toerekening moet respecteren. */
  const post = async (pad) => {
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

  const uit = await draaiIdemproef({
    post, routes: [{ methode: 'POST', pad: PAD, rol: 'member' }],
    tokenVoor: () => 'token', lijfVoor: () => ({}), staatVan, herijk,
    metenZonderSleutel: false, pasladder: ['member', 'lifestyle'],
    /* DE VOORZIENING SCHRIJFT, net als in het echt: zij maakt het onderwerp aan en
       raakt daarbij twee collecties die de gemeten route zelf nooit aanraakt. */
    voorzieningVoor: !metVoorziening ? null
      : (pad) => (pad === PAD ? (async ({ post: p }) => { await p('/api/proef/maak', {}, 'token'); return { id: 'x1' }; }) : null)
  });
  /* De sleutel is "POST <pad>" en niet het pad alleen -- dat kostte de eerste versie
     van deze toets drie valse rode lampjes. */
  return (uit.perRoute['POST ' + PAD] || {}).opslag || {};
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

test('2b. ZONDER voorziening is de pasladder-ijkoproep de ENIGE lek, en hij wordt gedekt', async () => {
  /* DEZE TOETS IS ER OMDAT EEN MUTATIE HEM AFDWONG, en dat hoort hier te staan.

     Toets 2 hierboven dekt de voorziening, maar hij dekte de PASLADDER niet: haal de
     herijking na de ijkoproep weg en toets 2 bleef groen. De reden is dat de
     voorziening LATER herijkt en daarmee ook het werk van de ijkoproep absorbeert --
     zolang er een voorziening IS. De meeste routes hebben er geen, en daar is de
     ijkoproep de enige lek.

     Dus: dezelfde proef zonder voorziening. Zonder herijk staat `onderwerpen` op twee
     (de ijkoproep plus de gemeten oproep), met herijk op een. */
  const zonder = await draai({ metHerijk: false, metVoorziening: false });
  assert.equal((zonder.a || {}).onderwerpen, 2,
    'de nulmeting klopt niet: zonder herijk hoort de ijkoproep mee te tellen');
  const met = await draai({ metHerijk: true, metVoorziening: false });
  assert.equal((met.a || {}).onderwerpen, 1,
    'de ijkoproep telt nog mee in `a`; de herijking na de pasladder ontbreekt of hangt ' +
    'op de verkeerde plek (een voorziening kan hem maskeren, maar die is er hier niet)');
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
