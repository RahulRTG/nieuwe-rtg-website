/* De betaalde kant van de App Store, gezien door een LID.

   Twee stappen, en dat is met opzet geen een: eerst de BON (wat ga ik betalen,
   waar gaat het heen), dan de KOOP. Een knop die meteen afrekent is sneller en
   is precies wat GELD.md par. 3 verbiedt -- alles wat een derde raakt is
   maximaal "klaarzetten", en bevestigen doet de mens.

   HET LAND KOMT VAN HET LID EN WORDT NOOIT GERADEN. De btw op een digitale
   dienst hoort in het land van de afnemer (kern/fiscaal/digitaal.js), en dat is
   de wet en niet onze keuze. De onboarding bewaart "in welk land woon je?" als
   vrije tekst; die wordt hier herkend als hij te herkennen is, en het lid ziet
   hem op het bonscherm staan en bevestigt hem. Wat er niet uit te lezen valt,
   wordt een keuzelijst -- geen standaardland, want een verkeerd land is een
   verkeerd tarief en dat ziet er precies zo uit als een goed tarief. */
const { landcodeUit, landkeuze } = require('../../kern/fiscaal/digitaal');

module.exports = (kern) => {
  const { app, auth, appstore, liveCodename, onboarding } = kern;
  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const geld = () => appstore.geld;
  const geenGeld = (res) => res.status(503).json({ error: 'De betaallaag draait niet mee; betaalde apps zijn nu niet te kopen.', nietGebouwd: 'RTG Pay is in dit proces niet gemount.' });

  /* Wat het lid zelf ooit heeft opgegeven. Alleen als VOORSTEL: het bonscherm
     toont hem en het lid bevestigt of kiest een ander. */
  function landVoorstel(req) {
    if (!onboarding || typeof onboarding.status !== 'function') return null;
    try {
      const st = onboarding.status('rtg', req.session);
      const v = [].concat(st.velden || [], st.laterVelden || []).find(x => x.id === 'land');
      return landcodeUit(v && v.waarde) || null;
    } catch (e) { return null; }
  }

  /* De bon VOORAF. Geen 402 en geen fout als het land nog niet bekend is: dat is
     geen probleem maar een vraag, en een vraag hoort een keuzelijst te krijgen. */
  app.post('/api/appstore/bon', auth, (req, res) => {
    if (!geld()) return geenGeld(res);
    const land = landcodeUit(req.body.land) || landVoorstel(req);
    if (!land) {
      return res.json({ landNodig: true, landen: landkeuze(),
        waarom: 'De btw op een digitale aankoop hoort in het land waar jij woont. Dat is de wet en niet onze keuze; wij bewaren alleen de landcode bij de bon, geen adres.' });
    }
    const r = geld().bon({ sleutel: String(req.body.sleutel || ''), land });
    if (r.error && r.landNodig) return res.json({ landNodig: true, landen: landkeuze(), waarom: r.error });
    antwoord(res, r);
  });

  // de landen waaruit te kiezen valt, los opvraagbaar voor het scherm
  app.post('/api/appstore/landen', auth, (req, res) => res.json({ landen: landkeuze(), voorstel: landVoorstel(req) }));

  /* KOPEN. Het land moet MEE in het verzoek: het lid heeft het op de bon gezien
     en bevestigd. Zou de server hem hier zelf invullen, dan koopt een lid iets
     met een tarief dat hij niet heeft gezien. */
  app.post('/api/appstore/koop', auth, async (req, res) => {
    if (!geld()) return geenGeld(res);
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Kopen in de App Store is voor leden met een RTG-account.' });
    /* DEZELFDE POORT ALS ELK ANDER GELD-MOMENT. RTG Pay vraagt van een echt
       account eenmalig het paspoort (kern/onboarding: payGate); een aanschaf in
       de App Store is geen uitzondering daarop. Zou hij hier ontbreken, dan is
       de App Store de weg om die poort te omzeilen. */
    if (onboarding && typeof onboarding.payGate === 'function') {
      const g = onboarding.payGate(req.session);
      if (!g.ok) return res.status(g.status || 403).json({ error: g.error, kyc: true });
    }
    const land = landcodeUit(req.body.land);
    if (!land) return res.status(400).json({ error: 'Kies eerst je land; dat bepaalt de btw.', landNodig: true, landen: landkeuze() });
    const r = await geld().koop({ key: req.session.key, codenaam: liveCodename(req.session),
      sleutel: String(req.body.sleutel || ''), land, idem: String(req.body.idem || '') });
    antwoord(res, r);
  });

  // mijn bonnen: wat heb ik gekocht en wat stond erop
  app.post('/api/appstore/bonnen', auth, (req, res) => {
    if (!geld()) return geenGeld(res);
    const bak = geld().aankopen(req.session.key);
    res.json({ bonnen: Object.values(bak).sort((a, b) => (a.at < b.at ? 1 : -1)) });
  });
};
