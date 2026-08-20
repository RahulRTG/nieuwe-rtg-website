/* RTG School Partner: de overstap naar buiten.

   DRIE DINGEN, IN DEZE VOLGORDE.

   1. DE KAART. Per gegeven waarom het wel of niet meegaat: nodig voor
      inschrijving, nodig voor continuiteit, alleen met toestemming, of nooit.
      Bij "nooit" staat geen vinkje -- zorg, incidenten en het journaal gaan ook
      met toestemming niet mee.
   2. HET PAKKET. Wat er voor deze leerling zou meegaan, met daaronder wat er
      NIET in zit en waarom. Een overdracht die alleen toont wat meegaat, laat
      de ontvangende school denken dat ze alles heeft.
   3. DE VORM. Pas daarna Edu-V, Entree, Edu-API of OSO -- met bij elke
      standaard wat hij niet kan dragen, EN waar de veldnamen vandaan komen.
      Zou de vorm eerst komen, dan bepaalt een koppelvlak wat er over een kind
      gedeeld wordt.

   ER GAAT HIER NIETS DE DEUR UIT. Deze schermen LATEN ZIEN wat een pakket zou
   bevatten; er staat geen verstuurknop, want er is geen koppeling. Zolang die
   er niet is, hoort er ook niet te worden gedaan alsof.

   EN DAT GELDT OOK VOOR DE VELDNAMEN. Van drie van de vier standaarden is de
   kaart nooit tegen een specificatie gehouden. Dat staat op het scherm, bij de
   standaard en bij de vertaling -- niet alleen in een commentaarregel die de
   gebruiker nooit ziet.

   Zelfde SPart-patroon; app.js roept SPart.overdracht() aan. */
