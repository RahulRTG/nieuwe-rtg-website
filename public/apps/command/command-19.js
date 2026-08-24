/* RTG Command, deel 19: bijstand.

   De tegenhanger is deel 20, de vloot: die toont alle organisaties tot precies
   daar waar de uitnodiging begint, en dit scherm IS die uitnodiging.

   ER STAAT HIER GEEN KNOP DIE EEN SESSIE OPENT. Die bestaat aan deze kant niet,
   en dat is de belofte in zijn zichtbaarste vorm: een klant nodigt uit, RTG
   niet. Wat er wel staat is betreden, kijken, voorstellen, uitvoeren en
   afsluiten -- en bij elke sessie hoe lang hij nog loopt.

   EN DE TELLER "PERMANENTE TOEGANG" STAAT ALTIJD OP NUL. Hij staat er juist
   omdat hij nul is: een nul die je kunt aflezen is meer waard dan een belofte
   die je moet geloven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  var KLEUR = { open: 'onbekend', bezig: 'ok', gesloten: 'geen', ingetrokken: 'geen', verlopen: 'geen' };

  /* ---------------- bijstand ---------------- */
  C.TEKENAARS.bijstand = function (el) {
    el.innerHTML = '<h2 class="ckop">Bijstand</h2>' +
      '<p class="lead">Sessies waarin een organisatie ons binnenlaat: één onderwerp, één niveau, een looptijd ' +
      'en een spoor dat de klant live meeleest. Er is geen knop om er zelf een te openen.</p>' +
      '<div id="bjUit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    api('bijstand', { alles: true, max: 30 }).then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Lopend', d.tel.levend, d.tel.levend ? 'gold' : '', 'sessies die nu openstaan') +
        tegel('Wacht op ons', d.tel.wachtOpRtg, d.tel.wachtOpRtg ? 'acc' : '', 'uitgenodigd, nog niet betreden') +
        tegel('Wacht op de klant', d.tel.wachtOpKlant, '', 'voorstellen zonder besluit') +
        tegel('Permanente toegang', d.tel.permanenteToegang, '', 'en dat blijft nul') +
        '</div>';
      u += '<div class="kaart"><h3>De vier niveaus</h3><ul class="h-keten">' + d.niveaus.map(function (n) {
        return '<li><b>' + esc(n.naam) + '</b> <span class="meta">hooguit ' + n.maxMinuten + ' min' +
          (n.voorafAkkoord ? ' · akkoord vooraf' : '') + '</span><div class="czegt">' + esc(n.wat) + '</div></li>';
      }).join('') + '</ul></div>';
      if (!d.sessies.length) u += '<div class="leeg">Er is geen enkele bijstandssessie geweest.</div>';
      for (var i = 0; i < d.sessies.length; i++) u += sessieKaart(d.sessies[i]);
      C.$('#bjUit').innerHTML = u;
      bind();
    }).catch(function (e) {
      if (!e.stil) C.$('#bjUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  }

  function sessieKaart(s) {
    var loopt = s.status === 'open' || s.status === 'bezig';
    var u = '<div class="kaart"><h3>' + esc(s.id) + ' · ' + esc(s.orgNaam || s.org) + ' ' +
      '<span class="cniveau ' + (KLEUR[s.status] || 'geen') + '">' + esc(s.status) + '</span> ' +
      '<span class="cgraad">' + esc(s.niveau) + '</span></h3>' +
      '<p>' + esc(s.onderwerp) + '</p>' +
      '<p class="meta">Gevraagd ' + esc(C.tijd(s.at)) + ' · tot ' + esc(C.tijd(s.tot)) +
      ' (' + s.minuten + ' min) · ' + (s.medewerker ? esc(s.medewerker) : 'nog niemand van RTG') +
      (s.voorafAkkoord ? ' · akkoord vooraf' : '') + ' · inhoud ' + (s.inhoudOpen ? 'OPEN' : 'dicht') +
      (s.wachtOpAkkoord ? ' · ' + s.wachtOpAkkoord + ' voorstel(len) wachten' : '') + '</p>' +
      '<div class="crij"><button class="knop" data-dos="' + esc(s.id) + '">Dossier</button>';
    if (loopt) {
      if (!s.medewerker) u += '<button class="knop vol" data-bet="' + esc(s.id) + '">Betreden</button>';
      else u += '<button class="knop" data-kijk="' + esc(s.id) + '">Kijken</button>' +
        '<button class="knop" data-voor="' + esc(s.id) + '">Voorstellen</button>' +
        '<button class="knop" data-inh="' + esc(s.id) + '">Inhoud vragen</button>' +
        '<button class="knop weg" data-sluit="' + esc(s.id) + '">Afsluiten</button>';
    }
    return u + '</div><div id="bd-' + esc(s.id) + '"></div></div>';
  }

  function dossier(s) {
    var u = '<div class="h-droog"><b>Handelingen</b>';
    u += s.handelingenLijst.length ? '<ul class="h-keten">' + s.handelingenLijst.map(function (h) {
      return '<li><span class="cniveau ' + (h.status === 'uitgevoerd' ? 'ok' : h.status === 'geweigerd' ? 'mis' : 'onbekend') +
        '">' + esc(h.status) + '</span> <b>' + esc(h.wat) + '</b>' +
        '<div class="meta">' + esc(h.door) + ' · ' + esc(C.tijd(h.at)) +
        (h.besluitDoor ? ' · akkoord: ' + esc(h.besluitDoor) : '') +
        (h.uitslag ? ' · uitslag: ' + esc(h.uitslag) : '') + '</div>' +
        (h.status === 'goedgekeurd' ? '<div class="crij"><button class="knop" data-uit="' + esc(s.id) +
          '" data-i="' + h.index + '">Uitvoeren</button></div>' : '') + '</li>';
    }).join('') + '</ul>' : '<div class="meta">Nog geen.</div>';

    u += '<div class="h-mt50"><b>Inhoud</b> <span class="meta">' +
      (s.inhoud.open ? 'open sinds het akkoord van de organisatie' : 'dicht') + '</span></div>' +
      '<div class="czegt">' + esc(s.inhoud.let) + '</div>' +
      (s.inhoud.verzoek ? '<div class="meta">Gevraagd door ' + esc(s.inhoud.verzoek.door) + ': ' +
        esc(s.inhoud.verzoek.reden) + (s.inhoud.besluitAt ? ' · besloten door ' + esc(s.inhoud.besluitDoor) : ' · nog geen besluit') + '</div>' : '');

    u += '<div class="h-mt50"><b>Spoor</b> <span class="meta">dit leest de organisatie live mee</span></div>' +
      s.spoor.map(function (x) {
        return '<div class="lijn">' + esc(C.tijd(x.at)) + ' · ' + esc(x.wat) + '</div>';
      }).join('');
    if (s.verslag) {
      u += '<div class="h-mt50"><b>Verslag</b> <span class="meta">' + esc(s.verslag.door) + ' · ' +
        s.verslag.duurMinuten + ' min · ' + s.verslag.uitgevoerd + ' uitgevoerd, ' + s.verslag.geweigerd +
        ' geweigerd · inhoud ' + (s.verslag.inhoudGeopend ? 'geopend' : 'dicht gebleven') + '</span></div>' +
        '<p>' + esc(s.verslag.tekst) + '</p>';
    }
    u += '<div id="dg-' + esc(s.id) + '"></div>';
    return u + '</div>';
  }

  function diagnoseBlok(d) {
    var u = '<div class="h-mt50"><b>Diagnose · ' + esc(d.hoofdstuk) + '</b> <span class="meta">' +
      d.hoofdstukken.join(' · ') + '</span></div>';
    if (d.inrichting && d.inrichting.dicht) u += '<div class="czegt">' + esc(d.inrichting.waarom) + '</div>';
    if (d.platform) u += '<div class="meta">' + esc(d.platform.oordeel) + '</div><div class="czegt">' +
      esc(d.platform.let) + '</div>';
    if (d.stand) u += '<div class="meta">' + esc(d.stand.naam || d.stand.bestaatNiet || '') +
      (d.stand.aantallen ? ' · ' + d.stand.aantallen.werkruimtes + ' werkruimtes' : '') + '</div>';
    return u + '<div class="meta"><b>Wat een sessie nooit toont:</b></div><ul class="h-keten">' +
      d.nooit.map(function (n) {
        return '<li>' + esc(n.wat) + '<div class="czegt">' + esc(n.waarom) + '</div></li>';
      }).join('') + '</ul>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v +
      '</div>' + (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  function knoppen(sel, doe) {
    C.$('#bjUit').querySelectorAll(sel).forEach(function (b) { b.onclick = function () { doe(b); }; });
  }
  function na(p) { return p.then(function () { return C.ververs(); }).then(laad)
    .catch(function (e) { if (!e.stil) C.meld(e.message); }); }

  function bind() {
    knoppen('[data-dos]', function (b) {
      var vak = C.$('#bd-' + b.dataset.dos);
      if (vak.innerHTML) { vak.innerHTML = ''; return; }
      api('bijstand/sessie', { id: b.dataset.dos })
        .then(function (d) { vak.innerHTML = dossier(d.sessie); binnenIn(vak, d.sessie.id); })
        .catch(function (e) { if (!e.stil) C.meld(e.message); });
    });
    knoppen('[data-bet]', function (b) { na(api('bijstand/betreed', { id: b.dataset.bet })); });
    knoppen('[data-kijk]', function (b) {
      var wat = prompt('Welk hoofdstuk? stand, inrichting of platform', 'stand');
      if (!wat) return;
      api('bijstand/kijk', { id: b.dataset.kijk, wat: wat }).then(function (d) {
        var vak = C.$('#bd-' + b.dataset.kijk);
        if (!vak.innerHTML) return laad();
        C.$('#dg-' + b.dataset.kijk).innerHTML = diagnoseBlok(d.diagnose);
      }).catch(function (e) { if (!e.stil) C.meld(e.message); });
    });
    knoppen('[data-voor]', function (b) {
      var wat = prompt('Wat stelt u voor? (de organisatie moet dit goedkeuren)');
      if (!wat) return;
      na(api('bijstand/voorstel', { id: b.dataset.voor, wat: wat }));
    });
    knoppen('[data-inh]', function (b) {
      var reden = prompt('Waarom is de inhoud nodig? (de organisatie leest deze reden)');
      if (!reden) return;
      na(api('bijstand/inhoud', { id: b.dataset.inh, reden: reden }));
    });
    knoppen('[data-sluit]', function (b) {
      var v = prompt('Verslag: wat was er, wat is er gedaan, wat was de uitkomst?');
      if (!v) return;
      na(api('bijstand/sluit', { id: b.dataset.sluit, verslag: v }));
    });
  }

  /* De knoppen IN het dossier krijgen hier hun handler: bind() draait voordat
     dat blok bestaat, en een knop zonder handler doet niets en zegt niets. */
  function binnenIn(vak, id) {
    vak.querySelectorAll('[data-uit]').forEach(function (b) {
      b.onclick = function () {
        var uitslag = prompt('Wat was de uitkomst?');
        if (!uitslag) return;
        na(api('bijstand/uitvoeren', { id: id, index: Number(b.dataset.i), uitslag: uitslag }));
      };
    });
  }
})();
