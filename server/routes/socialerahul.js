/* Rahul in RTG Sociaal: een gegronde stem over wat er tussen mensen speelt
   (LIFE.md par. 6, vierde laag van het wereldpatroon).

   Zelfde vorm als routes/geldrahul.js, en met opzet -- twee werelden die hun
   stem anders bouwen, zijn twee producten. Wat hier ANDERS is, staat hieronder,
   en het is geen detail.

   HIJ LEEST, EN MEER NIET. De geldkant mag binnen beleid uitvoeren omdat de
   grens daar het eigen tegoed is. Hier is de grens een ANDER MENS: een antwoord
   op een bijeenkomst wordt door een groep gezien, en bij een volle bijeenkomst
   kost een "ja" iemand anders zijn plaats. Klaarzetten gebeurt in Life Command
   (kern/socialecommand), bevestigen doet de mens, en deze route heeft geen
   enkele weg naar allebei. Er is hier dus geen `bevestig`, geen `stuur`, geen
   `nodig uit` -- ook niet achter een instelling.

   DE CONTEXT KOMT UIT DE GRAAF EN NERGENS ANDERS. Rahul krijgt het beeld dat het
   scherm ook krijgt: wat op het lid wacht, wat eraan komt, wat er klaarstaat.
   Zou hij zijn eigen bronnen aanboren, dan bestaan er twee antwoorden op dezelfde
   vraag en kan niemand aanwijzen welke klopt (LAT.md regel 4).

   EN HIJ NOEMT ZIJN BRONNEN. Elke keer, ook zonder AI-sleutel: `gegevens` reist
   mee met het antwoord, zodat een lid kan zien waarop het rust. Een stem die
   niet kan uitleggen waarop hij zich baseert is geen rechterhand maar een
   orakel (GELD.md par. 5, LEVEN.md par. 2.10).

   CODENAMEN BLIJVEN CODENAMEN. Wat hier de context in gaat komt uit lagen die
   zelf al op codenamen draaien; de kluis blijft erbuiten (CLAUDE.md, privacy by
   design). */
module.exports = (kern) => {
  const { app, auth, geenGast, anthropic, schoon } = kern;
  /* Zelfde weg als routes/geldrahul.js: laat gelezen, uit ../ai. */
  const { tekst } = require('../ai');

  /* De bronregels: waarop rust dit antwoord. Ze gaan mee met ELK antwoord, ook
     het vaste demo-antwoord zonder sleutel -- juist daar, want een vast antwoord
     dat zichzelf niet verantwoordt lijkt zekerder dan het is. */
  function bronregels(beeld, cmd) {
    const r = [];
    const t = (beeld && beeld.telling) || {};
    r.push('wacht op u: ' + (t.wachtOpMij || 0) + ' · ligt bij een ander: ' + (t.wachtOpAnder || 0));
    if (t.achterstallig) r.push('achterstallig: ' + t.achterstallig);
    for (const m of (beeld.momenten || []).slice(0, 6)) {
      r.push([m.bron, m.titel, m.wie, m.wanneer].filter(Boolean).join(' · '));
    }
    for (const v of ((cmd && cmd.voorstellen) || []).slice(0, 3)) {
      r.push('klaargezet: ' + v.wat + ' - ' + v.titel + ' (' + (v.wanneer || '') + ')');
    }
    if ((beeld.stil || []).length) {
      r.push('niet opgehaald: ' + beeld.stil.join(', ') + ' - dit beeld is onvolledig');
    }
    return r;
  }

  const contextVan = (beeld, cmd) => bronregels(beeld, cmd).join(' | ');

  /* Het vaste antwoord zonder AI-sleutel. Het VERZINT NIETS: het vat samen wat
     er in het beeld staat, en zegt het eerlijk als er niets speelt. Rust is een
     uitkomst en geen leegte die opgevuld moet worden. */
  function zonderSleutel(beeld, cmd) {
    const t = (beeld && beeld.telling) || {};
    const v = (cmd && cmd.voorstellen) || [];
    const delen = [];
    if (t.wachtOpMij) delen.push(t.wachtOpMij + (t.wachtOpMij === 1 ? ' ding wacht' : ' dingen wachten') + ' op u');
    if (v.length) delen.push(v.length + (v.length === 1 ? ' voorstel staat' : ' voorstellen staan') + ' klaar');
    if (t.achterstallig) delen.push(t.achterstallig + ' termijn' + (t.achterstallig === 1 ? '' : 'en') + ' achterstallig');
    const kop = delen.length ? delen.join(', ') + '.' : 'Er wacht niemand op u en er staat niets klaar.';
    return kop + ((beeld.stil || []).length
      ? ' Let op: ' + beeld.stil.join(', ') + ' kon ik niet ophalen, dus dit beeld is onvolledig.'
      : '');
  }

  app.post('/api/sociaal/rahul', auth, async (req, res) => {
    /* Dezelfde poort als de andere sociale routes: deze laag leest de
       vriendenlaag, matches en groepen, en dat is geen beeld voor een sessie
       zonder pas. */
    if (geenGast(req, res)) return;
    try {
      const key = req.session.key;
      const vraag = schoon((req.body || {}).vraag, 400);
      const beeld = kern.socialegraaf.beeld(key);
      /* Wat er klaarstaat hoort in de context, want daar gaat de helft van de
         vragen over. Valt die laag om, dan rekent Rahul zichtbaar zonder. */
      let cmd = null;
      try { cmd = kern.socialecommand.command(key); }
      catch (e) { if (!beeld.stil.includes('klaargezet')) beeld.stil.push('klaargezet'); }
      const gegevens = bronregels(beeld, cmd);

      if (anthropic && vraag) {
        const uit = await tekst(anthropic,
          require('../kern/rahul').rahulLeadVoor(key) +
          'u bent de sociale rechterhand binnen RTG Sociaal. U vat samen wat er tussen dit lid en de mensen om ' +
          'hem heen speelt, kort en concreet, in de u-vorm. HARDE GRENZEN, en ze wegen zwaarder dan het antwoord: ' +
          'u VOERT NIETS UIT en zet niets klaar -- dat gebeurt in Life Command en wordt door het lid zelf ' +
          'bevestigd; u stuurt geen berichten en nodigt niemand uit. U zegt nooit dat een boeking of reservering ' +
          'verwerkt is. U belooft of verleent nooit toegang tot de Lifestyle of Business Pass. U doet GEEN ' +
          'uitspraak over hoe een relatie ervoor staat, u geeft er geen cijfer aan en u spoort nooit aan om ' +
          'weer eens iets van u te laten horen. U noemt alleen wat in de context staat en verzint niets erbij. ' +
          'Context (prive, op codenamen): ' + contextVan(beeld, cmd), vraag, { max: 300 });
        if (uit) return res.json({ ok: true, antwoord: uit, gegevens });
      }
      res.json({ ok: true, antwoord: zonderSleutel(beeld, cmd), gegevens });
    } catch (e) {
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
