/* Genootschap (deelmodule): inzicht voor de beheerder, en bijgepraat worden.

   DEZE RONDE (5): wat elders achter een betaalmuur of een groeitruc zit, zit hier
   gewoon in de pas. Voor de Facebook-kant zijn dat twee dingen.

   1. GROEPSINZICHT ZONDER RANGLIJST. Een beheerder mag weten hoe zijn groep
      ervoor staat. Wat wij daar NIET bij doen is de "top bijdragers"-lijst die
      elders in datzelfde scherm staat. Zo'n ranglijst maakt van meedoen een
      wedstrijd, en van stilvallen een zichtbare afgang -- precies het
      mechanisme dat de huisregels verbieden. Je ziet dus HOEVEEL leden actief
      waren, nooit WIE het meest deed.
      Wat er wel bij hoort en elders zelden staat: hoeveel berichten zonder
      enige reactie bleven. Dat is de enige "score" die een beheerder echt kan
      gebruiken, en hij gaat over de groep, niet over een persoon.

   2. BIJGEPRAAT, MET EEN EINDE. "Wat heb je gemist" is elders het werk van een
      feed die nooit ophoudt, want een tijdlijn die zegt dat je bij bent, is een
      tijdlijn die je laat gaan. Hier is het een korte lijst met een bodem: zoveel
      nieuwe berichten, deze peilingen wachten nog op jou, deze bijeenkomsten
      heb je nog niet beantwoord. Is er niets, dan staat er dat je bij bent.

   Wat hier NIET komt, hoe gratis ook: bereik dat je kunt kopen, een vinkje dat
   je kunt kopen (bevestiging komt bij ons uit een gebeurtenis, zie
   kern/eenaccount.js), en meldingen die alleen bestaan om je terug te halen. */
