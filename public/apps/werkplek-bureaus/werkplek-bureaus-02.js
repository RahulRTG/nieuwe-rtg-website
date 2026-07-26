  /* De plank van dit huis: wat er nu echt in de verkoop staat. */
  function plank(paneel, code) {
    var doel = paneel.querySelector('#bPlank');
    fetch('/api/werkplek/plank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sleutel() },
      body: JSON.stringify({ bedrijf: code })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var p = d.producten || [];
      if (!p.length) {
        doel.innerHTML = d.eigenWinkel
          ? 'De RTG-winkel heeft nog geen concept uit dit lab staan.'
          : 'De plank van de stichting is nog leeg. Wat hier komt te staan, komt niet in de winkel van RTG.';
        return;
      }
      doel.innerHTML = '<div class="uitleg">' + (d.eigenWinkel
        ? 'Dit staat in de RTG-winkel.'
        : 'De eigen plank van de stichting, los van de winkel van RTG.') + '</div>' +
        p.map(function (x) {
          return '<div class="bItem"><div><b>' + esc(x.naam) + '</b> <span class="pil">' + esc(x.disciplineLabel || '') + '</span>' +
            '<div class="uitleg">' + esc(x.beschrijving || '') + '</div></div>' +
            '<div class="acties"><b>&euro; ' + esc(x.eenmalig) + '</b> <span class="uitleg">' + esc(x.eenheid || '') + ', ex btw</span></div></div>';
        }).join('');
    }).catch(function (e) { doel.textContent = e.message; });
  }

  /* Wat er terugkomt verschilt per actie; toon het stuk dat een mens leest en
     val anders terug op een nette bevestiging met de naam van de knop. */
  function uitleg(r, wat) {
    if (r.kritiek) return r.kritiek;
    if (r.redactie) return r.redactie;
    var o = r.ontwerp || {};
    if (o.concept && o.concept.verhaal) return o.concept.verhaal;
    if (r.idee && r.idee.uitwerking) {
      return Object.keys(r.idee.uitwerking).map(function (k) {
        return k + ': ' + r.idee.uitwerking[k];
      }).join('\n\n');
    }
    return (wat || 'Klaar') + ': gereed, het staat bij dit stuk.';
  }

  function melding(paneel, tekst) {
    var u = paneel.querySelector('#bUit');
    if (u) u.textContent = tekst;
  }

  window.RTGWerkplekBureaus = { tegels: tegels };
})();
