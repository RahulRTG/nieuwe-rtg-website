/* Backoffice (deelmodule): HET ROUTEDOSSIER -- WAT WETEN WE VAN DEZE ROUTE?

   WAAROM DIT NAAST DE ROUTEDEKKING STAAT, en niet erin.

   ./office/dekking.js beantwoordt EEN vraag: is deze route tijdens de laatste
   suite aangeraakt? Dat is een goede vraag en het is de smalste van de twee.
   "Aangeraakt" zegt niet dat de deur op slot zit, niet dat een verkeerde rol
   eruit wordt gehouden, niet dat rommel wordt geweigerd, en niet dat er een
   spoor achterblijft. Een route kan honderd procent gedekt zijn en op elf
   schakels ongemeten.

   Die elf schakels worden al gemeten -- door de poortwacht, de rolproef, de
   invoerproef, de staatproef en de ketenronde -- en ze werden alleen nergens
   getoond. Ze stonden in BEWIJSMATRIX.json in de wortel van de repo: een bestand
   dat alleen iemand met een terminal ooit ziet. Datzelfde bezwaar gold voor de
   dekkingsmeting en daar is een scherm voor gemaakt; hier gold het voor elf keer
   zoveel informatie.

   HET REKENT MET DEZELFDE FUNCTIE ALS DE RATEL.

   scripts/bewijsmatrix.js bouw() stelt de matrix samen uit de vijf registers, en
   dat is de functie die de poort ook draait. Deze module roept HEM aan -- geen
   tweede samenstelling die uit de eerste kan lopen (LAT.md regel 4). Dat is
   dezelfde keuze als bij kern/routedekking.js, en om dezelfde reden: bij een
   cijfer dat mensen moeten kunnen vertrouwen mag er maar een optelling zijn.

   WAT ER WEL ANDERS IS, EN BEWUST: DE ROUTELIJST KOMT UIT DEZE SERVER.

   bouw() haalt zijn routetabel normaal op door scripts/routekaart.js te starten
   -- dat boot een hele tweede server. Binnen een lopend verzoek mag dat niet, en
   het hoeft ook niet: deze server KENT zijn routes (app._routes()). Die tabel
   wordt dus geinjecteerd. Gevolg, en dat is winst: het kantoor ziet de matrix
   van de router die hier nu draait. Een route die na de laatste meetronde is
   bijgekomen valt meteen op als ongemeten, zonder dat er eerst iets hoeft te
   draaien.

   EN ALS ER GEEN REGISTER IS, ZEGT HET DAT. Geen nul, geen honderd, maar
   "ongemeten" met de reden erbij. Een meter zonder invoer hoort niet stil een
   cijfer te tonen dat op niets rust (LAT.md regel 3). */
'use strict';
const fs = require('fs');
const path = require('path');
const matrix = require('../../../scripts/bewijsmatrix');

const WORTEL = path.join(__dirname, '../../..');
/* De vijf registers plus het journaal. Verandert er een, dan is het dossier
   verouderd en wordt het opnieuw samengesteld -- wie een meetronde draait hoort
   dit scherm te zien bijkomen zonder de server te herstarten. */
const BRONNEN = ['POORTWACHT.json', 'ROLPROEF.json', 'INVOERPROEF.json',
  'IDEMPROEF.json', 'STAATPROEF.json', 'KETENS.json', '.routejournaal'];

