(function (R) {
  'use strict';
  var $ = R.$, maak = R.maak, S = R.staat;
  function feitenBevestiging(opdracht) {
    var doel = $('#bevestigingFeiten'); doel.textContent = '';
    var feiten = [
      ['REFERENTIE', opdracht.ref || 'Niet ontvangen'],
      ['PRIJS', Number.isFinite(opdracht.prijs) ? R.eur(opdracht.prijs) : 'Na bevestiging'],
      ['DUUR', opdracht.minuten ? opdracht.minuten + ' min' : $('#ritDuur').textContent.trim()],
      ['STATUS', opdracht.status || 'Aangevraagd']
    ];
    feiten.forEach(function (f) { var s = maak('span'); s.appendChild(maak('small', '', f[0])); s.appendChild(maak('b', '', f[1])); doel.appendChild(s); });
  }
  function toonBevestiging(opdracht) {
    $('#bevestigingLabel').textContent = 'RIT AANGEVRAAGD';
    $('#bevestigingTitel').textContent = 'We zoeken uw chauffeur.';
    $('#bevestigingTekst').textContent = 'De prijs staat nu vast. Zodra een chauffeur de rit accepteert, ziet u hier voertuig, aankomsttijd en live positie.';
    feitenBevestiging(opdracht); R.dialogOpen($('#ritBevestiging')); R.toonLopendeRit(opdracht);
  }
  function herstelKnop() { var b = $('#boekRit'); b.disabled = false; R.kiesVoertuig($('.voertuig.actief')); }
  function boekRit(e) {
    e.preventDefault();
    var van = R.gekozenVertrek(), naar = R.gekozenBestemming();
    if (!van) { R.toast('Kies een geldig vertrekpunt of gebruik uw locatie.'); $('#vanVeld').focus(); return; }
    if (!naar) { R.toast('Kies een bestemming uit de voorstellen.'); $('#naarVeld').focus(); return; }
    var vertrek = null;
    if (S.moment === 'later') { vertrek = $('#vertrekLater').value;
      if (!vertrek || new Date(vertrek).getTime() <= Date.now()) { R.toast('Kies een vertrektijd in de toekomst.'); $('#vertrekLater').focus(); return; } }
    var body = { ritsoort: S.moment === 'later' ? 'gepland' : 'direct', categorie: S.voertuig,
      van: van, naar: naar, reizigers: S.personen, bagage: S.koffers,
      kinderzitjes: $('#kinderzitje').checked ? 1 : 0,
      stad: (S.bestemming && S.bestemming.stad) || null, vertrek: vertrek };
    var knop = $('#boekRit'); knop.disabled = true; knop.querySelector('span').textContent = 'VEILIG AANVRAGEN…';
    if (!R.token) {
      R.toast('Log eerst in. Zonder ledensessie wordt geen rit aangemaakt.'); herstelKnop();
      return;
    }
    R.api('/api/mob/vraag', body).then(function (d) { toonBevestiging(d.opdracht || d); R.laadReizen(false); })
      .catch(function (fout) { R.toast(fout.message); }).finally(herstelKnop);
  }
  $('#taxiForm').addEventListener('submit', boekRit);
  $('[data-sluit-bevestiging]').addEventListener('click', function () { R.dialogSluit($('#ritBevestiging')); });
})(window.RTGReizen);
