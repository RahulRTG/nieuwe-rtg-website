/* Routes "knelpunt": de knelpuntmotor (kern/knelpunt/).

   EEN ROUTE DIE NIETS BEWAART EN NIETS OPHAALT. Alles komt binnen in het lijf en
   gaat eruit als antwoord; er wordt geen doel opgeslagen, geen randvoorwaarde
   onthouden en geen uitkomst bewaard. Dat is met opzet en het is de reden dat
   deze laag vandaag al gebruikt kan worden: hij heeft geen enkel getal nodig dat
   dit huis niet heeft, en hij legt niets vast over een mens.

   ACHTER `auth` EN NIET OPEN, terwijl er niets te lekken valt. Twee redenen: de
   INVOER is van iemand ("mijn kinderen", "mijn inkomen") en hoort niet op een
   open route te belanden waar hij in een log kan komen; en een rekenroute zonder
   poort is een gratis rekenmachine voor wie hem vindt.

   ER IS MET OPZET GEEN OPSLAGROUTE. Zodra een uitkomst bewaard wordt, ontstaat
   er een dossier met wegen en blokkades per mens -- en dat is precies het
   bestand dat HDI.md par. 5.1 verbiedt. Wie dit wil bewaren, bewaart het bij
   zichzelf.

   DE OPENINGEN HANGEN ERNAAST EN NIET ERIN. kern/knelpunt/index.js blijft een
   pure rekenregel zonder enige kennis van dit huis; ./openingen.js weet wel wat
   er in dit huis bestaat. Ze samenvoegen zou de motor onttoetsbaar maken (hij
   zou meebewegen met elke nieuwe bron) en de kaart onzichtbaar. De route is de
   plek waar ze elkaar ontmoeten, en dat is precies wat een route hoort te zijn.

   De openingen komen alleen mee bij een GESLAAGDE berekening: op een 400 is er
   geen knelpunt om iets bij te zoeken, en een half antwoord met een halve kaart
   leest als een uitkomst. */
