/* RTG Horeca (scherm): personeel -- de fooienpot en de loonkosten.

   Twee plekken waar het snel oneerlijk wordt, dus staan de regels hier op het
   scherm en niet alleen in de server:

   - DE FOOIENPOT WORDT VERDEELD OVER GEWERKTE UREN, NIET OVER FUNCTIES.
     Iedereen die die dienst heeft gewerkt doet mee, ook de afwas en de keuken.
     Wie een andere sleutel wil, zet een weging; er is geen stille standaard
     die de bediening bevoordeelt. De som van de delen is exact de pot: de
     restcenten gaan naar wie de meeste uren maakte, en het scherm telt het na.
   - HET LOONPERCENTAGE REKENT MET DE OMZET ZONDER FOOI. Fooi is geen omzet van
     de zaak, dus hij hoort niet in de noemer -- anders ziet een goede avond er
     op papier goedkoper uit dan hij is.

   Wat hier NIET staat is een oordeel over wie te duur is. Het percentage is
   een feit met zijn twee getallen erbij. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function regels(prefix, velden) {
    var uit = [];
    for (var i = 1; i <= 3; i++) {
      var naam = $(prefix + 'Naam' + i).value.trim();
      if (!naam) continue;
      uit.push(velden(i, naam));
    }
    return uit;
  }

  function potten() {
    K.api('/fooienpot/lijst', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('pPotten').innerHTML = (d.potten || []).map(function (p) {
        return K.rij('<b>' + esc(p.datum) + '</b> <span class="stil">· ' + p.verdeling.length + ' persoon/personen</span>',
          K.euro(p.potCenten));
      }).join('') || '<p class="stil">Er is nog geen pot verdeeld.</p>';
    });
  }

  if (!K.poort()) return;

  $('pVerdeel').addEventListener('click', function () {
    var deelnemers = regels('p', function (i, naam) {
      return { naam: naam, uren: Number($('pUren' + i).value) || 0, weging: Number($('pWeging' + i).value) || 1 };
    });
    K.api('/fooienpot', { datum: $('pDatum').value.trim(), extra: Number($('pExtra').value) || 0,
      deelnemers: deelnemers }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      var som = d.verdeling.reduce(function (t, v) { return t + v.centen; }, 0);
      $('pVerdeling').innerHTML = d.verdeling.map(function (v) {
        return K.rij(esc(v.naam) + ' <span class="stil">· ' + v.uren + ' uur · weging ' + v.weging + '</span>', K.euro(v.centen));
      }).join('') +
        K.rij('<b>Samen</b>', '<b>' + K.euro(som) + ' van een pot van ' + K.euro(d.potCenten) + '</b>');
      $('pPotLet').textContent = d.let;
      potten();
    });
  });

  $('pLoon').addEventListener('click', function () {
    var diensten = regels('l', function (i, naam) {
      return { naam: naam, uren: Number($('lUren' + i).value) || 0,
        uurloon: Number($('lUurloon' + i).value) || 0, afdeling: $('lAfdeling' + i).value };
    });
    K.api('/loonkosten', { datum: $('lDatum').value.trim(),
      diensten: diensten.length ? diensten : undefined }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('lUit').innerHTML =
        K.rij('Omzet <span class="stil">· ' + d.bonnen + ' bon(nen), zonder fooi</span>', K.euro(d.omzetCenten)) +
        K.rij('Fooi <span class="stil">· niet in de noemer</span>', K.euro(d.fooiCenten)) +
        K.rij('Loon <span class="stil">· ' + d.uren + ' uur, ' + Object.keys(d.perAfdeling).map(function (a) {
          return a + ' ' + K.euro(d.perAfdeling[a]);
        }).join(', ') + '</span>', K.euro(d.loonCenten)) +
        K.rij('<b>Loonpercentage</b>', '<b>' + (d.loonpercentage == null ? 'geen omzet, dus geen percentage' : d.loonpercentage + '%') + '</b>') +
        K.rij('Omzet per gewerkt uur', d.omzetPerUur == null ? '-' : K.euro(d.omzetPerUur));
      $('lLet').textContent = d.let;
    });
  });

  $('gToon').addEventListener('click', function () {
    K.api('/gasten', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('gAantal').textContent = d.aantal;
      $('gAllergie').textContent = d.metAllergie;
      $('gLijst').innerHTML = (d.gasten || []).map(function (g) {
        return K.rij('<b>' + esc(g.naam) + '</b>' +
          (g.allergie ? ' <span class="allergie">' + esc(g.allergie) + '</span>' : '') +
          (g.voorkeur ? ' <span class="stil">· ' + esc(g.voorkeur) + '</span>' : ''),
        g.bezoeken + ' bezoek(en) · ' + g.punten + ' punten');
      }).join('') || '<p class="stil">Er staat nog geen gastprofiel.</p>';
    });
  });

  potten();
})();
