/* RTG Media -- de lade: de stuk-hub, het makersprofiel, de bibliotheek en het
   makersbord. Alles wat dieper gaat dan de wereldkaart komt hier binnen, in
   hetzelfde scherm: u verlaat de wereld niet om iets te bekijken.

   De stuk-hub is het hart van het idee. Eén nummer is zelden één ding: er
   hangen korte video's onder die het als geluid gebruiken, ander werk van
   dezelfde maker, en soms een livekanaal. Wat u hier ziet zijn ALLEEN
   verbindingen die echt in de gegevens staan -- de server raadt niets bij
   elkaar, en dat zegt hij er zelf bij. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var M = window.RTGMediaOS;

  function open(bouw) {
    var vlak = $('#ladeVlak');
    vlak.textContent = '';
    vlak.appendChild(M.knop('Sluit', '', dicht));
    bouw(vlak);
    $('#lade').classList.add('open');
    vlak.scrollIntoView({ block: 'start' });
  }
  function dicht() { $('#lade').classList.remove('open'); }
  $('#lade').addEventListener('click', function (e) { if (e.target === $('#lade')) dicht(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dicht(); });

  function rijVan(titel, stukken, vlak) {
    if (!stukken || !stukken.length) return;
    vlak.appendChild(M.el('h2', null, titel));
    var doos = M.el('div', 'stukken');
    stukken.forEach(function (s) { doos.appendChild(M.kaart(s)); });
    vlak.appendChild(doos);
  }

  /* ---- de hub rond één stuk ---- */
  function stuk(id) {
    M.api('stuk', { id: id }).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        var s = d.stuk;
        vlak.appendChild(M.el('div', 'vorm', s.vormNaam));
        vlak.appendChild(M.el('h3', null, s.titel));
        vlak.appendChild(M.el('p', 'stil', s.maker.codenaam + ' · ' + s.meta));
        var rij = M.el('div', 'rij');
        rij.style.display = 'flex'; rij.style.gap = '0.35rem'; rij.style.flexWrap = 'wrap'; rij.style.margin = '0.8rem 0';
        rij.appendChild(M.knop('▶ Speel', 'vol', function () { M.speel(s); }));
        rij.appendChild(M.knop('Naar ' + s.maker.codenaam, '', function () { maker(s.maker.codenaam); }));
        /* In een lijst zetten en delen staan in ./lijst.js; hier alleen de
           twee knoppen, zodat het bij het stuk staat waar u naar kijkt. */
        rij.appendChild(M.knop('In lijst', '', function () { window.RTGMediaLijst.inLijst(s.id); }));
        rij.appendChild(M.knop('Deel', '', function () { window.RTGMediaLijst.deel(s.id); }));
        rij.appendChild(M.knop('Kopieer link', '', function () {
          var url = window.location.origin + '/apps/media.html#stuk=' + encodeURIComponent(s.id);
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { M.zeg('Link gekopieerd.'); },
            function () { M.zeg(url); });
          else M.zeg(url);
        }));
        vlak.appendChild(rij);
        if (s.toelichting) vlak.appendChild(M.el('p', 'stil', s.toelichting));
        if (s.omschrijving) vlak.appendChild(M.el('p', 'stil', s.omschrijving));
        if (d.gebruiktAlsUitleg) {
          vlak.appendChild(M.el('h2', null, 'Onder korte video’s'));
          vlak.appendChild(M.el('p', 'stil', d.gebruiktAlsUitleg));
          if (d.gebruiktAls.length) {
            var doos = M.el('div', 'stukken');
            d.gebruiktAls.forEach(function (x) { doos.appendChild(M.kaart(x)); });
            vlak.appendChild(doos);
          }
        }
        rijVan('Meer muziek van ' + d.maker.codenaam, d.verwant.muziek, vlak);
        rijVan('Video van ' + d.maker.codenaam, d.verwant.video, vlak);
        rijVan('Korte video’s van ' + d.maker.codenaam, d.verwant.flow, vlak);
        rijVan('Live', d.verwant.live, vlak);
        vlak.appendChild(M.el('p', 'stil', d.uitleg));
      });
    });
  }

  /* ---- één maker, alle vormen, één volgknop ---- */
  function maker(codenaam) {
    M.api('maker', { codenaam: codenaam }).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, d.maker.codenaam));
        vlak.appendChild(M.el('p', 'stil', d.aantallen.muziek + ' muziek · ' + d.aantallen.video + ' video · ' +
          d.aantallen.flow + ' korte video’s · ' + d.aantallen.live + ' livekanaal'));
        if (!d.maker.zelf) {
          var rij = M.el('div', 'rij');
          rij.style.display = 'flex'; rij.style.gap = '0.35rem'; rij.style.flexWrap = 'wrap'; rij.style.margin = '0.8rem 0';
          var vb = M.knop(d.volg.aan ? '✓ Volgend' : '+ Volg', d.volg.aan ? 'aan' : 'vol', function () {
            M.api('volg', { codenaam: d.maker.codenaam, aan: !d.volg.aan }).then(function (r) {
              if (r.error) return M.zeg(r.error);
              d.volg.aan = r.volg;
              vb.textContent = d.volg.aan ? '✓ Volgend' : '+ Volg';
              vb.className = 'knop' + (d.volg.aan ? ' aan' : ' vol');
              M.zeg(d.volg.aan ? 'U volgt ' + d.maker.codenaam + ' (' + r.in.join(' en ') + ').' : 'Niet meer gevolgd.');
              M.haal();
            });
          });
          rij.appendChild(vb);
          /* Meldingen per soort: één keer volgen, zelf kiezen waarvoor u
             gewekt wilt worden. Standaard alles, want dat is wat volgen
             betekent -- maar het staat aan knoppen en niet vast.

             LET OP WAT ER HIER STAAT als u de tekst aanpast: de voorkeur wordt
             vastgelegd, maar de Media OS VERSTUURT vandaag nog niets. De knop
             zegt dat ook, met de zin die de server zelf meestuurt. Beloof hier
             geen bezorging die er niet is (regel 6). */
          ['muziek', 'video', 'flow', 'live'].forEach(function (soort) {
            rij.appendChild(M.knop('Meld ' + soort, '', function () {
              M.api('meldingen', { codenaam: d.maker.codenaam, soorten: [soort] }).then(function (r) {
                if (r.error) return M.zeg(r.error);
                M.zeg(r.let || ('Vastgelegd voor ' + d.maker.codenaam + ': ' + r.soorten.join(', ') + '.'));
              });
            }));
          });
          vlak.appendChild(rij);
          if (d.volg.live) vlak.appendChild(M.el('p', 'stil', d.volg.live.let));
        }
        rijVan('Muziek', d.werk.muziek, vlak);
        rijVan('Video', d.werk.video, vlak);
        rijVan('Korte video’s', d.werk.flow, vlak);
        rijVan('Live', d.werk.live, vlak);
      });
    });
  }

  /* ---- de bibliotheek over de vier vormen heen ---- */
  function bieb() {
    M.api('bieb', {}).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'Uw bibliotheek'));
        vlak.appendChild(M.el('p', 'stil', d.uitleg));
        rijVan('Bewaard', d.stukken, vlak);
        if (d.verdwenen.length) {
          vlak.appendChild(M.el('h2', null, 'Niet meer beschikbaar'));
          d.verdwenen.forEach(function (v) {
            vlak.appendChild(M.el('p', 'stil', v.id + ' -- bewaard op ' + String(v.bewaardOp).slice(0, 10)));
          });
        }
      });
    });
  }

  /* ---- het makersbord: wat er echt geteld wordt, en wat niet ---- */
  function bord() {
    M.api('bord', {}).then(function (d) {
      if (d.error) return M.zeg(d.error);
      open(function (vlak) {
        vlak.appendChild(M.el('h3', null, 'Uw makersbord'));
        var w = d.werk;
        var lijst = M.el('div', 'kader');
        lijst.appendChild(M.el('p', null, 'Muziek: ' + w.muziek.stukken + ' uitgaven · ' + w.muziek.mooi +
          ' keer "mooi" · ' + w.muziek.reacties + ' reacties'));
        lijst.appendChild(M.el('p', null, 'Video: ' + w.video.stukken + ' stukken · ' + w.video.reacties +
          ' reacties · kanaal: ' + (w.video.kanaal || '--') + ' (' + w.video.status + ')'));
        lijst.appendChild(M.el('p', null, 'Korte video’s: ' + w.flow.stukken + ' stukken · ' + w.flow.reacties + ' reacties'));
        lijst.appendChild(M.el('p', null, 'Live: ' + (w.live ? w.live.kanaal + (w.live.live ? ' (nu live)' : '') : '--')));
        vlak.appendChild(lijst);

        var rel = M.el('div', 'kader');
        rel.appendChild(M.el('b', null, 'Uw relatie met het publiek'));
        rel.appendChild(M.el('p', null, d.relatie.volgers + ' volgers (' + d.relatie.clipVolgers +
          ' via korte video’s, ' + d.relatie.theaterVolgers + ' via het Theaterkanaal)'));
        rel.appendChild(M.el('p', null, d.geld.podiumAbonnees + ' betalende abonnees · ' +
          (d.geld.podiumVerdiendCenten / 100).toFixed(2) + ' euro verdiend'));
        rel.appendChild(M.el('p', 'stil', d.geld.uitleg));
        vlak.appendChild(rel);

        var niet = M.el('div', 'kader');
        niet.appendChild(M.el('b', null, 'Wat hier NIET staat, en waarom'));
        d.nietGeteld.forEach(function (x) { niet.appendChild(M.el('p', 'stil', x)); });
        niet.appendChild(M.el('p', 'stil', 'Liever geen getal dan een getal dat niets meet: daar stuurt u uw werk op bij.'));
        vlak.appendChild(niet);
      });
    });
  }

  $('#biebKnop').addEventListener('click', bieb);
  $('#bordKnop').addEventListener('click', bord);
  /* `vlak` is dezelfde lade voor ./lijst.js: een tweede overlay ernaast zou
     twee vensters over elkaar geven zodra iemand vanuit een lijst een stuk
     opent. Een lade, een sluitknop. */
  window.RTGMediaBlad = { stuk: stuk, maker: maker, bieb: bieb, bord: bord, dicht: dicht, vlak: open };
})();
