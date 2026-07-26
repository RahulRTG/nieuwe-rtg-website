/* RTG Agenda, het afspraak-paneel: een afspraak maken of bewerken, een
   uitnodiging beantwoorden, deelnemers uitnodigen op codenaam. Een
   boeking uit het ecosysteem opent hier ook, maar dan alleen-lezen: de
   agenda leest RTG, hij herschrijft RTG niet.

   Levert window.RTGAgendaPaneel. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var open = null; // de afspraak die nu in het paneel staat

  function maak(api, meld, herlaad) {
    function zetVelden(aan) {
      ['afTitel', 'afDatum', 'afPlek', 'afTijd', 'afEind', 'afHerhaal', 'afHerhaalTot', 'afHerinner', 'afNotitie']
        .forEach(function (id) { $('#' + id).disabled = !aan; });
      $('#afBewaar').style.display = aan ? '' : 'none';
    }

    function toon(item) {
      open = item || {};
      var eco = open.bron === 'boeking';
      var uitnodiging = !!open.van && !eco;
      $('#afKop').textContent = eco ? 'Uit RTG (alleen-lezen)' : open.id ? 'Afspraak' : 'Nieuwe afspraak';
      $('#afTitel').value = open.titel || '';
      $('#afDatum').value = open.datum || '';
      $('#afPlek').value = open.plek || '';
      $('#afTijd').value = open.tijd || '';
      $('#afEind').value = open.eind || '';
      $('#afHerhaal').value = open.herhaal || 'geen';
      $('#afHerhaalTot').value = open.herhaalTot || '';
      $('#afHerinner').value = open.herinner == null ? '' : String(open.herinner);
      $('#afNotitie').value = open.notitie || '';
      $('#afWeg').style.display = open.id && !eco ? '' : 'none';
      // een uitnodiging bewerkt u niet: u zegt ja of nee, en de organisator
      // houdt de afspraak zelf bij
      $('#uitnodigingBlok').style.display = uitnodiging ? '' : 'none';
      if (uitnodiging) $('#uitnodigingTekst').textContent = 'Uitnodiging van ' + open.van +
        (open.status === 'ja' ? ' · u zei: ik kom.' : open.status === 'nee' ? ' · u zei: ik kom niet.' : ' · nog niet beantwoord.');
      zetVelden(!eco && !uitnodiging);
      $('#deelBlok').style.display = open.id && !eco && !uitnodiging ? '' : 'none';
      tekenDeelnemers();
      $('#afScrim').classList.add('open');
      if (!eco && !uitnodiging) $('#afTitel').focus();
    }
    function dicht() { $('#afScrim').classList.remove('open'); open = null; }
    function tekenDeelnemers() {
      var d = (open && open.deelnemers) || [];
      $('#afDeelnemers').innerHTML = d.length ? d.map(function (x) {
        var st = x.status === 'ja' ? 'komt' : x.status === 'nee' ? 'komt niet' : 'nog geen antwoord';
        return '<div class="deeln"><span>' + esc(x.codenaam) + '</span><span class="st' +
          (x.status === 'ja' ? ' ja' : '') + '">' + st + '</span></div>';
      }).join('') : '<p class="stil" style="margin-top:.4rem;">Nog niemand uitgenodigd. De ander ziet alleen uw codenaam.</p>';
    }

    $('#afDicht').addEventListener('click', dicht);
    $('#afBewaar').addEventListener('click', function () {
      var b = { id: open && open.id, titel: $('#afTitel').value, datum: $('#afDatum').value,
        tijd: $('#afTijd').value || null, eind: $('#afEind').value || null, plek: $('#afPlek').value,
        notitie: $('#afNotitie').value, herhaal: $('#afHerhaal').value,
        herhaalTot: $('#afHerhaalTot').value || null,
        herinner: $('#afHerinner').value === '' ? null : +$('#afHerinner').value };
      api('bewaar', b).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('Bewaard.'); dicht(); herlaad();
      });
    });
    $('#afWeg').addEventListener('click', function () {
      if (!open || !open.id) return;
      if (!confirm(open.van ? 'Deze uitnodiging weghalen? De organisator ziet dan: komt niet.'
        : 'Deze afspraak verwijderen?' + ((open.deelnemers || []).length ? ' De genodigden zien hem vervallen.' : ''))) return;
      api('verwijder', { id: open.id }).then(function () { meld('Verwijderd.'); dicht(); herlaad(); });
    });
    $('#afNodig').addEventListener('click', function () {
      var code = $('#afCode').value.trim();
      if (!code || !open || !open.id) return;
      api('uitnodig', { id: open.id, codenaam: code }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('#afCode').value = '';
        open.deelnemers = r.body.deelnemers || [];
        tekenDeelnemers();
        meld('Uitgenodigd; de ander krijgt een seintje.');
      });
    });
    var antwoord = function (ja) {
      return function () {
        api('antwoord', { id: open.id, ja: ja }).then(function (r) {
          if (r.body.error) return meld(r.body.error);
          meld(ja ? 'Doorgegeven: u komt.' : 'Doorgegeven: u komt niet.');
          dicht(); herlaad();
        });
      };
    };
    $('#afJa').addEventListener('click', antwoord(true));
    $('#afNee').addEventListener('click', antwoord(false));

    return { toon: toon, dicht: dicht };
  }

  window.RTGAgendaPaneel = { maak: maak };
})();
