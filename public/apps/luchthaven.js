/* RTG Airport op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b).
   Dezelfde kern als ervoor: /api/supplier/roster en /login met de code
   LUCHT, /api/lucht/* met het werktoken. Dit bestand draagt de inlog, de
   cockpit, de werkplekkeuze en security; vluchtleiding, platform en toren
   staan in luchthaven-bord.js, bagage, vip en de lounges in
   luchthaven-loket.js. */
(function (w) {
  'use strict';
  var R = w.RTGWerk, $ = R.$, esc = R.esc, item = R.item, knop = R.knop;
  var meld = R.zeg;

  /* Meenemen (shared/uitvoer.js): elke werkplek heeft zijn eigen register --
     het vluchtbord, de kofferketen, de charteraanvragen, de vip-protocollen,
     de gasten in de lounges. Het scherm dat u openzet meldt zijn eigen model
     aan, zodat wat u meeneemt hetzelfde is als wat u ziet. De reizigers zelf
     blijven op codenaam, net als op het scherm. */
  var UIT = null;
  function zetUit(naam, kolommen, rijen) { UIT = rijen.length ? { naam: naam, kolommen: kolommen, rijen: rijen } : null; }
  if (w.RTGUitvoer) w.RTGUitvoer.bron(function () { return UIT; });

  var C = null, W = null;
  var api = function (pad, body) { return W.api(pad, body); };

  var ROLLEN = [
    ['vluchtleiding', 'Vluchtleiding', 'het bord: lijnvluchten, privejets en helikopters'],
    ['platform', 'Platform', 'de draai, per categorie licht of volledig'],
    ['toren', 'Toren', 'klaring op een baan of een helipad'],
    ['bagage', 'Bagagekelder', 'de kofferketen, vermist en gevonden'],
    ['security', 'Security', 'de filters en de live wachttijden'],
    ['vip', 'VIP en Royal', 'charters bevestigen en het koninklijk protocol'],
    ['lounge', 'Lounge', 'gasten op de boarding pass; royal alleen vip']
  ];

  function kiesScherm() {
    UIT = null;   // de keuzepagina heeft zelf geen register
    R.schermtype('collectie');
    return api('/api/lucht/cockpit').then(function (c) {
      C = c;
      $('#kop').textContent = 'RTG Airport';
      $('#app').innerHTML =
        (C.signalen.length ? '<ul class="ds-lijst">' + C.signalen.map(function (s) {
          return item({ aandacht: true, kop: esc(s.tekst) });
        }).join('') + '</ul>' : '') +
        R.cockpit(
          R.cijfer(C.vluchtenVandaag, 'Vluchten vandaag') + R.cijfer(C.vertrokken, 'Vertrokken') +
          R.cijfer(C.geland, 'Geland') + R.cijfer(C.vertraagd, 'Vertraagd') + R.cijfer(C.ingecheckt, 'Ingecheckt') +
          R.cijfer(C.koffersInSysteem, 'Koffers · ' + C.koffersVermist + ' vermist') +
          R.cijfer(C.chartersWachtend, 'Charters wachtend') + R.cijfer(C.vipsActief, 'Vip-protocollen') +
          R.cijfer(C.loungeGasten, 'In de lounges'), 'Jouw werkplek', ROLLEN);
      $('#app').querySelectorAll('[data-rol]').forEach(function (b) {
        b.addEventListener('click', function () { rolScherm(b.dataset.rol); });
      });
    }).catch(function (e) { meld(e.message); });
  }
  function kopStuk(titel) {
    return '<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="terug">← de operatie</button>' +
      '<div class="ds-collectie__kop"><h2 class="ds-titel ds-titel--scherm">' + titel + '</h2></div>';
  }
  function uitleg(tekst, kop, binnen) {
    return '<section class="ds-kaart"><div class="ds-kaart__inhoud">' + (kop ? '<h3 class="ds-kaart__titel">' + kop + '</h3>' : '') +
      (tekst ? '<p class="ds-meta">' + tekst + '</p>' : '') + (binnen || '') + '</div></section>';
  }
  function aiBlok(hint) { return R.vraagBlok(hint, 'De AI-operations adviseert; schakelen doet u zelf. Veiligheid voor snelheid.'); }
  function koppelBasis() {
    $('#terug').addEventListener('click', kiesScherm);
    R.koppelVraag(api, '/api/lucht/ai');
  }
  function veld(label, invoer) { return '<label class="ds-veldlabel">' + label + invoer + '</label>'; }
  function opties(lijst) { return lijst.map(function (o) { return '<option' + (o[1] ? ' value="' + o[0] + '"' : '') + '>' + (o[1] || o[0]) + '</option>'; }).join(''); }

  function klik(waar, sel, doe) { $(waar).querySelectorAll(sel).forEach(function (b) { b.addEventListener('click', function () { doe(b); }); }); }
  function stap(p) { return p.catch(function (e) { meld(e.message); }); }
  var L = { api: api, meld: meld, zetUit: zetUit, kopStuk: kopStuk, uitleg: uitleg, aiBlok: aiBlok, koppelBasis: koppelBasis,
    veld: veld, opties: opties, klik: klik, stap: stap, C: function () { return C; } };
  var bord = w.RTGLuchtBord(L), loket = w.RTGLuchtLoket(L);
  function rolScherm(rol) {
    UIT = null;   // elk scherm meldt hierna zijn eigen register aan
    if (rol === 'security') return schermSecurity();
    if (bord[rol]) return bord[rol]();
    if (loket[rol]) return loket[rol]();
  }
  /* ---- security ---- */
  function schermSecurity() {
    $('#app').innerHTML = kopStuk('Security · de filters') +
      uitleg('De wachttijden staan live op het bord van de reizigers. Loopt een filter vol, open er dan een extra.') +
      '<ul class="ds-lijst" id="seLijst"></ul>' + aiBlok('Bijv. wanneer open ik het tweede filter?');
    koppelBasis();
    stap(api('/api/lucht/bord', {}).then(function (r) {
      $('#seLijst').innerHTML = r.security.map(function (f) {
        return item({ aandacht: !f.open, kop: esc(f.naam), stand: f.open ? 'open · ' + f.wachtMinuten + ' min' : 'dicht',
          acties: knop(f.open ? 'Sluit' : 'Open', 'data-f="' + f.id + '" data-open="' + (!f.open) + '"') +
            (f.open ? knop('Wachttijd', 'data-w="' + f.id + '"') : '') });
      }).join('');
      klik('#seLijst', '[data-f]', function (b) {
        stap(api('/api/lucht/security/zet', { id: b.dataset.f, open: b.dataset.open === 'true' }).then(function () { meld('Gezet.'); schermSecurity(); }));
      });
      klik('#seLijst', '[data-w]', function (b) {
        var m = w.prompt('Actuele wachttijd in minuten:', '10'); if (m == null) return;
        stap(api('/api/lucht/security/zet', { id: b.dataset.w, wachtMinuten: m }).then(function () { meld('Wachttijd op het bord.'); schermSecurity(); }));
      });
    }));
  }

  W = R.dienst({ code: 'LUCHT', niemand: 'Geen medewerkers', onbereikbaar: 'Luchthaven niet bereikbaar', start: kiesScherm });
}(window));
