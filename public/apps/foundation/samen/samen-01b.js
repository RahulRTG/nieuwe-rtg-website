  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="rsm-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="rsm-go" type="button">Ga mee →</button>' : '') +
      '<button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.rsm-go').addEventListener('click',
      function () { location.href = pad; });
    bannerEl.querySelector('.rsm-x').addEventListener('click', function () {
      bannerEl.remove(); bannerEl = null;
    });
    setTimeout(function () {
      if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    }, 15000);
  }

  /* Rustige poller, zonder querystring of ander browsergeheim te delen. */
  function kijk() {
    if (!kamer) return;
    api('staat', { id: kamer }).then(function (d) {
      var k = d.kamer;
      if (volg >= 0 && k.volg > volg) {
        if (k.pad && k.pad !== location.pathname)
          banner((k.door || 'Iemand') + ' is bij ' +
            (k.titel || 'een andere pagina'), k.pad);
        else if (k.chat.length) {
          var c = k.chat[k.chat.length - 1];
          banner(c.van + ': ' + c.tekst, null);
        }
        if (!sheet.hidden) teken();
      }
      volg = k.volg;
    }).catch(function (e) { if (e.status === 404) zetKamer(null); });
  }
  if (kamer) meldHier();
  setInterval(kijk, 5000);
