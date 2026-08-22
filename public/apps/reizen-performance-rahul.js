(function (R) {
  'use strict';
  var $ = R.$, $$ = R.$$, maak = R.maak;
  function rahulAntwoord(vraag) {
    var q = vraag.toLowerCase();
    if (q.includes('taxi') || q.includes('rit') || q.includes('chauffeur')) {
      var naar = /naar\s+(.+)$/i.exec(vraag); R.wisselBlad('taxi');
      if (naar && naar[1]) { $('#naarVeld').value = naar[1].replace(/[?.!]+$/, ''); R.staat.bestemming = null; $('#naarVeld').dispatchEvent(new Event('input')); }
      return 'Ik heb Taxi geopend. Kies de bestemming en controleer voertuig, moment en prijsindicatie.';
    }
    if (q.includes('reis') || q.includes('vlucht')) { R.wisselBlad('reizen'); return 'Uw complete reisoverzicht staat open.'; }
    if (q.includes('actie') || q.includes('betaling')) { R.wisselBlad('vandaag'); return 'De villa-betaling staat als eerstvolgende actie klaar.'; }
    return 'Ik kan uw reizen openen, een taxi klaarzetten of de open acties tonen.';
  }
  function voegChat(tekst, soort) {
    var p = maak('p', 'chatregel ' + soort, tekst); $('#rahulChat').appendChild(p); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function vraagRahul(vraag) {
    var tekst = String(vraag || '').trim(); if (!tekst) return;
    voegChat(tekst, 'gebruiker'); var antwoord = rahulAntwoord(tekst);
    setTimeout(function () { voegChat(antwoord, 'assistent'); }, 260);
  }
  function initMoment() {
    var d = new Date(Date.now() + 3600000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    $('#vertrekLater').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  $('#rahulForm').addEventListener('submit', function (e) { e.preventDefault(); var i = $('#rahulVraag'); vraagRahul(i.value); i.value = ''; });
  $$('[data-vraag]').forEach(function (b) { b.addEventListener('click', function () { vraagRahul(b.dataset.vraag); }); });
  $('[data-rahul-snel]').addEventListener('submit', function (e) { e.preventDefault(); var i = $('#rahulSnel');
    if (!i.value.trim()) { R.wisselBlad('rahul'); return; } R.wisselBlad('rahul'); vraagRahul(i.value); i.value = ''; });

  var uur = new Date().getHours();
  $('#groet').textContent = (uur < 12 ? 'GOEDEMORGEN' : uur < 18 ? 'GOEDEMIDDAG' : 'GOEDEAVOND') + (R.token ? '' : ' · DEMOSTAND');
  initMoment();
  var eersteBlad = location.hash.replace('#', '');
  R.wisselBlad(['vandaag', 'reizen', 'taxi', 'rahul'].includes(eersteBlad) ? eersteBlad : 'vandaag', false);
  R.laadReizen(false); R.laadLopendeRit();
})(window.RTGReizen);
