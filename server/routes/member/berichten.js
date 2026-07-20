/* Member-submodule: de Berichten-app -- alle gesprekken van het hele platform op
   een plek: Rahul (de leden-chat), de priveberichten met vrienden (de sociale
   laag), de Berichtenbox van MijnOverheid, de sollicitatie-chats van de werk-app
   en de reacties op je Pulse-berichten. De app leest alleen en verwijst door;
   lezen/beantwoorden gebeurt in de bron-app (die houdt zelf de leesstanden bij).
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, convOf, socialConnecties, dmSleutel, codenaamVan, overheid } = kern;

  app.post('/api/member/berichten', auth, (req, res) => {
    const mij = req.session.key;
    const kanalen = [];

    // 1. Rahul: het doorlopende gesprek in de leden-app
    try {
      if (req.session.account) {
        const conv = convOf(req.session.account.id) || [];
        const l = conv[conv.length - 1];
        kanalen.push({ soort: 'rahul', titel: 'Rahul', icoon: '✨', laatste: l ? String(l.text).slice(0, 120) : 'Stel me gerust een vraag.',
          at: l ? l.at : null, ongelezen: 0, link: '/apps/app.html' });
      }
    } catch (e) {}

    // 2. de priveberichten met vrienden (op codenaam)
    try {
      const sc = socialConnecties(mij);
      for (const c of (sc.connections || []).slice(0, 40)) {
        const chat = (db.data.memberChats || {})[dmSleutel(mij, c.key)];
        if (!chat || !chat.messages.length) continue;
        const l = chat.messages[chat.messages.length - 1];
        const gelezen = chat.read && chat.read[mij];
        const ongelezen = chat.messages.filter(m => m.from !== mij && (!gelezen || m.at > gelezen)).length;
        kanalen.push({ soort: 'dm', titel: c.codename || codenaamVan(c.key), icoon: '💬',
          laatste: String(l.text || (l.post ? 'Deelde een Salon-post' : '')).slice(0, 120),
          at: l.at, ongelezen, link: '/apps/vrienden.html' });
      }
    } catch (e) {}

    // 3. de Berichtenbox van MijnOverheid
    try {
      const box = overheid.berichten(mij);
      const l = (box.berichten || [])[0];
      if (l) kanalen.push({ soort: 'overheid', titel: 'Berichtenbox (MijnOverheid)', icoon: '🏛️',
        laatste: l.titel, at: l.at, ongelezen: box.ongelezen || 0, link: '/apps/overheid.html' });
    } catch (e) {}

    // 4. werk: de sollicitatie-chats uit de openbare werk-app
    try {
      for (const c of Object.values(db.data.applyChats || {})) {
        if (!c.applicant || c.applicant.kind !== 'rtg' || c.applicant.key !== mij) continue;
        const l = c.berichten[c.berichten.length - 1];
        kanalen.push({ soort: 'werk', titel: c.bedrijf + ' · ' + c.func, icoon: '💼',
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
      if (laatste) kanalen.push({ soort: 'pulse', titel: 'Pulse-reacties', icoon: '⚡',
        laatste: laatste.codenaam + ': ' + String(laatste.tekst).slice(0, 100), at: laatste.at, ongelezen: 0, link: '/apps/pulse.html' });
    } catch (e) {}

    kanalen.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    res.json({ ok: true, kanalen: kanalen.slice(0, 60), ongelezen: kanalen.reduce((s, k) => s + (k.ongelezen || 0), 0) });
  });
};
