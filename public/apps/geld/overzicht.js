/* Stand 1 -- Overzicht. Was de hele inhoud van geld.html toen RTG Geld nog
   alleen een samenhanglaag was; nu is het de eerste stand van de echte app.

   Dit blijft ALLEEN LEZEN. De andere standen doen het werk (betalen,
   verrekenen, toezeggen); dit overzicht leest /api/geld/wereld en wijst. Een
   regel wijst nu naar een STAND (#wallet) in plaats van naar een losse pagina:
   de pagina's zijn omleidingen geworden, en binnen de app is een hash genoeg. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var SOORT = { saldo: 'Saldo', verrekening: 'Verrekening', toezegging: 'Toezegging' };

  var ic = function (p, n) {
    return '<svg width="' + (n || 16) + '" height="' + (n || 16) + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };
  var ICO = {
    bel: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    vink: '<path d="M20 6 9 17l-5-5"/>',
    mens: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
  };

  var WD = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function dagdeel(dd) {
    if (!dd) return null;
    var x = new Date(dd + 'T00:00:00');
    if (isNaN(x)) return { wd: '', nr: dd, mnd: '' };
    return { wd: WD[x.getDay()], nr: String(x.getDate()).padStart(2, '0'), mnd: MND[x.getMonth()] };
  }

  function tekenBalk(t) {
    /* Wachten is geen aandacht: loos alarm leert mensen de balk te negeren op
       de dag dat hij wel klopt. Dezelfde afweging als in RTG Reizen. */
    var alarm = (t.aandacht || 0) + (t.onbekend || 0);
    var b = $('#ovBalk');
    if (alarm) {
      b.removeAttribute('data-rustig');
      $('#ovBalkTeken').innerHTML = ic(ICO.bel, 22);
      $('#ovBalkKop').textContent = 'Er vraagt iets aandacht';
      var s = [];
      if (t.aandacht) s.push(t.aandacht + ' ' + (t.aandacht === 1 ? 'vraagt' : 'vragen') + ' actie');
      if (t.onbekend) s.push(t.onbekend + ' met onbekende status');
      $('#ovBalkZin').textContent = s.join(', ');
      return;
    }
    b.setAttribute('data-rustig', '');
    $('#ovBalkTeken').innerHTML = ic(ICO.vink, 22);
    $('#ovBalkKop').textContent = t.regels ? 'Uw stand' : 'Niets openstaand';
    $('#ovBalkZin').textContent = t.wachtend
      ? t.wachtend + ' ' + (t.wachtend === 1 ? 'ligt' : 'liggen') + ' bij een ander'
      : (t.regels ? 'geen actie nodig' : 'geen open zaken');
  }

  function regelHtml(x) {
    var Geld = w.Geld, esc = Geld.esc;
    var dd = dagdeel(x.wanneer);
    var feiten = [];
    if (Number.isFinite(x.centen)) feiten.push('<span class="open">' + Geld.euro(x.centen) + '</span>');
    if (x.door) feiten.push('<span>' + ic(ICO.mens) + esc(x.door) + '</span>');
    return '<a class="reis" href="' + esc(x.link) + '"' + (x.sig ? ' data-sig="' + esc(x.sig) + '"' : '') + '>' +
      '<span class="stip"></span>' +
      '<span class="doos">' +
        '<span class="dag">' + (dd
          ? '<span class="wd">' + esc(dd.wd) + '</span>' +
            '<span class="nr rtg-datum">' + esc(dd.nr) + '</span>' +
            '<span class="mnd">' + esc(dd.mnd) + '</span>'
          : '<span class="mnd">&mdash;</span>') + '</span>' +
        '<span class="kern">' +
          '<h3>' + esc(x.titel || SOORT[x.soort] || 'Regel') + '</h3>' +
          (x.status ? '<span class="status"><span class="rtg-status"' +
            (x.sig ? ' data-sig="' + esc(x.sig) + '"' : '') +
            ' data-teken="' + esc(x.teken || '·') + '">' + esc(x.status) + '</span></span>' : '') +
          (feiten.length ? '<span class="feiten">' + feiten.join('<span aria-hidden="true">·</span>') + '</span>' : '') +
          '<span class="onder">' +
            (x.kenmerk ? '<button class="rtg-ref" type="button" data-ref="' + esc(x.kenmerk) +
              '" title="Kopieer kenmerk">' + esc(x.kenmerk) + '</button>' : '') +
            '<span class="bron">' + esc(x.app) + '</span>' +
          '</span>' +
        '</span>' +
      '</span>' +
      '<span class="pijl" aria-hidden="true">&rsaquo;</span>' +
    '</a>';
  }

  async function laad() {
    var Geld = w.Geld;
    try {
      var data = await Geld.api('/api/geld/wereld');
      tekenBalk(data.telling || {});
      var r = data.regels || [];
      $('#ovTel').textContent = r.length ? r.length + (r.length === 1 ? ' regel' : ' regels') : '';
      $('#ovLijst').innerHTML = r.length
        ? r.map(regelHtml).join('')
        : '<p class="stil">Er staat niets open. Uw wallet, verrekeningen en toezeggingen komen hier vanzelf te staan.</p>';
      /* Eerlijk over wat er niet gemeten is: een leeg geldbeeld dat eigenlijk
         een storing is, laat iemand een uitgave doen die hij niet had gedaan. */
      $('#ovStilte').innerHTML = (data.stil || []).length
        ? '<p class="stil">Niet opgehaald: ' + Geld.esc((data.stil || []).join(', ')) +
          '. Dit beeld is dus niet compleet.</p>'
        : '';
    } catch (e) {
      $('#ovBalkKop').textContent = 'Niet ingelogd';
      $('#ovBalkZin').textContent = '';
      $('#ovLijst').innerHTML = '<p class="stil">' + w.Geld.esc(e.message) + ' Log eerst in via de leden-app.</p>';
    }
  }

  /* Kenmerk klikken kopieert (ONTWERP.md: de referentie is wat een
     professional zoekt). Een keer aan document, want de regels worden bij elke
     verversing opnieuw getekend. */
  d.addEventListener('click', function (e) {
    var b = e.target.closest('.rtg-ref');
    if (!b) return;
    e.preventDefault();
    try {
      navigator.clipboard.writeText(b.dataset.ref);
      var oud = b.textContent; b.textContent = 'gekopieerd';
      setTimeout(function () { b.textContent = oud; }, 1200);
    } catch (err) { /* geen klembord */ }
  });

  V.standen.push({
    id: 'overzicht',
    naam: 'Overzicht',
    uitleg: 'Hoe u er financieel voor staat, uit alle standen tegelijk. Werken doet u in de stand zelf.',
    html:
      '<div class="balk" id="ovBalk" data-rustig>' +
        '<span class="teken" id="ovBalkTeken"></span>' +
        '<span><span class="kop" id="ovBalkKop">Laden</span>' +
        '<span class="zin rtg-ceremonie" id="ovBalkZin">&nbsp;</span></span>' +
      '</div>' +
      '<div id="ovStilte"></div>' +
      '<div class="regkop"><h2>Uw stand</h2><span class="tel" id="ovTel"></span></div>' +
      '<div id="ovLijst"><p class="stil">Laden...</p></div>',
    start: laad
  });
})(window, document);
