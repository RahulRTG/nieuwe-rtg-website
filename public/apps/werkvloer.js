/* De werkvloer op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b): de
   gedeelde bouwstenen van de operatieschermen luchthaven, marechaussee,
   ovdienst, ovroutes en ovcontrol. Geen eigen stijl: alleen klassen uit
   /ds/rtg-ds.css. Geen eigen rechten: de server beslist bij elke aanroep,
   dit script toont alleen wat hij teruggeeft. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };
  var taal = function () { return d.documentElement.lang || 'nl'; };
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function maak(tag, klas, tekst) {
    var e = d.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = tekst;
    return e;
  }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* De melding (role=status) boven de Edge; hij verdwijnt vanzelf. */
  var meldT;
  function zeg(t) {
    var m = $('#melding'); if (!m) return;
    m.textContent = t; m.classList.add('toon');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('toon'); }, 3200);
  }
  /* Bedrag en tijd volgen de taal van de gebruiker, niet vast nl-NL. */
  function eur(c) {
    return new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format((c || 0) / 100);
  }
  function tijd(s) {
    return s ? new Intl.DateTimeFormat(taal(), { hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : 'nog niet';
  }
  function schermtype(t) { d.body.setAttribute('data-ds-schermtype', t); }

  /* Een regel in een werklijst: een stip als er aandacht nodig is, de kop,
     een onderregel, de handelingen eronder en rechts een korte stand. */
  function item(o) {
    return '<li class="ds-lijst__rij"><span>' + (o.aandacht ? '<span class="ds-lijst__stip"></span>' : '') + '</span><span>' +
      '<span class="ds-lijst__titel">' + o.kop + '</span>' +
      (o.meta ? '<span class="ds-lijst__tekst">' + o.meta + '</span>' : '') +
      (o.acties ? '<span class="ds-handelingen">' + o.acties + '</span>' : '') +
      '</span><span class="ds-lijst__tijd">' + (o.stand || '') + '</span></li>';
  }
  function leegRegel(t) { return '<li class="ds-meta">' + esc(t) + '</li>'; }
  function knop(tekst, attrs, primair) {
    return '<button class="ds-knop ds-knop--klein ' + (primair ? 'ds-knop--primair' : 'ds-knop--stil') + '" type="button" ' + (attrs || '') + '>' + tekst + '</button>';
  }
  /* Een kerncijfer als compacte regel: het getal in Bodoni, het label erachter. */
  function cijfer(waarde, label) {
    return '<li class="ds-detail__gegeven"><b class="ds-kaart__titel">' + esc(waarde) + '</b>' + esc(label) + '</li>';
  }
  /* De cockpit: kerncijfers en de keuze van de werkplek, vanaf tabletbreedte
     naast elkaar (.ds-panelen). */
  function cockpit(cijfers, kop, keuzes) {
    return '<div class="ds-panelen ds-panelen--twee"><section class="ds-paneel"><h2 class="ds-kaart__titel">Vandaag</h2>' +
      '<ul class="ds-detail__gegevens" aria-label="Kerncijfers">' + cijfers + '</ul></section>' +
      '<section class="ds-paneel"><h2 class="ds-kaart__titel">' + kop + '</h2>' + keuzes.map(function (k) {
        return '<button class="ds-keuze" type="button" data-rol="' + k[0] + '"><span class="ds-lijst__titel">' + k[1] +
          '</span><span class="ds-meta">' + k[2] + '</span></button>';
      }).join('') + '</section></div>';
  }

  /* Ingebed (een kader of ?embed=1) draagt de ouder de navigatie; dezelfde
     regel als /ds/edge.js voor de kop. */
  function ingebed() {
    try { if (w.self !== w.top) return true; } catch (e) { return true; }
    return /(?:^|[?&])embed=1(?:&|$)/.test(w.location.search || '');
  }
  /* De operatienavigatie van Travel OS (vroeger .tos-opsnav uit
     shared/travel-os.js): dezelfde vier bestemmingen, als chips. */
  var OPS = [['Reiziger', '/apps/ov.html'], ['Chauffeur', '/apps/chauffeur.html'],
    ['Luchthaven', '/apps/luchthaven.html'], ['Regie', '/apps/ovcontrol.html']];
  function opsNav() {
    var nav = $('[data-ds-opsnav]'); if (!nav) return;
    if (ingebed()) { nav.hidden = true; return; }
    OPS.forEach(function (o) {
      var a = maak('a', 'ds-chip', o[0]); a.href = o[1];
      if (o[1] === w.location.pathname) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  }

  /* De deur voor wie er (nog) niet in mag: wat er achter ligt komt uit de
     app-gids (/api/gids/app), de weg naar binnen is de personeelsinlog. Hij
     belooft niets en verleent niets (dezelfde regel als shared/deur.js). */
  function deur(doel, naar) {
    var weg = maak('p', 'ds-status__tekst', 'Deze app werkt met uw personeelsinlog. Ga naar de personeels-app en meld u daar aan; uw werkgever geeft u de code.');
    var gids = maak('div');
    var a = maak('a', 'ds-knop ds-knop--primair ds-status__actie', 'Ga naar de personeels-app');
    a.href = naar || '/apps/personeel.html';
    leeg(doel); doel.append(gids, weg, a);
    fetch('/api/gids/app', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pad: w.location.pathname }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (x) {
        if (!x || !x.gids || !x.gids.wat) return;
        gids.appendChild(maak('h2', 'ds-status__titel', String(x.gids.wat).split(':')[0]));
        gids.appendChild(maak('p', 'ds-status__tekst', x.gids.wat));
      }).catch(function () { /* zonder gids blijft de deur staan zoals hij is */ });
  }

  /* De dienst op dit toestel (luchthaven, marechaussee): een medewerker kiest
     zichzelf uit het rooster en tikt zijn pincode. Het token blijft op dit
     toestel staan; verloopt het, dan valt hij DIRECT terug op de inlog. */
  function dienst(o) {
    var sleutel = 'rtg_werk_' + o.code.toLowerCase();
    var W = { token: null };
    function afgemeld() {
      W.token = null;
      try { localStorage.removeItem(sleutel); } catch (e) {}
      $('#wissel').hidden = true; $('#app').hidden = true; $('#login').hidden = false;
      schermtype('taak');
    }
    W.api = function (pad, body) {
      return fetch(pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, W.token ? { Authorization: 'Bearer ' + W.token } : {}),
        body: JSON.stringify(body || {}) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (x) {
          if (r.status === 401 && W.token) afgemeld();
          if (!r.ok) throw new Error(x.error || 'Er ging iets mis.');
          return x;
        });
      });
    };
    function binnen() {
      $('#login').hidden = true; $('#app').hidden = false; $('#wissel').hidden = false;
      o.start();
    }
    $('#wissel').addEventListener('click', function () { afgemeld(); zeg('Afgemeld; kies wie je bent.'); });
    W.api('/api/supplier/roster', { code: o.code }).then(function (r) {
      $('#wie').innerHTML = (r.staff || []).map(function (m) {
        return '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.func || m.role) + ')</option>';
      }).join('') || '<option value="">' + esc(o.niemand) + '</option>';
    }).catch(function () { $('#wie').innerHTML = '<option value="">' + esc(o.onbereikbaar) + '</option>'; });
    $('#loginGo').addEventListener('click', function () {
      var staffId = $('#wie').value, pin = $('#pin').value.trim();
      if (!staffId || !pin) { zeg('Kies wie je bent en vul je pincode in.'); return; }
      W.api('/api/supplier/login', { code: o.code, staffId: Number(staffId), pin: pin }).then(function (r) {
        W.token = r.token;
        try { localStorage.setItem(sleutel, W.token); } catch (e) {}
        binnen();
      }).catch(function (e) { zeg(e.message); });
    });
    /* De bewaarde dienst van dit toestel: meteen naar binnen. Een tik later,
       zodat het scherm zijn W al in handen heeft als start() draait. */
    try { W.token = localStorage.getItem(sleutel); } catch (e) {}
    if (W.token) Promise.resolve().then(binnen);
    return W;
  }

  /* Het adviesblok: de AI adviseert, schakelen doet de mens. */
  function vraagBlok(hint, uitleg) {
    return '<section class="ds-kaart"><div class="ds-kaart__inhoud"><div class="ds-vraagrij">' +
      '<input class="ds-invoer" id="aiV" aria-label="' + esc(hint) + '" placeholder="' + esc(hint) + '">' +
      '<button class="ds-knop ds-knop--stil ds-knop--klein" id="aiK" type="button">Vraag</button></div>' +
      '<p class="ds-meta" id="aiA" aria-live="polite">' + esc(uitleg) + '</p></div></section>';
  }
  function koppelVraag(api, pad) {
    $('#aiK').addEventListener('click', function () {
      var v = $('#aiV').value.trim(); if (!v) return;
      $('#aiA').textContent = 'Een ogenblik…';
      api(pad, { vraag: v }).then(function (r) { $('#aiA').textContent = r.antwoord; $('#aiV').value = ''; })
        .catch(function (e) { $('#aiA').textContent = e.message; });
    });
    $('#aiV').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#aiK').click(); });
  }

  w.RTGWerk = { $: $, esc: esc, maak: maak, leeg: leeg, zeg: zeg, eur: eur, tijd: tijd, schermtype: schermtype,
    item: item, leegRegel: leegRegel, knop: knop, cijfer: cijfer, cockpit: cockpit, opsNav: opsNav, deur: deur, dienst: dienst,
    vraagBlok: vraagBlok, koppelVraag: koppelVraag, ingebed: ingebed };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', opsNav); else opsNav();
}(window, document));
