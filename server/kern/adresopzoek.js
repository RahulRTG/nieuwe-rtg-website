/* Kern-module "adresopzoek": postcode en huisnummer erin, straat, woonplaats en
   land eruit.

   WAAROM DIT ER IS. Sinds de velden een moment dragen (kern/onboarding.js) vraagt
   de intake geen adres meer. Er is nog precies EEN plek waar het wel gevraagd mag
   worden: de adresstap van de gegevenspoort, als er echt iemand langskomt
   (kern/gegevensgesprek.js, soort 'bezorging'). Daar staat de vraag "straat,
   huisnummer, postcode en plaats" -- en drie van die vier zijn af te leiden uit
   de twee die je toch al geeft. Geen extra vraag dus, een kortere.

   DIT BESTAND IS DE OPZOEKER: de cache, het bronbudget en de meldingen. Wat er
   de deur uit gaat en wat er terugkomt staat in ./adresopzoek/vertaling.js --
   dat is pure vertaling zonder net of klok, en daar staat ook waarom de vraag
   niet meer dan een postcode en een huisnummer draagt en waarom de fuzzy
   zoekmachine van PDOK op beide wordt nagerekend.

   WAT ER TERUGKOMT IS EEN VOORSTEL, GEEN OPSLAG: deze module schrijft niets weg.
   Wat de bron zegt hoort op het scherm te staan en bevestigd te worden voordat
   het ergens landt. De bron is de PDOK Locatieserver (open data van het Kadaster,
   gratis en zonder sleutel); die kent alleen Nederlandse adressen, dus een
   buitenlandse postcode krijgt een eerlijk "die ken ik niet" en geen gok.

   FALEN IS EEN ANTWOORD, GEEN FOUT. Geen internet, een 500, een postcode die niet
   bestaat: alle drie gevonden:false met een reden en een zin die een mens iets
   zegt. Deze module gooit nooit: een korte tijdgrens en GEEN herhaling. Dat
   tweede is niet alleen vriendelijkheid -- magNaarBuiten() telt aanroepen en geen
   HTTP-pogingen, dus met herhaling aan zou het budget van zestig stilletjes
   honderdtachtig worden. Toets 11 leest beide opties na.

   MAAR ZWIJGEN DOET HIJ NIET (LAT.md regel 5). Elke uitzondering en elk niet-200
   antwoord gaat via `meld` naar de fout-aggregatie van het techniekbord
   (server/log.js); `tellingen()` houdt de uitslagen bij. Dat dekt ook het stille
   geval: hernoemt PDOK ooit een veld, dan komen er docs terug zonder straat of
   woonplaats -- geen onbekend adres maar een defect bij ons. */
'use strict';
const { Cache } = require('../lib/cache');
const { BASIS, TEKSTEN, NAAR_BUITEN, normaliseerPostcode, normaliseerHuisnummer,
  bouwVraag, leesAntwoord } = require('./adresopzoek/vertaling');

const TIMEOUT_MS = 2000;                       // korte grens: dit staat voor een typend mens
const TTL_GEVONDEN = 24 * 60 * 60 * 1000;      // een straatnaam verhuist niet
const TTL_ONBEKEND = 10 * 60 * 1000;           // een typefout mag zo weer weg zijn
const BUDGET_PER_MINUUT = 60;                  // zie magNaarBuiten()