window.SPart = window.SPart || {};
window.SPart.overdracht = function () {
  var P = window.SPart, sk = P.sk, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };

  function kaart() {
    var vak = q('overdrachtKaart');
    if (!vak) return;
    sk('/school/overdracht/kaart').then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      vak.innerHTML = r.body.velden.map(function (v) {
        return '<div class="item"><span><b>' + esc(v.veld) + '</b> <span class="tag' +
          (v.klasse === 'nooit' ? ' aan' : '') + '">' + esc(v.klasse) + '</span>' +
          '<br><span class="stil">' + esc(v.waarom) + '</span></span></div>';
      }).join('') +
        '<div class="kop h-mt60">Wat een standaard niet kan dragen</div>' +
        r.body.standaarden.map(function (st) {
          return '<div class="item"><span><b>' + esc(st.naam) + '</b> <span class="tag' +
            (st.gelezen ? '' : ' aan') + '">' + (st.gelezen ? 'nagekeken' : 'onbevestigd') + '</span>' +
            '<br><span class="stil">' + esc(st.kanNiet.map(String).join('; ')) + '</span>' +
            '<br><span class="stil">Bron: ' + esc(st.bron) + '</span></span></div>';
        }).join('') + '<p class="stil">' + esc(r.body.uitleg) + '</p>';
    });
  }

  /* De herkomst van een veldkaart, in beeld. Een vertaling die er af ziet
     terwijl niemand de specificatie heeft gelezen, is erger dan geen
     vertaling: daar bouwt de volgende school op. */
  function herkomst(v) {
    if (!v) return '';
    return (v.waarschuwing
      ? '<p class="stil"><b>Niet nagekeken:</b> ' + esc(v.waarschuwing) + '</p>' +
        (v.onbevestigd || []).map(function (o) {
          return '<div class="item"><span><b>' + esc(o.veld) + '</b> gaat als <b>' + esc(o.extern) +
            '</b><br><span class="stil">' + esc(o.waarom) + '</span></span></div>';
        }).join('')
      : '<p class="stil"><b>Nagekeken</b> in de specificatie zelf.</p>') +
      (v.bron ? '<p class="stil">Bron: ' + esc(v.bron) + '</p>' : '');
  }

  /* Gedeeld met ./overstap.js: dezelfde restlijst hoort er hetzelfde uit te
     zien, of hij nu bij een voorbeeld of bij een echte overstap staat. */
  P.overdrachtLijst = lijst;
  function lijst(rijen, kop) {
    if (!rijen || !rijen.length) return '';
    return '<div class="kop h-mt50">' + esc(kop) + '</div>' + rijen.map(function (x) {
      return '<div class="item"><span><b>' + esc(x.veld) + '</b>' +
        (x.klasse ? ' <span class="tag">' + esc(x.klasse) + '</span>' : '') +
        '<br><span class="stil">' + esc(x.waarom) + '</span></span></div>';
    }).join('');
  }

  function pakket() {
    var vak = q('overdrachtPakket');
    if (!vak) return;
    vak.innerHTML =
      '<div class="rij">' +
      '<input class="veld" id="ovId" maxlength="24" placeholder="Leerling-id" aria-label="Leerling-id">' +
      '<select class="veld" id="ovDoel" aria-label="Waarvoor"><option value="inschrijving">voor de inschrijving</option>' +
      '<option value="continuiteit">voor de onderwijscontinuiteit</option></select>' +
      '<select class="veld" id="ovStandaard" aria-label="In welke vorm"><option value="">geen vorm (ons eigen model)</option>' +
      '<option value="oso">OSO</option><option value="eduv">Edu-V</option>' +
      '<option value="eduapi">Edu-API</option><option value="entree">Entree</option></select>' +
      '<input class="veld" id="ovDoor" maxlength="60" placeholder="Toestemming van (naam)" aria-label="Toestemming van">' +
      '<button class="knop" id="ovToon" type="button">Toon het pakket</button></div>' +
      '<div id="ovUit" class="stil h-mt50"></div>';
    q('ovToon').addEventListener('click', function () {
      var id = q('ovId').value.trim();
      if (!id) return meld('Geef het leerling-id uit de administratie.');
      var door = q('ovDoor').value.trim();
      sk('/school/overdracht/pakket', { leerlingId: id, doel: q('ovDoel').value,
        standaard: q('ovStandaard').value || undefined,
        toestemmingDoor: door || undefined, toestemmingVelden: door ? ['contact', 'documenten'] : undefined })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          var d = r.body;
          q('ovUit').innerHTML =
            '<div><b>Gaat mee:</b> ' + esc(Object.keys(d.velden).join(', ') || 'niets') + '</div>' +
            (d.toestemmingDoor ? '<div class="stil">Toestemming genoteerd van ' + esc(d.toestemmingDoor) + '</div>' : '') +
            lijst(d.weggelaten, 'Gaat niet mee, en waarom') +
            (d.vorm ? '<div class="kop h-mt50">Als ' + esc(d.vorm.naam) + '</div>' +
              '<div class="stil">' + esc(Object.keys(d.vorm.velden).join(', ') || 'niets') + '</div>' +
              lijst(d.vorm.weggelaten, 'Past niet in deze standaard') +
              '<p class="stil"><b>' + esc(d.vorm.naam) + ' kan niet dragen:</b> ' + d.vorm.kanNiet.map(esc).join('; ') + '</p>' +
              herkomst(d.vorm) : '') +
            '<p class="stil">' + esc(d.uitleg) + '</p>';
        });
    });
  }

  function inlezen() {
    var vak = q('overdrachtInlezen');
    if (!vak) return;
    vak.innerHTML =
      '<div class="rij"><select class="veld" id="inStandaard" aria-label="Van welke standaard">' +
      '<option value="oso">OSO</option><option value="eduv">Edu-V</option>' +
      '<option value="eduapi">Edu-API</option><option value="entree">Entree</option></select>' +
      '<button class="knop" id="inLees" type="button">Wat nemen we hiervan over</button></div>' +
      '<textarea class="veld" id="inVelden" rows="3" maxlength="2000" placeholder=\'{"naam":"...","geboortedatum":"..."}\' aria-label="Velden van buiten"></textarea>' +
      '<div id="inUit" class="stil h-mt50"></div>';
    q('inLees').addEventListener('click', function () {
      var velden;
      try { velden = JSON.parse(q('inVelden').value || '{}'); }
      catch (e) { return meld('Dat is geen geldige JSON; plak het bestand zoals u het kreeg.'); }
      sk('/school/overdracht/inlezen', { standaard: q('inStandaard').value, velden: velden })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          q('inUit').innerHTML = '<div><b>Overgenomen:</b> ' + esc(Object.keys(r.body.velden).join(', ') || 'niets') + '</div>' +
            lijst(r.body.geweigerd, 'Geweigerd, want niet op onze kaart') +
            herkomst(r.body) +
            '<p class="stil">' + esc(r.body.uitleg) + '</p>';
        });
    });
  }

  kaart();
  pakket();
  inlezen();
};
