/* het personeelsdossier: openen met een reden, en wat de school daarvan ziet */
  function dossier(id, reden) {
    A('/school/hr/dossier', sleutels({ personeelId: id, reden: reden })).then(function (r) {
      if (r.body.error) { OPEN = null; return meld(r.body.error); }
      OPEN = { id: id, reden: reden };
      var d = r.body.dossier, c = d.contract;
      var verlof = (d.verlof || []).slice(0, 12).map(function (v) {
        return '<div class="item"><span>' + esc(v.soort) + ' <span class="stil">van ' + esc(v.van) +
          (v.tot ? ' tot ' + esc(v.tot) : ' (loopt)') + (v.toelichting ? ' · ' + esc(v.toelichting) : '') + '</span></span>' +
          (v.soort === 'verlof' && v.status === 'ingediend'
            ? '<span class="rij"><button class="knop p" data-verlof="' + esc(v.id) + '" data-besluit="toegekend">Toekennen</button>' +
              '<button class="knop" data-verlof="' + esc(v.id) + '" data-besluit="afgewezen">Afwijzen</button></span>'
            : '<span class="tag">' + esc(v.status) + '</span>') + '</div>';
      }).join('') || '<p class="stil">Geen verlof of ziekte genoteerd.</p>';
      var gesprekken = (d.gesprekken || []).slice(0, 6).map(function (x) {
        return '<div class="item" style="align-items:flex-start;"><span><b>' + esc(x.soort) + '</b> <span class="stil">' +
          esc(x.op) + ' · ' + esc(x.door) + '</span><br>' + esc(x.besproken) +
          ((x.afspraken || []).length ? '<br><span class="stil">afspraken: ' + esc(x.afspraken.join(' · ')) + '</span>' : '') +
          (x.reactie ? '<br><span class="stil">reactie van de medewerker: ' + esc(x.reactie.tekst) + '</span>' : '') +
          '</span></div>';
      }).join('') || '<p class="stil">Nog geen gesprekken vastgelegd.</p>';

      document.getElementById('hrDossier').innerHTML =
        '<div class="kop" style="margin-top:.8rem;">' + esc(d.naam) + '</div>' +
        '<div class="item"><span>Contract</span><span class="stil">' +
        (c ? esc(c.soort) + ' · ' + c.uren + ' uur' + (c.functie ? ' · ' + esc(c.functie) : '') +
             (c.van ? ' · vanaf ' + esc(c.van) : '') : 'nog niet vastgelegd') + '</span></div>' +
        '<div class="rij" style="margin-top:.4rem;">' +
        '<input class="veld" id="hrCSoort" maxlength="40" placeholder="Soort (onbepaalde tijd)" aria-label="Soort contract">' +
        '<input class="veld" id="hrCUren" type="number" min="0" max="60" placeholder="Uren" aria-label="Uren per week" style="flex:0 1 6rem;">' +
        '<input class="veld" id="hrCFunctie" maxlength="60" placeholder="Functie" aria-label="Functie">' +
        '<input class="veld" id="hrCVan" type="date" aria-label="Vanaf" style="flex:0 1 10rem;">' +
        '<button class="knop" id="hrCZet" type="button">Leg contract vast</button></div>' +
        '<div class="kop" style="margin-top:.8rem;">Bevoegdheden en trainingen</div>' +
        ((d.bevoegdheden || []).concat(d.trainingen || []).length
          ? (d.bevoegdheden || []).map(function (b) {
              return '<div class="item"><span>' + esc(b.wat) + (b.vak ? ' <span class="stil">· ' + esc(b.vak) + '</span>' : '') +
                '</span><span class="stil">' + (b.geldigTot ? 'tot ' + esc(b.geldigTot) : 'geen einddatum') + '</span></div>';
            }).join('') +
            (d.trainingen || []).map(function (t) {
              return '<div class="item"><span>' + esc(t.wat) + ' <span class="stil">· training</span></span>' +
                '<span class="' + (t.afgerond ? 'tag aan' : 'stil') + '">' + (t.afgerond ? 'afgerond' : esc(t.op || 'gepland')) + '</span></div>';
            }).join('')
          : '<p class="stil">Nog niets vastgelegd.</p>') +
        '<div class="rij" style="margin-top:.4rem;">' +
        '<input class="veld" id="hrBev" maxlength="80" placeholder="Bevoegdheid" aria-label="Bevoegdheid">' +
        '<input class="veld" id="hrBevVak" maxlength="40" placeholder="Vak" aria-label="Vak" style="flex:0 1 8rem;">' +
        '<input class="veld" id="hrBevTot" type="date" aria-label="Geldig tot" style="flex:0 1 10rem;">' +
        '<button class="knop" id="hrBevZet" type="button">Erbij</button></div>' +
        '<div class="kop" style="margin-top:.8rem;">Verlof en ziekte</div>' + verlof +
        '<div class="kop" style="margin-top:.8rem;">Gesprekken</div>' + gesprekken +
        '<div class="rij" style="margin-top:.4rem;">' +
        '<input class="veld" id="hrGSoort" maxlength="30" placeholder="Soort gesprek" aria-label="Soort gesprek" style="flex:0 1 12rem;">' +
        '<input class="veld" id="hrGTekst" maxlength="1000" placeholder="Wat is er besproken?" aria-label="Wat is er besproken">' +
        '<button class="knop" id="hrGZet" type="button">Leg vast</button></div>' +
        '<p class="stil">Geen cijfer en geen schaal: wat hier staat zijn afspraken. De medewerker kan er zijn eigen reactie bij zetten.</p>';
      dossierKnoppen(id, reden);
    });
  }

  function dossierKnoppen(id, reden) {
    var q = function (x) { return document.getElementById(x); };
    var na = function (r, bericht) { meld(r.body.error || bericht); if (!r.body.error) dossier(id, reden); };
    q('hrCZet').addEventListener('click', function () {
      A('/school/hr/zet', sleutels({ personeelId: id, reden: reden, contract: {
        soort: q('hrCSoort').value, uren: q('hrCUren').value, functie: q('hrCFunctie').value, van: q('hrCVan').value } }))
        .then(function (r) { na(r, 'Contract vastgelegd.'); });
    });
    q('hrBevZet').addEventListener('click', function () {
      if (!q('hrBev').value.trim()) return meld('Welke bevoegdheid legt u vast?');
      A('/school/hr/zet', sleutels({ personeelId: id, reden: reden, bevoegdheid: q('hrBev').value,
        vak: q('hrBevVak').value, geldigTot: q('hrBevTot').value }))
        .then(function (r) { na(r, 'Bevoegdheid toegevoegd.'); });
    });
    q('hrGZet').addEventListener('click', function () {
      if (!q('hrGTekst').value.trim()) return meld('Noteer wat er is besproken.');
      A('/school/hr/gesprek', sleutels({ personeelId: id, soort: q('hrGSoort').value, besproken: q('hrGTekst').value }))
        .then(function (r) { na(r, 'Gespreksverslag vastgelegd; de medewerker kan er zijn reactie bij zetten.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-verlof]'), function (b) {
      b.addEventListener('click', function () {
        var toe = b.dataset.besluit === 'toegekend';
        var r = window.prompt(toe ? 'Toelichting bij de toekenning (mag leeg):' : 'Waarom wordt dit verlof afgewezen?');
        if (r == null) return;
        A('/school/hr/verlof/besluit', sleutels({ personeelId: id, verlofId: b.dataset.verlof, besluit: b.dataset.besluit, reden: r }))
          .then(function (r2) { na(r2, 'Besluit vastgelegd.'); });
      });
    });
  }

  return { bind: bind };
})();