module.exports = (octx) => {
  const { app, officeAuth } = octx.kern;

  /* De vingerafdruk van de bronnen: hun tijdstempels bij elkaar. Ontbreekt een
     bestand, dan telt het als 0 -- dan verandert de vingerafdruk zodra hij er
     WEL is, en dat is precies het moment waarop opnieuw samenstellen moet. */
  function stempel() {
    return BRONNEN.map(n => {
      try { return n + ':' + fs.statSync(path.join(WORTEL, n)).mtimeMs; }
      catch (e) { return n + ':0'; }
    }).join('|');
  }

  /* De routetabel en de bewakers uit DEZE server, in de vorm die bouw() vraagt.
     Zonder deze injectie start bouw() een tweede server op (routekaart.js) en
     leest hij de brontekst van 458 bestanden -- allebei ondenkbaar binnen een
     verzoek.

     `waar` blijft bewust null. Dat veld draagt normaal "bestand:regel" uit een
     scan over de brontekst, en die scan hoort niet in een lopende server thuis.
     Een verzonnen plek zou erger zijn dan geen plek: hij stuurt iemand die een
     gat naloopt naar het verkeerde bestand. */
  let injectieCache = null;
  function injectie() {
    if (injectieCache) return injectieCache;
    const lagen = typeof app._routes === 'function' ? app._routes() : [];
    /* kern/routedekking.js weet wat een route is (methode + patroon) en hoe je
       uit de laagreeks de bewakers afleidt. Dat hoort daar en niet hier. */
    const inv = require('../../kern/routedekking').inventaris(lagen);
    const routes = [];
    const bewakers = new Map();
    for (const r of inv.routes) {
      if (!r.pad.startsWith('/api/')) continue;   // bouw() rekent over het API-vlak
      routes.push({ methode: r.methode, pad: r.pad });
      bewakers.set(r.methode + ' ' + r.pad,
        { bewakers: Array.isArray(r.bewakers) ? r.bewakers : [], waar: null });
    }
    injectieCache = {
      tabel: { routes, herkomst: 'de router van deze server (app._routes)', gedegradeerd: false },
      bewakers
    };
    return injectieCache;
  }

  let cache = null;
  function dossier() {
    const nu = stempel();
    if (cache && cache.stempel === nu) return cache.matrix;
    const { tabel, bewakers } = injectie();
    const m = matrix.bouw({ tabel, bewakers });
    cache = { stempel: nu, matrix: m };
    return m;
  }

  /* De elf schakels met hun uitleg en hun bron, zodat het scherm niet zijn eigen
     woordenlijst hoeft bij te houden -- die zou uit scripts/bewijsmatrix.js
     lopen zodra daar een schakel bij komt. */
  const schakels = () => matrix.SCHAKELS.map(s => ({
    id: s.id, uitleg: s.uitleg,
    bron: s.bron || null,
    /* GEEN INSTRUMENT is iets anders dan NIET GEMETEN, en dat verschil hoort op
       het scherm te staan. OUTPUT en AUDIT staan op ongemeten voor ELKE route,
       niet omdat iemand vergeten is te meten maar omdat er niets bestaat dat het
       meet. Wie dat niet ziet, leest die twee kolommen als achterstallig werk. */
    nodig: s.nodig || null
  }));

  function overzicht(vraag) {
    const m = dossier();
    const v = vraag || {};
    const zoek = String(v.zoek || '').trim().toLowerCase().slice(0, 120);
    const schakel = String(v.schakel || '').trim().slice(0, 20);
    const staat = String(v.staat || '').trim().slice(0, 20);

    let rijen = m.rijen;
    if (zoek) rijen = rijen.filter(r => (r.methode + ' ' + r.pad).toLowerCase().includes(zoek));

    /* DRIE FILTERVORMEN, en de middelste is de reparatie van een echte fout.

       schakel + staat  "laat me alle routes zien waarvan ACL ongemeten is".
                        Dat is de vraag waarmee iemand werk oppakt.
       schakel alleen   HET OPENSTAANDE WERK op die schakel. Hier stond eerst
                        `!!r.cellen[schakel]`, en dat is waar voor ELKE route --
                        elke route heeft alle elf cellen. Een klik op een as gaf
                        dus onveranderd 4184 routes terug: een knop die eruitziet
                        alsof hij filtert en niets doet. Erger dan geen knop, want
                        wie hem gebruikt denkt dat dit alle ACL-routes zijn.
                        Nu: alles wat niet bewezen en niet nvt is.
       staat alleen     routes waar die staat ergens voorkomt. */
    if (schakel && staat) rijen = rijen.filter(r => r.cellen[schakel] && r.cellen[schakel].staat === staat);
    else if (schakel) rijen = rijen.filter(r => {
      const c = r.cellen[schakel];
      return c && c.staat !== 'bewezen' && c.staat !== 'nvt';
    });
    else if (staat) rijen = rijen.filter(r => Object.values(r.cellen).some(c => c.staat === staat));

    const limiet = Math.max(1, Math.min(200, Number(v.limiet) || 40));
    const nr = Math.max(1, Number(v.pagina) || 1);
    return {
      herkomst: m.herkomst,
      gedegradeerd: m.gedegradeerd,
      routes: m.routes,
      schakels: schakels(),
      cellen: m.cellen,
      telling: m.telling,
      perSchakel: m.perSchakel,
      journaalGelezen: m.journaalGelezen,
      filter: { zoek, schakel, staat },
      lijst: {
        pagina: nr, limiet, totaal: rijen.length,
        paginas: Math.max(1, Math.ceil(rijen.length / limiet)),
        resultaten: rijen.slice((nr - 1) * limiet, (nr - 1) * limiet + limiet)
      }
    };
  }

  /* Een route in zijn geheel: alle elf cellen met bron en reden. Dit is het
     dossier waar de naam vandaan komt -- niet een cijfer over het huis, maar het
     antwoord op "en wat weten we van DEZE?". */
  function eenRoute(methode, pad) {
    const m = dossier();
    const zoek = String(methode || '').toUpperCase() + ' ' + String(pad || '');
    const rij = m.rijen.find(r => r.methode + ' ' + r.pad === zoek);
    if (!rij) return { gevonden: false, gevraagd: zoek };
    return { gevonden: true, route: rij, schakels: schakels() };
  }

  app.post('/api/office/routedossier', officeAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const b = req.body || {};
    res.json(b.pad ? eenRoute(b.methode, b.pad) : overzicht(b));
  });

  return { overzicht, eenRoute };
};
