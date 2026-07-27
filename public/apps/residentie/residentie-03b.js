
  /* ---------- deel 3b: samen spelen ----------
     De activiteitenzalen hebben een eigen spel per zaal; u daagt iemand in
     de zaal uit, de ander zegt ja, en om de beurt speelt u met de
     timing-meter. Geen ranglijsten -- de uitslag is van het moment. */
  const SPELZAAL = { golf: 'golf', bar: 'darts', kegel: 'kegelen', badhuis: 'zwemmen',
    balzaal: 'dansen', biljart: 'biljart', boog: 'boogschieten' };
  const SPELWERK = { golf: 'Sla af', darts: 'Gooi', kegelen: 'Rol', zwemmen: 'Zwem',
    dansen: 'Dans', biljart: 'Stoot', boogschieten: 'Schiet' };
  let P = null, meterAan = false, meterWaarde = 0;

  function kamerKnoppen() {
    const spel = S.kamer && SPELZAAL[S.kamer.id];
    $('#knopSpel').hidden = !spel;
    $('#knopVraag').hidden = !(S.kamer && (S.kamer.id === 'restaurant' || S.kamer.soort === 'suite'));
    $('#knopPaar').hidden = !S.kamer;
    zetKnopPaar();
    if (P && P.kamerId !== (S.kamer && S.kamer.id)) { P = null; $('#spelBalk').hidden = true; }
  }

  $('#knopSpel').addEventListener('click', () => {
    if (P) return meld('Er loopt al een potje.');
    const anderen = [...S.leden.values()].filter(l => l.codenaam !== S.ik);
    if (!anderen.length) return meld('U bent hier nog alleen; nodig iemand uit via de gids of uw telefoon.');
    $('#spelKeuze').innerHTML = '<h2>Wie daagt u uit?</h2><div class="sub">' +
      esc((S.kamer && S.kamer.naam) || '') + ' · een potje om elkaar te leren kennen</div>' +
      anderen.map(l => '<button class="rij-item" data-daag="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b></span><span class="tel">daag uit</span></button>').join('') +
      '<button class="knop2 stil2" id="spelKeuzeWeg" type="button" style="margin-top:.9rem;width:100%;">Toch niet</button>';
    $('#spelLaag').classList.add('open');
    $('#spelKeuzeWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    $('#spelKeuze').querySelectorAll('[data-daag]').forEach(b => b.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try { await api('/api/residentie/spel/daag', { codenaam: b.dataset.daag, spel: SPELZAAL[S.kamer.id] });
        meld('Uitnodiging verstuurd; even wachten op ' + b.dataset.daag + '.'); } catch (e) { meld(e.message); }
    }));
  });

  function startPotje(d) {
    P = { spel: d.spel, naam: d.naam, eenheid: d.eenheid, laag: d.laag, samen: d.samen, beurten: d.beurten,
      kamerId: d.kamerId || (S.kamer && S.kamer.id), spelers: d.spelers, aanZet: d.aanZet };
    $('#spelBalk').hidden = false;
    tekenSpel();
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
    try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: meterWaarde }), S.ik); }
    catch (e) { meld(e.message); }
  });
  $('#spelWeg').addEventListener('click', async () => {
    try { await api('/api/residentie/spel/stop', {}); } catch (e) {}
    P = null; $('#spelBalk').hidden = true;
  });

  function verwerkZet(d, wie) {
    if (d.punt != null && wie) meld(wie === S.ik ? 'U: ' + d.punt + ' ' + (P ? P.eenheid : '') : wie + ': ' + d.punt + ' ' + (P ? P.eenheid : ''));
    if (d.uitslag) {
      const namen = d.uitslag.teams || (P ? P.spelers.map(s2 => s2.codenaam) : ['', '']);
      const w = d.uitslag.winnaar;
      $('#spelKeuze').innerHTML = '<h2>' + (P ? esc(P.naam) : 'Uitslag') + '</h2>' +
        '<div class="sub">' + (d.uitslag.samen
          ? esc(namen[0]) + ' · samen ' + d.uitslag.stand[0] + ' ' + (P ? esc(P.eenheid) : '')
          : esc(namen[0]) + ': ' + d.uitslag.stand[0] + ' · ' + esc(namen[1]) + ': ' + d.uitslag.stand[1]) + '</div>' +
        '<p style="margin:.6rem 0;font-family:\'Bodoni Moda\',serif;font-size:1.15rem;">' +
        (d.uitslag.samen ? 'Wat een paar. De vloer was van u.'
          : w == null ? 'Gelijkspel; dat vraagt om een revanche.' : esc(namen[w]) + ' wint. Mooi gespeeld, allebei.') + '</p>' +
        '<button class="knop2" id="spelUitslagWeg" type="button" style="width:100%;">Verder</button>';
      $('#spelLaag').classList.add('open');
      $('#spelUitslagWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
      P = null; $('#spelBalk').hidden = true;
      return;
    }
    if (d.potje) { P.spelers = d.potje.spelers; P.aanZet = d.potje.aanZet; tekenSpel(); }
  }

  function spelSein(d) {
    if (d.kind === 'spel-uitnodiging') {
      $('#spelKeuze').innerHTML = '<h2>Een uitnodiging</h2>' +
        '<div class="sub">' + esc(d.van) + ' vraagt u voor een potje ' + esc(d.naam) + '</div>' +
        '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
        '<button class="knop2" id="spelJa" type="button" style="flex:1;">Graag</button>' +
        '<button class="knop2 stil2" id="spelNee" type="button" style="flex:1;">Nu even niet</button></div>';
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
    if (d.kind === 'spel-gestopt') { P = null; $('#spelBalk').hidden = true; meld('Het potje is gestopt.'); }
  }
