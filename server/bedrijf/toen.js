/* RTG Werk OS (deellaag): de organisatie op een datum in het verleden.

   "Laat de organisatie zien op 12 maart 2027" is een prachtige knop en een
   gevaarlijke. De volledige vorm ervan -- projecten, teams, budgetten, mensen
   en besluiten teruggezet zoals ze TOEN stonden -- kan dit huis niet, en de
   reden staat al in kern/command/herkomst.js: het journaal ziet alleen wat er
   langs is gekomen, en de gewone routes lopen er niet allemaal doorheen. Een
   beeld dat dat negeert, toont een organisatie waarin alles wat niet in het
   journaal staat er nooit is geweest -- en dat leest als een feit.

   WAT DEZE LAAG WEL DOET, EN NIET MEER DAN DAT: hij zegt WAT ER BESTOND op een
   datum. Elke rij in dit huis draagt een `at` (het moment waarop hij ontstond),
   en dat is een gemeten gegeven en geen reconstructie. "Welke contracten waren
   er op 12 maart" en "hoeveel projecten liepen er toen" zijn daarmee eerlijk te
   beantwoorden.

   WAT HIJ NIET DOET: de TOESTAND van toen. Of een contract op die dag actief of
   nog concept was, wie er toen aan een project werkte, welke rollen iemand toen
   had -- dat is niet vast te stellen, want een wijziging overschrijft de vorige
   waarde en er is geen gebeurtenislaag onder de schrijfhandelingen. Dat staat in
   elk antwoord, niet als voetnoot maar als eigenschap van de uitslag.

   EN DE ONVOLLEDIGHEID WORDT GETELD. Rijen zonder `at` kunnen niet in de tijd
   worden geplaatst. Die verdwijnen hier niet stilletjes uit de telling: ze
   staan als `zonderDatum` in de uitslag, want een antwoord dat er 40 telt
   terwijl er 3 niet plaatsbaar waren, is 40 met een verzwegen marge.

   HIJ ERFT ZIJN SCOPE VAN HET REGISTER. Dezelfde twee assen als overal in deze
   laag: de werkruimte en het recht. Wie geen contracten mag zien, ziet ze ook
   in het verleden niet -- niet doordat er gefilterd wordt, maar doordat die
   soort niet in zijn register staat. */
'use strict';

const { maakWerkRegister } = require('../kern/werkcommand/register');

module.exports = (sctx) => {
  const { app, db, schoon, werkPoort } = sctx;

  app.post('/api/bedrijf/toen', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const datum = schoon(req.body.datum, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
      return res.status(400).json({ error: 'Geef een datum als jjjj-mm-dd.' });
    const grens = datum + 'T23:59:59.999Z';

    const register = maakWerkRegister(g.w.code, g.rechten);
    const soorten = register.SOORTEN.map(so => {
      const rijen = register.rijen(db, so);
      const zonder = rijen.filter(r => !r.at);
      const bestond = rijen.filter(r => r.at && String(r.at) <= grens);
      return { type: so.type, label: so.label, meervoud: so.meervoud, domein: so.domein,
        bestond: bestond.length, nu: rijen.length, zonderDatum: zonder.length,
        voorbeelden: bestond.slice(0, 5).map(r => register.kort(so, r)) };
    });
    const zonderTotaal = soorten.reduce((n, s) => n + s.zonderDatum, 0);

    res.json({ ok: true, datum,
      soorten: soorten.filter(s => s.nu > 0),
      leeg: soorten.filter(s => s.nu === 0).map(s => s.type),
      zonderDatum: zonderTotaal,
      wat: 'bestaan',
      let: 'Dit is WAT ER BESTOND op ' + datum + ', geteld uit het aanmaakmoment van elke rij. Het is NIET de toestand van toen: of een contract op die dag al actief was, wie er toen aan een project werkte en welke rollen iemand had, is niet vast te stellen -- een wijziging overschrijft de vorige waarde en er ligt geen gebeurtenislaag onder de schrijfhandelingen.'
        + (zonderTotaal ? ' ' + zonderTotaal + ' rij(en) dragen geen aanmaakmoment en konden dus niet in de tijd worden geplaatst; die staan per soort bij zonderDatum en niet stilzwijgend buiten de telling.' : '') });
  });
};
