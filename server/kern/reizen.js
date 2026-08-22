/* DE REIS -- fase 1 van REIZEN.md: één reis als één ding.

   WAT DIT IS. `kern/reiswereld.js` levert uw komende reis als losse regels: een
   verblijf, een vlucht, een aangevraagde reis. Dat is een register, en een
   register beantwoordt niet de vraag die een reiziger stelt -- die vraagt niet
   "welke regels heb ik" maar "hoe staat mijn reis naar Dubai ervoor". Deze laag
   groepeert die regels tot Reizen.

   DE KERN-NAAM IS `mijnReizen`, en dat is een reparatie met een les. Deze
   module heette in de kern eerst `reizen` -- maar die naam BESTOND al: het
   reisboek van de Rechterhand exporteert een functie `reizen(key)` naar
   dezelfde kern (rechterhand/reisboek.js), en de latere kernlaag overschreef
   hem stil. Drie toetsen ver weg van hier (het reisboek gaf 500) vingen het;
   niets dichterbij deed dat, want een Object.assign op de kern klaagt niet
   over een bestaande sleutel. Wie een kern-naam kiest: grep eerst of hij al
   bestaat. `mijnReizen` volgt de vorm van `mijnVerblijven` -- een functie van
   key naar de eigen rijen.

   WAT DIT NIET IS, en niet mag worden (REIZEN.md par. 2.1 en 4.1): een tweede
   boekingsadministratie. DE REIS BEZIT GEEN BOEKING; hij bezit een verwijzing,
   een voornemen en een bewijs. Er wordt hier niets geschreven, niets bewaard en
   niets opgeteld wat een domein al optelt. De domeinen worden ook niet zelf
   gelezen: de ENIGE bron is `reiswereld.komend()`, want anders is er een tweede
   plek die weet wat er in uw agenda staat (LAT-regel 4).

   DE GROEPERINGSREGEL, en waarom hij zo voorzichtig is. Twee reizen ten onrechte
   samenvoegen is veel erger dan ze uit elkaar laten staan: een reiziger die één
   reis ziet waar er twee zijn, mist het vertrek van de tweede. Vandaar: BIJ
   TWIJFEL NIET SAMENVOEGEN. Een regel hoort bij een Reis als hij DEZELFDE
   BESTEMMING draagt én binnen het venster valt (met een dag speling aan beide
   kanten, want een transfer landt de dag ervoor en een verblijf eindigt op de
   vertrekdag). Past een regel bij meer dan één Reis, of mist hij een datum, een
   bestemming of een herkomst, dan wordt hij NIET geplaatst maar losgelegd -- met
   de reden erbij. Stil overslaan zou hier het ergst mogelijke zijn: dan is de
   reis compleet in beeld terwijl er een stuk ontbreekt (LAT-regel 5).

   EN DAAROM IN TWEE RONDEN, wat de eerste opzet niet deed. Die liep de regels
   één keer op datum af en liet elke geplaatste regel het venster oprekken. Een
   toets legde bloot wat dat aanricht: twee verblijven in Dubai (de 30e t/m de
   33e en de 35e t/m de 38e) zijn twee reizen, maar een vlucht op de 34e paste
   met zijn speling op de eerste, rekte die op tot de 34e, en daarna paste het
   tweede verblijf er ook in. Eén regel ertussen LIJMDE twee reizen aan elkaar --
   precies de fout die deze module moet uitsluiten, en de gretigste vorm ervan:
   hij ontstaat juist als er iets tussen zit.

   Nu eerst de ANKERS: regels die een eigen venster dragen (een verblijf van de
   30e tot de 33e). Die vormen het geraamte. Daarna staan de vensters VAST, en
   worden de PUNTEN (een vlucht, een charter, een reisaanvraag -- alles met één
   datum) daartegen gelegd. Past een punt in precies één venster, dan hoort het
   daarbij; past het in twee, dan wordt het losgelegd in plaats van in de eerste
   de beste geduwd. Wat nergens in past, vormt zijn eigen reis: een losse vlucht
   is ook een reis.

   Dat losleggen is dezelfde vorm die de Mall-normalisator al heeft: een bron die
   een half object levert wordt geweigerd, en die weigering reist mee terug
   (`kern/mall/aanbod.js`).

   WAT DEZE LAAG VANDAAG NIET KAN, opgeschreven zodat niemand het voor vergeten
   aanziet (LAT-regel 6). Een terugvlucht herkennen kan hij niet, want het
   vluchtdomein kent geen vertrekpunt -- een boeking bestaat daar alleen op een
   vertrek vanaf de eigen luchthaven (`kern/luchthaven/vluchten.js`: boeken op
   een aankomst geeft 404). Zodra er retourvluchten bestaan, heeft een regel een
   RICHTING nodig; hem hier raden uit "de datum lijkt op het einde van de reis"
   is precies het soort gok waar deze module niet voor is. */
'use strict';

/* Wat een Reis is als hij af is -- de naam, het venster, het signaal, de grond
   -- staat in ./reizen-vorm.js. Hier staat alleen hoe de regels verdeeld
   worden; dat zijn twee vragen en geen een. */
const { HERKOMSTEN, woorden, zelfdePlaats, afmaken } = require('./reizen-vorm');

