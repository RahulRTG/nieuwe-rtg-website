/* Stand Waarde, deel 3 van 3: de eigen geldgrens en de registratie.

   Leunt op w.RTGGeldDeel.waarde (de portefeuille) en w.RTGGeldDeel.waardeTerug
   (het laden). Routes: /api/geld/grens, /api/geld/grens/zet, /api/geld/grens/weg. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var G = w.Geld;
  var $ = function (s) { return d.querySelector(s); };
  var D = (w.RTGGeldDeel || {}).waarde || {};
  var T = (w.RTGGeldDeel || {}).waardeTerug || {};

  function vul(id, html) { var e = $(id); if (e) e.innerHTML = html; }

  /* ---------- de eigen geldgrens ---------- */
  /* Dit is de enige regelsoort in dit huis die WEIGERT in plaats van
     waarschuwt, en het scherm zegt dat ook. Een lid dat denkt een melding in te
     stellen en later voor een gesloten deur staat, heeft iets anders gekregen
     dan hij vroeg. */
  function tekenGrens(lijst) {
    var rijen = (lijst || []).length
      ? lijst.map(function (g) {
        return '<div class="wd-rij"><span>' + (g.periode === 'dag' ? 'Per dag' : 'Per maand') +
          (g.aan ? '' : ' <span class="stil">· uit</span>') +
          (g.wachtTot ? '<br><span class="stil">Er staat een versoepeling klaar voor ' + D.datum(g.wachtTot) + '.</span>' : '') +
          '</span><span>' + G.euro(g.centen) +
          ' <button class="knop" data-grens-weg="' + G.esc(g.id) + '" type="button">Weg</button></span></div>';
      }).join('')
      : '<p class="stil">U heeft geen eigen grens ingesteld.</p>';
    vul('#wdGrens', rijen +
      '<label class="lbl" for="wdGrensBedrag">Nieuwe grens in euro\'s</label>' +
      '<input id="wdGrensBedrag" type="text" inputmode="decimal" placeholder="0,00">' +
      '<label class="lbl" for="wdGrensPeriode">Per</label>' +
      '<select id="wdGrensPeriode"><option value="maand">maand</option><option value="dag">dag</option></select>' +
      '<button class="knop h-mt40" id="wdGrensGa" type="button">Grens instellen</button>' +
      '<p class="stil h-mt40">Deze grens <b>weigert</b> een betaling; hij waarschuwt niet. Hij geldt over al uw potjes samen, dus hij is niet te omzeilen door uit een ander potje te betalen. Strenger maken werkt meteen.</p>');
    var ga = $('#wdGrensGa'); if (ga) ga.addEventListener('click', grensZet);
    Array.prototype.forEach.call(d.querySelectorAll('[data-grens-weg]'), function (b) {
      b.addEventListener('click', function () { grensWeg(b.getAttribute('data-grens-weg')); });
    });
  }

  async function laadGrens() {
    try { tekenGrens((await G.api('/api/geld/grens')).grenzen); }
    catch (e) { vul('#wdGrens', '<p class="stil">' + G.esc(e.message) + '</p>'); }
  }
  async function grensZet() {
    var centen = G.centen(($('#wdGrensBedrag') || {}).value);
    if (centen == null) { G.melding('Vul een bedrag in.'); return; }
    try {
      var r = await G.api('/api/geld/grens/zet',
        { centen: centen, periode: ($('#wdGrensPeriode') || {}).value || 'maand' });
      G.melding(r.geparkeerd ? (r.uitleg || 'Deze versoepeling gaat later in.') : 'De grens staat.');
      laadGrens();
    } catch (e) { G.melding(e.message); }
  }
  async function grensWeg(id) {
    try {
      var r = await G.api('/api/geld/grens/weg', { id: id });
      G.melding(r.geparkeerd ? (r.uitleg || 'De grens vervalt later.') : 'De grens is weg.');
      laadGrens();
    } catch (e) { G.melding(e.message); }
  }

  function start() {
    if (D.stijl) D.stijl();
    if (T.laadPortefeuille) T.laadPortefeuille();
    if (T.laadGraaf) T.laadGraaf();
    if (T.laadTerug) T.laadTerug();
    laadGrens();
  }

  V.standen.push({
    id: 'waarde',
    naam: 'Waarde',
    uitleg: 'Al uw potjes naast elkaar: wat vrij besteedbaar is, wat gebonden is en waaraan, wat er vaststaat, waar het heen ging &mdash; en hoe u het terugkrijgt op uw eigen rekening.',
    html:
      '<div id="wdTotalen"><p class="stil">Laden...</p></div>' +
      '<h2>Uw potjes</h2><div id="wdPosities"></div>' +
      '<div id="wdVast"></div>' +
      '<div id="wdGraaf"></div>' +
      '<h2>Terugstorten naar uw eigen rekening</h2><div id="wdTerug"><p class="stil">Laden...</p></div>' +
      '<h2>Uw eigen geldgrens</h2><div id="wdGrens"><p class="stil">Laden...</p></div>',
    start: start
  });
})(window, document);
