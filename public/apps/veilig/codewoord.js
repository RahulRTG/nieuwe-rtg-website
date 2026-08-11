/* Stand 2 -- Codewoord. Was /apps/codewoord.html.

   De regel die deze stand draagt en die het samenvoegen niet mocht raken: de
   zin komt na het instellen NOOIT meer op het scherm. Daarom staat hij ook
   nergens in een variabele die deze stand vasthoudt -- het invoerveld wordt
   direct na het versturen geleegd, en bij het wisselen van stand gooit de schil
   het hele paneel weg. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };

  function tekenZin(st) {
    var Veilig = w.Veilig;
    if (!st.ingesteld) {
      $('#zinKaart').innerHTML =
        '<label class="stil lbl" for="zin">Kies uw zin (minstens drie woorden)</label>' +
        '<input id="zin" maxlength="120" autocomplete="off" placeholder="Een gewone zin uit uw eigen leven">' +
        /* Met opzet GEEN voorbeeldzin. Zou hier een zin staan, dan kiest een deel
           van de mensen precies die, en dan is het geen geheim meer. Wel uitleggen
           waaraan een goede zin voldoet; de zin zelf verzint u zelf. */
        '<p class="stil" style="margin-top:.5rem;">Wij geven met opzet geen voorbeeld: een voorbeeldzin ' +
        'wordt door te veel mensen overgenomen en is dan geen geheim meer. Neem iets uit uw eigen ' +
        'huishouden dat u zonder nadenken typt en dat niemand vreemd vindt.</p>' +
        '<p class="stil" style="margin-top:.4rem;">Hoofdletters, accenten en leestekens maken niet uit. ' +
        'Uw zin mag midden in een gewoon bericht staan.</p>' +
        '<button class="knop hoofd groot" id="zet" style="margin-top:.8rem;">Instellen</button>';
      $('#zet').addEventListener('click', async function () {
        var zin = $('#zin').value.trim();
        try {
          await Veilig.api('/api/veiligheid/codewoord/zet', { zin: zin });
          $('#zin').value = '';
          Veilig.melding('Ingesteld. Onthoud hem goed; wij kunnen hem u niet meer laten zien.');
          laad();
        } catch (e) { Veilig.melding(e.message); }
      });
      return;
    }
    $('#zinKaart').innerHTML =
      '<p>Uw codewoord staat ingesteld: <strong>' + st.aantal + ' woorden</strong>.</p>' +
      '<p class="stil" style="margin-top:.4rem;">Meer laten we met opzet niet zien. ' +
      (st.keer ? 'Hij is ' + st.keer + ' keer herkend.' : 'Hij is nog niet gebruikt.') + '</p>' +
      '<label class="mini" style="margin-top:.8rem;"><input type="checkbox" id="aan"' + (st.aan ? ' checked' : '') +
        '> het codewoord staat aan</label>' +
      '<div class="rij" style="margin-top:.8rem;">' +
        '<button class="knop" id="nieuw" style="flex:1;">Andere zin kiezen</button>' +
        '<button class="knop stop" id="wis" style="flex:1;">Wissen</button></div>';
    $('#aan').addEventListener('change', async function (e) {
      try { await Veilig.api('/api/veiligheid/codewoord/schakel', { aan: e.target.checked }); laad(); }
      catch (err) { Veilig.melding(err.message); }
    });
    $('#nieuw').addEventListener('click', function () { tekenZin({ ingesteld: false }); });
    $('#wis').addEventListener('click', async function () {
      try { await Veilig.api('/api/veiligheid/codewoord/wis'); Veilig.melding('Gewist.'); laad(); }
      catch (e) { Veilig.melding(e.message); }
    });
  }

  async function laad() {
    try { tekenZin((await w.Veilig.api('/api/veiligheid/codewoord')).stand); }
    catch (e) { $('#zinKaart').innerHTML = '<p class="stil">' + w.Veilig.esc(e.message) + ' Log eerst in via de leden-app.</p>'; }
  }

  V.standen.push({
    id: 'codewoord',
    naam: 'Codewoord',
    regel: 'stil om hulp vragen',
    kringKop: 'Wie krijgt bericht',
    uitleg: 'Een gewone zin die u tegen Rahul typt. Op uw scherm gebeurt er niets: geen pop-up, geen ' +
      'geluid, geen vinkje, en Rahul antwoordt precies zoals altijd. Ondertussen heeft uw kring ' +
      'bericht gekregen met uw laatst bekende plek. Dat "er gebeurt niets" is de hele functie: wie ' +
      'met u meekijkt op uw scherm mag niets zien veranderen. Daarom laat deze stand uw zin na het ' +
      'instellen ook nooit meer zien, ook niet aan u.',
    html:
      '<h2>Uw zin</h2>' +
      '<div class="kaart" id="zinKaart"><p class="stil">Laden...</p></div>' +
      '<h2>Oefenen</h2>' +
      '<div class="kaart">' +
        '<p class="stil">Kijk of uw zin nog wordt herkend. Hier gaat er nooit een alarm uit. ' +
        'Oefen als u alleen bent, niet als het erop aankomt.</p>' +
        '<div class="rij" style="margin-top:.6rem;">' +
          '<input id="oefen" maxlength="200" placeholder="Typ uw zin, of een zin met uw zin erin" aria-label="Oefenzin">' +
          '<button class="knop" id="oefenKnop">Proberen</button>' +
        '</div>' +
        '<p class="stil" id="oefenUit" style="margin-top:.5rem;"></p>' +
      '</div>' +
      '<h2>Waar dit niet tegen helpt</h2>' +
      '<div class="kaart">' +
        '<p class="stil">Uw telefoon blijft het zwakke punt. Wie hem afpakt of afzet, zet ook dit uit. ' +
        'Het codewoord helpt op het moment dat u de telefoon nog in handen heeft maar niet vrij kunt ' +
        'praten; het is geen bescherming tegen iemand die uw toestel overneemt.</p>' +
        '<p class="stil" style="margin-top:.6rem;">Kies daarom een zin die u onder spanning nog kunt ' +
        'typen, die in een gewoon gesprek niet opvalt, en die u niet per ongeluk gebruikt. Drie tot ' +
        'vijf woorden werkt het best.</p>' +
      '</div>',
    start: function () {
      $('#oefenKnop').addEventListener('click', async function () {
        try {
          var r = await w.Veilig.api('/api/veiligheid/codewoord/proef', { tekst: $('#oefen').value });
          $('#oefenUit').textContent = r.raak
            ? 'Herkend. Deze zin zou uw kring waarschuwen.'
            : 'Niet herkend. Deze zin doet niets.';
          $('#oefen').value = '';
        } catch (e) { $('#oefenUit').textContent = e.message; }
      });
      laad();
    }
  });
})(window, document);
