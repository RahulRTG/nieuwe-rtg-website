/* DE ISOLATIEMODUS VAN EEN LID -- zichzelf beschermen zonder RTG te bellen.

   WAAROM DIT EEN EIGEN BESTAND IS EN GEEN PARAMETER AAN DE EIGENAAR-CONSOLE.
   routes/techniek/isolatie.js is containment: RTG zet bij een verdenking een
   identiteit, sessie of apparaat dicht. Dit is het omgekeerde -- een mens die
   zelf denkt dat er iets mis is. Dat is een andere handeling met een andere
   toon, een ander scherm en vooral een andere BEVOEGDHEID, en die drie in een
   route persen met een vlag erbij is hoe een lid op een dag de knop van het
   kantoor te pakken krijgt.

   DE SLEUTEL KOMT UIT DE SESSIE EN NOOIT UIT HET VERZOEK. Dat is de enige regel
   die hier echt telt. Zou het lid zijn eigen sleutel mogen meesturen, dan kan
   hij de sessie van iemand anders in isolatie zetten -- een aardig klinkende
   functie die in werkelijkheid een uitlogknop voor willekeurige leden is. Het
   lijf van het verzoek draagt hier dus GEEN sleutel, en er is geen pad waarlangs
   er een binnenkomt.

   EEN LID ZET ALLEEN ZIJN EIGEN LAGEN. `identiteit` (ik, overal), `sessie`
   (deze inlog) en `apparaat` zijn van hem. `organisatie` en `huis` zijn dat
   niet: wie zijn eigen werkgever kan isoleren, kan andermans werkgever
   isoleren.

   VERLAGEN LOOPT LANGS DEZELFDE CEREMONIE als bij het kantoor. Dat is met opzet
   niet lichter gemaakt voor een lid: juist bij een lid is het scenario dat de
   ceremonie moet vangen -- iemand die de sessie heeft overgenomen en de
   bescherming weer uit wil zetten -- het meest waarschijnlijk. Die ceremonie
   staat in ./isolatie-ceremonie.js: verstrengen is een handeling, verlagen is
   een protocol, en dat zijn twee onderwerpen. */
'use strict';

const functies = require('../functies');
const klok = require('../lib/klok');
const maakIsolatie = require('../kern/isolatie');
const { maakBruikbaarheid, LEDENBANEN } = require('../kern/isolatie/bruikbaarheid');
const { maakBeschermstand } = require('../kern/beschermstand');
const handhaving = require('../kern/isolatie/handhaving');
const { dragersVanVerzoek, EIGEN_LAGEN } = require('../kern/isolatie/sessiedragers');

