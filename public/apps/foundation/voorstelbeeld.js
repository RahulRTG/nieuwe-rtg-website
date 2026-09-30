/* Voorstellen van partijen bij een kwestie -- EEN weergave voor de burger en het
   kantoor (POLITIEK.md par. 9, PARTY_PRESENTATION_PARITY).

   De volgorde komt van de server en wordt hier NIET veranderd: hij schuift elke
   dag een plaats op en is voor iedereen gelijk. Elke partij krijgt dezelfde
   vorm: dezelfde velden, dezelfde aannamelijst op dezelfde plek, en wie niets
   aanleverde krijgt dezelfde neutrale zin -- geen rood vakje, geen grijze kaart.
   Er wordt niets geteld en niets gewogen. */
(function () {
  'use strict';
  const CATEGORIE = { geregistreerd: 'geregistreerde aanduiding', deelnemer: 'neemt deel zonder geregistreerde aanduiding' };

  function aannames(l, esc) {
    return '<ul class="verloop">' + l.map(a => '<li>' + esc(a.vraag) + ' ' +
      (a.stand === 'onbekend' ? '<i>onbekend</i>' : esc(a.waarde) + ' <span class="meta">(bron: ' + esc(a.bron) + ')</span>') + '</li>').join('') + '</ul>';
  }

  function voorstel(v, esc) {
    return '<div class="ronde"><b>' + esc(v.titel) + '</b><br>' + esc(v.tekst) +
      '<br><span class="meta">Bron: ' + esc(v.bron) + '</span>' +
      v.toelichtingen.map(t => '<br>Toelichting: ' + esc(t.tekst) + (t.bron ? ' <span class="meta">(bron: ' + esc(t.bron) + ')</span>' : '')).join('') +
      aannames(v.aannames, esc) + '</div>';
  }

  function html(vs, esc) {
    if (!vs || !vs.plekken || !vs.plekken.length) return '';
    const plekken = vs.plekken.map(p => '<div class="ruimte"><b>' + esc(p.partij.aanduiding) + '</b>' +
      '<div class="meta">' + esc(CATEGORIE[p.partij.categorie] || p.partij.categorie) + ' · ' + esc(p.partij.niveau) +
      (p.partij.stand === 'uitgeschreven' ? ' · uitgeschreven' : '') + '</div>' +
      (p.voorstellen.length ? p.voorstellen.map(v => voorstel(v, esc)).join('') : '<p class="ronde">' + esc(p.afwezig) + '</p>') + '</div>').join('');
    return '<details class="ruimte voorstellen"><summary class="kknop">Voorstellen van partijen</summary>' +
      '<p class="uitleg ruimte">' + esc(vs.volgorde.regel) + (vs.volgorde.vandaagBeginBij ? ' Vandaag begint de lijst bij ' + esc(vs.volgorde.vandaagBeginBij) + '.' : '') + '</p>' +
      plekken + '</details>';
  }

  window.VoorstelBeeld = { html };
})();
