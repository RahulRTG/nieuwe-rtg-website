/* Sociale graaf, deelbestand "lijn": de momentlijn (LIFE.md fase 4).

   LEVEN IN PLAATS VAN POSTS. Een sociale app toont een stroom berichten,
   nieuwste eerst, en die stroom houdt nooit op. Deze lijn toont iets anders:
   wat er in uw leven aankomt, in de tijdvakken waarin een mens denkt. Vandaag.
   Morgen. Vrijdag. Volgende week. Deze maand. September.

   DE HORIZON IS EEN BESLUIT EN GEEN BIJWERKING VAN DE KALENDER, en dat was hij
   wel. De ladder eindigde op "deze maand", en die krimpt: op de derde van de
   maand reikt hij dertig dagen vooruit, op de vijfentwintigste nog vijf. Alles
   daarachter viel in `later`, en `later` is een telling en geen vak. Dus:

     op 3 augustus zag je een afspraak op 20 augustus;
     op 25 augustus zag je een afspraak op 8 september NIET.

   Dezelfde afstand -- veertien dagen -- en toch een ander antwoord, puur omdat
   er toevallig een maandgrens tussen lag. Voor wie de lijn leest is dat niet
   uit te leggen: zijn eigen horizon zwabberde tussen een week en vijf weken,
   zonder dat iemand daarvoor had gekozen.

   Nu staat er wel een keuze: VIJF WEKEN (`HORIZON_DAGEN`). Dat is de afstand
   waarop een mens nog vooruit plant -- "over twee weken", "over een maand" --
   en hij overspant hooguit twee maandgrenzen, dus de ladder blijft kort. Wat
   binnen de horizon valt en niet meer in deze maand past, krijgt de NAAM van
   zijn maand ("September"), want zo zegt een mens het ook. Wat erbuiten valt,
   blijft een telling.

   HIJ HAALT NIETS OP, EN DAT IS DE HELE OPZET. De bronnen staan in ./bronnen.js
   en de termijnen komen uit de Control Tower; deze laag krijgt het BEELD van de
   graaf mee en hergroepeert het. Zou hij zelf gaan verzamelen, dan bestaan er
   twee plekken die dezelfde negen domeinen uitlezen, en dan lopen ze uiteen
   zonder dat iets klaagt (LAT.md regel 4). De lijn is een LEZING, geen tweede
   graaf.

   HET VERSCHIL MET DE GRAAF, in een zin: de graaf sorteert op WIE ER WACHT, de
   lijn op WANNEER HET IS. Dat zijn twee echte vragen -- "wat moet ik doen" en
   "hoe ziet mijn week eruit" -- en ze verdienen twee ordeningen. Ze samenvoegen
   tot een lijst zou van allebei de helft maken.

   WAT ER BEWUST NIET IN ZIT:

     GEEN VERLEDEN VERDER DAN VANDAAG. Wat gisteren was, is geschiedenis, en een
     lijn die achteruit blijft groeien is een archief -- of erger, een feed. Wat
     vandaag al gebeurd is blijft staan tot de dag om is, want dat hoort nog bij
     vandaag.

     GEEN LEGE VAKKEN. Een week zonder afspraken is geen gat om op te vullen.
     Hetzelfde besluit als de levenslijn van RTFoundation (LEVEN.md par. 1.1):
     een leeg vak leest als iets dat u mist.

     GEEN AFTELLER. Geen "nog 3 dagen", geen "bijna", geen badge op een vak. Dat
     is de taal van kunstmatige urgentie die CLAUDE.md verbiedt, en op het leven
     tussen mensen is hij bovendien onwaar: een verjaardag over twee weken is
     geen deadline.

     GEEN ONEINDIGE STAART. `later` is een TELLING en geen lijst. Wie alles wil
     zien, opent de app die het bijhoudt. */
'use strict';

const { vandaag, isDatum } = require('./hulp');

