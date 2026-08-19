/* School (deelmodule): de verbonden klas. Drie dingen die de klas een
   geheel maken met de rest van het huis:
   - het LERARENTEAM: maximaal drie vaste leraren per klas (samen de klas
     draaien), plus een WAARNEMER: een collega van dezelfde school die de
     klas tijdelijk overneemt bij ziekte of verlof;
   - de ONLINE LES voor thuiswerken: de leraar start hem met een knop, elk
     gezin ziet de kamercode meteen in het klasoverzicht;
   - HUISWERK dat aan een leerdoel uit de leerlijn hangt: het kind oefent
     rechtstreeks vanuit de klas (met feedback, want oefenen mag verklikken)
     en bij vier van de vijf goed vinkt het huiswerk zichzelf af. */
const { DOELEN } = require('../kern/leerstof');
const { opgave } = require('../kern/leerstof-gen');
/* De Misconception Graph: een fout antwoord bij huiswerk wordt geduid en voor
   de KLAS geteld -- zonder wie. Zie ./denkfout.js voor die grens. */
const { duiding, andersUitgelegd } = require('../kern/leerstof-denkfout');
const { tel } = require('./denkfout');

const MAX_LERAREN = 3;
const { totWanneer } = require('./waarneming');
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

module.exports = (sctx) => {
  const { router, save, rid, nu, eigenVeld, K, S, klasVan, personeelVan, gezinSessie, leerlingVan } = sctx;

  /* migratie: oudere klassen hebben een losse leraarId; die wordt de eerste
     van het team. De id's blijven staan, ook decennia later. */
  function lerarenVan(k) {
    if (!Array.isArray(k.leraren)) k.leraren = k.leraarId ? [{ id: k.leraarId, naam: k.leraar || 'Leraar' }] : [];
    return k.leraren;
  }

  /* ---------- het lerarenteam: max drie vast, samen de klas ---------- */
  router.post('/school/klas/team', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    res.json({ ok: true, leraren: lerarenVan(k), max: MAX_LERAREN, waarnemer: k.waarnemer || null });
  });

  router.post('/school/klas/leraar-koppel', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = k.schoolCode ? S()[k.schoolCode] : null;
    const p = sch && eigenVeld(sch.personeel || {}, String(req.body.personeelId || ''));
    if (!p || p.status !== 'actief') return res.status(404).json({ error: 'Dit personeelslid staat niet actief bij deze school.' });
    const team = lerarenVan(k);
    if (team.some(x => x.id === p.id)) return res.json({ ok: true, leraren: team });
    if (team.length >= MAX_LERAREN) return res.status(400).json({ error: 'Er staan al drie leraren vast op deze klas; haal er eerst een van af.' });
    team.push({ id: p.id, naam: p.naam });
    save();
    res.json({ ok: true, leraren: team });
  });

  router.post('/school/klas/leraar-weg', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const team = lerarenVan(k);
    if (team.length <= 1) return res.status(400).json({ error: 'Een klas houdt altijd minstens een vaste leraar.' });
    k.leraren = team.filter(x => x.id !== String(req.body.personeelId || ''));
    if (k.leraren.length === team.length) return res.status(404).json({ error: 'Deze leraar staat niet op de klas.' });
    // de eerste van het team blijft het gezicht van de klas voor de gezinnen
    k.leraarId = k.leraren[0].id; k.leraar = k.leraren[0].naam;
    save();
    res.json({ ok: true, leraren: k.leraren });
  });

  /* ---------- overname: een collega neemt de klas waar ---------- */
  router.post('/school/klas/overname', (req, res) => {
    const auth = personeelVan(req, res); if (!auth) return;
    const { sch, p } = auth;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== sch.code) return res.status(404).json({ error: 'Deze klas hoort niet bij jouw school.' });
    if (p.status !== 'actief') return res.status(403).json({ error: 'Je aanmelding is nog niet goedgekeurd.' });
    if (lerarenVan(k).some(x => x.id === p.id)) return res.status(400).json({ error: 'Je staat al vast op deze klas; overnemen hoeft niet.' });
    /* Een waarneming VERLOOPT. Zonder einddatum is een overname een tweede
       vaste leraar via de achterdeur: hij begint als "even invallen bij ziekte"
       en staat er over een half jaar nog. Veertien dagen als de aanvrager
       niets zegt, negentig als maximum. */
    k.waarnemer = { id: p.id, naam: p.naam, at: nu(), tot: totWanneer(req.body.dagen, Date.now()) };
    save();
    res.json({ ok: true, waarnemer: k.waarnemer,
      uitleg: 'De waarneming loopt tot ' + k.waarnemer.tot.slice(0, 10) + ' en stopt dan vanzelf. Eerder stoppen kan altijd.' });
  });

  router.post('/school/klas/overname-stop', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    k.waarnemer = null; save();
    res.json({ ok: true });
  });

  /* ---------- de online les: thuiswerken met een knop ---------- */
  router.post('/school/les/start', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    if (!k.onlineLes || !k.onlineLes.aan) {
      k.onlineLes = { aan: true, kamercode: 'LES-' + rid(3).toUpperCase(), leraar: (k.waarnemer && k.waarnemer.naam) || (lerarenVan(k)[0] || {}).naam || k.leraar, at: nu() };
      save();
    }
    res.json({ ok: true, onlineLes: k.onlineLes });
  });
  router.post('/school/les/stop', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    k.onlineLes = null; save();
    res.json({ ok: true });
  });

  /* ---------- huiswerk uit de leerlijn: oefenen vanuit de klas ---------- */
  function oefenwerk(k) {
    if (!k.oefenwerk || typeof k.oefenwerk !== 'object') k.oefenwerk = {};
    return k.oefenwerk;
  }
  router.post('/school/huiswerk/oefen', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    if (!l) return res.status(403).json({ error: 'Je zit niet in deze klas.' });
    const h = (k.huiswerk || []).find(x => x.id === String(req.body.huiswerkId || ''));
    const d = h && h.doel ? eigenVeld(DOELEN, h.doel) : null;
    if (!d) return res.status(404).json({ error: 'Dit huiswerk heeft geen oefenbaar leerdoel.' });
    const vragen = [];
    /* Het feit (de bouwstenen van de opgave) reist mee de sessie in en blijft
       op de server: daarmee is een fout antwoord narekenbaar te duiden. */
    for (let i = 0; i < 5; i++) { const o = opgave(d.gen); vragen.push({ v: o.v, a: o.a, opties: o.opties || null, feit: o.feit || null }); }
    oefenwerk(k)[l.sleutel] = { huiswerkId: h.id, vragen, ix: 0, goed: 0 };
    save();
    res.json({ ok: true, doel: h.doel, les: d.les, nr: 1, totaal: 5, vraag: vragen[0].v, opties: vragen[0].opties });
  });

  router.post('/school/huiswerk/oefen-antwoord', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    const w = l && oefenwerk(k)[l.sleutel];
    if (!w) return res.status(400).json({ error: 'Begin eerst met oefenen.' });
    const vraag = w.vragen[w.ix];
    const goed = norm(req.body.antwoord) === norm(vraag.a);
    if (goed) w.goed += 1;
    w.ix += 1;
    const klaar = w.ix >= w.vragen.length;
    // oefenen is leren: hier WEL meteen goed/fout en het juiste antwoord
    const uit = { ok: true, goed, juisteAntwoord: vraag.a, nr: w.ix, totaal: w.vragen.length, klaar };
    if (!goed) {
      const df = duiding(vraag.feit, vraag.a, req.body.antwoord);
      if (df) {
        uit.denkfout = { id: df.id, naam: df.naam, uitleg: df.uitleg };
        const hw = (k.huiswerk || []).find(x => x.id === w.huiswerkId);
        uit.anders = andersUitgelegd(DOELEN[(hw && hw.doel) || ''], df);
        tel(k, (hw && hw.doel) || '', df.id, nu());
      }
    }
    if (klaar) {
      uit.aantalGoed = w.goed;
      uit.afgevinkt = false;
      if (w.goed >= 4) {
        const h = (k.huiswerk || []).find(x => x.id === w.huiswerkId);
        if (h) { h.afDoor = h.afDoor || []; if (!h.afDoor.includes(l.sleutel)) h.afDoor.push(l.sleutel); uit.afgevinkt = true; }
      } else {
        uit.advies = 'Bijna! Lees de uitleg nog eens en probeer het opnieuw; elke poging is gewoon oefening.';
      }
      delete oefenwerk(k)[l.sleutel];
    } else {
      uit.vraag = w.vragen[w.ix].v;
      uit.opties = w.vragen[w.ix].opties;
    }
    save();
    res.json(uit);
  });
};
