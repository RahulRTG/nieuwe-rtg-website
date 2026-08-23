/* Horeca OS (deellaag): het keukenscherm (KDS) -- de bonnen zonder papier,
   verdeeld over stations, met tijden die kloppen.

   Het scherm werkt op de regels van de rekeningen (horeca/rekening.js): een
   regel draagt zijn station, zijn gang, zijn allergie en zijn vrijgavetijd.
   Er komt hier dus GEEN tweede bestellijst naast; de keuken kijkt naar
   dezelfde waarheid als de zaal (LAT-regel 4).

   Vier dingen die dit een keukenscherm maken in plaats van een lijst:

   1. DE ALLERGIE STAAT BOVENAAN EN VERDWIJNT NOOIT. Hij zit in een eigen veld,
      wordt niet afgekapt en gaat mee in elke weergave -- ook op het
      regiescherm. Een allergie die tussen de opmerkingen verdwijnt, is de
      duurste bug die een horecasysteem kan hebben.
   2. TIJD IS EEN FEIT, GEEN KLEURTJE. Elke regel draagt hoe lang hij al loopt
      (vanaf de vrijgave door de zaal, niet vanaf het aanslaan) en of hij over
      zijn eigen bereidingstijd heen is. De kleur volgt uit dat getal; het
      getal staat er altijd bij, zodat niemand hoeft te raden wat oranje betekent.
   3. EEN GANG GAAT TEGELIJK DE DEUR UIT. Het regiescherm
      (horeca/keuken-regie.js) zegt per tafel en gang of alles klaar is en welk
      station de laatste is. Zonder dat staat de helft van tafel 24 koud te
      worden terwijl de grill nog bezig is.
   4. DE STANDEN LOPEN EEN KANT OP: besteld -> gestart -> bereid -> klaar ->
      uitgegeven. Terugzetten kan, maar alleen met een reden, en dat blijft
      staan op de regel. Anders is "klaar" een knop die niets betekent. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, sseToSupplier, horeca } = kern;
  const { REGELSTANDEN, H, nu } = horeca;

  /* Hoe lang een gerecht normaal duurt staat in kern/horeca/keukenlaag.js en
     niet hier: de polslaag toont dezelfde wachttijd aan een gast, en die kan
     niet bij een functie die in een leveranciersroute wordt gemaakt. */
  const { bereidingsMinuten } = require('../../../kern/horeca/keukenlaag');
  /* De cadans rekent TERUG vanaf het serveermoment; het bord hieronder rekent
     vooruit vanaf de vrijgave. Allebei nodig, en allebei op dezelfde regels:
     `loopt`/`norm` zeggen wat er al mis is, `startOm`/`baan` zeggen wat er nu
     moet gebeuren. Zie kern/horeca/cadans.js en HORECA.md. */
  const cadanslaag = require('../../../kern/horeca/cadans');
  /* De stoel hoort op de bon. Een gang komt samen de deur uit (punt 3
     hieronder), maar bij de tafel moet elk bord bij de juiste persoon staan --
     en dan is "gastNr 3" een nummer waar een runner niets aan heeft. De naam
     erbij komt uit kern/horeca/gezelschap.js, want daar staat wie er zit. */
  const gezelschap = require('../../../kern/horeca/gezelschap')({ horeca, schoon });
  const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0;

  /* Een regel zoals de keuken hem ziet. `loopt` telt vanaf de vrijgave door de
     zaal; is die er niet, dan telt hij niet mee op het scherm -- de keuken
     hoort niet te beginnen aan een gang die nog niet vrij is. */
  function bord(h, rek, regel) {
    const minuten = minutenSinds(regel.startAt || regel.vrijAt);
    const norm = bereidingsMinuten(h, regel);
    return {
      rekeningId: rek.id, regelId: regel.id, tafel: rek.tafel, kanaal: rek.kanaal,
      gast: rek.naam, gasten: rek.gasten, kamer: rek.kamer || null,
      naam: regel.naam, aantal: regel.aantal, gang: regel.gang, station: regel.station || 'warm',
      allergie: regel.allergie || null, notitie: regel.notitie || null,
      gastNr: regel.gastNr, stoel: gezelschap.handleVan(rek, regel.gastNr),
      stand: regel.stand, besteldAt: regel.at, vrijAt: regel.vrijAt || null, serveerOm: regel.serveerOm || null,
      loopt: minuten, norm, over: Math.max(0, minuten - norm),
      urgentie: minuten > norm + 5 ? 'te laat' : minuten > norm ? 'let op' : 'op tijd'
    };
  }

  kern.horecaBord = bord;

  /* ---------- het scherm van een station ---------- */
  app.post('/api/supplier/horeca/keuken/bord', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const station = schoon(req.body.station, 30);
    const rijen = [];
    for (const rek of Object.values(h.rekeningen)) {
      if (rek.status !== 'open' && rek.status !== 'betaald') continue;
      for (const regel of (rek.regels || [])) {
        if (!regel.vrijAt) continue;               // nog niet vrijgegeven door de zaal
        if (regel.stand === 'uitgegeven') continue; // van het bord af
        /* Wacht deze gastbestelling nog op een mens (allergie, plafond), dan
           hoort de keuken er niet aan te beginnen. De belofte "een ernstige
           allergie gaat eerst langs een medewerker" is anders alleen een
           melding op een scherm en geen grendel. */
        if (regel.bevestiging === 'wacht') continue;
        if (station && String(regel.station || 'warm') !== station) continue;
        rijen.push(bord(h, rek, regel));
      }
    }
    /* Volgorde: de gewenste serveertijd eerst (die is een afspraak met de gast),
       daarna wie het langst loopt. Bewust NIET op wie het duurst is. */
    /* De cadans erbij, per regel. Additief: geen bestaand veld verandert, dus
       een scherm dat hem nog niet kent, blijft precies werken zoals het deed. */
    const cadans = new Map(cadanslaag.cadansVanZaak(h).map(r => [r.regelId, r]));
    for (const r of rijen) {
      const c = cadans.get(r.regelId);
      if (!c) continue;
      r.baan = c.baan; r.startOm = c.startOm; r.startOver = c.startOver;
      r.doelOm = c.doelOm; r.doelOver = c.doelOver; r.passOm = c.passOm;
      r.gangCompleet = c.gangCompleet; r.samenMet = c.samenMet; r.cadans = c.rekensom;
    }
    /* Volgorde: wat het eerst AAN moet, staat bovenaan. Waar geen cadans is
       (een regel zonder vrijgave haalt het bord niet, maar wees voorzichtig),
       valt hij terug op de oude volgorde: afgesproken serveertijd, dan wie het
       langst loopt. Bewust NIET op wie het duurst is. */
    rijen.sort((a, b) =>
      (a.startOm && b.startOm ? Date.parse(a.startOm) - Date.parse(b.startOm) : 0) ||
      String(a.serveerOm || '~').localeCompare(String(b.serveerOm || '~')) || b.loopt - a.loopt);
    const stations = {};
    for (const r of rijen) stations[r.station] = (stations[r.station] || 0) + 1;
    res.json({ ok: true, station: station || 'alle', aantal: rijen.length, bonnen: rijen.slice(0, 200),
      perStation: stations, teLaat: rijen.filter(r => r.urgentie === 'te laat').length,
      banen: cadanslaag.banen(rijen), standen: REGELSTANDEN });
  });

  /* ---------- een regel doorzetten ---------- */
  app.post('/api/supplier/horeca/keuken/stand', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const rek = h.rekeningen[String(req.body.rekeningId || '')];
    const regel = rek && (rek.regels || []).find(x => x.id === String(req.body.regelId || ''));
    if (!regel) return res.status(404).json({ error: 'Die bon staat niet meer op het bord.' });
    const naar = String(req.body.stand || '');
    if (!REGELSTANDEN.includes(naar)) return res.status(400).json({ error: 'Onbekende stand. Kies uit: ' + REGELSTANDEN.join(', ') + '.' });
    const van = regel.stand;
    const vooruit = REGELSTANDEN.indexOf(naar) > REGELSTANDEN.indexOf(van);
    if (!vooruit && !schoon(req.body.reden, 120))
      return res.status(400).json({ error: 'Terugzetten van "' + van + '" naar "' + naar + '" kan, maar noteer waarom; dat blijft op de bon staan.' });
    regel.stand = naar;
    if (naar === 'gestart' && !regel.startAt) regel.startAt = nu();
    if (naar === 'klaar') regel.klaarAt = nu();
    if (naar === 'uitgegeven') regel.uitAt = nu();
    if (!vooruit) regel.correcties = (regel.correcties || []).concat([{ van, naar, reden: schoon(req.body.reden, 120), at: nu(), door: req.actor.name }]).slice(-10);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    res.json({ ok: true, regel: bord(h, rek, regel) });
  });
};
