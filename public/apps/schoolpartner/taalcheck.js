/* RTG School Partner: de Language Independence Test.

   Zes vragen: drie in het Nederlands en dezelfde drie opnieuw gesteld in de
   thuistaal. Niet vertaald maar opnieuw gesteld uit dezelfde bouwstenen, zodat
   het antwoord niet verandert -- alleen de zin. Gaat het in de eigen taal wel
   goed, dan zit de taal in de weg en niet de stof.

   DRIE DINGEN DIE DIT SCHERM NIET DOET:
   - het draait niet bij een taalvak. Daar is de zin zelf wat u meet, en dan
     haalt deze vergelijking de meting weg. De server weigert dat met een uitleg
     en dit scherm toont die uitleg;
   - het trekt geen conclusie. Wat eruit komt is een zin met "lijkt" erin en een
     zetje naar een gesprek. Geen taalniveau, geen score, geen etiket;
   - het bewaart niets. De uitkomst staat nergens en hangt niet aan dit kind.

   Zelfde SPart-patroon; app.js roept SPart.taalcheck() aan. */
window.SPart = window.SPart || {};
window.SPart.taalcheck = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };
  var BEZIG = null;

  kl('/school/klas').then(function (r) {
    var vak = q('taalcheckVorm');
    if (!vak || r.body.error) return;
    var lln = (r.body.leerlingen || []).filter(function (l) { return l.taal; });
    if (!lln.length) {
      vak.innerHTML = '<p class="stil">Er is geen kind in deze klas met een tweede taal ingesteld. Zonder tweede taal valt er niets te vergelijken.</p>';
      return;
    }
    vak.innerHTML = '<div class="rij">' +
      '<select class="veld" id="tcLeerling" aria-label="Welke leerling">' +
      lln.map(function (l) { return '<option value="' + esc(l.sleutel) + '">' + esc(l.naam) + ' (' + esc(l.taal) + ')</option>'; }).join('') +
      '</select>' +
      '<input class="veld" id="tcDoel" maxlength="60" placeholder="Leerdoel-id" aria-label="Leerdoel">' +
      '<button class="knop" id="tcStart" type="button">Vergelijk</button></div>' +
      '<div id="tcUit" class="stil" style="margin-top:.5rem;"></div>';
    q('tcStart').addEventListener('click', start);
  });

  function start() {
    var leerling = q('tcLeerling').value, doel = q('tcDoel').value.trim();
    if (!doel) return meld('Geef het leerdoel dat u wilt vergelijken.');
    kl('/school/taalcheck/start', { leerling: leerling, doel: doel }).then(function (r) {
      if (r.body.error) { q('tcUit').textContent = r.body.error; return; }
      BEZIG = leerling;
      vraag(r.body);
      q('tcUit').insertAdjacentHTML('afterbegin', '<div class="stil">' + esc(r.body.uitleg) + '</div>');
    });
  }

  function vraag(d) {
    q('tcUit').innerHTML =
      '<div class="stil">Vraag ' + d.nr + ' van ' + d.totaal + ' &middot; ' +
      (d.ronde === 'nl' ? 'Nederlands' : 'eigen taal') + '</div>' +
      '<div style="margin:.4rem 0;font-size:1.02rem;">' + esc(d.vraag) + '</div>' +
      '<div class="rij"><input class="veld" id="tcIn" placeholder="Antwoord van de leerling" aria-label="Antwoord">' +
      '<button class="knop" id="tcStuur" type="button">Volgende</button></div>';
    q('tcStuur').addEventListener('click', function () { antwoord(q('tcIn').value); });
    q('tcIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') antwoord(this.value); });
  }

  function antwoord(tekst) {
    if (!BEZIG) return;
    kl('/school/taalcheck/antwoord', { leerling: BEZIG, antwoord: tekst }).then(function (r) {
      var d = r.body;
      if (d.error) { q('tcUit').textContent = d.error; BEZIG = null; return; }
      if (!d.klaar) return vraag(d);
      BEZIG = null;
      q('tcUit').innerHTML =
        '<div><b>' + esc(d.uitkomst.zin) + '</b></div>' +
        '<div class="stil">Nederlands ' + d.goedNl + ' van ' + d.totaalPerRonde +
        ' &middot; eigen taal ' + d.goedThuis + ' van ' + d.totaalPerRonde + '</div>' +
        '<div style="margin-top:.35rem;">' + esc(d.uitkomst.watNu) + '</div>' +
        '<div class="stil" style="margin-top:.35rem;">' + esc(d.uitleg) + '</div>';
    });
  }
};
