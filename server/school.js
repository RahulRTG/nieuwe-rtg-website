/* RTF School: het schoolkanaal van de RTFoundation ("slimmer dan Magister").

   Een leraar maakt een klas en krijgt een klascode (voor de ouders) en een
   leraar-token (zijn sleutel). Een ouder koppelt zijn kind met de klascode.
   Daarna: rooster, huiswerk (met afvinken en een brug naar de AI-bijles),
   cijfers, mededelingen, ziekmelden in één tik, en berichten met de leraar.

   Twee principes die dit veiliger maken dan de bekende school-apps:
   1. GEEN privékanaal leraar-kind: schoolberichten lopen per gezin, dus een
      ouder kijkt standaard mee. Dat sluit aan op de kinderbescherming elders
      in de app (t/m 15 geen open sociale laag).
   2. Cijfers zijn per kind afgeschermd: een gezin ziet alleen de cijfers van
      de eigen kinderen; de leraar ziet alleen zijn eigen klas.

   Krijgt de gedeelde foundation-helpers mee (ctx) en registreert zijn routes op
   dezelfde router; alles onder /api/foundation/school/... */
module.exports = (ctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto } = ctx;

  function K() {
    const f = F();
    if (!f.klassen) f.klassen = {};
    return f.klassen;
  }
  const klasCode = () => { let c; do { c = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (K()[c]); return c; };

  // leraar-authenticatie: klascode + leraar-token
  function klasVan(req, res) {
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k || k.token !== String(req.body.leraarToken || '')) {
      res.status(403).json({ error: 'Onbekende klas of verkeerd leraar-token.' });
      return null;
    }
    return k;
  }
  // gezins-authenticatie (ouder of kind), zoals overal in de foundation
  function gezinSessie(req, res) {
    const g = gezinVan(req, res); if (!g) return null;
    const p = profielVan(g, req.body.token);
    if (!p) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    return { g, p, beheerder: p.rol === 'beheerder' || p.rol === 'ouder' };
  }
  const leerlingSleutel = (gezinCode, profielId) => gezinCode + ':' + profielId;
  function leerlingVan(k, g, profielId) {
    return (k.leerlingen || []).find(l => l.sleutel === leerlingSleutel(g.code, profielId));
  }

  /* ---------- leraar: klas aanmaken en inzien ---------- */
  router.post('/school/klas/maak', (req, res) => {
    const naam = schoon(req.body.naam, 60);
    const leraar = schoon(req.body.leraar, 60);
    const school = schoon(req.body.school, 80);
    if (!naam || !leraar) return res.status(400).json({ error: 'Vul de klasnaam en jouw naam in.' });
    const code = klasCode();
    K()[code] = { code, naam, leraar, school: school || null, token: rid(16), at: nu(),
      leerlingen: [], rooster: [], huiswerk: [], cijfers: [], mededelingen: [], absenties: [], berichten: {} };
    save();
    res.json({ ok: true, code, leraarToken: K()[code].token, naam, leraar });
  });

  router.post('/school/klas', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    res.json({
      code: k.code, naam: k.naam, leraar: k.leraar, school: k.school,
      leerlingen: (k.leerlingen || []).map(l => ({ sleutel: l.sleutel, naam: l.naam, at: l.at })),
      rooster: k.rooster, huiswerk: k.huiswerk, mededelingen: k.mededelingen,
      cijfers: k.cijfers,
      absenties: (k.absenties || []).filter(a => !a.afgehandeld),
      berichten: Object.entries(k.berichten || {}).map(([sleutel, m]) => {
        const l = (k.leerlingen || []).find(x => x.sleutel === sleutel);
        const laatste = m[m.length - 1];
        return { sleutel, naam: l ? l.naam : sleutel, laatste: laatste ? laatste.tekst : null, laatsteAt: laatste ? laatste.at : null, aantal: m.length };
      })
    });
  });

  /* ---------- ouder: kind koppelen aan een klas ---------- */
  router.post('/school/koppel', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder of verzorger koppelt een kind aan een klas.' });
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Deze klascode kennen we niet. Vraag hem na bij de leraar.' });
    const kind = s.g.profielen[req.body.profielId];
    if (!kind) return res.status(404).json({ error: 'Dat profiel bestaat niet in jouw gezin.' });
    const sleutel = leerlingSleutel(s.g.code, kind.id);
    if ((k.leerlingen || []).some(l => l.sleutel === sleutel)) return res.status(409).json({ error: 'Dit kind zit al in deze klas.' });
    k.leerlingen.push({ sleutel, gezinCode: s.g.code, profielId: kind.id, naam: schoon(kind.naam, 60), at: nu() });
    save();
    res.json({ ok: true, klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school } });
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
  router.post('/school/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    // een ouder ziet alle gekoppelde kinderen; een kind alleen zichzelf
    const mijnIds = s.beheerder ? Object.keys(s.g.profielen) : [s.p.id];
    const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][new Date().getDay()];
    const uit = [];
    for (const k of Object.values(K())) {
      for (const l of (k.leerlingen || [])) {
        if (l.gezinCode !== s.g.code || !mijnIds.includes(l.profielId)) continue;
        uit.push({
          klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school },
          kind: { profielId: l.profielId, naam: l.naam, sleutel: l.sleutel },
          vandaag: (k.rooster || []).filter(r => r.dag === DAG),
          rooster: k.rooster,
          huiswerk: (k.huiswerk || []).map(h => ({ id: h.id, titel: h.titel, vak: h.vak, omschrijving: h.omschrijving,
            deadline: h.deadline, at: h.at, af: (h.afDoor || []).includes(l.sleutel) })),
          cijfers: (k.cijfers || []).filter(c => c.leerling === l.sleutel)
            .map(c => ({ id: c.id, vak: c.vak, cijfer: c.cijfer, weging: c.weging, omschrijving: c.omschrijving, at: c.at })),
          mededelingen: k.mededelingen || [],
          absenties: (k.absenties || []).filter(a => a.leerling === l.sleutel)
        });
      }
    }
    res.json({ ok: true, school: uit, ouder: s.beheerder });
  });

  // huiswerk afvinken (kind of ouder), en weer terugzetten
  router.post('/school/huiswerk/af', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const h = (k.huiswerk || []).find(x => x.id === String(req.body.huiswerkId || ''));
    if (!h) return res.status(404).json({ error: 'Huiswerk niet gevonden.' });
    h.afDoor = h.afDoor || [];
    const idx = h.afDoor.indexOf(l.sleutel);
    if (req.body.af === false) { if (idx >= 0) h.afDoor.splice(idx, 1); }
    else if (idx < 0) h.afDoor.push(l.sleutel);
    save();
    res.json({ ok: true, af: h.afDoor.includes(l.sleutel) });
  });

  // ziekmelden in één tik (alleen een ouder/verzorger)
  router.post('/school/ziekmelden', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder of verzorger meldt ziek.' });
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = String(req.body.profielId || '');
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const vandaag = nu().slice(0, 10);
    if ((k.absenties || []).some(a => a.leerling === l.sleutel && a.at.slice(0, 10) === vandaag && !a.afgehandeld))
      return res.status(409).json({ error: 'Dit kind is vandaag al ziek gemeld.' });
    k.absenties.push({ id: rid(4), leerling: l.sleutel, naam: l.naam, reden: schoon(req.body.reden, 200) || 'ziek',
      doorNaam: schoon(s.p.naam, 60), at: nu(), afgehandeld: false });
    k.absenties = k.absenties.slice(-500);
    save();
    res.json({ ok: true });
  });

  /* ---------- berichten: leraar <-> gezin (per leerling één draad) ----------
     Bewust GEEN privékanaal met het kind: de draad hoort bij het gezin, dus de
     ouder leest altijd mee. Het kind mag wel meelezen en schrijven. */
  function draad(k, sleutel) { k.berichten = k.berichten || {}; return (k.berichten[sleutel] = k.berichten[sleutel] || []); }
  router.post('/school/bericht/gezin', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const d = draad(k, l.sleutel);
    const tekst = schoon(req.body.tekst, 500);
    if (tekst) {
      d.push({ van: 'gezin', naam: schoon(s.p.naam, 60), tekst, at: nu() });
      if (d.length > 200) d.splice(0, d.length - 200);
      save();
    }
    res.json({ ok: true, berichten: d.slice(-60), leraar: k.leraar });
  });
  router.post('/school/bericht/leraar', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in jouw klas.' });
    const d = draad(k, l.sleutel);
    const tekst = schoon(req.body.tekst, 500);
    if (tekst) {
      d.push({ van: 'leraar', naam: k.leraar, tekst, at: nu() });
      if (d.length > 200) d.splice(0, d.length - 200);
      save();
    }
    res.json({ ok: true, berichten: d.slice(-60) });
  });
};
