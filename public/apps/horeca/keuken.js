/* RTG Horeca (scherm): het keukenscherm -- het stationsbord en de regie.

   Twee dingen staan hier bewust groot en niet in een detailregel:

   - DE ALLERGIE. Die krijgt een eigen, omkaderd label op elke bon. Niet omdat
     het mooi staat, maar omdat een kok die scant over een lijst hem anders mist.
   - DE TIJD MET ZIJN NORM. Er staat "14 van 12 min" en niet alleen een kleur;
     wie een oranje bon ziet, hoort te weten hoeveel te laat hij is. De kleur
     volgt uit het getal, nooit andersom. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return window.RTGHoreca.esc(t); };
  var api = function (p, b) { return window.RTGHoreca.api(p, b); };
  var meld = function (t) { window.RTGHoreca.meld(t); };

  function laad() {
    var station = $('kStation').value.trim();
    api('/keuken/bord', station ? { station: station } : {}).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      $('kTelling').textContent = d.aantal + ' op het bord' + (d.teLaat ? ' · ' + d.teLaat + ' te laat' : '');
      $('kBord').innerHTML = (d.bonnen || []).map(function (b) {
        var kleur = b.urgentie === 'te laat' ? 'laat' : (b.urgentie === 'let op' ? 'laat' : 'aan');
        return '<div class="bon"><b>' + esc(b.tafel || b.kanaal) + '</b>' +
          ' <span class="tag">gang ' + b.gang + '</span>' +
          ' <span class="tag">' + esc(b.station) + '</span>' +
          (b.serveerOm ? ' <span class="tag">serveren ' + esc(b.serveerOm) + '</span>' : '') +
          ' <span class="tag ' + kleur + '">' + b.loopt + ' van ' + b.norm + ' min</span>' +
          (b.allergie ? '<div><span class="allergie">Allergie: ' + esc(b.allergie) + '</span></div>' : '') +
          '<div style="margin:.3rem 0;">' + b.aantal + '× ' + esc(b.naam) +
          (b.notitie ? ' <span class="stil">· ' + esc(b.notitie) + '</span>' : '') + '</div>' +
          '<div class="rij">' + ['gestart', 'bereid', 'klaar', 'uitgegeven'].map(function (s) {
            return '<button class="knop' + (b.stand === s ? ' p' : '') + '" data-stand="' + s +
              '" data-rek="' + esc(b.rekeningId) + '" data-regel="' + esc(b.regelId) + '">' + s + '</button>';
          }).join('') + '</div></div>';
      }).join('') || '<div class="kaart"><p class="stil">Het bord is leeg. De keuken ziet alleen wat de zaal heeft vrijgegeven.</p></div>';

      Array.prototype.forEach.call($('kBord').querySelectorAll('[data-stand]'), function (b) {
        b.addEventListener('click', function () {
          api('/keuken/stand', { rekeningId: b.dataset.rek, regelId: b.dataset.regel, stand: b.dataset.stand })
            .then(function (r2) {
              if (r2.body.error) return meld(r2.body.error);
              laad();
            });
        });
      });
    });

    api('/keuken/regie', {}).then(function (r) {
      var d = r.body;
      if (d.error) return;
      $('kRegie').innerHTML = (d.tafels || []).map(function (t) {
        return '<div class="item"><span><b>' + esc(t.tafel || t.kanaal) + '</b> <span class="stil">· gang ' + t.gang +
          ' · ' + t.klaar + ' van ' + t.totaal + ' klaar' + (t.laatste ? ' · laatste: ' + esc(t.laatste.naam) + ' (' + esc(t.laatste.station) + ')' : '') + '</span>' +
          (t.allergieen.length ? ' <span class="allergie">' + t.allergieen.map(esc).join(', ') + '</span>' : '') + '</span>' +
          '<span class="tag' + (t.gereed ? ' aan' : (t.staatKoud ? ' laat' : '')) + '">' +
          (t.gereed ? 'gereed' : (t.staatKoud ? t.staatKoud + ' min koud' : 'loopt')) + '</span></div>';
      }).join('') || '<p class="stil">Niets onderhanden.</p>';
    });
    api('/autopilot', {}).then(function(r){
      var d=r.body;if(d.error)return;$('kAutoRahul').textContent=d.rahul;
      $('kAutoStations').innerHTML=(d.stations||[]).map(function(s){return '<div class="item"><span><b>'+esc(s.station)+'</b><span class="stil"> · '+s.nu+' nu · '+s.hierna+' hierna</span></span><button class="knop" data-autost="'+esc(s.station)+'">Open station</button></div>'}).join('')||'<p class="stil">Geen vrijgegeven werk. Gebruik dit moment voor gecontroleerde mise-en-place.</p>';
      Array.prototype.forEach.call($('kAutoStations').querySelectorAll('[data-autost]'),function(b){b.addEventListener('click',function(){$('kStation').value=b.dataset.autost;laad()})});
    });
  }

  function bind() {
    $('kToon').addEventListener('click', laad);
  }

  window.RTGHorecaKeuken = { bind: bind, laad: laad };
})();
