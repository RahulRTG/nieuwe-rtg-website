/* Horeca OS (deellaag): HACCP -- temperatuurmetingen, batchnummers met
   houdbaarheidsdatum, en de controlelijsten die een keuken elke dag afvinkt.

   De voorraad zelf (artikelen, recepturen, telling, verspilling, levering)
   staat al in het keukenbrein (kern/keuken.js) en wordt hier niet overgedaan.
   Dit is de laag die de INSPECTEUR wil zien, en die is anders van aard: hij
   gaat niet over hoeveel er ligt, maar over of het veilig is.

   Vier keuzes die hier in de code staan:

   1. EEN METING BUITEN DE GRENS IS EEN AFWIJKING MET EEN VERPLICHTE ACTIE. Je
      kunt geen 9 graden noteren en doorlopen; er hoort bij wat je hebt gedaan
      (weggegooid, teruggekoeld, monteur gebeld). Een logboek vol rode cijfers
      zonder actie is precies wat een inspecteur een boete waard vindt.
   2. NIETS WORDT ACHTERAF GLADGESTREKEN. Een meting corrigeren kan, maar de
      oude waarde blijft staan met wie hem wijzigde en waarom. Zonder dat is
      een temperatuurlogboek een tekening.
   3. EEN BATCH KENT ZIJN HOUDBAARHEID EN ZEGT HET ZELF. Wat over de datum is,
      staat bovenaan met hoeveel dagen -- en het wordt niet automatisch
      afgeboekt: weggooien is een handeling van een mens, met een reden, en die
      loopt via de bestaande verspillingsknop van het keukenbrein.
   4. EEN CONTROLELIJST DIE JE NIET KUNT AFVINKEN ZONDER HEM TE DOEN. Elke
      vraag krijgt een eigen antwoord; "alles akkoord" in een keer bestaat niet
      als knop, want dat is precies hoe die lijsten waardeloos worden. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id } = horeca;

  const HA = (code) => { const h = H(code); if (!h.haccp) h.haccp = { punten: {}, metingen: [], batches: {}, lijsten: {}, afgevinkt: [] }; return h.haccp; };
  const vandaag = () => nu().slice(0, 10);

  /* ---------- meetpunten (koeling, vriezer, warmhoud, afwas) ---------- */
  app.post('/api/supplier/horeca/haccp/punt', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Welk meetpunt? (koeling 1, vriezer, bain-marie)' });
    const min = req.body.min != null ? Number(req.body.min) : null;
    const max = req.body.max != null ? Number(req.body.max) : null;
    if (min == null && max == null) return res.status(400).json({ error: 'Geef een onder- of bovengrens; zonder grens is een meting geen controle.' });
    const key = schoon(req.body.id, 20) || id(3);
    ha.punten[key] = { id: key, naam, min, max, eenheid: schoon(req.body.eenheid, 5) || 'C',
      frequentie: schoon(req.body.frequentie, 30) || 'dagelijks', at: nu() };
    save();
    res.json({ ok: true, punt: ha.punten[key], punten: Object.values(ha.punten) });
  });

  app.post('/api/supplier/horeca/haccp/meting', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const punt = ha.punten[String(req.body.puntId || '')];
    if (!punt) return res.status(404).json({ error: 'Dat meetpunt kennen we niet.' });
    const waarde = Number(req.body.waarde);
    if (!Number.isFinite(waarde)) return res.status(400).json({ error: 'Wat is er gemeten?' });
    const buiten = (punt.min != null && waarde < punt.min) || (punt.max != null && waarde > punt.max);
    const actie = schoon(req.body.actie, 200);
    if (buiten && !actie) return res.status(400).json({
      error: 'Deze waarde ligt buiten de grens (' + [punt.min, punt.max].filter(x => x != null).join(' tot ') + ' ' + punt.eenheid + '). Noteer wat u hebt gedaan; een afwijking zonder actie is geen registratie.',
      afwijking: true });
    const m = { id: id(4), puntId: punt.id, punt: punt.naam, waarde, eenheid: punt.eenheid,
      afwijking: buiten, actie: actie || null, at: nu(), door: req.actor.name, datum: vandaag() };
    ha.metingen.unshift(m);
    ha.metingen = ha.metingen.slice(0, 20000);
    save();
    if (buiten) logActivity(req.supplier.code, req.actor, 'noteerde een HACCP-afwijking op ' + punt.naam + ': ' + waarde + punt.eenheid);
    res.json({ ok: true, meting: m });
  });

  // corrigeren mag, maar de oude waarde blijft staan
  app.post('/api/supplier/horeca/haccp/meting/corrigeer', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const m = ha.metingen.find(x => x.id === String(req.body.metingId || ''));
    if (!m) return res.status(404).json({ error: 'Die meting kennen we niet.' });
    const waarde = Number(req.body.waarde);
    const reden = schoon(req.body.reden, 160);
    if (!Number.isFinite(waarde) || !reden) return res.status(400).json({ error: 'Geef de juiste waarde en waarom hij wordt gecorrigeerd.' });
    m.correcties = (m.correcties || []).concat([{ was: m.waarde, wordt: waarde, reden, at: nu(), door: req.actor.name }]);
    m.waarde = waarde;
    const punt = ha.punten[m.puntId];
    m.afwijking = punt ? ((punt.min != null && waarde < punt.min) || (punt.max != null && waarde > punt.max)) : m.afwijking;
    save();
    res.json({ ok: true, meting: m, let: 'De oorspronkelijke waarde blijft staan; een logboek dat je kunt gladstrijken is een tekening.' });
  });

  app.post('/api/supplier/horeca/haccp/logboek', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const van = schoon(req.body.van, 10) || '0000-00-00';
    const tot = schoon(req.body.tot, 10) || '9999-99-99';
    const rijen = ha.metingen.filter(m => m.datum >= van && m.datum <= tot);
    const open = rijen.filter(m => m.afwijking);
    res.json({ ok: true, punten: Object.values(ha.punten), aantal: rijen.length,
      afwijkingen: open.length, metingen: rijen.slice(0, 500),
      gemistVandaag: Object.values(ha.punten).filter(p => !ha.metingen.some(m => m.puntId === p.id && m.datum === vandaag())).map(p => p.naam),
      let: 'Wat vandaag nog niet gemeten is, staat er als gemist bij -- een leeg logboek ziet er anders precies zo uit als een goed logboek.' });
  });

  /* ---------- batches en houdbaarheid ---------- */
  app.post('/api/supplier/horeca/haccp/batch', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const naam = schoon(req.body.naam, 60);
    const tht = schoon(req.body.tht, 10);
    if (!naam || !tht) return res.status(400).json({ error: 'Geef het product en de houdbaarheidsdatum (THT).' });
    const b = { id: id(4), naam, tht, batch: schoon(req.body.batch, 40) || null,
      leverancier: schoon(req.body.leverancier, 60) || null,
      hoeveelheid: schoon(req.body.hoeveelheid, 20) || null,
      ontvangen: schoon(req.body.ontvangen, 10) || vandaag(), at: nu(), door: req.actor.name, weg: false };
    ha.batches[b.id] = b;
    save();
    res.json({ ok: true, batch: b });
  });

  app.post('/api/supplier/horeca/haccp/batches', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const nuDag = vandaag();
    const dagen = (d) => Math.round((Date.parse(d) - Date.parse(nuDag)) / 86400000);
    const rijen = Object.values(ha.batches).filter(b => !b.weg).map(b => ({
      id: b.id, naam: b.naam, batch: b.batch, tht: b.tht, leverancier: b.leverancier,
      hoeveelheid: b.hoeveelheid, dagenTeGaan: dagen(b.tht) }))
      .map(b => Object.assign(b, { over: b.dagenTeGaan < 0 }))
      .sort((a, c) => a.dagenTeGaan - c.dagenTeGaan);
    res.json({ ok: true, aantal: rijen.length, over: rijen.filter(b => b.over).length,
      bijnaOver: rijen.filter(b => !b.over && b.dagenTeGaan <= 2).length, batches: rijen.slice(0, 500),
      let: 'Wat over de datum is, wordt niet automatisch afgeboekt: weggooien is een handeling van een mens, met een reden (de verspillingsknop van de keuken).' });
  });

  app.post('/api/supplier/horeca/haccp/batch/weg', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const b = ha.batches[String(req.body.batchId || '')];
    if (!b) return res.status(404).json({ error: 'Die batch kennen we niet.' });
    const reden = schoon(req.body.reden, 120);
    if (!reden) return res.status(400).json({ error: 'Waarom gaat deze batch eraf? (opgemaakt, over de datum, teruggeroepen)' });
    b.weg = true; b.wegReden = reden; b.wegAt = nu(); b.wegDoor = req.actor.name;
    save();
    logActivity(req.supplier.code, req.actor, 'boekte batch ' + b.naam + ' af: ' + reden);
    res.json({ ok: true, batch: b });
  });

  /* De controlelijsten staan in ./haccp-lijsten.js. Een lijst is geen meting:
     hij kent geen grens en geen afwijking, alleen gedaan of niet gedaan. Een
     inspecteur kijkt er ook anders naar -- bij een meting wil hij zien dat er
     is ingegrepen, bij een lijst dat hij elke dag is afgelopen. */
  require('./haccp-lijsten')(kern);
};