/* De weekdagen, voor de vakken binnen deze week. Nederlandse namen, want dit is
   schermtaal; de sleutel blijft machineleesbaar. */
const WD = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

/* De maandnamen, voor de vakken voorbij deze maand. Schermtaal, net als WD --
   en met opzet zonder jaartal: binnen vijf weken is "September" niet dubbelzinnig,
   en een jaartal in een vaklabel zou een getal zijn waar er geen hoort. */
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/* HOE VER DE LIJN VOORUIT KIJKT. Vijf weken: ver genoeg voor "over twee weken"
   en "over een maand", kort genoeg om geen archief te worden. Verander je dit
   getal, dan verandert wat een lid van zijn eigen leven ziet -- dat is een
   besluit en geen instelling. */
const HORIZON_DAGEN = 35;

/* Hoeveel maanden ligt deze datum voorbij de huidige? Op de maand gerekend en
   niet op dagen, want dat is wat het vak betekent. */
function maandAfstand(nu, datum) {
  return (Number(datum.slice(0, 4)) - Number(nu.slice(0, 4))) * 12 +
    (Number(datum.slice(5, 7)) - Number(nu.slice(5, 7)));
}

/* Op het middaguur rekenen, zodat een zomertijdgrens nooit een dag verschuift --
   dezelfde truc als in levensgraaf/hulp.js, en om dezelfde reden. */
const dagen = (van, tot) =>
  Math.round((new Date(tot + 'T12:00:00Z') - new Date(van + 'T12:00:00Z')) / 86400000);

/* Maandag als eerste dag van de week: dat is hoe een agenda hier leest. Geeft
   het aantal dagen tot en met zondag van de lopende week. */
function totZondag(dag) {
  const d = new Date(dag + 'T12:00:00Z').getUTCDay(); // 0 = zondag
  return d === 0 ? 0 : 7 - d;
}

