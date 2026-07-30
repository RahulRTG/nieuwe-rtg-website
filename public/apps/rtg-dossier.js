/* Het reisdossier op blad 02 van Het Huis. Haalt /api/member/huis/dossier op en
   zet het in dezelfde magazinetaal als de rest van de bladen.

   Twee dingen die hier bewust anders zijn dan gebruikelijk:
   - ELKE STAND STAAT ER ALS WOORD, niet alleen als kleur. Een kleurverschil
     leest een deel van de mensen niet; "Wacht op betaling" leest iedereen.
   - WAT AAN U LIGT EN WAT U AFWACHT KRIJGEN EEN EIGEN KOPJE. De server scheidt
     ze al; hier houden we die scheiding vast, want een lijst waarin allebei
     door elkaar staat maakt afwachten per ongeluk een taak. */
(function () {
  'use strict';
  var doel = document.getElementById('dossier');
  if (!doel) return;
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function api(pad, body) {
    return fetch('/api/member/huis/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }
  function lijstje(titel, punten) {
    if (!punten.length) return '';
    return '<div class="mag-kader"><h3>' + esc(titel) + '</h3><ul class="mag-lijstje">' +
      punten.map(function (p) {
        var w = esc(p.wat) + ' <span class="sub">' + esc(p.waarom) + '</span>';
        return '<li>' + (p.waar ? ('<a href="' + esc(p.waar) + '">' + w + '</a>') : w) + '</li>';
      }).join('') + '</ul></div>';
  }

  if (!TOKEN) {
    doel.innerHTML = '<p class="mag-telling">Log in de RTG-app in; daarna staat uw reisdossier hier ' +
      'compleet: alles wat geboekt is, wat nog niet bevestigd is, en wat er nog moet.</p>';
    return;
  }

  api('dossier').then(function (d) {
    if (!d || !d.ok) throw new Error('geen dossier');
    if (!d.reis) { doel.innerHTML = '<p class="mag-telling">' + esc(d.tekst) + '</p>'; return; }
    var deck = document.getElementById('dosDeck');
    if (deck) {
      deck.textContent = d.reis.bestemming + ' · ' + d.reis.datums +
        (d.reis.datumBekend ? '' : ' (de datum staat als tekst bekend)');
    }
    doel.innerHTML =
      '<p class="mag-telling">' + esc(d.tekst) + '</p>' +
      '<div class="mag-dossier">' + d.tijdlijn.map(function (t) {
        return '<div class="regel"><span class="wanneer">' + esc(t.wanneer) + '</span>' +
          '<span><span class="titel">' + esc(t.titel) + '</span>' +
          (t.toelichting ? '<span class="sub">' + esc(t.toelichting) + '</span>' : '') +
          '<span class="stand' + (t.bevestigd ? ' ja' : '') + '">' + esc(t.label) + '</span></span></div>';
      }).join('') + '</div>' +
      lijstje('Wat er nog moet', d.open) +
      lijstje('Wat bij een partner ligt (niets voor u te doen)', d.afwachten) +
      (d.gereed && !d.afwachten.length
        ? '<div class="mag-kader"><h3>Rond</h3><ul class="mag-lijstje"><li>Er staat niets meer open. ' +
          'Deze lijst blijft leeg tot er iets verandert.</li></ul></div>' : '') +
      '<div class="mag-acties">' +
        '<button class="mag-knop prim" id="dosMap">Neem het dossier mee</button>' +
        '<button class="mag-knop sec" id="dosRahul">Vraag het Rahul</button>' +
      '</div>' +
      '<p class="mag-telling" id="dosRahulTekst" hidden></p>' +
      '<p class="paginanr">' + esc(d.bron) + '</p>';

    document.getElementById('dosMap').addEventListener('click', function () {
      api('map').then(function (m) {
        if (!m || !m.tekst) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([m.tekst], { type: 'text/plain;charset=utf-8' }));
        a.download = m.naam || 'reisdossier.txt';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });
    document.getElementById('dosRahul').addEventListener('click', function () {
      var k = document.getElementById('dosRahul'), p = document.getElementById('dosRahulTekst');
      k.disabled = true; k.textContent = 'Rahul leest mee…';
      api('rahul').then(function (r) {
        p.textContent = (r && r.tekst) || d.tekst; p.hidden = false;
        k.remove();
      }).catch(function () { k.disabled = false; k.textContent = 'Vraag het Rahul'; });
    });
  }).catch(function () {
    doel.innerHTML = '<p class="mag-telling">Het dossier is nu niet op te halen. ' +
      'Uw reis staat er nog; probeer het zo nog eens.</p>';
  });
})();
