/* RTG School Partner (los deel): rollen, koppelingen en het inzagejournaal.
   Hoort bij enterprise.js, dat de sleutels en de twee opbouw-hulpjes meegeeft
   -- zo staat de vormtaal op een plek en heeft dit deel geen eigen kaartstijl.

   Waarom deze drie bij elkaar staan: het zijn de vragen die een ouder stelt en
   die een schoolsysteem meestal niet kan beantwoorden. Wie mag er bij het
   dossier van mijn kind? Wat gaat er naar buiten, en naar wie? En heeft er
   iemand gekeken? */
(function () {
  'use strict';
  var A = null, sleutels = null, esc = null, meld = null, kaart = null, rij = null, wortel = null;

  function bind(api, sessie, escape, melder, sleutelmaker, opbouw) {
    A = api; esc = escape; meld = melder; sleutels = sleutelmaker;
    kaart = opbouw.kaart; rij = opbouw.rij;
    wortel = document.getElementById('dBeheer');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([
      A('/school/rollen', sleutels()), A('/school/koppelingen', sleutels()), A('/school/journaal', sleutels({ limiet: 8 })),
      A('/school/webhook/lijst', sleutels()), A('/school/peiling/uitslag', sleutels())
    ]).then(function (r) {
      var rollen = r[0].body, kop = r[1].body, journaal = r[2].body, haken = r[3].body, peilingen = r[4].body;
      if (rollen.error) { wortel.innerHTML = ''; return; }
      var rolIds = (rollen.rollen || []).map(function (x) { return x.id; }).filter(function (x) { return x !== 'directie'; });
      var h = '<div class="deel">Rollen en rechten</div>';

      h += kaart('Wie mag wat', (rollen.personeel || []).map(function (p) {
        return '<div class="item h-boven"><span>' + esc(p.naam) +
          ' <span class="stil">· ' + esc(p.status) + '</span></span>' +
          '<span class="doelkies" data-rolrij="' + esc(p.id) + '">' + rolIds.map(function (id) {
            return '<label><input type="checkbox" value="' + esc(id) + '"' +
              ((p.rollen || []).indexOf(id) >= 0 ? ' checked' : '') + '>' + esc(id) + '</label>';
          }).join('') + '<button class="knop" data-rol="' + esc(p.id) + '" type="button">Bewaar</button></span></div>';
      }).join('') || '<p class="stil">Nog geen personeel.</p>',
      'Zorg, incidenten, geld en personeelszaken hebben elk hun eigen recht. De systeembeheerder beheert de omgeving en komt niet in een dossier.');

      h += '<div class="deel">Koppelingen en journaal</div>';
      h += kaart('Wat gaat er naar buiten', (kop.koppelingen || []).map(function (k) {
        return rij(esc(k.naam), 'deelt: ' + (k.deelt || []).map(esc).join(', '));
      }).join('') || '<p class="stil">Geen koppelingen aan.</p>',
      'Nooit mee, in geen enkele koppeling: ' + (kop.nooit || []).map(esc).join(', ') + '.');

      /* Een koppeling aanzetten betekent VELDEN kiezen. Zonder velden gaat hij
         niet aan -- dat weigert de server, en dit scherm vraagt ze daarom in
         dezelfde handeling in plaats van erachteraan. */
      h += kaart('Koppeling aanzetten',
        '<div class="rij"><select class="veld" id="enKSoort" aria-label="Welke koppeling">' +
        (kop.beschikbaar || []).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.naam) + '</option>'; }).join('') +
        '</select><input class="veld" id="enKUrl" maxlength="200" placeholder="URL of naam van de partij" aria-label="URL of naam"></div>' +
        '<div class="doelkies" data-koppelvelden>' + (kop.velden || []).map(function (v) {
          return '<label><input type="checkbox" value="' + esc(v.id) + '">' + esc(v.uitleg) + '</label>';
        }).join('') + '</div>' +
        '<div class="rij"><button class="knop p" id="enKZet" type="button">Zet de koppeling aan</button></div>',
        'Wat u hier niet aanvinkt, gaat er ook niet doorheen -- ook niet "voor het gemak".');

      h += kaart('Webhook toevoegen',
        '<div class="rij"><input class="veld" id="enWUrl" maxlength="200" placeholder="https://..." aria-label="Webhook-URL">' +
        '<button class="knop" id="enWZet" type="button">Zet aan</button></div>' +
        '<div class="doelkies" data-webhookgeb>' + (haken.gebeurtenissen || []).map(function (g) {
          return '<label><input type="checkbox" value="' + esc(g) + '">' + esc(g) + '</label>';
        }).join('') + '</div>',
        'Een webhook naar een intern adres wordt geweigerd: dat is een aanvaller die onze server laat bellen.');

      h += kaart('Webhooks', (haken.webhooks || []).map(function (w) {
        return '<div class="item"><span>' + esc(w.url) + ' <span class="stil">· ' + (w.gebeurtenissen || []).map(esc).join(', ') + '</span></span>' +
          '<span class="rij"><span class="stil">' + esc(w.status) + ' · ' + (w.geleverd || 0) + ' geleverd' +
          (w.mislukt ? ' · ' + w.mislukt + ' mislukt' : '') + '</span>' +
          '<button class="knop" data-haak="proef" data-id="' + esc(w.id) + '">Proef</button>' +
          (w.status === 'stil' ? '<button class="knop" data-haak="wek" data-id="' + esc(w.id) + '">Wek</button>' : '') +
          '<button class="knop" data-haakweg="' + esc(w.id) + '">Weg</button></span></div>';
      }).join('') || '<p class="stil">Geen webhooks ingesteld.</p>',
      'Elke levering draagt een handtekening (X-RTG-Handtekening) en meldt alleen DAT er iets gebeurde, met ids -- geen namen. Na tien mislukkingen op rij valt een webhook stil.');

      h += '<div class="deel">Tevredenheid</div>';
      h += kaart('Anonieme peiling',
        '<div class="rij"><input class="veld" id="enPTitel" maxlength="100" placeholder="Titel van de peiling" aria-label="Titel van de peiling">' +
        '<input class="veld" id="enPStelling" maxlength="160" placeholder="Stelling (antwoord 1 t/m 5)" aria-label="Stelling">' +
        '<select class="veld h-kolom9" id="enPDoel" aria-label="Doelgroep">' +
        '<option value="ouders">Ouders</option><option value="leerlingen">Leerlingen</option><option value="personeel">Personeel</option></select>' +
        '<button class="knop p" id="enPMaak" type="button">Zet uit</button></div>' +
        (peilingen.peilingen || []).map(function (p) {
          return '<div class="item"><span>' + esc(p.titel) + ' <span class="stil">· ' + esc(p.doelgroep) + '</span></span>' +
            '<span class="rij"><span class="stil">' + p.antwoorden + ' antwoorden' +
            (p.genoeg ? '' : ' · nog geen uitslag') + '</span>' +
            (p.open === false ? '<span class="tag">gesloten</span>'
              : '<button class="knop" data-peilsluit="' + esc(p.id) + '">Sluit</button>') + '</span></div>';
        }).join(''),
        'Alleen scores, geen vrije tekst, geen cijfer per medewerker, en pas vanaf vijf antwoorden een uitslag.');

      /* De export is een AVG-recht en een enterprise-eis. Het zorgdeel gaat
         alleen mee als iemand er expliciet om vraagt -- met een regel in het
         journaal, en dat staat er ook bij. */
      h += kaart('Export',
        '<div class="rij"><button class="knop" id="enExport" type="button">Exporteer de school</button>' +
        '<label class="stil h-rij-mid">' +
