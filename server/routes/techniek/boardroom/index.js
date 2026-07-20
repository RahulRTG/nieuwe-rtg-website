/* RTG Boardroom: de stoplicht-schakelkast van het platform (functies, talen,
   onboarding, per-persoon/land/doelgroep schakelen, AI-voorstellen). Gemount
   vanuit routes/techniek.js op de gedeelde context. De directe schakelaars staan
   in ./schakelaar, de AI-hulp (Rahul) in ./ai; hier de gedeelde helpers en de
   lees-/onboarding-routes. */
const functies = require('../../../functies');
module.exports = (tctx) => {
  // alleen wat deze module echt gebruikt (de rest van de gedeelde context hoort
  // hier niet thuis; opgeruimd om dode destructuring te vermijden)
  const { app, accounts, anthropic, db, save, LANDEN, keyVanCodenaam, talen, onboarding,
    staat, isEigenaar, techAuth, eigenaarAlleen, geldPasprijsZet, geldKortingZet, geldCommissieZet } = tctx;
  /* ================== RTG Boardroom ==================
     Een complete stoplicht-schakelkast: elke functie van het platform met een
     status (groen = aan, rood = uit, oranje = storing), een directe schakelaar
     (alleen de eigenaar), een reset en AI-hulp. De aan/uit-stand wordt door de
     functie-middleware echt gehandhaafd; "storing" is puur een statusvlag. */
  function boardroomTelling(cat) {
    let aan = 0, uit = 0, storing = 0;
    for (const g of cat) for (const f of g.functies) {
      if (f.status === 'uit') uit++; else if (f.status === 'storing') storing++; else aan++;
    }
    return { aan, uit, storing, totaal: aan + uit + storing };
  }

  // Een persoon (voor per-persoon uitzetten) herleiden uit een sleutel, e-mail of
  // codenaam. Geeft { key:'user-<id>', label } of null.
  async function herleidPersoon(invoer) {
    const s = String(invoer || '').trim();
    if (!s) return null;
    if (/^user-\d+$/.test(s)) {
      const u = accounts.getUserById(Number(s.slice(5)));
      return u ? { key: s, label: accounts.realNameOf(u) + ' · ' + (u.codename || '') } : null;
    }
    const u = accounts.findByLogin(s);
    if (u) return { key: 'user-' + u.id, label: accounts.realNameOf(u) + ' · ' + (u.codename || '') };
    // op codenaam (via de ledengids; kan async zijn met Postgres)
    try {
      const key = keyVanCodenaam ? await keyVanCodenaam(s) : null;
      if (key && /^user-\d+$/.test(key)) { const u2 = accounts.getUserById(Number(key.slice(5))); if (u2) return { key, label: accounts.realNameOf(u2) + ' · ' + s }; }
    } catch (e) {}
    return null;
  }
  // een leesbaar label voor een persoonssleutel op het bord
  function persoonLabel(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return key;
    const u = accounts.getUserById(Number(m[1]));
    return u ? (accounts.realNameOf(u) + ' · ' + (u.codename || '')) : key;
  }
  const landenLijst = () => Object.entries(LANDEN || {}).map(([code, v]) => ({ code, naam: (v && v.naam) || code }));

  // de AI-hulp (Rahul): begrijp een instructie en stel wijzigingen voor. Rahul
  // regelt de HELE regie (schakelen per pas/doelgroep, leveranciers per genre,
  // de geld-regie); er verandert pas iets als de eigenaar het voorstel toepast.
  const { boardroomAi } = require('./ai')({ db, anthropic });

  // Het bord: alle functies met stoplicht-status, plus de telling en AI-stand.
  app.post('/api/boardroom/status', techAuth, (req, res) => {
    const t = staat();
    const cat = functies.catalogus(t.functies);
    // labels bij de per-persoon-beperkingen zodat het bord namen toont i.p.v. sleutels
    for (const g of cat) for (const f of g.functies) {
      f.persoonUit = (f.persoonUit || []).map(k => ({ key: k, label: persoonLabel(k) }));
    }
    res.json({
      eigenaar: isEigenaar(req.techUser), naam: accounts.realNameOf(req.techUser),
      functies: cat, doelgroepen: functies.DOELGROEPEN, landen: landenLijst(),
      samenvatting: boardroomTelling(cat),
      aiBeschikbaar: !!anthropic,
      aiAan: !(t.zekeringen.ai && t.zekeringen.ai.aan === false)
    });
  });

  /* Wereldtalen: alle talen met hun schakelaar-status. Aanzetten maakt de taal
     kiesbaar in alle apps; iedereen chat in de eigen taal en de ander leest
     alles in de zijne (vertaling per bericht, gecachet). NL en EN zijn de
     basistalen en blijven altijd aan. */
  app.post('/api/boardroom/talen', techAuth, (req, res) => {
    res.json({ talen: talen.alle(), aiBeschikbaar: !!anthropic });
  });
  app.post('/api/boardroom/taal', techAuth, eigenaarAlleen, (req, res) => {
    const r = talen.zet(req.body.code, req.body.aan !== false && req.body.aan !== 'false');
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* Platform-onboarding: de verplichte intake + het contract dat elk account
     (gast, RTG, RTF, leverancier) tekent. De eigenaar leest en past dit aan --
     met de hand of met AI in gewone taal. Scope 'rtg' = platformbreed. */
  app.post('/api/boardroom/onboarding', techAuth, eigenaarAlleen, (req, res) => {
    res.json({ config: onboarding.config('rtg'), ondertekenaars: onboarding.ondertekenaars('rtg').slice(0, 50), aiBeschikbaar: !!anthropic });
  });
  app.post('/api/boardroom/onboarding/ai', techAuth, eigenaarAlleen, async (req, res) => {
    const opdracht = String(req.body.opdracht || '').slice(0, 1000);
    if (opdracht.length < 3) return res.status(400).json({ error: 'Beschrijf wat u wilt aanpassen.' });
    try { res.json(await onboarding.aiPasAan('rtg', opdracht)); }
    catch (e) { res.status(500).json({ error: 'Aanpassen mislukte.' }); }
  });

  // Persoon zoeken voor de per-persoon-schakelaar (eigenaar).
  app.post('/api/boardroom/persoon', techAuth, eigenaarAlleen, async (req, res) => {
    const p = await herleidPersoon(req.body.persoon);
    if (!p) return res.status(404).json({ error: 'Geen account gevonden op die codenaam of e-mail.' });
    res.json({ ok: true, key: p.key, label: p.label });
  });

  // AI-hulp: in gewone taal een voorstel laten maken (niets gaat automatisch om).
  app.post('/api/boardroom/ai', techAuth, async (req, res) => {
    const t = staat();
    if (t.zekeringen.ai && t.zekeringen.ai.aan === false) return res.status(503).json({ error: 'De AI-zekering staat uit.' });
    const vraag = String(req.body.vraag || '').slice(0, 500);
    if (!vraag.trim()) return res.status(400).json({ error: 'Stel een vraag of geef een instructie.' });
    res.json(await boardroomAi(vraag, t));
  });

  // De directe schakelaars, storing, reset en het toepassen van een AI-voorstel.
  require('./schakelaar')({ app, techAuth, eigenaarAlleen, staat, save, herleidPersoon, boardroomTelling,
    geldPasprijsZet, geldKortingZet, geldCommissieZet });
};
