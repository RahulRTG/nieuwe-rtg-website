/* de incidentenkaart: wat er is gemeld, met de laatste vijfentwintig bovenaan */
  function incidentKaart(d) {
    var rijen = (d.incidenten || []).slice(0, 25).map(function (i) {
      return '<div class="item h-boven"><span class="h-rek14">' +
        '<b>' + esc(i.ernst) + '</b> <span class="stil">' + esc(String(i.at).slice(0, 10)) + ' · ' + esc(i.door) +
        (i.plek ? ' · ' + esc(i.plek) : '') + '</span><br>' + esc(i.wat) +
        (i.afhandeling ? '<br><span class="stil">afgehandeld: ' + esc(i.afhandeling) + '</span>' : '') + '</span>' +
        '<span class="rij">' + (i.vertrouwelijk ? '<span class="tag">vertrouwelijk</span>' : '') +
        (i.afgehandeld ? '<span class="tag aan">afgehandeld</span>'
          : '<button class="knop" data-incaf="' + esc(i.id) + '">Handel af</button>') + '</span></div>';
    }).join('') || '<p class="stil">Geen incidenten gemeld.</p>';

    return '<div class="kaart enterprise-breed"><div class="kop">Incidenten</div>' + rijen +
      (d.verborgenUitleg ? '<p class="stil">' + esc(d.verborgenUitleg) + ' (' + d.verborgen + ' verborgen)</p>' : '') +
      '<div class="rij h-mt60">' +
      '<input class="veld" id="vgIncWat" maxlength="600" placeholder="Wat is er gebeurd?" aria-label="Wat is er gebeurd">' +
      '<select class="veld h-kolom9" id="vgIncErnst" aria-label="Ernst">' +
      '<option value="licht">licht</option><option value="ernstig">ernstig</option><option value="zeer ernstig">zeer ernstig</option></select>' +
      '<input class="veld h-kolom9" id="vgIncPlek" maxlength="60" placeholder="Plek" aria-label="Plek">' +
      '<button class="knop p" id="vgInc" type="button">Meld het incident</button></div>' +
      '<label class="stil" style="display:flex;gap:.4rem;align-items:center;min-height:24px;margin-top:.4rem;">' +
      '<input type="checkbox" id="vgIncVert"> Vertrouwelijk: alleen de vertrouwenspersoon en de directie lezen dit mee.</label>' +
      '<p class="stil">Schrijf feitelijk op wat er is gebeurd. Een incident met een kind erin is een dossier over dat kind.</p></div>';
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    var na = function (r, bericht) { meld(r.body.error || bericht); if (!r.body.error) teken(); };

    q('vgSoort').addEventListener('change', function () {
      q('vgLeerling').hidden = this.value !== 'leerling';
      q('vgPersoneel').hidden = this.value !== 'personeel';
      q('vgHouder').hidden = this.value !== 'bezoeker';
    });
    q('vgPas').addEventListener('click', function () {
      var soort = q('vgSoort').value;
      A('/school/pas/geef', sleutels({ soort: soort,
        leerlingId: soort === 'leerling' ? q('vgLeerling').value : undefined,
        personeelId: soort === 'personeel' ? q('vgPersoneel').value : undefined,
        houder: soort === 'bezoeker' ? q('vgHouder').value : undefined }))
        .then(function (r) { na(r, 'Pas uitgegeven.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-passeer]'), function (b) {
      b.addEventListener('click', function () {
        A('/school/pas/passeer', sleutels({ pasId: b.dataset.passeer, richting: b.dataset.richting }))
          .then(function (r) { na(r, r.body.binnen ? 'Binnen.' : 'Buiten.'); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-pasblok]'), function (b) {
      b.addEventListener('click', function () {
        var aan = b.dataset.aan === '1';
        var reden = aan ? 'weer in gebruik' : window.prompt('Waarom wordt deze pas geblokkeerd? (bijvoorbeeld: verloren)');
        if (reden == null) return;
        A('/school/pas/blokkeer', sleutels({ pasId: b.dataset.pasblok, aan: aan, reden: reden }))
          .then(function (r) { na(r, aan ? 'Pas staat weer aan.' : 'Pas geblokkeerd.'); });
      });
    });
    q('vgBez').addEventListener('click', function () {
      if (!q('vgBezNaam').value.trim()) return meld('Vul de naam van de bezoeker in.');
      A('/school/bezoeker/aanmeld', sleutels({ naam: q('vgBezNaam').value, organisatie: q('vgBezOrg').value, voor: q('vgBezVoor').value }))
        .then(function (r) { na(r, 'Bezoeker aangemeld.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bezuit]'), function (b) {
      b.addEventListener('click', function () {
        A('/school/bezoeker/uit', sleutels({ bezoekerId: b.dataset.bezuit })).then(function (r) { na(r, 'Uitgetekend.'); });
      });
    });
    q('vgInc').addEventListener('click', function () {
      if (!q('vgIncWat').value.trim()) return meld('Beschrijf wat er is gebeurd.');
      A('/school/incident/meld', sleutels({ wat: q('vgIncWat').value, ernst: q('vgIncErnst').value,
        plek: q('vgIncPlek').value, vertrouwelijk: q('vgIncVert').checked }))
        .then(function (r) { na(r, 'Incident genoteerd.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-incaf]'), function (b) {
      b.addEventListener('click', function () {
        var hoe = window.prompt('Hoe is het incident afgehandeld?');
        if (hoe == null) return;
        A('/school/incident/handel-af', sleutels({ incidentId: b.dataset.incaf, afhandeling: hoe }))
          .then(function (r) { na(r, 'Afgehandeld.'); });
      });
    });
  }

  return { bind: bind };
})();
