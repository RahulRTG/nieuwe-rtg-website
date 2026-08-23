/* RTG Werk OS (scherm): de organisatiestand -- en wat er NIET waar is.

   DIT SCHERM IS HET TEGENOVERGESTELDE VAN EEN BADGEMUUR. De weggehaalde
   enterprise-schil zette "Enterprise beveiligd · versleutelde werkruimte ·
   audit gereed · Commercial" op het scherm zonder dat er iets achter zat. De
   reparatie was een bewijspoort op de server (kern/tenant/bewijs.js), waar een
   bewering een OBJECT is met een bron of een reden. Dit scherm is de andere
   helft van die reparatie: het laat de bron zien, en het laat de beweringen
   zien die vandaag NIET waar zijn -- met de reden erbij.

   DRIE REGELS DIE DIT SCHERM NIET MAG BREKEN

   1. NIETS WORDT HIER BEDACHT. Elke regel komt uit /api/tenant/status. Er staat
      in dit bestand geen enkele vaste tekst die een eigenschap belooft; wat de
      server niet stuurt, komt er niet op.
   2. WAT OP `mag: false` STAAT WORDT GETOOND, NIET VERBORGEN. Dat is de hele
      bedoeling: "eigen domein" en "SLA" staan er altijd, altijd op nee, met de
      reden. Een lijst die alleen de groene vinkjes toont, is dezelfde
      badgemuur met een betere herkomst.
   3. GEEN CIJFER DAT DE METING NIET KAN DRAGEN. De beschikbaarheid wordt
      platformbreed gemeten en niet per organisatie. Daarom staat er geen
      percentage maar de zin waarom het er niet staat.

   De stand hoort bij het BEHEER van de werkruimte. Wie het recht `werkruimte`
   mist krijgt de gewone rechtenweigering te zien -- geen leeg scherm en geen
   uitlog. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }
  function esc(t) { return K.esc(t); }

  function rij(l, r) {
    return '<div class="item"><span>' + esc(l) + '</span><span class="stil">' + esc(r) + '</span></div>';
  }
  function leeg(el, tekst) { if (el) el.innerHTML = '<p class="stil">' + esc(tekst) + '</p>'; }

  function contract(st) {
    var el = $('stContract');
    var l = st.levensloop || {};
    var c = st.contract;
    var uit = rij('Organisatie', st.naam + ' (' + st.org + ')') + rij('Presentatie', st.modus) +
      rij('Levensloop', l.stand + (l.sinds ? ' sinds ' + String(l.sinds).slice(0, 10) : '')) +
      (l.bewaarTot ? rij('Bewaard tot', String(l.bewaarTot).slice(0, 10)) : '');
    if (!c) {
      el.innerHTML = uit + '<p class="stil">Er loopt geen contract voor deze organisatie, dus er geldt geen pakket en geen grens.</p>';
      return;
    }
    el.innerHTML = uit + rij('Pakket', c.naam + (c.tot ? ' · tot ' + c.tot : ' · voor onbepaalde tijd')) +
      rij('Werkruimtes', c.verbruik.werkruimtes + ' van ' + c.grenzen.werkruimtes) +
      rij('Verzoeken dit uur', c.verbruik.apiDitUur + ' van ' + c.grenzen.apiPerUur) +
      '<p class="stil">Niet afgedwongen, en dus geen belofte: ' +
      esc((c.nietAfgedwongen || []).map(function (n) { return n.grens; }).join(', ')) + '.</p>';
  }

  /* De twee lijsten komen uit DEZELFDE bron en worden hier alleen gescheiden op
     `mag`. Zo kan er geen bewering in de ene lijst staan die de andere niet
     kent, en verdwijnt er niets door een filter dat iemand vergeet bij te
     werken. */
  function beweringen(st) {
    var alle = st.beweringen || [];
    var waar = alle.filter(function (b) { return b.mag; });
    var niet = alle.filter(function (b) { return !b.mag; });

    if (!waar.length) leeg($('stWaar'), 'Er is vandaag niets dat wij over deze organisatie hard kunnen maken. Dat is geen storing; het staat er zo omdat het zo is.');
    else $('stWaar').innerHTML = waar.map(function (b) { return rij(b.tekst, b.bron || ''); }).join('');

    if (!niet.length) leeg($('stNietWaar'), 'Niets. Elke bewering in deze lijst heeft vandaag een bron.');
    else $('stNietWaar').innerHTML = niet.map(function (b) { return rij(b.tekst, b.reden || ''); }).join('');
  }

  /* De SLA is een BEREKENING en geen mening: vier voorwaarden, en zolang er een
     ontbreekt is er geen SLA. Ze staan hier los opgesomd, want "nee" zonder te
     zeggen wat er ontbreekt is een dichte deur zonder sleutelgat. */
  function sla(st) {
    var b = (st.beweringen || []).filter(function (x) { return x.id === 'sla'; })[0];
    var v = (b && b.voorwaarden) || [];
    if (!v.length) return leeg($('stSla'), 'De server stuurt hier geen voorwaarden mee.');
    $('stSla').innerHTML = v.map(function (x) {
      return '<div class="item"><span>' + (x.ja ? '✓ ' : '· ') + esc(x.wat) + '</span>' +
        '<span class="stil">' + esc(x.reden) + '</span></div>';
    }).join('') + '<p class="stil">' + esc(b.reden || 'Alle vier de voorwaarden zijn vervuld.') + '</p>';
  }

  function platform(st) {
    var p = st.platformbreed || {};
    $('stPlatform').innerHTML = rij('Wat', p.wat || '') + rij('Waar', p.waar || '') +
      '<p class="stil">' + esc(p.nietGemeten || '') + '</p>';
  }

  window.RTGWerkStatus = {
    laad: function () {
      var s = K.sessie();
      if (!s) return;
      $('stLet').textContent = 'Laden…';
      return fetch('/api/tenant/status', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
        .then(function (r) { return r.json().catch(function () { return {}; })
          .then(function (b) { return { status: r.status, body: b }; }); })
        .then(function (r) {
          var st = r.body && r.body.status;
          if (r.status === 403) {
            $('stKop').textContent = 'Deze stand hoort bij het beheer.';
            $('stLet').textContent = r.body.error || '';
            ['stContract', 'stWaar', 'stNietWaar', 'stSla', 'stPlatform']
              .forEach(function (id) { leeg($(id), 'Niet zichtbaar zonder het recht "werkruimte".'); });
            return;
          }
          if (!st) {
            $('stKop').textContent = 'Geen organisatie.';
            $('stLet').textContent = (r.body && r.body.let) ||
              'Deze werkruimte hoort bij geen enkele organisatie met een contract.';
            ['stContract', 'stWaar', 'stNietWaar', 'stSla', 'stPlatform']
              .forEach(function (id) { leeg($(id), 'Er is geen tenantstand om te tonen.'); });
            return;
          }
          $('stKop').textContent = st.naam + '.';
          $('stLet').textContent = st.let || '';
          contract(st); beweringen(st); sla(st); platform(st);
        })
        .catch(function () {
          $('stLet').textContent = 'De stand is nu niet op te halen. Er staat hier met opzet niets in de plaats.';
        });
    }
  };
})();
