/* Foundation OS, deel "netwerk": projecten delen tussen steden, en eerlijk
   vergelijken.

   HET NETWERKEFFECT IS DE ENIGE REDEN OM FEDERATIEF TE ZIJN. Anders is RTF
   twintig losse stichtingen met hetzelfde logo. Wat een stad in twee jaar heeft
   uitgevonden -- een huiswerkklas die wel werkt, een maaltijdroute die niet
   omvalt -- hoort de volgende stad in een middag over te kunnen nemen.

   EEN BLAUWDRUK IS GEEN KOPIE VAN EEN PROJECT. Hij bevat de AANPAK en wat er
   geleerd is, plus de indicatoren waarop het gemeten werd. Geen deelnemers,
   geen vrijwilligers, geen bedragen van die ene stad: dat zijn feiten van daar
   en ze reizen niet mee. Wie een blauwdruk overneemt, begint bij "idee" en
   loopt zijn eigen keten -- inclusief goedkeuring in de eigen stad. Anders
   sluipt een project een stad binnen zonder dat het bestuur eraan te pas kwam.

   ALLEEN DELEN WAT ECHT HEEFT GEDRAAID. Een blauwdruk kan alleen uit een
   project dat actief of afgerond is EN ten minste een ingevulde indicator
   heeft. Zonder die eis wordt het een ideeenbus, en dan is de eerste stad die
   er iets uit haalt de laatste.

   BENCHMARKEN MAG, RANGSCHIKKEN OP DOELMATIGHEID NIET. Een kleine stad met
   dure, intensieve trajecten "verliest" van een grote met eenmalige uitgifte,
   terwijl ze misschien het moeilijkste werk doet. De cijfers staan hier naast
   elkaar met hun noemer erbij (per project, per vrijwilliger, per euro), en er
   wordt met opzet niet gesorteerd op kosten per persoon. Wie dat oordeel velt,
   moet de steden kennen; een lijstje doet dat niet. */

