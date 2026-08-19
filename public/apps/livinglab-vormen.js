/* RTF Living Lab, scherm deel 4: de vormen. De HTML van het dossierblad --
   wat er nog moet gebeuren, het formulier dat bij de HUIDIGE stap hoort, en de
   conclusies met hun bewijsgraad.

   EEN FORMULIER PER STAP, en dat is de belangrijkste keuze in dit bestand.
   Alles tegelijk tonen maakt van een onderzoekscyclus een invulformulier van
   dertig velden, en dan is de volgorde -- die hier het hele punt is -- meteen
   betekenisloos. Wie bij het vraagstuk staat, ziet de hypothese; wie bij de
   resultaten staat, ziet de conclusies.

   De GEBREKEN komen ongewijzigd van de server (/api/lab2/studie/watnu), uit
   dezelfde functie die de stap straks toelaat of weigert. Een scherm dat zijn
   eigen lijstje bijhoudt van wat er nog moet, loopt uit de pas met de poort en
   stuurt mensen naar werk dat niet helpt (regel 4 van de lat).

   Afgesplitst uit ./livinglab-studie.js toen die de 10 KB passeerde; dat bestand
   houdt de bedrading (welke knop doet welk verzoek), dit bestand de vorm. */
(function () {
  'use strict';
  var KADER, esc;

  function init(o) { KADER = o.kader; esc = o.esc; }

  var graadIx = function (g) {
    var x = KADER.bewijs.filter(function (b) { return b.graad === g; })[0];
    return x ? x.rang : 0;
  };

  /* Wat er nog moet gebeuren. Alle gebreken tegelijk, niet alleen het eerste --
     een onderzoeker die er vijf keer achter elkaar op wordt gestuurd, gaat
     vinkjes zetten in plaats van werk doen. De server geeft ze daarom als lijst. */
  function watNuBlok(nu) {
    if (!nu.volgende) return '<div class="kaart"><div class="sec">Klaar</div>' +
      '<div class="leeg">Dit onderzoek heeft de hele cyclus doorlopen.</div></div>';
    return '<div class="kaart"><div class="sec">Volgende stap: ' + esc(nu.volgendeNaam || nu.volgende) + '</div>' +
      (nu.klaar
        ? '<div class="leeg">Alles wat deze stap vraagt, is er.</div>' +
          '<button class="knop" data-stap="' + esc(nu.volgende) + '" type="button">Zet de stap naar ' + esc(nu.volgendeNaam || nu.volgende) + '</button>'
        : '<div class="leeg">Hiervoor moet nog:</div>' +
          nu.gebreken.map(function (g) { return '<div class="gebrek">&bull; ' + esc(g) + '</div>'; }).join('')) +
      '</div>';
  }

  /* Het formulier dat bij de huidige stap hoort. Bewust één per stap. */
  function stapBlok(s) {
    var k = '<div class="kaart">';
    if (s.stap === 'vraagstuk')
      return k + '<div class="sec">Het vraagstuk scherper maken</div>' +
        '<input class="veld" data-vsvraag placeholder="Wat speelt er werkelijk?" maxlength="600" value="' + esc(s.vraagstuk || '') + '">' +
        '<input class="veld h-mt35" data-vsdoel placeholder="Doel (optioneel)" maxlength="400" value="' + esc(s.doel || '') + '">' +
        '<div class="leeg">Dit kan alleen NU. Zodra de hypothese er is staat het vraagstuk vast: ' +
          'een vraag die je bijstelt nadat je de uitkomst kent, is de oudste manier om jezelf gelijk te geven.</div>' +
        '<button class="knop stil" data-vszet type="button">Werk het vraagstuk bij</button>' +
        '<div class="sec h-mt90">Hypothese</div>' +
        '<input class="veld" data-hyp placeholder="Wat verwachten we?" maxlength="500">' +
        '<input class="veld h-mt40" data-hypteg placeholder="Wat zou het TEGENDEEL bewijzen?" maxlength="500">' +
        '<div class="leeg">Zonder het tegendeel is dit een wens en geen hypothese; de server weigert hem dan ook.</div>' +
        '<button class="knop" data-hypzet type="button">Leg vast</button></div>';

    if (s.stap === 'hypothese' || s.stap === 'plan')
      return k + '<div class="sec">Onderzoeksplan</div>' +
        '<div class="rij">' + KADER.methoden.map(function (m) {
          return '<label class="chip"><input type="checkbox" data-m value="' + esc(m.methode) + '"> ' + esc(m.naam) + '</label>';
        }).join('') + '</div>' +
        '<div class="leeg" data-advies>Kies methoden; het systeem rekent dan uit hoe groot de steekproef minstens moet zijn.</div>' +
        '<div class="rij h-mt40">' +
          '<input class="veld" data-steek type="number" min="0" placeholder="Steekproef">' +
          '<input class="veld" data-meet type="number" min="0" placeholder="Meetmomenten"></div>' +
        '<input class="veld h-mt40" data-doel placeholder="Onderzoeksdoel: waaraan ziet u straks dat u het weet?" maxlength="500">' +
        '<button class="knop h-mt40" data-planzet type="button">Leg het plan vast</button></div>';

    /* Alleen `deelnemers`, en niet ook `plan`: die stap wordt hierboven al door
       het onderzoeksplan afgevangen, dus een tweede tak ervoor was dode code die
       nooit werd bereikt. */
    if (s.stap === 'deelnemers')
      return k + '<div class="sec">Ethiek</div>' +
        '<div class="leeg">Risicoklasse: <b>' + esc(s.klasse) + '</b>' +
        (s.gescheiden ? ' &middot; onderzoeksdata blijft gescheiden van gewone Foundation-profielen' : '') +
        '. Wat deze klasse nog vraagt, staat hierboven bij de volgende stap; de klasse, de review en de ' +
        'privacytoets worden ondertekend door een tekenbevoegde van dit lab.</div></div>';

    if (s.stap === 'experiment' || s.stap === 'observaties')
      return k + '<div class="sec">Observatie toevoegen</div>' +
        '<input class="veld" data-obs placeholder="Wat is er waargenomen?" maxlength="500">' +
        '<div class="rij h-mt40">' +
          '<select class="veld" data-obsm aria-label="Methode"><option value="">methode</option>' +
            KADER.methoden.map(function (m) { return '<option value="' + esc(m.methode) + '">' + esc(m.naam) + '</option>'; }).join('') +
          '</select>' +
          '<button class="knop" data-obszet type="button">Leg vast</button></div></div>';

    if (s.stap === 'reflectie')
      return k + '<div class="sec">Reflectie</div>' +
        '<div class="rij"><select class="veld" data-rs aria-label="Soort reflectie">' +
          KADER.reflectiesoorten.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('') +
        '</select></div>' +
        '<input class="veld h-mt40" data-rt placeholder="Wat viel tegen, ging mis, of was onverwacht?" maxlength="600">' +
        '<div class="leeg">Een eerdere conclusie herzien telt hier als het beste werk dat er is.</div>' +
        '<button class="knop" data-rzet type="button">Leg vast</button></div>';

    if (s.stap === 'resultaten')
      return k + '<div class="sec">Conclusie toevoegen</div>' +
        '<input class="veld" data-conc placeholder="Wat concludeert u? Schrijf het als bewering." maxlength="600">' +
        '<div class="leeg">Elke conclusie begint als aanname en stijgt met het bewijs dat u eronder hangt.</div>' +
        '<button class="knop" data-conczet type="button">Voeg toe</button></div>';

    if (s.stap === 'besluit')
      return k + '<div class="sec">Besluit</div>' +
        '<div class="rij"><select class="veld" data-bs aria-label="Besluit">' +
          KADER.besluiten.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('') +
        '</select><input class="veld" data-bd placeholder="Uw naam" maxlength="80"></div>' +
        '<input class="veld h-mt40" data-br placeholder="Waarom dit besluit? Juist bij gestopt is dat de waardevolle regel." maxlength="600">' +
        '<button class="knop" data-bzet type="button">Neem het besluit</button></div>';

    return k + '<div class="sec">' + esc(s.stap) + '</div><div class="leeg">Werk deze stap af via de onderdelen hieronder.</div></div>';
  }

  /* De conclusies met hun bewijsgraad. De graad is geen keuze maar een uitkomst;
     het scherm toont daarom wat er ONDER een conclusie ligt, niet een keuzelijst
     waarmee je hem hoger zet zonder bewijs. */
  function conclusieBlok(s) {
    if (!s.conclusies || !s.conclusies.length) return '';
    return '<div class="kaart"><div class="sec">Conclusies en hun bewijs</div>' +
      s.conclusies.map(function (c) {
        return '<div class="log"><b>' + esc(c.tekst) + '</b><br>' +
          '<span class="graad g' + graadIx(c.graad) + '">' + esc(c.graad) + '</span> &middot; ' +
          ((c.bewijs || []).length) + ' drager(s)' +
          (c.tekenaar ? ' &middot; getekend door ' + esc(c.tekenaar.naam) : '') +
          (c.voorstel ? ' &middot; <span class="pil wacht">voorstel van de coach</span>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  window.LivingLabVormen = { init: init, watNuBlok: watNuBlok, stapBlok: stapBlok, conclusieBlok: conclusieBlok };
})();
