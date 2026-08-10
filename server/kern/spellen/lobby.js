/* Spellen (deelmodule): de lobby: de INITS-tabel, een potje starten, een
   vriend uitnodigen, antwoorden, de matchmaking (random tegenstander in de
   eigen wereld en leeftijdslaag) en het eigen spellenoverzicht. Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen, klok,
    INITS, klasgenotenVan } = ctx;
  function spelStart(potje) {
    potje.status = 'bezig'; potje.beurt = 0;
    INITS[potje.soort](potje);
    // de eerste beurt begint nu; zonder tempo doet dit niets
    if (klok) klok.zetKlok(potje);
  }
  // 30 Seconden speel je met twee teams van twee; Proost alleen met 18+
  function spelGrootte(soort, grootte) {
    const s = SPEL[soort];
    return Math.min(s.max, Math.max(s.min || 2, Number(grootte) || 2));
  }
  /* Speelt dit potje in teams? Dat staat in de descriptor van het spel, niet
     als spelnaam hier: 'altijd' is een spel dat niet anders KAN (30 Seconden,
     twee teams van twee), 'keuze' is een spel waar het mag als het potje vol
     zit en de starter erom vraagt (2-tegen-2 mens-erger-je-niet). Op het
     random-pad wordt er niets gevraagd, dus daar wint 'altijd' en blijft
     'keuze' vrij spel. */
  function teamModus(soort, grootte, modus) {
    const t = SPEL[soort].teams;
    if (t === 'altijd') return 'teams';
    if (t === 'keuze' && modus === 'teams' && grootte === SPEL[soort].max) return 'teams';
    return 'vrij';
  }
  async function spelNieuw(mij, { soort, grootte, modus, vrienden, codenamen, klasgenoten, taal, wereld, tempo }) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
    // het tempo hoort bij het spel: een reactieduel met 24 uur per beurt is
    // geen spel meer, dus dat weigert de klok op basis van `vormen`
    const tf = klok ? klok.tempoFout(soort, tempo) : null;
    if (tf) return { status: 400, error: tf };
    // een potje met uitnodigingen telt als EEN uitnodiging tegen het budget,
    // ook op het vriendenpad (anders is nudge-spam naar vrienden gratis)
    if (!sociaalRate(mij, 'spel-uitnodiging', 20, 3600000)) return { status: 429, error: 'Rustig aan met uitnodigen.' };
    const max = spelGrootte(soort, grootte);
    const uitgenodigd = (Array.isArray(vrienden) ? vrienden : []).slice(0, max - 1).filter(v => zijnVrienden(mij, v));
    /* Uitnodigen op codenaam: samen spelen maakt je NIET automatisch vrienden.
       De ander accepteert de uitnodiging zelf, blokkades gelden gewoon en
       beschermde kinderen zijn onvindbaar (die spelen alleen met vrienden). */
    for (const cn of (Array.isArray(codenamen) ? codenamen : []).slice(0, max - 1)) {
      const zoek = await socialZoek(mij, String(cn));
      const hit = (zoek || []).find(r => String(r.codename).toLowerCase() === String(cn).trim().toLowerCase());
      if (!hit) return { status: 404, error: 'De codenaam "' + String(cn).slice(0, 40) + '" is niet gevonden.' };
      if (isGeblokkeerd(mij, hit.key)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
      if (!uitgenodigd.includes(hit.key) && hit.key !== mij) uitgenodigd.push(hit.key);
    }
    /* Klasgenoten: beschermde tieners zijn onvindbaar via de zoeker, maar de
       eigen klas is een echte, bevestigde kring. De server controleert het
       klasgenootschap zelf (zelfde klas in de schooldata); blokkades gelden. */
    if (Array.isArray(klasgenoten) && klasgenoten.length) {
      const kring = new Set(klasgenotenVan(mij).map(kg => kg.key));
      for (const key of klasgenoten.slice(0, max - 1)) {
        if (!kring.has(key)) return { status: 403, error: 'Alleen echte klasgenoten kun je zo uitnodigen.' };
        if (isGeblokkeerd(mij, key)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
        if (!uitgenodigd.includes(key)) uitgenodigd.push(key);
      }
    }
    if (!uitgenodigd.length) return { status: 400, error: 'Nodig minstens een speler uit (vriend of codenaam), of speel random.' };
    if (uitgenodigd.length > max - 1) return { status: 400, error: 'Te veel spelers voor dit spel.' };
    for (const v of uitgenodigd) { const vf = leeftijdFout(soort, v); if (vf) return { status: 403, error: vf }; }
    const potje = { id: rid(5), soort, grootte: max, modus: teamModus(soort, max, modus),
      taal: taal === 'en' ? 'en' : 'nl', tempo: tempo || null,
      teams: TEAMS, spelers: [mij], uitgenodigd, status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: codenaamVan(mij) };
    S().potjes[potje.id] = potje;
    save();
    uitgenodigd.forEach(v => nudge(v, potje));
    return { status: 200, ok: true, id: potje.id };
  }
  function spelAntwoord(mij, id, akkoord) {
    const p = S().potjes[id];
    if (!p || p.status !== 'wacht' || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    if (akkoord === true) {
      const lf = leeftijdFout(p.soort, mij);
      if (lf) return { status: 403, error: lf };
    }
    p.uitgenodigd = p.uitgenodigd.filter(x => x !== mij);
    // 30 Seconden start pas met vier (twee teams); haalt een potje zijn
    // minimum niet meer, dan verdwijnt het in plaats van kapot te starten
    const minimum = SPEL[p.soort].min || 2;
    if (akkoord === true) p.spelers.push(mij);
    if (p.spelers.length >= p.grootte || (!p.uitgenodigd.length && p.spelers.length >= minimum)) spelStart(p);
    else if (!p.uitgenodigd.length && p.spelers.length < minimum) delete S().potjes[id];
    save();
    p.spelers.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true, gestart: p.status === 'bezig', geannuleerd: !S().potjes[id] && p.status !== 'bezig' };
  }
  function spelRandom(mij, soort, grootte, taal, wereld, tempo) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
    const tf = klok ? klok.tempoFout(soort, tempo) : null;
    if (tf) return { status: 400, error: tf };
    const max = spelGrootte(soort, grootte);
    const w_taal = taal === 'en' ? 'en' : 'nl';
    /* De wachtrij splitst per spel en groepsgrootte, en alleen bij een
       taalgevoelig spel ook per taal (zie perTaal in de descriptor).

       HET TEMPO SPLITST HEM OOK, en dat moet wel: wie een partij van 72 uur per
       beurt zoekt en er een van 30 seconden krijgt, heeft geen tegenstander
       maar een verloren partij. Een potje zonder tempo houdt de oude sleutel,
       dus bestaande wachtrijen veranderen niet. */
    const sleutel = soort + ':' + max + (SPEL[soort].perTaal ? ':' + w_taal : '') + (tempo ? ':' + tempo : '');
    const w = S().wachtrij;
    w[sleutel] = (w[sleutel] || []).filter(x => x !== mij);
    w[sleutel].push(mij);
    if (w[sleutel].length >= max) {
      const spelers = w[sleutel].splice(0, max);
      const potje = { id: rid(5), soort, grootte: max, modus: teamModus(soort, max), taal: w_taal, tempo: tempo || null,
        teams: TEAMS, spelers, uitgenodigd: [],
        status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: 'random' };
      S().potjes[potje.id] = potje;
      spelStart(potje);
      save();
      spelers.forEach(sp => nudge(sp, potje));
      return { status: 200, ok: true, id: potje.id, gestart: true };
    }
    save();
    return { status: 200, ok: true, wachten: true, plek: w[sleutel].length, nodig: max };
  }
  function mijnSpellen(mij) {
    opschonen();
    const alle = Object.values(S().potjes);
    const mijnPotjes = alle.filter(p => p.spelers.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl',
      spelers: p.spelers.map(codenaamVan), wachtOp: p.uitgenodigd.length,
      aanZet: p.status === 'bezig' ? codenaamVan(p.spelers[p.beurt]) : null, ikAanZet: p.status === 'bezig' && p.spelers[p.beurt] === mij,
      // de klok reist mee zodat de lobby "jouw beurt, nog 18 uur" kan tonen
      klok: klok ? klok.klokStand(p) : null,
      winnaar: p.winnaar, gelijk: !!p.gelijk, at: p.at
    })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
    const uitnodigingen = alle.filter(p => p.status === 'wacht' && p.uitgenodigd.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], van: p.door, spelers: p.spelers.map(codenaamVan), modus: p.modus
    }));
    return { potjes: mijnPotjes, uitnodigingen };
  }
  /* Een potje dat METEEN begint tussen spelers die al ja hebben gezegd. Dat is
     het pad voor een toernooiwedstrijd: daar is de uitnodiging al gedaan bij
     het toernooi zelf, dus een tweede ronde accepteren zou een lege plichtpleging
     zijn. Hij loopt bewust langs dezelfde spelStart als elk ander potje -- een
     toernooipartij is een gewone partij, met alle spelregels en poorten die
     daarbij horen, en niet een tweede soort potje. */
  function potjeDirect(soort, spelers, extra) {
    const potje = Object.assign({
      id: rid(5), soort, grootte: spelers.length, modus: teamModus(soort, spelers.length),
      taal: 'nl', teams: TEAMS, spelers: spelers.slice(), uitgenodigd: [],
      status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: 'toernooi'
    }, extra || {});
    S().potjes[potje.id] = potje;
    spelStart(potje);
    save();
    spelers.forEach(sp => nudge(sp, potje));
    return potje;
  }

  // teamModus reist mee naar buiten zodat de toets hem los kan aanspreken:
  // via de API is "vier spelers, wel of geen teams" een dure opstelling
  return { spelStart, spelGrootte, teamModus, potjeDirect, spelNieuw, spelAntwoord, spelRandom, mijnSpellen };
};
