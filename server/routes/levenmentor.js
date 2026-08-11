/* De mentor van het Life OS (LEVEN.md par. 1.4).

   Hij redeneert UITSLUITEND over het beeld dat kern/levenslijn al heeft
   samengesteld: de lijn, wat er speelt en wat eraan komt. Een eigen
   waarneming naast de lijn zou een tweede waarheid zijn (LAT.md regel 4), en
   bij een levensplatform is die tweede waarheid gevaarlijker dan bij geld --
   hij gaat over een mens.

   DE GRENZEN STAAN HIER TWEE KEER, en dat is met opzet: in de systeemcontext
   omdat het model ze moet dragen, en in dit commentaar omdat de volgende
   bouwer ze moet kennen voor hij iets bijbouwt.

     OPENEN, NOOIT STUREN (par. 2.2). De mentor mag de verzameling
     mogelijkheden vergroten en nooit verkleinen. Er bestaat geen "dit is
     niets voor jou", geen afrading, geen rangorde tussen mensen. Ook het
     WEGLATEN van een mogelijkheid is sturen.

     GEEN OORDEEL OVER EEN MENS (par. 2.7). Geen slaagkans, geen inschatting
     van talent, geen vergelijking met anderen. Gevolgen tonen mag; een mens
     wegen niet.

     NIETS BELOVEN. Geen toegang tot een pas, een opleiding, een baan of een
     voorziening, en nooit de bevestiging dat iets geregeld is -- dat is de
     huisregel die overal geldt en hier extra weegt, omdat het over iemands
     toekomst gaat.

     TEGEN EEN KIND ALS TEGEN EEN KIND. Geen loopbaanadvies, geen
     prestatiedruk, geen vooruitblik die als verwachting gaat voelen.

     EERLIJK ZIJN OVER WAT HIJ NIET WEET. Draagt de lijn het antwoord niet,
     dan zegt hij dat -- en verzint hij het niet. */
module.exports = (kern) => {
  const { app, auth, schoon, anthropic } = kern;
  const { tekst } = require('../ai');

  const GRENZEN =
    'U OPENT en u stuurt nooit. U mag mogelijkheden toevoegen, nooit afraden, ' +
    'nooit zeggen dat iets niets voor iemand is, en nooit mensen met elkaar ' +
    'vergelijken of rangschikken. U spreekt geen slaagkans en geen oordeel over ' +
    'een mens uit. U belooft nooit toegang tot een pas, opleiding, baan of ' +
    'voorziening en bevestigt nooit dat iets geregeld is. Tegen een kind praat u ' +
    'als tegen een kind: geen loopbaanadvies en geen prestatiedruk. Draagt de ' +
    'levenslijn hieronder het antwoord niet, dan zegt u dat u het niet weet. ' +
    'U noemt bij elk antwoord waarop u zich baseert.';

  /* Het controlespoor achter elk antwoord: bron plus feit, precies zoals de
     cockpit ze toont. Dit is waar het antwoord op rust (LEVEN.md par. 2.10),
     ook als de AI het schreef. */
  function bronregels(beeld) {
    const g = [];
    const fase = (beeld.lijn.fasen || []).find(f => f.id === (beeld.lijn.nu && beeld.lijn.nu.faseId));
    g.push('levenslijn: ' + (fase ? 'nu ' + fase.naam : 'geen fase met een aanwijzing'));
    g.push('levenslijn: ' + beeld.telling.speelt + ' spelend, ' +
      beeld.telling.komt + ' komend, ' + beeld.telling.achterstallig + ' achterstallig');
    for (const u of beeld.uitzonderingen.slice(0, 3)) g.push(u.gegevens[0]);
    if (beeld.stil.length) g.push('stil: geen gegevens uit ' + beeld.stil.join(', '));
    return g;
  }

  /* De sleutelloze terugval SPIEGELT en adviseert niet. Hij zegt wat er in de
     lijn staat, in gewone taal, en verder niets. Dat is geen armoede maar de
     enige vorm die par. 2.2 zonder model kan waarmaken: wie zonder AI toch
     adviezen zou verzinnen, verzint ze uit een tabel, en een tabel die zegt
     wat iemand moet doen is precies de norm die hier niet hoort. */
  function spiegel(beeld) {
    const fase = (beeld.lijn.fasen || []).find(f => f.id === (beeld.lijn.nu && beeld.lijn.nu.faseId));
    const d = [];
    d.push(fase ? 'Op uw lijn staat nu: ' + fase.naam + '.'
      : 'Uw lijn heeft op dit moment geen fase met een aanwijzing eronder. Dat zegt niets over u; het betekent dat de bronnen er nog niets over weten.');
    if (beeld.telling.achterstallig)
      d.push('Er ' + (beeld.telling.achterstallig === 1 ? 'staat 1 datum' : 'staan ' + beeld.telling.achterstallig + ' datums') +
        ' die voorbij is. Er gebeurt niets vanzelf; u beslist wat ermee moet.');
    if (beeld.telling.komt)
      d.push('Er ' + (beeld.telling.komt === 1 ? 'komt 1 ding' : 'komen ' + beeld.telling.komt + ' dingen') + ' aan.');
    if (!beeld.telling.achterstallig && !beeld.telling.komt)
      d.push('Er vraagt vandaag niets om aandacht.');
    if (beeld.stil.length)
      d.push('Let op: ' + beeld.stil.join(' en ') + ' gaf geen gegevens, dus dit beeld is onvolledig.');
    return d.join(' ');
  }

  app.post('/api/leven/mentor', auth, async (req, res) => {
    if (req.session.tier === 'guest')
      return res.status(403).json({ error: 'Dit levensbeeld is voor leden.' });
    try {
      const key = req.session.key;
      const vraag = schoon((req.body || {}).vraag, 400);
      const beeld = kern.levenslijn.cockpit(key);
      const gegevens = bronregels(beeld);

      if (anthropic && vraag) {
        const uit = await tekst(anthropic,
          require('../kern/rahul').rahulLeadVoor(key) +
          'u bent de mentor binnen RTFoundation. ' + GRENZEN + '\n\nDe levenslijn:\n' +
          gegevens.join('\n'),
          vraag);
        return res.json({ ok: true, antwoord: uit || spiegel(beeld), gegevens });
      }
      res.json({ ok: true, antwoord: spiegel(beeld), gegevens });
    } catch (e) {
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
