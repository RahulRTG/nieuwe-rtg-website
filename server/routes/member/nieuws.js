/* Member-submodule: RTG Nieuws -- de eigen nieuws-app met het gepubliceerde
   werk van RTG Redactie (kern/redactie.js). Voor iedereen met een sessie (ook
   gasten lezen mee: nieuws is een etalage), per rubriek, met Rahul als
   nieuwslezer die een artikel samenvat of er vragen over beantwoordt -- op
   basis van ALLEEN de artikeltekst, zonder er iets bij te verzinnen.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, anthropic, redactie } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/member/nieuws', auth, (req, res) => stuur(res, redactie.nieuws(String((req.body || {}).rubriek || ''))));
  app.post('/api/member/nieuws/artikel', auth, (req, res) => stuur(res, redactie.nieuwsArtikel(String((req.body || {}).id || ''))));

  // Rahul als nieuwslezer: samenvatten of een vraag over het stuk beantwoorden
  app.post('/api/member/nieuws/ai', auth, async (req, res) => {
    const r = redactie.nieuwsArtikel(String((req.body || {}).id || ''));
    if (r.error) return stuur(res, r);
    const a = r.artikel;
    const vraag = String((req.body || {}).vraag || '').slice(0, 300);
    if (anthropic) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../../kern/rahul').RAHUL_LEAD + 'je bent de nieuwslezer van RTG Nieuws. Beantwoord de vraag of vat samen ' +
            'op basis van UITSLUITEND het artikel hieronder; staat het er niet in, dan zeg je dat eerlijk. Kort en helder.\n\nARTIKEL: ' +
            a.kop + '\n' + (a.intro || '') + '\n' + a.tekst,
          messages: [{ role: 'user', content: vraag || 'Vat dit artikel samen in drie zinnen.' }]
        });
        const tekst = (resp.content.find(c => c.type === 'text') || {}).text;
        if (tekst) return res.json({ ok: true, antwoord: tekst });
      } catch (e) { /* val terug */ }
    }
    // demo: de eerste zinnen als eerlijke samenvatting
    const zinnen = (a.intro + ' ' + a.tekst).split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3).join(' ');
    res.json({ ok: true, demo: true, antwoord: 'In het kort: ' + zinnen });
  });
};
