
  /* ---------- deel 3k: de spellenkast ----------
     Naast het spel van de zaal staan alle bordspellen van het huis klaar:
     schaken, Woordduel, Magnaat en Proost (18+). Een potje loopt via de
     bestaande speeltafel (spelen.html) op dezelfde spelmotor; de
     uitnodiging komt gewoon hier in het hotel binnen. */
  const KAST = { schaak: 'Schaken', woord: 'Woordduel', magnaat: 'Magnaat', proost: 'Proost (18+)' };
  const KASTNAAM = Object.assign({ seconden: '30 Seconden', mejn: 'Mens erger je niet',
    pesten: 'Pesten', dam: 'Dammen', rummi: 'Rummi', waarheid: 'Doen of Waarheid' }, KAST);

  function kiesSpel(codenaam) {
    const zaalSpel = S.kamer && SPELZAAL[S.kamer.id];
    // sommige zalen hebben een tweede tafel naast het zaalspel
    const tweede = S.kamer && S.kamer.id === 'biljart' ? [['pool', 'Pool', 'de tafel met de zes zakken']] : [];
    $('#spelKeuze').innerHTML = '<h2>' + esc(codenaam) + ' uitdagen</h2>' +
      '<div class="sub">kies waarmee u het ijs breekt</div>' +
      (zaalSpel ? '<button class="rij-item" id="kiesZaal" type="button"><span><b>Het spel van de zaal</b></span><span class="tel">' + esc(zaalSpel) + '</span></button>' : '') +
      tweede.map(([k, n, t2]) => '<button class="rij-item" data-zaal2="' + k + '" type="button"><span><b>' + n + '</b></span><span class="tel">' + t2 + '</span></button>').join('') +
      Object.entries(KAST).map(([k, n]) =>
        '<button class="rij-item" data-kast="' + k + '" type="button"><span><b>' + n + '</b></span><span class="tel">aan de speeltafel</span></button>').join('') +
      '<button class="knop2 stil2" id="kiesWeg" type="button" style="margin-top:.9rem;width:100%;">Toch niet</button>';
    $('#kiesWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    if (zaalSpel) $('#kiesZaal').addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try {
        await api('/api/residentie/spel/daag', { codenaam, spel: zaalSpel });
        meld('Uitnodiging verstuurd; even wachten op ' + codenaam + '.');
      } catch (e) { meld(e.message); }
    });
    $('#spelKeuze').querySelectorAll('[data-zaal2]').forEach(b2 => b2.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try {
        await api('/api/residentie/spel/daag', { codenaam, spel: b2.dataset.zaal2 });
        meld('Uitnodiging verstuurd; even wachten op ' + codenaam + '.');
      } catch (e) { meld(e.message); }
    }));
    $('#spelKeuze').querySelectorAll('[data-kast]').forEach(b2 => b2.addEventListener('click', async () => {
      try {
        const r = await api('/api/member/spel/nieuw', { soort: b2.dataset.kast, codenamen: [codenaam] });
        naarTafel(r.id, KAST[b2.dataset.kast], codenaam);
      } catch (e) { meld(e.message); }
    }));
  }

  // de tafel is gedekt: het potje staat klaar op de speeltafel
  function naarTafel(id, naam, wie) {
    $('#spelKeuze').innerHTML = '<h2>De tafel is gedekt</h2>' +
      '<div class="sub">' + esc(naam) + ' met ' + esc(wie) + ' -- de uitnodiging is onderweg</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2 h-flex1" id="tafelGa" type="button">Naar de speeltafel</button>' +
      '<button class="knop2 stil2 h-flex1" id="tafelHier" type="button">Hier wachten</button></div>';
    $('#spelLaag').classList.add('open');
    $('#tafelGa').addEventListener('click', () => { location.href = '/apps/spelen.html?potje=' + encodeURIComponent(id) + '&pas=rtg'; });
    $('#tafelHier').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
  }

  // een uitnodiging voor de speeltafel komt hier in het hotel binnen; de
  // spelmotor seint ook bij updates van eigen potjes, dus eerst navragen
  // of dit echt een uitnodiging aan u is
  async function bordSein(d) {
    if (!d || !d.potje) return;
    let mijn; try { mijn = await api('/api/member/spel/mijn', {}); } catch (e) { return; }
    const uit = (mijn.uitnodigingen || []).find(u => u.id === d.potje);
    if (!uit) return;
    $('#spelKeuze').innerHTML = '<h2>Een uitnodiging</h2>' +
      '<div class="sub">' + esc(uit.van || 'een lid') + ' vraagt u aan de speeltafel voor een potje ' + esc(uit.naam || KASTNAAM[d.soort] || 'spel') + '</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2 h-flex1" id="bordJa" type="button">Speel mee</button>' +
      '<button class="knop2 stil2 h-flex1" id="bordNee" type="button">Nu even niet</button></div>';
    $('#spelLaag').classList.add('open');
    $('#bordJa').addEventListener('click', async () => {
      try {
        await api('/api/member/spel/antwoord', { id: d.potje, akkoord: true });
        location.href = '/apps/spelen.html?potje=' + encodeURIComponent(d.potje) + '&pas=rtg';
      } catch (e) { meld(e.message); $('#spelLaag').classList.remove('open'); }
    });
    $('#bordNee').addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try { await api('/api/member/spel/antwoord', { id: d.potje, akkoord: false }); } catch (e) {}
    });
  }
