/* RTG Wereld -- RAHUL MET DRIE LENZEN: `ai.netwerk`, `ai.recruiter` en
   `ai.sales`.

   DEZELFDE REGEL ALS OVERAL IN DIT HUIS: de AI stelt voor, de mens beslist en
   verstuurt. Er is hier geen enkele weg waarop een model zelf iemand benadert,
   iets in een lijst zet of een bericht plaatst. Alle drie de lenzen geven TEKST
   terug; wat je ermee doet is jouw handeling, met jouw naam eronder.

   EN EEN VIERDE LENS IS ER BEWUST NIET. In rechten.js stond ook `ai.loopbaan`,
   maar dat bestaat allang: kern/metier/ai.js is Rahul als loopbaancoach
   (profielkritiek, sollicitatiebrief, oefengesprek) en die is er voor ELK lid,
   zonder pas. Hem hier achter Lifestyle herhalen zou twee dingen fout doen: een
   tweede implementatie van hetzelfde (regel 4), en een gratis functie achter
   een betaalde deur zetten. De naam is daarom uit rechten.js gehaald.

   WAT DE LENZEN DELEN, en dat is meer dan gemak: ze werken UITSLUITEND op
   gegevens die deze gebruiker zelf al mag zien. Het zoekresultaat komt uit
   kern/wereld/netwerk.js (dat de zichtbaarheid per veld toepast), de
   introducties uit dezelfde graaf, en het bereik uit je eigen posts. Er gaat
   dus nooit een veld naar het model dat de gebruiker zelf niet op zijn scherm
   had kunnen lezen. Dat is de enige manier waarop "vraag het aan Rahul" geen
   achterdeur om de zichtbaarheid heen wordt.

   ALLES OP CODENAAM. Er gaat geen sleutel en geen echte naam de opdracht in.
   Als het model iemand noemt, noemt het een codenaam -- net als het scherm. */
'use strict';

const { tekst } = require('../../ai-kort');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Schrijf rustig, zeker en zonder ' +
  'opsmuk: geen uitroeptekens, geen verkooppraat, geen vleierij. Antwoord in het Nederlands. ' +
  'Je krijgt uitsluitend gegevens die deze gebruiker zelf mag zien; verzin er NIETS bij -- geen ' +
  'namen, geen bedrijven, geen cijfers. Staat iets er niet, zeg dan dat je het niet weet. ' +
  'Mensen heten hier bij hun CODENAAM; gebruik die en vraag nooit om een echte naam. ' +
  'Je benadert zelf niemand en je belooft nooit een baan, een opdracht of toegang tot een pas.';

const geenAI = { status: 503, error: 'Rahul is nu niet bereikbaar. Probeer het zo nog eens.' };

