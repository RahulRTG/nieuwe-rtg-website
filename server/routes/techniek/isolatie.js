/* Techniek (deelmodule): DE ISOLATIECOCKPIT.

   Wat er te bedienen valt staat in server/kern/isolatie/; dit bestand is de
   deur ernaartoe en beslist zelf niets. Dat is met opzet: de vorige keer dat een
   beveiligingsregel in een routebestand belandde, stond hij binnen een jaar op
   twee plekken.

   WAAROM DIT DE EIGENAAR-CONSOLE IS EN (NOG) NIET HET SCHERM VAN EEN LID. De
   dringende vraag is containment: bij een verdenking een identiteit, een sessie
   of een apparaat kunnen dichtzetten, en dat kunnen verklaren. Dat is
   incidentwerk en het hoort bij dezelfde hand die de incidentcontrole bedient.
   Een lid dat zijn EIGEN isolatie aanzet is een echte en goede functie, maar hij
   vraagt zijn eigen weg (ledenpoort, eigen scherm, eigen toon) en is dus geen
   parameter aan deze route. Hij staat als schuld in ISOLATIEPROEF.json en niet
   als een half werkende knop hier.

   DE HELE ROUTE KAN ALLEEN VERSTRENGEN. Verlagen loopt over de ceremonie, en
   dat is geen controle in dit bestand maar de vorm van kern/isolatie/index.js:
   er is geen andere weg naar beneden. Wie hier een `naar: "normaal"` probeert,
   krijgt een 409 uit de kern en niet uit een `if` die iemand kan weghalen.

   Gemount vanuit routes/techniek.js. */
'use strict';

const functies = require('../../functies');
const klok = require('../../lib/klok');
const maakIsolatie = require('../../kern/isolatie');
const beleid = require('../../kern/stuur/beleid');
const { maakIsolatiefilter } = require('../../kern/stuur/isolatiefilter');

