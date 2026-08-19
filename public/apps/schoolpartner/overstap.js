/* RTG School Partner: de werkende overstap tussen twee RTG-scholen.

   School A zet een pakket klaar met een code; school B haalt het op. Drie
   dingen die een losse code niet geeft, en ze staan alle drie op dit scherm:

     het pakket is GEADRESSEERD -- alleen de genoemde school kan het ophalen;
     het VERLOOPT -- de datum staat erbij;
     het is WEG NA OPHALEN -- een overdracht is geen archief bij de verzender.

   Het pakket dat over gaat is hetzelfde pakket als in ./overdracht.js:
   dezelfde klassen, dezelfde restlijst, en zorg gaat ook hier niet mee. Er
   bestaat geen tweede route met soepeler regels.

   ER STAAT GEEN KNOP DIE NAAR EDU-V OF ENTREE STUURT. Die verbinding is er
   niet, en zolang dat zo is hoort er niet te worden gedaan alsof.

   Zelfde SPart-patroon; app.js roept SPart.overstap() aan. */
window.SPart = window.SPart || {};
window.SPart.overstap = function () {
  var P = window.SPart, sk = P.sk, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };
  var lijst = P.overdrachtLijst || function () { return ''; };

  var vak = q('overdrachtOverstap');
  if (!vak) return;
  vak.innerHTML =
    '<div class="rij">' +
    '<input class="veld" id="odId" maxlength="24" placeholder="Leerling-id" aria-label="Leerling-id">' +
    '<input class="veld" id="odNaar" maxlength="12" placeholder="Schoolcode van de ontvanger" aria-label="Ontvangende school">' +
    '<input class="veld" id="odDoor" maxlength="60" placeholder="Uw naam" aria-label="Uw naam">' +
    '<button class="knop p" id="odZet" type="button">Zet klaar</button></div>' +
    '<div class="rij" style="margin-top:.4rem;">' +
    '<input class="veld" id="odCode" maxlength="16" placeholder="Code (OD-...)" aria-label="Code">' +
    '<input class="veld" id="odVan" maxlength="12" placeholder="Schoolcode van de verzender" aria-label="Verzendende school">' +
    '<button class="knop" id="odHaal" type="button">Haal op</button></div>' +
    '<div id="odUit" class="stil" style="margin-top:.5rem;"></div>' +
    '<div id="odKlaar" class="stil" style="margin-top:.5rem;"></div>';

  q('odZet').addEventListener('click', function () {
    var id = q('odId').value.trim(), naar = q('odNaar').value.trim(), door = q('odDoor').value.trim();
    if (!id || !naar || !door) return meld('Geef het leerling-id, de ontvangende school en uw naam.');
    sk('/school/overdracht/klaarzetten', { leerlingId: id, naarSchool: naar, door: door, doel: 'continuiteit' })
      .then(function (r) {
        if (r.body.error) return meld(r.body.error);
        q('odUit').innerHTML = '<div><b>Code: ' + esc(r.body.code) + '</b> voor ' + esc(r.body.naarNaam) + '</div>' +
          '<div class="stil">Geldig tot ' + esc(String(r.body.tot).slice(0, 10)) + '</div>' +
          '<div class="stil">Gaat mee: ' + esc(r.body.velden.join(', ') || 'niets') + '</div>' +
          lijst(r.body.weggelaten, 'Gaat niet mee, en waarom') +
          '<p class="stil">' + esc(r.body.uitleg) + '</p>';
        klaarstaand();
      });
  });

  q('odHaal').addEventListener('click', function () {
    var code = q('odCode').value.trim(), van = q('odVan').value.trim();
    if (!code || !van) return meld('Geef de code en de school die hem klaarzette.');
    sk('/school/overdracht/ophalen', { code: code, vanSchool: van }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var d = r.body;
      q('odUit').innerHTML = '<div><b>Van ' + esc(d.van) + '</b>, klaargezet door ' + esc(d.door) + '</div>' +
        '<div class="stil">' + esc(Object.keys(d.velden).join(', ') || 'niets') + '</div>' +
        lijst(d.weggelaten, 'Zat er bewust niet in') +
        '<p class="stil">' + esc(d.uitleg) + '</p>';
    });
  });

  /* Wat er nog klaarstaat en wanneer het verloopt. Een pakket dat blijft liggen
     wordt een tweede dossier op een plek waar niemand meer kijkt, dus het hoort
     zichtbaar te zijn dat het er is -- en tot wanneer. */
  function klaarstaand() {
    sk('/school/overdracht/klaarstaand').then(function (r) {
      var el = q('odKlaar');
      if (!el || r.body.error) return;
      var p = r.body.pakketten || [];
      el.innerHTML = p.length
        ? '<div class="kop">Staat nog klaar</div>' + p.map(function (x) {
            return '<div class="item"><span><b>' + esc(x.code) + '</b> voor ' + esc(x.naarSchool) +
              '<br><span class="stil">door ' + esc(x.door) + ' &middot; verloopt ' + esc(String(x.tot).slice(0, 10)) + '</span></span></div>';
          }).join('') + '<p class="stil">' + esc(r.body.uitleg) + '</p>'
        : '';
    });
  }

  klaarstaand();
};