module.exports = (ctx) => {
  const { nu, rid, schoon, euro, S, audit, wie, poort, bereik, stadVan, save } = ctx;

  const B = () => S().blauwdrukken;
  const vind = id => B().find(b => b.id === String(id || '')) || null;
  const beeld = b => ({ id: b.id, naam: b.naam, soort: b.soort, vlag: b.vlag, doelgroep: b.doelgroep,
    aanpak: b.aanpak, geleerd: b.geleerd, doorlooptijd: b.doorlooptijd,
    budgetIndicatie: euro(b.budgetCenten), indicatoren: b.indicatoren || [],
    vanStad: (stadVan(b.vanStad) || {}).naam || null, overgenomen: (b.overgenomen || []).length, at: b.at });

  /* Delen. De blauwdruk wordt hier SAMENGESTELD uit het project en niet door de
     invuller overgetypt: zo kan hij niet mooier zijn dan wat er werkelijk stond
     (LAT.md regel 4 -- twee plekken, een waarheid). Alleen de aanpak en de
     geleerde lessen zijn vrije tekst, want die staan nergens anders. */
  function deel(req, projectId, b) {
    b = b || {};
    const p = S().projecten.find(x => x.id === String(projectId || ''));
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'project.beheren', p.vlag);
    if (!g.ok) return g;
    if (!['actief', 'afgerond'].includes(p.status)) {
      return { status: 400, error: 'Een blauwdruk komt uit een project dat draait of gedraaid heeft; dit staat op "' + p.status + '".' };
    }
    const gemeten = (p.indicatoren || []).filter(i => i.bereikt > 0);
    if (!gemeten.length) {
      return { status: 400, error: 'Er is nog geen indicator met een resultaat ingevuld. Zonder cijfers is dit een idee en geen blauwdruk.' };
    }
    const aanpak = schoon(b.aanpak, 1500);
    if (aanpak.length < 20) {
      return { status: 400, error: 'Beschrijf de aanpak: wat doet een andere stad maandag als eerste? Daar zit de waarde, niet in de titel.' };
    }
    const geleerd = schoon(b.geleerd, 1000);
    if (geleerd.length < 10) {
      return { status: 400, error: 'Wat ging er mis of anders dan verwacht? Een blauwdruk zonder dat stuk laat de volgende stad dezelfde fout maken.' };
    }
    if (B().length >= 20000) return { status: 400, error: 'Het blauwdrukregister zit vol.' };
    const rij = { id: rid(), vanStad: p.stad, vanProject: p.id, naam: p.naam, soort: p.soort, vlag: p.vlag,
      doelgroep: p.doelgroep, budgetCenten: p.budgetCenten, aanpak, geleerd,
      doorlooptijd: schoon(b.doorlooptijd, 60),
      // de indicatoren als sjabloon: de naam en het doel reizen mee, de
      // resultaten van die stad blijven daar
      indicatoren: gemeten.slice(0, 20).map(i => ({ naam: i.naam, doel: i.doel })),
      overgenomen: [], door: w.key, at: nu() };
    B().push(rij);
    audit(w.key, 'blauwdruk.deel', p.naam, 'uit ' + g.stad.naam);
    save();
    return { ok: true, blauwdruk: beeld(rij) };
  }

  // De catalogus. Iedereen met een zetel mag hem lezen -- dat is het hele punt.
  function catalogus(req) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in om de blauwdrukken te lezen.' };
    const mijn = new Set(bereik(w));
    return { ok: true, landelijk: !!w.landelijk,
      blauwdrukken: B().map(b => Object.assign(beeld(b), { eigen: mijn.has(b.vanStad) })) };
  }

  /* Overnemen. Het wordt een nieuw project in de eigen stad, op "idee", met de
     herkomst erbij. Drie dingen die hier expliciet NIET gebeuren: het project
     komt niet binnen als goedgekeurd, het budget van de andere stad wordt niet
     overgenomen als toezegging, en de resultaten reizen niet mee. */
  function neemOver(req, blauwdrukId, stadId) {
    const bd = vind(blauwdrukId);
    if (!bd) return { status: 404, error: 'Deze blauwdruk bestaat niet.' };
    const w = wie(req);
    const g = poort(w, stadId, 'project.beheren', bd.vlag);
    if (!g.ok) return g;
    if (g.stad.id === bd.vanStad) {
      return { status: 400, error: 'Deze blauwdruk komt uit deze stad zelf. Overnemen doet een ANDERE afdeling.' };
    }
    const p = { id: rid(), stad: g.stad.id, partnerId: null, naam: bd.naam, soort: bd.soort, vlag: bd.vlag,
      doelgroep: bd.doelgroep, doel: bd.aanpak.slice(0, 400),
      van: null, tot: null,
      // nul, met opzet: het bedrag van een andere stad is daar een feit en hier
      // een aanname. Het budget wordt hier opnieuw bepaald en goedgekeurd.
      budgetCenten: 0, financiering: 'nog onbekend',
      leiderKey: w.key, leiderNaam: w.key, status: 'idee', besluit: null,
      activiteiten: [], indicatoren: (bd.indicatoren || []).map(i => ({ id: rid(), naam: i.naam,
        doel: i.doel, bereikt: 0, doorgestroomd: 0, uitgevallen: 0, actief: 0 })),
      risicos: [], vrijwilligers: [], deelnemersUniek: 0, bewijs: [], rapportages: [],
      uitBlauwdruk: bd.id, at: nu() };
    S().projecten.push(p);
    if (!Array.isArray(bd.overgenomen)) bd.overgenomen = [];
    bd.overgenomen.push({ stad: g.stad.id, projectId: p.id, at: nu() });
    audit(w.key, 'blauwdruk.overgenomen', bd.naam, 'naar ' + g.stad.naam);
    save();
    return { ok: true, projectId: p.id,
      melding: '"' + bd.naam + '" staat nu als idee in RTF ' + g.stad.naam +
        '. Bepaal het budget en loop de eigen goedkeuring; een blauwdruk is geen besluit.' };
  }

  const meting = require('./netwerk-meting')(ctx);

  return { deel, catalogus, neemOver, benchmark: meting.benchmark, vind, beeld };
};
