/* RTG Stadsweefsel, deel "onderhoud": de stad die niet wacht tot iets stukgaat.

   Een stad die op meldingen draait, loopt per definitie achter: elke melding is
   een ding dat al kapot is, en elke reparatie is duurder dan de inspectie die
   hem had voorkomen. Deze laag draait de vraag om.

   Drie dingen, oplopend in stelligheid:

   1. HET REGIME. Per objectsoort een inspectie-interval. Wat over zijn termijn
      is, staat op de lijst. Dat is geen voorspelling maar een afspraak, en het
      is verreweg het meeste werk van een echte beheerorganisatie.
   2. HET SIGNAAL. Uit conditie, leeftijd ten opzichte van de levensduur, en
      hoe vaak er het afgelopen jaar aan is gesleuteld, komt een score met de
      REDENEN erbij. Geen zwarte doos: wie het niet eens is met de uitkomst,
      moet kunnen zien waarop hij rust.
   3. HET VOORSTEL. Een onderhoudsronde is een LIJST die een mens goedkeurt,
      geen werk dat vanzelf ontstaat. Dat is niveau 2 uit ./ainiveau.js.

   EN DE HARDE GRENS: bij een object met risicoklasse KRITIEK (een gemaal, een
   transformator, een brug) kan het voorstel alleen worden gegund met VIER OGEN
   -- twee namen, en niet twee keer dezelfde. Dat is niveau 4: geen machine, en
   ook geen enkele haastige klik, zet werk aan veiligheidskritieke
   infrastructuur in gang. Wie dat te streng vindt, moet bedenken dat de
   goedkope kant van deze fout een overbodige inspectie is en de dure kant een
   gemaal dat tijdens hoogwater stilstaat omdat iemand dacht dat het al gepland
   was.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');
const { magAutomatisch, niveauVoorObject } = require('./ainiveau');

const DAG = 86400000, MAAND = 30 * DAG;
/* Het inspectie-interval per soort, in maanden. De getallen komen uit wat een
   beheerder redelijk zou noemen: een speeltoestel elk kwartaal, een lantaarn
   eens in de vier jaar, een gemaal twee keer per jaar. */
const REGIME = {
  speeltoestel: 3, gemaal: 6, verkeerslicht: 6, brug: 12, transformator: 12,
  laadpaal: 12, container: 12, halte: 12, sensor: 12, boom: 24, put: 24, lantaarn: 48
};