module.exports = ({ db, save, genootschap, prikbord, bijeenkomst }) => {
  const nu = () => new Date().toISOString();
  const DAG = 86400000;
  const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  /* Waar we bijhouden wanneer iemand een genootschap voor het laatst zag. Alleen
     een tijdstip per lid per groep -- geen leesbevestiging naar anderen, want dan
     wordt "gezien" een verplichting in plaats van een gemak. */
  function gezien() {
    const g = genootschap.S();
    if (!g.gezien || typeof g.gezien !== 'object') g.gezien = {};
    return g.gezien;
  }
  const gezienOp = (groepId, key) => (gezien()[groepId] || {})[key] || null;

  const poort = (sess, groepId, alleenBeheer) => {
    const gr = genootschap.groepMet(groepId);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    if (alleenBeheer && !genootschap.isBeheer(gr, sess.key)) return { error: 'Alleen een beheerder ziet dit.' };
    return { gr };
  };

  const bord = (id) => (genootschap.S().prikbord[id] || []);
  const bijeen = (id) => (genootschap.S().bijeenkomst[id] || []);

  /* Hoe staat het genootschap ervoor? Alles hieronder is een aantal, nooit een
     naam en nooit een volgorde van leden. */
  function gezondheid(sess, groepId) {
    const p = poort(sess, groepId, true);
    if (p.error) return p;
    const gr = p.gr;
    const nuMs = Date.now();
    const berichten = bord(groepId);
    const events = bijeen(groepId);

    const binnen = (iso, dagen) => iso && (nuMs - new Date(iso).getTime()) <= dagen * DAG;
    const vorigeMaand = (iso) => {
      if (!iso) return false;
      const d = nuMs - new Date(iso).getTime();
      return d > 30 * DAG && d <= 60 * DAG;
    };

    // wie was actief: als VERZAMELING, alleen om te tellen. De sleutels
    // verlaten deze functie niet.
    const actief = new Set();
    let dezeMaand = 0, vorige = 0, reacties = 0, peilingen = 0, stemmen = 0, zonderReactie = 0;
    const perDag = new Array(7).fill(0);

    for (const b of berichten) {
      if (binnen(b.at, 30)) { dezeMaand++; if (b.vanKey) actief.add(b.vanKey); }
      else if (vorigeMaand(b.at)) vorige++;
      if (b.at) perDag[new Date(b.at).getDay()]++;
      const r = b.reacties || [];
      reacties += r.length;
      if (!r.length && !b.peiling) zonderReactie++;
      for (const x of r) if (binnen(x.at, 30) && x.vanKey) actief.add(x.vanKey);
      if (b.peiling) {
        peilingen++;
        const s = Object.keys(b.peiling.stemmen || {});
        stemmen += s.length;
        if (binnen(b.at, 30)) for (const k of s) actief.add(k);
      }
    }

    const vandaag = new Date().toISOString().slice(0, 10);
    let komend = 0, laatsteAntwoorden = null;
    for (const e of events) {
      if (e.datum >= vandaag && !e.afgelast) komend++;
      const a = Object.keys(e.antwoorden || {});
      for (const k of a) if (binnen(e.at, 30)) actief.add(k);
      if (e.datum >= vandaag && !e.afgelast && (!laatsteAntwoorden || e.datum < laatsteAntwoorden.datum)) {
        laatsteAntwoorden = { datum: e.datum, wat: e.wat, geantwoord: a.length };
      }
    }

    const leden = (gr.leden || []).length;
    const drukste = perDag.indexOf(Math.max(...perDag));
    return { ok: true,
      groep: { id: gr.id, naam: gr.naam, soort: gr.soort, leden,
        beheerders: (gr.leden || []).filter(l => l.rol === 'beheerder').length,
        opgericht: gr.at || null, uitnodigingenOpen: (gr.uitnodigingen || []).length },
      actief: { leden: actief.size, vanTotaal: leden, periode: '30 dagen' },
      prikbord: { totaal: berichten.length, dezeMaand, vorigeMaand: vorige, reacties, peilingen, stemmen, zonderReactie },
      bijeenkomsten: { totaal: events.length, komend,
        eerstvolgende: laatsteAntwoorden ? { wat: laatsteAntwoorden.wat, datum: laatsteAntwoorden.datum,
          geantwoord: laatsteAntwoorden.geantwoord, vanTotaal: leden } : null },
      ritme: berichten.length ? { drukste: WEEKDAG[drukste], berichtenDanDag: perDag[drukste] } : null,
      uitleg: 'Aantallen over de groep, nooit over een persoon. Er is met opzet geen lijst van wie het meest bijdraagt: meedoen is hier geen wedstrijd.' };
  }

  /* Wat heb je gemist sinds je laatste bezoek? Met een bodem: is er niets, dan
     zegt de app dat, in plaats van iets te verzinnen om je bezig te houden. */
  function bijgepraat(sess, groepId) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const sinds = gezienOp(groepId, sess.key);
    const na = (iso) => !sinds || (iso && iso > sinds);
    const vandaag = new Date().toISOString().slice(0, 10);

    let nieuw = 0, nieuweReacties = 0;
    const peilingenOpen = [];
    for (const b of bord(groepId)) {
      if (b.vanKey !== sess.key && na(b.at)) nieuw++;
      for (const r of (b.reacties || [])) if (r.vanKey !== sess.key && na(r.at)) nieuweReacties++;
      if (b.peiling && (b.peiling.stemmen || {})[sess.key] === undefined) {
        peilingenOpen.push({ id: b.id, tekst: String(b.tekst || '').slice(0, 80) });
      }
    }
    const openVragen = bijeen(groepId)
      .filter(e => e.datum >= vandaag && !e.afgelast && !(e.antwoorden || {})[sess.key])
      .map(e => ({ id: e.id, wat: e.wat, datum: e.datum }));

    const iets = nieuw + nieuweReacties + peilingenOpen.length + openVragen.length;
    return { ok: true, sinds,
      nieuw, nieuweReacties,
      peilingen: peilingenOpen.slice(0, 10),
      bijeenkomsten: openVragen.slice(0, 10),
      bij: iets === 0,
      tekst: iets === 0 ? 'Je bent bij. Er wacht niets op je.' : null };
  }

  // Het bezoek afsluiten: vanaf hier is "gemist" weer leeg.
  function markeer(sess, groepId) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const g = gezien();
    if (!g[groepId] || typeof g[groepId] !== 'object') g[groepId] = {};
    g[groepId][sess.key] = nu();
    save();
    return { ok: true, gezien: g[groepId][sess.key] };
  }

  return { gezondheid, bijgepraat, markeer, gezienOp };
};
