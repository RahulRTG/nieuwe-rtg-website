/* Kern-module "spellen": verslavende potjes op de vriendenlaag, voor alle
   leden (RTF en RTG spelen tegen elkaar, op codenaam).

   Drie bordspellen en een scorebord:
   - Mens erger je niet: 2, 3 of 4 spelers vrij-voor-allen, of 2-tegen-2 in
     teams. Server-authoritatief: de server dobbelt, bewaakt de regels
     (6 = eruit en nog een keer, slaan = terug naar start, exact thuisbrengen)
     en wijst de winnaar aan.
   - Schaken: volledige zetvalidatie (rokade, en passant, promotie naar dame,
     schaak, mat en pat) op de server.
   - Woordduel (wordfeud-achtig): 15x15 met premievelden, de Nederlandse
     letterzak, kruiswoord-scoring en de 40-puntenbonus. Zonder woordenboek:
     het eer-systeem, zoals thuis aan tafel.
   - Dammen: 10x10 internationaal, slaan verplicht, meerslag met hetzelfde
     stuk, een dam vliegt over de diagonaal.
   - Rummi (rummikub-achtig): 106 stenen, eerste uitleg van 30 punten,
     daarna vrij herschikken; de server keurt de hele tafel bij elke beurt.
   - Magnaat (monopoly-achtig): 2 t/m 6 spelers, 40 velden in de RTG-wereld,
     kopen, huur, bouwen, kanskaarten en de gevangenis; wie overblijft wint.
   - Partyspellen: 30 Seconden (2 tegen 2, eer-systeem), Doen of Waarheid
     (2 t/m 6) en Proost (2 t/m 6, alleen 18+ met paspoort-geboortedatum).
   - Arcade (Sneek, Tetris, Sudoku): ieder speelt zelf; de beste scores
     vormen een ranglijst onder vrienden.

   Een potje start met uitgenodigde vrienden (die accepteren zelf), op
   codenaam (maakt geen vriendschap) of via de random wachtrij per spel en
   groepsgrootte. Beurten gaan via polling plus een SSE-duwtje. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {} };
    return db.data.spellen;
  }
  /* Een tabel per spel is de enige bron: naam, spelersaantal en welke app het
     potje START (meespelen op uitnodiging kan altijd over en weer). 'min'
     dwingt af dat 30 Seconden echt met vier begint; 'volwassen' is de
     18+-poort van Proost (paspoort-geboortedatum; RTF-profielen hebben geen
     geverifieerde leeftijd en doen dus nooit mee). */
  const SPEL = {
    mejn:     { naam: 'Mens erger je niet', max: 4, wereld: 'rtf' },
    schaak:   { naam: 'Schaken',            max: 2, wereld: 'rtg' },
    woord:    { naam: 'Woordduel',          max: 2, wereld: 'rtg' },
    pesten:   { naam: 'Pesten',             max: 4, wereld: 'rtf' },
    dam:      { naam: 'Dammen',             max: 2, wereld: 'rtf' },
    rummi:    { naam: 'Rummi',              max: 4, wereld: 'rtf' },
    magnaat:  { naam: 'Magnaat',            max: 6, wereld: 'rtg', buitenBeurt: ['bouw', 'verkoop'] },
    seconden: { naam: '30 Seconden',        max: 4, min: 4, wereld: 'rtg' },
    waarheid: { naam: 'Doen of Waarheid',   max: 6, wereld: 'rtf' },
    proost:   { naam: 'Proost',             max: 6, wereld: 'rtg', volwassen: true }
  };
  const SOORTEN = Object.fromEntries(Object.entries(SPEL).map(([k, v]) => [k, v.naam]));
  const TEAMS = [0, 1, 0, 1, 0, 1]; // om en om twee teams, tot zes spelers
  function wereldFout(wereld, soort) {
    if (!SPEL[soort] || SPEL[soort].wereld === wereld || (wereld !== 'rtg' && wereld !== 'rtf')) return null;
    return wereld === 'rtg' ? 'Dit spel vind je in de RTFoundation-app.' : 'Dit spel vind je in de RTG-leden-app.';
  }
  // de 18+-poort, op ELK toetredingsmoment (starten, uitnodigen, accepteren)
  function leeftijdFout(soort, handle) {
    if (SPEL[soort] && SPEL[soort].volwassen && !volwassen(handle))
      return 'Proost is 18+. Dit spel kan alleen met leden met een geverifieerde volwassen leeftijd.';
    return null;
  }
  const nudge = (naar, potje) => { try { sseToCustomer(naar, 'social', { kind: 'spel', potje: potje.id, soort: potje.soort }); } catch (e) {} };
  // eerlijk schudden (Fisher-Yates op crypto), gedeeld door alle kaart- en letterzakken
  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // beurt doorschuiven met de klok mee (of tegen, met stap -1); spel-neutraal
  function beurtDoor(potje, stap) {
    const n = potje.spelers.length;
    potje.beurt = ((potje.beurt + (stap || 1)) % n + n) % n;
  }

  /* ---------- opschonen: klare potjes na een dag weg, wachtenden na een uur.
     Hooguit een keer per minuut: de scan over alle potjes hoort niet in het
     hete pad van elke lobby-poll. ---------- */
  let opgeschoondOm = 0;
  function opschonen() {
    const t = Date.now();
    if (t - opgeschoondOm < 60000) return;
    opgeschoondOm = t;
    const s = S();
    for (const [id, p] of Object.entries(s.potjes)) {
      const leeftijd = t - new Date(p.at).getTime();
      if ((p.status === 'klaar' && leeftijd > 86400000) || (p.status === 'wacht' && leeftijd > 6 * 3600000)) delete s.potjes[id];
    }
  }

  /* ================= Mens erger je niet =================
     Ring van 40 velden; speler p start op veld p*10. Een pion: -1 = in het
     starthok, 0..39 = op de ring (absoluut), 100+i = eigen thuisrij. */

  /* ---------- de spelmotoren: elk spel een eigen module ----------
     De gedeelde context geeft ze save/crypto/schud/beurtDoor/codenaamVan; de
     dispatch-tabellen (INITS/ZETTEN/VIEWS) hieronder blijven ongewijzigd. */
  const spelCtx = { save, crypto, schud, beurtDoor, codenaamVan, nudge };
  const { mejnInit, mejnZet, mejnZetten, mejnGooi } = require('./spellen/mejn')(spelCtx);
  const { schaakInit, schaakZet } = require('./spellen/schaak')(spelCtx);
  const { woordInit, woordZet, W_PREMIE } = require('./spellen/woord')(spelCtx);
  const { pestenInit, pestenZet } = require('./spellen/pesten')(spelCtx);
  const { damInit, damZet, damZetten } = require('./spellen/dam')(spelCtx);
  const { rummiInit, rummiZet, rummiSet } = require('./spellen/rummi')(spelCtx);
  const { magnaatInit, magnaatZet, M_VELDEN } = require('./spellen/magnaat')(spelCtx);
  const { secondenInit, secondenZet } = require('./spellen/seconden')(spelCtx);
  const { waarheidInit, waarheidZet } = require('./spellen/waarheid')(spelCtx);
  const { proostInit, proostZet } = require('./spellen/proost')(spelCtx);

  const INITS = { mejn: mejnInit, schaak: schaakInit, pesten: pestenInit, woord: woordInit,
    dam: damInit, rummi: rummiInit, magnaat: magnaatInit, seconden: secondenInit, waarheid: waarheidInit, proost: proostInit };
  function spelStart(potje) {
    potje.status = 'bezig'; potje.beurt = 0;
    INITS[potje.soort](potje);
  }
  // 30 Seconden speel je met twee teams van twee; Proost alleen met 18+
  function spelGrootte(soort, grootte) {
    const s = SPEL[soort];
    return Math.min(s.max, Math.max(s.min || 2, Number(grootte) || 2));
  }
  async function spelNieuw(mij, { soort, grootte, modus, vrienden, codenamen, taal, wereld }) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
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
    if (!uitgenodigd.length) return { status: 400, error: 'Nodig minstens een speler uit (vriend of codenaam), of speel random.' };
    if (uitgenodigd.length > max - 1) return { status: 400, error: 'Te veel spelers voor dit spel.' };
    for (const v of uitgenodigd) { const vf = leeftijdFout(soort, v); if (vf) return { status: 403, error: vf }; }
    const potje = { id: rid(5), soort, grootte: max, modus: (soort === 'mejn' && modus === 'teams' && max === 4) || soort === 'seconden' ? 'teams' : 'vrij',
      taal: taal === 'en' ? 'en' : 'nl',
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
  function spelRandom(mij, soort, grootte, taal, wereld) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
    const max = spelGrootte(soort, grootte);
    const w_taal = taal === 'en' ? 'en' : 'nl';
    const sleutel = soort + ':' + max + (soort === 'woord' ? ':' + w_taal : '');
    const w = S().wachtrij;
    w[sleutel] = (w[sleutel] || []).filter(x => x !== mij);
    w[sleutel].push(mij);
    if (w[sleutel].length >= max) {
      const spelers = w[sleutel].splice(0, max);
      const potje = { id: rid(5), soort, grootte: max, modus: soort === 'seconden' ? 'teams' : 'vrij', taal: w_taal, teams: TEAMS, spelers, uitgenodigd: [],
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
      winnaar: p.winnaar, gelijk: !!p.gelijk, at: p.at
    })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
    const uitnodigingen = alle.filter(p => p.status === 'wacht' && p.uitgenodigd.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], van: p.door, spelers: p.spelers.map(codenaamVan), modus: p.modus
    }));
    return { potjes: mijnPotjes, uitnodigingen };
  }
  /* De staat zoals EEN speler hem mag zien (handen en rekken van anderen
     blijven verborgen). Een expliciete map per soort: een nieuw spel zonder
     eigen weergave faalt luid in plaats van stil als Woordduel te renderen. */
  const VIEWS = {
    mejn: (p, st, mij) => ({ pionnen: p.spelers.map(sp => st.pionnen[sp].map(x => x.pos)), dobbel: st.dobbel, mag: st.mag, zetten: p.spelers[p.beurt] === mij && st.mag === 'zet' ? mejnZetten(p, mij) : [] }),
    schaak: (p, st) => ({ bord: st.bord.join(''), aanZet: st.aanZet, laatste: st.zetten[st.zetten.length - 1] || null }),
    woord: (p, st, mij) => ({ bord: st.bord, scores: p.spelers.map(sp => st.scores[sp]), rek: st.rekken[mij], zak: st.zak.length, passes: st.passes }),
    pesten: (p, st, mij) => ({ hand: st.handen[mij], aantallen: p.spelers.map(sp => st.handen[sp].length), open: st.open[st.open.length - 1], kleurKeuze: st.kleurKeuze, pak: st.pak, richting: st.richting, stapel: st.stapel.length }),
    dam: (p, st, mij) => ({ bord: st.bord.join(''), ketting: st.ketting, zetten: p.status === 'bezig' && p.spelers[p.beurt] === mij ? damZetten(p, mij) : [] }),
    rummi: (p, st, mij) => ({ rek: st.rekken[mij], tafel: st.tafel, aantallen: p.spelers.map(sp => st.rekken[sp].length), zak: st.zak.length, eerste: st.eerste[mij], passes: st.passes }),
    magnaat: (p, st) => ({ posities: p.spelers.map(sp => st.posities[sp]), geld: p.spelers.map(sp => st.geld[sp]), failliet: p.spelers.map(sp => !!st.failliet[sp]), cel: p.spelers.map(sp => st.cel[sp] > 0),
      eigenaar: Object.fromEntries(Object.entries(st.eigenaar).map(([v, h]) => [v, p.spelers.indexOf(h)])), // veld -> spelerindex
      huizen: st.huizen, mag: st.mag, koopVeld: st.koopVeld, dobbel: st.dobbel, kaart: st.kaart }),
    seconden: (p, st, mij) => {
      const rader = (p.beurt + 2) % p.spelers.length; // de teamgenoot raadt en mag de kaart niet zien
      return { scores: st.scores, kaart: st.kaart && p.spelers.indexOf(mij) !== rader ? st.kaart : null, tot: st.tot, rader, bezig: !!st.kaart };
    },
    waarheid: (p, st) => ({ punten: p.spelers.map(sp => st.punten[sp]), kaart: st.kaart, wat: st.wat, doel: 8 }),
    proost: (p, st) => ({ kaart: st.kaart, teller: st.teller, totaal: st.totaal })
  };
  function spelStaat(mij, id, metVelden) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl', teams: p.teams.slice(0, p.spelers.length),
      spelers: p.spelers.map(codenaamVan), ik: p.spelers.indexOf(mij), beurt: p.beurt, winnaar: p.winnaar, gelijk: !!p.gelijk };
    if (p.status !== 'wacht' && p.staat && VIEWS[p.soort]) {
      uit.staat = VIEWS[p.soort](p, p.staat, mij);
      // het statische Magnaat-bord reist alleen mee als de client erom vraagt
      // (bij het openen), niet bij elke poll van 2,5 seconde
      if (p.soort === 'magnaat' && metVelden) uit.staat.velden = M_VELDEN;
    }
    return { status: 200, potje: uit };
  }
  const ZETTEN = { mejn: mejnZet, schaak: schaakZet, woord: woordZet, pesten: pestenZet, dam: damZet, rummi: rummiZet, magnaat: magnaatZet, seconden: secondenZet, waarheid: waarheidZet, proost: proostZet };
  function spelZet(mij, id, zet) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status !== 'bezig') return { status: 409, error: 'Dit potje loopt niet (meer).' };
    if (!ZETTEN[p.soort]) return { status: 400, error: 'Onbekend spel.' };
    // sommige acties mogen buiten je beurt (Magnaat: bouwen/terugverkopen);
    // dat staat in de speltabel, niet als losse uitzondering in de dispatch
    const beheer = zet && (SPEL[p.soort].buitenBeurt || []).includes(zet.actie);
    if (p.soort !== 'schaak' && !beheer && p.spelers[p.beurt] !== mij) return { status: 409, error: 'De ander is aan zet.' };
    if (p.soort === 'mejn' && zet && zet.actie === 'gooi') return mejnGooi(p, mij);
    return ZETTEN[p.soort](p, mij, zet || {});
  }
  function spelOpgeven(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status === 'klaar') return { status: 409, error: 'Dit potje is al klaar.' };
    p.status = 'klaar';
    const rest = p.spelers.filter(sp => sp !== mij);
    p.winnaar = rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ');
    save();
    rest.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true };
  }

  /* ================= arcade (Sneek en Tetris): ranglijsten onder vrienden ================= */
  const ARCADE = ['sneek', 'tetris', 'sudoku'];
  function A(spel) {
    const s = S();
    if (!s.arcade) {
      s.arcade = { sneek: s.sneek || {}, tetris: {} }; // neemt oude sneek-scores mee
      delete s.sneek; // een bron: anders lopen de oude en nieuwe sleutel uiteen
    }
    if (!s.arcade[spel]) s.arcade[spel] = {};
    return s.arcade[spel];
  }
  function arcadeScore(mij, spel, punten) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const n = Math.max(0, Math.min(999999, Math.floor(Number(punten) || 0)));
    const s = A(spel);
    if (!s[mij] || n > s[mij].punten) { s[mij] = { punten: n, at: nu() }; save(); }
    return { status: 200, ok: true, beste: s[mij].punten };
  }
  function arcadeBord(mij, spel, vrienden) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const s = A(spel);
    const rij = [mij, ...vrienden].filter(h => s[h]).map(h => ({ codenaam: codenaamVan(h), ik: h === mij, punten: s[h].punten }));
    return { bord: rij.sort((a, b) => b.punten - a.punten).slice(0, 20) };
  }
  const sneekScore = (mij, punten) => arcadeScore(mij, 'sneek', punten);
  const sneekBord = (mij, vrienden) => arcadeBord(mij, 'sneek', vrienden);

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet, W_PREMIE } };
};
