/* School (deelmodule): de klasweergave voor de leraar: koppelen, rooster, huiswerk, cijfers, mededelingen en absenties afhandelen.
   Krijgt de gedeelde schoolcontext een keer bij het opstarten vanuit
   server/school.js. */
module.exports = (sctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto,
    eigenVeld, K, S, schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief } = sctx;
  function gemiddelde(cijfers) {
    let som = 0, w = 0;
    for (const c of cijfers) { som += c.cijfer * (c.weging || 1); w += (c.weging || 1); }
    return w ? Math.round((som / w) * 10) / 10 : null;
  }

  router.post('/school/klas', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const naamVan = (sleutel) => { const l = (k.leerlingen || []).find(x => x.sleutel === sleutel); return l ? l.naam : sleutel; };
    const alle = k.cijfers || [];
    res.json({
      code: k.code, naam: k.naam, leraar: k.leraar, school: k.school, leraarAccount: !!k.leraarId,
      // per leerling het gewogen gemiddelde: de leraar ziet in een oogopslag wie aandacht nodig heeft
      leerlingen: (k.leerlingen || []).map(l => ({ sleutel: l.sleutel, naam: l.naam, at: l.at,
        gemiddelde: gemiddelde(alle.filter(c => c.leerling === l.sleutel)) })),
      klasGemiddelde: gemiddelde(alle),
      rooster: k.rooster,
      // bij het huiswerk ook WIE het af heeft (namen), niet alleen hoeveel
      huiswerk: (k.huiswerk || []).map(h => Object.assign({}, h, { afNamen: (h.afDoor || []).map(naamVan) })),
      mededelingen: k.mededelingen,
      cijfers: k.cijfers,
      absenties: (k.absenties || []).filter(a => !a.afgehandeld),
      berichten: Object.entries(k.berichten || {}).map(([sleutel, m]) => {
        const laatste = m[m.length - 1];
        const prive = ((k.berichtenOuders || {})[sleutel] || []).length;
        return { sleutel, naam: naamVan(sleutel), laatste: laatste ? laatste.tekst : null, laatsteAt: laatste ? laatste.at : null, aantal: m.length, prive };
      })
    });
  });

  /* ---------- aansluiten bij een klas ----------
     De ouder zit erbij, maar beslist niet OVER het kind: een ouder stuurt een
     UITNODIGING en het kind accepteert (of weigert) die zelf. Een kind kan
     zich ook zonder ouder aansluiten met de klascode; dat is de eigen keuze
     en telt dus meteen. */
  router.post('/school/koppel', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Deze klascode kennen we niet. Vraag hem na bij de leraar.' });
    const profielId = String(req.body.profielId || s.p.id);
    const kind = eigenVeld(s.g.profielen, profielId);
    if (!kind) return res.status(404).json({ error: 'Dat profiel bestaat niet in jouw gezin.' });
    const sleutel = leerlingSleutel(s.g.code, kind.id);
    if ((k.leerlingen || []).some(l => l.sleutel === sleutel)) return res.status(409).json({ error: 'Dit kind zit al in deze klas.' });
    k.uitnodigingen = k.uitnodigingen || [];
    if (!s.beheerder) {
      // een kind sluit alleen ZICHZELF aan; eigen keuze, dus meteen actief
      if (profielId !== s.p.id) return res.status(403).json({ error: 'Je kunt alleen jezelf aansluiten bij een klas.' });
      k.uitnodigingen = k.uitnodigingen.filter(u => u.sleutel !== sleutel);
      k.leerlingen.push({ sleutel, gezinCode: s.g.code, profielId: kind.id, naam: schoon(kind.naam, 60), at: nu() });
      save();
      return res.json({ ok: true, klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school } });
    }
    // de ouder nodigt uit; het kind accepteert de uitnodiging zelf
    if (k.uitnodigingen.some(u => u.sleutel === sleutel)) return res.status(409).json({ error: 'Er staat al een uitnodiging voor dit kind klaar.' });
    k.uitnodigingen.push({ sleutel, gezinCode: s.g.code, profielId: kind.id, naam: schoon(kind.naam, 60), door: schoon(s.p.naam, 60), at: nu() });
    save();
    res.json({ ok: true, uitgenodigd: true, klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school } });
  });

  // het kind beslist zelf over de uitnodiging van de ouder
  router.post('/school/uitnodiging/antwoord', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const sleutel = leerlingSleutel(s.g.code, s.p.id);
    const idx = (k.uitnodigingen || []).findIndex(u => u.sleutel === sleutel);
    if (idx < 0) return res.status(404).json({ error: 'Er staat geen uitnodiging voor je klaar bij deze klas.' });
    const u = k.uitnodigingen.splice(idx, 1)[0];
    if (req.body.akkoord === true)
      k.leerlingen.push({ sleutel, gezinCode: u.gezinCode, profielId: u.profielId, naam: u.naam, at: nu() });
    save();
    res.json({ ok: true, geaccepteerd: req.body.akkoord === true, klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school } });
  });

  /* ---------- leraar: rooster, huiswerk, cijfers, mededelingen ---------- */
  router.post('/school/rooster/zet', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const DAGEN = ['ma', 'di', 'wo', 'do', 'vr'];
    const rooster = Array.isArray(req.body.rooster) ? req.body.rooster.slice(0, 60) : [];
    k.rooster = rooster
      .filter(r => r && DAGEN.includes(r.dag))
      .map(r => ({ dag: r.dag, van: schoon(r.van, 5), tot: schoon(r.tot, 5), vak: schoon(r.vak, 40), lokaal: schoon(r.lokaal, 20) }));
    save();
    res.json({ ok: true, rooster: k.rooster });
  });

  router.post('/school/huiswerk/maak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Geef het huiswerk een titel.' });
    const h = { id: rid(4), titel, vak: schoon(req.body.vak, 40), omschrijving: schoon(req.body.omschrijving, 500),
      deadline: schoon(req.body.deadline, 10), at: nu(), afDoor: [] };
    k.huiswerk.unshift(h); k.huiswerk = k.huiswerk.slice(0, 200);
    save();
    res.json({ ok: true, huiswerk: h });
  });

  router.post('/school/cijfer/geef', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in jouw klas.' });
    const cijfer = Number(req.body.cijfer);
    if (!(cijfer >= 1 && cijfer <= 10)) return res.status(400).json({ error: 'Een cijfer is van 1 t/m 10.' });
    const c = { id: rid(4), leerling: l.sleutel, vak: schoon(req.body.vak, 40), cijfer: Math.round(cijfer * 10) / 10,
      weging: Math.min(10, Math.max(1, Number(req.body.weging) || 1)), omschrijving: schoon(req.body.omschrijving, 120), at: nu() };
    k.cijfers.unshift(c); k.cijfers = k.cijfers.slice(0, 2000);
    save();
    res.json({ ok: true, cijfer: c });
  });

  router.post('/school/mededeling', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const tekst = schoon(req.body.tekst, 600);
    if (!tekst) return res.status(400).json({ error: 'Schrijf een mededeling.' });
    k.mededelingen.unshift({ id: rid(3), tekst, at: nu() });
    k.mededelingen = k.mededelingen.slice(0, 100);
    save();
    res.json({ ok: true });
  });

  router.post('/school/absentie/afhandelen', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const a = (k.absenties || []).find(x => x.id === String(req.body.id || ''));
    if (!a) return res.status(404).json({ error: 'Ziekmelding niet gevonden.' });
    a.afgehandeld = true; a.afgehandeldAt = nu();
    save();
    res.json({ ok: true });
  });

  /* ---------- gezin: het "mijn school"-overzicht (het slimme scherm) ----------
     Eén aanroep geeft alles wat ouder of kind nodig heeft: de klassen van het
     kind (of van alle kinderen, voor een ouder), het rooster van vandaag, open
     huiswerk, de eigen cijfers, mededelingen en lopende ziekmeldingen. */
  return { gemiddelde };
};
