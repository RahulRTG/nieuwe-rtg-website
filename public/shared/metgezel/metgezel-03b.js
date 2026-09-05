  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="mgz-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="mgz-go" type="button">Ga mee →</button>' : '') +
      '<button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.mgz-go').addEventListener('click', function () { location.href = pad; });
    bannerEl.querySelector('.mgz-x').addEventListener('click', function () { bannerEl.remove(); bannerEl = null; });
    setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 15000);
  }

  // live meeluisteren: een eigen, zuinige SSE-verbinding alleen voor 'samen'
  if (kamerId && window.EventSource) {
    try {
      var bron = new EventSource('/api/stream?token=' + encodeURIComponent(memTok));
      bron.addEventListener('samen', function (e) {
        var d = {}; try { d = JSON.parse(e.data); } catch (x) {}
        if (d.id !== kamerId) return;
        if (d.kind === 'kijk' && d.pad && d.pad !== location.pathname) banner(esc(d.door) + ' is bij ' + (d.titel || 'een andere pagina'), d.pad);
        else if (d.kind === 'chat') { banner(d.van + ': ' + d.tekst, null); if (!sSheet.hidden) teken(true); }
        else if (d.kind === 'erbij') banner(d.codenaam + ' doet mee', null);
        else if (d.kind === 'weg') banner(d.codenaam + ' is weg', null);
      });
      window.addEventListener('beforeunload', function () { try { bron.close(); } catch (e) {} });
    } catch (e) {}
  }
  // bij het openen van een pagina: laat de kamer weten waar je bent
  if (kamerId) meldHier();

  /* Onbeveiligd adres: een keer per sessie eerlijk zeggen wat er dan NIET
     werkt. Buiten https (of localhost) bestaat mediaDevices niet en blokkeert
     de browser de locatie; zestien apps (camera, clips, bellen, scanner,
     paspoortscan, theater, ...) faalden elk met een eigen, vaak misleidende
     melding ("geef toegang") terwijl er niets toe te staan valt. De oorzaak
     is het adres, dus de melding hangt op de laag die op elke app-pagina
     staat, in plaats van in zestien schermen apart. */
  if (!window.isSecureContext) {
    var alGemeld = false;
    try { alGemeld = sessionStorage.getItem('rtg_http_melding') === '1'; } catch (e) {}
    if (!alGemeld) {
      try { sessionStorage.setItem('rtg_http_melding', '1'); } catch (e) {}
      banner('Dit adres is onbeveiligd (http): camera, microfoon en locatie blijven dan uit. Open de app via het beveiligde (https-)adres.', null);
    }
  }
})();
