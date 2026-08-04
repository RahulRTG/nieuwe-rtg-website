/* RTG Horeca (scherm): het bezorgersscherm -- de rit van tas tot handtekening.

   De keten loopt hier zoals hij in de server staat en niet zoals hij makkelijk
   klikt: INPAKKEN (elke regel afgevinkt, tas en bonnummer) -> AANNEMEN op
   eigen naam -> ALLES GEPAKT -> ONDERWEG -> AFGELEVERD MET BEWIJS. De knop
   "onderweg" bestaat, maar de server weigert hem tot de eerste twee vinkjes
   staan; dat weigeren is de bedoeling en wordt hier gewoon getoond.

   Wat er NIET op dit scherm staat: de naam van de gast. Een bestelling draagt
   een codenaam en een adres, en dat is alles wat een bezorger nodig heeft.
   Het afleverbewijs legt vast wat een geschil later beslecht -- tijd, hoe,
   aan wie, en of de leeftijd is gecontroleerd -- en geen foto van een mens of
   een deur. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var api = function (pad, body) { return K.apiVol('/api/supplier/bezorg' + pad, body); };

  function stap(o) {
    if (!o.inpak) return 'moet nog ingepakt';
    if (!o.bezorger) return 'vrij om aan te nemen';
    if (!o.pakcheck) return 'nog niet afgevinkt door de bezorger';
    if (o.status !== 'onderweg') return 'klaar om te vertrekken';
    return 'onderweg';
  }

  function laad() {
    api('/overzicht', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('rVandaag').textContent = d.vandaag.aantal;
      $('rLopend').textContent = (d.lopend || []).length;
      $('rRitten').innerHTML = (d.lopend || []).map(function (o) {
        return '<div class="bon"><b>' + esc(o.ref) + '</b>' +
          ' <span class="tag">' + esc(o.levering) + '</span>' +
          ' <span class="tag">' + esc(o.status) + '</span>' +
          ' <span class="tag' + (o.status === 'onderweg' ? ' aan' : '') + '">' + esc(stap(o)) + '</span>' +
          (o.allergyNote ? '<div><span class="allergie">Allergie: ' + esc(o.allergyNote) + '</span></div>' : '') +
          '<div class="stil">' + esc(o.adres || 'ophalen aan de zaak') + ' · ' + esc(o.customerCodename || 'gast') +
          ' · ' + (o.items || []).map(function (i) { return i.qty + '× ' + esc(i.name); }).join(', ') + '</div>' +
          (o.bezorger ? '<div class="stil">Rit van ' + esc(o.bezorger.name) + '</div>' : '') +
          '<div class="rij">' +
          K.knop('Inpakken', { pak: o.ref, items: (o.items || []).map(function (i) { return i.id; }).join('|') }) +
          K.knop('Aannemen', { neem: o.ref }) +
          K.knop('Alles gepakt', { check: o.ref }) +
          K.knop('Onderweg', { weg: o.ref }, true) +
          K.knop('Bezorgd', { klaar: o.ref }) +
          '</div></div>';
      }).join('') || '<p class="stil">Er loopt op dit moment geen levering.</p>';

      K.bind($('rRitten'), 'pak', function (b) {
        var tas = $('rTas').value.trim();
        if (!tas) return K.meld('In welke tas zit alles?');
        api('/inpak', { ref: b.dataset.pak, bon: b.dataset.pak, tas: tas,
          items: b.dataset.items ? b.dataset.items.split('|') : [] }).then(klaarMet);
      });
      K.bind($('rRitten'), 'neem', function (b) { api('/neem', { ref: b.dataset.neem }).then(klaarMet); });
      K.bind($('rRitten'), 'check', function (b) { api('/pakcheck', { ref: b.dataset.check }).then(klaarMet); });
      K.bind($('rRitten'), 'weg', function (b) { api('/status', { ref: b.dataset.weg, status: 'onderweg' }).then(klaarMet); });
      K.bind($('rRitten'), 'klaar', function (b) {
        $('rBewijsRef').value = b.dataset.klaar;
        api('/status', { ref: b.dataset.klaar, status: 'bezorgd' }).then(function (r2) {
          klaarMet(r2);
          if (!r2.body.error) K.meld('Bezorgd. Teken het nu af met het bewijs eronder.');
        });
      });
    });
  }

  function klaarMet(r) {
    if (r.body.error) return K.meld(r.body.error);
    laad();
  }

  if (!K.poort()) return;
  $('rVerversNu').addEventListener('click', laad);
  $('rHoe').addEventListener('change', function () {
    var naam = $('rHoe').value === 'overhandigd' || $('rHoe').value === 'buren';
    $('rOntvanger').hidden = !naam;
  });
  $('rBewijs').addEventListener('click', function () {
    var ref = $('rBewijsRef').value.trim();
    if (!ref) return K.meld('Welke rit wordt afgetekend?');
    K.api('/bezorg/afgeleverd', { ritId: ref, hoe: $('rHoe').value,
      ontvanger: $('rOntvanger').value.trim(), notitie: $('rNotitie').value.trim(),
      leeftijdNodig: $('rLeeftijdNodig').checked,
      leeftijdGecontroleerd: $('rLeeftijdOk').checked }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('rBewijsUit').textContent = 'Afgetekend om ' + d.bewijs.at.slice(11, 16) + ' (' + d.bewijs.hoe +
        (d.bewijs.ontvanger ? ', aan ' + d.bewijs.ontvanger : '') + '). ' + d.let;
      $('rNotitie').value = '';
    });
  });
  laad();
})();
