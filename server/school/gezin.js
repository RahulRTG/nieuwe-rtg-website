/* School (deelmodule): de gezinskant: mijn overzicht, huiswerk afvinken, ziekmelden en de berichten met de leraar.
   Krijgt de gedeelde schoolcontext een keer bij het opstarten vanuit
   server/school.js. */
module.exports = (sctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto,
    eigenVeld, K, S, schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief } = sctx;
  const { gemiddelde } = sctx;
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
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
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
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
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
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
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
  return {  };
};
