/* RTG Command, deel 18: de incidenten -- wat er stuk was, wat eraan is gedaan,
   en wat we nog steeds niet weten.

   DE MACHINE OPENT, EEN MENS SLUIT. "Nakijken" laat de gezondheidskaart een
   ronde wegen; sluiten kan alleen met een verslag, en niet zolang het vermogen
   nog op storing staat -- dan vraagt het scherm om een reden. Een gesloten
   incident boven een lopende storing is een leugen in de historie, en de
   makkelijkste om te vertellen: het scherm wordt er rustiger van.

   EN "WAT NIET GEMETEN IS" STAAT ER GROOT BIJ, als eigen kop en niet in een
   voetnoot. Iedereen wil lezen dat er niets verloren ging, en niemand kan dat
   hier tellen. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  var KLEUR = { 'open': 'mis', 'in behandeling': 'onbekend', 'hersteld': 'ok', 'gesloten': 'geen' };

  C.TEKENAARS.incidenten = function (el) {
    el.innerHTML = '<h2 class="ckop">Incidenten</h2>' +
      '<p class="lead">Een storing met een nummer, een begin, een gemeten omvang en een conclusie. ' +
      'De gezondheidskaart opent ze; sluiten doet u, met een verslag. Een incident dat zichzelf sluit, ' +
      'laat een storing achter waar niemand iets van heeft geleerd.</p>' +
      '<div id="inUit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    api('incidenten', { alles: true, max: 40 }).then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Open', d.tel.open + d.tel.bezig, (d.tel.open + d.tel.bezig) ? 'acc' : '', 'lopend, met of zonder eigenaar') +
        tegel('Wacht op verslag', d.tel.wachtOpVerslag, d.tel.wachtOpVerslag ? 'gold' : '', 'de storing is weg, de les nog niet getrokken') +
        tegel('Zonder eigenaar', d.tel.zonderEigenaar, d.tel.zonderEigenaar ? 'gold' : '', 'niemand kijkt hiernaar') +
        tegel('Gesloten', d.tel.gesloten, '', 'met een verslag afgerond') +
        '</div>' +
        '<div class="crij"><button class="knop vol" id="inWeeg">Nakijken op nieuwe storingen</button>' +
        '<span class="meta">Leest de gezondheidskaart en opent wat er nog geen incident heeft.</span></div>';
      if (!d.incidenten.length) u += '<div class="leeg h-mt60">Er is nog geen incident vastgelegd.</div>';
      for (var i = 0; i < d.incidenten.length; i++) u += rij(d.incidenten[i]);
      C.$('#inUit').innerHTML = u;
      bind();
    }).catch(function (e) {
      if (!e.stil) C.$('#inUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  }

  function rij(i) {
    var u = '<div class="kaart"><h3>' + esc(i.id) + ' · ' + esc(i.naam) + ' ' +
      '<span class="cniveau ' + (KLEUR[i.status] || 'geen') + '">' + esc(i.status) + '</span></h3>' +
      '<p>' + esc(i.wat) + '</p>' +
      '<p class="meta">Begonnen ' + esc(C.tijd(i.begonnen)) +
      (i.hersteldAt ? ' · hersteld ' + esc(C.tijd(i.hersteldAt)) : '') +
      (i.geslotenAt ? ' · gesloten ' + esc(C.tijd(i.geslotenAt)) : '') +
      ' · geopend door ' + esc(i.bron === 'hand' ? 'een mens' : 'de gezondheidskaart') +
      ' · ' + (i.eigenaar ? 'eigenaar ' + esc(i.eigenaar) : 'geen eigenaar') +
      ' · ' + i.maatregelen + ' maatregel(en) · ' + i.aanleidingen + ' aanleiding(en)</p>' +
      '<div class="crij"><button class="knop" data-dos="' + esc(i.id) + '">Dossier</button>';
    if (i.status !== 'gesloten') {
      if (!i.eigenaar) u += '<button class="knop" data-neem="' + esc(i.id) + '">Overnemen</button>';
      u += '<button class="knop" data-maat="' + esc(i.id) + '">Maatregel noteren</button>' +
        '<button class="knop" data-sluit="' + esc(i.id) + '">Sluiten met verslag</button>';
    }
    return u + '</div><div id="dos-' + esc(i.id) + '"></div></div>';
  }

  function dossier(d) {
    var aan = d.bijAanvang.aanleidingen;
    var u = '<div class="h-droog"><b>Bij het ontstaan</b><div class="meta">' +
      esc(d.bijAanvang.impact.let ||
        d.bijAanvang.impact.gemeten.map(function (g) { return g.bron + ': ' + g.zin; }).join(' · ')) + '</div>';
    u += '<div class="h-mt50"><b>Aanleidingen</b> <span class="meta">' + esc(aan.zekerheid) + '</span></div>';
    u += '<ul class="h-keten">' + (aan.lijst.length ? aan.lijst.map(function (a) {
      return '<li><span class="cniveau geen">' + esc(a.soort) + '</span> <b>' + esc(a.bron) + '</b> · ' +
        esc(a.wat) + (a.zegtNiet ? '<div class="czegt">' + esc(a.zegtNiet) + '</div>' : '') + '</li>';
    }).join('') : '<li class="meta">Geen.</li>') + '</ul>' +
      '<div class="czegt">' + esc(aan.let) + '</div>';

    u += '<div class="h-mt50"><b>Wat hierover niet gemeten is</b></div><ul class="h-keten">' +
      d.bijAanvang.impact.nietGemeten.map(function (n) {
        return '<li><b>' + esc(n.wat) + '</b><div class="czegt">' + esc(n.waarom) + '</div></li>';
      }).join('') + '</ul>';

    if (d.maatregelen.length) u += '<div class="h-mt50"><b>Maatregelen</b></div>' + d.maatregelen.map(function (m) {
      return '<div class="lijn">' + esc(C.tijd(m.at)) + ' · ' + esc(m.door) + ' · ' + esc(m.wat) +
        (m.verwijzing ? ' <span class="meta">(' + esc(m.soort) + ' ' + esc(m.verwijzing) + ')</span>' : '') + '</div>';
    }).join('');
    if (d.verslag) {
      u += '<div class="h-mt50"><b>Verslag</b> <span class="meta">door ' + esc(d.verslag.door) + ' · ' +
        d.verslag.duurMinuten + ' min open' +
        (d.verslag.hersteldNaMinuten != null ? ', hersteld na ' + d.verslag.hersteldNaMinuten + ' min' : '') +
        '</span></div><p>' + esc(d.verslag.tekst) + '</p>' +
        (d.verslag.geslotenBovenEenStoring
          ? '<div class="czegt">Gesloten terwijl het vermogen nog op storing stond. Reden: ' +
            esc(d.verslag.reden || '(geen opgegeven)') + '</div>' : '');
    }
    u += '<div class="h-mt50"><b>Nu</b> <span class="meta">' +
      esc(d.nu.mens || d.nu.nietTeLezen || '') + '</span></div>';
    /* De vraag die iedereen bij een storing als eerste stelt. */
    u += '<div class="crij h-mt50"><button class="knop" data-tl="' + esc(d.id) + '" ' +
      'data-moment="' + esc(d.begonnen) + '">Wat veranderde er vlak hiervoor?</button></div>' +
      '<div id="tl-' + esc(d.id) + '"></div>';
    return u + '</div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v +
      '</div>' + (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  function tijdlijnKnop(waarin) {
    waarin.querySelectorAll('[data-tl]').forEach(function (b) {
      b.onclick = function () {
        var vak = waarin.querySelector('#tl-' + b.dataset.tl);
        if (vak.innerHTML) { vak.innerHTML = ''; return; }
        vak.innerHTML = '<div class="leeg">Lezen…</div>';
        api('tijdlijn/rondom', { moment: b.dataset.moment, minuten: 60 })
          .then(function (d) { vak.innerHTML = C.tijdlijnBlok(d); })
          .catch(function (e) { if (!e.stil) vak.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
      };
    });
  }

  function bind() {
    C.$('#inWeeg').onclick = function () {
      this.disabled = true;
      api('incident/weeg').then(function (r) {
        C.meld(r.nieuw.length + ' nieuw, ' + r.hersteld.length + ' hersteld.');
        return C.ververs();
      }).then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
    };
    C.$('#inUit').querySelectorAll('[data-dos]').forEach(function (b) {
      b.onclick = function () {
        var vak = C.$('#dos-' + b.dataset.dos);
        if (vak.innerHTML) { vak.innerHTML = ''; return; }
        api('incident', { id: b.dataset.dos }).then(function (d) {
          vak.innerHTML = dossier(d);
          /* De knoppen IN het dossier krijgen hier hun handler en niet in
             bind(): dat draait vóór dit blok bestaat, dus daar is er niets te
             vinden. Een knop zonder handler doet niets en zegt niets -- dat is
             hoe deze knop de eerste keer stil dood was. */
          tijdlijnKnop(vak);
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    C.$('#inUit').querySelectorAll('[data-neem]').forEach(function (b) {
      b.onclick = function () {
        api('incident/neem', { id: b.dataset.neem }).then(function () { return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    C.$('#inUit').querySelectorAll('[data-maat]').forEach(function (b) {
      b.onclick = function () {
        var wat = prompt('Wat is er gedaan? (verwijs naar een ronde of een controle)');
        if (!wat) return;
        api('incident/maatregel', { id: b.dataset.maat, wat: wat, soort: 'notitie' })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    C.$('#inUit').querySelectorAll('[data-sluit]').forEach(function (b) {
      b.onclick = function () {
        var verslag = prompt('Verslag: wat was er, wat is er gedaan, wat was de uitkomst?');
        if (!verslag) return;
        api('incident/sluit', { id: b.dataset.sluit, verslag: verslag }).then(function () {
          C.meld('Gesloten.'); return C.ververs();
        }).then(laad).catch(function (e) {
          if (e.stil) return;
          /* De weigering is geen fout maar een vraag: het vermogen staat nog op
             storing. Sluiten kan dan wel, maar met een reden -- en die reden
             komt in het verslag te staan. */
          if (e.status !== 409) { C.meld(e.message); return; }
          var reden = prompt(e.message + '\n\nWaarom sluit u hem toch?');
          if (!reden) return;
          api('incident/sluit', { id: b.dataset.sluit, verslag: verslag, toch: true, reden: reden })
            .then(function () { C.meld('Gesloten, met de reden erbij.'); return C.ververs(); })
            .then(laad).catch(function (e2) { if (!e2.stil) C.meld(e2.message); });
        });
      };
    });
  }
})();
