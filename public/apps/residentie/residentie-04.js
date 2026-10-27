
  /* ---------- deel 4: de gids, het suite-atelier en de start ---------- */
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function toonGids() {
    try {
      const d = await api('/api/residentie/gids', {});
      $('#gidsZalen').innerHTML = d.zalen.map(z =>
        '<button class="ds-veld" data-kamer="' + esc(z.id) + '" data-contextactie>' + DEURICOON + '<span><span class="ds-veld__label">' + esc(z.naam) + '</span><span class="ds-veld__waarde">' + esc(z.sub) + '</span></span>' +
        '<span class="ds-meta">' + z.aanwezig + ' aanwezig</span></button>').join('');
      $('#gidsSuites').innerHTML = d.suites.length ? d.suites.map(s2 =>
        '<button class="ds-veld" data-kamer="' + esc(s2.adres) + '" data-contextactie>' + DEURICOON + '<span><span class="ds-veld__label">' + esc(s2.naam) + '</span><span class="ds-veld__waarde">van ' + esc(s2.van) + ' · ' + s2.meubels + ' meubels</span></span>' +
        '<span class="ds-meta">' + s2.aanwezig + ' aanwezig</span></button>').join('')
        : '<p class="ds-meta">Nog geen open suites; richt de uwe in en zet hem open.</p>';
      laagOpen('#gidsLaag');
      $('#gidsLaag').querySelectorAll('[data-kamer]').forEach(b => b.addEventListener('click', () => {
        laagDicht('#gidsLaag');
        S.editor = null; $('#knopAtelier').classList.remove('aan');
        betreed(b.dataset.kamer);
      }));
    } catch (e) { meld(e.message); }
  }
  $('#knopGids').addEventListener('click', toonGids);
  $('#gidsDicht').addEventListener('click', () => laagDicht('#gidsLaag'));
  /* ESCAPE SLUIT DE BOVENSTE LAAG, via zijn eigen sluitknop, zodat sluiten doet
     wat het altijd deed. De gids, het atelier en de huistelefoon hadden alleen
     die knop; een toetsenbordgebruiker kwam er niet meer uit (gemeten 27
     september 2026). Een LOPEND spel sluit Escape met opzet niet: #spelWeg
     verlaat het potje, en dat hoort een bewuste tik te zijn en geen toets die je
     per ongeluk raakt. De keuze- en uitslagschermen van het spel sluiten wel.
     Een laag is nu een <dialog>: Escape wordt daar een 'cancel' op de bovenste
     laag. Die sluit niet vanzelf, maar drukt dezelfde sluitknop als altijd; een
     uitnodiging (Graag / Nu even niet) blijft dus staan tot er gekozen is. */
  document.querySelectorAll('dialog.laag').forEach(laag => laag.addEventListener('cancel', (e) => {
    e.preventDefault();
    const knop = laag.querySelector('#gidsDicht,#atelierDicht,#belDicht,#spelKeuzeWeg,#paarKeuzeWeg,#kiesWeg,#spelUitslagWeg');
    if (knop && knop.offsetParent !== null) knop.click();
  }));

  /* mijn suite: binnenlopen en het atelier openen */
  async function naarMijnSuite() {
    try {
      const d = await api('/api/residentie/suite', {});
      S.suite = d.suite; S.catalogus = d.catalogus;
      await betreed(d.suite.adres);
    } catch (e) { meld(e.message); }
  }
  $('#knopSuite').addEventListener('click', naarMijnSuite);

  function tekenAtelier() {
    $('#suiteNaam').value = S.suite ? S.suite.naam : '';
    $('#suiteOpen').textContent = S.suite && S.suite.open ? 'Open voor bezoek: ja' : 'Open voor bezoek: nee';
    $('#catalogus').innerHTML = S.catalogus.map(c =>
      '<button class="ds-keuze" type="button" aria-pressed="' + !!(S.editor && S.editor.soort === c.soort) + '" data-soort="' + esc(c.soort) + '" data-contextactie>' + esc(c.naam) +
      '\n<span class="ds-meta">' + c.b + 'x' + c.d + (c.zit ? ' · zitplek' : '') + '</span></button>').join('');
    $('#catalogus').querySelectorAll('[data-soort]').forEach(b => b.addEventListener('click', () => {
      S.editor = { soort: b.dataset.soort };
      $('#atelierWeg').setAttribute('aria-pressed', 'false');
      tekenAtelier();
      meld('Tik op een tegel om "' + b.textContent.split('\n')[0].trim() + '" neer te zetten.');
    }));
  }
  $('#knopAtelier').addEventListener('click', async () => {
    if (!S.suite) { try { const d = await api('/api/residentie/suite', {}); S.suite = d.suite; S.catalogus = d.catalogus; } catch (e) { return meld(e.message); } }
    tekenAtelier();
    laagOpen('#atelierLaag');
  });
  $('#atelierDicht').addEventListener('click', () => { laagDicht('#atelierLaag'); });
  $('#atelierWeg').addEventListener('click', () => {
    S.editor = S.editor && S.editor.weg ? null : { weg: true };
    $('#atelierWeg').setAttribute('aria-pressed', String(!!(S.editor && S.editor.weg)));
    tekenAtelier();
    if (S.editor) { laagDicht('#atelierLaag'); meld('Weghaal-modus: tik op een meubel in de suite.'); }
  });
  $('#suiteNaamZet').addEventListener('click', async () => {
    try { const r = await api('/api/residentie/suite/zet', { naam: $('#suiteNaam').value });
      S.suite.naam = r.suite.naam; if (S.kamer && S.kamer.eigen) { S.kamer.naam = r.suite.naam; $('#kamerNaam').textContent = r.suite.naam; }
      meld('Naam bewaard.'); } catch (e) { meld(e.message); }
  });
  $('#suiteOpen').addEventListener('click', async () => {
    try { const r = await api('/api/residentie/suite/zet', { open: !S.suite.open });
      S.suite.open = r.suite.open; tekenAtelier();
      meld(S.suite.open ? 'De suite staat open voor bezoek.' : 'De suite is nu privé.'); } catch (e) { meld(e.message); }
  });

  // in de eigen suite: een tik zet of verwijdert een meubel (editor-modus)
  async function zetOfWeg(t2) {
    if (!(S.kamer && S.kamer.eigen)) { S.editor = null; return; }
    try {
      if (S.editor.weg) {
        const i = (S.kamer.meubels || []).findIndex(([soort, mx, my]) => {
          const c = S.catalogus.find(k => k.soort === soort);
          return c && t2.x >= mx && t2.x < mx + c.b && t2.y >= my && t2.y < my + c.d;
        });
        if (i < 0) return meld('Daar staat geen meubel.');
        const r = await api('/api/residentie/meubel/weg', { i });
        S.kamer.meubels = r.meubels.map(m => [m.soort, m.x, m.y]);
      } else {
        const r = await api('/api/residentie/meubel/zet', { soort: S.editor.soort, x: t2.x, y: t2.y, idem: RTGIdem('meubel') });
        S.kamer.meubels = r.meubels.map(m => [m.soort, m.x, m.y]);
        if (window.RTGWauw) RTGWauw.tik && RTGWauw.tik();
      }
    } catch (e) { meld(e.message); }
  }

  /* ---------- de start: poort of naar binnen ---------- */
  if (!TOKEN) {
    $('#zaalKop').hidden = true;
    $('#poort').innerHTML = '<div class="ds-canvaslaag__vlak"><h2 class="ds-titel ds-titel--scherm">De Résidence</h2>' +
      '<p class="ds-meta">Het virtuele huis van RTG is er voor leden. Open de app en log in met je RTG-account.</p>' +
      '<a class="ds-knop ds-knop--primair" href="/apps/app.html">Naar de app →</a></div>';
    $('#poort').hidden = false;
  } else {
    const wens = new URLSearchParams(location.search).get('kamer') || 'lobby';
    betreed(wens);
    luister();
    requestAnimationFrame(lus);
  }
  maat();
})();
