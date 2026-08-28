/* School (deelmodule): toetsen op de leerstof-motor. De leraar vinkt
   leerdoelen aan en heeft in een tik een SO, proefwerk of examen klaar; de
   motor maakt voor ELKE leerling verse opgaven (afkijken heeft geen zin) en
   kijkt na. Bij een MO krijgt juist de LERAAR de vragen met antwoorden en
   vinkt hij af tijdens het gesprek. De uitslag is per leerdoel uitgesplitst
   (wat vindt de klas nog moeilijk); het cijfervoorstel is een ADVIES: de
   leraar beslist en zet het met een tik in het bestaande cijferboek. */
const { DOELEN } = require('../kern/leerstof');
const { opgave } = require('../kern/leerstof-gen');

const SOORTEN = { so: 'SO', mo: 'MO (mondeling)', proefwerk: 'Proefwerk', examen: 'Examen' };
const voorstel = (goed, totaal) => Math.round((1 + 9 * (goed / Math.max(1, totaal))) * 10) / 10;

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, K, klasVan, onderwijs, rtfHandle } = sctx;

  /* PROOF OF LEARNING, de brug tussen school en leerpaspoort.

     Tot nu toe landde een becijferde toets alleen in het cijferboek van de
     klas. Het leerpaspoort van het kind -- het ding dat een leven meegaat --
     wist er niets van, terwijl een toets op een leerdoel juist het sterkste
     bewijs is dat er bestaat: iemand anders heeft het gezien.

     Drie voorwaarden, en bij elke die niet klopt gebeurt er niets:
     - de leerling hangt aan een gezinsprofiel (een administratief geplaatste
       leerling zonder profiel heeft geen paspoort);
     - de onderwijskern is er (bij het opstarten nog niet: dan overslaan);
     - de leerling heeft dat leerdoel in de toets ook echt goed gemaakt. Een
       toets die je fout maakt, is geen bewijs dat je het kunt. */
  function bewijsNaarPaspoort(k, sleutel, t, w, door) {
    const kern = typeof onderwijs === 'function' ? onderwijs() : null;
    if (!kern || !rtfHandle) return 0;
    const l = (k.leerlingen || []).find(x => x.sleutel === sleutel);
    if (!l || !l.gezinCode || !l.profielId) return 0;
    const handle = rtfHandle(l.gezinCode, l.profielId);
    let n = 0;
    for (const doel of t.doelen) {
      const goed = (w.perDoel || {})[doel] || 0;
      // per leerdoel staan er t.perDoel vragen; de helft goed is te weinig bewijs
      if (goed < Math.ceil(t.perDoel * 0.6)) continue;
      const uit = kern.doelBehaald(handle, { doel, fase: k.fase || null,
        bewijs: { soort: 'toets', detail: SOORTEN[t.soort] + ' "' + t.naam + '": ' + goed + ' van ' + t.perDoel + ' goed', door } },
        { vanSchool: true });
      if (uit && uit.ok) n++;
    }
    return n;
  }

  const toetsenVan = k => { if (!Array.isArray(k.toetsen)) k.toetsen = []; return k.toetsen; };
  const maakWerk = (t) => {
    const vragen = [];
    for (const doel of t.doelen) for (let i = 0; i < t.perDoel; i++) {
      const o = opgave(DOELEN[doel].gen);
      vragen.push({ doel, v: o.v, a: o.a, opties: o.opties || null });
    }
    return { vragen, ix: 0, goed: 0, perDoel: {}, klaar: false, at: nu() };
  };
  const uitslagVan = (w) => w && w.klaar ? { goed: w.goed, totaal: w.vragen.length, perDoel: w.perDoel, voorstel: voorstel(w.goed, w.vragen.length) } : null;

  /* ---------- leraar: maken, overzicht, MO afnemen, cijfer geven ---------- */
  router.post('/school/toets/maak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const soort = SOORTEN[String(req.body.soort || '')] ? String(req.body.soort) : null;
    if (!soort) return res.status(400).json({ error: 'Kies so, mo, proefwerk of examen.' });
    const doelen = [...new Set((Array.isArray(req.body.doelen) ? req.body.doelen : []).map(d => String(d)))].filter(d => DOELEN[d]);
    if (!doelen.length || doelen.length > 10) return res.status(400).json({ error: 'Kies 1 tot 10 leerdoelen uit de leerlijn.' });
    const perDoel = Math.min(5, Math.max(1, Number(req.body.perDoel) || 3));
    const t = { id: rid(5), soort, naam: schoon(req.body.naam, 80) || (SOORTEN[soort] + ' ' + DOELEN[doelen[0]].naam),
      vak: schoon(req.body.vak, 40) || DOELEN[doelen[0]].vak, doelen, perDoel,
      weging: Math.min(10, Math.max(1, Number(req.body.weging) || (soort === 'examen' ? 3 : soort === 'proefwerk' ? 2 : 1))),
      /* De dag waarop hij wordt afgenomen. Optioneel, want een SO kan ook
         "gewoon een keer" zijn -- maar zonder dag telt hij niet mee in de week
         van de leerling, en juist daar hoort een proefwerk te wegen. */
      datum: schoon(req.body.datum, 10) || null,
      status: 'open', werk: {}, at: nu() };
    toetsenVan(k).unshift(t); k.toetsen = k.toetsen.slice(0, 200);
    save();
    res.json({ ok: true, toets: { id: t.id, soort: t.soort, naam: t.naam, vak: t.vak, weging: t.weging,
      datum: t.datum, doelen: doelen.map(d => ({ id: d, naam: DOELEN[d].naam })), vragen: doelen.length * perDoel } });
  });

  router.post('/school/toets/lijst', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    res.json({ ok: true, toetsen: toetsenVan(k).map(t => ({
      id: t.id, soort: t.soort, naam: t.naam, vak: t.vak, weging: t.weging, status: t.status, at: t.at,
      doelen: t.doelen.map(d => ({ id: d, naam: (DOELEN[d] || {}).naam || d })),
      leerlingen: (k.leerlingen || []).map(l => {
        const w = t.werk[l.sleutel];
        return { sleutel: l.sleutel, naam: l.naam, klaar: !!(w && w.klaar), becijferd: !!(w && w.becijferd),
          bezig: !!(w && !w.klaar), uitslag: uitslagVan(w) };
      })
    })) });
  });

  router.post('/school/toets/sluit', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const t = toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    if (!t) return res.status(404).json({ error: 'Toets niet gevonden.' });
    t.status = 'dicht'; save();
    res.json({ ok: true });
  });

  // MO: de leraar krijgt de vragen MET antwoorden en vinkt af na het gesprek
  router.post('/school/toets/mo', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const t = toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    if (!t || t.soort !== 'mo') return res.status(404).json({ error: 'Geen mondelinge toets met dit id.' });
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in jouw klas.' });
    if (!t.werk[l.sleutel]) { t.werk[l.sleutel] = maakWerk(t); save(); }
    const w = t.werk[l.sleutel];
    res.json({ ok: true, naam: l.naam, vragen: w.vragen.map(v => ({ doel: v.doel, doelNaam: (DOELEN[v.doel] || {}).naam, v: v.v, a: v.a })) });
  });
  router.post('/school/toets/mo-invoer', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const t = toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    const w = t && t.werk[String(req.body.leerling || '')];
    if (!t || t.soort !== 'mo' || !w) return res.status(404).json({ error: 'Neem eerst het mondeling af via /toets/mo.' });
    const goed = Number(req.body.goed);
    if (!(goed >= 0 && goed <= w.vragen.length)) return res.status(400).json({ error: 'Aantal goed is 0 tot ' + w.vragen.length + '.' });
    w.goed = Math.round(goed); w.klaar = true; save();
    res.json({ ok: true, uitslag: uitslagVan(w) });
  });

  // het cijfer: standaard het voorstel, maar de leraar beslist; landt in het cijferboek
  router.post('/school/toets/cijfer', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const t = toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    const w = t && t.werk[String(req.body.leerling || '')];
    if (!t || !w || !w.klaar) return res.status(404).json({ error: 'Deze leerling heeft de toets nog niet af.' });
    const cijfer = req.body.cijfer != null ? Number(req.body.cijfer) : voorstel(w.goed, w.vragen.length);
    if (!(cijfer >= 1 && cijfer <= 10)) return res.status(400).json({ error: 'Een cijfer is van 1 t/m 10.' });
    if (!Array.isArray(k.cijfers)) k.cijfers = [];
    const c = { id: rid(4), leerling: String(req.body.leerling), vak: t.vak, cijfer: Math.round(cijfer * 10) / 10,
      weging: t.weging, omschrijving: t.naam + ' (' + SOORTEN[t.soort] + ')', at: nu() };
    k.cijfers.unshift(c); k.cijfers = k.cijfers.slice(0, 2000);
    w.becijferd = true; save();
    const naarPaspoort = bewijsNaarPaspoort(k, String(req.body.leerling), t, w, k.leraar || 'de leraar');
    res.json({ ok: true, cijfer: c, voorstelWas: voorstel(w.goed, w.vragen.length),
      bewijs: naarPaspoort
        ? naarPaspoort + ' leerdoel(en) kregen bewijs in het leerpaspoort van deze leerling.'
        : 'Geen bewijs naar het leerpaspoort: de leerdoelen zijn onvoldoende gemaakt, of deze leerling heeft geen eigen profiel.' });
  });

  /* De kant van de LEERLING (toets zien, maken, inleveren) woont in
     ./toets-leerling.js: dezelfde toetsen, maar een andere poort (gezins-
     sessie in plaats van klasCode) en een andere belofte -- een leerling ziet
     tijdens het maken nooit goed of fout. */
  require('./toets-leerling')(sctx, { toetsenVan, maakWerk });

  // de leerdoelen-bibliotheek voor het maak-scherm woont in ./toetsbieb.js
};