module.exports = (tctx) => {
  const { app, db, save, beveilig, techAuth, eigenaarAlleen, appUrl } = tctx;
  const kern = tctx.kern || {};

  /* De huisstand wordt GELEZEN uit de incidentcontrole en niet gekopieerd. Lui,
     want db.data.techniek kan bij het monteren nog leeg zijn -- en een stand die
     bij het opstarten wordt vastgelegd, loopt de rest van de dag achter. */
  const isolatie = (tctx.kern && tctx.kern.isolatie) || maakIsolatie({
    db, save, functies, klok, beveilig,
    huisStand: () => {
      const t = db.data && db.data.techniek;
      const s = t && t.incidentcontrole;
      return (s && s.modus) || 'normaal';
    }
  });
  /* EEN LAAG EN NIET TWEE. routes/isolatie.js (de kant van het lid) hangt hem
     op kern.isolatie; die wordt hier hergebruikt zodat een ceremonie die het lid
     begint, dezelfde is als die het kantoor ziet. Twee exemplaren lezen allebei
     uit db.data en lopen tóch uiteen zodra er een teller of een cache bij komt. */
  if (tctx.kern && !tctx.kern.isolatie) tctx.kern.isolatie = isolatie;

  /* DE LAAG MELDT ZICH BIJ DE HTTP-POORT. Hij hangt in de middleware-keten, die
     bij het opstarten VOOR de routers wordt gebouwd -- dus hij kan de laag niet
     zelf requiren zonder een kringverwijzing. Late binding, zelfde patroon als
     zetWacht/zetScanNet in opzet/verzoekketen.js.

     ZONDER `{ afdwingen: true }` LOOPT HIJ IN DE SCHADUW: hij telt wat hij zou
     sluiten en houdt niets tegen. CONTROLPLANE.md -- je kunt niet afdwingen wat
     nooit heeft meegelopen, en de prijs van aanzetten is hier gemeten en groot. */
  require('../../middleware/isolatiepoort').zetLaag(isolatie);

  const filter = maakIsolatiefilter({ isolatie, beleid });

  function actor(req) {
    const id = req.techUser && req.techUser.id;
    return id === undefined || id === null ? 'eigenaar' : 'user-' + String(id).slice(0, 40);
  }
  /* IS ER EEN TWEEDE MENS DIE MAG GOEDKEUREN? Geteld en niet aangenomen: de
     eigenaar plus iedereen op de handmatige toegangslijst van de techniekpagina,
     min de aanvrager zelf. Dit gegeven komt NOOIT uit het verzoek -- zou de
     aanvrager het mogen meesturen, dan kiest hij zelf of hij vier ogen nodig
     heeft, en dan is de eis een instelling. */
  function tweedeMensBestaat(req) {
    const t = (db.data && db.data.techniek) || {};
    const lijst = Array.isArray(t.toegang) ? t.toegang : [];
    const ik = String((req.techUser && req.techUser.id) || '');
    const anderen = lijst.map(x => String((x && (x.id || x.user || x)) || '')).filter(x => x && x !== ik);
    return new Set(anderen).size > 0;
  }

  function faal(res, e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'De handeling mislukte.' });
  }

  /* DE STAND VAN DE POORT GAAT MEE, en dat is geen extraatje. De laag loopt in
     de SCHADUW: hij telt wat hij zou sluiten en houdt niets tegen. Precies dat
     getal is wat een mens nodig heeft om te besluiten of hij hem laat bijten --
     en het stond nergens, ook niet op het scherm dat over deze laag gaat. Een
     schaduwronde die niemand kan aflezen, is geen schaduwronde maar een
     stille aanname (CONTROLPLANE.md).

     stand() zegt zelf dat hij niets bewijst zolang `gewogen` nul is. Die zin
     reist mee naar het scherm in plaats van hier te worden herschreven: twee
     formuleringen van dezelfde onzekerheid worden binnen een jaar twee
     verschillende beweringen. */
  app.get('/api/techniek/isolatie', techAuth, eigenaarAlleen, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(Object.assign({}, isolatie.overzicht(),
      { poort: require('../../middleware/isolatiepoort-stand').stand() }));
  });

  /* VERSTRENGEN. Geen bevestigingszin: een drempel voor de veilige keuze duwt
     mensen onder druk naar de onveilige (BESTUUR.md grens 6.10). De reden is
     wel verplicht, want zonder reden is het spoor waardeloos. */
  app.post('/api/techniek/isolatie/zet', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      res.json({ ok: true, uit: isolatie.zet({ drager: b.drager, sleutel: b.sleutel, naar: b.naar,
        door: actor(req), reden: b.reden, zetter: 'huis' }) });
    } catch (e) { faal(res, e); }
  });

  /* DE CEREMONIE STAAT ERNAAST, in ./isolatie-ceremonie.js. Zelfde naad als aan
     de ledenkant en om dezelfde reden: verstrengen is een handeling, verlagen is
     een protocol. De gedeelde gegevens gaan mee in plaats van te worden
     nagebouwd -- wie hier een tweede `tweedeMensBestaat` schrijft, heeft binnen
     een jaar twee antwoorden op dezelfde vraag. */
  require('./isolatie-ceremonie')({ app, kern, isolatie, appUrl, techAuth, eigenaarAlleen,
    actor, tweedeMensBestaat, faal });

  /* DE PROEF. "Wat zou er gebeuren als ik dit pad aanroep met deze dragers in
     deze stand" -- zonder het aan te roepen. Dit is de reden dat het besluit
     verklaard is en geen boolean: een mens die moet beslissen of hij een klant
     dichtzet, wil eerst zien wat dat die klant kost. */
  app.post('/api/techniek/isolatie/proef', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      const ctx = isolatie.context({ organisatie: b.organisatie, identiteit: b.identiteit,
        sessie: b.sessie, apparaat: b.apparaat });
      const paden = Array.isArray(b.paden) ? b.paden.slice(0, 200).map(String) : [];
      const wereld = b.wereld ? String(b.wereld) : 'member';
      const besluiten = paden.map(p => isolatie.besluit({ pad: p, methode: b.methode || 'POST', context: ctx }));
      /* En wat het AI-stuur van diezelfde paden nog zou kunnen kiezen. Dat is
         een ander getal dan "welke routes werken nog": bevoegd zijn en
         beschikbaar zijn vallen hier juist uit elkaar, en dat verschil is het
         hele punt van deze laag. */
      /* HIER MAG DE AANROEPER DE KANALEN WEL KIEZEN, en dat verschil is het
         hele punt van deze route: dit is een WAT-ALS en geen handhaving. Overal
         elders komt de herkomst uit de boekhouding van de lus
         (kern/stuur/besmetting.js) en nooit uit een verzoek -- zou een client
         zijn eigen kanaal mogen opgeven, dan kiest hij zelf hoe streng hij wordt
         behandeld. Op deze proefroute is het omgekeerde nodig: wie besluit of de
         herkomstpoort mag bijten, moet kunnen zien wat onvertrouwde invoer kost. */
      const bronnen = Array.isArray(b.bronnen) ? b.bronnen.slice(0, 13).map(String) : undefined;
      const versmald = filter.versmal(paden, ctx, wereld, bronnen);
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, stand: isolatie.effectieveStand(ctx.standen), besluiten,
        stuur: { over: versmald.paden.length, weggevallen: versmald.weggevallen,
          herkomstSluit: versmald.herkomstSluit || [],
          uitleg: filter.uitleg(versmald.weggevallen) } });
    } catch (e) { faal(res, e); }
  });

  return { isolatie, filter };
};
