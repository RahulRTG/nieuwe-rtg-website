/* RTG Office, het formulier op het scherm: drie gezichten op een document.

   Wie mag schrijven BOUWT: vragen (open, keuze of schaal 1-5), de volgorde,
   en de wijze -- op codenaam of anoniem. Wie alleen mag lezen VULT IN: het
   formulier is voor die persoon geen document maar een vragenlijst met een
   verstuurknop. En de bouwer kan omschakelen naar de UITSLAG.

   De anoniem-stand wordt eerlijk uitgelegd, aan beide kanten: de eigenaar
   ziet geen namen, maar RTG weet wel wie invulde (anders kan "een inzending
   per persoon" niet bestaan). Dat staat op het scherm, niet in kleine
   lettertjes.

   Levert window.RTGOfficeFormulier. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var SOORTEN = [['open', 'Open antwoord'], ['keuze', 'Meerkeuze'], ['schaal', 'Schaal 1-5']];

  function maak(opties) {
    var wrap = opties.wrap, api = opties.api, onWijzig = opties.onWijzig, meld = opties.meld;
    var vragen = [], wijze = 'codenaam', dicht = false, mag = false, docId = null;

    function schoon(v) {
      return { tekst: (v && v.tekst) || '', soort: (v && v.soort) || 'open',
        verplicht: !!(v && v.verplicht), opties: (v && v.opties && v.opties.slice()) || [] };
    }

    /* ---- de bouwer (wie mag schrijven) ---- */
    function tekenBouw() {
      wrap.innerHTML = '<div class="fkop"><select id="fWijze" aria-label="Wijze van invullen">' +
        '<option value="codenaam"' + (wijze === 'codenaam' ? ' selected' : '') + '>Op codenaam</option>' +
        '<option value="anoniem"' + (wijze === 'anoniem' ? ' selected' : '') + '>Anoniem</option></select>' +
        '<span class="fstil">' + (wijze === 'anoniem'
          ? 'U ziet niet wie wat antwoordde. RTG weet het wel (een inzending per persoon); dat staat er voor de invuller ook bij.'
          : 'Elke inzending draagt de codenaam van de invuller.') + '</span>' +
        '<button class="knop" id="fDicht" type="button">' + (dicht ? 'Open de inzendingen weer' : 'Sluit de inzendingen') + '</button>' +
        '<button class="knop" id="fUitslag" type="button">Bekijk antwoorden</button></div>' +
        (dicht ? '<p class="fstil">Gesloten: er komen geen antwoorden meer bij. De uitslag blijft gewoon te bekijken.</p>' : '') +
        vragen.map(function (v, i) {
          return '<div class="fvraag" data-i="' + i + '">' +
            '<div class="frij"><span class="fnr">' + (i + 1) + '</span>' +
            '<input class="fv-tekst" maxlength="200" placeholder="De vraag" value="' + esc(v.tekst) + '">' +
            '<select class="fv-soort" aria-label="Soort vraag">' + SOORTEN.map(function (s) {
              return '<option value="' + s[0] + '"' + (s[0] === v.soort ? ' selected' : '') + '>' + s[1] + '</option>';
            }).join('') + '</select>' +
            '<label class="fkeus" title="De invuller kan niet insturen zolang deze vraag leeg is">' +
              '<input type="checkbox" class="fv-plicht"' + (v.verplicht ? ' checked' : '') + '> verplicht</label>' +
            '<button class="mini" data-op="' + i + '" title="Omhoog">↑</button>' +
            '<button class="mini" data-neer="' + i + '" title="Omlaag">↓</button>' +
            (vragen.length > 1 ? '<button class="mini weg" data-weg="' + i + '">weg</button>' : '') + '</div>' +
            (v.soort === 'keuze'
              ? '<textarea class="fv-opties" rows="3" placeholder="Een optie per regel (maximaal 8)">' +
                esc(v.opties.join('\n')) + '</textarea>'
              : v.soort === 'schaal' ? '<p class="fstil">De invuller kiest 1 tot en met 5.</p>' : '') +
            '</div>';
        }).join('') +
        (vragen.length < 30 ? '<button class="knop" id="fErbij" type="button">+ Vraag</button>' : '');
      var q = function (s) { return wrap.querySelector(s); };
      q('#fWijze').addEventListener('change', function () { wijze = this.value; onWijzig(); tekenBouw(); });
      q('#fUitslag').addEventListener('click', toonUitslag);
      q('#fDicht').addEventListener('click', function () {
        dicht = !dicht; onWijzig(); tekenBouw();
        meld(dicht ? 'Gesloten; er komen geen antwoorden meer bij.' : 'Weer open voor antwoorden.');
      });
      var erbij = q('#fErbij');
      if (erbij) erbij.addEventListener('click', function () {
        vragen.push(schoon({})); onWijzig(); tekenBouw();
      });
      Array.prototype.forEach.call(wrap.querySelectorAll('.fvraag'), function (el) {
        var i = +el.dataset.i;
        el.querySelector('.fv-tekst').addEventListener('input', function () { vragen[i].tekst = this.value; onWijzig(); });
        el.querySelector('.fv-soort').addEventListener('change', function () { vragen[i].soort = this.value; onWijzig(); tekenBouw(); });
        el.querySelector('.fv-plicht').addEventListener('change', function () { vragen[i].verplicht = this.checked; onWijzig(); });
        var op = el.querySelector('.fv-opties');
        if (op) op.addEventListener('input', function () {
          vragen[i].opties = this.value.split('\n').map(function (r) { return r.trim(); })
            .filter(Boolean).slice(0, 8);
          onWijzig();
        });
      });
      var knopje = function (attr, fn) {
        Array.prototype.forEach.call(wrap.querySelectorAll('[data-' + attr + ']'), function (b) {
          b.addEventListener('click', function () { fn(+b.dataset[attr]); });
        });
      };
      knopje('weg', function (i) { vragen.splice(i, 1); onWijzig(); tekenBouw(); });
      knopje('op', function (i) { verplaats(i, -1); });
      knopje('neer', function (i) { verplaats(i, 1); });
    }
    function verplaats(i, n) {
      if (i + n < 0 || i + n >= vragen.length) return;
      var v = vragen.splice(i, 1)[0];
      vragen.splice(i + n, 0, v); onWijzig(); tekenBouw();
    }

    /* ---- het invullen (wie alleen mag lezen) ---- */
    function tekenVul(alGedaan) {
      if (dicht) {
        wrap.innerHTML = '<p class="fstil">Dit formulier is gesloten; er kunnen geen antwoorden meer bij.' +
          (alGedaan ? ' Uw eerdere antwoord is ontvangen en telt mee.' : '') + '</p>';
        return;
      }
      wrap.innerHTML = '<p class="fstil">' + (wijze === 'anoniem'
        ? 'Dit formulier is anoniem: de eigenaar ziet niet wie wat antwoordde. RTG weet wel dat u heeft ingevuld (een inzending per persoon).'
        : 'U vult in op uw codenaam; de eigenaar ziet die naam bij uw antwoorden. Uw echte naam ziet niemand.') +
        (alGedaan ? '<br>U heeft dit al ingevuld; opnieuw insturen vervangt uw eerdere antwoord.' : '') + '</p>' +
        vragen.map(function (v, i) {
          var vak = v.soort === 'keuze'
            ? v.opties.map(function (o, j) {
                return '<label class="fkeus"><input type="radio" name="fv' + i + '" value="' + j + '"> ' + esc(o) + '</label>';
              }).join('')
            : v.soort === 'schaal'
            ? '<span class="fschaal">' + [1, 2, 3, 4, 5].map(function (n) {
                return '<label class="fkeus"><input type="radio" name="fv' + i + '" value="' + n + '"> ' + n + '</label>';
              }).join('') + '</span>'
            : '<textarea class="fv-antwoord" data-i="' + i + '" rows="3" maxlength="500" placeholder="Uw antwoord"></textarea>';
          return '<div class="fvraag"><div class="frij"><span class="fnr">' + (i + 1) + '</span>' +
            '<span class="fv-lab">' + esc(v.tekst || '(vraag zonder tekst)') +
            (v.verplicht ? ' <b class="fplicht" title="Verplichte vraag">*</b>' : '') + '</span></div>' + vak + '</div>';
        }).join('') +
        (vragen.some(function (v) { return v.verplicht; }) ? '<p class="fstil">Vragen met een * zijn verplicht.</p>' : '') +
        '<button class="knop vol" id="fStuur" type="button">Stuur in</button>';
      wrap.querySelector('#fStuur').addEventListener('click', function () {
        var antwoorden = vragen.map(function (v, i) {
          if (v.soort === 'open') {
            var t = wrap.querySelector('.fv-antwoord[data-i="' + i + '"]');
            return t ? t.value : '';
          }
          var r = wrap.querySelector('input[name="fv' + i + '"]:checked');
          return r ? +r.value : null;
        });
        // de vriendelijke controle; de server dwingt hetzelfde af
        for (var i2 = 0; i2 < vragen.length; i2++) {
          var leeg = vragen[i2].soort === 'open' ? !String(antwoorden[i2] || '').trim() : antwoorden[i2] == null;
          if (vragen[i2].verplicht && leeg) return meld('Vraag ' + (i2 + 1) + ' is verplicht.');
        }
        api('vul', { id: docId, antwoorden: antwoorden }).then(function (r) {
          if (r.body.error) return meld(r.body.error);
          meld(r.body.vervangen ? 'Uw eerdere antwoord is vervangen.' : 'Ontvangen; dank voor het invullen.');
          tekenVul(true);
        });
      });
    }

    /* ---- de uitslag (de bouwer kijkt); de weergave woont in
       formulieruitslag.js -- kijken is een ander vak dan bouwen ---- */
    function toonUitslag() {
      window.RTGOfficeFormulierUitslag.toon({ wrap: wrap, api: api, docId: docId, meld: meld, terug: tekenBouw });
    }

    return {
      laad: function (inhoud, magNu, id) {
        mag = !!magNu; docId = id;
        vragen = ((inhoud && inhoud.vragen) || [{}]).map(schoon);
        wijze = (inhoud && inhoud.wijze) === 'anoniem' ? 'anoniem' : 'codenaam';
        dicht = !!(inhoud && inhoud.dicht);
        if (mag) tekenBouw();
        else {
          tekenVul(false);
          // al ingevuld? dan zegt het scherm dat eerlijk, voordat u opnieuw typt
          api('vul', { id: docId, kijk: true }).then(function (r) {
            if (r.body && (r.body.ingevuld || r.body.dicht)) { dicht = dicht || !!r.body.dicht; tekenVul(!!r.body.ingevuld); }
          });
        }
      },
      inhoud: function () { return { vragen: vragen, wijze: wijze, dicht: dicht }; },
      uitslagCsv: function () { return window.RTGOfficeFormulierUitslag.csv(api, docId); }
    };
  }

  window.RTGOfficeFormulier = { maak: maak };
})();
