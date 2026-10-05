/* Member-submodule: de RTF-gezinskoppeling. Een RTG-lid koppelt zich als oppas
   of familielid aan een RTFoundation-gezin, leest het kanaal en stuurt berichten;
   de gezinsmeldingen landen in de leden-app. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, eisAccount, rtf, accounts } = kern;

  app.post('/api/rtf/profielen', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    if (process.env.NODE_ENV !== 'test') return res.status(410).json({ error: 'Koppelen met alleen een gezinscode is gesloten. Vraag het gezin om uw persoonlijke uitnodiging.' });
    const info = rtf.gastProfielen(req.body.code);
    if (!info) return res.status(404).json({ error: 'Dit gezin kennen we niet. Klopt de gezinscode?' });
    if (!info.profielen.length) return res.status(404).json({ error: 'Dit gezin heeft nog geen oppas- of familieprofiel om te koppelen. Vraag de ouder er een aan te maken.' });
    res.json(info);
  });

  app.post('/api/rtf/koppel', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    if (process.env.NODE_ENV !== 'test') return res.status(410).json({ error: 'Gebruik de persoonlijke, eenmalige uitnodiging van het gezin.' });
    const u = req.session.account;
    const r = rtf.linkGast({ code: req.body.code, profielId: req.body.profielId, userId: u.id, tier: u.tier, codenaam: u.codename });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true, gezinNaam: r.gezinNaam, profielNaam: r.profielNaam, tierNaam: r.tierNaam });
  });

  app.post('/api/rtf/uitnodiging/accepteer', auth, async (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account;
    const r = await rtf.accepteerGast({ uitnodiging:req.body.uitnodiging, userId:u.id,
      tier:u.tier, codenaam:u.codename });
    if (r.error) return res.status(r.status || 400).json({ error:r.error });
    res.json(r);
  });

  app.post('/api/rtf/ontkoppel', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    rtf.unlinkGast({ userId: req.session.account.id, code: req.body.code, profielId: req.body.profielId });
    res.json({ ok: true });
  });

  /* B19: de EIGEN passkey aan het EIGEN gezinsprofiel hangen, zodat die sessie
     daarna met een vinger te verlengen is (foundation/gezinsdeur.js). Het vraagt
     drie dingen tegelijk: dit RTG-account, een lopende gezinssessie van het
     profiel (in het lijf), en een verse passkey van dit account, gebonden aan
     deze lid-sessie (zware poort, zonder terugval). Een gast niet: zijn kanaal
     blijft 12 uur. */
  app.post('/api/rtf/gezin/passkey', auth, async (req, res) => {
    if (!eisAccount(req, res)) return;
    const s = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!s) return res.status(403).json({ error: 'Log eerst in bij je gezin.' });
    if (s.gast) return res.status(403).json({ error: 'Een oppas of familielid verlengt niet; het kanaal blijft 12 uur.' });
    const zwaar = kern.zwaarbewijs;
    const user = zwaar && accounts.getUserById(req.session.account.id);
    if (!user) return res.status(503).json({ error: 'De passkeycontrole is op deze server niet ingericht.' });
    const sleutel = zwaar.sessieSleutel(req);
    const r = await zwaar.eis(user, 'gezin-passkey-koppel', sleutel, req, 'Je passkey aan je gezinsprofiel koppelen', { zonderTerugval: true });
    if (r.ok && r.bewezen === true)
      return rtf.koppelPasskey(s, user.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Dit profiel bestaat niet meer.' });
    if (r.bevestigingNodig) {
      const o = await zwaar.opties(user, 'gezin-passkey-koppel', sleutel, req);
      if (!o || o.error) return res.status((o && o.status) || 400).json({ error: (o && o.error) || 'De passkey kon niet worden gevraagd.' });
      return res.status(401).json({ bevestigingNodig: true, actie: 'gezin-passkey-koppel', error: r.error,
        bevestiging: { ceremonie: o.ceremonie, opties: o.opties } });
    }
    return r.ok ? res.status(403).json({ watNu: 'passkey-zetten', error: 'Koppelen kan alleen met een passkey.' }) : zwaar.stuur(res, r);
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
