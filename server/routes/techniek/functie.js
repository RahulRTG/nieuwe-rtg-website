/* Techniek-functieschakelaars: elke aan/uit-wijziging wordt een aanvraag die de
   eigenaar eerst bevestigt. Gemount vanuit routes/techniek.js op de gedeelde
   context. */
const functies = require('../../functies');
module.exports = (tctx) => {
  const { app, accounts, anthropic, archief, beveilig, crypto, db, mail, save, sendPushToUser, LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx } = tctx;
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
};
