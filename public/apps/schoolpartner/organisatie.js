/* RTG School Partner: de organisatie -- vestigingen, opleidingen met hun
   capaciteit, de indeling van klassen over vestigingen, en de
   schooljaarovergang.

   De overgang is het gevoeligste van dit scherm en staat er daarom in twee
   stappen, precies zoals de server hem kent: eerst een VOORSTEL dat je kunt
   lezen en corrigeren, dan een uitvoering die alleen op precies dat voorstel
   loopt en het woord OVERGANG vraagt. Dat woord typen is geen ceremonie: dit
   verplaatst honderden kinderen tegelijk naar een andere klas, en een knop die
   je per ongeluk twee keer indrukt is precies hoe niemand meer weet waar een
   leerling vandaan kwam.

   Een klas zonder vervolgklas verlaat de school; het scherm zegt dat met
   zoveel woorden in het voorstel, want in een lijst van paden is een leeg
   veld te makkelijk over het hoofd te zien.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolOrganisatie = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, VOORSTEL = null;

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dOrganisatie');
    if (!wortel) return;
    teken();
  }

  function teken() {
    A('/school/organisatie', sleutels()).then(function (r) {
      var d = r.body;
      if (d.error) { wortel.innerHTML = ''; return; }
      var vest = d.vestigingen || [], opl = d.opleidingen || [], klassen = d.klassen || [];
      var vestOpties = vest.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.naam) + '</option>'; }).join('');
      var klasOpties = klassen.map(function (k) { return '<option value="' + esc(k.code) + '">' + esc(k.naam) + '</option>'; }).join('');

      wortel.innerHTML = '<div class="deel">Organisatie</div>' +
        '<div class="kaart"><div class="kop">Vestigingen</div>' +
        (vest.map(function (v) {
          return '<div class="item"><span>' + esc(v.naam) + ' <span class="stil">· ' + esc(v.id) +
            (v.plaats ? ' · ' + esc(v.plaats) : '') + '</span></span><span class="stil">' +
            v.leerlingen + ' leerlingen · ' + v.klassen + ' klassen</span></div>';
        }).join('') || '<p class="stil">Nog geen vestigingen; de school is er zelf een.</p>') +
        '<div class="rij" style="margin-top:.5rem;">' +
        '<input class="veld" id="orVNaam" maxlength="80" placeholder="Naam" aria-label="Naam van de vestiging">' +
        '<input class="veld" id="orVPlaats" maxlength="60" placeholder="Plaats" aria-label="Plaats">' +
        '<input class="veld" id="orVTel" maxlength="24" placeholder="Telefoon" aria-label="Telefoon" style="flex:0 1 10rem;">' +
        '<button class="knop p" id="orVestiging" type="button">Zet vestiging</button></div></div>' +

        '<div class="kaart"><div class="kop">Opleidingen en capaciteit</div>' +
        (opl.map(function (o) {
          return '<div class="item"><span>' + esc(o.naam) + ' <span class="stil">' +
            (o.niveau ? '· ' + esc(o.niveau) + ' ' : '') + (o.duur ? '· ' + esc(o.duur) : '') + '</span></span>' +
            '<span class="' + (o.vol ? 'tag' : 'stil') + '">' + o.bezet + (o.plaatsen ? ' van ' + o.plaatsen : '') +
            (o.wachtlijst ? ' · ' + o.wachtlijst + ' op de wachtlijst' : '') + (o.vol ? ' · vol' : '') + '</span></div>';
        }).join('') || '<p class="stil">Nog geen opleidingen.</p>') +
        '<div class="rij" style="margin-top:.5rem;">' +
        '<input class="veld" id="orONaam" maxlength="80" placeholder="Naam" aria-label="Naam van de opleiding">' +
        '<input class="veld" id="orONiveau" maxlength="40" placeholder="Niveau" aria-label="Niveau" style="flex:0 1 9rem;">' +
        '<input class="veld" id="orOPlaatsen" type="number" min="0" placeholder="Plaatsen" aria-label="Aantal plaatsen" style="flex:0 1 8rem;">' +
        '<button class="knop p" id="orOpleiding" type="button">Zet opleiding</button></div>' +
        '<p class="stil">De capaciteit rekent uit of het vol is; wie er geplaatst wordt beslist de administratie.</p></div>' +

        (vest.length ? '<div class="kaart"><div class="kop">Klas naar vestiging</div>' +
          '<div class="rij"><select class="veld" id="orKlas" aria-label="Welke klas">' + klasOpties + '</select>' +
          '<select class="veld" id="orKVest" aria-label="Naar welke vestiging">' + vestOpties + '</select>' +
          '<button class="knop" id="orKlasVest" type="button">Deel in</button></div></div>' : '') +

        '<div class="kaart enterprise-breed"><div class="kop">Schooljaarovergang</div>' +
        '<p class="stil">Stap 1: geef per klas aan waar hij heen gaat. Laat je een klas leeg, dan verlaten die leerlingen de school.</p>' +
        (klassen.map(function (k) {
          return '<div class="item"><span>' + esc(k.naam) + ' <span class="stil">· ' + esc(k.code) + ' · ' +
            (k.leerlingen || 0) + ' leerlingen</span></span>' +
            '<select class="veld" data-pad="' + esc(k.code) + '" aria-label="Waar gaat ' + esc(k.naam) + ' heen" style="flex:0 1 12rem;">' +
            '<option value="">(verlaat de school)</option>' + klasOpties + '</select></div>';
        }).join('') || '<p class="stil">Nog geen klassen.</p>') +
        '<div class="rij" style="margin-top:.6rem;"><button class="knop" id="orVoorstel" type="button">Maak het voorstel</button></div>' +
        '<div id="orVoorstelUit"></div></div>';
      knoppen();
    });
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    var na = function (r, bericht) { meld(r.body.error || bericht); if (!r.body.error) teken(); };

    q('orVestiging').addEventListener('click', function () {
      if (!q('orVNaam').value.trim()) return meld('Geef de vestiging een naam.');
      A('/school/vestiging/zet', sleutels({ naam: q('orVNaam').value, plaats: q('orVPlaats').value, telefoon: q('orVTel').value }))
        .then(function (r) { na(r, 'Vestiging vastgelegd.'); });
    });
    q('orOpleiding').addEventListener('click', function () {
      if (!q('orONaam').value.trim()) return meld('Geef de opleiding een naam.');
      A('/school/opleiding/zet', sleutels({ naam: q('orONaam').value, niveau: q('orONiveau').value,
        plaatsen: q('orOPlaatsen').value === '' ? null : Number(q('orOPlaatsen').value) }))
        .then(function (r) { na(r, 'Opleiding vastgelegd.'); });
    });
    var kv = q('orKlasVest');
    if (kv) kv.addEventListener('click', function () {
      A('/school/klas/vestiging', sleutels({ klasCode: q('orKlas').value, vestiging: q('orKVest').value }))
        .then(function (r) { na(r, 'Klas ingedeeld.'); });
    });
    q('orVoorstel').addEventListener('click', function () {
      var paden = Array.prototype.map.call(document.querySelectorAll('[data-pad]'), function (s) {
        return { van: s.dataset.pad, naar: s.value };
      });
      A('/school/schooljaar/voorstel', sleutels({ paden: paden })).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        VOORSTEL = r.body.voorstelId;
        var weg = (r.body.regels || []).filter(function (x) { return !x.naar; }).length;
        q('orVoorstelUit').innerHTML = '<p class="stil" style="margin-top:.6rem;">' + esc(r.body.uitleg) + '</p>' +
          '<div class="kpis" style="margin:.5rem 0;">' +
          [['Leerlingen in het voorstel', r.body.aantal], ['Zonder vervolgklas', weg]]
            .map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
          (r.body.regels || []).slice(0, 40).map(function (x) {
            return '<div class="item"><span>' + esc(x.naam) + ' <span class="stil">· ' + esc(x.van) + '</span></span>' +
              '<span class="' + (x.naar ? 'stil' : 'tag') + '">' + esc(x.wat) + '</span></div>';
          }).join('') +
          '<div class="rij" style="margin-top:.6rem;">' +
          '<input class="veld" id="orBevestig" maxlength="10" placeholder="Typ OVERGANG" aria-label="Bevestig met het woord OVERGANG" style="flex:0 1 12rem;">' +
          '<button class="knop p" id="orVoerUit" type="button">Voer de overgang uit</button></div>';
        q('orVoerUit').addEventListener('click', function () {
          A('/school/schooljaar/voer-uit', sleutels({ voorstelId: VOORSTEL, bevestig: q('orBevestig').value.trim() }))
            .then(function (r2) {
              if (r2.body.error) return meld(r2.body.error);
              meld(r2.body.verplaatst + ' leerlingen over, ' + r2.body.zonderVervolgklas + ' zonder vervolgklas.');
              VOORSTEL = null; teken();
            });
        });
      });
    });
  }

  return { bind: bind };
})();
