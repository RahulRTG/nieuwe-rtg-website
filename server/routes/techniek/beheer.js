/* Techniek-beheer: moderniseringsverzoeken, beveiligingsmeldingen, de
   archiefkast, toegangsbeheer en de AI-diagnose per check. Gemount vanuit
   routes/techniek.js op de gedeelde context. */
const techniek = require('../../techniek');
const eigenaar = require('../../eigenaar');
const { log } = require('../../log');
module.exports = (tctx) => {
  const { app, accounts, anthropic, archief, beveilig, crypto, db, mail, save, sendPushToUser, LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx } = tctx;
  /* De eigenaar vraagt ZELF om een update/modernisering, in gewone taal. De AI
     geeft een concreet, veilig plan. NIETS gaat live naar de gasten: het verzoek
     wordt vastgelegd als voorstel dat via de veilige stroom (Claude stelt voor via
     een pull request, de eigenaar keurt goed) wordt uitgevoerd, precies volgens
     docs/automatische-modernisering.md. Zo merkt de gast er nooit iets van. */
  app.post('/api/techniek/moderniseer', techAuth, eigenaarAlleen, async (req, res) => {
    const t = staat();
    const verzoek = String(req.body.verzoek || '').slice(0, 800).trim();
    if (!verzoek) return res.status(400).json({ error: 'Beschrijf kort wat u wilt vernieuwen of verbeteren.' });
    let plan = null, bron = 'ingebouwd';
    if (anthropic && !(t.zekeringen.ai && t.zekeringen.ai.aan === false)) {
      try {
        const prompt = 'Je bent de technische adviseur van het RTG-platform (Node.js/Express). De EIGENAAR vraagt om een ' +
          'update of modernisering. Geef in het Nederlands een KORT, concreet en VEILIG plan (maximaal 8 bondige bullets): ' +
          'wat te wijzigen, waarom, en de impact op beveiliging en privacy. Cruciaal: er gaat NIETS live naar de gasten; dit ' +
          'wordt een pull request die de eigenaar eerst goedkeurt, en de volledige testsuite plus de huisstijlcheck moeten ' +
          'groen zijn. Privacy en security blijven de strengste norm; de juridische grenzen en de kinderbescherming blijven ' +
          'onaantastbaar. Verzoek van de eigenaar: "' + verzoek + '"';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
        plan = (r.content && r.content[0] && r.content[0].text) || null;
        bron = 'ai';
      } catch (e) { plan = null; bron = 'ingebouwd'; }
    }
    if (!plan) plan = 'Uw verzoek is vastgelegd als moderniseringsvoorstel. Het wordt via de veilige stroom uitgevoerd:\n' +
      '- Claude stelt de wijziging voor als pull request; u keurt hem goed. Er wordt nooit zonder uw akkoord samengevoegd.\n' +
      '- De volledige testsuite en de huisstijlcheck moeten groen zijn voordat er iets wordt voorgesteld.\n' +
      '- Privacy en beveiliging blijven de strengste norm; de juridische grenzen en de kinderbescherming blijven onaantastbaar.\n' +
      '- Gasten merken er niets van: er gaat nooit iets live zonder uw goedkeuring.\n\n(Zet ANTHROPIC_API_KEY voor een AI-advies op maat.)';
    if (!Array.isArray(t.moderniseringen)) t.moderniseringen = [];
    const item = { id: crypto.randomBytes(6).toString('hex'), verzoek, plan, door: accounts.realNameOf(req.techUser), at: new Date().toISOString(), status: 'aangevraagd' };
    t.moderniseringen.push(item);
    t.moderniseringen = t.moderniseringen.slice(-50); // audit-staart begrensd
    save();
    // de eigenaar krijgt ook een melding in zijn account (spoor + herinnering)
    try { sendPushToUser(req.techUser.id, { icon: '\u{1F6E0}️', title: 'Moderniseringsverzoek vastgelegd', body: 'Claude verwerkt dit veilig als voorstel (pull request) dat u goedkeurt. Gasten merken er niets van.' }); } catch (e) {}
    res.json({ ok: true, id: item.id, plan, bron, aantal: t.moderniseringen.length });
  });

  /* Beveiligingsmelding(en) afhandelen: de eigenaar bevestigt dat hij ze heeft
     gezien. Zonder id: alle open meldingen ineens. */
  app.post('/api/techniek/beveiliging/afhandelen', techAuth, eigenaarAlleen, (req, res) => {
    if (!beveilig) return res.json({ ok: true, afgehandeld: 0 });
    const n = beveilig.handelAf(req.body.id ? String(req.body.id) : null);
    res.json({ ok: true, afgehandeld: n, beveiliging: beveilig.samenvatting() });
  });

  /* De automatische noodrem aan- of uitzetten (alleen de eigenaar). Aan =
     bij een brede brute-force-aanval springen de zekeringen vanzelf. */
  app.post('/api/techniek/beveiliging/auto', techAuth, eigenaarAlleen, (req, res) => {
    if (!beveilig) return res.status(503).json({ error: 'Beveiligingsmodule niet actief.' });
    const aan = beveilig.zetAuto(req.body.aan !== false && req.body.aan !== 'false');
    res.json({ ok: true, autoReactie: aan });
  });

  // Iemand handmatig toegang geven of intrekken (alleen de eigenaar).
  // De archiefgrens (live-venster in dagen) instellen; draait meteen een ronde.
  app.post('/api/techniek/archief', techAuth, eigenaarAlleen, (req, res) => {
    if (!archief) return res.status(409).json({ error: 'De archiefkast draait niet in dit proces.' });
    const dagen = archief.zetDagen(req.body.dagen);
    let verplaatst = 0;
    try { verplaatst = archief.archiveerNu().verplaatst; } catch (e) {}
    res.json({ ok: true, dagen, verplaatst, levend: (db.data.orders || []).length, gearchiveerd: archief.stat().aantal });
  });

  app.post('/api/techniek/toegang', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const doel = accounts.findByLogin(req.body.email);
    if (!doel) return res.status(404).json({ error: 'Geen account met dat e-mailadres of die gebruikersnaam.' });
    if (isEigenaar(doel)) return res.status(400).json({ error: 'De eigenaar heeft altijd al toegang.' });
    if (req.body.actie === 'intrek') t.toegang = t.toegang.filter(id => id !== doel.id);
    else if (!t.toegang.includes(doel.id)) t.toegang.push(doel.id);
    save();
    res.json({ ok: true, toegang: t.toegang.length });
  });

  /* Het eigenaarschap overdragen. Dit is de zwaarste handeling die het systeem
     kent: de eigenaar is de enige die zekeringen mag omzetten, functies mag
     uitschakelen en anderen toegang mag geven. Daarom drie sloten:

     1. Het wachtwoord opnieuw. Een geleend of gestolen token is niet genoeg;
        wie overdraagt moet op dat moment bewijzen dat hij het is.
     2. Het nieuwe adres MOET een bestaand account zijn. Draag je over aan een
        adres dat niemand heeft, dan is de technische pagina voor iedereen
        dicht en kan degene die dat adres later registreert hem overnemen.
        Precies het gat waar de go-live-controle voor waarschuwt.
     3. Er blijft een spoor. Elke overdracht komt in het logboek en gaat als
        kritieke melding het beveiligingsbord op. Een stille machtsoverdracht
        hoort niet te kunnen. */
  app.post('/api/techniek/eigenaar', techAuth, eigenaarAlleen, async (req, res) => {
    const t = staat();
    const nieuw = String(req.body.email || '').trim().toLowerCase();
    if (!nieuw) return res.status(400).json({ error: 'Vul het e-mailadres van de nieuwe eigenaar in.' });

    // slot 1: het wachtwoord van de HUIDIGE eigenaar, hier en nu
    const wachtwoord = String(req.body.wachtwoord || '');
    if (!wachtwoord || !await accounts.verifyPassword(wachtwoord, req.techUser.password_hash)) {
      if (beveilig) beveilig.meld('eigenaar-overdracht-mislukt', 'kritiek',
        'Poging tot overdracht van het eigenaarschap met een onjuist wachtwoord.',
        { bron: 'user:' + req.techUser.id });
      return res.status(401).json({ error: 'Onjuist wachtwoord; er is niets gewijzigd.' });
    }

    // slot 2: er moet een account achter zitten, anders sluit je jezelf buiten
    const doel = accounts.findByLogin(nieuw);
    if (!doel) {
      return res.status(404).json({
        error: 'Er is nog geen RTG-account met dat e-mailadres. Maak dat account eerst aan; ' +
          'anders zou de technische pagina voor iedereen dicht zitten.'
      });
    }
    const doelEmail = (accounts.emailOf(doel) || '').trim().toLowerCase();
    if (!doelEmail) return res.status(400).json({ error: 'Dat account heeft geen e-mailadres in de kluis.' });
    if (doelEmail === eigenaar.eigenaarEmail()) {
      return res.status(400).json({ error: 'Dat is al de eigenaar; er is niets gewijzigd.' });
    }

    const vorige = eigenaar.eigenaarEmail();
    if (!eigenaar.zetEigenaarEmail(doelEmail)) {
      return res.status(400).json({ error: 'Dat is geen geldig e-mailadres.' });
    }
    t.eigenaarEmail = doelEmail;
    t.eigenaarId = doel.id;

    // slot 3: het spoor
    if (!Array.isArray(t.eigenaarLog)) t.eigenaarLog = [];
    t.eigenaarLog.unshift({
      van: vorige, naar: doelEmail,
      doorId: req.techUser.id, doorNaam: accounts.realNameOf(req.techUser),
      at: new Date().toISOString()
    });
    if (t.eigenaarLog.length > 50) t.eigenaarLog.length = 50;
    save();

    log.info('eigenaar-overgedragen', { van: vorige, naar: doelEmail, door: req.techUser.id });
    if (beveilig) beveilig.meld('eigenaar-overgedragen', 'kritiek',
      'Het eigenaarschap van het platform is overgedragen van ' + vorige + ' naar ' + doelEmail +
      ' door ' + accounts.realNameOf(req.techUser) + '.',
      { bron: 'user:' + req.techUser.id });

    res.json({ ok: true, eigenaar: doelEmail, naam: accounts.realNameOf(doel), vorige });
  });

  // AI-hulp: geef een diagnose en herstelstappen voor een (falende) check.
  app.post('/api/techniek/ai', techAuth, async (req, res) => {
    if (staat().zekeringen.ai && staat().zekeringen.ai.aan === false)
      return res.status(503).json({ error: 'De AI-zekering staat uit.' });
    const checks = await techniek.draaiChecks(ctx());
    const chk = checks.find(c => c.id === req.body.checkId);
    if (!chk) return res.status(404).json({ error: 'Onbekende check.' });
    const prompt = `Je bent de technische assistent van het RTG-platform (Node.js/Express, PostgreSQL). ` +
      `Subsysteem "${chk.naam}" (code ${chk.code}) heeft status ${chk.status.toUpperCase()}: ${chk.detail}\n` +
      `Geef in het Nederlands een korte diagnose en concrete herstelstappen (maximaal 6 bondige bullets). ` +
      `Noem waar nuttig de betrokken omgevingsvariabele of het bestand.`;
    let advies;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
        advies = (r.content && r.content[0] && r.content[0].text) || null;
      } catch (e) { advies = null; }
    }
    if (!advies) advies = canned(chk);
    res.json({ check: { id: chk.id, naam: chk.naam, code: chk.code, status: chk.status }, advies, bron: anthropic ? 'ai' : 'ingebouwd' });
  });

  // Terugvaladvies zonder AI-sleutel: vaste, nuttige herstelstappen per check.
  function canned(chk) {
    const t = {
      postgres: '- Controleer of PostgreSQL draait en bereikbaar is.\n- Controleer DATABASE_URL (host, poort, wachtwoord).\n- Kijk of het connection-limiet niet vol zit (PG_POOL_MAX).\n- De app draait intussen door op de lokale snapshot als fallback.',
      schijf: '- Ruim oude bestanden/back-ups op in de datamap.\n- Vergroot de schijf of het volume.\n- Controleer of logs niet vollopen.',
      backups: '- Controleer of de back-uptaak draait (dagelijks).\n- Controleer schrijfrechten op de back-upmap.\n- Zet RTG_BACKUP_DIR voor een tweede kopie.',
      email: '- Zet SMTP_URL of SMTP_HOST/PORT/USER/PASS.\n- Test met een herstel-mail.',
      betalingen: '- Zet STRIPE_SECRET_KEY en STRIPE_WEBHOOK_SECRET voor echte betalingen.',
      ai: '- Zet ANTHROPIC_API_KEY voor echte AI-antwoorden.',
      versleuteling: '- Zet RTG_ENC_KEY (64 hex-tekens) voor versleuteling-at-rest.'
    };
    return (t[chk.id] || '- Bekijk de logs rond dit subsysteem.\n- Controleer de bijbehorende omgevingsvariabelen.') +
      '\n\n(Ingebouwd advies; zet ANTHROPIC_API_KEY voor een AI-diagnose op maat.)';
  }
};
