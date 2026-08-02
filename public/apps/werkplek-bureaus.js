/* De ontwerptak van een huis: het atelier, de ontwerpstudio, het hardwarelab,
   het architectenbureau, de redactie en de ideeenkamer. RTG had ze al achter de
   kantoordeur; de RTFoundation heeft nu dezelfde zes, op eigen werk. Dit scherm
   praat met /api/werkplek/bureau/... en stuurt het huis in elk verzoek mee, dus
   wat u hier ziet is altijd het werk van het huis waar u binnen bent.

   Wordt geladen door werkplek.html en aangeroepen door werkplek.js. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var glyf = function (naam) {
    return (window.RTGGlyf && RTGGlyf.svgHTML) ? RTGGlyf.svgHTML(String(naam || ''), {}) : '';
  };

  /* Wat elk bureau maakt en wat je ermee kunt. "blad" is het technische stuk
     (tech pack, specsheet, stuklijst, bouwstaat); dat werkt ook zonder
     AI-sleutel, want de bureaus vallen dan terug op hun eigen voorbeeldenbank. */
  var B = {
    atelier: { naam: 'Atelier', glyf: 'mode', wat: 'Mode en alles wat u aan het lijf draagt',
      lijst: 'ontwerpen', titel: 'naam', tekst: 'brief', maak: '/maak',
      knop: 'Nieuw ontwerp', blad: ['techpack', 'Tech pack'] },
    studio: { naam: 'Ontwerpstudio', glyf: 'auto', wat: 'Wat u beweegt: auto, boot, jet',
      lijst: 'ontwerpen', titel: 'naam', tekst: 'brief', maak: '/maak',
      knop: 'Nieuw ontwerp', blad: ['specsheet', 'Specsheet'] },
    hardware: { naam: 'Hardwarelab', glyf: 'gear', wat: 'De eigen apparaten en schermen',
      lijst: 'ontwerpen', titel: 'naam', tekst: 'brief', maak: '/maak',
      knop: 'Nieuw apparaat', blad: ['stuklijst', 'Stuklijst'], plank: true },
    architect: { naam: 'Architectenbureau', glyf: 'bouw', wat: 'Het gebouwde: huizen en paviljoens',
      lijst: 'ontwerpen', titel: 'naam', tekst: 'brief', maak: '/maak',
      knop: 'Nieuw project', blad: ['bouwstaat', 'Bouwstaat'] },
    redactie: { naam: 'Redactie', glyf: 'krant', wat: 'De eigen krant; publiceren doet een mens',
      lijst: 'artikelen', titel: 'kop', tekst: 'tekst', maak: '/artikel/maak',
      knop: 'Nieuw artikel', ai: ['/ai/redactie', 'Eindredactie'] },
    ideeen: { naam: 'Ideeenkamer', glyf: 'ontdek', wat: 'De werkbank van alle bureaus samen',
      lijst: 'ideeen', titel: 'titel', tekst: 'brief', maak: '/maak',
      knop: 'Nieuw idee', ai: ['/uitwerken', 'Laat uitwerken'] }
  };
  var VOLGORDE = ['atelier', 'studio', 'hardware', 'architect', 'redactie', 'ideeen'];

  /* De sleutel van dit huis, op EEN plek. De server (routes/werkplek.js) laat
     je binnen op een kantoorsessie of op je eigen RTG-account; dat laatste is er
     juist voor wie geen kantoorsessie heeft. Hier stond 'rtg_token', een naam
     die niemand in het systeem zet -- drie keer overgeschreven, en daarom drie
     keer niet opgevallen. */
  function sleutel() {
    try { return localStorage.getItem('rtg_office_token') || localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; }
  }

  function api(pad, body) {
    var token = sleutel();
    return fetch('/api/werkplek/bureau' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
        return d;
      });
    });
  }

  /* ---- de zes tegels ---- */
  function tegels(vak, code) {
    vak.innerHTML = '<div class="leeg">Laden...</div>';
    fetch('/api/werkplek/bureaus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sleutel() },
      body: JSON.stringify({ bedrijf: code })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var per = {};
      (d.bureaus || []).forEach(function (b) { per[b.bureau] = b.aantal; });
      vak.innerHTML = '<div class="bureaus">' + VOLGORDE.map(function (id) {
        var c = B[id];
        return '<button class="bureau" type="button" data-bureau="' + id + '">' +
          '<div class="kop">' + glyf(c.glyf) + '<b>' + esc(c.naam) + '</b></div>' +
          '<div class="wat">' + esc(c.wat) + '</div>' +
          '<div class="tel">' + (per[id] == null ? '' : per[id] + ' in huis') + '</div>' +
          '</button>';
      }).join('') + '</div><div id="bureauPaneel"></div>';
      Array.prototype.forEach.call(vak.querySelectorAll('[data-bureau]'), function (el) {
        el.addEventListener('click', function () { open(vak.querySelector('#bureauPaneel'), code, el.dataset.bureau); });
      });
    }).catch(function (e) { vak.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  /* ---- een bureau van binnen ---- */
  function open(paneel, code, id) {
    var c = B[id];
    paneel.innerHTML = '<div class="leeg">Laden...</div>';
    api('/' + id, { bedrijf: code }).then(function (d) {
      var items = d[c.lijst] || [];
      paneel.innerHTML =
        '<div class="bureauKop"><h4>' + glyf(c.glyf) + ' ' + esc(c.naam) + '</h4>' +
          '<button class="knop" type="button" id="bDicht">Sluiten</button></div>' +
        '<div class="rij">' +
          '<input class="veld" id="bTitel" placeholder="Naam of kop" maxlength="100" aria-label="Naam">' +
          '<input class="veld" id="bBrief" placeholder="Waar gaat het over?" maxlength="400" aria-label="Omschrijving">' +
          '<button class="knop" type="button" id="bMaak">' + esc(c.knop) + '</button>' +
        '</div>' +
        '<div id="bLijst"></div><div id="bUit" class="leeg"></div>' +
        (c.plank ? '<div class="sec2">Op de plank van dit huis</div><div id="bPlank" class="leeg">Laden...</div>' : '');
      lijst(paneel, code, id, items);
      if (c.plank) plank(paneel, code);
      paneel.querySelector('#bDicht').addEventListener('click', function () { paneel.innerHTML = ''; });
      paneel.querySelector('#bMaak').addEventListener('click', function () {
        var t = paneel.querySelector('#bTitel').value.trim();
        if (!t) return;
        var body = { bedrijf: code };
        body[c.titel] = t;
        body[c.tekst] = paneel.querySelector('#bBrief').value.trim();
        if (id === 'redactie') { body.rubriek = 'nieuws'; body.intro = body.tekst.slice(0, 140); }
        api('/' + id + c.maak, body).then(function () { open(paneel, code, id); })
          .catch(function (e) { melding(paneel, e.message); });
      });
    }).catch(function (e) { paneel.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function lijst(paneel, code, id, items) {
    var c = B[id];
    var doel = paneel.querySelector('#bLijst');
    if (!items.length) { doel.innerHTML = '<div class="leeg">Hier staat nog niets.</div>'; return; }
    doel.innerHTML = items.slice(0, 40).map(function (o) {
      var acties = '';
      if (c.blad) {
        acties += '<button class="knop klein" type="button" data-doe="/concept" data-id="' + esc(o.id) + '">Uitwerken</button>' +
          '<button class="knop klein" type="button" data-doe="/' + c.blad[0] + '" data-id="' + esc(o.id) + '">' + esc(c.blad[1]) + '</button>' +
          '<button class="knop klein" type="button" data-doe="/kritiek" data-id="' + esc(o.id) + '">Kritiek</button>';
      }
      if (c.ai) acties += '<button class="knop klein" type="button" data-doe="' + esc(c.ai[0]) + '" data-id="' + esc(o.id) + '">' + esc(c.ai[1]) + '</button>';
      // het Hardwarelab kan een afgerond concept op de plank van dit huis zetten:
      // bij RTG is dat de echte winkel, bij de stichting haar eigen plank.
      if (c.plank) {
        acties += o.winkel
          ? '<button class="knop klein" type="button" data-af="' + esc(o.id) + '">Van de plank</button>'
          : '<input class="veld prijsveld" type="number" min="1" step="1" data-prijs="' + esc(o.id) + '" ' +
            'placeholder="euro ex btw" aria-label="Prijs voor ' + esc(o.naam || '') + '">' +
            '<button class="knop klein" type="button" data-op="' + esc(o.id) + '">Op de plank</button>';
      }
      return '<div class="bItem"><div><b>' + esc(o[c.titel] || o.naam || o.kop || o.titel) + '</b>' +
        (o.status ? ' <span class="pil">' + esc(o.status) + '</span>' : '') +
        (o.winkel ? ' <span class="pil">op de plank</span>' : '') + '</div>' +
        '<div class="acties">' + acties + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(doel.querySelectorAll('[data-doe]'), function (b) {
      b.addEventListener('click', function () {
        melding(paneel, 'Even geduld...');
        api('/' + id + b.dataset.doe, { bedrijf: code, id: b.dataset.id }).then(function (r) {
          melding(paneel, uitleg(r, b.textContent));
        }).catch(function (e) { melding(paneel, e.message); });
      });
    });
    Array.prototype.forEach.call(doel.querySelectorAll('[data-op]'), function (b) {
      b.addEventListener('click', function () {
        var veld = doel.querySelector('[data-prijs="' + b.dataset.op + '"]');
        var eenmalig = Math.round(Number(veld && veld.value) || 0);
        if (!eenmalig) { melding(paneel, 'Geef eerst een prijs in euro, ex btw.'); return; }
        api('/' + id + '/plank', { bedrijf: code, id: b.dataset.op, prijs: { eenmalig: eenmalig } })
          .then(function () { open(paneel, code, id); })
          .catch(function (e) { melding(paneel, e.message); });
      });
    });
    Array.prototype.forEach.call(doel.querySelectorAll('[data-af]'), function (b) {
      b.addEventListener('click', function () {
        api('/' + id + '/plank-af', { bedrijf: code, id: b.dataset.af })
          .then(function () { open(paneel, code, id); })
          .catch(function (e) { melding(paneel, e.message); });
      });
    });
  }

  /* De plank van dit huis: wat er nu echt in de verkoop staat. */
  function plank(paneel, code) {
    var doel = paneel.querySelector('#bPlank');
    fetch('/api/werkplek/plank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sleutel() },
      body: JSON.stringify({ bedrijf: code })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var p = d.producten || [];
      if (!p.length) {
        doel.innerHTML = d.eigenWinkel
          ? 'De RTG-winkel heeft nog geen concept uit dit lab staan.'
          : 'De plank van de stichting is nog leeg. Wat hier komt te staan, komt niet in de winkel van RTG.';
        return;
      }
      doel.innerHTML = '<div class="uitleg">' + (d.eigenWinkel
        ? 'Dit staat in de RTG-winkel.'
        : 'De eigen plank van de stichting, los van de winkel van RTG.') + '</div>' +
        p.map(function (x) {
          return '<div class="bItem"><div><b>' + esc(x.naam) + '</b> <span class="pil">' + esc(x.disciplineLabel || '') + '</span>' +
            '<div class="uitleg">' + esc(x.beschrijving || '') + '</div></div>' +
            '<div class="acties"><b>&euro; ' + esc(x.eenmalig) + '</b> <span class="uitleg">' + esc(x.eenheid || '') + ', ex btw</span></div></div>';
        }).join('');
    }).catch(function (e) { doel.textContent = e.message; });
  }

  /* Wat er terugkomt verschilt per actie; toon het stuk dat een mens leest en
     val anders terug op een nette bevestiging met de naam van de knop. */
  function uitleg(r, wat) {
    if (r.kritiek) return r.kritiek;
    if (r.redactie) return r.redactie;
    var o = r.ontwerp || {};
    if (o.concept && o.concept.verhaal) return o.concept.verhaal;
    if (r.idee && r.idee.uitwerking) {
      return Object.keys(r.idee.uitwerking).map(function (k) {
        return k + ': ' + r.idee.uitwerking[k];
      }).join('\n\n');
    }
    return (wat || 'Klaar') + ': gereed, het staat bij dit stuk.';
  }

  function melding(paneel, tekst) {
    var u = paneel.querySelector('#bUit');
    if (u) u.textContent = tekst;
  }

  window.RTGWerkplekBureaus = { tegels: tegels };
})();
