
  /* ---------- deel 4: de gids, het suite-atelier en de start ---------- */
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function toonGids() {
    try {
      const d = await api('/api/residentie/gids', {});
      $('#gidsZalen').innerHTML = d.zalen.map(z =>
        '<button class="rij-item" data-kamer="' + esc(z.id) + '"><span><b>' + esc(z.naam) + '</b><span class="m">' + esc(z.sub) + '</span></span>' +
        '<span class="tel">' + z.aanwezig + ' aanwezig</span></button>').join('');
      $('#gidsSuites').innerHTML = d.suites.length ? d.suites.map(s2 =>
        '<button class="rij-item" data-kamer="' + esc(s2.adres) + '"><span><b>' + esc(s2.naam) + '</b><span class="m">van ' + esc(s2.van) + ' · ' + s2.meubels + ' meubels</span></span>' +
        '<span class="tel">' + s2.aanwezig + ' aanwezig</span></button>').join('')
        : '<div class="m" style="color:var(--soft);font-size:.78rem;margin-top:0.5rem;">Nog geen open suites; richt de uwe in en zet hem open.</div>';
      $('#gidsLaag').classList.add('open');
      $('#gidsLaag').querySelectorAll('[data-kamer]').forEach(b => b.addEventListener('click', () => {
        $('#gidsLaag').classList.remove('open');
        S.editor = null; $('#knopAtelier').classList.remove('aan');
        betreed(b.dataset.kamer);
      }));
    } catch (e) { meld(e.message); }
  }
  $('#knopGids').addEventListener('click', toonGids);
  $('#gidsDicht').addEventListener('click', () => $('#gidsLaag').classList.remove('open'));

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
      '<button class="cat' + (S.editor && S.editor.soort === c.soort ? ' aan' : '') + '" data-soort="' + esc(c.soort) + '">' + esc(c.naam) +
      '<span style="display:block;color:var(--soft);font-size:.66rem;">' + c.b + 'x' + c.d + (c.zit ? ' · zitplek' : '') + '</span></button>').join('');
    $('#catalogus').querySelectorAll('[data-soort]').forEach(b => b.addEventListener('click', () => {
      S.editor = { soort: b.dataset.soort };
      $('#atelierWeg').classList.remove('aan');
      tekenAtelier();
      meld('Tik op een tegel om "' + b.textContent.split('\n')[0].trim() + '" neer te zetten.');
    }));
  }
  $('#knopAtelier').addEventListener('click', async () => {
    if (!S.suite) { try { const d = await api('/api/residentie/suite', {}); S.suite = d.suite; S.catalogus = d.catalogus; } catch (e) { return meld(e.message); } }
    tekenAtelier();
    $('#atelierLaag').classList.add('open');
  });
  $('#atelierDicht').addEventListener('click', () => { $('#atelierLaag').classList.remove('open'); });
  $('#atelierWeg').addEventListener('click', () => {
    S.editor = S.editor && S.editor.weg ? null : { weg: true };
    $('#atelierWeg').classList.toggle('aan', !!(S.editor && S.editor.weg));
    tekenAtelier();
    if (S.editor) { $('#atelierLaag').classList.remove('open'); meld('Weghaal-modus: tik op een meubel in de suite.'); }
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
        const r = await api('/api/residentie/meubel/zet', { soort: S.editor.soort, x: t2.x, y: t2.y });
        S.kamer.meubels = r.meubels.map(m => [m.soort, m.x, m.y]);
        if (window.RTGWauw) RTGWauw.tik && RTGWauw.tik();
      }
    } catch (e) { meld(e.message); }
  }

  /* ---------- de start: poort of naar binnen ---------- */
  if (!TOKEN) {
    document.querySelector('.kop').style.display = 'none';
    $('#poort').innerHTML = '<div class="inlog"><h2 style="font-family:\'Bodoni Moda\',serif;font-size:1.5rem;">De Résidence</h2>' +
      '<p style="color:var(--muted);margin-top:0.5rem;line-height:1.6;">Het virtuele huis van RTG is er voor leden. Open de app en log in met je RTG-account.</p>' +
      '<p class="h-mt100"><a href="/apps/app.html">Naar de app →</a></p></div>';
  } else {
    const wens = new URLSearchParams(location.search).get('kamer') || 'lobby';
    betreed(wens);
    luister();
    requestAnimationFrame(lus);
  }
  maat();
})();