module.exports = () => {

  /* In welk vak valt deze datum? Geeft de sleutel en het label. Een datum in het
     verleden hoort hier niet te komen -- de aanroeper filtert die er al uit --
     en levert daarom null in plaats van een vak dat "gisteren" heet. */
  function vakVan(datum, nu) {
    const n = dagen(nu, datum);
    if (n < 0) return null;
    if (n === 0) return { sleutel: 'vandaag', label: 'Vandaag', rang: 0 };
    if (n === 1) return { sleutel: 'morgen', label: 'Morgen', rang: 1 };

    const rest = totZondag(nu);
    if (n <= rest) {
      const wd = new Date(datum + 'T12:00:00Z').getUTCDay();
      /* De dag bij naam, want zo staat hij in iemands hoofd: niet "over 3 dagen"
         maar "vrijdag". Dat is ook meteen het verschil met een afteller. */
      return { sleutel: 'wd' + wd, label: WD[wd].charAt(0).toUpperCase() + WD[wd].slice(1), rang: 2 + n };
    }
    if (n <= rest + 7) return { sleutel: 'volgendeweek', label: 'Volgende week', rang: 20 };

    /* Voorbij volgende week telt de MAAND, niet de kalendergrens alleen. Een
       datum in deze maand heet "Deze maand"; een datum daarna heet bij zijn
       naam, zolang hij binnen de horizon valt. Een formule en geen twee takken:
       de afstand in maanden bepaalt zowel de sleutel als de volgorde, dus een
       derde maand kan er nooit tussenuit vallen. */
    if (n <= HORIZON_DAGEN) {
      const m = maandAfstand(nu, datum);
      if (m === 0) return { sleutel: 'dezemaand', label: 'Deze maand', rang: 30 };
      const naam = MAANDEN[Number(datum.slice(5, 7)) - 1];
      return { sleutel: 'maand:' + datum.slice(0, 7),
        label: naam.charAt(0).toUpperCase() + naam.slice(1), rang: 30 + m };
    }
    return { sleutel: 'later', label: 'Later', rang: 40 };
  }

  /* Een termijn uit de Control Tower wordt een regel op de lijn. Zijn `wat`
     ("verjaardag", "paspoort") plus `waarvan` (de naam die het lid zelf in zijn
     eigen dossier typte) maakt de zin: "Noor - verjaardag". Zonder die naam is
     een termijn op een tijdlijn nietszeggend. */
  const uitTermijn = (t) => ({
    soort: 'termijn', titel: (t.waarvan ? t.waarvan + ' - ' : '') + (t.wat || t.naam || 'termijn'),
    wie: t.waarvan || '', wanneer: t.datum, tijd: null, wacht: '',
    bron: t.bron || '', link: '/apps/sociaal.html', kenmerk: String(t.id || '')
  });

  /* De lijn: alles met een datum vanaf vandaag, in vakken.

     `beeld` is de uitkomst van socialegraaf.beeld(). Hij wordt hier MEEGEGEVEN
     en niet opgehaald, zodat een scherm dat allebei toont er een aanroep over
     doet en niet twee -- en zodat deze module niets van de kern hoeft te weten. */
  function lijn(beeld) {
    const nu = vandaag();
    const b = beeld || {};
    const rijen = [];

    /* HET VERLEDEN WORDT HIER NIET GEFILTERD, en dat is bewust. Er stond eerst
       `|| m.wanneer < nu` bij, naast de null die vakVan() al geeft voor een
       datum die voorbij is -- twee wachten voor dezelfde regel. De mutatie die
       dat aantoonde is gedraaid: het filter weghalen liet geen enkele toets
       zakken, en vakVan() aanpassen wel. Dat is de dragende wacht, en een
       tweede kopie ernaast is precies wat er stil uit elkaar gaat lopen als
       iemand er een verandert (LAT.md regel 4).

       `isDatum` blijft wel staan: een regel zonder geldige datum hoort nooit in
       vakVan() terecht te komen, want daar zou hij NaN opleveren. */
    for (const m of b.momenten || []) {
      if (isDatum(m.wanneer)) rijen.push(m);
    }
    /* Alleen wat nog KOMT: `achterstallig` hoort in de cockpit en niet op een
       tijdlijn -- een verlopen paspoort heeft geen dag meer waarop het staat.
       Dat volgt hier uit de BRON die gelezen wordt (`vooruit.komt`), en niet uit
       een datumvergelijking; achterstallig staat in een eigen lijst. */
    for (const t of (b.vooruit && b.vooruit.komt) || []) {
      if (isDatum(t.datum)) rijen.push(uitTermijn(t));
    }

    const perVak = new Map();
    let later = 0;
    for (const r of rijen) {
      const v = vakVan(r.wanneer, nu);
      if (!v) continue;
      if (v.sleutel === 'later') { later++; continue; }
      if (!perVak.has(v.sleutel)) perVak.set(v.sleutel, { sleutel: v.sleutel, label: v.label, rang: v.rang, regels: [] });
      perVak.get(v.sleutel).regels.push(r);
    }

    /* ALLEEN GEVULDE VAKKEN, en dat is de belangrijkste regel van dit bestand.
       Een lege woensdag is geen gat in uw leven. */
    const vakken = [...perVak.values()]
      .sort((a, b2) => a.rang - b2.rang)
      .map(v => ({
        sleutel: v.sleutel, label: v.label,
        regels: v.regels.sort((x, y) =>
          String(x.wanneer).localeCompare(String(y.wanneer)) ||
          String(x.tijd || '').localeCompare(String(y.tijd || '')))
      }));

    return {
      vakken,
      /* Een telling en geen lijst: wie verder vooruit wil kijken, opent de app
         die het bijhoudt. Een tijdlijn die tot in het volgende jaar doorloopt is
         geen lijn meer maar een archief. */
      later,
      stil: (b.stil || []).slice()
    };
  }

  return { lijn, vakVan, WD };
};
