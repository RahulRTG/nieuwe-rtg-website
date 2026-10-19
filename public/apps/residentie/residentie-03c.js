
  /* ---------- deel 3c: de vragen van het huis en de huistelefoon ----------
     Aan tafel (restaurant of suite) stelt het huis een vraag om het gesprek
     op gang te helpen; iedereen aan tafel ziet dezelfde kaart. De telefoon
     in de suite belt een lid dat nu in het huis is en nodigt uit. */
  function toonVraag(v) {
    if (typeof v === 'string') v = { tekst: v };
    const k = $('#vraagKaart'), rahul = v.van === 'rahul';
    k.dataset.van = rahul ? 'rahul' : 'huis';
    k.innerHTML = '<p class="ds-label">' +
      (rahul ? 'Rahul · directeur van het huis' : 'Vraag van het huis') +
      (v.niveau ? ' · ' + esc(v.niveau) : '') + '</p>' +
      (rahul && v.intro ? '<p class="ds-meta">' + esc(v.intro) + '</p>' : '') +
      '<p class="ds-kaart__titel">' + esc(v.tekst) + '</p>';
    k.hidden = false;
    clearTimeout(k._t); k._t = setTimeout(() => { k.hidden = true; }, rahul ? 16000 : 12000);
  }
  $('#knopVraag').addEventListener('click', async () => {
    try { toonVraag(await api('/api/residentie/vraag', {})); }
    catch (e) { meld(e.message); }
  });

  /* de telefoon in de suite: tik erop en nodig iemand uit */
  function telefoonOp(t2) {
    return (S.kamer.meubels || []).some(([soort, mx, my]) => soort === 'telefoon' && t2.x === mx && t2.y === my);
  }
  async function openBel() {
    try {
      const d = await api('/api/residentie/huis', {});
      $('#belLijst').innerHTML = d.leden.length ? d.leden.map(l =>
        '<button class="ds-veld" data-bel="' + esc(l.codenaam) + '">' + RIJICOON + '<span><span class="ds-veld__label">' + esc(l.codenaam) + '</span><span class="ds-veld__waarde">nu in ' + esc(l.kamer) + '</span></span>' +
        '<span class="ds-meta">nodig uit</span></button>').join('')
        : '<p class="ds-meta">Er is nu verder niemand in het huis.</p>';
      laagOpen('#belLaag');
      $('#belLijst').querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', async () => {
        laagDicht('#belLaag');
        try { await api('/api/residentie/bel', { codenaam: b.dataset.bel });
          meld('Uitnodiging verstuurd naar ' + b.dataset.bel + '.'); } catch (e) { meld(e.message); }
      }));
    } catch (e) { meld(e.message); }
  }
  $('#belDicht').addEventListener('click', () => laagDicht('#belLaag'));

  /* er wordt gebeld: iemand nodigt u uit in zijn of haar suite */
  function toonBel(d) {
    $('#spelKeuze').innerHTML = '<h2 class="ds-titel ds-titel--scherm">De telefoon gaat</h2>' +
      '<p class="ds-meta">' + esc(d.van) + ' nodigt u uit in de suite</p>' +
      '<div class="ds-dialoog__acties">' +
      '<button class="ds-knop ds-knop--primair" id="belGa" type="button">Ga erheen</button>' +
      '<button class="ds-knop ds-knop--stil" id="belNiet" type="button">Niet nu</button></div>';
    laagOpen('#spelLaag');
    $('#belGa').addEventListener('click', () => { laagDicht('#spelLaag'); betreed(d.adres); });
    $('#belNiet').addEventListener('click', () => laagDicht('#spelLaag'));
  }
