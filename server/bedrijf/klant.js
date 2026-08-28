/* RTG Werk OS (deellaag): klanten en verkoop -- een klantbeeld over alle
   RTG-producten heen.

   Vier keuzes, en ze gaan alle vier over eerlijk tellen:

   1. EEN VERLOREN KANS VRAAGT EEN REDEN. Zonder die reden leert een
      verkooptrechter niets: je ziet dat het misging maar nooit waardoor. Een
      gewonnen kans vraagt een bedrag -- "gewonnen" zonder getal is een gevoel.
   2. DE PIJPLIJN IS GEWOGEN, GEEN VOORSPELLING. Elke fase heeft een kans, het
      antwoord toont de rekensom (bedrag maal kans) en noemt het geen prognose.
      Een prognose hoort pas te bestaan als er genoeg afgesloten kwartalen zijn
      om hem aan te toetsen.
   3. ER IS GEEN KLANTWAARDE-SCORE. Wat een klant afneemt staat er; een cijfer
      dat mensen rangschikt op hun waarde hoort niet in een systeem waarin ook
      de servicedesk kijkt.
   4. WELKE RTG-PRODUCTEN EEN KLANT GEBRUIKT, IS EEN KOPPELING EN GEEN KOPIE.
      Er staat een verwijzing (zaakcode, schoolcode, werkruimte), geen tweede
      administratie van diezelfde klant. Dat is LAT-regel 4 op de plek waar de
      verleiding het grootst is. */
'use strict';

const FASEN = [
  { id: 'lead', naam: 'Lead', kans: 10 },
  { id: 'gesprek', naam: 'Gesprek', kans: 30 },
  { id: 'demo', naam: 'Demo gegeven', kans: 50 },
  { id: 'offerte', naam: 'Offerte uit', kans: 70 },
  { id: 'gewonnen', naam: 'Gewonnen', kans: 100 },
  { id: 'verloren', naam: 'Verloren', kans: 0 }
];
const PRODUCTEN = ['horeca-os', 'school-os', 'werk-os', 'betalingen', 'communicatie', 'bezorging', 'consument'];

