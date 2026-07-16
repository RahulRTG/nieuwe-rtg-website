/* Het babyboekje: het dagboek van de allerkleinsten (RTF Mini), door de ouders.
   Elke dag een foto of een stukje tekst over het kindje; de foto's gaan naar de
   mediastore (versleuteld op schijf, alleen een verwijzing in de data). Ouders
   voegen de namen van de rest van het gezin toe, zodat de buddy leuke momenten
   voor het hele gezin kan bedenken; zonder AI-sleutel komt er een warm demosetje.
   Alles hangt aan het gezin zelf (g.babyboek) en is onzichtbaar voor gasten. */

module.exports = ({ save, crypto, media, anthropic }) => {

  const fout = (status, error) => ({ status, error });
  const MAX_ENTRIES = 2000;
  const MAX_NAMEN = 12;

  function boek(g) {
    if (!g.babyboek) g.babyboek = { kindNaam: '', geboren: '', gezin: [], entries: [], momenten: null };
    return g.babyboek;
  }
  function vandaag() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // "3 maanden" / "1 jaar" / "2,5 jaar": warm en op de maat van een klein kind
  function leeftijdTekst(geboren) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(geboren || ''))) return null;
    const ms = Date.now() - new Date(geboren + 'T00:00:00').getTime();
    if (!(ms > 0)) return null;
    const maanden = Math.floor(ms / (30.44 * 86400000));
    if (maanden < 1) return 'pasgeboren';
    if (maanden < 24) return maanden + (maanden === 1 ? ' maand' : ' maanden');
    const jaren = Math.floor(maanden / 12);
    return maanden % 12 >= 6 ? jaren + ',5 jaar' : jaren + ' jaar';
  }
  const schoonTekst = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

  function uiterlijk(e, s) {
    return {
      id: e.id, dag: e.dag, tekst: e.tekst, foto: e.foto ? media.url(e.foto) : null,
      van: e.van, avatar: e.avatar, at: e.at, magWeg: e.vanId === s.p.id || s.beheerder
    };
  }

  function boekVan(s) {
    const b = boek(s.g);
    return {
      ok: true, kindNaam: b.kindNaam, geboren: b.geboren, leeftijd: leeftijdTekst(b.geboren),
      gezin: b.gezin, momenten: b.momenten, entries: b.entries.map(e => uiterlijk(e, s))
    };
  }

  function instellen(s, { kindNaam, geboren }) {
    const b = boek(s.g);
    const naam = schoonTekst(kindNaam, 30);
    if (!naam) return fout(400, 'Hoe heet jullie kindje?');
    b.kindNaam = naam;
    b.geboren = /^\d{4}-\d{2}-\d{2}$/.test(String(geboren || '')) ? geboren : '';
    save();
    return { ok: true, kindNaam: b.kindNaam, geboren: b.geboren, leeftijd: leeftijdTekst(b.geboren) };
  }

  async function entryMaak(s, { tekst, foto }) {
    const b = boek(s.g);
    const t = schoonTekst(tekst, 2000);
    if (!t && !foto) return fout(400, 'Schrijf een stukje of kies een foto.');
    if (b.entries.length >= MAX_ENTRIES) return fout(400, 'Het boekje is vol. Haal eerst een oud momentje weg.');
    let naam = null;
    if (foto) {
      naam = await media.bewaar(foto, 1.5 * 1024 * 1024);
      if (!naam) return fout(400, 'Die foto lukt niet: te groot, of geen jpg, png of webp.');
    }
    const e = {
      id: crypto.randomBytes(8).toString('hex'), dag: vandaag(), tekst: t, foto: naam,
      van: s.p.naam, avatar: s.p.avatar, vanId: s.p.id, at: Date.now()
    };
    b.entries.unshift(e);
    save();
    return { ok: true, entry: uiterlijk(e, s) };
  }

  function entryWeg(s, id) {
    const b = boek(s.g);
    const e = b.entries.find(x => x.id === id);
    if (!e) return fout(404, 'Dit momentje staat er niet meer.');
    if (e.vanId !== s.p.id && !s.beheerder) return fout(403, 'Alleen wie het schreef, of de beheerder, kan dit weghalen.');
    if (e.foto) media.verwijder(e.foto);
    b.entries = b.entries.filter(x => x.id !== id);
    save();
    return { ok: true };
  }

  /* De namen van de rest van het gezin (broertjes, zusjes, opa, oma, ook de
     hond mag): vrij in te vullen, zodat de momenten echt over dit gezin gaan. */
  function gezinZet(s, namen) {
    const b = boek(s.g);
    const lijst = (Array.isArray(namen) ? namen : []).map(n => schoonTekst(n, 30)).filter(Boolean).slice(0, MAX_NAMEN);
    b.gezin = [...new Set(lijst)];
    save();
    return { ok: true, gezin: b.gezin };
  }

  /* ---------- gezinsmomenten: de buddy bedenkt iets leuks voor iedereen ---------- */
  const DEMO_MOMENTEN = (kind, namen) => {
    const n = i => namen.length ? namen[i % namen.length] : 'papa of mama';
    return [
      { titel: 'Dekenfort-avond', hoe: 'Bouw met het hele gezin een fort van dekens en kussens. ' + kind + ' kruipt in het midden en ' + n(0) + ' leest met een zaklamp een verhaaltje voor.' },
      { titel: 'Keukenconcert', hoe: 'Pannen omgekeerd op de grond, houten lepels erbij: ' + kind + ' trommelt, ' + n(1) + ' zingt en de rest klapt mee. Twee liedjes is genoeg voor de slappe lach.' },
      { titel: 'Fotoshoot-wandeling', hoe: 'Maak een rondje door de buurt en laat iedereen, ook ' + n(2) + ', om de beurt een gek plaatje met ' + kind + ' bedenken. Het leukste plaatje gaat vanavond in het boekje.' },
      { titel: 'Pannenkoeken op zondagochtend', hoe: n(0) + ' bakt, ' + kind + ' mag (met hulp) strooien en iedereen kiest een gek beleg voor een ander. Aan tafel vertelt ieder zijn mooiste moment van de week.' },
      { titel: 'Badschuim-kunst', hoe: 'Een laagje scheerschuim of badschuim op de badrand: ' + kind + ' tekent er met een vingertje in, ' + n(1) + ' raadt wat het is.' },
      { titel: 'Voorleespicknick', hoe: 'Kleedje op de vloer, wat fruit erbij, en ' + n(2) + ' kiest het boekje. Wie voorleest doet de gekke stemmetjes; ' + kind + ' mag de bladzijden omslaan.' }
    ];
  };

  async function momentAi(s) {
    const b = boek(s.g);
    const kind = b.kindNaam || 'jullie kleintje';
    const namen = b.gezin || [];
    const leeftijd = leeftijdTekst(b.geboren);
    let items = null, demo = false;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-opus-4-8', max_tokens: 800,
          system: 'Je bedenkt warme, gratis gezinsmomenten voor thuis, voor een gezin met een heel jong kind. ' +
            'Veilig en zonder schermen. Antwoord uitsluitend met een JSON-array van precies 4 objecten {"titel","hoe"}, ' +
            'titel max 5 woorden, hoe max 40 woorden, in het Nederlands. Gebruik de namen die je krijgt.',
          messages: [{ role: 'user', content: 'Het kindje heet ' + kind + (leeftijd ? ' (' + leeftijd + ' oud)' : '') + '. ' +
            (namen.length ? 'De rest van het gezin: ' + namen.join(', ') + '.' : 'Verder weten we alleen dat papa of mama meedoet.') +
            ' Bedenk 4 leuke momenten voor het hele gezin samen.' }]
        });
        const tekst = (r.content || []).map(x => x.text || '').join('');
        const m = /\[[\s\S]*\]/.exec(tekst);
        const arr = m ? JSON.parse(m[0]) : null;
        if (Array.isArray(arr)) {
          items = arr.slice(0, 4).map(x => ({ titel: schoonTekst(x.titel, 60), hoe: schoonTekst(x.hoe, 300) }))
            .filter(x => x.titel && x.hoe);
        }
      } catch (e) { items = null; }
    }
    if (!items || !items.length) {
      // zonder sleutel (of bij een hapering): een demosetje dat met de dag meedraait
      const alle = DEMO_MOMENTEN(kind, namen);
      const start = Math.floor(Date.now() / 86400000) % alle.length;
      items = Array.from({ length: 4 }, (_, i) => alle[(start + i) % alle.length]);
      demo = true;
    }
    b.momenten = { at: Date.now(), demo, items };
    save();
    return { ok: true, demo, momenten: b.momenten };
  }

  return { baby: { boekVan, instellen, entryMaak, entryWeg, gezinZet, momentAi } };
};
