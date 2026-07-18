/* RTG Boardroom: de stoplicht-schakelkast van het platform (functies, talen,
   onboarding, per-persoon/land/doelgroep schakelen, AI-voorstellen). Gemount
   vanuit routes/techniek.js op de gedeelde context. */
const functies = require('../../functies');
module.exports = (tctx) => {
  const { app, accounts, anthropic, archief, beveilig, crypto, db, mail, save, sendPushToUser, LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx,
    geldPasprijsZet, geldKortingZet, geldCommissieZet } = tctx;
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
  // gedeelde AI-hulp (Rahul): begrijp een instructie en stel wijzigingen voor
  // (Claude of ingebouwd). Rahul regelt de HELE regie: schakelen per pas of
  // doelgroep, de leveranciers-regie per genre en de geld-regie; er verandert
  // pas iets als de eigenaar het voorstel toepast (mens beslist).
  const genresLijst = () => Object.entries(db.data.supplierTypes || {}).map(([id, tp]) => ({ id, label: tp.label }));
  async function boardroomAi(vraag, t) {
    const lokaal = functies.duidVoorstel(vraag, t.functies, { genres: genresLijst() });
    let antwoord = null, voorstel = lokaal.voorstel, bron = 'ingebouwd';
    if (anthropic) {
      try {
        const catTekst = functies.FUNCTIES.map(f => '- ' + f.id + ' ("' + f.naam + '", categorie ' + f.categorie +
          ', doelgroepen: ' + (f.doelgroepen || []).join('/') + ')').join('\n');
        const dgTekst = functies.DOELGROEPEN.map(d => d.id + ' = ' + d.naam).join(', ');
        const genreTekst = genresLijst().map(g => g.id).join(', ');
        const prompt = 'Je bent Rahul, de assistent van de RTG Boardroom (de schakelkast van het platform). De eigenaar kan functies ' +
          'globaal, per doelgroep of per genre zaken aan- of uitzetten, en bepaalt de geldkant (pasprijzen, ledenvoordeel, partnervergoeding).\n' +
          'Doelgroepen: ' + dgTekst + '.\nGenres zaken: ' + genreTekst + '.\nBeschikbare functies:\n' + catTekst +
          '\n\nVraag of instructie: "' + vraag + '"\n\nAntwoord kort in het Nederlands (max 4 zinnen). Vraagt de instructie om een ' +
          'wijziging, geef daarna EEN codeblok met een lijst wijzigingen in deze vormen:\n```json\n{"voorstel":[' +
          '{"id":"<functie-id>","doelgroep":"<doelgroep-id of null>","aan":true},' +
          '{"id":"<functie-id>","genre":"<genre-id>","aan":false},' +
          '{"soort":"pasprijs","pas":"rtg|lifestyle","euro":65},' +
          '{"soort":"korting","genre":"<genre-id>","pct":10},' +
          '{"soort":"commissie","genre":"<genre-id>","pct":8}]}\n```\n' +
          'Gebruik uitsluitend bestaande id\'s; laat doelgroep leeg (null) voor een globale wijziging. De gratis app blijft altijd ' +
          'gratis en de Business Pass is prijs op maat: stel daar nooit een prijs voor voor. Geen codeblok als er niets te wijzigen valt.';
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

  // Een AI-voorstel toepassen (alleen de eigenaar, in een tik). Naast het
  // schakelen (globaal/pas/genre) voert dit ook de geld-regie uit via de
  // geld-motor van de kern, die de grenzen nogmaals bewaakt.
  app.post('/api/boardroom/toepassen', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const wijz = functies.valideerVoorstel(req.body.voorstel);
    let toegepast = 0;
    const fouten = [];
    for (const w of wijz) {
      if (w.soort === 'pasprijs' || w.soort === 'korting' || w.soort === 'commissie') {
        const doe = w.soort === 'pasprijs' ? geldPasprijsZet({ pas: w.pas, euro: w.euro })
          : w.soort === 'korting' ? geldKortingZet({ genre: w.genre, pct: w.pct })
          : geldCommissieZet(w.code ? { code: w.code, pct: w.pct } : { genre: w.genre, pct: w.pct });
        if (doe && doe.ok) toegepast++; else fouten.push(w.naam + ': ' + ((doe && doe.error) || 'mislukt'));
        continue;
      }
      const cur = t.functies[w.id] = t.functies[w.id] || {};
      if (w.genre) { cur.perGenre = cur.perGenre || {}; if (w.aan) delete cur.perGenre[w.genre]; else cur.perGenre[w.genre] = false; }
      else if (w.doelgroep) { cur.perDoelgroep = cur.perDoelgroep || {}; cur.perDoelgroep[w.doelgroep] = w.aan; }
      else cur.aan = w.aan;
      toegepast++;
    }
    save();
    res.json({ ok: true, toegepast, fouten: fouten.length ? fouten : undefined, functies: functies.catalogus(t.functies) });
  });
};
