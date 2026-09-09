(function (w) {
  'use strict';
  function tekst(v, terugval) { return v ? v : terugval; }
  function geld(n) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0); }
  function vlak(nr, kop, inhoud, wijd) {
    var U = w.DecisionRoomUtil;
    return '<section class="dr-afwegvlak' + (wijd ? ' wijd' : '') + '"><small>' + nr + ' · ' + U.veilig(kop) + '</small><p>' + U.veilig(inhoud) + '</p></section>';
  }
  function bronnen(x) {
    var U = w.DecisionRoomUtil, lijst = [];
    if (x.bronMailId) lijst.push(['RTMail', 'bronbericht ' + x.bronMailId]);
    if (x.documentId) lijst.push(['RTDocs', x.documentTitel || 'gekoppeld document']);
    if (x.projectId) lijst.push(['RTG One', 'project ' + x.projectId]);
    lijst.push(['Decision Room', 'besluitdossier ' + x.id]);
    return lijst.map(function (b) { return '<span class="dr-bron"><b>' + U.veilig(b[0]) + '</b>' + U.veilig(b[1]) + '</span>'; }).join('');
  }
  function teken(root, x, staat) {
    var vak = root.querySelector('#drAfweging'), U = w.DecisionRoomUtil;
    if (!x) { vak.innerHTML = '<div class="dr-leeg"><h2>Geen besluit gekozen.</h2><p>Ga naar de besluitagenda en open een voorstel.</p><button class="dr-secundair" type="button" data-dr-open="agenda">Naar agenda</button></div>'; return; }
    var stemmen = Array.isArray(x.stemmen) ? x.stemmen.length : 0;
    vak.innerHTML = '<div class="dr-dossierkop"><div><span class="dr-label">' + U.veilig(x.type || 'operations') + '</span><h2>' + U.veilig(x.titel) + '</h2><p>Voorgelegd door ' + U.veilig(x.aanvragerLabel || 'onbekend') + '</p></div><div class="dr-dossierroute"><span>Vier-ogenroute</span><b>' + stemmen + ' van ' + Number(x.vereist || 1) + ' beoordelingen</b><span>Huis · ' + U.veilig((staat.huis || 'rtg').toUpperCase()) + '</span></div></div>' +
      '<div class="dr-afweggrid">' +
      vlak('01', 'Voorstel', x.reden, true) +
      vlak('02', 'Waarom nu', tekst(x.waaromNu, 'Er is geen afzonderlijke urgentie opgegeven. De onderbouwing hierboven blijft leidend.')) +
      vlak('03', 'Financieel', Number(x.bedrag) > 0 ? geld(x.bedrag) + ' opgegeven financiële impact.' : 'Geen financieel bedrag opgegeven.') +
      vlak('04', 'Risico', 'Risico ' + Number(x.risico || 0) + ' van 5. ' + tekst(x.beheersing, 'Er is nog geen aparte beheersmaatregel beschreven.')) +
      vlak('05', 'Alternatief', tekst(x.alternatief, 'Er is geen afzonderlijk alternatief vastgelegd.')) +
      vlak('06', 'Omkeerbaarheid', x.omkeerbaar ? 'De aanvrager heeft deze keuze als omkeerbaar aangemerkt.' : 'Deze keuze is niet volledig omkeerbaar en vraagt daarom extra controle.') + '</div>' +
      '<div class="dr-bronnen">' + bronnen(x) + '</div><aside class="dr-rahul"><i>RA</i><span><b>Rahul ordent, niet beslist.</b><span>De informatie is bij elkaar gebracht; bron, rol en menselijke bevestiging blijven zichtbaar.</span></span></aside>' +
      '<div class="dr-doorgaan"><button class="dr-primair" type="button" data-dr-open="besluit">Naar besluit &amp; borging →</button></div>';
  }
  w.DecisionRoomAfweging = Object.freeze({ teken: teken });
}(window));
