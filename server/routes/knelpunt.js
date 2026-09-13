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
  const { app, auth } = kern;
  const knelpunt = require('../kern/knelpunt');
  const openingen = require('../kern/knelpunt/openingen');
  const { maakAanvoer } = require('../kern/knelpunt/aanvoer-bronnen');
  const { maakWerkbron } = require('../kern/knelpunt/aanvoer-werk');
  /* De aanvoer wordt EEN keer samengesteld, bij het bedraden. Per verzoek
     opnieuw bouwen zou de bronnenlijst per aanroep laten verschillen, en dan is
     "welke bronnen zijn er" geen vraag meer met een antwoord. */
  const aanvoer = maakAanvoer({ werk: maakWerkbron(() => kern.openVacatures) });

  app.post('/api/knelpunt', auth, (req, res) => {
    const r = knelpunt.reken(req.body || {});
    const { status, ...rest } = r;
    if (!r.ok) return res.status(status || 200).json(rest);
    /* De aannames van beide lagen staan achter elkaar in EEN lijst. Twee
       lijsten aannames laten de lezer kiezen welke hij leest, en dat is precies
       de helft die hij dan niet leest. */
    const o = openingen.voorKnelpunten(r.knelpunten);
    /* De aanvoer hangt NAAST de openingen en vervangt ze niet: een opening is
       de deur, een vondst is wat erachter staat. Alleen `werk` heeft vandaag
       een bron, en de andere vier staan daarom in `zonderBron` -- met de reden,
       want een leeg vak leest als "er is hier niets" terwijl het "wij hebben
       hier nog niets aangesloten" betekent.

       De randvoorwaarden gaan er EEN voor EEN in. De aanvoerlaag kent de mens
       niet en mag hem ook niet uit een optelsom kunnen afleiden; per
       randvoorwaarde vragen houdt dat zo. */
    const vondsten = [], bronMeldingen = [], bronLeeg = [];
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
      vondstenGeweigerd: bronMeldingen, vondstenBronLeeg: bronLeeg,
      aannames: rest.aannames.concat(o.aannames), openingenGrens: o.grens });
  });
};
