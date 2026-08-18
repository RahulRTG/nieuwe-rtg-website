/* Stand Overzicht, deel 1 -- het tekenwerk van het command center (GELD.md
   par. 2). De oude samenhang-weergave toonde WAT er was; dit toont wat het
   BETEKENT: drie vragen, de verwachting en alleen de uitzonderingen. Bewust
   geen lijst met alles-wat-er-is: een gezonde cockpit is bijna leeg, want
   rust is een uitkomst en geen leegte.

   Registreert GEEN stand en bindt geen knoppen; dat doet deel 3. De splitsing
   bestaat om de 10 KB-maat te halen (scripts/check.js regel 13). De STIJL van dit
   paneel staat sinds die maat weer knelde in deel 1a (overzicht-a.js) en komt
   hier binnen als Deel.ovcss. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };

  /* Kleur is betekenis (ONTWERP.md par. 4): "kijken" is een signaal en blijft
     stil, "voorstellen" wacht op een oordeel van het lid (aandacht-goud, het
     wacht-teken), "klaarzetten" is een ingevulde handeling die alleen nog een
     bevestiging vraagt -- de enige die om een daad vraagt, dus het !-teken.
     Het woord staat er altijd bij: status rust nooit op kleur alleen. */
  var NIVEAU = {
    kijken: { teken: '·', sig: '' },
    voorstellen: { teken: '◷', sig: 'aandacht' },
    klaarzetten: { teken: '!', sig: 'actief' }
  };

  /* Alles gescopet op #ovWrap zodat een andere stand hier nooit iets van
     erft; de kaart, knop en lbl komen uit geld.html zelf. */

  /* Via createElement en NIET als <style> in de html-string: de voordeur
     stempelt alleen createElement-elementen met de CSP-nonce; een blok uit
     innerHTML wordt door style-src geweigerd (zo ging RTG-code ooit
     ongestyled de lucht in). Id-wacht: teken() draait bij elke standwissel. */
  function stijl() {
    if (d.getElementById('ovStijl')) return;
    var css = (w.RTGGeldDeel || {}).ovcss;
    /* GEEN STILLE TERUGVAL OP EEN LEGE STRING, en dat is geen theorie: hier stond
       `|| ''` en deel 1a was nog niet in geld.html gezet. Het paneel tekende
       ongestyled door en niemand merkte het -- behalve de raakvlakronde, die de
       navigatielinks als te kleine knoppen meldde. Een symptoom dat op een heel
       ander probleem wees. Een ontbrekend deel hoort te schreeuwen. */
    if (!css) {
      if (w.console && w.console.error) w.console.error('geld/overzicht: deel 1a (overzicht-a.js) is niet geladen -- dit paneel blijft ongestyled');
      return;
    }
    var st = d.createElement('style');
    st.id = 'ovStijl';
    st.textContent = css;
    d.head.appendChild(st);
  }

  function groet() {
    /* Het uur van de KLANT, niet van de server: wie elders in de wereld zit,
       hoort de begroeting van zijn eigen ochtend. Zonder naam, ook zonder
       codenaam: de begroeting is een moment, geen identificatie, en hoe
       minder plekken een identiteit dragen hoe beter (privacy by design). */
    var u = new Date().getHours();
    return u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
  }

  /* Wat er niet is, is niet nul: euro(null) zou "0,00" tonen, en op zo'n
     nul baseert iemand een uitgave die hij anders niet had gedaan. */
  function bedrag(c) { return Number.isFinite(c) ? w.Geld.euro(c) : 'onbekend'; }
  function mnd(m) {
    if (m == null || !Number.isFinite(Number(m))) return 'onbekend';
    return Number(m).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mnd';
  }

  function cel(lbl, waarde, groot) {
    /* Een dominante KPI, drie stille cijfers (ONTWERP.md par. 3): vrij
       besteedbaar draagt de dag, dus alleen dat mag ceremonieel. */
    return '<div class="ov-cel"><span class="ov-lbl">' + lbl + '</span>' +
      '<span class="' + (groot ? 'rtg-kpi' : 'ov-getal') + ' bedrag">' + waarde + '</span></div>';
  }

  function kaart(x) {
    var esc = w.Geld.esc, n = NIVEAU[x.niveau] || NIVEAU.kijken;
    return '<article class="kaart ov-kaart rtg-rail"' + (n.sig ? ' data-sig="' + n.sig + '"' : '') + '>' +
      '<div class="ov-rij"><span class="rtg-status"' + (n.sig ? ' data-sig="' + n.sig + '"' : '') +
        ' data-teken="' + n.teken + '">' + esc(x.niveau) + '</span>' +
        (Number.isFinite(x.centen) ? '<span class="ov-som bedrag">' + w.Geld.euro(x.centen) + '</span>' : '') +
      '</div>' +
      '<h3 class="ov-titel">' + esc(x.titel) + '</h3>' +
      '<p class="ov-uitleg">' + esc(x.uitleg) + '</p>' +
      '<div class="ov-rij">' +
        '<button class="ov-waarom" type="button" data-ovwaarom="' + esc(x.id) + '">Waarom</button>' +
        (x.actie ? '<a class="knop" href="' + esc(x.actie.link) + '" data-ovactie="' + esc(x.actie.link) + '">' +
          esc(x.actie.label) + '</a>' : '') +
      '</div></article>';
    /* Hier stond de gegevens-lijst nog een keer, verborgen, met het
       commentaar dat deel 3 hem enkel zou hoeven tonen. Dat gebeurde nooit:
       de Waarom-knop vult het eigen #ovWaarom-vlak uit hetzelfde beeld (deel
       2). Twee kopieen van dezelfde gegevens in de DOM, waarvan er een niet
       te bereiken was -- weg dus, en het commentaar erbij. */
  }

  /* De ankerrij komt uit de aanmeldingen zelf (RTGGeld.standen): de naam van
     een stand staat op precies een plek, in de stand. Een tweede lijst hier
     zou er stil van gaan afwijken (LAT.md regel 4). */
  function ankers() {
    var esc = w.Geld.esc;
    return '<nav class="ov-standen" aria-label="De gezichtspunten">' +
      ((w.RTGGeld || {}).standen || []).filter(function (x) { return x.id !== 'overzicht'; })
        .map(function (x) { return '<a href="#' + esc(x.id) + '">' + esc(x.naam) + '</a>'; }).join('') +
      '</nav>';
  }

  /* Tekent de cockpit in #ovVak. Ontbreekt dat vak, dan hoort dit luid stuk
     te gaan en niet stil over te slaan (LAT.md regel 5); daarom geen wacht. */
  function teken(c) {
    stijl();
    var esc = w.Geld.esc, cf = c.cijfers || {}, uz = c.uitzonderingen || [];
    var staat = uz.length === 0 ? 'Alles in orde'
      : uz.length === 1 ? '1 zaak vraagt aandacht'
      : uz.length + ' zaken vragen aandacht';
    $('#ovVak').innerHTML =
      '<div id="ovWrap">' +
        '<header class="ov-start">' +
          '<p class="ov-groet rtg-ceremonie">' + groet() + '</p>' +
          '<p class="ov-staat"' + (uz.length ? ' data-aandacht' : '') + '>' + staat + '</p>' +
          /* Eerlijk over wat niet gemeten is: een "alles in orde" boven een
             stukgevallen bron is precies de stille meter uit LAT.md regel 3. */
          ((c.stil || []).length ? '<p class="ov-stil">Niet opgehaald: ' + esc(c.stil.join(', ')) +
            '. Dit beeld is niet compleet.</p>' : '') +
        '</header>' +
        '<div class="ov-cijfers">' +
          cel('Vrij besteedbaar', bedrag(cf.vrijCenten), true) +
          cel('Vaste lasten 14 dagen', bedrag(cf.lasten14dCenten)) +
          cel('Verwacht einde maand', bedrag(cf.eindeMaandCenten)) +
          cel('Buffer', mnd(cf.bufferMaanden)) +
        '</div>' +
        (c.verwachting ? '<p class="ov-rust">' + esc(c.verwachting) + '</p>' : '') +
        '<div id="ovVooruit"></div>' +
        '<div id="ovZaken">' + (uz.length ? uz.map(kaart).join('')
          /* De beste zin die dit scherm kan zeggen (GELD.md par. 2). */
          : '<p class="stil">U hoeft vandaag niets te doen.</p>') + '</div>' +
        ankers() +
      '</div>';
  }

  /* De drie horizonten in #ovVooruit, dat teken() klaarzet. Elk cijfer draagt
     het woord "verwachting": het is een afgeleide van de geldgraaf en geen
     saldo -- een scherm dat dat verschil laat vallen, bouwt ongemerkt een
     tweede boekhouding (GELD.md par. 1). */
  function deelVooruit(c) {
    var v = (c || {}).vooruitblik || {};
    $('#ovVooruit').innerHTML = '<div class="ov-vooruit">' +
      [['Over 7 dagen', v.d7], ['Over 30 dagen', v.d30], ['Over 90 dagen', v.d90]]
        .map(function (h) {
          return '<div class="ov-vkol"><span class="ov-lbl">' + h[0] + '</span>' +
            '<span class="ov-vsom bedrag">' + bedrag(h[1]) + '</span>' +
            '<span class="ov-vwoord">verwachting</span></div>';
        }).join('') + '</div>';
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.overzicht = { stijl: stijl, teken: teken, deelVooruit: deelVooruit };
})(window, document);
