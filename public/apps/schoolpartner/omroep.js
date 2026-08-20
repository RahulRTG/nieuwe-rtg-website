/* RTG School Partner: alles wat de school naar buiten zegt -- de nieuwsbrief
   (met de vertaling naar de thuistalen die in de doelgroep voorkomen), de
   herinneringen die uit de gegevens zelf volgen, de vakgroep als intern
   prikbord, en de toestemmingsvragen aan ouders.

   Twee dingen die het scherm van de server overneemt:

   1. EEN HERINNERING GAAT HOOGUIT EEN KEER PER DAG. De lijst zegt per regel of
      hij vandaag al is verstuurd, en de server slaat de rest over. Een systeem
      dat drie keer op een dag hetzelfde stuurt, leert mensen niet te lezen.
   2. GEEN ANTWOORD IS GEEN TOESTEMMING. In het overzicht staan alleen de namen
      van wie ja zei; de rest is een aantal. Dat is precies de fout die een
      schoolsysteem niet mag maken -- stilte als ja lezen.

   Herinneringen over geld en verlof gaan bewust NIET als klasmededeling de
   deur uit: dan leest de hele klas mee over het geld van een gezin.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolOmroep = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, VAK = null;

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dOmroep');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([
      A('/school/nieuwsbrief/lijst', sleutels()), A('/school/herinneringen', sleutels()),
      A('/school/toestemming/overzicht', sleutels()), A('/school/vakgroep', sleutels({ vak: VAK || 'algemeen' })),
      A('/school/school/overzicht', sleutels())
    ]).then(function (r) {
      var brieven = r[0].body, her = r[1].body, toe = r[2].body, vak = r[3].body, sch = r[4].body;
      if (brieven.error) { wortel.innerHTML = ''; return; }
      var klasOpties = '<option value="">Alle klassen</option>' + (sch.klassen || []).map(function (k) {
        return '<option value="' + esc(k.code) + '">' + esc(k.naam) + '</option>'; }).join('');

      wortel.innerHTML = '<div class="deel">Naar ouders en team</div>' +
        nieuwsbriefKaart(brieven, klasOpties) + herinneringKaart(her) +
        toestemmingKaart(toe, klasOpties) + vakgroepKaart(vak);
      knoppen();
    });
  }

  function nieuwsbriefKaart(d, klasOpties) {
    var rijen = (d.nieuwsbrieven || []).slice(0, 8).map(function (b) {
      return '<div class="item"><span>' + esc(b.titel) + ' <span class="stil">· ' + esc(String(b.at).slice(0, 10)) +
        ' · ' + esc(b.door) + '</span></span><span class="stil">' + b.klassen + ' klassen' +
        (b.talen.length ? ' · vertaald naar ' + esc(b.talen.join(', ')) : '') + '</span></div>';
    }).join('') || '<p class="stil">Nog geen nieuwsbrief verstuurd.</p>';

    return '<div class="kaart enterprise-breed"><div class="kop">Nieuwsbrief</div>' + rijen +
      '<div class="rij h-mt60">' +
      '<input class="veld" id="omTitel" maxlength="100" placeholder="Titel" aria-label="Titel van de nieuwsbrief">' +
      '<select class="veld h-kolom11" id="omKlas" aria-label="Voor welke klas">' + klasOpties + '</select></div>' +
      '<div class="rij h-mt40">' +
      '<textarea class="veld" id="omTekst" rows="3" maxlength="4000" placeholder="De tekst" aria-label="Tekst van de nieuwsbrief"></textarea>' +
      '<button class="knop p" id="omStuur" type="button">Verstuur</button></div>' +
      '<p class="stil">De brief wordt een keer per thuistaal vertaald die in de doelgroep voorkomt; het Nederlands blijft er altijd naast staan.</p></div>';
  }

  function herinneringKaart(d) {
    var rijen = (d.herinneringen || []).slice(0, 20).map(function (h) {
      return '<div class="item"><span>' + esc(h.tekst) + ' <span class="stil">· ' + esc(h.soort) + '</span></span>' +
        (h.alGestuurdVandaag ? '<span class="tag">vandaag al verstuurd</span>' : '') + '</div>';
    }).join('') || '<p class="stil">Niets te herinneren; alles staat bij.</p>';

    return '<div class="kaart"><div class="kop">Herinneringen (' + (d.aantal || 0) + ')</div>' + rijen +
      '<div class="rij h-mt60">' +
      '<select class="veld h-kolom11" id="omSoort" aria-label="Welke soort herinneringen">' +
      '<option value="">Alle soorten</option><option value="huiswerk">Huiswerk</option><option value="toets">Toets</option>' +
      '<option value="factuur">Factuur</option><option value="verlof">Verlof</option></select>' +
      '<button class="knop" id="omHerinner" type="button">Verstuur de herinneringen</button></div>' +
      '<p class="stil">Hooguit een keer per dag per herinnering. Geld en verlof gaan naar de werklijst van de administratie, niet naar de klas: anders leest de hele klas mee over het geld van een gezin.</p></div>';
  }

  function toestemmingKaart(d, klasOpties) {
    var rijen = (d.toestemmingen || []).slice(0, 12).map(function (t) {
      return '<div class="item h-boven"><span><b>' + esc(t.titel) + '</b> <span class="stil">' +
        (t.klasCode ? '· ' + esc(t.klasCode) + ' ' : '') + (t.tot ? '· tot ' + esc(t.tot) : '') + '</span><br>' +
        '<span class="stil">' + t.toestemming.length + ' gaven toestemming' +
        (t.geweigerd ? ' · ' + t.geweigerd + ' weigerden' : '') +
        (t.ingetrokken ? ' · ' + t.ingetrokken + ' trokken in' : '') +
        ' · ' + t.geenAntwoord + ' gaven geen antwoord</span></span></div>';
    }).join('') || '<p class="stil">Nog geen toestemmingsvragen.</p>';

    return '<div class="kaart"><div class="kop">Toestemming vragen</div>' + rijen +
      '<div class="rij h-mt60">' +
      '<input class="veld" id="omTTitel" maxlength="100" placeholder="Waarvoor (bijv. foto op de site)" aria-label="Titel van de vraag">' +
      '<select class="veld h-kolom11" id="omTKlas" aria-label="Voor welke klas">' + klasOpties + '</select></div>' +
      '<div class="rij h-mt40">' +
      '<input class="veld" id="omTUitleg" maxlength="800" placeholder="Leg uit waar de toestemming precies voor is" aria-label="Uitleg">' +
      '<button class="knop p" id="omToestemming" type="button">Vraag het</button></div>' +
      '<p class="stil">' + esc(d.uitleg || '') + '</p></div>';
  }

  function vakgroepKaart(d) {
    var vakken = (d.vakken || []).map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === d.vak ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
    var berichten = (d.berichten || []).slice(0, 10).map(function (b) {
      return '<div class="item"><span>' + esc(b.tekst) + '</span><span class="stil">' + esc(b.van) + ' · ' +
        esc(String(b.at).slice(0, 10)) + '</span></div>';
    }).join('') || '<p class="stil">Nog geen berichten in deze vakgroep.</p>';

    return '<div class="kaart"><div class="kop">Vakgroep · ' + esc(d.vak) + '</div>' +
      '<div class="rij"><select class="veld h-kolom11" id="omVakKies" aria-label="Welke vakgroep">' +
      vakken + '</select><input class="veld" id="omVakNieuw" maxlength="40" placeholder="Of een nieuwe vakgroep" aria-label="Nieuwe vakgroep">' +
      '<button class="knop" id="omVakOpen" type="button">Open</button></div>' +
      '<div class="h-mt50">' + berichten + '</div>' +
      '<div class="rij h-mt50">' +
      '<input class="veld" id="omVakTekst" maxlength="1000" placeholder="Bericht aan de vakgroep" aria-label="Bericht aan de vakgroep">' +
      '<button class="knop" id="omVakStuur" type="button">Plaats</button></div></div>';
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    var na = function (r, bericht) { meld(r.body.error || bericht); if (!r.body.error) teken(); };

    q('omStuur').addEventListener('click', function () {
      if (!q('omTitel').value.trim() || !q('omTekst').value.trim()) return meld('Een nieuwsbrief heeft een titel en een tekst nodig.');
      A('/school/nieuwsbrief', sleutels({ titel: q('omTitel').value, tekst: q('omTekst').value, klasCode: q('omKlas').value }))
        .then(function (r) { na(r, 'Nieuwsbrief verstuurd.'); });
    });
    q('omHerinner').addEventListener('click', function () {
      A('/school/herinnering/verstuur', sleutels({ soort: q('omSoort').value || undefined }))
        .then(function (r) { na(r, 'Verstuurd.'); });
    });
    q('omToestemming').addEventListener('click', function () {
      if (!q('omTTitel').value.trim() || !q('omTUitleg').value.trim()) return meld('Geef de vraag een titel en leg uit waarvoor de toestemming is.');
      A('/school/toestemming/vraag', sleutels({ titel: q('omTTitel').value, uitleg: q('omTUitleg').value, klasCode: q('omTKlas').value }))
        .then(function (r) { na(r, 'De vraag staat klaar bij de ouders.'); });
    });
    q('omVakOpen').addEventListener('click', function () {
      VAK = q('omVakNieuw').value.trim() || q('omVakKies').value;
      teken();
    });
    q('omVakStuur').addEventListener('click', function () {
      if (!q('omVakTekst').value.trim()) return meld('Schrijf eerst een bericht.');
      A('/school/vakgroep', sleutels({ vak: VAK || q('omVakKies').value || 'algemeen', tekst: q('omVakTekst').value }))
        .then(function (r) { na(r, 'Geplaatst.'); });
    });
  }

  return { bind: bind };
})();
