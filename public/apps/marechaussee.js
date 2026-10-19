/* De Brigade RTG Airport op het RTG Design System (TRAVELOS-MIGRATIE.md
   par. 1b). Dezelfde kern als ervoor: /api/supplier/roster en /login met de
   code KMAR, /api/kmar/* met het werktoken. Reizigers blijven op codenaam;
   de echte naam zit in de kluis en hoort daar. */
(function (w) {
  'use strict';
  var R = w.RTGWerk, $ = R.$, esc = R.esc, item = R.item, knop = R.knop, tijd = R.tijd;
  var meld = R.zeg;

  /* Meenemen (shared/uitvoer.js): elke post houdt zijn eigen register bij --
     de passagierslijst aan de balie en het incidentenregister. Het scherm dat
     openstaat meldt zijn model aan; reizigers blijven op codenaam, precies
     zoals ze op het scherm staan. */
  var UIT = null;
  function zetUit(naam, kolommen, rijen) { UIT = rijen.length ? { naam: naam, kolommen: kolommen, rijen: rijen } : null; }
  if (w.RTGUitvoer) w.RTGUitvoer.bron(function () { return UIT; });

  var C = null, W = null;
  var api = function (pad, body) { return W.api(pad, body); };
  function stap(p) { return p.catch(function (e) { meld(e.message); }); }
  function klik(waar, sel, doe) { $(waar).querySelectorAll(sel).forEach(function (b) { b.addEventListener('click', function () { doe(b); }); }); }

  var POSTEN = [
    ['grens', 'Grensbalie', 'de passagierslijst per vlucht, besluit per reiziger'],
    ['patrouille', 'Patrouille', 'rondes door de zones, met bevindingen'],
    ['incidenten', 'Incidenten', 'melden en netjes sluiten']
  ];
  function kiesScherm() {
    UIT = null;   // de postkeuze heeft zelf geen register
    R.schermtype('collectie');
    return api('/api/kmar/cockpit').then(function (c) {
      C = c;
      $('#app').innerHTML =
        (C.signalen.length ? '<ul class="ds-lijst">' + C.signalen.map(function (s) { return item({ aandacht: true, kop: esc(s.tekst) }); }).join('') + '</ul>' : '') +
        R.cockpit(
          R.cijfer(C.vluchtenVandaag, 'Vertrekkers vandaag') + R.cijfer(C.controlesVandaag, 'Controles gedaan') +
          R.cijfer(C.inOnderzoek, 'Nader onderzoek') + R.cijfer(C.incidentenOpen, 'Incidenten open') +
          R.cijfer(C.patrouillesVandaag, 'Patrouilles'), 'Jouw post', POSTEN);
      klik('#app', '[data-rol]', function (b) {
        if (b.dataset.rol === 'grens') schermGrens();
        if (b.dataset.rol === 'patrouille') schermPatrouille();
        if (b.dataset.rol === 'incidenten') schermIncidenten();
      });
    }).catch(function (e) { meld(e.message); });
  }
  function kopStuk(titel) {
    return '<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="terug">← de brigade</button>' +
      '<div class="ds-collectie__kop"><h2 class="ds-titel ds-titel--scherm">' + titel + '</h2></div>';
  }
  function uitleg(tekst, kop, binnen) {
    return '<section class="ds-kaart"><div class="ds-kaart__inhoud">' + (kop ? '<h3 class="ds-kaart__titel">' + kop + '</h3>' : '') +
      (tekst ? '<p class="ds-meta">' + tekst + '</p>' : '') + (binnen || '') + '</div></section>';
  }
  function aiBlok(hint) { return R.vraagBlok(hint, 'De AI-wachtcommandant adviseert; beslissen doet u zelf. Bij direct gevaar: eerst 112.'); }
  function koppelBasis() {
    $('#terug').addEventListener('click', kiesScherm);
    R.koppelVraag(api, '/api/kmar/ai');
  }

  /* ---- de grensbalie ---- */
  function schermGrens() {
    $('#app').innerHTML = kopStuk('Grensbalie') +
      uitleg('De passagierslijst op codenaam; de echte naam blijft in de kluis. Per reiziger een menselijk besluit: akkoord, nader onderzoek, of daarna vrijgeven.', '',
        '<div class="ds-vraagrij"><select class="ds-invoer" id="gVlucht" aria-label="Vlucht">' + (C.vluchten.length ? C.vluchten.map(function (v) {
          return '<option value="' + esc(v.nummer) + '">' + esc(v.nummer) + ' · ' + esc(v.tijd) + ' · ' + esc(v.status) + '</option>';
        }).join('') : '<option value="">Geen vertrekkers</option>') + '</select>' +
        '<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="gLaad">Toon de lijst</button></div>') +
      '<ul class="ds-lijst" id="gLijst"></ul>' + aiBlok('Bijv. welke vlucht controleer ik als eerste?');
    koppelBasis();
    $('#gLaad').addEventListener('click', laadGrens);
    if (C.vluchten.length) laadGrens();
  }
  var BESLUIT = { wacht: 'wacht', akkoord: 'akkoord', vrijgegeven: 'vrijgegeven' };
  function laadGrens() {
    var nr = $('#gVlucht').value; if (!nr) return;
    stap(api('/api/kmar/controle/lijst', { vlucht: nr }).then(function (r) {
      $('#gLijst').innerHTML = item({ kop: esc(r.vlucht.nummer) + ' · ' + esc(r.vlucht.bestemming) + ' · ' + esc(r.vlucht.tijd), stand: esc(r.vlucht.status) }) +
        (r.passagiers.length ? r.passagiers.map(function (p) {
          var acties = p.besluit === 'wacht' ? knop('Akkoord ✓', 'data-b="' + p.boekingId + '" data-w="akkoord"', true) + knop('Nader onderzoek', 'data-b="' + p.boekingId + '" data-w="nader-onderzoek"')
            : p.besluit === 'nader-onderzoek' ? knop('Vrijgeven ✓', 'data-b="' + p.boekingId + '" data-w="vrijgegeven"', true) : '';
          return item({ aandacht: p.besluit === 'nader-onderzoek', kop: esc(p.codenaam), meta: 'stoel ' + esc(p.stoel),
            stand: BESLUIT[p.besluit] || 'nader onderzoek', acties: acties });
        }).join('') : R.leegRegel('Nog geen ingecheckte reizigers op deze vlucht.'));
      zetUit('grenscontrole', ['vlucht', 'reiziger', 'stoel', 'besluit'],
        r.passagiers.map(function (p) { return [r.vlucht.nummer, p.codenaam, p.stoel, p.besluit]; }));
      klik('#gLijst', '[data-b]', function (b) {
        stap(api('/api/kmar/controle/zet', { boekingId: b.dataset.b, besluit: b.dataset.w }).then(function () { meld('Vastgelegd.'); laadGrens(); }));
      });
    }));
  }

  /* ---- de patrouille ---- */
  function schermPatrouille() {
    $('#app').innerHTML = kopStuk('Patrouille') +
      uitleg('Loop de zones na; een bevinding leg je meteen vast. De stille zones staan bovenaan.') +
      '<ul class="ds-lijst" id="pLijst">' + C.zones.map(function (z) {
        return item({ kop: esc(z), stand: C.laatstePatrouille[z] ? 'laatst ' + tijd(C.laatstePatrouille[z]) : 'nog niet gelopen',
          acties: '<input class="ds-invoer" data-bev="' + esc(z) + '" aria-label="Bevinding in ' + esc(z) + '" placeholder="Bevinding (leeg = alles rustig)" maxlength="200">' +
            knop('Gelopen ✓', 'data-zone="' + esc(z) + '"') });
      }).join('') + '</ul>' + aiBlok('Bijv. welke zone verdient nu aandacht?');
    koppelBasis();
    klik('#pLijst', '[data-zone]', function (b) {
      var inp = $('[data-bev="' + b.dataset.zone + '"]');
      stap(api('/api/kmar/patrouille', { zone: b.dataset.zone, bevinding: inp ? inp.value : '' }).then(function () {
        meld('Patrouille vastgelegd.'); schermPatrouille();
      }));
    });
    zetUit('patrouilles', ['zone', 'datum', 'tijd'], C.zones.map(function (z) {
      var at = C.laatstePatrouille[z];
      return [z, at ? String(at).slice(0, 10) : '', at ? tijd(at) : ''];
    }));
  }

  /* ---- incidenten ---- */
  function schermIncidenten() {
    R.schermtype('taak');
    $('#app').innerHTML = kopStuk('Incidenten') +
      uitleg('Bij direct gevaar: eerst 112 en de meldkamer, dan melden.', 'Incident melden',
        '<div class="ds-veldgroep"><label class="ds-veldlabel">Zone<select class="ds-invoer" id="iZone"></select></label>' +
        '<label class="ds-veldlabel">Soort<select class="ds-invoer" id="iSoort"></select></label></div>' +
        '<label class="ds-veldlabel">Wat speelt er?<input class="ds-invoer" id="iTekst" placeholder="Wat speelt er?" maxlength="300"></label>' +
        '<button class="ds-knop ds-knop--primair ds-taak__actie" type="button" id="iMeld" data-ds-actie="Incident melden">Meld</button>') +
      '<ul class="ds-lijst" id="iLijst"></ul>' + aiBlok('Bijv. hoe pak ik achtergelaten bagage aan?');
    koppelBasis();
    $('#iMeld').addEventListener('click', function () {
      stap(api('/api/kmar/incident', { zone: $('#iZone').value, soort: $('#iSoort').value, tekst: $('#iTekst').value })
        .then(function () { meld('Gemeld.'); $('#iTekst').value = ''; laadIncidenten(); }));
    });
    laadIncidenten();
  }
  function laadIncidenten() {
    stap(api('/api/kmar/incidenten').then(function (r) {
      if (!$('#iZone').options.length) $('#iZone').innerHTML = r.zones.map(function (z) { return '<option>' + esc(z) + '</option>'; }).join('');
      if (!$('#iSoort').options.length) $('#iSoort').innerHTML = r.soorten.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
      $('#iLijst').innerHTML = r.incidenten.length ? r.incidenten.map(function (i) {
        return item({ aandacht: !i.gesloten, kop: esc(i.soort) + ' · ' + esc(i.zone), stand: i.gesloten ? 'gesloten' : 'open',
          meta: esc(i.tekst) + ' · ' + esc(i.door) + ' · ' + tijd(i.at) + (i.gesloten ? ' · afloop: ' + esc(i.gesloten.afloop) : ''),
          acties: !i.gesloten ? knop('Sluiten', 'data-sluit="' + i.id + '"') : '' });
      }).join('') : R.leegRegel('Geen incidenten. Zo houden we het.');
      zetUit('incidenten', ['soort', 'zone', 'wat', 'door', 'tijd', 'status', 'afloop'],
        r.incidenten.map(function (i) { return [i.soort, i.zone, i.tekst, i.door, tijd(i.at), i.gesloten ? 'gesloten' : 'open', i.gesloten ? (i.gesloten.afloop || '') : '']; }));
      klik('#iLijst', '[data-sluit]', function (b) {
        var afloop = w.prompt('Hoe is het afgelopen?', '') || '';
        stap(api('/api/kmar/incident/sluit', { id: b.dataset.sluit, afloop: afloop }).then(function () { meld('Gesloten.'); laadIncidenten(); }));
      });
    }));
  }

  W = R.dienst({ code: 'KMAR', niemand: 'Geen personeel', onbereikbaar: 'Brigade niet bereikbaar', start: kiesScherm });
}(window));
