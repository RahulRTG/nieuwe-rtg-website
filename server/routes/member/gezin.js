/* Member-submodule: de RTF-gezinskoppeling. Een RTG-lid koppelt zich als oppas
   of familielid aan een RTFoundation-gezin, leest het kanaal en stuurt berichten;
   de gezinsmeldingen landen in de leden-app. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, eisAccount, rtf, accounts } = kern;
  const { leeftijdVan } = require('../../lib/leeftijd');

  /* MIJN GEZIN: het gezin aan het account van de ouder
     (foundation/gezinseigenaar.js). Twee treden: gezin maken met een opgegeven
     leeftijd van 18+, en alles wat een kind raakt pas met een gecontroleerd
     paspoort (volwassen()). De stand van die tweede trede reist mee in elk
     antwoord, zodat het scherm kan zeggen WAAROM iets nog dicht is. */
  const mijnStand = (u) => {
    const md = accounts.getMemberState(u.id) || {};
    const leeftijd = md.geboren ? leeftijdVan(md.geboren) : null;
    return { leeftijd, volwassen: rtf.volwassenAccount(u.id) };
  };
  const stuur = (res, r, extra) => r.error
    ? res.status(r.status || 400).json(Object.assign({ error: r.error }, r.hoe ? { hoe: r.hoe } : {}))
    : res.json(Object.assign({}, r, extra));

  app.post('/api/rtf/eigen-gezin', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account, st = mijnStand(u);
    res.json(Object.assign(rtf.eigenGezin(u.id), { paspoortGecontroleerd: st.volwassen, achttienPlus: st.leeftijd != null && st.leeftijd >= 18 }));
  });

  app.post('/api/rtf/eigen-gezin/maak', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account, st = mijnStand(u), b = req.body || {};
    stuur(res, rtf.eigenGezinMaak({ userId: u.id, codenaam: u.codename, leeftijd: st.leeftijd,
      gezinsnaam: b.gezinsnaam, naam: b.naam, avatar: b.avatar, kleur: b.kleur,
      bevoegdGezin: b.bevoegdGezin, privacyAkkoord: b.privacyAkkoord }), { paspoortGecontroleerd: st.volwassen });
  });

  app.post('/api/rtf/eigen-gezin/sessie', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account;
    stuur(res, rtf.eigenGezinSessie({ userId: u.id, profielId: (req.body || {}).profielId, volwassen: mijnStand(u).volwassen }));
  });

  app.post('/api/rtf/eigen-gezin/kind', auth, (req, res) => {
    if (!eisAccount(req, res)) return;
    const u = req.session.account, b = req.body || {};
    stuur(res, rtf.eigenGezinKind({ userId: u.id, volwassen: mijnStand(u).volwassen,
      naam: b.naam, geboortedatum: b.geboortedatum, avatar: b.avatar, kleur: b.kleur }));
  });

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