module.exports = ({ anthropic, netwerk, inzicht, codenaamVan }) => {

  /* De drie lenzen. Elk krijgt zijn eigen opdracht EN zijn eigen gegevens; ze
     staan als tabel zodat er geen drie bijna-gelijke functies ontstaan die
     langzaam uit elkaar lopen. `stof` levert wat het model te zien krijgt --
     altijd via de zichtbaarheidslaag, nooit rechtstreeks uit de opslag. */
  const LENZEN = {
    netwerk: {
      /* `ai.netwerk` en niet `netwerk.analyse`: dat tweede is de KALE vraag
         (wie kan mij introduceren, een som op de graaf), dit is Rahul die
         erover meedenkt. Twee vermogens, twee dingen -- ze door elkaar halen
         zou betekenen dat de ene naam de andere stil overneemt. */
      vermogen: 'ai.netwerk',
      opdracht: 'Je helpt iemand nadenken over zijn netwerk. Noem hooguit drie mensen die ' +
        'het meest de moeite waard lijken om deze maand te spreken, met per persoon EEN zin ' +
        'waarom, gebaseerd op wat er staat. Wie geen gedeelde connectie heeft, noem je alleen ' +
        'als er inhoudelijk een reden is. Geef geen openingszin en geen script.',
      stof: (key, invoer, tierVan) => {
        const uit = netwerk.zoek(key, { q: String(invoer.q || ''), hoeveel: 12 }, tierVan);
        return uit.treffers.map(t => ({
          codenaam: t.codenaam,
          over: t.velden.map(v => v.pad + ': ' + kort(v.waarde)).join('; '),
          gedeeldeConnecties: t.gedeeld, via: t.via
        }));
      }
    },
    recruiter: {
      vermogen: 'ai.recruiter',
      opdracht: 'Je helpt een werkgever kijken naar mensen die op zijn zoekopdracht passen. ' +
        'Zeg per persoon in EEN zin wat er in het profiel op de vraag aansluit, en zeg er ' +
        'eerlijk bij wat er NIET uit blijkt. Sluit af met wat je nog zou willen weten. ' +
        'Beoordeel niemand op iets wat er niet staat, en rangschik geen mensen op geschiktheid.',
      stof: (key, invoer, tierVan) => {
        const uit = netwerk.zoek(key, { q: String(invoer.q || ''), vaardigheid: invoer.vaardigheid || '',
          plaats: invoer.plaats || '', hoeveel: 12 }, tierVan);
        return uit.treffers.map(t => ({
          codenaam: t.codenaam,
          over: t.velden.map(v => v.pad + ': ' + kort(v.waarde)).join('; '),
          gedeeldeConnecties: t.gedeeld
        }));
      }
    },
    sales: {
      vermogen: 'ai.sales',
      opdracht: 'Je helpt iemand zien welke ondernemingen binnen zijn bereik interessant kunnen ' +
        'zijn. Werk met wat er staat: open vacatures en geplaatste kansen zeggen iets over waar ' +
        'een zaak mee bezig is. Noem per zaak EEN reden en zeg erbij wat we NIET weten ' +
        '(omzet, omvang, groei staan niet in onze gegevens). Schrijf geen verkoopmail.',
      stof: (key, invoer) => {
        const r = inzicht.bedrijf(String(invoer.q || ''), invoer._vacatures);
        return r.error ? [] : r.treffers;
      }
    }
  };

  const kort = (w) => {
    if (w === null || w === undefined) return '';
    if (Array.isArray(w)) return w.map(x => (x && typeof x === 'object')
      ? (x.naam || x.handle || x.platform || '') : String(x)).filter(Boolean).join(', ');
    return String(w).slice(0, 200);
  };

  /* Een lens draaien. Geeft ALTIJD terug wat het model te zien kreeg (`stof`),
     en dat is geen extraatje: een antwoord waarvan je de grond niet kunt
     nakijken, is een orakel. Zo kan het scherm naast het advies laten staan
     waarop het is gebaseerd -- en de gebruiker ziet meteen dat er niets bij is
     verzonnen. */
  async function vraag(lensNaam, key, invoer, tierVan) {
    const lens = LENZEN[lensNaam];
    if (!lens) return { status: 400, error: 'Deze vraag ken ik niet.' };

    const stof = lens.stof(key, invoer || {}, tierVan) || [];
    if (!stof.length) {
      /* Geen gegevens is geen storing, en ook geen reden om het model iets te
         laten verzinnen: we zeggen gewoon dat er niets is (LAT-regel 5). */
      return { ok: true, lens: lensNaam, stof: [], antwoord: null,
        leeg: 'Ik vind hier niets om iets zinnigs over te zeggen. Zoek eerst iets op, of verruim je vraag.' };
    }

    const t = await tekst(anthropic, TOON + ' ' + lens.opdracht,
      'De vraag van de gebruiker: ' + String((invoer || {}).q || '(geen)') + '\n\n' +
      'De gegevens die hij mag zien:\n' + JSON.stringify(stof, null, 1),
      { max: 700 });
    if (!t) return { ...geenAI, lens: lensNaam, stof };
    return { ok: true, lens: lensNaam, stof, antwoord: t };
  }

  return { LENZEN, vraag };
};
