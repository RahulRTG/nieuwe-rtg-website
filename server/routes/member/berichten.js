/* Member-submodule: de Berichten-app -- alle gesprekken van het hele platform op
   een plek: Rahul (de leden-chat), de priveberichten met vrienden (de sociale
   laag), de Berichtenbox van MijnOverheid, de sollicitatie-chats van de werk-app
   en de reacties op je Pulse-berichten.

   Dit bestand levert de LIJST (met de vlaggen van het lid erop); de handelingen
   -- zoeken, vlaggen zetten en de drie AI-taken -- staan in ./berichtenapp.js.
   Prive-gesprekken worden sinds die ronde IN de app gelezen en beantwoord; de
   overige kanalen verwijzen nog door naar hun bron-app, die zelf de leesstanden
   bijhoudt. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, convOf, socialConnecties, dmSleutel, codenaamVan, overheid, stemmingVan, jarigVan, rtmail, berichten, commWerk } = kern;
  // het RTMAIL-adres van dit lid: zijn codenaam (privacy by design)
  const mijnCodenaam = req => (req.session.account && req.session.account.codename) || (codenaamVan ? codenaamVan(req.session.key) : null);

  app.post('/api/member/berichten', auth, (req, res) => {
    const mij = req.session.key;
    const kanalen = [];

    // 1. Rahul: het doorlopende gesprek in de leden-app
    try {
      if (req.session.account) {
        const conv = convOf(req.session.account.id) || [];
        const l = conv[conv.length - 1];
        kanalen.push({ soort: 'rahul', titel: 'Rahul', icoon: 'ster', laatste: l ? String(l.text).slice(0, 120) : 'Stel me gerust een vraag.',
          at: l ? l.at : null, ongelezen: 0, link: '/apps/app.html' });
      }
    } catch (e) {}

    // 2. de priveberichten met vrienden (op codenaam)
    try {
      const sc = socialConnecties(mij);
      for (const c of (sc.connections || []).slice(0, 40)) {
        /* Uit de communicatiekern: de priveberichten wonen daar sinds de
           verhuizing, en twee tellers voor hetzelfde aantal is hoe ze uit
           elkaar gaan lopen. */
        const brug = kern.commDm;
        if (!brug) break;
        const l = brug.laatste(mij, c.key);
        if (!l) continue;
        const ongelezen = brug.ongelezen(mij, c.key);
        kanalen.push({ soort: 'dm', key: c.key, titel: c.codename || codenaamVan(c.key), icoon: 'berichten',
          laatste: String(l.text || (l.post ? 'Deelde een Salon-post' : '')).slice(0, 120),
          at: l.at, ongelezen, link: '/apps/comm.html',
          // de wauw-laag reist mee: de dag-stemming en verjaardagsglans van je vriend
          stemming: stemmingVan ? stemmingVan(c.key) : null, jarig: jarigVan ? !!jarigVan(c.key) : false });
      }
    } catch (e) {}

    // 3. de Berichtenbox van MijnOverheid
    try {
      const box = overheid.berichten(mij);
      const l = (box.berichten || [])[0];
      if (l) kanalen.push({ soort: 'overheid', titel: 'Berichtenbox (MijnOverheid)', icoon: 'gebouw',
        laatste: l.titel, at: l.at, ongelezen: box.ongelezen || 0, link: '/apps/overheid.html' });
    } catch (e) {}

    // 4. werk: de sollicitatie-chats uit de openbare werk-app
    try {
      for (const c of Object.values(db.data.applyChats || {})) {
        if (!c.applicant || c.applicant.kind !== 'rtg' || c.applicant.key !== mij) continue;
        // de berichten staan sinds de verhuizing in de kern (kern/comm/werk.js)
        const rij = commWerk ? commWerk.berichten(c.id) : [];
        const l = rij[rij.length - 1];
        kanalen.push({ soort: 'werk', titel: c.bedrijf + ' · ' + c.func, icoon: 'werk',
          laatste: l ? String(l.tekst).slice(0, 120) : 'Sollicitatie gestart.',
          at: l ? l.at : c.at, ongelezen: l && l.van !== 'sollicitant' ? 1 : 0, link: '/apps/app.html' });
      }
    } catch (e) {}

    // 5. Pulse: de nieuwste reacties van anderen op jouw berichten
    try {
      const posts = ((db.data.pulse || {}).posts || []).filter(p => p.key === mij && !p.weg);
      let laatste = null;
      let n = 0;
      for (const p of posts) for (const r of p.reacties) if (r.key !== mij) { n += 1; if (!laatste || r.at > laatste.at) laatste = r; }
      if (laatste) kanalen.push({ soort: 'pulse', titel: 'Pulse-reacties', icoon: 'flits',
        laatste: laatste.codenaam + ': ' + String(laatste.tekst).slice(0, 100), at: laatste.at, ongelezen: 0, link: '/apps/pulse.html' });
    } catch (e) {}

    // 6. RTMAIL: het interne postvak (welkom + de automatiserings-seintjes)
    try {
      const codenaam = mijnCodenaam(req);
      if (rtmail && codenaam) {
        const vak = rtmail.postvak(codenaam, { limit: 1 });
        const l = vak[0];
        if (l) kanalen.push({ soort: 'rtmail', titel: 'RTMAIL', icoon: 'berichten',
          laatste: l.onderwerp, at: l.at, ongelezen: rtmail.ongelezen(codenaam), link: '/apps/rtmail.html' });
      }
    } catch (e) {}

    /* De vlaggen van dit lid erbij: vastgezette gesprekken bovenaan,
       stilgezette tellen niet mee in de teller, gearchiveerde staan alleen in de
       lijst als je er expliciet om vraagt (archief:true). Elk kanaal heeft een
       vast id (soort + sleutel) waar de vlag aan hangt. */
    const vlaggen = berichten.vlaggenVan(mij);
    const idVan = k => k.soort === 'dm' ? 'dm:' + (k.key || k.titel) : k.soort;
    for (const k of kanalen) { k.id = idVan(k); Object.assign(k, vlaggen[k.id] || {}); }
    const archief = !!req.body.archief;
    const zicht = kanalen.filter(k => archief ? k.weg : !k.weg);
    zicht.sort((a, b) => (b.vast ? 1 : 0) - (a.vast ? 1 : 0) || String(b.at || '').localeCompare(String(a.at || '')));
    res.json({ ok: true, kanalen: zicht.slice(0, 60), archief,
      ongelezen: zicht.reduce((s, k) => s + (k.stil ? 0 : (k.ongelezen || 0)), 0),
      inArchief: kanalen.filter(k => k.weg).length });
  });
};