module.exports = (kern) => {
  const { app, auth, rtf } = kern;
  const knelpunt = require('../kern/knelpunt');
  const openingen = require('../kern/knelpunt/openingen');
  const { maakAanvoer } = require('../kern/knelpunt/aanvoer-bronnen');
  const { maakWerkbron } = require('../kern/knelpunt/aanvoer-werk');
  const { maakOpleidingbron } = require('../kern/knelpunt/aanvoer-opleiding');
  const { maakOpvangbron } = require('../kern/knelpunt/aanvoer-opvang');
  const { maakWegen } = require('../kern/knelpunt/wegen');
  /* De aanvoer wordt EEN keer samengesteld, bij het bedraden. Per verzoek
     opnieuw bouwen zou de bronnenlijst per aanroep laten verschillen, en dan is
     "welke bronnen zijn er" geen vraag meer met een antwoord. */
  const BRONNEN = {
    werk: maakWerkbron(() => kern.openVacatures),
    opleiding: maakOpleidingbron(() => kern.beroepenbieb),
    opvang: maakOpvangbron(() => kern.opvangwijzer)
  };
  const aanvoer = maakAanvoer(BRONNEN);
  /* De wegen komen uit DEZELFDE lijst bronnen: een bron die hier wordt
     aangesloten levert vanzelf ook een weg bij een kaal doel. Twee lijsten
     zouden binnen een maand uit elkaar lopen. */
  const wegen = maakWegen(Object.keys(BRONNEN));

  /* Eén afhandeling voor twee deuren. Ze apart schrijven zou betekenen dat een
     gezin een ANDER antwoord krijgt dan een lid zodra iemand er een aanpast --
     en dat is precies de soort stille tweedeling die deze laag moet uitsluiten. */
  function beantwoord(req, res) {
    const lijf = req.body || {};

    /* SCHAKEL 4 VAN DE ADAM-KETEN. Een mens zegt "ik wil weer aan het werk" --
       een DOEL zonder wegen -- en de motor weigerde dat terecht. Hier worden de
       wegen samengesteld uit de bronnen die dit huis heeft (./kern/knelpunt/
       wegen.js), maar ALLEEN als de mens er zelf geen aandroeg: dit huis vult
       een gat, het overschrijft geen antwoord. En `manierenBron` zorgt dat de
       motor niet beweert dat de mens ze opgaf -- een lijst die zich voordoet
       als die van de mens is precies de stille onwaarheid die hier niet mag. */
    const zelfOpgegeven = Array.isArray(lijf.manieren) && lijf.manieren.length > 0;
    const w = zelfOpgegeven ? null : wegen.wegenBij();
    const invoer = zelfOpgegeven ? lijf
      : { ...lijf, manieren: (w.manieren || []), manierenBron: 'samengesteld' };

    const r = knelpunt.reken(invoer);
    const { status, ...rest } = r;
    if (!r.ok) {
      /* Weigert de motor bij nul samengestelde manieren, dan ligt dat aan dit
         huis en niet aan de vraag; ./wegen.js heeft daar de juiste zin voor. */
      if (w && !(w.manieren || []).length) {
        return res.status(status || 400).json({ ...rest, error: w.uitleg });
      }
      return res.status(status || 200).json(rest);
    }
    /* De aannames van beide lagen staan achter elkaar in EEN lijst. Twee
       lijsten aannames laten de lezer kiezen welke hij leest, en dat is precies
       de helft die hij dan niet leest. */
    const o = openingen.voorKnelpunten(r.knelpunten);
    /* De aanvoer hangt NAAST de openingen en vervangt ze niet: een opening is
       de deur, een vondst is wat erachter staat. Een terrein zonder bron staat
       in `zonderBron` MET de reden -- een leeg vak leest als "er is hier niets"
       terwijl het "hier is nog niets aangesloten" betekent. */
    const vondsten = [], bronMeldingen = [], bronLeeg = [], geleverd = [];
    /* De knelpunten gaan er EEN voor EEN in, en een knelpunt IS hier de
       randvoorwaarde -- kern/knelpunt/index.js geeft ze als platte rij
       { id, wat, blokkeertWegen } en niet genest onder een weg. Dat is bij het
       bouwen misgegaan: de lus liep over een veld `voorwaarden` dat niet
       bestaat, dus er kwam nul uit terwijl alles werkte. Een lege lijst zag er
       precies zo uit als "geen vacatures".

       Een voor een en niet in een optelsom: de aanvoerlaag kent de mens niet en
       mag hem ook niet uit een samenvoeging kunnen afleiden. */
    for (const k of (r.knelpunten || [])) {
      const a = aanvoer.vondsten(k);
      for (const v of a.vondsten) vondsten.push(v);
      for (const g of a.geweigerd) bronMeldingen.push(g);
      /* Een bron die NIETS heeft is iets anders dan een bron die stukging, en
         die twee worden nooit samengevoegd -- dezelfde regel als in
         kern/ontvanger.js. */
      for (const g of a.geenBron) bronLeeg.push(Object.assign({ voorwaarde: k.id }, g));
      /* Wat elke bron LEVERDE naast wat hij VOND. Zonder dat verschil leest een
         scherm met een vacature en vierentwintig leerpaden als een oordeel over
         welke weg de beste is, terwijl het alleen zegt hoeveel elke bron
         toevallig heeft. Er wordt niets herverdeeld: dat zou een rangorde zijn
         (kern/knelpunt/index.js regel 4). */
      for (const g of a.geleverd) geleverd.push(Object.assign({ voorwaarde: k.id }, g));
    }
    /* Alleen over de terreinen die dit knelpunt werkelijk RAAKT wordt gemeld dat
       er geen bron is. Alle vijf melden zou "voor wonen is geen bron
       aangesloten" zetten onder een vraag die niets met wonen te maken heeft --
       een mededeling die nergens over gaat, leest als een tekortkoming. */
    const geraakt = [...new Set((o.openingen || []).map((x) => x.terrein).filter(Boolean))];
    const metBron = new Set(vondsten.map((v) => v.terrein));
    const zonderBron = geraakt.filter((t) => !metBron.has(t))
      .map((t) => ({ terrein: t, reden: 'voor dit terrein is nog geen bron aangesloten; de ingang ' +
        'bij de opening hierboven is wat dit huis heeft' }));
    res.json({ ...rest, openingen: o.openingen, terreinen: o.terreinen,
      vondsten, vondstenZonderBron: zonderBron,
      vondstenGeweigerd: bronMeldingen, vondstenBronLeeg: bronLeeg, vondstenGeleverd: geleverd,
      /* Wie de wegen maakte, staat er als GEGEVEN bij en niet alleen als zin. */
      manierenSamengesteld: !zelfOpgegeven,
      manierenUitleg: w ? w.uitleg : null,
      manierenBronNietOpDeKaart: w ? w.nietOpDeKaart : [],
      aannames: rest.aannames.concat(o.aannames, w ? [w.uitleg] : []),
      openingenGrens: o.grens });
  }

  app.post('/api/knelpunt', auth, beantwoord);

  /* ---------------------------------------------------------------------
     DE FOUNDATION-INGANG -- een besluit van de eigenaar, 13 september 2026.

     WAT HIER WEL EN NIET IS OPENGEZET. Een gezin mag zijn EIGEN vraag laten
     beantwoorden met vondsten. Dat is niet hetzelfde als "de foundation mag
     bij /api/knelpunt/*": er is één deur bij gekomen voor één functie, en de
     rest van deze laag verandert niet. De aanleiding staat in de Adam-keten --
     de motor die precies de vraag van een zeventienjarige beantwoordt, was
     voor dat gezin niet te openen.

     DRIE GRENZEN, EN ALLE DRIE STAAN ZE IN DE CODE EN NIET ALLEEN HIER:

     1. GEEN PROFIEL NAAR DE AANVOER. `beantwoord()` leest alleen `req.body`,
        en de sessie wordt hier ALLEEN gebruikt om de deur te openen -- er gaat
        niets van `sess` mee naar de motor of de bronnen. De handtekening van
        `vondsten(voorwaarde)` maakt dat structureel onmogelijk; deze route
        maakt er geen uitzondering op.
     2. EEN VONDST IS GEEN RECHT. Dat Adam een vacature ZIET, zegt niets over
        of hij erop mag solliciteren. Die vraag blijft bij de sollicitatielaag,
        die de leeftijd uit het PROFIEL leest en niet uit dit antwoord
        (routes/member/werk/rtf.js: *"de leeftijd komt uit het PROFIEL, niet
        uit het verzoek"*). Deze laag ordent mogelijkheden; de domeinen blijven
        eigenaar van hun eigen handelingen.
     3. GEEN RANGORDE DIE ALS ADVIES LEEST. Er wordt niets gesorteerd, en het
        antwoord draagt per bron `getoond` naast `gevonden` zodat een korte
        lijst niet als "dit is alles" en een lange niet als "dit is het beste"
        leest.

     IEDEREEN IN HET GEZIN MAG KIJKEN, ook een gast-profiel -- dezelfde regel
     als bij /api/rtf/beroepen. Wie mag KIJKEN begrenzen zou hier een
     geschiktheidsoordeel zijn over wie zijn eigen mogelijkheden mag zien, en
     dat is precies wat FOUNDATION.md par. 5 verbiedt.
     --------------------------------------------------------------------- */
  app.post('/api/rtf/knelpunt', (req, res) => {
    const sess = rtf.verifieerProfiel((req.body || {}).code, (req.body || {}).token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    return beantwoord(req, res);
  });
};
