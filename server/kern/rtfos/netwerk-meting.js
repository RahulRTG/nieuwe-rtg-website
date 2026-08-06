/* Foundation OS, deel "netwerk-meting": steden naast elkaar, met hun noemer.

   BENCHMARKEN IS NUTTIG EN GEVAARLIJK, EN HET VERSCHIL ZIT IN DE NOEMER. "Stad
   A helpt 400 mensen, stad B helpt 90" zegt niets zolang je niet weet dat A
   voedselpakketten uitdeelt en B schuldhulptrajecten van negen maanden draait.
   Daarom staat bij elk getal hier WAAR HET DOOR GEDEELD IS, en wordt er niet
   gerangschikt op doelmatigheid.

   WAT DEZE MODULE MET OPZET NIET DOET:

   - geen sortering op kosten per geholpen persoon. Dat cijfer bestaat wel (het
     staat in rapport.js) en het is bruikbaar in een gesprek, niet in een
     ranglijst. Een lijstje maakt van "duur" vanzelf "slecht", en de stad met
     het moeilijkste werk staat dan onderaan;
   - geen totaaloordeel, geen score, geen sterren. Alles wat op een cijfer lijkt
     dat steden vergelijkt, wordt binnen een kwartaal een doel op zich, en dan
     stuurt de meting het werk in plaats van andersom;
   - geen extrapolatie. Een stad die dit kwartaal drie weken bezig was, krijgt
     geen omgerekend jaarcijfer.

   WEL: de spreiding, en wie eruit springt. Dat is de vraag die het landelijke
   bestuur werkelijk heeft -- niet "wie is de beste" maar "waar wijkt iets zo af
   dat ik moet gaan kijken". Een uitschieter is hier een SIGNAAL en geen
   oordeel, en dat staat er ook bij.

   NIET GEMETEN IS GEEN NUL. Steden zonder ingevulde indicatoren tellen niet mee
   in het gemiddelde en staan apart genoemd; anders drukt een stad die niets
   invult het beeld omlaag en lijkt het alsof daar niets gebeurt. */

