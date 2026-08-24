/* Opportunity Deck: een rechtsveeg is nog geen sollicitatie. Het bedrijf
   ziet een anonieme talentkaart zonder naam of contact. Pas na wederzijdse
   interesse kiest de kandidaat zelf of de gewone sollicitatie en Deal Room
   open mogen. */
module.exports = (wctx) => {
  const { app, db, save, crypto, rtf, findSupplier, notifySupplier, sseToSupplier } = wctx;

  app.post('/api/rtf/talent/interesse', (req, res) => {
    const b = req.body || {};
    const sess = rtf.verifieerProfiel(b.code, b.token);
    if (!sess || sess.gast) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (!rtf.magSolliciteren(sess.p.groep)) return res.status(403).json({ error: 'Werkmatches zijn beschikbaar vanaf 16 jaar.' });
    const alle = db.data.talentInteresses = Array.isArray(db.data.talentInteresses) ? db.data.talentInteresses : [];
    const code = String(b.code).toUpperCase();
    const bestaand = alle.find(x => x.vacatureId === b.vacatureId && x.rtf && x.rtf.code === code && x.rtf.profielId === sess.p.id);
    if (b.actief === false) {
      if (bestaand && bestaand.status === 'interesse') alle.splice(alle.indexOf(bestaand), 1);
      save(); return res.json({ ok: true, ingetrokken: true });
    }
    let vac = null, zaak = null;
    for (const [supplierCode, lijst] of Object.entries(db.data.vacatures || {})) {
      const gevonden = (lijst || []).find(v => v.id === b.vacatureId && v.open);
      if (gevonden) { vac = gevonden; zaak = findSupplier(supplierCode); break; }
    }
    if (!vac || !zaak) return res.status(404).json({ error: 'Deze vacature staat niet meer open.' });
    const lft = rtf.groepLeeftijd(sess.p.groep);
    if (!(lft >= vac.minLeeftijd)) return res.status(403).json({ error: 'Deze vacature vraagt een hogere leeftijd.' });
    if (bestaand) return res.json({ ok: true, interesse: { id: bestaand.id, status: bestaand.status } });
    const cv = b.cv && typeof b.cv === 'object' ? b.cv : {};
    const entry = {
      id: crypto.randomBytes(5).toString('hex'), supplierCode: zaak.code, vacatureId: vac.id, func: vac.func,
      rtf: { code, profielId: sess.p.id }, status: 'interesse', at: new Date().toISOString(),
      talent: {
        headline: String(cv.headline || '').trim().slice(0, 80),
        skills: (Array.isArray(cv.skills) ? cv.skills : []).slice(0, 12).map(x => String(x).trim().slice(0, 40)).filter(Boolean),
        experienceCount: (Array.isArray(cv.experience) ? cv.experience : []).slice(0, 12).length
      }
    };
    alle.unshift(entry); db.data.talentInteresses = alle.slice(0, 5000); save();
    notifySupplier(zaak.code, { icon: 'werk', title: 'Nieuwe anonieme werkmatch', body: 'Een talent toont interesse in ' + vac.func + '.' });
    sseToSupplier(zaak.code, 'sync', { scope: 'team' });
    res.json({ ok: true, interesse: { id: entry.id, status: entry.status } });
  });

  app.post('/api/rtf/talent/mijn', (req, res) => {
    const b = req.body || {};
    const sess = rtf.verifieerProfiel(b.code, b.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const code = String(b.code).toUpperCase();
    const matches = (Array.isArray(db.data.talentInteresses) ? db.data.talentInteresses : [])
      .filter(x => x.rtf && x.rtf.code === code && x.rtf.profielId === sess.p.id)
      .map(x => {
        const zaak = findSupplier(x.supplierCode);
        const vac = ((db.data.vacatures[x.supplierCode] || []).find(v => v.id === x.vacatureId));
        return {
          id: x.id, status: x.status, vacatureId: x.vacatureId, supplierCode: x.supplierCode,
          func: vac ? vac.func : x.func, bedrijf: zaak ? zaak.name : x.supplierCode,
          at: x.at, beslistAt: x.beslistAt || null
        };
      });
    res.json({ matches });
  });
};
