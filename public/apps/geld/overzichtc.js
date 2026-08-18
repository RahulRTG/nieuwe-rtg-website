/* Stand Overzicht, deel 3 van 3: registratie, kliks en het beleid-paneel;
   gesplitst om de 10 KB-maat. Beleid staat ACHTER een kalme knop
   (uitzonderingsgestuurd, ONTWERP.md); de harde grens van GELD.md par. 3
   staat in het paneel. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  function D() { return w.RTGGeldDeel.overzicht; }
  /* w.Geld pas bij gebruik opzoeken (scriptvolgorde) */
  function api(p, b) { return w.Geld.api(p, b); }
  function esc(s) { return w.Geld.esc(s); }
  function euro(c) { return w.Geld.euro(c); }
  function meld(t) { w.Geld.melding(t); }

  /* het laatste beeld; de server blijft de waarheid */
  var C = null, B = null;
  var ZET = '/api/geld/beleid/zet', POT = '/api/geld/pot/';

  var SOORT = { minimumbuffer: 'Minimumbuffer', maanddrempel: 'Maanddrempel',
    'reserveer-maandelijks': 'Maandelijks reserveren', 'gift-bevestiging': 'Gift-bevestiging' };

  /* Naar centen via Geld.centen (hulp.js), op EEN plek: het eigen regeltje
     dat hier stond las "1.000" als een euro en zette een minimumbuffer dus
     duizend keer te laag, stil, waarna Rahul op die drempel handelde. */
  function centen(v) { return w.Geld.centen(v); }

  function kn(attr, txt) { return '<button class="knop" type="button" ' + attr + '>' + txt + '</button>'; }

  async function cockpit() {
    var O = D();
    try {
      C = await api('/api/geld/cockpit');
      O.teken(C); O.deelVooruit(C); O.tijdlijn(C);
    } catch (e) {
      C = null;
      /* hint alleen bij 401: een 500 zo noemen is een leugen */
      $('#ovVak').innerHTML = '<p class="stil">' + esc(e.message) +
        (e.status === 401 ? ' Log eerst in via de leden-app.' : '') + '</p>';
    }
  }

  /* allebei vers, anders lopen de beelden uiteen (LAT.md regel 4) */
  function ververs() { beleid(); cockpit(); }
  function zet(pad, body) {
    api(pad, body).then(ververs, function (e) { meld(e.message); });
  }

  function regelRij(r) {
    return '<div class="ov-regel"><span>' + esc(SOORT[r.soort] || r.soort) +
      (r.drempelCenten == null ? '' : ' · ' + euro(r.drempelCenten)) +
      ' · ' + esc(r.niveau) + '</span>' +
      kn('data-ovregel="' + esc(r.id) + '"', r.aan ? 'Aan' : 'Uit') + '</div>';
  }

  /* klein invoerveld, geen prompt(); de knop bepaalt het teken */
  function potRij(p) {
    return '<div class="ov-regel"><b>' + esc(p.naam) + '</b><span class="bedrag">' +
      euro(p.standCenten) + ' van ' + euro(p.doelCenten) + '</span></div><div class="ov-doe">' +
      '<input inputmode="decimal" placeholder="Bedrag" aria-label="Bedrag">' +
      kn('data-ovpot="' + esc(p.id) + '" data-doe="res"', 'Reserveer') +
      kn('data-ovpot="' + esc(p.id) + '" data-doe="vrij"', 'Geef vrij') +
      kn('data-ovpotweg="' + esc(p.id) + '"', 'Weg') + '</div>';
  }

  async function beleid() {
    var vak = $('#ovBeleid');
    vak.hidden = false;
    vak.innerHTML = '<p class="stil">Laden...</p>';
    try { B = await api('/api/geld/beleid'); }
    catch (e) { vak.innerHTML = '<p class="stil">' + esc(e.message) + '</p>'; return; }
    var rr = B.regels || [], pp = B.potten || [];
    vak.innerHTML =
      '<div class="kaart"><h2>Beleid</h2>' +
        /* de vier niveaus, de harde grens als stilregel */
        '<p class="stil">Kijken: Rahul signaleert. Voorstellen: hij stelt voor. Klaarzetten: ' +
          'hij vult in, u bevestigt. Automatisch: alleen reserveren in eigen potten. ' +
          'Geld verlaat het huis nooit vanzelf.</p>' +
        (rr.length ? rr.map(regelRij).join('') : '<p class="stil">Nog geen regels.</p>') +
        '<form id="ovRegelForm" class="ov-doe"><select id="ovRSoort" aria-label="Soort">' +
          Object.keys(SOORT).map(function (s) { return '<option value="' + s + '">' + SOORT[s] + '</option>'; }).join('') +
        '</select><input id="ovRDrempel" inputmode="decimal" placeholder="Bedrag in euro" aria-label="Bedrag">' +
        '<select id="ovRNiveau" aria-label="Niveau"><option>kijken</option><option>voorstellen</option>' +
          '<option>klaarzetten</option><option value="automatisch" disabled>automatisch</option></select>' +
        '<select id="ovRPot" aria-label="Pot" hidden>' +
          pp.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.naam) + '</option>'; }).join('') +
        '</select><button class="knop hoofd" type="submit">Regel toevoegen</button></form></div>' +
      '<div class="kaart"><h2>Potten</h2>' +
        (pp.length ? pp.map(potRij).join('') : '<p class="stil">Nog geen potten.</p>') +
        '<form id="ovPotForm" class="ov-doe">' +
          '<input id="ovPNaam" maxlength="40" placeholder="Naam" aria-label="Naam">' +
          '<input id="ovPDoel" inputmode="decimal" placeholder="Doel in euro" aria-label="Doel">' +
          '<button class="knop hoofd" type="submit">Pot toevoegen</button></form></div>';
  }

  /* de hele regel gaat mee: de server raadt geen velden */
  function schakel(id) {
    var rr = (B && B.regels) || [];
    for (var i = 0; i < rr.length; i++) if (rr[i].id === id)
      return zet(ZET, { id: id, soort: rr[i].soort,
        drempelCenten: rr[i].drempelCenten, niveau: rr[i].niveau, aan: !rr[i].aan });
  }

  function regelNieuw() {
    var soort = $('#ovRSoort').value, niveau = $('#ovRNiveau').value, c = centen($('#ovRDrempel').value);
    if (c == null || c < 0) return meld('Bedrag?');
    /* de servergrens alvast in het scherm */
    if (niveau === 'automatisch' && soort !== 'reserveer-maandelijks')
      return meld('Automatisch kan alleen bij maandelijks reserveren.');
    var body = { soort: soort, drempelCenten: c, niveau: niveau, aan: true };
    if (soort === 'reserveer-maandelijks') body.potId = $('#ovRPot').value;
    zet(ZET, body);
  }

  function potNieuw() {
    var naam = $('#ovPNaam').value.trim(), doel = centen($('#ovPDoel').value);
    if (!naam || doel == null || doel <= 0) return meld('Naam en doel?');
    zet(POT + 'zet', { naam: naam, doelCenten: doel });
  }

  /* vrijgeven is negatief reserveren: een route, een waarheid */
  function potDoe(b) {
    var c = centen((b.parentNode.querySelector('input') || {}).value);
    if (c == null || c <= 0) return meld('Bedrag?');
    zet(POT + 'reserveer', { id: b.dataset.ovpot, centen: b.dataset.doe === 'vrij' ? -c : c });
  }

  /* gedelegeerd: de vlakken hertekenen, de omhulling gaat mee weg */
  function klik(e) {
    /* #potten is geen stand maar het beleid-paneel van deze stand. Zonder
       deze opvang viel de schil terug op de eerste stand en hertekende de
       knop het overzicht, terwijl het lid dacht een reservering klaar te
       zetten: een klaargezette handeling met een dode knop. */
    var anker = e.target.closest('[data-ovactie="#potten"]');
    if (anker) {
      e.preventDefault();
      if ($('#ovBeleid').hidden) beleid(); else $('#ovBeleid').scrollIntoView({ block: 'start' });
      return;
    }
    var b = e.target.closest('button'), v;
    if (!b) return;
    var ds = b.dataset;
    if (b.id === 'ovBeleidKnop') {
      v = $('#ovBeleid');
      if (v.hidden) beleid(); else v.hidden = true;
    }
    else if (ds.ovwaarom) D().waarom(C, ds.ovwaarom);
    else if ('ovdicht' in ds) $('#ovWaarom').hidden = true;
    else if (ds.ovregel) schakel(ds.ovregel);
    else if (ds.ovpot) potDoe(b);
    else if (ds.ovpotweg && w.confirm('Deze pot opheffen?')) zet(POT + 'weg', { id: ds.ovpotweg });
  }

  function opSubmit(e) {
    var id = e.target.id;
    if (id !== 'ovRahulForm' && id !== 'ovRegelForm' && id !== 'ovPotForm') return;
    e.preventDefault();
    if (id === 'ovRegelForm') regelNieuw();
    else if (id === 'ovPotForm') potNieuw();
    else {
      /* deel 2 haalt hidden er niet af; dat hoort bij het vragen */
      $('#ovRahulUit').hidden = false;
      D().rahulVraag();
    }
  }

  /* 'automatisch' alleen bij maandelijks reserveren; de server weigert het elders ook */
  function wissel(e) {
    if (e.target.id !== 'ovRSoort') return;
    var res = e.target.value === 'reserveer-maandelijks', niv = $('#ovRNiveau');
    niv.querySelector('[value="automatisch"]').disabled = !res;
    if (!res && niv.value === 'automatisch') niv.value = 'kijken';
    $('#ovRPot').hidden = !res;
  }

  function start() {
    D().stijl();
    C = B = null;
    var wrap = $('#ovAlles');
    wrap.addEventListener('click', klik);
    wrap.addEventListener('submit', opSubmit);
    wrap.addEventListener('change', wissel);
    /* EEN bron-slot in het document (zie wbwb.js) */
    if (w.RTGUitvoer) w.RTGUitvoer.bron(D().bron);
    cockpit();
  }

  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  /* De stijl van dit paneel staat bij die van deel 1 (Deel.ovcss in overzicht-a.js):
     een stand hoort EEN stijlblad te hebben, niet twee die elkaar in de head
     verdringen -- en het scheelt hier de ruimte om uit te leggen waarom de
     dingen staan zoals ze staan. */

  /* ovAlles, niet ovWrap: deel 1 tekent zelf #ovWrap en #ovVooruit in #ovVak */
  V.standen.push({
    id: 'overzicht',
    naam: 'Overzicht',
    uitleg: 'Hoe u er financieel voor staat en wat er aankomt, uit alle standen tegelijk. Rahul let mee binnen uw regels; werken doet u in de stand zelf.',
    html: '<div id="ovAlles"><div id="ovVak"><p class="stil">Laden...</p></div>' +
      '<div id="ovWaarom" hidden></div><div id="ovTijd"></div>' +
      '<button class="knop" type="button" id="ovBeleidKnop">Beleid</button>' +
      '<div id="ovBeleid" hidden></div>' +
      '<div class="kaart"><h2>Vraag Rahul</h2><div id="ovRahulUit" class="stil" hidden aria-live="polite"></div>' +
      '<form id="ovRahulForm"><div class="ov-vraagrij">' +
      '<input id="ovRahulIn" placeholder="Kan ik deze maand nog 1.000 euro uitgeven?" aria-label="Vraag aan Rahul" autocomplete="off">' +
      '<button class="knop hoofd" type="submit">Vraag</button></div></form></div></div>',
    start: start,
    stop: stop
  });
})(window, document);
