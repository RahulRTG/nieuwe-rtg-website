/* Routes "leerhuis" (RTG Academy, ACADEMY.md): de HTTP-deur naar
   server/kern/leerhuis. Drie routes, en de kern doet het werk.

   DE ACTOR KOMT UIT DE SESSIE, NOOIT UIT HET LIJF (AUTHORITY.md grens 1): de
   kern krijgt `lid:<account-id>` uit `req.session.key`.

   BESLUITEN (ACADEMY.md par. 5). B5: een certificaat alleen voor wie
   `volwassen()` haalt (fail closed), en wie jonger is ziet geen niveau. B4: certificaat en beoordeling antwoorden pas na een
   bevestigde commit; een 503 daar is "onbekend" (eerst `uitkomst`, dan opnieuw
   met dezelfde sleutel). B2: de relatie komt uit de bron van het leerhuis.
   B7: een startpakket zet concepten klaar via dezelfde handelingen.

   STANDAARD UIT (functie `leerhuis`), en elke handeling draagt een SLEUTEL. */
'use strict';

const { maakLeerhuis } = require('../kern/leerhuis');
const { relatieActief } = require('../kern/leerhuis/oordeel');
const { idVanKey } = require('../lib/lidsleutel');
const { maakVolwassen } = require('../kern/volwassen');
const { maakNaamVan, metNamen } = require('../kern/leerhuis/namen');
/* De bundel komt uit de opslag zelf (zoals supplier/kassa.js), niet van de kern. */
const { bijeen, inBundel } = require('../db');

/* Wat een LID mag vragen, en wat alleen het bestuur van de organisatie mag
   lezen. Een lezer zonder relatie met de organisatie leest niets: ook dat is
   isolatie (grondwet 16). */
const EIGEN_VRAGEN = ['mijn', 'vakstaat', 'trainerCockpit', 'managerCockpit', 'assessorWerk', 'kennisWerk', 'curriculumWerk', 'waaromLeren', 'waaromVerversen',
  'waaromNietGereed', 'geschiktheid', 'loopbaan', 'waaromTrainer', 'grond', 'uitkomst'];
const BESTUURSVRAGEN = ['gereedheid', 'eenheid', 'wieGeraakt', 'reconstrueer', 'certStand', 'schaduw', 'startpakket'];
const LEESROLLEN = ['ACADEMY_OWNER', 'QUALITY_AUTHORITY', 'KNOWLEDGE_OWNER', 'ASSESSMENT_AUTHORITY'];

module.exports = (kern) => {
  const { app, auth, db, save, accounts, kluisAuth, employmentVanPersoon, entiteitVind } = kern;
  /* Besluit B2: de relatie komt uit de bron van het leerhuis (kern/leerhuis/bron.js).
     rtfos wordt pas NA dit bestand opgehangen (opzet/kernlaag7.js), dus die
     bron wordt bij de vraag opgezocht en niet bij het ophangen. */
  const rtfInStad = (key, stad) => !!(kern.rtfos && kern.rtfos.vrijwilligerportaal.account.inStad(key, stad));
  const bronToets = require('../kern/leerhuis/bron').maakBronToets({ accounts, employmentVanPersoon, entiteitVind, rtfInStad });
  const leerhuis = maakLeerhuis({ db, save, bijeen, inBundel, bronToets });
  /* Alleen de schaduwtellers van B1 LEZEN; de meelezer hangt in opzet/kantoordeur.js. */
  const schaduw = require('../kern/leerhuis/schaduw').maakLeerhuisSchaduw({ db, save });
  /* Dezelfde fabriek als kern.volwassen: de kern wordt niet breder (kernBreedte). */
  const volwassen = maakVolwassen({ accounts });
  /* Een cockpit toont mensen op codenaam. */
  const naamVan = maakNaamVan((k) => kern.codenaamVan(k));

  function actor(req, res) {
    const id = idVanKey(req.session && req.session.key);
    if (id == null) { res.status(403).json({ error: 'Het leerhuis hoort bij een eigen RTG-account.' }); return null; }
    return 'lid:' + id;
  }
  /* Aantoonbaar 18+? Alleen een lid met een account; anders telt het als nee. */
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
    if (b.actie === 'startpakketLaden') return stuur(res, leerhuis.startpakketLaden(String(b.org || ''), door));
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
    /* De ene regel uit de kern en geen eigen kopie: een kopie las alleen het
       spoor en sloeg de bron over (routetoets 8 vond het: wie uit dienst was,
       las nog mee). */
    if (!relatieActief(st, door)) return res.status(403).json({ error: 'U heeft geen lopende relatie met deze organisatie.' });
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
        trainerCockpit: () => metNamen(l.trainerCockpit(org, door), naamVan), managerCockpit: () => metNamen(l.managerCockpit(org, door), naamVan),
        assessorWerk: () => metNamen(l.assessorWerk(org, door), naamVan), kennisWerk: () => l.kennisWerk(org, door), curriculumWerk: () => l.curriculumWerk(org, door),
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
        reconstrueer: () => l.reconstrueer(org, String(b.certificaat || '')), certStand: () => l.certStand(org, String(b.certificaat || '')), schaduw: () => schaduw.stand(),
        startpakket: () => l.startpakket(org) }[vraag];
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
    /* Met een bron moet de eerste eigenaar er zelf in staan: anders opent het
       kantoor een leerhuis waarin niemand iets mag. */
    if (b.bron && bronToets(b.bron, 'lid:' + eigenaar) !== true)
      return res.status(409).json({ error: 'De eerste eigenaar staat niet in de bron van dit leerhuis.' });
    stuur(res, await leerhuis.doeVast(String(b.id || ''), 'orgOpen',
      { id: b.id, soort: b.soort, naam: b.naam, eigenaar: 'lid:' + eigenaar, bron: b.bron || null }, 'lid:' + id, { sleutel: 'open:' + String(b.id || '') }));
  });
};