module.exports = (ctx) => {
  const { S, wie, bereik, stadVan, euro } = ctx;

  const mediaan = arr => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
  };

  function benchmark(req) {
    const w = wie(req);
    const mag = bereik(w);
    if (!mag.length) return { status: 403, error: 'U heeft geen stadsafdeling om te vergelijken.' };
    if (!w.landelijk) {
      /* Een stad mag zichzelf naast het GEMIDDELDE leggen, niet naast de
         andere steden bij naam. Wie zijn buurstad wil beoordelen, kan dat via
         het landelijke bestuur -- dat kent de context erbij. */
      return eigenSpiegel(mag[0]);
    }
    const rijen = S().steden.map(s => cijfers(s.id));
    const gemeten = rijen.filter(r => r.gemeten);
    const perProject = gemeten.map(r => r.geholpenPerProject).filter(n => n !== null);
    const perVrijwilliger = gemeten.map(r => r.urenPerVrijwilliger).filter(n => n !== null);
    return { ok: true, landelijk: true,
      steden: rijen,
      zonderMeting: rijen.filter(r => !r.gemeten).map(r => r.naam),
      spreiding: {
        stedenGemeten: gemeten.length,
        geholpenPerProject: { mediaan: mediaan(perProject), laagste: min(perProject), hoogste: max(perProject) },
        urenPerVrijwilliger: { mediaan: mediaan(perVrijwilliger), laagste: min(perVrijwilliger), hoogste: max(perVrijwilliger) }
      },
      signalen: signalen(gemeten, mediaan(perProject)),
      uitleg: 'Deze cijfers staan naast elkaar en niet op volgorde. Een stad met dure, ' +
        'intensieve trajecten hoort niet onderaan een lijstje te belanden omdat een stad ' +
        'met eenmalige uitgifte meer mensen bereikt.' };
  }
  const min = a => a.length ? Math.min(...a) : null;
  const max = a => a.length ? Math.max(...a) : null;

  function cijfers(stadId) {
    const s = S();
    const stad = stadVan(stadId) || {};
    const projecten = s.projecten.filter(p => p.stad === stadId);
    const actief = projecten.filter(p => p.status === 'actief');
    const vrijw = s.vrijwilligers.filter(v => v.stad === stadId && v.status === 'actief');
    const uren = s.vrijwilligers.filter(v => v.stad === stadId)
      .reduce((a, v) => a + (v.uren || []).reduce((x, u) => x + u.uren, 0), 0);
    const geholpen = projecten.reduce((a, p) => a + (Number(p.deelnemersUniek) || 0), 0);
    const besteed = s.bronnen.filter(b => b.stad === stadId).reduce((a, b) => a + b.besteed, 0);
    return {
      id: stadId, naam: stad.naam || stadId, status: stad.status || '?',
      gemeten: geholpen > 0,
      projectenActief: actief.length, vrijwilligers: vrijw.length,
      geholpen, uren: Math.round(uren * 10) / 10, besteed: euro(besteed),
      // elk kental met zijn noemer in de naam: zo is niet uit te leggen als
      // "de score van deze stad"
      geholpenPerProject: actief.length ? Math.round((geholpen / actief.length) * 10) / 10 : null,
      urenPerVrijwilliger: vrijw.length ? Math.round((uren / vrijw.length) * 10) / 10 : null,
      geholpenPerVrijwilliger: vrijw.length ? Math.round((geholpen / vrijw.length) * 10) / 10 : null
    };
  }

  /* De signalen: waar wijkt iets zo af dat er iemand moet gaan kijken. Bewust
     als vraag geformuleerd en niet als oordeel -- de meting weet niet waarom
     een stad afwijkt, en meestal is daar een reden voor die niet in de cijfers
     staat. */
  function signalen(gemeten, mediaanPerProject) {
    const uit = [];
    if (mediaanPerProject) {
      for (const r of gemeten) {
        if (r.geholpenPerProject === null) continue;
        if (r.geholpenPerProject > mediaanPerProject * 3) {
          uit.push({ stad: r.naam, wat: 'bereikt per project ligt ruim boven de mediaan',
            vraag: 'gaat het hier om eenmalige uitgifte, of is hier iets te leren voor de rest?' });
        }
        if (r.geholpenPerProject * 3 < mediaanPerProject) {
          uit.push({ stad: r.naam, wat: 'bereikt per project ligt ruim onder de mediaan',
            vraag: 'zijn dit langere trajecten, of loopt hier iets vast?' });
        }
      }
    }
    for (const r of gemeten) {
      if (r.vrijwilligers === 0 && r.projectenActief > 0) {
        uit.push({ stad: r.naam, wat: 'actieve projecten zonder actieve vrijwilligers',
          vraag: 'draait dit op de partner, of staat het register achter?' });
      }
    }
    return uit;
  }

  // Wat een stad van zichzelf mag zien: de eigen cijfers, en de mediaan om zich
  // aan te spiegelen. Geen namen van andere steden.
  function eigenSpiegel(stadId) {
    const rijen = S().steden.map(s => cijfers(s.id)).filter(r => r.gemeten);
    const perProject = rijen.map(r => r.geholpenPerProject).filter(n => n !== null);
    return { ok: true, landelijk: false, eigen: cijfers(stadId),
      mediaan: { geholpenPerProject: mediaan(perProject), stedenGemeten: rijen.length },
      uitleg: 'U ziet uw eigen cijfers naast de landelijke mediaan. De cijfers van andere ' +
        'afdelingen staan er niet bij: zonder de context van die stad zegt dat getal niets, ' +
        'en met de context is het een gesprek en geen lijstje.' };
  }

  return { benchmark, cijfers };
};
