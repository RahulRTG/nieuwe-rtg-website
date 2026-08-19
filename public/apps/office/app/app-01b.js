
  /* ---------- de drive ---------- */
  function laadLijst() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) { zeg(r.body.error || opzet.leeg); return; }
      stand = r.body;
      tekenSjablonen(r.body.sjablonen || []);
      tekenOverzicht();
      tekenLijst();
    });
  }
  /* Meenemen: de drive kent zijn eigen model, dus geeft hij dat door in plaats
     van de gedeelde laag de documentregels te laten lezen -- daar staat
     "Rekenblad · 3 versies" als een stuk tekst, hier staan de velden. Eigen en
     gedeelde documenten samen, met de kolom "van" erbij. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!stand) return null;
    var dag = function (s) { var m = /^\d{4}-\d{2}-\d{2}/.exec(String(s || '')); return m ? m[0] : ''; };
    var rij = function (d, eigen) {
      return [d.titel || '', NAAM_SOORT[d.soort] || 'Document', dag(d.gemaakt), dag(d.gewijzigd),
        d.omvang || '', d.versies || 0, eigen ? 'van mij' : (d.door || 'gedeeld')];
    };
    return { naam: 'documenten',
      kolommen: ['titel', 'soort', 'gemaakt', 'gewijzigd', 'omvang', 'versies', 'van'],
      rijen: (stand.docs || []).map(function (d) { return rij(d, true); })
        .concat((stand.gedeeld || []).map(function (d) { return rij(d, false); })) };
  });
  function tekenSjablonen(lijst) {
    var groepen = {};
    lijst.forEach(function (s) { (groepen[s.groep || 'Algemeen'] = groepen[s.groep || 'Algemeen'] || []).push(s); });
    $('#sjablonen').innerHTML = Object.keys(groepen).sort().map(function (g) {
      return '<div class="sec h-mt80">' + esc(g) + '</div>' +
        groepen[g].map(function (s) {
          return '<button class="sjab" type="button" data-sjab="' + esc(s.id) + '">' + esc(s.titel) + '</button>';
        }).join('');
    }).join('');
    Array.prototype.forEach.call($('#sjablonen').querySelectorAll('[data-sjab]'), function (b) {
      b.addEventListener('click', function () { nieuw(null, b.dataset.sjab); });
    });
  }
  function tekenLijst() {
    if (!stand) return;
    var zoek = $('#zoek').value.trim().toLowerCase();
    var soort = $('#filterSoort').value;
    var fase = $('#filterFase').value;
    var op = $('#sorteer').value;
    var zeef = function (rij) {
      return rij.filter(function (d) {
        var vindbaar = String(d.titel || '') + ' ' + (d.tags || []).join(' ');
        return (!soort || d.soort === soort) && (!fase || (d.fase || 'concept') === fase) &&
          (!zoek || vindbaar.toLowerCase().indexOf(zoek) >= 0);
      }).sort(function (a, b) {
        // gemarkeerde documenten staan altijd bovenaan; daarna de gekozen orde
        if (!!a.ster !== !!b.ster) return a.ster ? -1 : 1;
        if (op === 'titel') return String(a.titel).localeCompare(String(b.titel), 'nl');
        if (op === 'soort') return String(a.soort).localeCompare(String(b.soort)) ||
          String(a.titel).localeCompare(String(b.titel), 'nl');
        if (op === 'gemaakt') return String(b.gemaakt).localeCompare(String(a.gemaakt));
        return String(b.gewijzigd).localeCompare(String(a.gewijzigd));
      });
    };
    $('#mijnDocs').innerHTML = teken(zeef(stand.docs || []), true, zoek);
    $('#gedeeldDocs').innerHTML = teken(zeef(stand.gedeeld || []), false, zoek);
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openen(b.dataset.open); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openen(b.dataset.open); }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ster]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        api('ster', { id: b.dataset.ster, aan: b.dataset.aan !== '1' }).then(function () { laadLijst(); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Dit document verwijderen?')) return;
        api('weg', { id: b.dataset.weg }).then(function (w) {
          if (w.body.error) return zeg(w.body.error);
          zeg('Verwijderd.'); laadLijst();
        });
      });
    });
  }
  function tekenOverzicht() {
    if (!stand) return;
    var alles = (stand.docs || []).concat(stand.gedeeld || []);
    var actief = alles.filter(function (d) { return (d.fase || 'concept') !== 'archief'; }).length;
    var beoordeling = alles.filter(function (d) { return (d.fase || 'concept') === 'beoordeling'; }).length;
    var gedeeld = (stand.gedeeld || []).length + (stand.docs || []).filter(function (d) { return Number(d.gedeeld) > 0; }).length;
    var acties = alles.reduce(function (n, d) { return n + Number(d.openActies || 0); }, 0);
    var vandaag = new Date().toISOString().slice(0, 10);
    var verlopen = alles.filter(function (d) { return d.herzienOp && d.herzienOp < vandaag; }).length;
    $('#officeActief').textContent = actief;
    $('#officeBeoordeling').textContent = beoordeling;
    $('#officeGedeeld').textContent = gedeeld;
    $('#officeActies').textContent = acties;
    $('#officeSamenvatting').textContent = verlopen
      ? verlopen + (verlopen === 1 ? ' document vraagt' : ' documenten vragen') + ' vandaag om herziening.'
      : beoordeling
      ? beoordeling + (beoordeling === 1 ? ' stuk wacht' : ' stukken wachten') + ' op een menselijke beslissing. De rest kan door.'
      : acties ? acties + (acties === 1 ? ' open actie staat' : ' open acties staan') + ' klaar voor opvolging.'
      : actief ? actief + (actief === 1 ? ' actief document' : ' actieve documenten') + '; niets wacht op goedkeuring.'
      : 'Uw rustige werkruimte staat klaar voor het eerste document.';
  }
  function teken(rij, eigen, zoek) {
    if (!rij.length) return '<p class="stil">' + (zoek ? 'Niets gevonden.' : 'Nog niets hier.') + '</p>';
    return rij.map(function (d) {
      return '<div class="doc" data-open="' + d.id + '" role="button" tabindex="0">' +
        '<span class="ic">' + glyf(GLYF_SOORT[d.soort] || 'logboek') + '</span>' +
        '<span class="naam"><b>' + esc(d.titel) + '<span class="office-docmeta">' +
          ((d.classificatie && d.classificatie !== 'intern') ? '<i data-klasse="' + esc(d.classificatie) + '">' + esc(d.classificatie) + '</i>' : '') +
          (d.openActies ? '<i data-actie-open="1">' + d.openActies + ' actie' + (d.openActies === 1 ? '' : 's') + '</i>' : '') +
          '</span></b>' +
          '<small>' + esc(NAAM_SOORT[d.soort] || 'Document') +
          (d.gedeeld ? ' · gedeeld met ' + d.gedeeld : '') +
          (d.versies ? ' · ' + d.versies + ' versies' : '') +
          (d.laatstDoor && d.laatstDoor !== d.door ? ' · laatst door ' + esc(d.laatstDoor) : '') + '</small></span>' +
        '<span class="kol office-omvang">' + esc(d.omvang || '') + '</span>' +
        '<span class="office-status" data-fase="' + esc(d.fase || 'concept') + '">' + esc(FASE_NAAM[d.fase || 'concept']) + '</span>' +
        '<span class="kol van office-wie">' + (eigen ? datum(d.gewijzigd) : esc(d.door)) + '</span>' +
        '<span class="acties">' + (eigen
          ? '<button class="mini ster' + (d.ster ? ' aan' : '') + '" data-ster="' + d.id + '" data-aan="' + (d.ster ? '1' : '0') +
            '" title="Markeren" aria-label="Markeren">' + (d.ster ? '★' : '☆') + '</button>' +
            '<button class="mini weg" data-weg="' + d.id + '">weg</button>'
          : '') + '</span></div>';
    }).join('');
  }
  function datum(s) {
    try {
      var d = new Date(s), nu = new Date();
      var zelfde = d.toDateString() === nu.toDateString();
      return zelfde ? 'vandaag ' + d.toLocaleTimeString('nl-NL').slice(0, 5) : d.toLocaleDateString('nl-NL');
    } catch (e) { return ''; }
  }
  ['#zoek', '#filterSoort', '#filterFase', '#sorteer'].forEach(function (s) {
    $(s).addEventListener('input', tekenLijst); $(s).addEventListener('change', tekenLijst);
  });

  function nieuw(soort, sjabloon) {
    api('maak', sjabloon ? { sjabloon: sjabloon } : { soort: soort }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      openen(r.body.id);
    });
  }
  $('#nieuwTekst').addEventListener('click', function () { nieuw('tekst'); });
  $('#nieuwBlad').addEventListener('click', function () { nieuw('blad'); });
  $('#nieuwPres').addEventListener('click', function () { nieuw('presentatie'); });
  $('#nieuwFormulier').addEventListener('click', function () { nieuw('formulier'); });
  $('#nieuwSchets').addEventListener('click', function () { nieuw('schets'); });
  $('#nieuwBord').addEventListener('click', function () { nieuw('bord'); });
