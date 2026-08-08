/* Member-submodule: werk & sollicitaties. De cv-builder, het bekijken van
   vacatures en het solliciteren (voor gewone RTG-leden en voor RTF-gezinsleden),
   plus de sollicitatie-chat met de werkgever aan beide kanten. Alleen de routes;
   de helpers komen via het kern-object binnen. Gemount vanuit routes/member.js. */
const { eigenVeld } = require('../../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (kern) => {
  const { app, auth, db, save, crypto, talen, chatStuur, applyChatVertaald, meldWerkgever, LANDEN,
          openVacatures, findSupplier, cvReady, leeftijdVan, geborenVan, notifySupplier, sseToSupplier,
          sseToOffice, PERSONAS, automatisering, commWerk } = kern;
  app.post('/api/member/apply/chats', auth, (req, res) => {
    // ook gratis gebruikers chatten met de werkgever over hun sollicitatie
    /* Sinds de verhuizing uit de communicatiekern (kern/comm/werk.js), in
       dezelfde vorm als hiervoor. voorSollicitant() haalt onderweg de
       sollicitaties binnen die nog in de oude voorraad stonden -- zonder dat
       zou deze lijst op de dag van de verhuizing leeg staan, en de lijst IS de
       manier om een sollicitatiechat te openen. */
    res.json({ chats: commWerk ? commWerk.voorSollicitant(req.session.key) : [] });
  });

  app.post('/api/member/apply/chat', auth, (req, res) => {
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.applicant.kind !== 'rtg' || chat.applicant.key !== req.session.key) return res.status(404).json({ error: 'Chat niet gevonden.' });
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });

  app.post('/api/member/apply/chat/send', auth, (req, res) => {
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.applicant.kind !== 'rtg' || chat.applicant.key !== req.session.key) return res.status(404).json({ error: 'Chat niet gevonden.' });
    const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text, talen.taalVan(req.body.lang));
    if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
    meldWerkgever(chat, m.tekst);
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });


  app.post('/api/cv/get', auth, (req, res) => {
    const cv = db.data.cvs[req.session.key] || null;
    res.json({ cv, ready: cvReady(cv) });
  });

  app.post('/api/cv/save', auth, (req, res) => {
    // ook gratis gebruikers maken een cv om te kunnen solliciteren
    const b = req.body || {};
    const cv = {
      name: String(b.name || '').trim().slice(0, 60),
      contact: String(b.contact || '').trim().slice(0, 80),
      headline: String(b.headline || '').trim().slice(0, 80),
      experience: String(b.experience || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12),
      skills: String(b.skills || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 15),
      languages: String(b.languages || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8),
      about: String(b.about || '').trim().slice(0, 400),
      updatedAt: new Date().toISOString()
    };
    if (!cv.name || !cv.contact) return res.status(400).json({ error: 'Vul minimaal uw naam en contactgegevens in.' });
    db.data.cvs[req.session.key] = cv;
    save();
    res.json({ ok: true, cv, ready: cvReady(cv) });
  });

  app.post('/api/member/vacatures', auth, (req, res) => {
    // vacatures bekijken en solliciteren mag ook zonder pas
    const lft = leeftijdVan(geborenVan(req.session));
    const land = typeof req.body.land === 'string' && LANDEN[req.body.land] ? req.body.land : null;
    const alle = openVacatures(lft);
    const landen = [];
    for (const v of alle) if (!landen.some(l => l.code === v.land)) landen.push({ code: v.land, naam: v.landNaam });
    landen.sort((a, b) => a.naam.localeCompare(b.naam));
    const zichtbaar = land ? alle.filter(v => v.land === land) : alle;
    res.json({ vacatures: zichtbaar.slice(0, 100), landen, leeftijd: lft, magSolliciteren: lft == null || lft >= 16 });
  });

  app.post('/api/member/apply', auth, (req, res) => {
    // solliciteren mag ook zonder pas: het cv is de sleutel, niet de Pass
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const cv = db.data.cvs[req.session.key];
    if (!cvReady(cv)) return res.status(409).json({ error: 'Maak eerst uw cv af in de cv-builder; daarmee solliciteert u bij elke RTG-partner in een tik.', needCv: true });
    const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
    let func, vacatureId = null;
    if (req.body.vacatureId) {
      const vac = (db.data.vacatures[s.code] || []).find(v => v.id === req.body.vacatureId && v.open);
      if (!vac) return res.status(404).json({ error: 'Deze vacature staat niet meer open.' });
      const lft = leeftijdVan(geborenVan(req.session));
      if (lft != null && lft < vac.minLeeftijd)
        return res.status(403).json({ error: 'Voor deze vacature moet je minstens ' + vac.minLeeftijd + ' jaar zijn.' });
      if (list.some(a => a.key === req.session.key && a.vacatureId === vac.id))
        return res.status(409).json({ error: 'U hebt al op deze vacature gesolliciteerd. De status ziet u bij uw sollicitaties.' });
      func = vac.func; vacatureId = vac.id;
    } else {
      func = String(req.body.func || '').trim().slice(0, 40);
      if (!func) return res.status(400).json({ error: 'Kies een functie.' });
    }
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      name: cv.name, func, contact: cv.contact,
      note: String(req.body.note || '').trim().slice(0, 400),
      viaRTG: true, codename, key: req.session.key, vacatureId,
      cv: { headline: cv.headline, experience: cv.experience, skills: cv.skills, languages: cv.languages, about: cv.about },
      status: 'nieuw', at: new Date().toISOString()
    };
    list.unshift(entry);
    db.data.applications[s.code] = list.slice(0, 100);
    save();
    notifySupplier(s.code, { icon: 'werk', title: 'Sollicitatie via RTG', body: cv.name + ' (RTG-lid) solliciteert als ' + func + ', met cv.' });
    // personeel-draaiboek: een seintje in het RTMAIL-postvak van de zaak (op codenaam)
    try { if (automatisering) automatisering.sollicitatieBinnen({ zaakCode: s.code, functie: func, codename }); } catch (e) {}
    sseToSupplier(s.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    res.json({ ok: true });
  });
  /* De RTF-kant draait als submodule op de gedeelde context. */
  require('./werk/rtf')(kern);
};
