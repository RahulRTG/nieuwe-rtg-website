/* De drie rustige voordeuren van RTG Geld. Ze lezen de bestaande bronnen en
   sturen voor het echte werk door naar de bestaande standen; geen tweede
   bank-, wallet- of verdeellogica. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var esc = function (s) { return w.Geld.esc(s); };
  var euro = function (c) { return w.Geld.euro(c); };

  function fout(e) {
    return '<div class="gx-empty"><b>Dit beeld is niet beschikbaar.</b><br>' +
      esc(e && e.message || 'Probeer het later opnieuw.') +
      (e && e.status === 401 ? ' <a href="/apps/app.html">Log in via LivingOS.</a>' : '') + '</div>';
  }

  function rij(titel, sub, rechts, link) {
    return '<a class="gx-row" href="' + link + '"><span><b>' + esc(titel) + '</b><small>' +
      esc(sub || '') + '</small></span><strong>' + esc(rechts || 'Open') + ' &#8594;</strong></a>';
  }

  function betaalActies() {
    return '<div class="gx-actions">' +
      '<a class="gx-action" href="#bank"><b>&#8644;</b><span>Overboeken</span></a>' +
      '<a class="gx-action" href="#wbw"><b>&#9744;</b><span>Betaalverzoek</span></a>' +
      '<a class="gx-action" href="#rtgcode"><b>&#9638;</b><span>RTG-code</span></a></div>';
  }

  async function betalenStart() {
    var vak = $('#gxBetalenData');
    var uitslagen = await Promise.allSettled([
      w.Geld.api('/api/wbw/mijn'), w.Geld.api('/api/bank/vastelasten')
    ]);
    var groepen = uitslagen[0].status === 'fulfilled' ? uitslagen[0].value.groepen || [] : [];
    var lasten = uitslagen[1].status === 'fulfilled' ? uitslagen[1].value.vasteLasten || [] : [];
    var html = '<section class="gx-section"><div class="gx-section-head"><h2>Samen betalen</h2>' +
      '<a href="#wbw">Bekijk alles &#8594;</a></div><div class="gx-card">' +
      (groepen.length ? groepen.slice(0, 3).map(function (g) {
        var saldo = Number(g.mijnSaldo) || 0;
        return rij(g.naam, g.leden + ' personen', saldo > 0 ? 'U krijgt ' + euro(saldo) :
          saldo < 0 ? 'U betaalt ' + euro(Math.abs(saldo)) : 'In balans', '#wbw');
      }).join('') : '<div class="gx-empty">Nog geen gedeelde lijstjes. Begin er een met mensen uit uw Salon.</div>') +
      '</div></section><section class="gx-section"><div class="gx-section-head"><h2>Vaste lasten</h2>' +
      '<a href="#bank">Open Bank &#8594;</a></div><div class="gx-card">' +
      (lasten.length ? lasten.slice(0, 4).map(function (l) {
        return rij(l.oms || l.tegen || 'Vaste last', (l.maanden || 0) + ' maanden herkend', euro(l.centen), '#bank');
      }).join('') : '<div class="gx-empty">Nog geen terugkerende betaling herkend.</div>') + '</div></section>';
    if (!groepen.length && !lasten.length && uitslagen[0].status === 'rejected') html = fout(uitslagen[0].reason);
    vak.innerHTML = html;
  }

  function horizon(label, waarde) {
    return '<div class="gx-horizon"><span class="bedrag">' +
      (Number.isFinite(Number(waarde)) ? euro(Number(waarde)) : 'Niet berekend') +
      '</span><small>' + label + ' · verwachting</small></div>';
  }

  function doelen(potten) {
    if (!potten.length) return '<div class="gx-empty">Nog geen spaardoelen. Maak uw eerste doel hieronder.</div>';
    return potten.slice(0, 5).map(function (p) {
      var doel = Math.max(1, Number(p.doelCenten) || 1), stand = Math.max(0, Number(p.standCenten) || 0);
      var pct = Math.min(100, Math.round(stand / doel * 100));
      return '<div class="gx-goal"><div class="gx-goal-head"><b>' + esc(p.naam) + '</b><span>' +
        pct + '% · <span class="bedrag">' + euro(stand) + ' van ' + euro(doel) + '</span></span></div>' +
        '<progress value="' + stand + '" max="' + doel + '" aria-label="' + esc(p.naam) + ': ' + pct + ' procent"></progress></div>';
    }).join('');
  }

  async function vooruitLaad() {
    var vak = $('#gxVooruitData');
    try {
      var r = await Promise.all([w.Geld.api('/api/geld/cockpit'), w.Geld.api('/api/geld/beleid')]);
      var v = r[0].vooruitblik || {}, potten = r[1].potten || [];
      vak.innerHTML = '<div class="gx-forecast" aria-label="Financiële verwachtingen">' +
        horizon('Over 7 dagen', v.d7) + horizon('Over 30 dagen', v.d30) + horizon('Over 90 dagen', v.d90) +
        '</div><section class="gx-section"><div class="gx-section-head"><h2>Doelen</h2>' +
        '<button class="gx-privacy" id="gxDoelOpen" type="button">Nieuw doel</button></div>' +
        '<div class="gx-card">' + doelen(potten) + '</div>' +
        '<form class="gx-form" id="gxDoelForm" hidden><label for="gxDoelNaam">Naam</label>' +
        '<input id="gxDoelNaam" maxlength="40" required placeholder="Bijv. reis of buffer">' +
        '<label for="gxDoelBedrag">Doelbedrag in euro</label><input id="gxDoelBedrag" inputmode="decimal" required placeholder="0,00">' +
        '<button class="gx-primary" type="submit">Spaardoel bewaren</button></form></section>' +
        '<p class="gx-note">Verwachtingen komen uit uw geldbeeld; het zijn geen gegarandeerde saldi. Geld verlaat RTG nooit zonder uw bevestiging.</p>';
      $('#gxDoelOpen').addEventListener('click', function () { $('#gxDoelForm').hidden = !$('#gxDoelForm').hidden; });
      $('#gxDoelForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var centen = w.Geld.naarCenten($('#gxDoelBedrag').value), naam = $('#gxDoelNaam').value.trim();
        if (!naam || centen == null || centen <= 0) return w.Geld.melding('Vul een naam en een doelbedrag in.');
        try { await w.Geld.api('/api/geld/pot/zet', { naam: naam, doelCenten: centen }); await vooruitLaad(); }
        catch (x) { w.Geld.melding(x.message); }
      });
    } catch (e) { vak.innerHTML = fout(e); }
  }

  function meerStart() {
    var groepen = [
      ['Dagelijks', ['wallet', 'waarde', 'bank', 'wbw', 'rtgcode']],
      ['Inzicht en balans', ['kosten', 'metier', 'balans']],
      ['Vermogen en nalaten', ['labfonds', 'mecenaat', 'logboek', 'nalatenschap']]
    ];
    $('#gxMeerData').innerHTML = groepen.map(function (groep) {
      return '<section class="gx-section"><h2>' + groep[0] + '</h2><div class="gx-more">' +
        groep[1].map(function (id) { var s = V.standen.find(function (x) { return x.id === id; });
          return s ? '<a href="#' + esc(s.id) + '"><b>' + esc(s.naam) + '</b><small>' +
            String(s.uitleg || '').replace(/<[^>]+>/g, '').slice(0, 90) + '</small></a>' : ''; }).join('') +
        '</div></section>';
    }).join('');
  }

  /* Overzicht bestond al en bezit de echte cockpitlogica. Alleen zijn deur en
     privacybediening worden hier aangekleed, zodat de rekenlaag onaangeraakt
     blijft en overzichtc.js onder zijn eigen modulegrens blijft. */
  var overzicht = V.standen.find(function (s) { return s.id === 'overzicht'; });
  if (overzicht) {
    var overzichtStart = overzicht.start;
    overzicht.html = '<div id="ovAlles"><section class="gx-intro"><p class="gx-ey">Vandaag</p>' +
      '<h1>Weten wat er kan. Zonder zelf te rekenen.</h1>' +
      '<p>Wat vrij is, wat eraan komt en wat aandacht vraagt.</p>' +
      '<button class="gx-privacy" id="gxBedragen" type="button" aria-pressed="false">Bedragen verbergen</button></section>' +
      overzicht.html.replace(/^<div id="ovAlles">/, '');
    overzicht.start = function () {
      overzichtStart();
      var verberg = $('#gxBedragen');
      if (verberg) verberg.addEventListener('click', function () {
        var aan = $('#ovAlles').classList.toggle('gx-verberg');
        verberg.setAttribute('aria-pressed', String(aan));
        verberg.textContent = aan ? 'Bedragen tonen' : 'Bedragen verbergen';
      });
    };
  }

  V.standen.push({ id: 'betalen', naam: 'Betalen', uitleg: 'Zelf betalen, samen verdelen of een code gebruiken, vanuit één rustige ingang.',
    html: '<section class="gx-intro"><p class="gx-ey">Geld regelen</p><h1>Betalen zonder gedoe.</h1><p>Zelf, samen of met een code. U houdt de regie.</p></section>' +
      betaalActies() + '<div id="gxBetalenData"><div class="gx-empty">Uw betalingen worden geladen.</div></div>' +
      '<a class="gx-primary" href="/apps/pay.html">Open RTG Pay +</a>', start: betalenStart });
  V.standen.push({ id: 'vooruit', naam: 'Vooruit', uitleg: 'Doelen en verwachtingen geven ruimte voor later, zonder een voorspelling als zekerheid te verkopen.',
    html: '<section class="gx-intro"><p class="gx-ey">Uw ruimte vooruit</p><h1>Plannen geeft rust.</h1><p>Doelen, vaste lasten en ruimte voor later in één rustig beeld.</p></section>' +
      '<div id="gxVooruitData"><div class="gx-empty">Uw vooruitblik wordt geladen.</div></div>', start: vooruitLaad });
  V.standen.push({ id: 'meer', naam: 'Meer', uitleg: 'Alle vertrouwde Geld-onderdelen blijven hier bereikbaar.',
    html: '<section class="gx-intro"><p class="gx-ey">Alles van RTG Geld</p><h1>Meer wanneer u het nodig heeft.</h1><p>Uw dagelijkse scherm blijft rustig; de volledige gereedschapskist blijft dichtbij.</p></section><div id="gxMeerData"></div>', start: meerStart });
})(window, document);
