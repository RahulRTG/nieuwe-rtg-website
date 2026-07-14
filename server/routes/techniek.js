/* Domein "techniek": het beveiligde technische statusbord voor de Backoffice.

   Alleen de eigenaar (standaard Rahul Imran Ismail, via RTG_OWNER_EMAIL) komt
   erin; hij kan anderen handmatig toegang geven. Het bord toont per subsysteem
   een groen/oranje/rood bolletje met de code en uitleg, laat zekeringen resetten
   ("er weer in doen") of met de hand uitschakelen, en heeft een AI die bij een
   storing een diagnose en herstelstappen geeft. */
const techniek = require('../techniek');
const functies = require('../functies');
const eigenaar = require('../eigenaar');
const dbmod = require('../db');

module.exports = (kern) => {
  const { app, accounts, anthropic, archief, betaal, beveilig, crypto, db, mail, save, sendPushToUser, sessions, DATA_DIR, fs, path, LANDEN, keyVanCodenaam, gidsHaal, talen, onboarding } = kern;
  const OWNER_EMAIL = eigenaar.OWNER_EMAIL;

  function staat() {
    if (!db.data.techniek) db.data.techniek = {};
    const t = db.data.techniek;
    if (!Array.isArray(t.toegang)) t.toegang = [];
    if (!t.functies) t.functies = {}; // leeg = alles op de standaard (aan)
    if (!t.zekeringen) t.zekeringen = techniek.standaardZekeringen();
    // ontbrekende standaard-zekeringen bijvullen (voor nieuwe versies)
    const std = techniek.standaardZekeringen();
    for (const k of Object.keys(std)) if (!t.zekeringen[k]) t.zekeringen[k] = std[k];
    return t;
  }
  function eigenaarUser() {
    const t = staat();
    if (t.eigenaarId) { const u = accounts.getUserById(t.eigenaarId); if (u) return u; }
    const u = accounts.findByLogin(OWNER_EMAIL);
    if (u) { t.eigenaarId = u.id; save(); }
    return u || null;
  }
  function isEigenaar(user) { const o = eigenaarUser(); return !!(user && o && user.id === o.id); }
  function magInzien(user) { if (!user) return false; if (isEigenaar(user)) return true; return staat().toegang.includes(user.id); }

  function gebruikerUit(req) {
    const auth = req.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
    return token ? accounts.verifyToken(token) : null;
  }
  function techAuth(req, res, next) {
    const user = gebruikerUit(req);
    if (!user) return res.status(401).json({ error: 'Log in met je account.' });
    if (!magInzien(user)) {
      // een GELDIG account dat toch de technische pagina probeert te openen: dit
      // is een mogelijke rechten-escalatie -> meteen een kritieke melding
      if (beveilig) beveilig.meld('tech-toegang-geweigerd', 'kritiek',
        'Account "' + accounts.realNameOf(user) + '" probeerde de technische pagina te openen zonder recht.',
        { bron: 'user:' + user.id });
      return res.status(403).json({ error: 'Geen toegang tot de technische pagina.' });
    }
    req.techUser = user; next();
  }
  function eigenaarAlleen(req, res, next) {
    if (!isEigenaar(req.techUser)) return res.status(403).json({ error: 'Alleen de eigenaar mag dit.' });
    next();
  }

  function ctx() {
    return {
      db, accounts, anthropic, betaal, sessions, DATA_DIR, fs, path,
      STORE: dbmod.STORE, pgPing: dbmod.pgPing,
      mailGeconfigureerd: !!(process.env.SMTP_URL || process.env.SMTP_HOST),
      zekeringen: staat().zekeringen
    };
  }

  // Inloggen op de technische pagina: gewone accountgegevens, maar de toegang
  // wordt hier meteen gecontroleerd (anders 403, ook met geldig wachtwoord).
  app.post('/api/techniek/inloggen', async (req, res) => {
    const user = accounts.findByLogin(req.body.login);
    if (!user || !await accounts.verifyPassword(String(req.body.wachtwoord || ''), user.password_hash)) {
      if (beveilig) beveilig.meld('tech-login-mislukt', 'waarschuwing',
        'Mislukte inlogpoging op de technische pagina (login: ' + String(req.body.login || '').slice(0, 40) + ').',
        { bron: req.ip });
      return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    }
    if (!magInzien(user)) {
      // juist wachtwoord, maar geen recht op de technische pagina: hoog signaal
      if (beveilig) beveilig.meld('tech-login-zonder-recht', 'kritiek',
        'Account "' + accounts.realNameOf(user) + '" logde correct in maar heeft geen recht op de technische pagina.',
        { bron: 'user:' + user.id });
      return res.status(403).json({ error: 'Dit account heeft geen toegang tot de technische pagina.' });
    }
    res.json({ token: accounts.issueToken(user.id, 1), eigenaar: isEigenaar(user), naam: accounts.realNameOf(user) });
  });

  // Het statusbord: alle checks + zekeringen. Eigenaar ziet ook de toegangslijst.
  app.get('/api/techniek/status', techAuth, async (req, res) => {
    const checks = await techniek.draaiChecks(ctx());
    const t = staat();
    const zeker = Object.keys(t.zekeringen).map(id => ({ id, ...t.zekeringen[id] }));
    const cat = functies.catalogus(t.functies);
    const verzoeken = t.functieVerzoeken || [];
    const uit = {
      eigenaar: isEigenaar(req.techUser), naam: accounts.realNameOf(req.techUser),
      checks, zekeringen: zeker,
      functies: cat,
      doelgroepen: functies.DOELGROEPEN,
      functiesUit: cat.reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0),
      // extra beperkingen die alleen voor bepaalde doelgroepen gelden (functie
      // staat globaal aan, maar voor >=1 doelgroep uit)
      doelgroepUit: cat.reduce((n, g) => n + g.functies.reduce((m, f) => m + (f.aan ? f.doelgroepen.filter(d => !d.aan).length : 0), 0), 0),
      // open aanvragen bovenaan, daarna de laatst behandelde (audit-spoor)
      verzoeken: verzoeken.filter(v => v.status === 'wacht')
        .concat(verzoeken.filter(v => v.status !== 'wacht').slice(-8).reverse()),
      beveiliging: beveilig ? beveilig.samenvatting() : { open: 0, kritiek: 0, waarschuwing: 0, recent: [] },
      samenvatting: {
        ok: checks.filter(c => c.status === 'ok').length,
        waarschuwing: checks.filter(c => c.status === 'waarschuwing').length,
        fout: checks.filter(c => c.status === 'fout').length
      }
    };
    if (isEigenaar(req.techUser)) {
      uit.toegang = t.toegang.map(id => { const u = accounts.getUserById(id); return { id, naam: u ? accounts.realNameOf(u) : '?', email: u ? accounts.emailOf(u) : null }; });
      // de juridische grenzen: waar zelfs de eigenaar bewust GEEN inzage heeft
      uit.grenzen = eigenaar.GRENZEN;
      // de archiefkast: instelbare live-vensterbreedte en de huidige verdeling
      uit.archief = archief ? { dagen: archief.dagen(), levend: (db.data.orders || []).length, gearchiveerd: archief.stat().aantal } : null;
      // de moderniseringsverzoeken die de eigenaar zelf via de AI heeft gevraagd
      uit.moderniseringen = (t.moderniseringen || []).slice(-8).reverse();
    }
    res.json(uit);
  });

  // Zekering resetten ("er weer in doen") of met de hand uitschakelen.
  app.post('/api/techniek/zekering', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const z = t.zekeringen[req.body.id];
    if (!z) return res.status(404).json({ error: 'Onbekende zekering.' });
    if (req.body.actie === 'reset') { z.aan = true; z.reden = null; z.sindsGesprongen = null; }
    else if (req.body.actie === 'spring') { z.aan = false; z.reden = String(req.body.reden || 'handmatig uitgeschakeld').slice(0, 120); z.sindsGesprongen = Date.now(); }
    else return res.status(400).json({ error: 'Actie moet reset of spring zijn.' });
    save();
    res.json({ ok: true, id: req.body.id, aan: z.aan });
  });

  /* Functieschakelaars: NIETS gaat direct om. Elke aan/uit-wijziging wordt een
     AANVRAAG die de eigenaar (Rahul) eerst moet accepteren of weigeren; hij
     krijgt er een melding van in zijn account (push + e-mail). Drie vormen:
     - één functie:      { id, aan }
     - hele categorie:   { categorie, aan }
     - alles:            { alles: true, aan }
     Iedereen met toegang tot deze pagina mag een aanvraag doen; alleen de
     eigenaar besluit. Ook de eigenaar zelf bevestigt zijn eigen aanvraag, zodat
     er nooit iets per ongeluk in één klik omgaat. */
  app.post('/api/techniek/functie', techAuth, (req, res) => {
    const t = staat();
    const aan = req.body.aan !== false && req.body.aan !== 'false';
    // optioneel: richt de wijziging op een specifieke doelgroep (bijv. wel voor
    // de RTG-leden, niet voor de Lifestyle-leden). Leeg = de globale schakelaar.
    const dg = req.body.doelgroep ? String(req.body.doelgroep) : null;
    if (dg && !functies.DOELGROEP_IDS.includes(dg)) return res.status(400).json({ error: 'Onbekende doelgroep.' });
    const dgNaam = dg ? (functies.DOELGROEPEN.find(d => d.id === dg) || {}).naam : null;
    const suffix = (aan ? 'AAN' : 'UIT') + (dgNaam ? ' voor ' + dgNaam : '');
    let doelwit, label;
    if (req.body.alles) { doelwit = functies.FUNCTIES; label = 'Hele platform ' + suffix; }
    else if (req.body.categorie) {
      doelwit = functies.FUNCTIES.filter(f => f.categorie === req.body.categorie);
      if (!doelwit.length) return res.status(404).json({ error: 'Onbekende categorie.' });
      label = req.body.categorie + ': alles ' + suffix;
    } else if (req.body.id) {
      const f = functies.OP_ID[req.body.id];
      if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
      doelwit = [f]; label = f.naam + ' ' + suffix;
    } else return res.status(400).json({ error: 'Geef id, categorie of alles op.' });
    // bij een doelgroep: alleen functies die die doelgroep ook echt bedienen
    if (dg) doelwit = doelwit.filter(f => (f.doelgroepen || []).includes(dg));
    // alleen wat er echt zou veranderen komt in de aanvraag
    const wijzigingen = doelwit.filter(f => functies.functieAanVoor(f.id, dg, t.functies) !== aan).map(f => ({ id: f.id, aan, doelgroep: dg }));
    if (!wijzigingen.length) return res.json({ ok: true, status: 'ongewijzigd', functies: functies.catalogus(t.functies) });
    if (!Array.isArray(t.functieVerzoeken)) t.functieVerzoeken = [];
    const vz = {
      vid: crypto.randomBytes(6).toString('hex'), label, wijzigingen,
      doorId: req.techUser.id, doorNaam: accounts.realNameOf(req.techUser),
      at: new Date().toISOString(), status: 'wacht'
    };
    t.functieVerzoeken.push(vz);
    t.functieVerzoeken = t.functieVerzoeken.slice(-100); // audit-staart begrensd
    save();
    // melding naar de eigenaar: bevestigen of weigeren
    const o = eigenaarUser();
    if (o) {
      try { sendPushToUser(o.id, { icon: '🔔', title: 'Bevestiging nodig: functieschakelaar', body: vz.label + ' (aangevraagd door ' + vz.doorNaam + '). Open de technische pagina om te accepteren of te weigeren.' }); } catch (e) {}
      try { mail.send(accounts.emailOf(o), 'Bevestiging nodig: ' + vz.label,
        'Beste ' + accounts.realNameOf(o) + ',\n\nEr staat een wijziging van de functieschakelaars klaar:\n\n  ' + vz.label +
        ' (' + vz.wijzigingen.length + ' functie(s))\n  Aangevraagd door: ' + vz.doorNaam + '\n\n' +
        'Niets is nog veranderd. Open de technische pagina en accepteer of weiger de aanvraag.\n\nRahul Travel Group'); } catch (e) {}
    }
    res.json({ ok: true, status: 'wacht', verzoekId: vz.vid, label: vz.label, aantal: vz.wijzigingen.length });
  });

  // Het besluit van de eigenaar: accepteren (dan gaat de wijziging pas echt om)
  // of weigeren (er verandert niets).
  app.post('/api/techniek/functie/besluit', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const vz = (t.functieVerzoeken || []).find(v => v.vid === String(req.body.verzoekId || ''));
    if (!vz) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
    if (vz.status !== 'wacht') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
    if (req.body.akkoord === false) vz.status = 'geweigerd';
    else {
      for (const w of vz.wijzigingen) {
        const cur = t.functies[w.id] = t.functies[w.id] || {};
        if (w.doelgroep) { cur.perDoelgroep = cur.perDoelgroep || {}; cur.perDoelgroep[w.doelgroep] = w.aan; }
        else cur.aan = w.aan;
      }
      vz.status = 'akkoord';
    }
    vz.besluitAt = new Date().toISOString();
    save();
    res.json({ ok: true, status: vz.status, functies: functies.catalogus(t.functies) });
  });

  /* AI-hulp voor de controlekamer: de eigenaar stelt in gewone taal een vraag
     of geeft een instructie ("zet de sociale laag uit voor Lifestyle"). De AI
     antwoordt kort EN stelt concrete wijzigingen voor. Er gaat niets automatisch
     om: het voorstel loopt daarna gewoon via de aanvraag/bevestigingsstroom.
     Zonder AI-sleutel werkt een ingebouwde Nederlandse taal-hulp als terugval. */
  app.post('/api/techniek/functie/ai', techAuth, async (req, res) => {
    if (staat().zekeringen.ai && staat().zekeringen.ai.aan === false)
      return res.status(503).json({ error: 'De AI-zekering staat uit.' });
    const vraag = String(req.body.vraag || '').slice(0, 500);
    if (!vraag.trim()) return res.status(400).json({ error: 'Stel een vraag of geef een instructie.' });
    const t = staat();
    const lokaal = functies.duidVoorstel(vraag, t.functies);
    let antwoord = null, voorstel = lokaal.voorstel, bron = 'ingebouwd';
    if (anthropic) {
      try {
        const catTekst = functies.FUNCTIES.map(f => '- ' + f.id + ' ("' + f.naam + '", categorie ' + f.categorie +
          ', doelgroepen: ' + (f.doelgroepen || []).join('/') + ')').join('\n');
        const dgTekst = functies.DOELGROEPEN.map(d => d.id + ' = ' + d.naam).join(', ');
        const prompt = 'Je bent de assistent van de controlekamer van het RTG-platform. De eigenaar kan functies globaal ' +
          'of per doelgroep aan- of uitzetten.\nDoelgroepen: ' + dgTekst + '.\nBeschikbare functies:\n' + catTekst +
          '\n\nVraag of instructie van de eigenaar: "' + vraag + '"\n\n' +
          'Antwoord kort in het Nederlands (maximaal 4 zinnen). Vraagt de instructie om een wijziging, geef daarna EEN codeblok:\n' +
          '```json\n{"voorstel":[{"id":"<functie-id>","doelgroep":"<doelgroep-id of null>","aan":true}]}\n```\n' +
          'Gebruik uitsluitend bestaande id\'s uit de lijst; laat doelgroep leeg (null) voor een globale wijziging. Geen codeblok als er niets te wijzigen valt.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
        const tekst = (r.content && r.content[0] && r.content[0].text) || '';
        antwoord = tekst.replace(/```json[\s\S]*?```/g, '').trim();
        const m = tekst.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { const j = JSON.parse(m[1]); if (j && Array.isArray(j.voorstel)) voorstel = j.voorstel; } catch (e) {} }
        bron = 'ai';
      } catch (e) { antwoord = null; bron = 'ingebouwd'; }
    }
    if (!antwoord) antwoord = lokaal.uitleg;
    voorstel = functies.valideerVoorstel(voorstel);
    res.json({ antwoord, voorstel, bron });
  });

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
  // gedeelde AI-hulp: begrijp een instructie en stel wijzigingen voor (Claude of ingebouwd)
  async function boardroomAi(vraag, t) {
    const lokaal = functies.duidVoorstel(vraag, t.functies);
    let antwoord = null, voorstel = lokaal.voorstel, bron = 'ingebouwd';
    if (anthropic) {
      try {
        const catTekst = functies.FUNCTIES.map(f => '- ' + f.id + ' ("' + f.naam + '", categorie ' + f.categorie +
          ', doelgroepen: ' + (f.doelgroepen || []).join('/') + ')').join('\n');
        const dgTekst = functies.DOELGROEPEN.map(d => d.id + ' = ' + d.naam).join(', ');
        const prompt = 'Je bent de assistent van de RTG Boardroom (de schakelkast van het platform). De eigenaar kan functies ' +
          'globaal of per doelgroep aan- of uitzetten.\nDoelgroepen: ' + dgTekst + '.\nBeschikbare functies:\n' + catTekst +
          '\n\nVraag of instructie: "' + vraag + '"\n\nAntwoord kort in het Nederlands (max 4 zinnen). Vraagt de instructie om een ' +
          'wijziging, geef daarna EEN codeblok:\n```json\n{"voorstel":[{"id":"<functie-id>","doelgroep":"<doelgroep-id of null>","aan":true}]}\n```\n' +
          'Gebruik uitsluitend bestaande id\'s; laat doelgroep leeg (null) voor een globale wijziging. Geen codeblok als er niets te wijzigen valt.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
        const tekst = (r.content && r.content[0] && r.content[0].text) || '';
        antwoord = tekst.replace(/```json[\s\S]*?```/g, '').trim();
        const m = tekst.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { const j = JSON.parse(m[1]); if (j && Array.isArray(j.voorstel)) voorstel = j.voorstel; } catch (e) {} }
        bron = 'ai';
      } catch (e) { antwoord = null; bron = 'ingebouwd'; }
    }
    if (!antwoord) antwoord = lokaal.uitleg;
    return { antwoord, voorstel: functies.valideerVoorstel(voorstel), bron };
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

  /* Directe schakelaar (alleen de eigenaar). Vier assen, meest specifiek wint:
     - { id, persoon, aan }   -> per persoon (e-mail/codenaam/sleutel)
     - { id, land, aan }      -> per land (2-letter code)
     - { id, doelgroep, aan } -> per pas/doelgroep
     - { id, aan }            -> globaal
     Op een as (niet globaal) betekent aan=true: de beperking wordt verwijderd. */
  app.post('/api/boardroom/zet', techAuth, eigenaarAlleen, async (req, res) => {
    const t = staat();
    const f = functies.OP_ID[req.body.id];
    if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
    const aan = req.body.aan !== false && req.body.aan !== 'false';
    const cur = t.functies[f.id] = t.functies[f.id] || {};
    if (req.body.persoon) {
      const p = await herleidPersoon(req.body.persoon);
      if (!p) return res.status(404).json({ error: 'Geen account gevonden op die codenaam of e-mail.' });
      cur.perPersoon = cur.perPersoon || {};
      if (aan) delete cur.perPersoon[p.key]; else cur.perPersoon[p.key] = false;
    } else if (req.body.land) {
      const land = String(req.body.land).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (land.length !== 2) return res.status(400).json({ error: 'Geef een geldige landcode (2 letters).' });
      cur.perLand = cur.perLand || {};
      if (aan) delete cur.perLand[land]; else cur.perLand[land] = false;
    } else if (req.body.doelgroep) {
      const dg = String(req.body.doelgroep);
      if (!(f.doelgroepen || []).includes(dg)) return res.status(400).json({ error: 'Deze functie kent die doelgroep niet.' });
      cur.perDoelgroep = cur.perDoelgroep || {};
      if (aan) delete cur.perDoelgroep[dg]; else cur.perDoelgroep[dg] = false;
    } else {
      cur.aan = aan;
    }
    save();
    res.json({ ok: true, id: f.id, status: functies.functieStatus(f.id, t.functies) });
  });

  // Storing melden of herstellen (oranje aan/uit): { id, storing:bool, reden }.
  app.post('/api/boardroom/storing', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const f = functies.OP_ID[req.body.id];
    if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
    const cur = t.functies[f.id] = t.functies[f.id] || {};
    if (req.body.storing === false || req.body.storing === 'false') cur.storing = null;
    else cur.storing = { reden: String(req.body.reden || 'Handmatig gemeld').slice(0, 160), at: new Date().toISOString() };
    save();
    res.json({ ok: true, id: f.id, status: functies.functieStatus(f.id, t.functies) });
  });

  // Reset: alle functies terug naar de standaard (alles aan, storingen weg).
  app.post('/api/boardroom/reset', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    t.functies = {};
    save();
    res.json({ ok: true, functies: functies.catalogus(t.functies), samenvatting: boardroomTelling(functies.catalogus(t.functies)) });
  });

  // AI-hulp: in gewone taal een voorstel laten maken (niets gaat automatisch om).
  app.post('/api/boardroom/ai', techAuth, async (req, res) => {
    const t = staat();
    if (t.zekeringen.ai && t.zekeringen.ai.aan === false) return res.status(503).json({ error: 'De AI-zekering staat uit.' });
    const vraag = String(req.body.vraag || '').slice(0, 500);
    if (!vraag.trim()) return res.status(400).json({ error: 'Stel een vraag of geef een instructie.' });
    res.json(await boardroomAi(vraag, t));
  });

  // Een AI-voorstel toepassen (alleen de eigenaar, in een tik).
  app.post('/api/boardroom/toepassen', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const wijz = functies.valideerVoorstel(req.body.voorstel);
    for (const w of wijz) {
      const cur = t.functies[w.id] = t.functies[w.id] || {};
      if (w.doelgroep) { cur.perDoelgroep = cur.perDoelgroep || {}; cur.perDoelgroep[w.doelgroep] = w.aan; }
      else cur.aan = w.aan;
    }
    save();
    res.json({ ok: true, toegepast: wijz.length, functies: functies.catalogus(t.functies) });
  });

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

  // Hulp voor de kern: mag een door een zekering bewaakt subsysteem draaien?
  kern.zekeringMag = (id) => { const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[id]; return !z || z.aan !== false; };
};
