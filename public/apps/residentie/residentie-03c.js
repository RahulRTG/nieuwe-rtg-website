
  /* ---------- deel 3c: de vragen van het huis en de huistelefoon ----------
     Aan tafel (restaurant of suite) stelt het huis een vraag om het gesprek
     op gang te helpen; iedereen aan tafel ziet dezelfde kaart. De telefoon
     in de suite belt een lid dat nu in het huis is en nodigt uit. */
  function toonVraag(v) {
    if (typeof v === 'string') v = { tekst: v };
    const k = $('#vraagKaart'), rahul = v.van === 'rahul';
    k.classList.toggle('rahul', rahul);
    k.innerHTML = '<div class="ey" style="font-size:.6rem;letter-spacing:.26em;text-transform:uppercase;color:' +
      (rahul ? 'var(--burgundy)' : 'var(--gold)') + ';margin-bottom:.35rem;">' +
      (rahul ? 'Rahul · directeur van het huis' : 'Vraag van het huis') +
      (v.niveau ? ' · ' + esc(v.niveau) : '') + '</div>' +
      (rahul && v.intro ? '<div style="font-size:.74rem;color:var(--soft);margin-bottom:.3rem;">' + esc(v.intro) + '</div>' : '') +
      '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.05rem;line-height:1.4;">' + esc(v.tekst) + '</div>';
    k.classList.add('open');
    clearTimeout(k._t); k._t = setTimeout(() => k.classList.remove('open'), rahul ? 16000 : 12000);
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
        '<button class="rij-item" data-bel="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b><span class="m">nu in ' + esc(l.kamer) + '</span></span>' +
        '<span class="tel">nodig uit</span></button>').join('')
        : '<div class="m" style="color:var(--soft);font-size:.78rem;margin-top:.5rem;">Er is nu verder niemand in het huis.</div>';
      $('#belLaag').classList.add('open');
      $('#belLijst').querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', async () => {
        $('#belLaag').classList.remove('open');
        try { await api('/api/residentie/bel', { codenaam: b.dataset.bel });
          meld('Uitnodiging verstuurd naar ' + b.dataset.bel + '.'); } catch (e) { meld(e.message); }
      }));
    } catch (e) { meld(e.message); }
  }
  $('#belDicht').addEventListener('click', () => $('#belLaag').classList.remove('open'));

  /* er wordt gebeld: iemand nodigt u uit in zijn of haar suite */
  function toonBel(d) {
    $('#spelKeuze').innerHTML = '<h2>De telefoon gaat</h2>' +
      '<div class="sub">' + esc(d.van) + ' nodigt u uit in de suite</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2" id="belGa" type="button" style="flex:1;">Ga erheen</button>' +
      '<button class="knop2 stil2" id="belNiet" type="button" style="flex:1;">Niet nu</button></div>';
    $('#spelLaag').classList.add('open');
    $('#belGa').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); betreed(d.adres); });
    $('#belNiet').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
  }
