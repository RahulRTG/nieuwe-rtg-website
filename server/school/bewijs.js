/* School (deelmodule): bewijs van beheersing -- de kant van de leraar.

   Het leerpaspoort van een kind hoort niet alleen te weten wat het zelf heeft
   geoefend. Een leraar ziet dingen die geen oefensessie kan meten: dat een
   leerling het uitlegt aan een ander, dat hij het aan het bord voordoet, dat
   het bij een praktijkopdracht klopte. Dat is bewijs, en het hoort in het
   paspoort te landen met de naam van wie het zag.

   Drie grenzen die dit eerlijk houden:

   1. EEN OBSERVATIE HEEFT EEN NAAM. Ze wordt vastgelegd met de leraar erbij;
      een anonieme bevestiging is geen bevestiging.
   2. DE LERAAR ZIET GEEN HEEL PASPOORT. Hij ziet, per leerdoel dat in ZIJN
      klas aan de orde is, hoe stevig het staat -- niet wat een kind thuis of
      op een andere school heeft gedaan. Wat hij nodig heeft om les te geven,
      niet meer.
   3. ER KOMT GEEN CIJFER UIT. De beheersing is een woord met de reden erbij.
      Een getal hier zou binnen een maand een ranglijst van kinderen zijn.

   Het bewijs uit een becijferde toets loopt niet hierlangs maar direct vanuit
   school/toets.js: dat is dezelfde handeling en hoort niet twee keer gedaan
   te hoeven worden. */
module.exports = (sctx) => {
  const { router, schoon, klasVan, onderwijs, rtfHandle } = sctx;

  const kern = () => (typeof onderwijs === 'function' ? onderwijs() : null);
  const handleVan = (k, sleutel) => {
    const l = (k.leerlingen || []).find(x => x.sleutel === sleutel);
    return l && l.gezinCode && l.profielId && rtfHandle ? rtfHandle(l.gezinCode, l.profielId) : null;
  };
  // de leerdoelen die in deze klas aan de orde zijn: uit de toetsen en het huiswerk
  const doelenVanKlas = (k) => [...new Set([].concat(
    ...(k.toetsen || []).map(t => t.doelen || []),
    (k.huiswerk || []).map(h => h.doel).filter(Boolean)))];

  /* ---------- een observatie vastleggen ---------- */
  router.post('/school/bewijs/observatie', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const o = kern();
    if (!o) return res.status(503).json({ error: 'Het leerpaspoort is nu niet bereikbaar.' });
    const doel = String(req.body.doel || '').trim();
    const handle = handleVan(k, String(req.body.leerling || ''));
    if (!handle) return res.status(404).json({ error: 'Deze leerling heeft geen eigen leerlingprofiel; er is dus geen paspoort om in te schrijven.' });
    const notitie = schoon(req.body.notitie, 120);
    if (!notitie) return res.status(400).json({ error: 'Noteer kort wat u hebt gezien. Een observatie zonder waarneming is een vinkje.' });
    const uit = o.doelBehaald(handle, { doel, fase: k.fase || null,
      bewijs: { soort: 'observatie', detail: notitie, door: k.leraar || 'de leraar' } },
      { vanSchool: true });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json({ ok: true, doel, beheersing: uit.beheersing,
      uitleg: 'Vastgelegd met uw naam erbij. De leerling ziet dit terug bij "waarom denkt RTG dat ik dit kan?".' });
  });

  /* ---------- hoe stevig staat het, voor de doelen van deze klas ---------- */
  router.post('/school/bewijs/leerling', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const o = kern();
    if (!o) return res.status(503).json({ error: 'Het leerpaspoort is nu niet bereikbaar.' });
    const handle = handleVan(k, String(req.body.leerling || ''));
    if (!handle) return res.status(404).json({ error: 'Deze leerling heeft geen eigen leerlingprofiel.' });
    const alles = o.bewijsVan(handle, {});
    const vanKlas = doelenVanKlas(k);
    const rijen = (alles.doelen || []).filter(d => vanKlas.includes(d.doel));
    res.json({ ok: true, doelen: rijen, vanDeKlas: vanKlas.length,
      uitleg: 'Alleen de leerdoelen die in deze klas aan de orde zijn, en alleen hoe stevig ze staan. Wat een kind elders deed, staat hier niet.' });
  });
};
