
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
    $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">' + esc(codenaam) + ' uitdagen</h2>' +
      '<p class="ds-meta">kies waarmee u het ijs breekt</p>' +
      (zaalSpel ? '<button class="ds-veld" id="kiesZaal" type="button">' + RIJICOON + '<span><span class="ds-veld__label">Het spel van de zaal</span></span><span class="ds-meta">' + esc(zaalSpel) + '</span></button>' : '') +
      tweede.map(([k, n, t2]) => '<button class="ds-veld" data-zaal2="' + k + '" type="button">' + RIJICOON + '<span><span class="ds-veld__label">' + n + '</span></span><span class="ds-meta">' + t2 + '</span></button>').join('') +
      Object.entries(KAST).map(([k, n]) =>
        '<button class="ds-veld" data-kast="' + k + '" type="button">' + RIJICOON + '<span><span class="ds-veld__label">' + n + '</span></span><span class="ds-meta">aan de speeltafel</span></button>').join('') +
      '<button class="ds-knop ds-knop--stil ds-knop--breed" id="kiesWeg" type="button">Toch niet</button>';
    $('#kiesWeg').addEventListener('click', () => laagDicht('#spelLaag'));
    if (zaalSpel) $('#kiesZaal').addEventListener('click', async () => {
      laagDicht('#spelLaag');
      try {
        await api('/api/residentie/spel/daag', { codenaam, spel: zaalSpel });
        meld('Uitnodiging verstuurd; even wachten op ' + codenaam + '.');
      } catch (e) { meld(e.message); }
    });
    $('#spelKeuze').querySelectorAll('[data-zaal2]').forEach(b2 => b2.addEventListener('click', async () => {
      laagDicht('#spelLaag');
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
    $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">De tafel is gedekt</h2>' +
      '<p class="ds-meta">' + esc(naam) + ' met ' + esc(wie) + ' -- de uitnodiging is onderweg</p>' +
      '<div class="ds-dialoog__acties">' +
      '<button class="ds-knop ds-knop--primair" id="tafelGa" type="button">Naar de speeltafel</button>' +
      '<button class="ds-knop ds-knop--stil" id="tafelHier" type="button">Hier wachten</button></div>';
    laagOpen('#spelLaag');
    $('#tafelGa').addEventListener('click', () => { location.href = '/apps/spelen.html?potje=' + encodeURIComponent(id) + '&pas=rtg'; });
    $('#tafelHier').addEventListener('click', () => laagDicht('#spelLaag'));
  }

  // een uitnodiging voor de speeltafel komt hier in het hotel binnen; de
  // spelmotor seint ook bij updates van eigen potjes, dus eerst navragen
  // of dit echt een uitnodiging aan u is
  async function bordSein(d) {
    if (!d || !d.potje) return;
    let mijn; try { mijn = await api('/api/member/spel/mijn', {}); } catch (e) { return; }
    const uit = (mijn.uitnodigingen || []).find(u => u.id === d.potje);
    if (!uit) return;
    $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">Een uitnodiging</h2>' +
      '<p class="ds-meta">' + esc(uit.van || 'een lid') + ' vraagt u aan de speeltafel voor een potje ' + esc(uit.naam || KASTNAAM[d.soort] || 'spel') + '</p>' +
      '<div class="ds-dialoog__acties">' +
      '<button class="ds-knop ds-knop--primair" id="bordJa" type="button">Speel mee</button>' +
      '<button class="ds-knop ds-knop--stil" id="bordNee" type="button">Nu even niet</button></div>';
    laagOpen('#spelLaag');
    $('#bordJa').addEventListener('click', async () => {
      try {
        await api('/api/member/spel/antwoord', { id: d.potje, akkoord: true });
        location.href = '/apps/spelen.html?potje=' + encodeURIComponent(d.potje) + '&pas=rtg';
      } catch (e) { meld(e.message); laagDicht('#spelLaag'); }
    });
    $('#bordNee').addEventListener('click', async () => {
      laagDicht('#spelLaag');
      try { await api('/api/member/spel/antwoord', { id: d.potje, akkoord: false }); } catch (e) {}
    });
  }
