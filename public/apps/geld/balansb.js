/* Stand Balans, deel 2 van 2: de registratie. Leunt op w.RTGGeldDeel.balans
   uit balans.js (stijl, weekbeeld, kluis, recepten); hier staan het laden,
   de kliks en de aanmelding. Dezelfde route als /apps/balans.html,
   letterlijk: /api/balans. De vraagknoppen gaan (zoals het origineel) via
   het klembord naar de chat van de leden-app, /apps/app.html#ai. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var B = (w.RTGGeldDeel = w.RTGGeldDeel || {}).balans;
  var $ = function (s) { return d.querySelector(s); };
  var DATA = null;   // het laatste antwoord van /api/balans; de vraagknoppen lezen eruit

  async function laad() {
    var Geld = w.Geld, esc = Geld.esc;
    try {
      var data = await Geld.api('/api/balans');
      DATA = data;
      var b = data.beeld || {};
      $('#blWeek').innerHTML = B.weekHtml(b);
      /* Het icoon is een glyfnaam van de server (oogst, ster, emo-slaap);
         net als het origineel gaat hij als stille tekst mee, aria-hidden. */
      $('#blAdvies').innerHTML = (data.adviezen || []).map(function (a) {
        return '<div class="bl-advies"><span aria-hidden="true">' + esc(a.icoon) + '</span><span>' + esc(a.tekst) + '</span></div>';
      }).join('') +
        '<button class="knop h-mt80" id="blRust" type="button">Vraag Rahul een rustmoment te plannen</button>';
      $('#blKook').innerHTML =
        '<p class="stil">Uit eten: ongeveer ' + esc(b.uitPerWeek) + ' keer per week' +
          (b.laat ? ' &middot; ' + esc(b.laat) + ' late nachten in twee weken' : '') + '.</p>' +
        '<p class="stil h-mt50">' + esc(data.koken) + '</p>' +
        '<div class="bl-knoppen">' +
          '<button class="knop" id="blKookVraag" type="button">Vraag Rahul een recept voor vanavond</button>' +
          '<button class="knop" id="blBeweeg" type="button">Vraag Rahul naar sport en wellness</button>' +
        '</div>';
    } catch (e) {
      $('#blWeek').innerHTML = '<p class="stil">' + esc(e.message) + ' Log eerst in via de leden-app.</p>';
      $('#blAdvies').innerHTML = '<p class="stil">Niet geladen.</p>';
      $('#blKook').innerHTML = '<p class="stil">Niet geladen.</p>';
    }
  }

  /* Meenemen (shared/uitvoer.js): het weekbeeld is een echte reeks per dag --
     de staafjes worden er letterlijk uit getekend -- en gaat als datum plus
     aantal mee. De adviezen zijn tekst van Rahul en geen gegevens; die
     blijven op het scherm. Bij stop() gaat de bron weer weg. */
  function model() {
    var b = DATA && DATA.beeld;
    if (!b || !b.dagen) return null;
    return {
      naam: 'weekbeeld',
      kolommen: ['datum', 'weekdag', 'afspraken', 'vrije dag'],
      rijen: b.dagen.map(function (dd, i) {
        var x = new Date(String(dd) + 'T00:00:00');
        var n = Number(b.perDag[i]) || 0;
        return [dd, isNaN(x) ? '' : B.DAGL[x.getDay()], n, n === 0 ? 'ja' : 'nee'];
      })
    };
  }

  /* Een gedelegeerde klik op de omhulling: de kaarten worden opnieuw
     getekend bij elke verversing, en de omhulling verdwijnt netjes mee als
     de stand wisselt. */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'blRust') { B.vraag(DATA && DATA.vraagRust); return; }
    if (b.id === 'blKookVraag') { B.vraag(DATA && DATA.vraagKoken); return; }
    if (b.id === 'blBeweeg') { B.vraag(DATA && DATA.vraagBewegen); return; }
    if (b.id === 'blReceptBewaar') { B.bewaar(); return; }
    if (b.dataset.ropen) {
      w.Toestelkluis.haal(b.dataset.ropen).then(async function (f) { if (f) w.alert(await f.text()); });
      return;
    }
    if (b.dataset.rwis) w.Toestelkluis.wis(b.dataset.rwis).then(B.recepten);
  }

  function start() {
    B.stijl();
    DATA = null;
    $('#blWrap').addEventListener('click', klik);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(model);
    laad();
    B.kluis().then(B.recepten);
  }

  // zonder stop blijft de uitvoer-bron balansdata aanbieden in andere standen
  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'balans',
    naam: 'Balans',
    uitleg: 'Uw werk-privebalans, geen boekhouding: het weekbeeld en de adviezen van Rahul. Rust hoort erbij.',
    html:
      '<div id="blWrap">' +
        '<p class="stil">Rahul kijkt naar uw agenda en uw ritme en adviseert ook eens niks: rusten, uw hobby, ' +
          'ontprikkelen. Geen streaks, geen scores om te halen, geen schuldgevoel; deze stand mag u ook gewoon negeren.</p>' +
        '<h2>Uw komende week</h2>' +
        '<div class="kaart" id="blWeek"><p class="stil">Laden...</p></div>' +
        '<h2>Rahul denkt met u mee</h2>' +
        '<div class="kaart" id="blAdvies"><p class="stil">Laden...</p></div>' +
        '<h2>Eten, koken en bewegen</h2>' +
        '<div class="kaart" id="blKook"><p class="stil">Laden...</p></div>' +
        '<h2>Mijn recepten, op dit toestel</h2>' +
        '<div class="kaart" id="blRecept">' +
          '<p class="stil">Bewaar de recepten van Rahul (of uw eigen) in de beveiligde opslag van dit toestel. ' +
            'Alleen u kunt erbij; er gaat niets over de lijn.</p>' +
          '<label class="stil lbl" for="blReceptNaam">Naam</label>' +
          '<input id="blReceptNaam" maxlength="60" placeholder="Bijv. pasta van Rahul">' +
          '<label class="stil lbl" for="blReceptTekst">Recept</label>' +
          '<textarea id="blReceptTekst" rows="4" maxlength="4000" placeholder="Plak hier het recept uit de Rahul-chat"></textarea>' +
          '<div class="bl-knoppen"><button class="knop hoofd" id="blReceptBewaar" type="button">Bewaar op dit toestel</button></div>' +
          '<div class="h-mt60" id="blReceptLijst"></div>' +
        '</div>' +
      '</div>',
    start: start,
    stop: stop
  });
})(window, document);
