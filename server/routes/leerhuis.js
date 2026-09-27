/* Routes "leerhuis" (RTG Academy, ACADEMY.md): de HTTP-deur naar
   server/kern/leerhuis. Drie routes, en de kern doet het werk.

   DE ACTOR KOMT UIT DE SESSIE, NOOIT UIT HET LIJF (AUTHORITY.md grens 1). Een
   veld `door` of `persoon` van de aanroeper wordt niet gelezen als actor; de
   kern krijgt `lid:<account-id>` uit `req.session.key` en toetst daar zijn
   bestuursrollen, relaties en scheiding van taken op. Dat is blokkade `API` uit
   ACADEMY.md.

   18+ VOOR EEN CERTIFICAAT, NIET VOOR LEREN (ACADEMY.md besluit B5, 27
   september 2026). Leren, oefenen, bewijs en een beoordeling mogen op elke
   leeftijd, in de vorm van het leerdossier: niet vergelijkend en zonder
   blijvend niveaulabel. Een CERTIFICAAT is opgeslagen progressie en krijgt
   alleen wie `volwassen()` haalt (eigen account, A3, 18 of ouder). Wie dat niet
   kan laten vaststellen (een sleutel buiten `lid:`), krijgt er ook geen: fail
   closed. En de vakstaat van wie jonger is, toont geen niveau.

   DUURZAAM (besluit B4). Certificaat uitgeven, schorsen of intrekken en een
   beoordeling afronden antwoorden pas als de opslag ze heeft bevestigd
   (lib/duurzaam.js via de kern). Een 503 daar betekent "onbekend", en de weg is
   eerst navragen (lees `uitkomst`) en dan opnieuw met dezelfde sleutel.

   STANDAARD UIT. De functie `leerhuis` staat uit tot de eigenaar hem aanzet
   (server/functies/register/cat-life2.js): de besluiten B1 tot en met B7
   (ACADEMY.md par. 5) zijn genomen maar nog niet alle uitgevoerd, en een deur
   die niemand bewust heeft geopend hoort dicht.

   EEN SLEUTEL IS VERPLICHT bij elke handeling. De kern is idempotent op die
   sleutel; zonder sleutel is een herhaling een tweede handeling, en bij een
   certificaat is dat precies wat niet mag gebeuren. Wie geen antwoord kreeg,
   vraagt eerst `uitkomst` voordat hij het opnieuw probeert. */
'use strict';

const { maakLeerhuis } = require('../kern/leerhuis');
const { idVanKey } = require('../lib/lidsleutel');
const { maakVolwassen } = require('../kern/volwassen');
/* Zelfde weg als routes/supplier/kassa.js: de bundel komt uit de opslag zelf,
   niet van de kern, zodat de kern er niet breder van wordt. */
const { bijeen, inBundel } = require('../db');

/* Wat een LID mag vragen, en wat alleen het bestuur van de organisatie mag
   lezen. Een lid leest zijn eigen stand; het organisatiebrede beeld
   (gereedheid, eenheid, wie geraakt, reconstructie) is voor wie de Academy
   bestuurt. Een lezer zonder relatie met de organisatie leest niets: ook dat
   is isolatie (grondwet 16). */
const EIGEN_VRAGEN = ['mijn', 'vakstaat', 'trainerCockpit', 'managerCockpit', 'waaromLeren', 'waaromVerversen',
  'waaromNietGereed', 'geschiktheid', 'loopbaan', 'waaromTrainer', 'grond', 'uitkomst'];
const BESTUURSVRAGEN = ['gereedheid', 'eenheid', 'wieGeraakt', 'reconstrueer', 'certStand', 'schaduw'];
const LEESROLLEN = ['ACADEMY_OWNER', 'QUALITY_AUTHORITY', 'KNOWLEDGE_OWNER', 'ASSESSMENT_AUTHORITY'];

