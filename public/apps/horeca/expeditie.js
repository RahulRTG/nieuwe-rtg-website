/* RTG Horeca (scherm): de pas -- expeditie en keukenregie.

   Dit is het scherm van de expediteur, en dat is iets anders dan het
   stationsbord van de kok. Een kok kijkt naar zijn eigen gerechten; een
   expediteur kijkt naar de TAFEL: gaan die vier borden samen de deur uit, of
   staat de eerste al zeven minuten koud te worden terwijl de grill nog bezig
   is. Daarom staat staat-koud hier groot en het aantal bonnen klein.

   Twee dingen die dit scherm bewust NIET doet:

   - Het geeft niets automatisch uit. Uitgeven is een handeling van een mens
     aan de pas; een systeem dat zelf afvinkt, maakt van "uitgegeven" een woord
     zonder betekenis.
   - De drukterem zet niets dicht. Hij toont de wachttijd met de rekensom
     erbij (openstaande bereidingsminuten gedeeld door het aantal koks) en laat
     het besluit bij de chef. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function regie() {
    K.api('/keuken/regie', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('eGereed').textContent = d.gereed + ' / ' + d.aantal;
      $('eRegie').innerHTML = (d.tafels || []).map(function (t) {
        var stand = t.gereed ? 'gereed'
          : (t.staatKoud ? t.staatKoud + ' min koud' : t.klaar + ' van ' + t.totaal + ' klaar');
        return '<div class="bon"><b>' + esc(t.tafel || t.kanaal) + '</b>' +
          ' <span class="tag">gang ' + t.gang + '</span>' +
          (t.serveerOm ? ' <span class="tag">serveren ' + esc(t.serveerOm) + '</span>' : '') +
          ' <span class="tag' + (t.gereed ? ' aan' : (t.staatKoud ? ' laat' : '')) + '">' + stand + '</span>' +
          (t.allergieen.length ? '<div><span class="allergie">Allergie: ' + t.allergieen.map(esc).join(', ') + '</span></div>' : '') +
          (t.regels || []).map(function (g) {
            return '<div class="item"><span>' + g.aantal + '× ' + esc(g.naam) +
              ' <span class="tag">' + esc(g.station) + '</span>' +
              ' <span class="tag' + (g.urgentie === 'op tijd' ? '' : ' laat') + '">' +
              g.loopt + ' van ' + g.norm + ' min</span></span>' +
              (g.stand === 'klaar'
                ? K.knop('Uitgeven', { uit: g.regelId, rek: g.rekeningId }, true)
                : '<span class="stil">' + esc(g.stand) + '</span>') + '</div>';
          }).join('') + '</div>';
      }).join('') || '<p class="stil">Niets onderhanden. De keuken ziet alleen wat de zaal heeft vrijgegeven.</p>';
      K.bind($('eRegie'), 'uit', function (b) {
        K.api('/keuken/stand', { rekeningId: b.dataset.rek, regelId: b.dataset.uit, stand: 'uitgegeven' })
          .then(function (r2) {
            if (r2.body.error) return K.meld(r2.body.error);
            K.meld('Uitgegeven aan de pas.');
            laad();
          });
      });
    });
  }

  function bord() {
    K.api('/keuken/bord', {}).then(function (r) {
      var d = r.body;
      if (d.error) return;
      $('eOpen').textContent = d.aantal;
      $('eLaat').textContent = d.teLaat || 0;
    });
  }

  function druk() {
    K.api('/keuken/druk', { kokken: Number($('eKokken').value) || 3 }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('eWacht').textContent = d.verwachteWachttijd + ' min';
      /* De som komt als zin van de server (`rekensom`) en wordt hier niet nog
         eens in elkaar gezet: twee formuleringen van dezelfde rekensom lopen
         uiteen zodra er een verandert. */
      $('eDrukUit').textContent = d.rekensom + ' Per station: ' +
        Object.keys(d.perStation).map(function (s) {
          return s + ' ' + d.perStation[s];
        }).join(', ');
      $('eWaarschuwing').textContent = d.waarschuwing || '';
    });
  }

  /* ---- KLAAR OM TE DRAGEN ------------------------------------------------
     De werklijst van de pas. Het verschil met het regiescherm eronder: dit zijn
     alleen COMPLETE gangen, en er hangt een mens aan. Zonder die claim lopen er
     twee mensen naar tafel 8, of geen -- precies de fout die de gastverzoeken
     eerder al hebben opgelost, met dezelfde twee knoppen. */
  function pas() {
    K.api('/pas/gereed', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('ePasAantal').textContent = d.aantal;
      $('ePasVrij').textContent = d.vrij;
      $('ePasVrijVak').hidden = !d.vrij;
      $('ePas').innerHTML = (d.gereed || []).map(function (g) {
        var c = g.claim;
        /* Wie hem heeft, staat als TEKST op de kaart en niet alleen als kleur.
           En de minuten staan erbij: dat is een feit waar een collega op mag
           handelen, in plaats van een tijdslimiet die het systeem zelf trekt. */
        var wie = !c ? '<span class="tag">nog van niemand</span>'
          : '<span class="tag' + (g.vanMij ? ' aan' : '') + '">' +
            (g.vanMij ? 'jij hebt hem' : esc(c.naam) + ' heeft hem') + ', ' + c.minuten + ' min' +
            (c.overgenomenVan ? ' (overgenomen van ' + esc(c.overgenomenVan) + ')' : '') + '</span>';
        var knoppen = (!c ? K.knop('Ik pak hem op', { pak: g.rekeningId, gang: g.gang }, true)
          : g.vanMij ? K.knop('Loslaten', { los: g.rekeningId, gang: g.gang })
          : K.knop('Neem over', { over: g.rekeningId, gang: g.gang })) +
          ' ' + K.knop('Gang uitgeven', { gangUit: g.rekeningId, gang: g.gang }, !!g.vanMij);
        return '<div class="bon"><b>' + esc(g.tafel) + '</b>' +
          ' <span class="tag">gang ' + g.gang + '</span>' +
          ' <span class="tag">' + g.borden + ' bord(en)</span>' +
          (g.serveerOm ? ' <span class="tag">serveren ' + esc(g.serveerOm) + '</span>' : '') +
          ' <span class="tag' + (g.gereedSinds >= 3 ? ' laat' : '') + '">staat ' + g.gereedSinds + ' min</span> ' + wie +
          (g.allergieen.length ? '<div><span class="allergie">Allergie: ' + g.allergieen.map(esc).join(', ') + '</span></div>' : '') +
          (g.regels || []).map(function (b) {
            return '<div class="item"><span>' + b.aantal + '× ' + esc(b.naam) +
              ' <span class="tag">' + esc(b.station) + '</span>' +
              /* Waar dit bord heen moet. Een runner met vier borden leest een
                 naam; "gastNr 3" zegt hem niets. */
              (b.stoel ? ' <span class="tag aan">' + esc(b.stoel) + '</span>' : '') +
              (b.allergie ? ' <span class="allergie">' + esc(b.allergie) + '</span>' : '') +
              '</span></div>';
          }).join('') +
          '<div class="rij h-mt40">' + knoppen + '</div></div>';
      }).join('') || '<p class="stil">Er staat niets compleet klaar.</p>';

      var doe = function (attr, pad, woord) {
        K.bind($('ePas'), attr, function (b) {
          K.api(pad, { rekeningId: b.getAttribute('data-' + attr), gang: Number(b.dataset.gang) })
            .then(function (r2) {
              if (r2.body.error) return K.meld(r2.body.error);
              K.meld(r2.body.let || woord);
              laad();
            });
        });
      };
      doe('pak', '/pas/pak', 'Opgepakt.');
      doe('los', '/pas/los', 'Losgelaten.');
      doe('over', '/pas/overneem', 'Overgenomen.');
      doe('gangUit', '/pas/uit', 'De gang is uitgegeven.');
    });
  }

  function laad() { pas(); regie(); bord(); druk(); }

  if (!K.poort()) return;
  $('eVerversNu').addEventListener('click', laad);
  $('eDruk').addEventListener('click', druk);
  $('eTijd').addEventListener('click', function () {
    var naam = $('eGerecht').value.trim();
    var min = Number($('eMinuten').value) || 0;
    if (!naam || !min) return K.meld('Welk gerecht, en hoeveel minuten?');
    var tijden = {};
    tijden[naam] = min;
    K.api('/keuken/tijden', { tijden: tijden, kokken: Number($('eKokken').value) || 3 }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('eGerecht').value = ''; $('eMinuten').value = '';
      K.meld(naam + ' staat nu op ' + min + ' minuten.');
      druk();
    });
  });
  laad();
  /* De pas staat de hele dienst open en mag nooit stilstaan: hij luistert mee
     op de duwstroom die de server al stuurt, met de trage terugval eronder. */
  K.luister('keuken', function () { if (!document.hidden) laad(); });
})();
