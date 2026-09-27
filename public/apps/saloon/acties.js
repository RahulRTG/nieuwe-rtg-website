(function (w) {
  'use strict';
  function verzoek(pad, body) {
    var token = localStorage.getItem('rtg_member_token');
    return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}) }).then(async function (r) {
      var d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'Dit kon niet worden uitgevoerd.'); return d;
    });
  }
  function dialoog(titel) {
    var d = document.createElement('dialog'); d.className = 'saloon-dialoog';
    var h = document.createElement('h2'); h.id = 'saloonDialoogTitel'; h.textContent = titel;
    d.setAttribute('aria-labelledby', h.id); d.appendChild(h);
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Sluiten'; b.className = 'saloon-sluit';
    b.onclick = function () { d.close(); }; d.appendChild(b);
    var inhoud = document.createElement('div'); d.appendChild(inhoud);
    d.addEventListener('close', function () { d.remove(); }); document.body.appendChild(d); d.showModal();
    return { element: d, inhoud: inhoud };
  }
  function artikel(i) {
    var d = dialoog(i.titel); d.inhoud.textContent = 'Artikel ophalen…';
    verzoek('/api/krant/artikel', i.artikel).then(function (r) {
      var a = r.artikel, esc = w.RTGSaloon.esc;
      d.inhoud.innerHTML = '<p class="saloon-uitleg">' + esc(a.naam) + ' · ' + esc(a.auteur) + '</p><p><b>' + esc(a.chapo) + '</b></p>'
        + String(a.inhoud || '').split(/\n+/).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('')
        + w.RTGPublicatieInfo(a, esc) + '<a href="' + esc(i.url) + '">Open in de krant</a>';
    }).catch(function (e) { d.inhoud.textContent = e.message; });
  }
  function reacties(i, host) {
    var d = dialoog('Gesprek bij dit bericht'), id = i.id.slice('salon:'.length), esc = w.RTGSaloon.esc;
    function laad() {
      return verzoek('/api/salon/reacties', { id: id }).then(function (r) {
        d.inhoud.innerHTML = '<div class="saloon-reacties">' + (r.reacties.length ? r.reacties.map(function (c) {
          return '<p><b>' + esc(c.who) + '</b> ' + esc(c.text) + '</p>' + (c.antwoorden || []).map(function (a) {
            return '<blockquote><b>' + esc(a.who) + '</b> ' + esc(a.text) + '</blockquote>'; }).join('');
        }).join('') : '<p>Nog geen reacties.</p>') + '</div>'
          + (r.magIkReageren ? '<form><label>Uw reactie<textarea name="tekst" maxlength="300" required></textarea></label>'
            + '<button type="submit">Reactie plaatsen</button><p role="status"></p></form>' : '<p>De maker heeft reacties beperkt.</p>');
        var f = d.inhoud.querySelector('form');
        if (f) f.onsubmit = function (e) {
          e.preventDefault(); f.querySelector('button').disabled = true;
          verzoek('/api/salon/reageer', { id: id, tekst: f.elements.tekst.value }).then(function () { laad(); host.laad(); })
            .catch(function (err) { f.querySelector('[role="status"]').textContent = err.message; f.querySelector('button').disabled = false; });
        };
      }).catch(function (e) { d.inhoud.textContent = e.message; });
    }
    laad();
  }
  function maken(host) {
    var d = dialoog('Wat wilt u delen?');
    d.inhoud.innerHTML = '<form class="saloon-composer"><label>Uw bericht<textarea name="tekst" maxlength="600" required placeholder="Deel een verhaal, vraag of plan…"></textarea></label>'
      + '<div class="saloon-velden"><label>Voor wie?<select name="publiek"><option value="contacten">Mijn contacten</option><option value="vrienden">Mijn vrienden</option>'
      + '<option value="volgers">Mijn volgers</option><option value="salon">Saloon, volgens de publicatieregels</option><option value="alleenik">Alleen ik</option></select></label>'
      + '<label>Plaats<input name="plaats" maxlength="60"></label></div><button type="submit">Bericht plaatsen</button><p role="status"></p></form>'
      + '<div class="saloon-werkruimtes"><h3>Uw werkruimte</h3><p>Publiceer en beheer het volledige werk bij de bron.</p>'
      + '<a href="/apps/salon.html">Foto, video of uitgebreider bericht</a><a href="/apps/media.html">Makers · werk, studio en publiek</a>'
      + '<a href="/apps/redactie.html">Journalistiek · schrijven en publiceren</a><a href="/apps/genootschap.html">Community · gesprekken en bijeenkomsten</a>'
      + '<a href="/apps/onderneming.html">Onderneming · aanbod en uitvoering</a></div>';
    var f = d.inhoud.querySelector('form');
    f.onsubmit = function (e) {
      e.preventDefault(); var b = f.querySelector('button'); b.disabled = true;
      verzoek('/api/salon/plaats', { tekst: f.elements.tekst.value, publiek: f.elements.publiek.value, plaats: f.elements.plaats.value })
        .then(function () { d.element.close(); host.laad(); })
        .catch(function (err) { f.querySelector('[role="status"]').textContent = err.message; b.disabled = false; });
    };
  }
  w.RTGSaloonActies = { maken: maken, artikel: artikel, reacties: reacties,
    volgMaker: function (i) { return verzoek('/api/mediaos/volg', { codenaam: i.volgMaker, aan: !i.volgIk }); } };
}(window));
