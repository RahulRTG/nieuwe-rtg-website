(function (R) {
  'use strict';
  var $ = R.$, $$ = R.$$, maak = R.maak;
  function voegChat(tekst, soort) {
    var p = maak('p', 'chatregel ' + soort, tekst); $('#rahulChat').appendChild(p); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function vraagRahul(vraag) {
    var tekst = String(vraag || '').trim(); if (!tekst) return;
    voegChat(tekst, 'gebruiker');
    if (!R.token) { voegChat('Log eerst in. Ik toon geen verzonnen reisantwoord zonder uw beveiligde ledensessie.', 'assistent'); return; }
    voegChat('Ik controleer uw actuele RTG-gegevens…', 'assistent');
    var wacht = $('#rahulChat').lastElementChild;
    R.api('/api/fluister', { q: tekst, context: { wereld: 'travel', scherm: R.staat.blad } })
      .then(function (r) { wacht.textContent = r.antwoord || 'Er kwam geen antwoord terug.'; })
      .catch(function (e) { wacht.textContent = e.message; });
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
  $('#groet').textContent = (uur < 12 ? 'GOEDEMORGEN' : uur < 18 ? 'GOEDEMIDDAG' : 'GOEDEAVOND') + (R.token ? '' : ' · INLOG NODIG');
  initMoment();
  var eersteBlad = location.hash.replace('#', '');
  R.wisselBlad(['vandaag', 'reizen', 'taxi', 'rahul'].includes(eersteBlad) ? eersteBlad : 'vandaag', false);
  R.laadReizen(false); R.laadLopendeRit();
})(window.RTGReizen);