const DAG = 86400000;
const MARGE = 1;                                  // dag speling aan beide kanten

function schuif(datum, dagen) {
  const t = Date.parse(String(datum || '') + 'T00:00:00Z');
  return isNaN(t) ? null : new Date(t + dagen * DAG).toISOString().slice(0, 10);
}

module.exports.maakReizen = ({ kern }) => {

  const nieuweReis = (r) => ({
    bestemming: r.bestemming,
    venster: { van: r.van, tot: r.tot || r.van },
    onderdelen: [r]
  });

  /* Twee vensters die elkaar raken (met speling) horen bij elkaar: een gast die
     op de vertrekdag naar een ander huis verhuist, maakt geen tweede reis. */
  function past(reis, r) {
    if (!zelfdePlaats(reis.bestemming, r.bestemming)) return false;
    const van = r.van, tot = r.tot || r.van;
    return van <= schuif(reis.venster.tot, MARGE) && tot >= schuif(reis.venster.van, -MARGE);
  }

  /* Een punt tegen een VASTGEZET venster. Met opzet een andere vraag dan
     hierboven: een punt mag ergens in vallen, maar het venster van een reis
     niet oprekken zolang de andere punten nog verdeeld moeten worden -- anders
     lijmt het eerste punt de reis erachter eraan vast. */
  function binnenVenster(venster, plaats, r) {
    return zelfdePlaats(plaats, r.bestemming)
      && r.van >= schuif(venster.van, -MARGE) && r.van <= schuif(venster.tot, MARGE);
  }

  function voegToe(reis, r) {
    reis.onderdelen.push(r);
    if (r.van < reis.venster.van) reis.venster.van = r.van;
    const tot = r.tot || r.van;
    if (tot > reis.venster.tot) reis.venster.tot = tot;
  }

  function mijn(key) {
    const w = kern.reiswereld.komend(key) || {};
    const reizen = [], los = [];
    const leg = (r, reden) => los.push({ onderdeel: r, reden });

    /* Eerst weigeren wat niet te plaatsen is. Een regel zonder datum,
       bestemming of geldige herkomst hoort nergens bij -- en dat hoort te
       blijken, niet te verdwijnen. */
    const goed = [];
    for (const r of (w.komend || [])) {
      if (!r.van) leg(r, 'geen datum bekend');
      else if (!r.bestemming) leg(r, 'geen bestemming bekend');
      else if (!HERKOMSTEN.includes(r.herkomst)) leg(r, 'onbekende herkomst');
      else goed.push(r);
    }

    // ronde 1: de ankers -- alles met een eigen venster -- vormen het geraamte
    const anker = (r) => !!r.tot && r.tot > r.van;
    for (const r of goed.filter(anker)) {
      const passend = reizen.filter(x => past(x, r));
      if (!passend.length) reizen.push(nieuweReis(r));
      else if (passend.length > 1) leg(r, 'past bij meer dan één reis');
      else voegToe(passend[0], r);
    }

    /* De vensters staan nu vast. Ze worden apart bewaard omdat `voegToe`
       hieronder het venster van de reis wél bijwerkt (een vlucht de dag ervoor
       hoort erbij, en dan begint de reis die dag) -- maar de VERDELING van de
       punten gebeurt tegen het geraamte, zodat de volgorde van de punten de
       uitkomst niet bepaalt. */
    const vast = reizen.map(x => ({ bestemming: x.bestemming, venster: { van: x.venster.van, tot: x.venster.tot } }));
    const rest = [];
    for (const r of goed.filter(x => !anker(x))) {
      const idx = vast.map((v, i) => (binnenVenster(v.venster, v.bestemming, r) ? i : -1)).filter(i => i >= 0);
      if (idx.length === 1) voegToe(reizen[idx[0]], r);
      else if (idx.length > 1) leg(r, 'past bij meer dan één reis');
      else rest.push(r);
    }

    /* Wat in geen enkel geraamte paste, vormt onderling reizen: drie vluchten
       naar Ibiza in dezelfde week zijn één reis, ook zonder hotel erbij. Hier
       kan geen lijmfout meer ontstaan -- er is geen venster om te overbruggen. */
    for (const r of rest) {
      const passend = reizen.filter(x => past(x, r));
      if (!passend.length) reizen.push(nieuweReis(r));
      else if (passend.length > 1) leg(r, 'past bij meer dan één reis');
      else voegToe(passend[0], r);
    }

    return {
      ok: true,
      reizen: reizen.map(afmaken),
      /* Wat niet geplaatst kon worden, met de reden -- en niet weggelaten. */
      los,
      /* Doorgegeven en niet opnieuw bedacht: het oordeel over deze rij (de
         stand, de telling) is van de wereld, en welke bron stilviel weet alleen
         zij. Een reis die een bron mist ziet er compleet uit terwijl hij het
         niet is; dat mag hier niet stoppen. Hier iets van naderekenen zou een
         tweede oordeel opleveren over dezelfde regels (LAT-regel 4). */
      stand: w.stand,
      telling: w.telling,
      stil: w.stil || [],
      bronnen: w.bronnen || []
    };
  }

  return { mijnReizen: mijn };
};
