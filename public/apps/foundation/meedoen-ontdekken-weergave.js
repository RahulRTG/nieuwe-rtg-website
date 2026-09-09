/* Alle tekst uit de publieke Foundation-bron wordt hier ontsnapt. De kaart is
   een rustig overzicht van locatienamen en doet niet alsof zij coordinaten kent. */
(function (w, d) {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function glyph(n) { return '<i data-glyf="' + n + '"></i>'; }
  function vul(el) { try { if (w.RTGGlyf) w.RTGGlyf.vul(el); } catch (e) {} }
  function datum(v) {
    if (!v) return 'Datum volgt';
    var x = new Date(v + 'T12:00:00');
    return isNaN(x.getTime()) ? String(v) : new Intl.DateTimeFormat('nl-NL', { weekday:'short', day:'numeric', month:'short' }).format(x);
  }
  function key(a) { return [a.naam, a.wanneer, a.tijd, a.locatie].join('|'); }
  function stadKeuzes(staat) {
    var doel = d.getElementById('moSteden'), dialoog = d.getElementById('moStadDialoogLijst'), steden = staat.steden || [];
    if (!steden.length) { doel.innerHTML = '<div class="mo-leeg"><b>Er is nog geen stadsafdeling open.</b><span>Zodra een afdeling start, verschijnt die hier.</span></div>'; dialoog.innerHTML = '<div class="mo-leeg">Er is nog geen stadsafdeling open.</div>'; return; }
    var knoppen = steden.map(function (s) {
      var aan = s.id === staat.stadId;
      return '<button type="button" data-mo-stad="' + esc(s.id) + '" aria-pressed="' + aan + '"><span>' + esc((s.naam || '?').slice(0, 1)) + '</span><b>RTF ' + esc(s.naam) + '</b><small>' + esc((s.soorten || []).join(' · ') || 'Open afdeling') + '</small></button>';
    }).join('');
    doel.innerHTML = knoppen; dialoog.innerHTML = knoppen;
  }
  function activiteit(a, staat, compact) {
    var bewaard = staat.interesses.indexOf(key(a)) >= 0;
    return '<button type="button" class="mo-activiteit' + (compact ? ' mo-activiteit--compact' : '') + '" data-mo-activiteit="' + esc(key(a)) + '">' +
      '<span class="mo-datum"><b>' + esc(a.wanneer ? new Date(a.wanneer + 'T12:00:00').getDate() : '•') + '</b><small>' + esc(a.wanneer ? new Intl.DateTimeFormat('nl-NL', { month:'short' }).format(new Date(a.wanneer + 'T12:00:00')) : 'later') + '</small></span>' +
      '<span class="mo-activiteit__copy"><small>' + esc(a.soort || 'Activiteit') + '</small><b>' + esc(a.naam || 'Activiteit') + '</b><em>' + esc([datum(a.wanneer), a.tijd, a.locatie].filter(Boolean).join(' · ')) + '</em></span>' +
      '<span class="mo-activiteit__eind">' + (bewaard ? '<small>Bewaard</small>' : (!a.vol && Number(a.plekVrij) ? '<small>' + esc(a.plekVrij) + ' vrij</small>' : '')) + glyph('rechterhand') + '</span></button>';
  }
  function lijsten(staat) {
    var alles = staat.gefilterd || [], voor = (staat.stadData && staat.stadData.activiteiten || []).slice(0, 3);
    d.getElementById('moVandaagLijst').innerHTML = staat.stadId ? (voor.length ? voor.map(function (a) { return activiteit(a, staat, true); }).join('') : '<div class="mo-leeg"><b>Er staat nu niets open.</b><span>FoundationOS vult deze plek pas wanneer er echt aanbod is.</span></div>') : '<div class="mo-leeg">Kies eerst uw stad. Daarna laten we alleen echt open aanbod zien.</div>';
    d.getElementById('moActiviteiten').innerHTML = staat.stadId ? (alles.length ? alles.map(function (a) { return activiteit(a, staat, false); }).join('') : '<div class="mo-leeg"><b>Niets gevonden in deze periode.</b><span>Probeer Deze week of kijk later opnieuw.</span></div>') : '<div class="mo-leeg">Kies eerst uw stad.</div>';
    vul(d.getElementById('moVandaagLijst')); vul(d.getElementById('moActiviteiten'));
  }
  function kaart(staat) {
    var doel = d.getElementById('moKaartPunten'), plekken = [], bron = staat.stadData && staat.stadData.activiteiten || [];
    bron.forEach(function (a) { if (a.locatie && plekken.indexOf(a.locatie) < 0) plekken.push(a.locatie); });
    doel.innerHTML = '<p>Dit is een overzicht van genoemde plekken, geen routekaart.</p>' + (plekken.length ? plekken.slice(0, 4).map(function (p, i) { return '<span class="mo-pin mo-pin--' + (i + 1) + '">' + glyph('gps') + '<b>' + esc(p) + '</b></span>'; }).join('') : '<div class="mo-kaartleeg">Nog geen openbare locatie genoemd.</div>');
    vul(doel);
  }
  function kansen(staat) {
    var projecten = staat.stadData && staat.stadData.projecten || [], campagnes = staat.campagnes || [];
    d.getElementById('moProjecten').innerHTML = staat.stadId ? (projecten.length ? projecten.map(function (p) { return '<article><i data-glyf="werk"></i><div><small>' + esc(p.soort || 'Project') + '</small><b>' + esc(p.naam) + '</b><span>' + esc(p.doelgroep || 'Voor de buurt') + '</span></div></article>'; }).join('') : '<div class="mo-leeg">Hier staat nu geen openbaar project.</div>') : '<div class="mo-leeg">Kies eerst uw stad.</div>';
    d.getElementById('moCampagnes').innerHTML = campagnes.length ? campagnes.map(function (c) { return '<article><i data-glyf="hart"></i><div><small>' + esc((c.steden || []).join(', ') || 'Landelijk') + '</small><b>' + esc(c.naam) + '</b><span>' + esc(c.doel || '') + '</span></div></article>'; }).join('') : '<div class="mo-leeg">Er loopt nu geen openbare campagne.</div>';
    vul(d.getElementById('moProjecten')); vul(d.getElementById('moCampagnes'));
  }
  function detail(a, staat) {
    if (!a) return;
    d.getElementById('moDetailTitel').textContent = a.naam || 'Activiteit';
    d.getElementById('moDetailBeeld').classList.toggle('is-creatief', /kunst|atelier|schilder|creatief|maken/i.test((a.naam || '') + ' ' + (a.soort || '')));
    d.getElementById('moDetailMeta').innerHTML = '<p>' + glyph('agenda') + '<span><small>Wanneer</small><b>' + esc([datum(a.wanneer), a.tijd].filter(Boolean).join(' · ')) + '</b></span></p><p>' + glyph('gps') + '<span><small>Waar</small><b>' + esc(a.locatie || 'Locatie volgt') + '</b></span></p><p>' + glyph('vrienden') + '<span><small>Plek</small><b>' + esc(a.vol ? 'Op dit moment vol' : (Number(a.plekVrij) ? a.plekVrij + ' plekken vrij' : 'Vraag naar een plek')) + '</b></span></p>';
    d.getElementById('moDetailUitleg').textContent = 'Kom zoals u bent. De organisator vertelt u ter plekke wat u nodig heeft en helpt u rustig op weg.';
    var bewaard = staat.interesses.indexOf(key(a)) >= 0, knop = d.getElementById('moInteresse');
    knop.disabled = !!a.vol; knop.classList.toggle('is-bewaard', bewaard);
    knop.innerHTML = a.vol ? 'Deze activiteit is vol' : (bewaard ? 'Belangstelling bewaard ' + glyph('hart') : 'Ik wil meedoen ' + glyph('rechterhand'));
    d.getElementById('moPlekStatus').innerHTML = bewaard ? '<b>Deze activiteit staat bij Mijn buurt.</b><span>Uw belangstelling is op dit toestel bewaard. Uw plek is nog niet gereserveerd.</span>' : '';
    vul(d.getElementById('moDetailMeta')); vul(knop);
  }
  function alles(staat) {
    stadKeuzes(staat); lijsten(staat); kaart(staat); kansen(staat);
    var s = (staat.steden || []).find(function (x) { return x.id === staat.stadId; });
    d.getElementById('moBuurtPlaats').textContent = s ? 'Open aanbod in RTF ' + s.naam + '.' : 'Kies uw stad om te zien waar u welkom bent.';
  }
  w.RTGMeedoenWeergave = { alles:alles, detail:detail, key:key, esc:esc };
})(window, document);
