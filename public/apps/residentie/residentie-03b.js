
  /* ---------- deel 3b: samen spelen ----------
     De activiteitenzalen hebben een eigen spel per zaal; u daagt iemand in
     de zaal uit, de ander zegt ja, en om de beurt speelt u met de
     timing-meter. Geen ranglijsten -- de uitslag is van het moment. */
  const SPELZAAL = { golf: 'golf', bar: 'darts', kegel: 'kegelen', badhuis: 'zwemmen',
    balzaal: 'dansen', biljart: 'biljart', boog: 'boogschieten', renbaan: 'racen' };
  const SPELWERK = { golf: 'Sla af', darts: 'Gooi', kegelen: 'Rol', zwemmen: 'Zwem',
    dansen: 'Dans', biljart: 'Stoot', boogschieten: 'Schiet', racen: 'Geef gas', pool: 'Stoot' };
  let P = null, meterAan = false, meterWaarde = 0;
  // tikspellen: geen timing-meter maar tikken -- het tempo is de kracht
  const TIK = { zwemmen: 1, racen: 1, dansen: 1 };
  // vrij richten: daar doet de timing-meter niet mee
  const VRIJ = { darts: 1, boogschieten: 1 };
  let gas = null; // { taps, tijden, tot } tijdens een tik-beurt
  let laatsteKracht = 0; // de kracht van de eigen laatste zet, voor de scene

  function kamerKnoppen() {
    // samen spelen kan overal: het zaalspel waar dat er is, de kast altijd
    $('#knopSpel').hidden = !S.kamer;
    $('#knopVraag').hidden = !(S.kamer && (S.kamer.id === 'restaurant' || S.kamer.soort === 'suite'));
    $('#knopPaar').hidden = !S.kamer;
    zetKnopPaar();
    if (P && P.kamerId !== (S.kamer && S.kamer.id)) { P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht(); }
  }

  $('#knopSpel').addEventListener('click', () => {
    if (P) return meld('Er loopt al een potje.');
    const anderen = [...S.leden.values()].filter(l => l.codenaam !== S.ik);
    if (!anderen.length) return meld('U bent hier nog alleen; nodig iemand uit via de gids of uw telefoon.');
    $('#spelKeuze').innerHTML = '<h2>Wie daagt u uit?</h2><div class="sub">' +
      esc((S.kamer && S.kamer.naam) || '') + ' · een potje om elkaar te leren kennen</div>' +
      anderen.map(l => '<button class="rij-item" data-daag="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b></span><span class="tel">daag uit</span></button>').join('') +
      '<button class="knop2 stil2" id="spelKeuzeWeg" type="button" style="margin-top:0.75rem;width:100%;">Toch niet</button>';
    $('#spelLaag').classList.add('open');
    $('#spelKeuzeWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    $('#spelKeuze').querySelectorAll('[data-daag]').forEach(b => b.addEventListener('click', () => kiesSpel(b.dataset.daag)));
  });

  function startPotje(d) {
    P = { spel: d.spel, naam: d.naam, eenheid: d.eenheid, laag: d.laag, samen: d.samen, beurten: d.beurten,
      kamerId: d.kamerId || (S.kamer && S.kamer.id), spelers: d.spelers, aanZet: d.aanZet };
    $('#spelBalk').hidden = false;
    $('#spelPin').parentElement.style.opacity = (TIK[P.spel] || VRIJ[P.spel]) ? '0.25' : '1';
    tekenSpel(); sceneOpen(P.spel);
    if (!meterAan) { meterAan = true; requestAnimationFrame(meterLus); }
  }
  function tekenSpel() {
    if (!P) return;
    // met vier spelers (koppel tegen koppel) tellen we per team
    const st = P.spelers.length === 4
      ? [0, 1].map(t => P.spelers.filter(s2 => s2.team === t).map(s2 => esc(s2.codenaam)).join(' & ') + ' ' +
          P.spelers.filter(s2 => s2.team === t).reduce((a, s2) => a + s2.punten.reduce((x, y) => x + y, 0), 0)).join(' tegen ')
      : P.spelers.map(s2 => esc(s2.codenaam) + ' ' + (s2.punten.length ? s2.punten.reduce((a, b) => a + b, 0) : 0)).join(P.samen ? ' en ' : ' tegen ');
    $('#spelInfo').innerHTML = '<b>' + esc(P.naam) + '</b> · ' + st + ' ' + esc(P.eenheid) +
      '<span style="color:var(--gold);"> · ' + (P.aanZet === S.ik ? 'u bent aan zet' : esc(P.aanZet || '') + ' is aan zet') + '</span>';
    $('#spelDoe').textContent = SPELWERK[P.spel] || 'Speel';
  }
  function meterLus(t) {
    if (!P) { meterAan = false; return; }
    requestAnimationFrame(meterLus);
    meterWaarde = Math.round((Math.sin(t / 260) * 0.5 + 0.5) * 100);
    $('#spelPin').style.left = meterWaarde + '%';
  }
  $('#spelDoe').addEventListener('click', async () => {
    if (!P) return;
    if (P.aanZet !== S.ik) return meld('De ander is aan zet.');
    const sc = SCENES[P.spel];
    if (TIK[P.spel]) { // eerste druk opent het tikvenster, elke tik erna telt
      if (gas) {
        if (gas.rood && performance.now() < gas.rood) { gas.vals = true; return; }
        gas.taps++; gas.tijden.push(performance.now());
        return;
      }
      const cfg = (sc && sc.gasCfg) ? sc.gasCfg() : { rood: 0, duur: 3500 };
      gas = { taps: 0, tijden: [], vals: false,
        rood: cfg.rood ? performance.now() + cfg.rood : 0,
        tot: performance.now() + cfg.rood + cfg.duur };
      setTimeout(gasKlaar, cfg.rood + cfg.duur);
      return;
    }
    if (sc && sc.tik) { // het spel zelf vangt de tik (richten, kracht)
      const kr = sc.tik(meterWaarde);
      if (kr == null) return;
      laatsteKracht = kr;
      try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: kr }), S.ik); }
      catch (e) { meld(e.message); }
      return;
    }
    laatsteKracht = meterWaarde;
    try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: meterWaarde }), S.ik); }
    catch (e) { meld(e.message); }
  });
  function gasKlaar() {
    if (!gas) return;
    const sc = P && SCENES[P.spel];
    const kr = sc && sc.gasScore ? sc.gasScore(gas) : Math.min(100, Math.round(gas.taps * 4.5));
    gas = null; laatsteKracht = kr;
    if (!P) return;
    api('/api/residentie/spel/zet', { kracht: kr }).then(d => verwerkZet(d, S.ik)).catch(e => meld(e.message));
  }
  $('#spelWeg').addEventListener('click', async () => {
    try { await api('/api/residentie/spel/stop', {}); } catch (e) {}
    P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht();
  });

  function verwerkZet(d, wie) {
    if (d.punt != null && wie && P) {
      voegEffect(P.spel, wie, d.punt, d.punt + ' ' + P.eenheid);
      sceneZet(wie, d.punt, (RAAK[P.spel] || (() => true))(d.punt), wie === S.ik ? laatsteKracht : meterWaarde);
    }
    if (d.punt != null && wie) meld(wie === S.ik ? 'U: ' + d.punt + ' ' + (P ? P.eenheid : '') : wie + ': ' + d.punt + ' ' + (P ? P.eenheid : ''));
    if (d.uitslag) {
      const namen = d.uitslag.teams || (P ? P.spelers.map(s2 => s2.codenaam) : ['', '']);
      const w = d.uitslag.winnaar;
      $('#spelKeuze').innerHTML = '<h2>' + (P ? esc(P.naam) : 'Uitslag') + '</h2>' +
        '<div class="sub">' + (d.uitslag.samen
          ? esc(namen[0]) + ' · samen ' + d.uitslag.stand[0] + ' ' + (P ? esc(P.eenheid) : '')
          : esc(namen[0]) + ': ' + d.uitslag.stand[0] + ' · ' + esc(namen[1]) + ': ' + d.uitslag.stand[1]) + '</div>' +
        '<p style="margin:0.5rem 0;font-family:\'Bodoni Moda\',serif;font-size:1.15rem;">' +
        (d.uitslag.samen ? 'Wat een paar. De vloer was van u.'
          : w == null ? 'Gelijkspel; dat vraagt om een revanche.' : esc(namen[w]) + ' wint. Mooi gespeeld, allebei.') + '</p>' +
        '<button class="knop2" id="spelUitslagWeg" type="button" style="width:100%;">Verder</button>';
      $('#spelLaag').classList.add('open');
      $('#spelUitslagWeg').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); sceneDicht(); });
      P = null; $('#spelBalk').hidden = true;
      return;
    }
    if (d.potje) { P.spelers = d.potje.spelers; P.aanZet = d.potje.aanZet; tekenSpel(); }
  }

  function spelSein(d) {
    if (d.kind === 'spel-uitnodiging') {
      $('#spelKeuze').innerHTML = '<h2>Een uitnodiging</h2>' +
        '<div class="sub">' + esc(d.van) + ' vraagt u voor een potje ' + esc(d.naam) + '</div>' +
        '<div style="display:flex;gap:.5rem;margin-top:0.75rem;">' +
        '<button class="knop2 h-flex1" id="spelJa" type="button">Graag</button>' +
        '<button class="knop2 stil2 h-flex1" id="spelNee" type="button">Nu even niet</button></div>';
      $('#spelLaag').classList.add('open');
      $('#spelJa').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { const r = await api('/api/residentie/spel/antwoord', { ja: true }); if (r.potje) startPotje(r.potje); }
        catch (e) { meld(e.message); }
      });
      $('#spelNee').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { await api('/api/residentie/spel/antwoord', { ja: false }); } catch (e) {}
      });
    }
    if (d.kind === 'spel-start') startPotje(d);
    if (d.kind === 'spel-zet' && d.codenaam !== S.ik) verwerkZet(d, d.codenaam);
    if (d.kind === 'spel-afgewezen') meld(d.van + ' slaat het potje even over.');
    if (d.kind === 'spel-gestopt') { P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht(); meld('Het potje is gestopt.'); }
  }