module.exports = (ctx) => {
  const { nu, geo, obj, werk } = ctx;

  const jaarNu = () => new Date(nu()).getFullYear();
  const intervalMs = (soort) => (REGIME[soort] || 24) * MAAND;

  // sinds wanneer is dit object niet nagekeken? Zonder inspectie telt de
  // oplevering: een paal uit 1994 die nooit is geschouwd, is niet "nog nooit
  // aan de beurt geweest" maar dertig jaar over tijd
  function laatst(o) {
    if (o.laatsteInspectie) return o.laatsteInspectie;
    const bouw = new Date(o.bouwjaar || jaarNu(), 0, 1).getTime();
    return bouw;
  }
  const overTijdMs = (o) => nu() - laatst(o) - intervalMs(o.soort);

  /* Het signaal: een score van 0 tot 100 met de redenen erbij. Bewust simpel en
     leesbaar -- dit hoort uitlegbaar te zijn aan iemand die het er niet mee
     eens is, en een gewogen som van vier zichtbare dingen is dat. Het is
     nadrukkelijk GEEN voorspelling van uitval; het is een rangschikking van
     waar je als eerste zou gaan kijken. */
  function signaal(o) {
    const redenen = [];
    let score = 0;
    if (o.conditie >= 4) { score += (o.conditie - 3) * 15; redenen.push('conditie ' + o.conditie + ' (' + obj.CONDITIE[o.conditie] + ')'); }
    const rest = o.bouwjaar + o.levensduurJaar - jaarNu();
    if (rest <= 0) { score += 25; redenen.push('over de technische levensduur heen (' + (-rest) + ' jaar)'); }
    else if (rest <= 3) { score += 12; redenen.push('nog ' + rest + ' jaar technische levensduur'); }
    const jaarGeleden = nu() - 365 * DAG;
    const beurten = (o.onderhoud || []).filter(r => r.at >= jaarGeleden).length;
    if (beurten >= 3) { score += 20; redenen.push(beurten + ' keer werk in het afgelopen jaar'); }
    else if (beurten === 2) { score += 8; redenen.push('twee keer werk in het afgelopen jaar'); }
    const over = overTijdMs(o);
    if (over > 0) { score += Math.min(25, Math.round(over / MAAND) * 2); redenen.push(Math.round(over / MAAND) + ' maand(en) over het inspectie-interval'); }
    if (o.status === 'storing') { score += 20; redenen.push('staat nu in storing'); }
    return { score: Math.min(100, score), redenen };
  }

  /* Wat er te doen staat. Alleen objecten in dienst, gesorteerd op signaal.
     Een object waar al een openstaande werkorder voor ligt, valt eraf -- anders
     stelt de lijst elke dag hetzelfde werk opnieuw voor en leert niemand hem
     nog lezen. */
  function teDoen({ gebied, soort, minScore } = {}) {
    const bezet = new Set(werk.werklijst({}).map(w => w.objectId).filter(Boolean));
    const drempel = Number(minScore) >= 0 ? Number(minScore) : 1;
    return obj.zoek({ gebied, soort }).filter(o => o.status !== 'uit-dienst' && !bezet.has(o.id))
      .map(o => ({ object: o, ...signaal(o), overMaanden: Math.round(Math.max(0, overTijdMs(o)) / MAAND) }))
      .filter(x => x.score >= drempel)
      .sort((a, b) => b.score - a.score);
  }

  /* Het VOORSTEL: een ronde die een mens goedkeurt. Elk voorstel draagt zijn
     eigen niveau mee, want dat bepaalt wat er nodig is om hem te gunnen. */
  function plan({ gebied, soort, max } = {}) {
    const grens = Number(max) > 0 ? Math.min(Math.round(Number(max)), 100) : 25;
    const rij = teDoen({ gebied, soort }).slice(0, grens);
    const voorstellen = rij.map(x => ({
      objectId: x.object.id, naam: x.object.naam, soort: x.object.soort,
      plaats: geo.label(x.object.gebied), risico: x.object.risico,
      score: x.score, redenen: x.redenen, overMaanden: x.overMaanden,
      soortWerk: x.object.status === 'storing' ? 'storing' : (x.overMaanden > 0 ? 'inspectie' : 'onderhoud'),
      niveau: niveauVoorObject('onderhoud-plannen', x.object),
      vierOgen: x.object.risico === 'kritiek'
    }));
    return { status: 200, aantal: voorstellen.length, voorstellen,
      regime: REGIME, vanzelf: magAutomatisch('onderhoud-plannen'),
      let_op: 'Dit is een voorstel. Er ontstaat geen werk tot een mens het gunt; bij kritieke objecten met twee namen.' };
  }

  /* Gunnen: hier ontstaat het werk. Alles wat kritiek is, vraagt vier ogen --
     twee namen die niet dezelfde zijn. Een object dat er niet meer is, of dat
     inmiddels werk heeft, wordt overgeslagen MET reden in het antwoord: stil
     minder werk aanmaken dan iemand goedkeurde, is de nare soort verrassing. */
  function gun({ objectIds, wie, tweede, notitie }) {
    const naam = schoon(wie, 60);
    if (!naam) return { status: 400, error: 'Wie gunt dit werk?' };
    const ids = Array.isArray(objectIds) ? objectIds.map(String).slice(0, 100) : [];
    if (!ids.length) return { status: 400, error: 'Kies minstens een object uit het voorstel.' };
    const tweedeNaam = schoon(tweede, 60);
    const gemaakt = [], overgeslagen = [];
    const bezet = new Set(werk.werklijst({}).map(w => w.objectId).filter(Boolean));
    for (const id of ids) {
      const o = obj.object(id);
      if (!o) { overgeslagen.push({ id, reden: 'onbekend object' }); continue; }
      if (o.status === 'uit-dienst') { overgeslagen.push({ id, naam: o.naam, reden: 'uit dienst' }); continue; }
      if (bezet.has(o.id)) { overgeslagen.push({ id, naam: o.naam, reden: 'er ligt al werk voor dit object' }); continue; }
      if (o.risico === 'kritiek' && (!tweedeNaam || tweedeNaam === naam)) {
        overgeslagen.push({ id, naam: o.naam, reden: 'veiligheidskritiek: dit vraagt vier ogen, twee verschillende namen' });
        continue;
      }
      const s = signaal(o);
      const r = werk.werkorderMaak({
        objectId: o.id, soort: o.status === 'storing' ? 'storing' : 'inspectie',
        omschrijving: 'Gepland onderhoud: ' + o.naam + ' (' + s.redenen.join('; ') + ')',
        prioriteit: o.risico === 'kritiek' ? 'hoog' : (s.score >= 50 ? 'hoog' : 'normaal'),
        wie: naam + (tweedeNaam ? ' + ' + tweedeNaam : '')
      });
      if (r.ok) { gemaakt.push(r.werkorder); bezet.add(o.id); }
      else overgeslagen.push({ id, naam: o.naam, reden: r.error || 'kon geen werkorder maken' });
    }
    return { ok: true, gemaakt: gemaakt.length, overgeslagen, werkorders: gemaakt,
      wie: naam, tweede: tweedeNaam || null, notitie: schoon(notitie, 200) || null };
  }

  return {
    REGIME, signaal, teDoen, intervalMs,
    api: {
      weefselOnderhoud: ({ gebied, soort, minScore } = {}) => {
        const rij = teDoen({ gebied, soort, minScore });
        return { status: 200, aantal: rij.length, regime: REGIME,
          objecten: rij.slice(0, 200).map(x => ({ ...obj.publiek(x.object), score: x.score, redenen: x.redenen, overMaanden: x.overMaanden })) };
      },
      weefselOnderhoudPlan: plan,
      weefselOnderhoudGun: gun
    }
  };
};