module.exports = (kern) => {
  const { app, db, save, auth, beveilig } = kern;

  /* EEN LAAG EN NIET TWEE. De eigenaar-console maakt dezelfde laag; hij hangt
     hier op zodat de ceremonies, de standen en het spoor van beide kanten
     hetzelfde zijn. Twee exemplaren zouden allebei uit db.data lezen en toch
     uiteenlopen zodra er een cache of een teller bij komt -- en dan kent de een
     een ceremonie die de ander niet kent. */
  kern.isolatie = kern.isolatie || maakIsolatie({
    db, save, functies, klok, beveilig,
    huisStand: () => {
      const t = db.data && db.data.techniek;
      const s = t && t.incidentcontrole;
      return (s && s.modus) || 'normaal';
    }
  });
  const isolatie = kern.isolatie;

  /* DE LAAG MELDT ZICH BIJ DE HTTP-POORT. Hij hangt in de middleware-keten, die
     bij het opstarten VOOR de routers wordt gebouwd -- dus hij kan de laag niet
     zelf requiren zonder een kringverwijzing. Late binding, zelfde patroon als
     zetWacht/zetScanNet in opzet/verzoekketen.js.

     Buiten productie blijft de standaard schaduw. Een productiestart wordt in
     config/productie.js echter geweigerd zolang de handhavingsvlag ontbreekt;
     een lid mag live nooit een beschermknop zien die gewone HTTP-verzoeken
     alleen telt. Beide route-ingangen lezen dezelfde bron, zodat de tweede
     montage de eerste niet ongemerkt terug naar schaduw kan zetten. */
  const isolatiepoort = require('../middleware/isolatiepoort');
  const isolatiestand = require('../middleware/isolatiepoort-stand');
  const isolatieRealtime = require('../middleware/isolatiepoort-realtime');
  isolatiepoort.zetLaag(isolatie, { afdwingen: isolatiestand.afdwingenUitOmgeving(process.env) });
  isolatiestand.eisProductieGereed(process.env);

  /* WAT ER NOG WERKT, voor het lid zelf. Dezelfde meter als op de cockpit en met
     opzet niet een tweede lijst: een lid dat overweegt zichzelf dicht te zetten,
     hoort precies te zien wat het kantoor ook ziet. Wie de knop niet durft in te
     drukken, wordt er niet door beschermd. */
  const bruikbaar = maakBruikbaarheid({ isolatie, functies, beschermstand: maakBeschermstand({ functies }) });

  /* De sleutels van dit lid, alle uit de sessie en de Authorization-kop. De
     vertaling staat in kern/isolatie/sessiedragers.js -- hier stond hem met de
     hand, met een `s.id || s.sid` erin die nergens bestaat, waardoor `sessie`
     stil terugviel op de identiteitsleutel. Twee lagen zetten dan dezelfde
     stand, en het scherm zei dat niet. */
  function mijnSleutels(req) { return dragersVanVerzoek(req).sleutels; }

  function laagOf(req, drager) {
    if (!EIGEN_LAGEN.includes(String(drager))) {
      const e = new Error('U kunt alleen uw eigen lagen zetten: ' + EIGEN_LAGEN.join(', ') + '.');
      e.status = 403; throw e;
    }
    const uit = dragersVanVerzoek(req);
    const sleutel = uit.sleutels[drager];
    if (!sleutel) {
      /* GEEN LEGE WEIGERING. De reden komt uit het dragerregister en zegt wat er
         ontbreekt en waarom -- een lid dat een knop niet kan gebruiken, hoort te
         horen waardoor (GRAMMATICA.md: een verhindering draagt altijd een reden). */
      const e = new Error('Deze sessie draagt geen ' + drager + ': ' +
        (uit.ontbreekt[drager] || 'er is niets om een stand aan te hangen.'));
      e.status = 409; throw e;
    }
    return sleutel;
  }
  function actor(req) { return 'lid-' + String((req.session && req.session.key) || 'onbekend').slice(0, 40); }
  function faal(res, e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'De handeling mislukte.' });
  }

  /* WAT ER TERUGKOMT IS MIJN STAND EN NIET DIE VAN HET HUIS. Het huis telt wel
     mee in de effectieve stand -- de join is de join -- maar wat er STAAT per
     drager blijft bij de dragers die van dit lid zijn. Een lid hoeft niet te
     weten hoeveel andere leden RTG heeft dichtgezet. */
  app.post('/api/isolatie/mijn', auth, (req, res) => {
    try {
      const sleutels = mijnSleutels(req);
      const ctx = isolatie.context(sleutels);
      const mijn = {};
      for (const d of EIGEN_LAGEN) mijn[d] = sleutels[d] ? (isolatie.standVan(d, sleutels[d]) || 'normaal') : null;
      res.set('Cache-Control', 'no-store');
      res.json({
        ok: true,
        mijn,
        effectief: isolatie.effectieveStand(ctx.standen),
        /* Het huis staat er als STAND en niet als getal: dat er een incident
           loopt, merkt een lid toch, en het verzwijgen maakt zijn eigen scherm
           onbegrijpelijk ("waarom kan ik dit niet, ik sta op normaal"). */
        platform: ctx.standen.huis,
        open: isolatie.ontsluiting.open().filter(v => EIGEN_LAGEN.includes(v.drager) &&
          Object.values(sleutels).includes(v.sleutel)),
        /* Per stand: wat blijft er van je dagelijkse dingen over. Alleen de
           banen van een LID -- wat een zaak of het kantoor nog kan, is niet iets
           waar dit scherm over gaat, en zonder dit filter leest een lid op zijn
           eigen scherm "dan werkt niet meer: afrekenen aan de kassa". Het filter
           zit in de MODULE (bruikbaarheid.LEDENBANEN) en niet hier of in de
           client: twee filters zijn twee waarheden, en een client die rijen
           binnenkrijgt die hij niet mag tonen, toont ze op een dag. */
        werktNog: bruikbaar.overStanden(['beschermd', 'isolatie'], { banen: LEDENBANEN }),
        /* WAAR DEZE STAND WERKELIJK GELDT -- gemeten en niet beloofd.

           Het scherm zei "dat werkt meteen". Dat is vandaag niet waar: de
           per-drager-stand versmalt wél de lijst waaruit de AI kiest, maar
           middleware/functieschakelaars.js kijkt alleen naar de HUIS-modus, dus
           een gewoon HTTP-verzoek van dit lid loopt gewoon door. Een scherm dat
           meer belooft dan de code doet, is de duurste soort fout: het lid denkt
           dat hij beschermd is en gedraagt zich daarnaar.

           Dit veld komt uit de CODE (bestaat de poort?) en niet uit een tekst,
           zodat het scherm vanzelf omslaat zodra de poort er is en nooit meer
           kan voorlopen op de werkelijkheid. */
        afgedwongen: (() => {
          const h = handhaving.stand();
          return { http: h.afdwingen, ai: true, waarom: h.waarom };
        })()
      });
    } catch (e) { faal(res, e); }
  });

  app.post('/api/isolatie/mijn/zet', auth, (req, res) => {
    const b = req.body || {};
    try {
      const drager = String(b.drager || 'identiteit');
      const uit = isolatie.zet({ drager, sleutel: laagOf(req, drager), naar: b.naar,
        door: actor(req), reden: b.reden, zetter: drager });
      if (uit.richting === 'verstrengd' && uit.stand === 'isolatie') {
        isolatieRealtime.sluitDrager(uit.drager, uit.sleutel);
      }
      res.json({ ok: true, uit });
    } catch (e) { faal(res, e); }
  });

  /* DE CEREMONIE STAAT ERNAAST. Vijf routes, een eigen bestand, en dezelfde
     helpers doorgegeven in plaats van nagebouwd: `mijnSleutels` en `laagOf`
     dragen de regel dat een sleutel uit de sessie komt, en die regel mag maar
     op een plek staan. */
  require('./isolatie-ceremonie')({ app, kern, auth, isolatie,
    eigenLagen: EIGEN_LAGEN, laagOf, mijnSleutels, actor, faal });
};
