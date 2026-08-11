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

   SINDS DE GEBEURTENISLAAG STELT HIJ DRIE VRAGEN. Hier stond jarenlang dat de
   TOESTAND van toen niet kon, met de goede reden erbij: een wijziging
   overschrijft de vorige waarde en er lag geen gebeurtenislaag onder de
   schrijfhandelingen. Die laag ligt er (./gebeurtenis.js), en dit bestand is
   waar zij aan gebruikers wordt uitgelegd:

     /api/bedrijf/toen           BESTOND HET?          uit `at`, een gemeten feit
     /api/bedrijf/toen/object    WAT WAS DE TOESTAND?  de huidige waarde, met
                                 elke gebeurtenis van na die dag teruggedraaid
     /api/bedrijf/pad            HOE IS HET DAAR       het wijzigingspad, met
                                 GEKOMEN?              actor en reden

   Die derde is waar het om begonnen is. "Status vertraagd" is een feit; "op 12
   februari op vertraagd gezet door Lisa, omdat leverancier X drie dagen
   vertraging meldde" is een geschiedenis.

   DE GRENS IS VERSCHOVEN, NIET WEGGEHAALD. De reconstructie loopt van NU terug,
   en het log heeft twee gaten die allebei worden GETELD in plaats van
   gladgestreken:

     - wijzigingen van VOOR de gebeurtenislaag bestaan niet. Een object dat
       sindsdien niet is aangeraakt toont zijn huidige waarde -- meestal juist,
       niet bewijsbaar.
     - wijzigingen die BUITEN werkMutatie() om gingen worden door het vangnet
       opgemerkt maar dragen geen tijdstip. Op de vier omgezette families geldt
       dat als een DEFECT (/api/bedrijf/gebeurtenis/defecten), want daar is een
       wijziging zonder geschiedenis een fout.

   Wie een toestand krijgt met `zeker: false` heeft geen fout gevonden maar een
   eerlijke marge gelezen.

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
const { meetOngemeten, toestandOp, pad } = require('./gebeurtenis-lezen');

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
      let: 'Dit is WAT ER BESTOND op ' + datum + ', geteld uit het aanmaakmoment van elke rij. Voor de TOESTAND van een object op die dag is er /api/bedrijf/toen/object.'
        + (zonderTotaal ? ' ' + zonderTotaal + ' rij(en) dragen geen aanmaakmoment en konden dus niet in de tijd worden geplaatst; die staan per soort bij zonderDatum en niet stilzwijgend buiten de telling.' : '') });
  });

  /* ---- DE TOESTAND VAN EEN OBJECT OP EEN DAG ----

     Dit is wat hier jarenlang niet kon. De reconstructie loopt van nu terug
     langs ./verloop.js; wat buiten de gebeurtenislaag om is gewijzigd, wordt
     geteld en maakt het antwoord `zeker: false`.

     HET VANGNET DRAAIT HIER, VLAK VOOR HET LEZEN. Dat is met opzet: een sweep
     die op een timer loopt, mist precies de wijziging die iemand net deed en
     nu opvraagt. Hij is goedkoop (een vergelijking per gevolgd veld) en hij
     hoort bij de LEESKANT, want daar wordt de belofte gedaan. */
  app.post('/api/bedrijf/toen/object', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const datum = schoon(req.body.datum, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum))
      return res.status(400).json({ error: 'Geef een datum als jjjj-mm-dd.' });
    const type = schoon(req.body.type, 40);
    const id = schoon(req.body.id, 80);
    if (!type || !id) return res.status(400).json({ error: 'Welk object? Geef type en id.' });

    const register = maakWerkRegister(g.w.code, g.rechten);
    const so = register.SOORTEN.find(x => x.type === type);
    /* Een soort die dit lid niet mag zien, staat NIET in zijn register -- en
       dan bestaat hij hier ook niet. Zelfde 404 als een onbekend type: het
       verschil zou verklappen welke soorten er zijn. */
    if (!so) return res.status(404).json({ error: 'Dit object bestaat niet.' });

    meetOngemeten(g.w, register.SOORTEN);
    const rij = register.rijen(db, so).find(r => String(r[so.sleutel || 'id']) === id);
    if (!rij) return res.status(404).json({ error: 'Dit object bestaat niet.' });

    const uit = toestandOp(g.w, so, rij, datum);
    if (!uit.bestond) {
      return res.json({ ok: true, datum, type, id, bestond: false,
        let: 'Dit object bestond op ' + datum + ' nog niet; het is aangemaakt op ' + String(rij.at).slice(0, 10) + '.' });
    }
    res.json({ ok: true, datum, type, id, bestond: true,
      titel: so.titel ? so.titel(rij) : id,
      toestand: uit.toestand, nu: Object.fromEntries(Object.keys(uit.toestand).map(v => [v, rij[v] == null ? null : rij[v]])),
      zeker: uit.zeker, onzeker: uit.onzeker, let: uit.let });
  });

  /* Het verloop zelf: de regels achter de reconstructie. Wie een toestand niet
     vertrouwt, hoort te kunnen zien waarop zij rust. */
  app.post('/api/bedrijf/verloop', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const register = maakWerkRegister(g.w.code, g.rechten);
    meetOngemeten(g.w, register.SOORTEN);
    const zichtbaar = new Set(register.SOORTEN.map(s => s.type));
    const type = schoon(req.body.type, 40), id = schoon(req.body.id, 80);
    const regels = (g.w.verloop || [])
      .filter(e => zichtbaar.has(e.soort) && (!type || e.soort === type) && (!id || e.id === id))
      .slice(-300).reverse();
    res.json({ ok: true, regels, aantal: regels.length,
      ongemeten: regels.filter(e => e.ongemeten).length,
      afgekapt: !!g.w.verloopAfgekapt,
      let: 'Regels zonder tijdstip zijn buiten de gebeurtenislaag om gegaan en door het vangnet opgemerkt; van die wijzigingen weten wij de oude waarde wel en het moment niet.' });
  });
};