function maakAdresopzoek({ http, cache, env, nu, meld } = {}) {
  const client = http || require('../lib/http');
  const doos = cache || new Cache({ ttl: TTL_GEVONDEN, max: 500 });
  const omgeving = env || process.env;
  const klok = nu || Date.now;
  /* Luid falen (LAT.md regel 5) langs dezelfde weg als de rest van het huis, dus
     de fout-aggregatie van het techniekbord ziet hem ook. */
  const melder = meld || ((e, ctx) => require('../log').log.uitzondering(e, ctx));
  const telling = { gevonden: 0, onbekend: 0, onbereikbaar: 0, gemeld: 0 };
  let vensterVanaf = 0, verbruikt = 0;

  // RTG_ADRESOPZOEK=uit: de app gedraagt zich alsof de opzoeker niets weet.
  const staatUit = () => String(omgeving.RTG_ADRESOPZOEK || '').toLowerCase() === 'uit';

  /* De rem die aan het DOEL hangt en niet aan de aanvrager (LAT.md regel 7).
     De route heeft ook een rem per lid, maar een account kost hier een
     e-mailadres, dus wie er tien maakt koopt tien keer die rem. PDOK is een
     gratis dienst van een ander; dit proces vraagt er nooit meer dan een vaste
     hoeveelheid per minuut, hoeveel leden er ook tegelijk typen. */
  function magNaarBuiten() {
    const nuMs = klok();
    if (nuMs - vensterVanaf > 60000) { vensterVanaf = nuMs; verbruikt = 0; }
    if (verbruikt >= BUDGET_PER_MINUUT) return false;
    verbruikt += 1;
    return true;
  }

  function stoor(bericht, extra) {
    telling.gemeld += 1;
    try { melder(new Error(bericht), Object.assign({ bron: 'adresopzoek' }, extra || {})); } catch (e) {}
  }

  /* Het antwoord zoals het de module verlaat: alleen de velden uit NAAR_BUITEN,
     met de zin erbij als het niet gelukt is. */
  function antwoord(r) {
    const uit = {};
    for (const veld of NAAR_BUITEN) if (r[veld] !== undefined) uit[veld] = r[veld];
    if (!r.gevonden) uit.tekst = TEKSTEN[r.reden] || TEKSTEN.onbekend;
    return uit;
  }

  async function zoek(vraag) {
    if (staatUit()) return antwoord({ gevonden: false, reden: 'uit' });
    const pc = normaliseerPostcode(vraag && vraag.postcode);
    if (!pc.ok) return antwoord({ gevonden: false, reden: pc.reden });
    const hn = normaliseerHuisnummer(vraag && vraag.huisnummer);
    if (!hn.ok) return antwoord({ gevonden: false, reden: hn.reden });

    const sleutel = pc.postcode + ' ' + hn.tekst;
    const bekend = doos.haal(sleutel);
    if (bekend) return antwoord(bekend);
    if (!magNaarBuiten()) return antwoord({ gevonden: false, reden: 'druk' });

    let uitslag;
    try {
      const r = await client.vraag({
        url: bouwVraag(omgeving.RTG_ADRESOPZOEK_BASIS, pc.postcode, hn.tekst),
        method: 'GET', timeout: TIMEOUT_MS, maxRetries: 0, headers: { accept: 'application/json' }
      });
      if (r.status === 200) {
        uitslag = leesAntwoord(JSON.parse(r.tekst), { postcode: pc.postcode, nummer: hn.nummer });
        // de bron antwoordde, maar niet in de vorm waar wij op rekenen
        if (uitslag.bronVreemd) stoor('adressenbron gaf een adres zonder straat of woonplaats', { status: 200 });
      } else {
        uitslag = { gevonden: false, reden: 'onbereikbaar' };
        stoor('adressenbron antwoordde met status ' + r.status, { status: r.status });
      }
    } catch (e) {
      /* Geen net, een tijdgrens of onleesbare JSON: voor de gebruiker alle drie
         hetzelfde antwoord, maar niet alle drie hetzelfde zwijgen. Een opzoeker
         die stilletjes stuk is, laat elk lid weer met de hand typen zonder dat
         iemand het merkt -- dus gaat hij hier luid de deur uit. */
      uitslag = { gevonden: false, reden: 'onbereikbaar' };
      stoor('adressenbron onbereikbaar: ' + ((e && e.message) || e), { code: e && e.code });
    }
    telling[uitslag.gevonden ? 'gevonden' : uitslag.reden] += 1;
    /* Een storing bewaren we NIET: dan zou een minuut zonder net een dag lang
       "onbereikbaar" blijven zeggen. Een gevonden adres en een adres dat echt
       niet bestaat zijn wel de moeite waard, elk met hun eigen houdbaarheid.
       (Toets 12 draait dit om met een tweede, geslaagde vraag.) */
    if (uitslag.gevonden) doos.zet(sleutel, uitslag, TTL_GEVONDEN);
    else if (uitslag.reden === 'onbekend' && !uitslag.bronVreemd) doos.zet(sleutel, uitslag, TTL_ONBEKEND);
    return antwoord(uitslag);
  }

  return { zoek, cache: doos, staatUit, tellingen: () => Object.assign({}, telling), TEKSTEN };
}

module.exports = { maakAdresopzoek, TIMEOUT_MS, BUDGET_PER_MINUUT };
