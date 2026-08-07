/* Foundation OS, deel "rapport": impact per stad en het landelijke beeld.

   MEET RESULTAAT, NIET DRUKTE. Vijfhonderd maaltijden is een activiteit; hoeveel
   mensen daarmee geholpen zijn, hoe vaak dezelfde persoon terugkwam en hoeveel
   het per geholpen persoon kostte, is een resultaat. Dit bestand rekent alleen
   met wat er echt is ingevoerd -- er wordt niets geschat en niets gladgestreken.

   NUL IS EEN UITKOMST, GEEN LEEG SCHERM. Een stad zonder ingevulde indicatoren
   krijgt hier geen nette nullen maar het veld `gemeten: false` erbij. Dat is
   LAT.md regel 3 op een dashboard: een meter zonder invoer hoort te zeggen dat
   hij niets weet, niet "0 van 0 (100%)" tonen. Een subsidiegever die 100%
   leest waar niemand iets heeft ingevuld, is verkeerd voorgelicht door ons.

   KOSTEN PER GEHOLPEN PERSOON. Het enige eerlijke doelmatigheidsgetal dat een
   foundation heeft, en tegelijk het makkelijkst te misbruiken. Hij staat er
   alleen als er zowel besteed geld als geholpen mensen zijn; anders is het een
   deling door nul die als "0 euro per persoon" op tafel komt.

   WAT HIER NOOIT IN KOMT: namen, contactgegevens en de inhoud van hulpvragen.
   Casussen tellen mee als aantal per soort, verder niet. Zie casus.js voor het
   waarom. */

