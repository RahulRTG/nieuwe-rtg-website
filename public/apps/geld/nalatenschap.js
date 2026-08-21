/* Stand Nalatenschap, deel 1 van 2. Was /apps/nalatenschap.html: een discreet,
   versleuteld dossier voor later. Welke documenten er zijn en waar ze liggen,
   wie de vertrouwenspersonen zijn, en welke wensen er vastliggen. De toon van
   de pagina blijft bewust behouden: dit is een dossier dat iemand in stilte
   voor zichzelf bijhoudt, geen administratie die om aandacht vraagt.

   Dit bestand registreert GEEN stand: het zet het tekenwerk en de meeneembron
   op w.RTGGeldDeel.nalatenschap, en nalatenschapb.js (dat erna laadt) doet de
   handelingen en de registratie. De splitsing bestaat alleen om de maat van de
   repo (bestanden onder de 10 KB) te halen; het is samen een stand. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var D = Deel.nalatenschap = { stand: null }; // het laatst geladen dossier

  /* Alleen wat geld.html en de UI-kit niet al hebben: de tekstkolom in een
     rij, de kleine wegknop, de halve formulierregels en het antwoordvak van
     de adviseur. Een keer injecteren, met id-wacht, want tien standen delen
     dit document. */
  D.stijl = function () {
    if (d.getElementById('nlStijl')) return;
    var s = d.createElement('style');
    s.id = 'nlStijl';
    s.textContent =
      '#paneel .nl-tx{flex:1;min-width:0;}' +
      '#paneel .nl-tx .badge{margin-left:.35rem;}' +
      '#paneel .nl-weg{background:none;border:0;color:var(--gold-tekst);font-size:.75rem;' +
        'cursor:pointer;padding:0;text-decoration:underline;font-family:inherit;flex-shrink:0;}' +
      '#paneel .nl-half{display:flex;gap:.4rem;margin-top:.4rem;}' +
      '#paneel .nl-half>*{flex:1;min-width:0;}' +
      '#paneel .nl-vraag{display:flex;gap:.5rem;margin-top:.4rem;}' +
      '#paneel .nl-vraag input{flex:1;width:auto;}' +
      '#paneel .nl-uit{border:1px solid var(--rtg-line);border-radius:12px;padding:.6rem .8rem;' +
        'margin-top:.6rem;font-size:.85rem;line-height:1.55;white-space:pre-wrap;}';
    d.head.appendChild(s);
  };

  function opties(l) {
    return (l || []).map(function (x) {
      return '<option>' + w.Geld.esc(x) + '</option>';
    }).join('');
  }

  /* De wegknop is een klein tekstknopje en geen kruis: in een dossier over
     later hoort verwijderen een bewuste, stille handeling te zijn, geen
     kruisje dat om klikken vraagt. */
  function wegKnop(attr, id, naam) {
    var esc = w.Geld.esc;
    return '<button class="nl-weg" type="button" ' + attr + '="' + esc(id) +
      '" aria-label="Verwijder ' + esc(naam) + '">weg</button>';
  }

  function docRij(x) {
    var esc = w.Geld.esc;
    var sub = [x.waar ? 'Ligt: ' + esc(x.waar) : '', esc(x.notitie)].filter(Boolean).join(' · ');
    return '<div class="rij"><div class="nl-tx"><b>' + esc(x.titel) + '</b>' +
      '<span class="badge">' + esc(x.soort) + '</span>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      wegKnop('data-nldoc', x.id, esc(x.titel)) + '</div>';
  }

  function conRij(c) {
    var esc = w.Geld.esc;
    var sub = [esc(c.telefoon), esc(c.email), esc(c.notitie)].filter(Boolean).join(' · ');
    return '<div class="rij"><div class="nl-tx"><b>' + esc(c.naam) + '</b>' +
      '<span class="badge">' + esc(c.rol) + '</span>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      wegKnop('data-nlcon', c.id, esc(c.naam)) + '</div>';
  }

  function wensRij(x) {
    var esc = w.Geld.esc;
    return '<div class="rij"><div class="nl-tx">' +
      (x.titel ? '<b>' + esc(x.titel) + '</b>' : '') +
      '<div class="sub">' + esc(x.tekst) + '</div></div>' +
      wegKnop('data-nlwen', x.id, esc(x.titel || 'deze wens')) + '</div>';
  }

  function lijst(rijen, teken, leeg) {
    return (rijen || []).length ? rijen.map(teken).join('') : '<p class="stil">' + leeg + '</p>';
  }

  D.teken = function (dd) {
    d.getElementById('nlVak').innerHTML =
      /* De slotzin van de pagina, want die draagt het vertrouwen: wie hier
         opschrijft waar het testament ligt, moet weten dat dat versleuteld
         staat en dat alleen hijzelf het ziet. */
      '<div class="kaart"><p class="stil">De gevoelige gegevens hieronder (waar iets ligt, ' +
        'contactgegevens en uw wensen) staan <b>versleuteld</b> opgeslagen. ' +
        'Alleen u ziet ze, na inloggen.</p></div>' +
      '<h2>Documenten</h2>' +
      '<div class="kaart">' +
        '<div id="nlDocs">' + lijst(dd.documenten, docRij, 'Nog geen documenten.') + '</div>' +
        '<form id="nlDForm">' +
          '<div class="nl-half">' +
            '<input id="nlDT" maxlength="100" placeholder="titel (bijv. testament)" aria-label="Titel">' +
            '<select id="nlDS" aria-label="Soort">' + opties(dd.soorten) + '</select>' +
          '</div>' +
          '<div class="nl-half"><input id="nlDW" maxlength="300" ' +
            'placeholder="waar ligt het / hoe is het te vinden" aria-label="Waar het ligt"></div>' +
          '<div class="nl-half"><input id="nlDN" maxlength="600" ' +
            'placeholder="notitie (optioneel)" aria-label="Notitie"></div>' +
          '<button class="knop hoofd h-mt60" type="submit">+ document</button>' +
        '</form>' +
      '</div>' +
      '<h2>Vertrouwenspersonen</h2>' +
      '<div class="kaart">' +
        '<div id="nlCon">' + lijst(dd.contacten, conRij, 'Nog geen contacten.') + '</div>' +
        '<form id="nlCForm">' +
          '<div class="nl-half">' +
            '<input id="nlCN" maxlength="80" placeholder="naam" aria-label="Naam">' +
            '<select id="nlCR" aria-label="Rol">' + opties(dd.rollen) + '</select>' +
          '</div>' +
          '<div class="nl-half">' +
            '<input id="nlCT" maxlength="40" placeholder="telefoon" aria-label="Telefoon">' +
            '<input id="nlCE" maxlength="120" placeholder="e-mail" aria-label="E-mail">' +
          '</div>' +
          '<button class="knop h-mt60" type="submit">+ contact</button>' +
        '</form>' +
      '</div>' +
      '<h2>Wensen</h2>' +
      '<div class="kaart">' +
        '<div id="nlWen">' + lijst(dd.wensen, wensRij, 'Nog geen wensen vastgelegd.') + '</div>' +
        '<form id="nlWForm">' +
          '<div class="nl-half"><input id="nlWT" maxlength="100" ' +
            'placeholder="titel (optioneel)" aria-label="Titel"></div>' +
          '<div class="nl-half"><textarea id="nlWX" maxlength="800" ' +
            'placeholder="Wat wilt u vastleggen?" aria-label="Uw wens"></textarea></div>' +
          '<button class="knop h-mt60" type="submit">+ wens</button>' +
        '</form>' +
      '</div>' +
      '<h2>Vraag de adviseur</h2>' +
      '<div class="kaart">' +
        '<div class="nl-uit" id="nlAiUit" hidden aria-live="polite"></div>' +
        '<form class="nl-vraag" id="nlAiForm">' +
          '<input id="nlAiIn" placeholder="Bijv. welke documenten mis ik nog?" ' +
            'aria-label="Uw vraag aan de adviseur" autocomplete="off">' +
          '<button class="knop hoofd" type="submit">Vraag</button>' +
        '</form>' +
      '</div>';
  };

  /* Meenemen (shared/uitvoer.js): het documentenregister is de kern van dit
     dossier, welk stuk het is, van welke soort, waar het ligt. Juist dat wil
     iemand ook buiten deze app bij de hand hebben. De vertrouwenspersonen en
     de wensen gaan NIET mee: dat zijn gegevens van anderen en van het meest
     persoonlijke soort, en die horen in het dossier te blijven staan waar ze
     versleuteld staan. Zelfde afweging als op de oude pagina. */
  D.bron = function () {
    if (!D.stand) return null;
    return { naam: 'documenten', kolommen: ['titel', 'soort', 'waar', 'notitie'],
      rijen: (D.stand.documenten || []).map(function (x) {
        return [x.titel || '', x.soort || '', x.waar || '', x.notitie || ''];
      }) };
  };
})(window, document);
