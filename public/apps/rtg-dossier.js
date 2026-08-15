/* Het private reisdossier. Status staat altijd als woord en taken van het lid
   blijven gescheiden van zaken die alleen nog bij een partner liggen. */
(function () {
  'use strict';
  var doel = document.getElementById('dossier');
  if (!doel) return;
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) { token = null; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function api(pad, body) {
    return fetch('/api/member/huis/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }
  function lijstje(titel, punten) {
    if (!punten.length) return '';
    return '<div class="mag-kader"><h3>' + esc(titel) + '</h3><ul class="mag-lijstje">' +
      punten.map(function (p) {
        var inhoud = esc(p.wat) + ' <span class="sub">' + esc(p.waarom) + '</span>';
        return '<li>' + (p.waar ? '<a href="' + esc(p.waar) + '">' + inhoud + '</a>' : inhoud) + '</li>';
      }).join('') + '</ul></div>';
  }

  if (!token) {
    doel.innerHTML = '<p class="mag-telling">Log in de RTG-app in; daarna staat uw reisdossier hier compleet: alles wat geboekt is, wat nog niet bevestigd is, en wat er nog moet.</p>';
    return;
  }

  api('dossier').then(function (d) {
    if (!d || !d.ok) throw new Error('geen dossier');
    if (window.RTGUitvoer) RTGUitvoer.bron(function () {
      if (!d.reis || !d.tijdlijn || !d.tijdlijn.length) return null;
      return {
        naam: 'reisdossier',
        kolommen: ['wanneer', 'onderdeel', 'toelichting', 'stand', 'factuur'],
        rijen: d.tijdlijn.map(function (t) {
          return [t.wanneer, t.titel, t.toelichting || '', t.label, t.factuur || ''];
        })
      };
    });
    if (!d.reis) {
      doel.innerHTML = '<p class="mag-telling">' + esc(d.tekst) + '</p>';
      return;
    }
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
        ? '<div class="mag-kader"><h3>Rond</h3><ul class="mag-lijstje"><li>Er staat niets meer open. Deze lijst blijft leeg tot er iets verandert.</li></ul></div>' : '') +
      '<div class="mag-acties"><button class="mag-knop prim" id="dosMap">Neem het dossier mee</button>' +
      '<button class="mag-knop sec" id="dosRahul">Vraag het Rahul</button></div>' +
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
      var knop = document.getElementById('dosRahul');
      var tekst = document.getElementById('dosRahulTekst');
      knop.disabled = true;
      knop.textContent = 'Rahul leest mee…';
      api('rahul').then(function (r) {
        tekst.textContent = (r && r.tekst) || d.tekst;
        tekst.hidden = false;
        knop.remove();
      }).catch(function () {
        knop.disabled = false;
        knop.textContent = 'Vraag het Rahul';
      });
    });
  }).catch(function () {
    doel.innerHTML = '<p class="mag-telling">Het dossier is nu niet op te halen. Uw reis staat er nog; probeer het zo nog eens.</p>';
  });
})();
