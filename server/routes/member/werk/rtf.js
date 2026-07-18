/* Werk (deelmodule): de RTF-kant: de sollicitatie-chat, vacatures bekijken
   en solliciteren voor RTF-gezinsleden (op code + token, met rate-limit en
   dedup). Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/member/werk.js. */
const { eigenVeld } = require('../../../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (wctx) => {
  const { app, auth, db, save, crypto, talen, trChat, chatStuur, applyChatVertaald, meldWerkgever,
    rtf, LANDEN, openVacatures, tooManyTries, noteFailedTry, findSupplier, cvReady,
    leeftijdVan, geborenVan, notifySupplier, sseToSupplier, sseToOffice, PERSONAS } = wctx;
  app.post('/api/rtf/apply/chat', (req, res) => {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
      return res.status(404).json({ error: 'Chat niet gevonden.' });
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });

  app.post('/api/rtf/apply/chat/send', (req, res) => {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
      return res.status(404).json({ error: 'Chat niet gevonden.' });
    const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text, talen.taalVan(req.body.lang));
    if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
    meldWerkgever(chat, m.tekst);
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });

  app.post('/api/rtf/vacatures', (req, res) => {
    const lft = parseInt(req.body && req.body.leeftijd, 10);
    const minOk = Number.isFinite(lft) ? lft : null;
    const land = req.body && typeof req.body.land === 'string' && LANDEN[req.body.land] ? req.body.land : null;
    const alle = openVacatures(minOk); // zonder landfilter, om de landenlijst te vullen
    const landen = [];
    for (const v of alle) if (!landen.some(l => l.code === v.land)) landen.push({ code: v.land, naam: v.landNaam });
    landen.sort((a, b) => a.naam.localeCompare(b.naam));
    const zichtbaar = land ? alle.filter(v => v.land === land) : alle;
    res.json({ vacatures: zichtbaar.slice(0, 100), landen, magSolliciteren: minOk == null || minOk >= 16 });
  });

  app.post('/api/rtf/solliciteer', (req, res) => {
    const b = req.body || {};
    const bucket = 'rtfsoll:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    // gezin-token: het profiel moet kloppen en mag geen gast zijn (privezaak)
    const sess = rtf.verifieerProfiel(b.code, b.token);
    if (!sess) { noteFailedTry(bucket); return res.status(403).json({ error: 'Log opnieuw in bij je gezin om te solliciteren.' }); }
    if (sess.gast) return res.status(403).json({ error: 'Als oppas of familielid solliciteer je niet namens het gezin.' });
    const lft = parseInt(b.leeftijd, 10);
    if (!Number.isFinite(lft) || lft < 16)
      return res.status(403).json({ error: 'Solliciteren kan vanaf 16 jaar. Jongere gezinsleden vinden in de app juist leer- en groeitips.' });
    const s = findSupplier(b.supplierCode);
    if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
    const vac = (db.data.vacatures[s.code] || []).find(v => v.id === b.vacatureId && v.open);
    if (!vac) return res.status(404).json({ error: 'Deze vacature staat niet meer open.' });
    if (lft < vac.minLeeftijd)
      return res.status(403).json({ error: 'Voor deze vacature moet je minstens ' + vac.minLeeftijd + ' jaar zijn.' });
    if (rtf.alGesolliciteerd(b.code, sess.p.id, vac.id))
      return res.status(409).json({ error: 'Je hebt al op deze vacature gesolliciteerd. Je ziet de status bij "Mijn sollicitaties".' });
    const cv = b.cv || {};
    const name = String(cv.name || '').trim().slice(0, 60);
    const contact = String(cv.contact || '').trim().slice(0, 80);
    const heeftInhoud = (Array.isArray(cv.experience) && cv.experience.length) || (Array.isArray(cv.skills) && cv.skills.length) || (cv.about || '').trim();
    if (!name || !contact || !heeftInhoud)
      return res.status(409).json({ error: 'Maak eerst je cv af in de RTF-app (naam, contact en werk of vaardigheden). Daarmee solliciteer je in een tik.', needCv: true });
    const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      name, func: vac.func, contact,
      note: String(b.note || '').trim().slice(0, 400),
      viaRTF: true, rtf: { code: String(b.code).toUpperCase(), profielId: sess.p.id },
      cv: {
        headline: String(cv.headline || '').slice(0, 80),
        experience: (Array.isArray(cv.experience) ? cv.experience : []).slice(0, 12).map(x => String(x).slice(0, 120)),
        skills: (Array.isArray(cv.skills) ? cv.skills : []).slice(0, 15).map(x => String(x).slice(0, 40)),
        languages: (Array.isArray(cv.languages) ? cv.languages : []).slice(0, 8).map(x => String(x).slice(0, 30)),
        about: String(cv.about || '').slice(0, 400)
      },
      status: 'nieuw', at: new Date().toISOString()
    };
    const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
    list.unshift(entry);
    db.data.applications[s.code] = list.slice(0, 100);
    // verwijzing bij het gezin, voor "Mijn sollicitaties" met live status
    rtf.bewaarSollicitatie(b.code, sess.p.id, { appId: entry.id, supplierCode: s.code, vacatureId: vac.id, func: vac.func, bedrijf: s.name, land: landCode, landNaam: LANDEN[landCode].naam });
    save();
    // De melding aan het bedrijf is identiek aan die van een gewoon RTG-lid: de
    // foundation-herkomst blijft onzichtbaar voor de werkgever.
    notifySupplier(s.code, { icon: '📝', title: 'Sollicitatie via RTG', body: name + ' (RTG-lid) solliciteert als ' + vac.func + ', met cv.' });
    sseToSupplier(s.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    res.json({ ok: true });
  });

};