module.exports = (ctx) => {
  const { euro, S, wie, poort, bereik, stadVan } = ctx;

  const som = (rijen, f) => rijen.reduce((s, x) => s + (Number(f(x)) || 0), 0);

  /* De cijfers van een stad, uit de bron. Bewust een pure functie zonder req:
     het stadsdashboard, het landelijke beeld en het gemeenteportaal rekenen
     hierdoor met exact dezelfde getallen. Twee keer hetzelfde optellen op twee
     plekken is hoe rapportages uit elkaar gaan lopen (LAT.md regel 4). */
  function cijfersVan(stadId) {
    const s = S();
    const projecten = s.projecten.filter(p => p.stad === stadId);
    const actief = projecten.filter(p => p.status === 'actief');
    const vrijw = s.vrijwilligers.filter(v => v.stad === stadId);
    const actieveVrijw = vrijw.filter(v => v.status === 'actief');
    const urenTotaal = som(vrijw, v => (v.uren || []).reduce((a, u) => a + u.uren, 0));
    const bronnen = s.bronnen.filter(b => b.stad === stadId);
    const besteedCenten = som(bronnen, b => b.besteed);
    const casussen = s.casussen.filter(c => c.stad === stadId);
    const indicatoren = projecten.flatMap(p => p.indicatoren || []);
    const uniek = som(projecten, p => p.deelnemersUniek);
    const herhaald = som(projecten, p => p.deelnemersHerhaald);

    const perSoort = {};
    for (const c of casussen) perSoort[c.soort] = (perSoort[c.soort] || 0) + 1;
    const perWijk = {};
    for (const c of casussen) if (c.wijk) perWijk[c.wijk] = (perWijk[c.wijk] || 0) + 1;

    return {
      projecten: { totaal: projecten.length, actief: actief.length,
        afgerond: projecten.filter(p => p.status === 'afgerond').length,
        wachtOpBesluit: projecten.filter(p => p.status === 'beoordeling').length },
      mensen: {
        gemeten: uniek > 0,
        uniekGeholpen: uniek, herhaaldGeholpen: herhaald,
        vrijwilligers: actieveVrijw.length, vrijwilligersTotaal: vrijw.length,
        vrijwilligersuren: Math.round(urenTotaal * 10) / 10,
        vogGeldig: actieveVrijw.filter(v => v.vogGeldigTot && Date.parse(v.vogGeldigTot) > Date.now()).length
      },
      doelen: {
        gemeten: indicatoren.length > 0,
        aantal: indicatoren.length,
        doel: som(indicatoren, i => i.doel), bereikt: som(indicatoren, i => i.bereikt),
        doorgestroomd: som(indicatoren, i => i.doorgestroomd), uitgevallen: som(indicatoren, i => i.uitgevallen),
        inTraject: som(indicatoren, i => i.actief)
      },
      geld: {
        binnen: euro(som(bronnen, b => b.centen)), besteed: euro(besteedCenten),
        geoormerkt: euro(som(bronnen.filter(b => b.projectId), b => b.centen)),
        openAanvragen: s.uitgaven.filter(u => u.stad === stadId && u.status === 'aangevraagd').length,
        // Alleen als beide kanten er zijn; anders is het een deling zonder betekenis.
        kostenPerPersoon: (besteedCenten > 0 && uniek > 0) ? Math.round(besteedCenten / uniek) / 100 : null
      },
      hulpvragen: {
        totaal: casussen.length,
        open: casussen.filter(c => !['afgerond', 'nazorg', 'afgewezen'].includes(c.status)).length,
        afgerond: casussen.filter(c => c.status === 'afgerond' || c.status === 'nazorg').length,
        perSoort, perWijk
      },
      meldingen: {
        open: s.incidenten.filter(i => i.stad === stadId && i.status !== 'afgehandeld').length,
        kritiek: s.incidenten.filter(i => i.stad === stadId && i.zwaarte === 'kritiek').length
      },
      partners: {
        totaal: s.partners.filter(p => p.stad === stadId).length,
        actief: s.partners.filter(p => p.stad === stadId && p.status === 'actief').length
      }
    };
  }

  function stadRapport(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'rapport.lezen');
    if (!g.ok) return g;
    return { ok: true, stad: { id: g.stad.id, naam: g.stad.naam, status: g.stad.status },
      cijfers: cijfersVan(g.stad.id) };
  }

  /* Het landelijke beeld: de steden naast elkaar. Benchmarken tussen steden is
     nuttig en gevaarlijk tegelijk -- een kleine stad met dure, intensieve
     trajecten "verliest" van een grote met eenmalige uitgifte. De cijfers staan
     daarom naast elkaar en er wordt hier NIET gerangschikt op doelmatigheid;
     dat oordeel is mensenwerk met kennis van de steden erbij. */
  function landelijk(req) {
    const w = wie(req);
    const mag = bereik(w);
    if (!mag.length) return { status: 403, error: 'U heeft geen stadsafdeling om over te rapporteren.' };
    const steden = mag.map(id => {
      const s = stadVan(id);
      return { id, naam: s ? s.naam : id, status: s ? s.status : '?', cijfers: cijfersVan(id) };
    });
    const totaal = {
      steden: steden.length,
      projectenActief: som(steden, s => s.cijfers.projecten.actief),
      uniekGeholpen: som(steden, s => s.cijfers.mensen.uniekGeholpen),
      vrijwilligers: som(steden, s => s.cijfers.mensen.vrijwilligers),
      vrijwilligersuren: Math.round(som(steden, s => s.cijfers.mensen.vrijwilligersuren) * 10) / 10,
      binnen: Math.round(som(steden, s => s.cijfers.geld.binnen) * 100) / 100,
      besteed: Math.round(som(steden, s => s.cijfers.geld.besteed) * 100) / 100,
      openMeldingen: som(steden, s => s.cijfers.meldingen.open),
      kritiekeMeldingen: som(steden, s => s.cijfers.meldingen.kritiek)
    };
    // De steden die niets meten vallen apart op: dat is geen nul, dat is een gat.
    totaal.stedenZonderIndicatoren = steden.filter(s => !s.cijfers.doelen.gemeten).length;
    return { ok: true, landelijk: !!w.landelijk, totaal, steden };
  }

  return { cijfersVan, stadRapport, landelijk };
};
