/* RTG Horeca (scherm): DE OVERDRACHT OP DE VLOER -- aanbieden, aannemen, nee
   zeggen, en teruggeven.

   WAAROM DIT NAAST ./vloer.js STAAT. Dat gaat over de VERDELING zoals hij nu
   is: wie draagt wat, en hoe druk is het daar. Dit gaat over het VERANDEREN
   ervan, en dat is een gesprek tussen twee mensen met vier zetten -- aanbieden,
   aannemen of weigeren, en later teruggeven. Twee vragen, twee bestanden; ze
   staan op hetzelfde scherm omdat je ze naast elkaar wilt zien.

   DRIE DINGEN DIE HIER ZICHTBAAR BLIJVEN:

   1. WAT AAN MIJ IS AANGEBODEN STAAT BOVENAAN, en wat ik zelf aanbood eronder.
      Zolang ik niet antwoord, draagt mijn collega het nog -- dus is mijn
      antwoord het enige op dit scherm dat niet kan wachten.
   2. EEN NEE VERDWIJNT NIET VANZELF. Hij staat er tot de aanbieder hem heeft
      gezien; niet een tijdje, want wie op dat moment met borden liep, mist een
      bericht dat zichzelf opruimt.
   3. EEN HALF AANBOD IS DE GEWONE VORM, geen uitzondering. "Neem tafel 6 even
      van me over" gebeurt vaker dan een hele wijk overdragen, dus staat de
      tafelkeuze in dezelfde vorm en niet achter een tweede knop. Niets
      aanvinken is de hele wijk -- dat blijft de eenvoudigste zet. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  /* Eerst de poort: achter een deur is #main vervangen en valt elke binding
     over null. Zie ./vloer-indelen.js voor waarom dat hier niet vanzelf goed
     gaat. poort() opent er geen tweede. */
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;

  function $(id) { return document.getElementById(id); }

  var D = null, na = null;
  var bieden = null;      // de wijk waarvoor de aanbiedvorm openstaat
  var getekend = null;    // voor welke wijk hij nu op het scherm staat
  /* Half ingetypte redenen overleven een verversing. Dit scherm ververst op
     elke duw van een collega, en een reden die daarbij wordt weggegooid, is een
     reden die niemand meer opschrijft. */
  var redenen = {};

  // wat een aanbod draagt, in woorden
  function wat(o) {
    return o.tafels ? esc(o.tafels.join(', ')) + ' uit ' + esc(o.wijkNaam) : esc(o.wijkNaam);
  }

  /* ---------- de aanbiedvorm: aan wie, en welke tafels ---------- */
  function vorm() {
    var v = $('vBiedVorm');
    if (!bieden) { v.hidden = true; v.innerHTML = ''; getekend = null; return; }
    var w = (D.wijken || []).filter(function (x) { return x.id === bieden; })[0];
    if (!w) { bieden = null; return vorm(); }
    if (getekend === w.id) return;
    getekend = w.id;
    var anderen = (D.ploeg || []).filter(function (p) { return !p.ik; });
    v.hidden = false;
    v.innerHTML = '<p>' + esc(w.naam) + ' overdragen. Vink tafels aan om er maar een paar te geven; ' +
      'vinkt u niets aan, dan gaat de hele wijk mee. Tot uw collega ja zegt, draagt u hem zelf.</p>' +
      (anderen.length
        ? '<select id="vBiedNaar" aria-label="Aan wie biedt u ' + esc(w.naam) + ' aan">' +
          anderen.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.naam) + '</option>'; }).join('') +
          '</select>'
        : '<p>Er is niemand anders ingelogd om aan te bieden.</p>') +
      '<div class="v-vakjes">' + w.tafels.map(function (t) {
        return '<label><input type="checkbox" value="' + esc(t) + '">' + esc(t) + '</label>';
      }).join('') + '</div>' +
      '<div class="v-acties">' + (anderen.length ? K.knop('Bied aan', { doebied: w.id }, true) : '') +
      K.knop('Annuleren', { biedaf: '1' }) + '</div>';

    K.bind(v, 'biedaf', function () { bieden = null; vorm(); });
    K.bind(v, 'doebied', function (b) {
      var kies = $('vBiedNaar');
      var tafels = Array.prototype.filter.call(v.querySelectorAll('input[type=checkbox]'),
        function (c) { return c.checked; }).map(function (c) { return c.value; });
      doe('/wijk/bied', { wijkId: b.dataset.doebied, naarId: kies.value,
        naarNaam: kies.options[kies.selectedIndex].text, tafels: tafels },
      function () { bieden = null; vorm(); });
    });
  }

  function doe(pad, body, klaar) {
    return api(pad, body).then(function (r) {
      if (r.body.error) meld(r.body.error);
      else { if (r.body.let) meld(r.body.let); if (klaar) klaar(); }
      if (na) na();
    }, function (e) { meld(e.message || 'Er ging iets mis.'); });
  }

  /* ---------- de vier lijsten ---------- */
  function teken(d, opnieuw) {
    D = d; na = opnieuw;

    var voor = (d.overdrachten || []).filter(function (o) { return o.voorMij; });
    $('vVoorMij').innerHTML = voor.map(function (o) {
      return '<article class="v-bod"><p><b>' + esc(o.vanNaam) + '</b> biedt u ' + wat(o) +
        ' aan; het aanbod staat ' + o.staat + ' min. Tot u het aanvaardt, draagt ' +
        esc(o.vanNaam) + ' het nog.</p><div class="v-acties">' +
        K.knop('Ik neem het over', { pak: o.id }, true) +
        '<input type="text" maxlength="80" data-reden="' + esc(o.id) + '" ' +
        'placeholder="Waarom niet? (mag leeg)" aria-label="Reden om te weigeren">' +
        K.knop('Kan niet', { nee: o.id }) + '</div></article>';
    }).join('');
    // de half ingetypte reden terugzetten; de minuten hierboven blijven wel vers
    Array.prototype.forEach.call($('vVoorMij').querySelectorAll('[data-reden]'), function (i) {
      if (redenen[i.dataset.reden]) i.value = redenen[i.dataset.reden];
      i.addEventListener('input', function () { redenen[i.dataset.reden] = i.value; });
    });

    $('vAntwoord').innerHTML = (d.antwoorden || []).map(function (o) {
      return '<article class="v-antwoord"><p><b>' + esc(o.naarNaam || 'Uw collega') +
        '</b> kan ' + wat(o) + ' niet overnemen' + (o.reden ? ': ' + esc(o.reden) : '') +
        '. U draagt het nog steeds.</p><div class="v-acties">' +
        K.knop('Gezien', { zag: o.id }) + '</div></article>';
    }).join('');

    var uit = (d.leningen || []);
    $('vUit').textContent = uit.length;
    $('vGeleend').innerHTML = uit.length ? uit.map(function (l) {
      return '<div class="v-leen"><b>' + esc(l.tafel) + '</b><small>' +
        esc(l.naam) + ' draagt hem' + (l.vanNaam ? ', van ' + esc(l.vanNaam) : '') +
        (l.wijkNaam ? ' uit ' + esc(l.wijkNaam) : '') + ' · ' + l.staat + ' min</small>' +
        '<span class="h-flex1"></span>' +
        ((l.naarMij || l.vanMij || d.magIndelen) ? K.knop('Terug', { terug: l.tafel }) : '') +
        '</div>';
    }).join('') : '<p class="v-leeg">Geen enkele tafel staat bij iemand anders. Een halve wijk ' +
      'overdragen doet u hierboven, bij de wijk die u zelf draagt.</p>';

    var open = (d.overdrachten || []);
    $('vAanbod').innerHTML = open.length ? open.map(function (o) {
      return '<article class="v-wijk"><div class="v-wijkkop">' +
        '<span class="v-naam">' + wat(o) + '</span>' +
        '<span class="v-druk">' + o.staat + ' min</span></div>' +
        '<p class="v-som">' + esc(o.vanNaam) + ' biedt het aan ' + esc(o.naarNaam || 'een collega') +
        ' en draagt het tot dan zelf.</p>' +
        ((o.vanMij || d.magIndelen)
          ? '<div class="v-acties">' + K.knop('Trek in', { trek: o.id }) + '</div>' : '') +
        '</article>';
    }).join('') : '<p class="v-leeg">Geen open aanbiedingen.</p>';

    var m = $('main');
    K.bind(m, 'pak', function (b) { doe('/wijk/aanvaard', { overdrachtId: b.dataset.pak }); });
    K.bind(m, 'trek', function (b) { doe('/wijk/trek-in', { overdrachtId: b.dataset.trek }); });
    K.bind(m, 'zag', function (b) { doe('/wijk/gezien', { overdrachtId: b.dataset.zag }); });
    K.bind(m, 'terug', function (b) { doe('/wijk/tafel-terug', { tafel: b.dataset.terug }); });
    K.bind(m, 'nee', function (b) {
      var id = b.dataset.nee;
      doe('/wijk/weiger', { overdrachtId: id, reden: redenen[id] || '' },
        function () { delete redenen[id]; });
    });
    K.bind(m, 'bied', function (b) { bieden = b.dataset.bied; vorm(); });
    vorm();
  }

  window.RTGVloerAanbod = { teken: teken };
})();
