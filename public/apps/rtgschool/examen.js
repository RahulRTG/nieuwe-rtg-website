/* RTG School (leden), deel 2: de examentraining en het niveau-advies.
   De training werkt als een echt examen: tien vragen, geen verklikker
   halverwege, de terugblik pas aan het eind. De cijferindicatie is een
   ADVIES; over echte examens beslissen mensen en de officiële instellingen
   (de server zegt dat er zelf eerlijk bij, en dat tonen we altijd). */
(function () {
  'use strict';

  function toonVraag(d) {
    document.getElementById('examenStand').textContent = d.nr + '/' + d.totaal;
    document.getElementById('examenVraag').textContent = d.vraag;
    var oEl = document.getElementById('examenOpties');
    var inEl = document.getElementById('examenIn');
    oEl.innerHTML = '';
    inEl.value = '';
    if (d.opties && d.opties.length) {
      inEl.parentElement.hidden = true;
      oEl.innerHTML = d.opties.map(function (o) { return '<button class="knop stil" data-antw="' + esc(o) + '" type="button">' + esc(o) + '</button>'; }).join('');
    } else {
      inEl.parentElement.hidden = false;
      inEl.focus();
    }
  }

  async function start() {
    var fase = document.getElementById('examenKies').value;
    if (!fase) { meld('Kies eerst de fase waarvoor je traint.'); return; }
    try {
      var d = await api('/api/leerstof/examen', { fase: fase });
      document.getElementById('examenBlok').hidden = false;
      document.getElementById('examenUit').innerHTML = '';
      toonVraag(d);
    } catch (e) { meld(e.message); }
  }

  async function antwoord(antw) {
    try {
      var d = await api('/api/leerstof/examen-antwoord', { antwoord: antw });
      if (!d.klaar) { toonVraag(d); return; }
      document.getElementById('examenBlok').hidden = true;
      var uit = document.getElementById('examenUit');
      uit.innerHTML = '<b>' + d.goed + ' van de ' + d.totaal + ' goed</b>' +
        (d.cijferIndicatie != null ? ' &middot; cijferindicatie ' + esc(String(d.cijferIndicatie)) + ' <span class="pil">advies, geen cijfer</span>' : '') +
        '<div class="h-mt50">' + (d.terugblik || []).map(function (t) {
          return '<div class="doel"><span>' + (t.goed ? '<span class="pil ok">goed</span> ' : '<span class="pil">fout</span> ') +
            esc(t.vraag) + '<br><span style="color:var(--soft);font-size:.78rem;">jouw antwoord: ' + esc(t.jouwAntwoord || '-') +
            (t.goed ? '' : ' &middot; juist: ' + esc(t.juisteAntwoord)) + '</span></span></div>';
        }).join('') + '</div>' +
        (d.advies ? '<p class="eerlijk h-mt60">' + esc(d.advies) + '</p>' : '');
    } catch (e) { meld(e.message); }
  }

  async function advies() {
    var uit = document.getElementById('adviesUit');
    uit.innerHTML = '<span class="leeg">Het advies kijkt mee...</span>';
    try {
      var d = await api('/api/onderwijs/advies');
      /* Wie beslist, staat er met naam bij. "Een mens beslist" is geen adres;
         een kind moet weten bij wie het terecht kan. */
      uit.innerHTML = '<p style="line-height:1.7;">' + esc(d.advies) + '</p>' +
        (d.beslist ? '<p class="leeg">Hierover beslist ' + esc(d.beslist) + '.</p>' : '') +
        (d.doelenTotaal ? '<p class="leeg">' + d.doelenBehaald + ' van de ' + d.doelenTotaal + ' leerdoelen van je fase behaald.</p>' : '') +
        (d.eerlijk ? '<p class="eerlijk h-mt50">' + esc(d.eerlijk) + '</p>' : '');
    } catch (e) { uit.innerHTML = '<span class="leeg">' + esc(e.message) + '</span>'; }
  }

  function bind() {
    document.getElementById('examenStartKnop').addEventListener('click', start);
    document.getElementById('examenStuur').addEventListener('click', function () { antwoord(document.getElementById('examenIn').value); });
    document.getElementById('examenIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') antwoord(this.value); });
    document.getElementById('examenOpties').addEventListener('click', function (e) {
      var b = e.target.closest('[data-antw]');
      if (b) antwoord(b.dataset.antw);
    });
    document.getElementById('adviesKnop').addEventListener('click', advies);
    if (window.RTGSchoolBijles) RTGSchoolBijles.start();
  }

  window.RTGSchoolMeer = { start: bind };
})();
