/* ============================================================================
   ONDERTITELEN IN EEN LIVE GESPREK -- de deur naar het lokale spraakmodel.

   EEN HUISBREDE VOORZIENING EN GEEN SERVICEFUNCTIE. Er zijn tien live vormen in
   dit huis zonder weg naar tekst (scripts/check.js regel 49): bellen met RTG
   Service, het gezinsgesprek van de Foundation, bellen met een vriend, de
   vergaderkamer, het videogesprek tussen twee leden. Die delen allemaal dezelfde
   meeleesbaan, dus ze horen ook dezelfde ondertitelweg te delen. Een route per
   gesprekssoort zou vier keer dezelfde grens opnieuw bedenken, en dan is de
   vijfde de eerste die hem mist.

   WAT ER LANGS DEZE DEUR GAAT: een paar seconden geluid van de EIGEN microfoon
   van de spreker, en terug komt tekst. Elke deelnemer ondertitelt dus zichzelf,
   en die tekst reist daarna over de bestaande seinweg van het gesprek -- net als
   een getypte regel. Dat is met opzet zo:

     - de spreker beslist zelf of zijn stem door een model gaat, en dat is een
       andere vraag dan of hij aan een gesprek meedoet;
     - er hoeft nergens een tweede geluidsstroom te worden afgetapt;
     - wie meeluistert, ondertitelt niemand achter zijn rug.

   ER WORDT NIETS BEWAARD. Het fragment gaat naar het model en verder nergens
   heen -- geen bestand, geen rij in de database, geen kopie "voor de kwaliteit".
   Wat overblijft is de tekst, en die staat al in de meeleesbaan van het gesprek.

   EN HIJ WIJKT NOOIT UIT NAAR BUITEN. Dat staat in kern/spraaktekst.js en niet
   hier, zodat een tweede ingang hem niet kan omzeilen.
   ========================================================================== */
'use strict';

module.exports = (kern) => {
  const { app, auth, express, spraaktekst } = kern;

  /* WAT KAN HIER. Elk gespreksscherm vraagt dit voordat het een knop toont: een
     ondertitelknop die niets doet is erger dan geen knop, want die laat iemand
     aan een gesprek beginnen in de veronderstelling dat hij het kan volgen. */
  app.post('/api/ondertiteling/stand', auth, (req, res) => {
    const st = spraaktekst.beschikbaar();
    res.json(Object.assign({ ok: true }, st, {
      let: st.beschikbaar
        ? 'Uw eigen stem wordt op de server van RTG omgezet naar tekst met een lokaal model. ' +
          'Het geluid gaat niet naar een andere partij en wordt niet bewaard.'
        : 'Automatisch ondertitelen kan hier niet. Meelezen werkt wel: wat deelnemers typen, ' +
          'ziet iedereen. Zonder dat is dit gesprek voor wie doof is niet te volgen.'
    }));
  });

  /* EEN FRAGMENT. Rauwe bytes, want een audiofragment door een JSON-parser halen
     betekent base64 en dus een derde groter -- bij een paar seconden per keer is
     dat elke keer opnieuw. De rem staat op de LENGTE en die staat in de kern:
     hier alleen de grens van de deur zelf.

     Geen gastsessie: dit is een voorziening voor wie meedoet aan een gesprek, en
     een gast heeft er geen. */
  app.post('/api/ondertiteling/fragment', auth,
    express.raw({ type: () => true, limit: '3mb' }), async (req, res) => {
      const r = await spraaktekst.transcribeer(req.body, {
        soort: String(req.get('content-type') || '').split(';')[0].trim(),
        taal: String(req.get('x-rtg-taal') || '').slice(0, 8) || null
      });
      res.status(r.status || 200).json(r);
    });
};