const EENHEID = require('../kern/geld/eenheid');

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;

  const K = (w) => { if (!w.klanten) w.klanten = {}; return w.klanten; };
  const KA = (w) => { if (!w.kansen) w.kansen = {}; return w.kansen; };
  /* HEET NIET MEER `centen`. Die naam betekende in dit huis drie dingen: hier
     euro->cent, in kern/util.js euro->euro (afronden) en in kern/horeca.js
     alleen afronden. Zie de kop van kern/geld/eenheid.js; de grens die hier
     stond blijft staan. */
  const naarCenten = (x) => Math.min(1000000000, EENHEID.naarCenten(Math.max(0, Number(x) || 0)) || 0);
  const faseVan = (id) => FASEN.find(f => f.id === id) || null;

  app.post('/api/bedrijf/klant/zet', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de klant?' });
    const id = schoon(req.body.klantId, 20) || rid(5);
    const bestaand = eigenVeld(K(g.w), id);
    const k = bestaand || { id, contacten: [], producten: [], at: nu() };
    k.naam = naam;
    k.land = schoon(req.body.land, 2).toUpperCase() || k.land || 'NL';
    k.branche = schoon(req.body.branche, 40) || k.branche || null;
    k.kvk = schoon(req.body.kvk, 20) || k.kvk || null;
    k.eigenaar = schoon(req.body.eigenaar, 60) || k.eigenaar || g.l.naam;
    if (Array.isArray(req.body.contacten)) {
      k.contacten = req.body.contacten.slice(0, 20).map(c => ({
        naam: schoon(c && c.naam, 60), rol: schoon(c && c.rol, 40) || null,
        email: schoon(c && c.email, 80) || null, telefoon: schoon(c && c.telefoon, 24) || null
      })).filter(c => c.naam);
    }
    K(g.w)[k.id] = k;
    save();
    res.json({ ok: true, klant: k });
  });

  /* Welke RTG-producten deze klant afneemt. Een VERWIJZING naar de plek waar
     dat product zijn eigen administratie heeft, nooit een kopie ervan. */
  app.post('/api/bedrijf/klant/product', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const k = eigenVeld(K(g.w), String(req.body.klantId || ''));
    if (!k) return res.status(404).json({ error: 'Die klant kennen we niet.' });
    const product = String(req.body.product || '');
    if (!PRODUCTEN.includes(product)) return res.status(400).json({ error: 'Kies een product: ' + PRODUCTEN.join(', ') + '.' });
    const verwijzing = schoon(req.body.verwijzing, 40);
    if (!verwijzing) return res.status(400).json({ error: 'Geef de code waarmee dit product deze klant kent (zaakcode, schoolcode, werkruimte). Zonder verwijzing is dit een tweede administratie.' });
    const bestaand = k.producten.find(p => p.product === product);
    if (bestaand) { bestaand.verwijzing = verwijzing; bestaand.sinds = schoon(req.body.sinds, 10) || bestaand.sinds; }
    else k.producten.push({ product, verwijzing, sinds: schoon(req.body.sinds, 10) || dag(), at: nu() });
    save();
    res.json({ ok: true, klant: { id: k.id, naam: k.naam, producten: k.producten },
      let: 'Dit is een verwijzing naar de administratie van dat product, geen kopie ervan.' });
  });

  app.post('/api/bedrijf/klant', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const id = String(req.body.klantId || '');
    if (id) {
      const k = eigenVeld(K(g.w), id);
      if (!k) return res.status(404).json({ error: 'Die klant kennen we niet.' });
      const kansen = Object.values(KA(g.w)).filter(x => x.klantId === k.id);
      return res.json({ ok: true, klant: k, kansen,
        let: 'Wat deze klant afneemt staat hier als verwijzing. Er staat geen waarde-per-klant-score in; die maakt van klanten een rangorde.' });
    }
    const rijen = Object.values(K(g.w)).map(k => ({ id: k.id, naam: k.naam, land: k.land,
      branche: k.branche, eigenaar: k.eigenaar, producten: k.producten.map(p => p.product) }));
    res.json({ ok: true, aantal: rijen.length, klanten: rijen, producten: PRODUCTEN });
  });

  /* ---------- verkoopkansen ---------- */
  app.post('/api/bedrijf/kans/maak', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const k = eigenVeld(K(g.w), String(req.body.klantId || ''));
    if (!k) return res.status(404).json({ error: 'Bij welke klant hoort deze kans?' });
    const titel = schoon(req.body.titel, 100);
    if (!titel) return res.status(400).json({ error: 'Waar gaat deze kans over?' });
    const ka = { id: rid(5), klantId: k.id, klant: k.naam, titel,
      product: PRODUCTEN.includes(String(req.body.product)) ? String(req.body.product) : null,
      bedragCenten: req.body.bedrag != null ? naarCenten(req.body.bedrag) : 0,
      fase: 'lead',
      verwacht: schoon(req.body.verwacht, 10) || null, historie: [], at: nu() };
    const eig = sctx.zetWie(g.w, ka, 'eigenaar', schoon(req.body.eigenaar, 60) || g.l.naam);
    KA(g.w)[ka.id] = ka;
    save();
    res.json({ ok: true, kans: ka, fasen: FASEN, eigenaarLet: eig.reden });
  });

  app.post('/api/bedrijf/kans/fase', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const ka = eigenVeld(KA(g.w), String(req.body.kansId || ''));
    if (!ka) return res.status(404).json({ error: 'Die kans kennen we niet.' });
    const f = faseVan(String(req.body.fase || ''));
    if (!f) return res.status(400).json({ error: 'Kies een fase: ' + FASEN.map(x => x.id).join(', ') + '.' });
    if (ka.fase === 'gewonnen' || ka.fase === 'verloren')
      return res.status(409).json({ error: 'Deze kans is al ' + ka.fase + '. Maak een nieuwe kans voor een vervolg.' });

    const reden = schoon(req.body.reden, 200);
    if (f.id === 'verloren' && !reden)
      return res.status(400).json({ error: 'Waarom is deze kans verloren? Zonder die reden leert de trechter niets: je ziet dat het misging, maar nooit waardoor.' });
    if (f.id === 'gewonnen') {
      const bedrag = req.body.bedrag != null ? naarCenten(req.body.bedrag) : ka.bedragCenten;
      if (!bedrag) return res.status(400).json({ error: 'Voor welk bedrag is deze kans gewonnen? "Gewonnen" zonder getal is een gevoel.' });
      ka.bedragCenten = bedrag;
      ka.gewonnenAt = nu();
    }
    ka.historie.push({ van: ka.fase, naar: f.id, reden: reden || null, door: g.l.naam, at: nu() });
    ka.fase = f.id;
    ka.reden = reden || null;
    log(g.w, g.l, 'kans-' + f.id, ka.id, ka.titel + (reden ? ': ' + reden : ''));
    save();
    res.json({ ok: true, kans: ka });
  });

  /* De pijplijn: gewogen, met de rekensom erbij en zonder het woord prognose. */
  app.post('/api/bedrijf/pijplijn', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const alle = Object.values(KA(g.w));
    const open = alle.filter(k => k.fase !== 'gewonnen' && k.fase !== 'verloren');
    const perFase = {};
    let gewogen = 0;
    for (const k of open) {
      const f = faseVan(k.fase);
      const deel = Math.round(k.bedragCenten * f.kans / 100);
      gewogen += deel;
      perFase[k.fase] = perFase[k.fase] || { aantal: 0, bedragCenten: 0, kansPct: f.kans, gewogenCenten: 0 };
      perFase[k.fase].aantal++;
      perFase[k.fase].bedragCenten += k.bedragCenten;
      perFase[k.fase].gewogenCenten += deel;
    }
    const gewonnen = alle.filter(k => k.fase === 'gewonnen');
    const verloren = alle.filter(k => k.fase === 'verloren');
    const redenen = {};
    for (const k of verloren) { const r = k.reden || 'zonder reden'; redenen[r] = (redenen[r] || 0) + 1; }
    res.json({ ok: true, fasen: FASEN,
      open: { aantal: open.length, bedragCenten: open.reduce((t, k) => t + k.bedragCenten, 0), gewogenCenten: gewogen },
      perFase,
      gewonnen: { aantal: gewonnen.length, bedragCenten: gewonnen.reduce((t, k) => t + k.bedragCenten, 0) },
      verloren: { aantal: verloren.length, redenen },
      scoringPct: (gewonnen.length + verloren.length)
        ? Math.round(gewonnen.length / (gewonnen.length + verloren.length) * 1000) / 10 : null,
      let: 'Gewogen is bedrag maal de kans van de fase. Dat is een rekensom en geen prognose: een voorspelling hoort pas te bestaan als er genoeg afgesloten kwartalen zijn om hem aan te toetsen.' });
  });

  sctx.startBron('klanten', 'klant', (g) => {
    const mijn = Object.values(KA(g.w)).filter(k => k.eigenaar === g.l.naam && k.fase !== 'gewonnen' && k.fase !== 'verloren');
    return { openKansen: mijn.length,
      kansen: mijn.slice(0, 8).map(k => ({ id: k.id, titel: k.titel, klant: k.klant, fase: k.fase })) };
  });

  return { FASEN, PRODUCTEN, KLANTEN: K, KANSEN: KA };
};
