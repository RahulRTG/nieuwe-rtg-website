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
   zichzelf. */
module.exports = (kern) => {
  const { app, auth } = kern;
  const knelpunt = require('../kern/knelpunt');

  app.post('/api/knelpunt', auth, (req, res) => {
    const r = knelpunt.reken(req.body || {});
    const { status, ...rest } = r;
    res.status(status || 200).json(rest);
  });
};
