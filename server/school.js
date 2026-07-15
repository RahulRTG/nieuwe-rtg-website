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
  /* scholen: de wortel van alles. EERST meldt een school zich aan (directie
     krijgt een beheer-token), DAN melden leraren en overig personeel zich bij
     die school (en wachten op goedkeuring van de directie), en pas daarna
     kunnen goedgekeurde leraren klassen maken waar gezinnen hun kinderen aan
     koppelen. */
  function S() {
    const f = F();
    if (!f.scholen) f.scholen = {};
    return f.scholen;
  }
  const klasCode = () => { let c; do { c = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (K()[c]); return c; };
  const schoolCode = () => { let c; do { c = 'S' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (S()[c]); return c; };

  // directie-authenticatie: schoolcode + beheer-token
  function schoolVan(req, res) {
    const sch = S()[String(req.body.schoolCode || '').trim().toUpperCase()];
    if (!sch || sch.token !== String(req.body.beheerToken || '')) {
      res.status(403).json({ error: 'Onbekende school of verkeerd beheer-token.' });
      return null;
    }
    return sch;
  }
  // personeels-authenticatie: schoolcode + personeel-token (status telt apart)
  function personeelVan(req, res) {
    const sch = S()[String(req.body.schoolCode || '').trim().toUpperCase()];
    const tok = String(req.body.personeelToken || '');
    const p = sch && tok ? Object.values(sch.personeel || {}).find(x => x.token === tok) : null;
    if (!p) { res.status(403).json({ error: 'Onbekende school of verkeerd personeel-token.' }); return null; }
    return { sch, p };
  }

  /* klas-authenticatie: klascode + token. Toegestaan zijn:
     - het eigen klas-token (oudere, losse klassen blijven zo leesbaar);
     - het personeel-token van de leraar die de klas geeft (mits actief);
     - het beheer-token van de school (de directie kan bij alle klassen). */
  function klasVan(req, res) {
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    const tok = String(req.body.leraarToken || req.body.personeelToken || req.body.beheerToken || '');
    let mag = false;
    if (k && tok) {
      if (k.token === tok) mag = true;
      const sch = k.schoolCode ? S()[k.schoolCode] : null;
      if (sch) {
        if (sch.token === tok) mag = true; // directie
        const p = Object.values(sch.personeel || {}).find(x => x.token === tok);
        if (p && p.status === 'actief' && p.id === k.leraarId) mag = true; // de eigen leraar
      }
    }
    if (!mag) {
      res.status(403).json({ error: 'Onbekende klas of verkeerd token.' });
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

  // een school is pas bruikbaar als RTG hem heeft goedgekeurd. Oude scholen
  // (van voor deze stap) hebben geen status en blijven gewoon actief.
  const isActief = (sch) => (sch.status || 'actief') === 'actief';

  /* ---------- stap 1: de SCHOOL meldt zich aan ----------
     De aanmelder (directie/administratie) krijgt de schoolcode (om aan het
     personeel te geven) en het beheer-token (de sleutel van de school). De
     school staat eerst op 'wacht': RTG keurt hem in de Backoffice goed voordat
     er personeel toegelaten of klassen gemaakt kunnen worden. */
  router.post('/school/school/maak', (req, res) => {
    const naam = schoon(req.body.naam, 80);
    const plaats = schoon(req.body.plaats, 60);
    if (!naam) return res.status(400).json({ error: 'Vul de naam van de school in.' });
    const code = schoolCode();
    S()[code] = { code, naam, plaats: plaats || null, token: rid(16), at: nu(), status: 'wacht', personeel: {} };
    save();
    res.json({ ok: true, schoolCode: code, beheerToken: S()[code].token, naam, status: 'wacht' });
  });

  /* ---------- stap 2: PERSONEEL meldt zich aan bij de school ----------
     Een leraar of ondersteuner meldt zich met de schoolcode en wacht daarna op
     goedkeuring van de directie. Pas na goedkeuring kan een leraar klassen maken. */
  router.post('/school/personeel/aanmeld', (req, res) => {
    const sch = S()[String(req.body.schoolCode || '').trim().toUpperCase()];
    if (!sch) return res.status(404).json({ error: 'Deze schoolcode kennen we niet. Vraag hem na bij de school.' });
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Vul je naam in.' });
    const rol = req.body.rol === 'ondersteuning' ? 'ondersteuning' : 'leraar';
    const id = rid(6);
    sch.personeel[id] = { id, naam, rol, token: rid(16), status: 'wacht', at: nu() };
    save();
    res.json({ ok: true, personeelId: id, personeelToken: sch.personeel[id].token, status: 'wacht',
      school: { naam: sch.naam, plaats: sch.plaats } });
  });

  // personeelslid: waar sta ik? (wacht/actief) + mijn klassen als ik leraar ben
  router.post('/school/personeel/status', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    const klassen = p.status === 'actief' && p.rol === 'leraar'
      ? Object.values(K()).filter(k => k.schoolCode === sch.code && k.leraarId === p.id).map(klasSamenvatting)
      : [];
    res.json({ ok: true, naam: p.naam, rol: p.rol, status: p.status,
      school: { naam: sch.naam, plaats: sch.plaats, code: sch.code, status: sch.status || 'actief' }, klassen });
  });

  /* ---------- directie: overzicht en personeelsbesluiten ---------- */
  function klasSamenvatting(k) {
    return {
      code: k.code, naam: k.naam, leraar: k.leraar,
      leerlingen: (k.leerlingen || []).length,
      openAbsenties: (k.absenties || []).filter(a => !a.afgehandeld).length,
      huiswerk: (k.huiswerk || []).length,
      berichten: Object.values(k.berichten || {}).reduce((n, d) => n + d.length, 0)
        + Object.values(k.berichtenOuders || {}).reduce((n, d) => n + d.length, 0)
    };
  }
  router.post('/school/school/overzicht', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    res.json({
      ok: true, schoolCode: sch.code, naam: sch.naam, plaats: sch.plaats, status: sch.status || 'actief',
      personeel: Object.values(sch.personeel || {}).map(p => ({ id: p.id, naam: p.naam, rol: p.rol, status: p.status, at: p.at })),
      klassen: Object.values(K()).filter(k => k.schoolCode === sch.code).map(klasSamenvatting)
    });
  });
  router.post('/school/personeel/besluit', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const p = (sch.personeel || {})[String(req.body.personeelId || '')];
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    // afwijzen mag altijd (spam opruimen), maar toelaten kan pas als RTG de school
    // zelf heeft goedgekeurd
    if (req.body.akkoord === false) { delete sch.personeel[p.id]; save(); return res.json({ ok: true }); }
    if (!isActief(sch)) return res.status(403).json({ error: 'De school wacht nog op goedkeuring door RTG. Zodra RTG de school activeert, kun je personeel toelaten.' });
    p.status = 'actief';
    save();
    res.json({ ok: true });
  });

  /* ---------- stap 3: een GOEDGEKEURDE leraar maakt klassen ---------- */
  router.post('/school/leraar/klas/maak', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    if (!isActief(sch)) return res.status(403).json({ error: 'De school wacht nog op goedkeuring door RTG.' });
    if (p.status !== 'actief') return res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' });
    if (p.rol !== 'leraar') return res.status(403).json({ error: 'Alleen een leraar maakt klassen.' });
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Geef de klas een naam.' });
    const code = klasCode();
    K()[code] = { code, naam, leraar: p.naam, school: sch.naam, schoolCode: sch.code, leraarId: p.id, token: rid(16), at: nu(),
      leerlingen: [], rooster: [], huiswerk: [], cijfers: [], mededelingen: [], absenties: [], berichten: {}, berichtenOuders: {} };
    save();
    res.json({ ok: true, code, naam });
  });

  // de klassen van deze leraar (het multi-klas-dashboard)
  router.post('/school/leraar/overzicht', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    if (p.status !== 'actief') return res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' });
    const klassen = Object.values(K()).filter(k => k.schoolCode === sch.code && k.leraarId === p.id).map(klasSamenvatting);
    res.json({ ok: true, naam: p.naam, school: sch.naam, klassen });
  });

  // gewogen gemiddelde van een lijst cijfers (of null zonder cijfers)
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
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Deze klascode kennen we niet. Vraag hem na bij de leraar.' });
    const profielId = String(req.body.profielId || s.p.id);
    const kind = s.g.profielen[profielId];
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
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
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
    // open uitnodigingen: het kind ziet die van zichzelf (om te beslissen),
    // de ouder ziet welke er nog op een antwoord van het kind wachten
    const uitnodigingen = [];
    for (const k of Object.values(K())) {
      for (const u of (k.uitnodigingen || [])) {
        if (u.gezinCode !== s.g.code || !mijnIds.includes(u.profielId)) continue;
        uitnodigingen.push({ klas: { code: k.code, naam: k.naam, leraar: k.leraar, school: k.school },
          kind: { profielId: u.profielId, naam: u.naam }, door: u.door, at: u.at,
          voorMij: u.profielId === s.p.id });
      }
    }
    res.json({ ok: true, school: uit, ouder: s.beheerder, uitnodigingen });
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
    k.absenties.push({ id: rid(4), leerling: l.sleutel, naam: l.naam, soort: 'ziek', bron: 'ouder',
      reden: schoon(req.body.reden, 200) || 'ziek', doorNaam: schoon(s.p.naam, 60), at: nu(), afgehandeld: false });
    k.absenties = k.absenties.slice(-500);
    save();
    res.json({ ok: true });
  });

  /* ---------- berichten: twee kanalen per leerling ----------
     1. 'gezin'  - de gezinsdraad: het kind leest en praat mee, de ouder ziet
        alles. Bewust GEEN privekanaal leraar-kind.
     2. 'ouders' - het privekanaal ouders <-> leraar, voor gevoelige zaken OVER
        het kind (gedrag, thuissituatie, zorg). Het kind kan hier niet bij;
        alleen een ouder/verzorger leest en schrijft mee. */
  function draad(k, sleutel, kanaal) {
    if (kanaal === 'ouders') { k.berichtenOuders = k.berichtenOuders || {}; return (k.berichtenOuders[sleutel] = k.berichtenOuders[sleutel] || []); }
    k.berichten = k.berichten || {};
    return (k.berichten[sleutel] = k.berichten[sleutel] || []);
  }
  const kanaalVan = (req) => (req.body.kanaal === 'ouders' ? 'ouders' : 'gezin');
  router.post('/school/bericht/gezin', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = K()[String(req.body.klasCode || '').trim().toUpperCase()];
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const kanaal = kanaalVan(req);
    // het privekanaal is alleen voor ouders/verzorgers; het kind komt er niet in
    if (kanaal === 'ouders' && !s.beheerder) return res.status(403).json({ error: 'Dit is het privekanaal van je ouders met de leraar.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const d = draad(k, l.sleutel, kanaal);
    const tekst = schoon(req.body.tekst, 500);
    if (tekst) {
      d.push({ van: kanaal === 'ouders' ? 'ouder' : 'gezin', naam: schoon(s.p.naam, 60), tekst, at: nu() });
      if (d.length > 200) d.splice(0, d.length - 200);
      save();
    }
    res.json({ ok: true, kanaal, berichten: d.slice(-60), leraar: k.leraar });
  });
  router.post('/school/bericht/leraar', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in jouw klas.' });
    const kanaal = kanaalVan(req);
    const d = draad(k, l.sleutel, kanaal);
    const tekst = schoon(req.body.tekst, 500);
    if (tekst) {
      d.push({ van: 'leraar', naam: k.leraar, tekst, at: nu() });
      if (d.length > 200) d.splice(0, d.length - 200);
      save();
    }
    res.json({ ok: true, kanaal, berichten: d.slice(-60) });
  });

  /* ---------- absentie door de LERAAR: te laat of afwezig zonder melding ----------
     Het gezin ziet dit meteen in het eigen overzicht; geen briefje meer nodig. */
  router.post('/school/absentie/meld', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const l = (k.leerlingen || []).find(x => x.sleutel === String(req.body.leerling || ''));
    if (!l) return res.status(404).json({ error: 'Deze leerling zit niet in jouw klas.' });
    const soort = req.body.soort === 'te-laat' ? 'te-laat' : 'afwezig';
    k.absenties.push({ id: rid(4), leerling: l.sleutel, naam: l.naam, soort, bron: 'leraar',
      reden: schoon(req.body.notitie, 200) || (soort === 'te-laat' ? 'te laat gekomen' : 'afwezig zonder melding'),
      doorNaam: k.leraar, at: nu(), afgehandeld: false });
    k.absenties = k.absenties.slice(-500);
    save();
    res.json({ ok: true });
  });
};
