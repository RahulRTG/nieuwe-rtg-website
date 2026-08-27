/* HET SCHERM VAN DE UITVOERENDE MEDIA -- HOE EEN UITSLAG ERUITZIET.

   Gesplitst van ./uitvoering.js toen dat bestand over de 10 kB-grens van de
   keuring ging, en de naad loopt waar hij hoort: daar staat wat er GEBEURT (een
   uitvoering vragen, een partituur maken), hier hoe een uitslag ERUITZIET.

   TWEE DINGEN DIE HIER NIET MOGEN SNEUVELEN.

   Het BEWIJS staat even groot als de montage zelf en niet in de kleine
   lettertjes: een uitvoering is een bewering van RTG over andermans werk
   (UITVOEREND.md par. 2.4). Alles in dat blok komt uit het antwoord van de
   server; dit bestand telt niets zelf op, want dan zeggen twee lagen op een dag
   iets anders over dezelfde montage (BESTUUR.md).

   En een WEIGERING is een uitslag en geen foutmelding. Wie om 30 seconden vraagt
   van een werk waarvan de kern er 60 duurt, leest hoe lang die kern is.

   Het werkwoord van een handeling komt van de SERVER (`wat`). Een scherm dat
   zelf tussen "bekijk" en "koop" mag kiezen, kiest op een dag "koop"
   (GELD.md par. 3). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var el = window.RTGUitvoeringEl;
  var sec = window.RTGUitvoeringSec;
  var api = window.RTGUitvoeringApi;
  var zeg = window.RTGUitvoeringZeg;

  function toonWeigering(b) {
    var v = $('#uitslag'); v.hidden = false; v.innerHTML = '';
    v.appendChild(el('h2', null, 'Dat kan niet, en dit is waarom'));
    var w = el('div', 'weiger');
    w.appendChild(el('b', null, b.reden || 'Deze uitvoering kon niet worden samengesteld.'));
    v.appendChild(w);
    var g = b.bewijs || {};
    if (g.kernS != null) {
      var d = el('p', 'stil');
      d.textContent = 'Het onmisbare deel duurt ' + sec(g.kernS) + '; het hele werk ' + sec(g.totaalS) + '.';
      v.appendChild(d);
    }
    if (g.toestemming && !g.toestemming.inkorten) {
      v.appendChild(el('p', 'stil', 'De maker staat inkorten niet toe: dit werk bestaat alleen in zijn geheel.'));
    }
  }

  function toonUitvoering(b) {
    var v = $('#uitslag'); v.hidden = false; v.innerHTML = '';
    v.appendChild(el('h2', null, (b.partituur && b.partituur.naam) || 'Uitvoering'));
    v.appendChild(el('p', 'stil', b.uitleg || ''));

    var ol = el('ol');
    (b.uitvoering || []).forEach(function (r) {
      var li = el('li', 'regel');
      if (r.rol === 'kern') li.appendChild(el('div', 'kern', 'kern'));
      li.appendChild(el('b', null, r.titel || r.stukId));
      li.appendChild(el('div', 'stil', r.vormNaam + ' · ' + sec(r.van) + '-' + sec(r.tot) + ' (' + sec(r.duurS) + ')'));
      li.appendChild(el('div', 'waarom', r.waarom || ''));
      if (r.handeling) li.appendChild(handelingKaart(r.handeling));
      ol.appendChild(li);
    });
    v.appendChild(ol);

    /* HET BEWIJS. Alles hieronder komt uit het antwoord van de server; er wordt
       op dit scherm niets bij elkaar geteld. Zou dat wel gebeuren, dan zeggen
       twee lagen op een dag iets anders over dezelfde montage (BESTUUR.md). */
    var g = b.bewijs || {};
    var bw = el('div', 'bewijs');
    bw.appendChild(el('h3', null, 'Waaruit dit bestaat'));
    var dl = el('dl');
    var voegToe = function (naam, waarde) {
      dl.appendChild(el('dt', null, naam)); dl.appendChild(el('dd', null, waarde));
    };
    voegToe('U vroeg', (g.gevraagd && g.gevraagd.secondenBudget ? sec(g.gevraagd.secondenBudget) : 'het hele werk')
      + ' · diepte ' + ((g.gevraagd && g.gevraagd.diepte) || 3));
    voegToe('U krijgt', sec(g.gekozenS) + ' van ' + sec(g.totaalS));
    voegToe('Onmisbaar', sec(g.kernS));
    if (g.aanspraak) voegToe('Uw recht', g.aanspraak.herkomstNaam || g.aanspraak.herkomst);
    voegToe('De maker staat toe', [g.toestemming && g.toestemming.inkorten ? 'inkorten' : null,
      g.toestemming && g.toestemming.hermonteren ? 'hermonteren' : null]
      .filter(Boolean).join(' en ') || 'niets; alleen het hele werk');
    bw.appendChild(dl);

    (g.weggelaten || []).forEach(function (w) {
      bw.appendChild(el('p', 'weg', '· ' + (w.naam || w.fragmentId) + ' -- ' + w.reden));
    });
    (g.nietBeschikbaar || []).forEach(function (w) {
      bw.appendChild(el('p', 'weg', '· ' + (w.naam || w.fragmentId) + ' -- ' + w.reden));
    });
    if (g.herleidbaar) bw.appendChild(el('p', 'weg', g.herleidbaar));
    v.appendChild(bw);
  }

  /* WAT EEN STUK KAN DOEN. De kaart komt van de server en dit scherm kiest het
     werkwoord NIET zelf: `wat` staat in de kaart. Een scherm dat zelf mag kiezen
     tussen "bekijk" en "koop", kiest op een dag "koop" (GELD.md par. 3).

     Een gesloten handeling krijgt geen knop maar de reden. Een dode knop is
     erger dan geen knop, en een knop die stil niets doet is het ergst. */
  function handelingKaart(h) {
    var k = el('div', 'handeling');
    if (!h.open) {
      k.appendChild(el('span', 'stil', (h.label ? h.label + ': ' : '') + (h.reden || 'Dit is nu niet beschikbaar.')));
      return k;
    }
    if (h.soort === 'aanbod') {
      var b = el('button', 'knop', h.label + ' - ' + (h.centen / 100).toFixed(2) + ' euro');
      b.type = 'button';
      b.onclick = function () {
        /* KLAARZETTEN. Deze knop haalt de BON op en koopt niets. De koopweg
           loopt over een eigen scherm, met de bon ervoor; hier eindigt het. */
        api('/api/uitvoering/bon', { partituurId: h.partituurId }).then(function (r) {
          if (r.body && r.body.error) { zeg(r.body.error); return; }
          var v = el('div', 'bewijs');
          v.appendChild(el('h3', null, 'Wat dit kost'));
          v.appendChild(el('p', 'stil', r.body.let || ''));
          v.appendChild(el('p', 'weg', r.body.krijgt || ''));
          v.appendChild(el('p', 'weg', r.body.nietGebouwd || ''));
          k.appendChild(v);
          b.disabled = true;
        });
      };
      k.appendChild(b);
      k.appendChild(el('span', 'stil', ' ' + (h.let || '')));
      return k;
    }
    var a = el('a', 'knop', h.label + ' openen');
    a.href = '/apps/media.html';
    k.appendChild(a);
    return k;
  }

  window.RTGUitvoeringToon = { uitvoering: toonUitvoering, weigering: toonWeigering };
})();
