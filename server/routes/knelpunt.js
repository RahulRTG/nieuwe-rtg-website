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

  app.post('/api/knelpunt', auth, (req, res) => {
    const r = knelpunt.reken(req.body || {});
    const { status, ...rest } = r;
    if (!r.ok) return res.status(status || 200).json(rest);
    /* De aannames van beide lagen staan achter elkaar in EEN lijst. Twee
       lijsten aannames laten de lezer kiezen welke hij leest, en dat is precies
       de helft die hij dan niet leest. */
    const o = openingen.voorKnelpunten(r.knelpunten);
    res.json({ ...rest, openingen: o.openingen, terreinen: o.terreinen,
      aannames: rest.aannames.concat(o.aannames), openingenGrens: o.grens });
  });
};
