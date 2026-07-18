/* Member-submodule: de RTF-gezinskoppeling. Een RTG-lid koppelt zich als oppas
   of familielid aan een RTFoundation-gezin, leest het kanaal en stuurt berichten;
   de gezinsmeldingen landen in de leden-app. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, eisAccount, rtf, accounts } = kern;

  app.post('/api/rtf/profielen', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const info = rtf.gastProfielen(req.body.code);
    if (!info) return res.status(404).json({ error: 'Dit gezin kennen we niet. Klopt de gezinscode?' });
    if (!info.profielen.length) return res.status(404).json({ error: 'Dit gezin heeft nog geen oppas- of familieprofiel om te koppelen. Vraag de ouder er een aan te maken.' });
    res.json(info);
  });

  app.post('/api/rtf/koppel', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account;
    const r = rtf.linkGast({ code: req.body.code, profielId: req.body.profielId, userId: u.id, tier: u.tier, codenaam: u.codename });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true, gezinNaam: r.gezinNaam, profielNaam: r.profielNaam, tierNaam: r.tierNaam });
  });

  app.post('/api/rtf/ontkoppel', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    rtf.unlinkGast({ userId: req.session.account.id, code: req.body.code, profielId: req.body.profielId });
    res.json({ ok: true });
  });

  app.post('/api/rtf/meldingen/gelezen', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const md = accounts.getMemberState(req.session.account.id) || {};
    (md.foundationMeldingen || []).forEach(m => { m.gelezen = true; });
    accounts.saveMemberState(req.session.account.id, md);
    res.json({ ok: true });
  });

  app.post('/api/rtf/overzicht', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    res.json({ gezinnen: rtf.gastOverzicht(req.session.account.id) });
  });

  app.post('/api/rtf/kanaal', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const info = rtf.kanaalInfo(req.session.account.id, req.body.code);
    if (!info) return res.status(403).json({ error: 'Je bent niet aan dit gezin gekoppeld.' });
    res.json(info);
  });

  app.post('/api/rtf/bericht', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const r = rtf.berichtVanGast({ userId: req.session.account.id, code: req.body.code, tekst: req.body.tekst });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true });
  });
};