module.exports = (kern) => {
  const { app, auth, db, save, accounts, kluisAuth } = kern;
  const leerhuis = maakLeerhuis({ db, save, bijeen, inBundel });
  /* Alleen om de schaduwtellers van besluit B1 te LEZEN; de meelezer zelf hangt
     in opzet/kantoordeur.js. */
  const schaduw = require('../kern/leerhuis/schaduw').maakSchaduw({ db, save });
  /* Dezelfde fabriek als kern.volwassen (opzet/kernlaag1.js), op dezelfde
     accounts: de poort is een pure functie over de kluis, dus een eigen
     exemplaar is dezelfde regel en geen tweede -- en de kern wordt er niet
     breder van (de ratel kernBreedte). */
  const volwassen = maakVolwassen({ accounts });

  function actor(req, res) {
    const id = idVanKey(req.session && req.session.key);
    if (id == null) { res.status(403).json({ error: 'Het leerhuis hoort bij een eigen RTG-account.' }); return null; }
    return 'lid:' + id;
  }
  /* Is deze persoon aantoonbaar 18+? Alleen een lid met een account kan dat
     laten vaststellen; elke andere sleutel is "niet vast te stellen" en telt
     dus als nee. */
  const volwassenLid = (persoon) => {
    const m = /^lid:(\d+)$/.exec(String(persoon || ''));
    return !!(m && volwassen('user-' + m[1]));
  };
  const stuur = (res, r) => (r && r.ok === false)
    ? res.status(r.status || 400).json({ error: r.reden, hoe: r.hoe || null, opbouw: r.opbouw || null })
    : res.json(Object.assign({ ok: true }, r));

  app.post('/api/leerhuis/doe', auth, async (req, res) => {
    const door = actor(req, res); if (!door) return;
    const b = req.body || {};
    if (b.actie === 'orgOpen') return res.status(403).json({ error: 'Een leerhuis openen doet het kantoor op naam.', hoe: 'POST /api/office/leerhuis/open' });
    const sleutel = String(b.sleutel || req.get('idempotency-key') || '').slice(0, 80);
    if (!sleutel) return res.status(400).json({ error: 'Elke handeling draagt een sleutel; zonder sleutel is een herhaling een tweede handeling.' });
    const invoer = b.invoer || {};
    if (b.actie === 'certificaatUitgeven' && !volwassenLid(invoer.persoon))
      return res.status(403).json({ error: 'Een certificaat krijgt alleen wie aantoonbaar 18 of ouder is.',
        hoe: 'leren, oefenen en bewijs gaan gewoon door; zie ACADEMY.md besluit B5' });
    stuur(res, await leerhuis.doeVast(String(b.org || ''), String(b.actie || ''), invoer, door, { sleutel }));
  });

  app.post('/api/leerhuis/lees', auth, (req, res) => {
    const door = actor(req, res); if (!door) return;
    const b = req.body || {};
    const org = String(b.org || '');
    const vraag = String(b.vraag || '');
    const st = leerhuis.stand(org);
    if (!st.org) return res.status(404).json({ error: 'Deze organisatie heeft geen leerhuis.' });
    const rel = st.relaties[door];
    if (!rel || !rel.actief) return res.status(403).json({ error: 'U heeft geen lopende relatie met deze organisatie.' });
    const l = leerhuis.lees;
    if (EIGEN_VRAGEN.includes(vraag)) {
      /* Altijd over DE LEZER zelf: een ander vakstaat of geschiktheid opvragen
         kan hier niet, ook niet met een veld in het lijf. */
      /* Wie jonger is of zijn leeftijd niet kan laten vaststellen, ziet zijn
         vaardigheden zonder niveaulabel (het leerdossier, besluit B5). */
      const zonderNiveau = (v) => (volwassenLid(door) || !v) ? v
        : Object.assign({}, v, { vaardigheden: (v.vaardigheden || []).map(x => Object.assign({}, x, { niveau: null })) });
      const a = { mijn: () => { const m = l.mijn(org, door); return Object.assign({}, m, { VAARDIGHEDEN: zonderNiveau(m.VAARDIGHEDEN) }); },
        vakstaat: () => zonderNiveau(l.vakstaat(org, door)),
        trainerCockpit: () => l.trainerCockpit(org, door), managerCockpit: () => l.managerCockpit(org, door),
        waaromLeren: () => l.waaromLeren(org, door, String(b.curriculum || '')), waaromVerversen: () => l.waaromVerversen(org, door),
        waaromNietGereed: () => l.waaromNietGereed(org, door, String(b.rol || '')),
        geschiktheid: () => l.geschiktheid(org, door, String(b.handeling || '')), loopbaan: () => l.loopbaan(org, door, String(b.rol || '')),
        waaromTrainer: () => l.waaromTrainer(org, String(b.trainer || door), String(b.curriculum || '')),
        grond: () => l.grond(org, String(b.tekst || '')),
        /* Navragen voor opnieuw proberen, maar alleen over de EIGEN sleutels. */
        uitkomst: () => { const r = st.sleutels[String(b.sleutel || '')];
          return r && r.door === door ? leerhuis.uitkomst(org, String(b.sleutel)) : { bekend: false }; } }[vraag];
      return res.json({ ok: true, vraag, antwoord: a() });
    }
    if (BESTUURSVRAGEN.includes(vraag)) {
      if (!LEESROLLEN.some(r => (st.bestuur[door] || []).includes(r)))
        return res.status(403).json({ error: 'Het organisatiebrede beeld is voor het bestuur van de Academy.' });
      const a = { gereedheid: () => l.gereedheid(org, b.eisen || {}), eenheid: () => l.eenheid(org),
        wieGeraakt: () => l.wieGeraakt(org, String(b.kennis || ''), b.klasse || null),
        reconstrueer: () => l.reconstrueer(org, String(b.certificaat || '')), certStand: () => l.certStand(org, String(b.certificaat || '')), schaduw: () => schaduw.stand() }[vraag];
      return res.json({ ok: true, vraag, antwoord: a() });
    }
    res.status(400).json({ error: 'Onbekende vraag.', vragen: EIGEN_VRAGEN.concat(BESTUURSVRAGEN) });
  });

  /* Besluit B6: het leerhuis van een organisatie opent een mens van het kantoor
     OP NAAM, nooit de gedeelde code. De eerste eigenaar is een lid met een
     account; de opener staat als actor in de eerste regel van het spoor. */
  app.post('/api/office/leerhuis/open', kluisAuth, async (req, res) => {
    const id = idVanKey(req.kantoorKey);
    if (id == null) return res.status(403).json({ error: 'Een leerhuis opent een mens van het kantoor op naam.' });
    const b = req.body || {};
    const eigenaar = idVanKey(String(b.eigenaar || ''));
    if (eigenaar == null) return res.status(400).json({ error: 'De eerste eigenaar is een lid (user-<id>).' });
    stuur(res, await leerhuis.doeVast(String(b.id || ''), 'orgOpen',
      { id: b.id, soort: b.soort, naam: b.naam, eigenaar: 'lid:' + eigenaar }, 'lid:' + id, { sleutel: 'open:' + String(b.id || '') }));
  });
};
