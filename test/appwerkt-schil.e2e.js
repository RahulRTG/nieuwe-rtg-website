/* BEDIENBAAR MEET HET SCHERM, NIET DE SCHIL -- in een echte browser.

   Een synthetisch scherm met de gedeelde schil erop (30 knoppen onder
   .rtg-edge-chrome, plus de toetsknop van het veeggebaar die met opzet buiten
   beeld staat) en drie eigen knoppen, waarvan een op vier kaarten staat. De
   proef hoort:
     1. alleen de eigen knoppen te tellen, en elke knop een keer (noemer 3);
     2. de schil apart te melden, en er niets van aan te tikken;
     3. de toetsknop niet als "niet aan te tikken" te melden;
     4. een eigen knop die de schil HELEMAAL bedekt als bedekt te melden -- de
        tabbalk van Decision Room lag zo onder de Edge, en de proef noemde dat
        "niet aan te tikken" in plaats van een defect.
   Voor 27 september 2026 telde de noemer 30 + 1 + 6 = 37 en tikte de proef de
   eerste 14 aan, allemaal schil: 111 van 112 rijen bleven NIET_GETEST. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const schil = '<div class="rtg-edge-chrome">' +
  Array.from({ length: 30 }, (_, i) => '<button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Schil ' + i + '</button>').join('') +
  '</div><button type="button" class="rnd-toets" style="position:absolute;left:-9999px">Instellingen openen</button>' +
  '<button type="button" data-ds-zoek onclick="window.schilGetikt=(window.schilGetikt||0)+1">Spring naar een functie</button>' +
  '<div class="ds-edge"><button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Vraag Rahul</button></div>' +
  '<div class="rtgsprong"><button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Globale sprong</button></div>' +
  '<button type="button" class="rtg-rahul-tab">Rahul <small>KOMPAS</small></button>' +
  '<section class="rtg-rahul-page"><button type="button">Command-actie</button></section>';
const kaart = '<div class="kaart"><button type="button" onclick="window.eigen=(window.eigen||0)+1">Bekijken</button></div>';
const SCHERM = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Vernieuwen</button>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Filter</button>' +
  kaart + kaart + kaart + kaart + '</main>' + schil + '</body></html>';

/* Een eigen vaste tab onder een vaste balk van de schil, en een die half vrij
   ligt: alleen de eerste is bedekt. */
const BEDEKT = '<!doctype html><html><body><main><p>x</p></main>' +
  '<nav style="position:fixed;bottom:10px;left:0;width:400px;height:50px;display:flex">' +
  '<button type="button" style="width:200px">Onder de balk</button><button type="button" style="width:200px">Half vrij</button></nav>' +
  '<div class="rtg-edge-chrome" style="position:fixed;bottom:0;left:0;width:300px;height:80px;z-index:9;background:#000"></div></body></html>';

/* Elke knop vervangt de hele stand. Een meter die na de eerste tik alleen de
   nieuwe stand bekijkt, rapporteert 1/6 terwijl alle zes knoppen afzonderlijk
   gewoon werken. Heropenen moet de oorspronkelijke stand terugbrengen zonder
   een klik administratief als geslaagd te tellen. */
const STANDWISSEL = '<!doctype html><html><body><main id="vlak">' +
  Array.from({ length: 6 }, (_, i) => '<button type="button" onclick="document.querySelector(\'main\').innerHTML=\'<p>Stand ' + i + '</p>\';window.gedaan=' + (i + 1) + '">Stand ' + i + '</button>').join('') +
  '</main></body></html>';

/* De contextactie blijft na haar tik als enige bediening in de gemuteerde
   stand staan. Zij is al bewezen en kan daar eindeloos worden herhaald. De
   overige beginacties zijn alleen via een schone heropening bereikbaar. Dit
   bootst de Mall na: een geopende dienst of bibliotheek verborg tientallen
   gewone kaarten, terwijl de oude meter de bekende opener bleef herhalen. */
const HERHAALVAL = '<!doctype html><html><body><main id="vlak">' +
  '<button type="button" data-contextactie onclick="document.querySelector(\'main\').innerHTML=this.outerHTML">Open context</button>' +
  Array.from({ length: 5 }, (_, i) => '<button type="button" onclick="window.gedaan=(window.gedaan||0)+1">Gewone actie ' + i + '</button>').join('') +
  '</main></body></html>';

/* De zichtbare status in een kaart mag veranderen zonder dat dezelfde knop
   een tweede, spookachtige identiteit krijgt. De toegankelijke naam is het
   stabiele contract; de tekst eronder blijft vrij om actuele status te tonen. */
const STABIELE_NAAM = '<!doctype html><html><body><main>' +
  '<button type="button" aria-label="Open dossier" onclick="this.textContent=\'Dossier geopend\';window.openAantal=(window.openAantal||0)+1">Dossier beschikbaar</button>' +
  '<button type="button" onclick="window.andere=true">Andere actie</button>' +
  '</main></body></html>';

/* De productie-inventaris bevat schermen met meer dan tachtig unieke
   handelingen. De bewijsgrens is ze allemaal werkelijk aantikken. Elke
   tik hieronder schakelt bewust zichzelf en haar vaste paar uit: na 41 echte tikken is
   de hele stand doorlopen. De schone heropening moet daarna ook de overige
   unieke handtekeningen echt raken; een passende begrenzing bereikt ze alle. */
const BREED_SCHERM = '<!doctype html><html><body><main>' +
  Array.from({ length: 82 }, (_, i) => '<button type="button" id="breed-' + i + '" onclick="document.getElementById(\'breed-' + (i < 41 ? i + 41 : i) + '\').disabled=true;this.disabled=true">Handeling ' + i + '</button>').join('') +
  '</main></body></html>';

const RISICO_SCHERM = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="if(confirm(\'zeker?\'))window.verwijderd=true">Verwijder mijn gegevens</button>' +
  '<button type="button" onclick="fetch(\'/api/risico\',{method:\'POST\',headers:{\'content-type\':\'application/json\'},body:\'{}\'})">Betaal proef</button>' +
  '<button type="button" onclick="document.getElementById(\'paywait\').classList.add(\'open\');setTimeout(()=>fetch(\'/api/pay/saldo\',{method:\'POST\'}).finally(()=>document.getElementById(\'paywait\').classList.remove(\'open\')),1100)">Uit RTG Pay-saldo</button>' +
  '<button type="button" onclick="fetch(\'/api/member/rtmail/verplaats\',{method:\'POST\'})">Opbergen</button>' +
  '<button type="button" onclick="fetch(\'/api/member/rtmail/ster\',{method:\'POST\'})">Ster erop</button>' +
  '<button type="button" onclick="fetch(\'/api/member/rtmail/sluimer\',{method:\'POST\'})">Sluimeren tot morgen</button>' +
  '<input type="button" value="Download overzicht" onclick="window.downloadAangeraakt=true">' +
  '</main><div id="paywait"></div><style>#paywait{display:none}#paywait.open{display:block;position:fixed;inset:0}</style></body></html>';

/* De eerste bediening laat bewust een niet-sluitende laag achter. De overige
   knoppen zijn op de schone ingang wel bereikbaar. Dit onderscheidt een door
   de meetvolgorde veroorzaakte blokkade van een echte overlap in het product. */
const ACHTERGEBLEVEN_LAAG = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="document.body.insertAdjacentHTML(\'beforeend\',\'<div id=&quot;achtergebleven&quot; style=&quot;position:fixed;inset:0;z-index:99;background:#fff&quot;></div>\')">Open laag</button>' +
  Array.from({ length: 5 }, (_, i) => '<button type="button" onclick="window.gedaan=(window.gedaan||0)+1">Actie ' + i + '</button>').join('') +
  '</main><div id="onbGate" style="position:fixed;inset:0;z-index:130;background:#000"></div>' +
  '<script>setTimeout(()=>document.getElementById("onbGate").hidden=true,350)</script></body></html>';

/* Een app-eigen dialoog is geen schil: de opener is pas de ingang naar de
   bediening die gekwalificeerd moet worden. De dialoog zit bewust achter twee
   opeenvolgende openers en sluit na iedere keuze beide lagen. De meter moet dus
   A -> B kunnen herhalen om ELKE volgende unieke dialoogactie te bereiken. */
const VERVOLGDIALOOG = '<!doctype html><html><body><main>' +
  '<button type="button" id="open" aria-controls="categorie" onclick="document.getElementById(\'categorie\').hidden=false">Open categorie</button>' +
  '<section id="categorie" hidden><button type="button" id="instellingen" aria-haspopup="dialog" aria-controls="vervolgdeck" onclick="document.querySelector(\'dialog\').showModal()">Open instellingen</button></section>' +
  '<dialog id="vervolgdeck"><button type="button" onclick="this.closest(\'dialog\').close();document.getElementById(\'categorie\').hidden=true">Sluiten</button>' +
  Array.from({ length: 6 }, (_, i) => '<button type="button" onclick="window.gedaan=(window.gedaan||0)+1;this.closest(\'dialog\').close();document.getElementById(\'categorie\').hidden=true">Keuze ' + i + '</button>').join('') +
  '</dialog></main></body></html>';

/* Als alle unieke bediening van een open dialoog al is geraakt, moet de
   replay de laag sluiten voordat hij naar een nog onaangeraakte achtergrond-
   knop gaat. De taakactie blijft bewust open: haar een tweede keer aantikken
   is geen nieuw bewijs en veroorzaakt in echte apps opnieuw dezelfde taak. */
const AFGEWERKTE_DIALOOG = '<!doctype html><html><body><main>' +
  '<button type="button" aria-haspopup="dialog" aria-controls="taakdeck" onclick="document.querySelector(\'dialog\').showModal()">Open taak</button>' +
  '<button type="button" onclick="window.verder=true">Volgende hoofdactie</button>' +
  '<dialog id="taakdeck"><button type="button" onclick="this.closest(\'dialog\').close()">Sluiten</button>' +
  '<button type="button" onclick="fetch(\'/api/dialoogactie\',{method:\'POST\'})">Taakactie</button></dialog>' +
  '</main></body></html>';

/* Veel RTG-panelen gebruiken het toegankelijke role=dialog-contract zonder
   aria-modal. Ook daar is de dialoog de actieve laag. De CSS-onzichtbare knop
   mag pas meetellen nadat de zichtbare actie haar werkelijk onthult. */
const ROLE_DIALOG = '<!doctype html><html><body><main>' +
  '<button type="button" aria-haspopup="dialog" aria-controls="paneel" onclick="document.getElementById(\'paneel\').hidden=false">Open paneel</button>' +
  '<button type="button" onclick="window.hoofdactie=true">Volgende hoofdactie</button>' +
  '<div id="paneel" role="dialog" hidden><button type="button" onclick="this.parentNode.hidden=true">Sluiten</button>' +
  '<button type="button" onclick="document.getElementById(\'later\').style.opacity=1">Toon vervolg</button>' +
  '<button id="later" type="button" style="opacity:0" onclick="window.vervolg=true">Verborgen vervolg</button></div>' +
  '</main></body></html>';

/* Een dialoog met tabpanelen kan een handeling laten zien en daarna weer
   verbergen voordat zij in DOM-volgorde aan de beurt komt. De meter moet de
   expliciete tabroute dan herhalen en pas sluiten als beide panelen werkelijk
   zijn bediend. */
const PANEEL_TABS = '<!doctype html><html><body><main>' +
  '<button type="button" aria-haspopup="dialog" aria-controls="deck" onclick="document.getElementById(\'deck\').hidden=false">Open control plane</button>' +
  '<section id="deck" role="dialog" hidden><button type="button" aria-label="Sluit commandodeck" onclick="this.parentNode.hidden=true">SLUIT</button>' +
  '<button type="button" role="tab" aria-controls="overzicht" onclick="toon(\'overzicht\')">Overzicht</button>' +
  '<button type="button" role="tab" aria-controls="beleid" onclick="toon(\'beleid\')">Beleid</button>' +
  '<button type="button" role="tab" aria-controls="rahul" onclick="toon(\'rahul\')">Rahul</button>' +
  '<div id="overzicht"></div><div id="beleid" hidden><button type="button" onclick="window.beleid=true">AAN</button></div>' +
  '<div id="rahul" hidden><button type="button" onclick="window.rahul=true">ANALYSEER CONTEXT</button></div></section>' +
  '<script>function toon(id){for(const el of document.querySelectorAll("#overzicht,#beleid,#rahul"))el.hidden=el.id!==id}' +
  'document.addEventListener("keydown",function(e){if(e.key==="Escape")document.getElementById("deck").hidden=true})</script>' +
  '</main></body></html>';

const RUNTIME_WACHT = '<!doctype html><html><body><main>' +
  '<button class="rtg-intel-command" id="runtime-open" type="button" aria-haspopup="dialog" aria-controls="runtime-deck">OPEN COMMAND</button></main>' +
  '<script>setTimeout(function(){document.body.insertAdjacentHTML("beforeend",' +
  "'<div class=\"rtg-intel-scrim\" hidden><section id=\"runtime-deck\" role=\"dialog\"><button type=\"button\" id=\"runtime-doe\">Voer uit</button><button type=\"button\" aria-label=\"Sluiten\" id=\"runtime-sluit\">Sluiten</button></section></div>');" +
  'var s=document.querySelector(".rtg-intel-scrim");document.getElementById("runtime-open").onclick=function(){s.hidden=false};' +
  'document.getElementById("runtime-doe").onclick=function(){window.runtimeGedaan=true};document.getElementById("runtime-sluit").onclick=function(){s.hidden=true}},350)</script>' +
  '</body></html>';

const NAVIGEERT = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="location.href=\'/apps/bestemming.html\'">Terug</button>' +
  '<button type="button" onclick="window.lokaal=true">Lokale actie</button>' +
  '</main></body></html>';

/* De RTG-browser vervangt Home door een interne Contact-stand. Daar staat een
   verzendactie, maar de vaste Home-route komt in DOM-volgorde eerst en maakt
   haar weer onzichtbaar. Alleen het publieke data-stand-contract geeft de
   meter een controleerbare route terug naar de nog onaangeraakte actie. */
const PAGINA_ROUTE = '<!doctype html><html><body><main id="vlak"></main><script>' +
  'function teken(pad){document.getElementById("vlak").innerHTML=' +
  '`<button type="button" data-stand="home" ${pad?"":"disabled"} onclick="teken(\\\'\\\')">Home</button>`+' +
  '`<button type="button" data-stand="contact" ${pad?"disabled":""} onclick="teken(\\\'contact\\\')">Contact</button>`+' +
  '(pad?`<button type="button" onclick="window.verstuurd=true">Verstuur</button>`:"")}' +
  'teken("")</script></body></html>';
const BESTEMMING = '<!doctype html><html><body><main>' +
  Array.from({ length: 12 }, (_, i) => '<button type="button">Vreemde actie ' + i + '</button>').join('') +
  '</main></body></html>';

const MODULEBEREIK = '<!doctype html><html><body><main>' +
  Array.from({ length: 8 }, (_, i) => '<button type="button">Andere module ' + i + '</button>').join('') +
  '<section data-view="doel"><button type="button">Doel een</button><button type="button">Doel twee</button></section>' +
  '</main></body></html>';

test('APPWERKT wijst de canonieke premium-suite aan een Lifestyle-lid toe', () => {
  const { PREMIUM } = require('../scripts/lib/wereldregister');
  const { rijen } = require('../scripts/appwerkt');
  const alle = rijen();
  for (const sleutel of PREMIUM) {
    const rij = alle.find((r) => r.functie === 'link:' + sleutel);
    assert.ok(rij, 'premium-app ontbreekt uit de wereldkaart: ' + sleutel);
    assert.equal(rij.persona, 'lifestyle', sleutel + ' wordt niet met de menselijke Lifestyle-route gemeten');
  }
  const gewone = alle.find((r) => r.functie === 'link:ik');
  assert.ok(gewone, 'de gewone ledenapp Ik ontbreekt');
  assert.equal(gewone.persona, 'lid', 'een gewone ledenapp mag niet onbedoeld Lifestyle vereisen');
});

test('bedienbaar telt de eigen knoppen, een keer elk, en laat de schil liggen', { skip: geenBrowser(pw) }, async () => {
  const { bedien } = require('../scripts/appwerkt');
  let risicoMutaties = 0;
  let uitgesteldeBetaalmutaties = 0;
  let dialoogActies = 0;
  const srv = http.createServer((req, res) => {
    if (req.url === '/api/dialoogactie') { dialoogActies++; res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
    if (req.url === '/api/risico') {
      risicoMutaties++;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
      return;
    }
    if (req.url === '/api/pay/saldo') {
      uitgesteldeBetaalmutaties++;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(req.url.startsWith('/apps/bedekt') ? BEDEKT :
      (req.url.startsWith('/apps/standwissel') ? STANDWISSEL :
        (req.url.startsWith('/apps/herhaalval') ? HERHAALVAL :
        (req.url.startsWith('/apps/stabielenaam') ? STABIELE_NAAM :
        (req.url.startsWith('/apps/breed') ? BREED_SCHERM :
        (req.url.startsWith('/apps/risico') ? RISICO_SCHERM :
        (req.url.startsWith('/apps/achtergebleven') ? ACHTERGEBLEVEN_LAAG :
          (req.url.startsWith('/apps/vervolg') ? VERVOLGDIALOOG :
            (req.url.startsWith('/apps/afgewerkt') ? AFGEWERKTE_DIALOOG :
                (req.url.startsWith('/apps/roledialog') ? ROLE_DIALOG :
                (req.url.startsWith('/apps/paneeltabs') ? PANEEL_TABS :
                (req.url.startsWith('/apps/runtimewacht') ? RUNTIME_WACHT :
                (req.url.startsWith('/apps/navigeert') ? NAVIGEERT :
                  (req.url.startsWith('/apps/bestemming') ? BESTEMMING :
                    (req.url.startsWith('/apps/module') ? MODULEBEREIK : SCHERM))))))))))))))); });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const b = await bedien(ctx, base, '/apps/x.html');
    assert.equal(b.gevonden, 3, 'drie eigen knoppen; vier keer "Bekijken" is een handeling');
    assert.equal(b.geklikt, 3, 'en alle drie zijn aangetikt');
    assert.equal(b.schil, 36, 'de generieke Edge-, Rahul- en Design-Systemschil worden apart gemeld');
    assert.deepEqual(b.nietKlikbaar, [], 'de toetsknop buiten beeld is geen bevinding over dit scherm');
    assert.equal(b.geklikt, b.gevonden, 'alle unieke eigen bediening is aangetikt');
    assert.deepEqual(b.bedekt, [], 'niets van het scherm ligt onder de schil');

    const d = await bedien(ctx, base, '/apps/bedekt.html');
    assert.equal(d.bedekt.length, 1, 'de tab onder de balk is bedekt: ' + JSON.stringify(d.bedekt));
    assert.match(d.bedekt[0], /^Onder de balk onder div\.rtg-edge-chrome/);

    const s = await bedien(ctx, base, '/apps/standwissel.html');
    assert.equal(s.gevonden, 6, 'de oorspronkelijke stand bevat zes eigen handelingen');
    assert.equal(s.geklikt, 6, 'iedere handeling is na een schone heropening werkelijk aangetikt');
    assert.ok(s.instrument.some((x) => /oorspronkelijke stand/.test(x)), 'de meting verantwoordt haar heropeningen');
    assert.deepEqual(s.crash.concat(s.serverfout), [], 'de standwissels bleven zonder browser- of serverfout');

    const val = await bedien(ctx, base, '/apps/herhaalval.html');
    assert.equal(val.gevonden, 6, 'de contextactie en vijf gewone beginacties staan in de noemer');
    assert.equal(val.geklikt, val.gevonden, 'de meter keert eerst schoon terug en raakt alle gewone beginacties');
    assert.deepEqual(val.onaangeraakt, [], 'de bekende contextopener houdt geen beginactie gevangen');
    assert.ok(val.instrument.some((x) => /oorspronkelijke stand/.test(x)),
      'de kortste herstelroute via de schone ingang is controleerbaar vastgelegd');

    const stabiel = await bedien(ctx, base, '/apps/stabielenaam.html');
    assert.equal(stabiel.gevonden, 2, 'de toegankelijke naam houdt een knop stabiel bij veranderende statustekst');
    assert.equal(stabiel.geklikt, 2, 'beide werkelijke handelingen zijn eenmaal aangeraakt');

    const breed = await bedien(ctx, base, '/apps/breed.html');
    assert.equal(breed.gevonden, 82, 'alle unieke handelingen van het brede scherm staan in de noemer');
    assert.equal(breed.geklikt, breed.gevonden, 'de proef raakt alle brede bediening met echte tikken');
    assert.ok(breed.geklikt <= 1024, 'de brede tegenproef blijft begrensd');
    assert.deepEqual(breed.nietKlikbaar, [], 'geen handeling is administratief groen gemaakt');

    const risico = await bedien(ctx, base, '/apps/risico.html');
    assert.equal(risico.geklikt, risico.gevonden, 'ook risicovolle en input-knoppen zijn werkelijk aangeraakt');
    assert.deepEqual(risico.risicovolAangeraakt.sort(), ['Betaal proef', 'Download overzicht', 'Opbergen', 'Sluimeren tot morgen', 'Ster erop', 'Uit RTG Pay-saldo', 'Verwijder mijn gegevens']);
    assert.ok(risico.instrument.some((x) => /browserbevestiging/.test(x)), 'de onomkeerbare bevestiging is afgebroken');
    assert.equal(risicoMutaties, 0, 'de UI-meting voert geen risicovolle servermutatie uit');
    assert.equal(uitgesteldeBetaalmutaties, 0, 'ook een uitgestelde Face ID-mutatie blijft in de tijdelijke UI-fixture');
    assert.deepEqual(risico.risicoFixtures, [
      { knop: 'Betaal proef', methode: 'POST', pad: '/api/risico' },
      { knop: 'Uit RTG Pay-saldo', methode: 'POST', pad: '/api/pay/saldo' },
      { knop: 'Opbergen', methode: 'POST', pad: '/api/member/rtmail/verplaats' },
      { knop: 'Ster erop', methode: 'POST', pad: '/api/member/rtmail/ster' },
      { knop: 'Sluimeren tot morgen', methode: 'POST', pad: '/api/member/rtmail/sluimer' }
    ],
      'de onderschepte mutatie is expliciet en controleerbaar verantwoord');

    const a = await bedien(ctx, base, '/apps/achtergebleven.html');
    assert.equal(a.gevonden, 6, 'de schone ingang bevat zes eigen handelingen');
    assert.equal(a.geklikt, 6, 'een achtergebleven laag blokkeert de overige tegenproeven niet');
    assert.deepEqual(a.nietKlikbaar, [], 'een uitsluitend door de vorige proefstand geblokkeerde knop is opnieuw getoetst');
    assert.ok(a.instrument.some((x) => /schone ingang/.test(x)), 'de herhaalde tegenproef is verantwoord');
    assert.deepEqual(a.onderschept, [], 'ook na iedere schone heropening wacht de meter tot de echte onboardinglaag weg is');

    const v = await bedien(ctx, base, '/apps/vervolg.html');
    assert.equal(v.gevonden, 9, 'beide openers, sluitroute en zes app-eigen dialoogacties zijn over alle standen uniek gemeten');
    assert.equal(v.geklikt, 9, 'de volledige tweelaagse route en alle dialooghandelingen zijn werkelijk aangetikt');
    assert.deepEqual(v.nietKlikbaar, [], 'de dialooginhoud bleef bereikbaar');
    assert.ok(v.instrument.some((x) => /toestandsafhankelijke openerketen/.test(x)),
      'de meter verantwoordt de meerlaagse replay zonder de openers dubbel te tellen');

    const klaar = await bedien(ctx, base, '/apps/afgewerkt.html');
    assert.equal(klaar.geklikt, klaar.gevonden, 'na de afgewerkte dialoog wordt de resterende hoofdactie geraakt');
    assert.equal(dialoogActies, 1, 'een reeds bewezen taakactie wordt niet opnieuw uitgevoerd om de dialoog te verlaten');
    assert.deepEqual(klaar.nietKlikbaar, [], 'de expliciete sluitroute houdt de achtergrond bereikbaar');
    assert.deepEqual(klaar.onaangeraakt, [], 'de bewijsuitvoer noemt geen reeds geraakte bediening als restant');

    const role = await bedien(ctx, base, '/apps/roledialog.html');
    assert.equal(role.gevonden, 5, 'de role-dialog en het pas later zichtbare vervolg tellen ieder precies eenmaal');
    assert.equal(role.geklikt, role.gevonden, 'ook een role-dialog zonder aria-modal wordt volledig bediend');
    assert.deepEqual(role.onaangeraakt, [], 'CSS-onzichtbare bediening telt pas zodra zij werkelijk zichtbaar is');

    const panelen = await bedien(ctx, base, '/apps/paneeltabs.html');
    assert.equal(panelen.gevonden, 7, 'opener, sluiter, drie tabs en twee paneelacties staan in de noemer');
    assert.equal(panelen.geklikt, panelen.gevonden, 'iedere paneelactie wordt via herhaalde expliciete tabnavigatie geraakt');
    assert.ok(panelen.aangeraakt.includes('AAN') && panelen.aangeraakt.includes('ANALYSEER CONTEXT'),
      'het bewijs noemt de werkelijk aangeraakte paneelacties bij naam');
    assert.deepEqual(panelen.onaangeraakt, [], 'geen eerder geziene maar tijdelijk verborgen paneelactie blijft liggen');

    const runtime = await bedien(ctx, base, '/apps/runtimewacht.html');
    assert.equal(runtime.gevonden, 3, 'de opener en twee laat gemonteerde dialoogacties zijn gevonden');
    assert.equal(runtime.geklikt, runtime.gevonden, 'de meter wacht op de runtime voordat hij de opener bedient');
    assert.deepEqual(runtime.onaangeraakt, [], 'geen klik verdwijnt voordat de runtime haar handler heeft gekoppeld');

    const nav = await bedien(ctx, base, '/apps/navigeert.html');
    assert.equal(nav.gevonden, 2, 'bediening van het bestemmingsscherm vervuilt de noemer van de bronapp niet');
    assert.equal(nav.geklikt, 2, 'de navigatieknop en de lokale actie worden beide werkelijk aangeraakt');
    assert.deepEqual(nav.onaangeraakt, [], 'de twaalf vreemde bestemmingsknoppen zijn geen schijnrestant');
    assert.ok(nav.instrument.some((x) => /bestemmingsscherm/.test(x)), 'de navigatieheropening is controleerbaar verantwoord');

    const { meetIngang } = require('../scripts/appwerkt');
    const meet = meetIngang({ functie: 'tab:doel' }, {
      'tab:doel': { ingang: '/apps/module.html', via: '#tab=doel', bereik: '[data-view="doel"]' }
    });
    assert.equal(meet.bereik, '[data-view="doel"]', 'het modulecontract draagt zijn expliciete meetbereik');
    const m = await bedien(ctx, base, meet);
    assert.equal(m.gevonden, 2, 'alleen de bediening van de bedoelde interne module telt');
    assert.equal(m.geklikt, 2, 'beide modulehandelingen zijn aangetikt');
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
});

test('een interne browserpagina blijft herstelbaar tot haar laatste actie is geraakt',
  { skip: geenBrowser(pw), timeout: 30000 }, async () => {
  const { bedien } = require('../scripts/appwerkt');
  const srv = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(PAGINA_ROUTE);
  });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pagina = await bedien(ctx, base, '/apps/paginaroute.html');
    assert.equal(pagina.gevonden, 3, 'Home, Contact en de toestandsgebonden verzendactie staan in de noemer');
    assert.equal(pagina.geklikt, pagina.gevonden, 'de interne Contact-route wordt herhaald tot Verstuur werkelijk is geraakt');
    assert.deepEqual(pagina.onaangeraakt, [], 'geen bediening achter een interne sitepagina blijft achter');
    assert.ok(pagina.aangeraakt.includes('Verstuur'), 'de vervolgactie is echt bediend en niet administratief afgevinkt');
    await ctx.close();
  } finally {
    await browser.close();
    srv.close();
  }
});

/* OS-apps hebben geen eigen URL. De meter moet daarom dezelfde zichtbare route
   als een lid lopen (Edge -> Rahul -> opdracht), en daarna uitsluitend de
   geopende kiezer tellen. Bellen en Snaps krijgen een echt verbonden
   proefcontact; zonder contact zou een lege kiezer geen bediening bewijzen. */
test('OS-apps openen via Rahul en APPWERKT meet uitsluitend hun kiezer',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies, opslagVoor, verbindProeflid } = require('../scripts/lib/proefsessies');
  const { rijen, meetIngang, maakContext, bezoek } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-os-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies } = await haalSessies(base, ['lid']);
    const contact = await verbindProeflid(base);
    assert.equal(contact.ok, true, contact.reden);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await maakContext(browser, opslagVoor({
      lid: { ...sessies.lid, waarde: contact.token }
    }));
    const perFunctie = new Map(rijen().map((r) => [r.functie, r]));
    for (const functie of ['os:bellen', 'os:videobellen', 'os:snaps', 'os:werk', 'os:rtf']) {
      const meet = meetIngang(perFunctie.get(functie));
      assert.equal(meet.adapter.type, 'rahul-opdracht', functie);
      const gezien = await bezoek(ctx, base, meet);
      assert.deepEqual(gezien.crash, [], functie + ': de zichtbare ingang opent niet');
      assert.equal(gezien.poort, false, functie + ': de ingang bleef achter een poort');
      const bediening = await require('../scripts/appwerkt').bedien(ctx, base, meet);
      assert.ok(bediening.gevonden >= 1, functie + ': de geopende appstand heeft geen eigen bediening');
      assert.equal(bediening.geklikt, bediening.gevonden,
        functie + ': niet alle appbediening is aangeraakt (' + bediening.geklikt + '/' + bediening.gevonden + ')');
      assert.deepEqual(bediening.crash.concat(bediening.serverfout), [], functie + ': de appstand veroorzaakte fouten');
      assert.equal(bediening.schil, 0, functie + ': gedeelde Edge-bediening lekte in het meetbereik');
    }
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});

test('APPWERKT opent Bord en Schrift met hun echte tabgebonden Schoolpas',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies } = require('../scripts/lib/proefsessies');
  const { haalSchoolsessies, maakSchoolContext } = require('../scripts/lib/schoolproefsessies');
  const { rijen, meetIngang, maakContext, bezoek, bedien } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-school-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies, overgeslagen } = await haalSessies(base, ['lid', 'gezin']);
    assert.deepEqual(overgeslagen, []);
    const school = await haalSchoolsessies(base, sessies);
    assert.ok(school, 'de echte les- en leerlingensessies moeten bestaan');
    browser = await pw.chromium.launch(browserOpties(pw));
    const perFunctie = new Map(rijen().map((r) => [r.functie, r]));
    for (const [functie, sleutel] of [['link:rtfbord', 'bord'], ['link:rtfschrift', 'schrift']]) {
      const ctx = await maakSchoolContext(browser, school[sleutel], maakContext);
      const meet = meetIngang(perFunctie.get(functie));
      const gezien = await bezoek(ctx, base, meet);
      assert.deepEqual(gezien.crash, [], functie + ': de ingang opent niet');
      assert.equal(gezien.poort, false, functie + ': de Schoolpas opende de deur niet');
      const bediening = await bedien(ctx, base, meet);
      assert.ok(bediening.gevonden >= 1, functie + ': het scherm heeft geen meetbare bediening');
      assert.equal(bediening.geklikt, bediening.gevonden,
        functie + ': niet alle bediening is aangeraakt (' + bediening.geklikt + '/' + bediening.gevonden + '): ' +
        JSON.stringify({ overgeslagen: bediening.overgeslagen, nietKlikbaar: bediening.nietKlikbaar,
          onderschept: bediening.onderschept, instrument: bediening.instrument }));
      assert.deepEqual(bediening.crash.concat(bediening.serverfout), [], functie + ': de bediening veroorzaakte fouten');
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});

test('APPWERKT opent Gezin alleen voor het echt uitgenodigde gratis account',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stopHard } = require('./helper');
  const { haalSessies, opslagVoor, verbindGezinProeflid } = require('../scripts/lib/proefsessies');
  const { rijen, meetIngang, maakContext, openIngang, bezoek, bedien } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-gezin-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies, overgeslagen } = await haalSessies(base, ['lid']);
    assert.deepEqual(overgeslagen, []);
    const gekoppeld = await verbindGezinProeflid(base);
    assert.equal(gekoppeld.ok, true, gekoppeld.reden);
    async function stateVan(token) {
      const r = await fetch(base + '/api/state', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + token
      }, body: '{}' });
      assert.equal(r.status, 200, 'de eigen accountprojectie moet beschikbaar zijn');
      return (await r.json()).state;
    }
    const eigen = await stateVan(gekoppeld.token), vreemd = await stateVan(sessies.lid.waarde);
    assert.equal(eigen.user.tier, 'guest', 'een gezinsuitnodiging geeft geen betaalde pas');
    assert.equal(eigen.user.account, true);
    assert.equal(eigen.foundation.gekoppeld.length, 1);
    assert.equal(eigen.foundation.gekoppeld[0].gezinNaam, gekoppeld.gezinNaam);
    assert.equal(vreemd.user.tier, 'guest');
    assert.notEqual(vreemd.user.id, eigen.user.id);
    assert.equal(Object.hasOwn(vreemd, 'foundation'), false, 'een vreemde gratis persoon krijgt geen gezinsprojectie');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await maakContext(browser, opslagVoor({
      lid: { ...sessies.lid, waarde: gekoppeld.token }
    }));
    const rij = rijen().find((r) => r.functie === 'tab:gezin');
    const meet = meetIngang(rij);
    for (const [naam, opslag, ingelogd] of [
      ['ongebonden gratis account', opslagVoor({ lid: sessies.lid }), true],
      ['anonieme bezoeker', opslagVoor({}), false]
    ]) {
      const controle = await maakContext(browser, opslag), page = await controle.newPage();
      try {
        await openIngang(page, base, meet);
        await page.locator(ingelogd ? '#app.active' : '#gate').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#tabGezin').evaluate(el => el.classList.contains('h-weg')), true, naam);
        assert.equal(await page.locator('#gezinFamilies [data-los], #rtfReplyBtn').count(), 0,
          naam + ' krijgt geen gekoppelde gezinsbediening');
        assert.equal((await page.locator('#gezinFamilies').textContent()).includes(gekoppeld.gezinNaam), false,
          naam + ' ziet geen gegevens van het gekoppelde gezin');
        assert.equal(await page.locator('#gezinInfo').textContent(), '', naam + ' ziet geen gezinsinfo');
        assert.equal(await page.locator('#gezinChat').textContent(), '', naam + ' ziet geen gezinschat');
      } finally { await controle.close(); }
    }
    const gezien = await bezoek(ctx, base, meet);
    assert.deepEqual(gezien.crash, [], 'de gekoppelde gezinsstand opent niet');
    assert.equal(gezien.poort, false, 'het gekoppelde lid bleef achter een poort');
    const bediening = await bedien(ctx, base, meet);
    assert.ok(bediening.gevonden >= 1, 'de gekoppelde gezinsstand heeft geen eigen bediening');
    assert.equal(bediening.geklikt, bediening.gevonden,
      'niet alle gezinsbediening is aangeraakt (' + bediening.geklikt + '/' + bediening.gevonden + ')');
    assert.deepEqual(bediening.crash.concat(bediening.serverfout), [],
      'de gezinsbediening veroorzaakte fouten');
    // De test vangt de bestaande API-instantie, zonder productie-testdeur.
    // Beide tokens komen van echte accounts; het oude HTTP-antwoord is echt.
    const wissel = await ctx.newPage();
    await wissel.addInitScript(() => {
      Object.defineProperty(window, 'RTGApp', { configurable: true, set(shell) {
        Object.defineProperty(window, 'RTGApp', { configurable: true, writable: true, value: shell });
        const maak = shell.maakAPI;
        shell.maakAPI = function(opts) {
          const api = maak.call(this, opts);
          if (opts?.foutTekst === 'API-fout') window.__appwerktAPI = api;
          return api;
        };
      } });
    });
    await openIngang(wissel, base, meet);
    await wissel.locator('#gezinFamilies [data-los]').waitFor({ state: 'visible' });
    assert.equal(await wissel.evaluate(() => window.__appwerktAPI.token), gekoppeld.token);
    let geefWisselVrij, wisselBinnen, wisselFout, eersteState = true;
    const wisselVrij = new Promise(resolve => { geefWisselVrij = resolve; });
    const wisselVast = new Promise((resolve, reject) => { wisselBinnen = resolve; wisselFout = reject; });
    await wissel.route(/\/api\/state$/, async route => {
      if (!eersteState) return route.continue();
      eersteState = false;
      try {
        const antwoord = await route.fetch();
        assert.equal(antwoord.status(), 200);
        assert.equal((await antwoord.json()).state.foundation.gekoppeld[0].code, eigen.foundation.gekoppeld[0].code);
        wisselBinnen(); await wisselVrij; await route.fulfill({ response: antwoord });
      } catch (e) { wisselFout(e); }
    });
    try {
      await wissel.evaluate(() => { window.__appwerktOudeState = window.RTGRealtime.onSync('foundation'); });
      await wisselVast;
      await wissel.evaluate(async token => {
        window.__appwerktAPI.token = token;
        await window.RTGRealtime.onSync('foundation');
      }, sessies.lid.waarde);
      assert.equal(await wissel.locator('#gezinFamilies [data-los], #rtfReplyBtn').count(), 0);
      assert.equal(await wissel.locator('#gezinInfo').textContent(), '');
      assert.equal(await wissel.locator('#gezinChat').textContent(), '');
      geefWisselVrij();
      await wissel.evaluate(() => window.__appwerktOudeState);
      assert.equal(await wissel.evaluate(() => window.__appwerktAPI.token), sessies.lid.waarde);
      assert.equal(await wissel.locator('#tabGezin').evaluate(el => el.classList.contains('h-weg')), true);
      assert.equal(await wissel.locator('#gezinFamilies [data-los], #rtfReplyBtn').count(), 0,
        'een laat volledig antwoord van het vorige account herstelt diens binding niet');
      assert.equal(await wissel.locator('#gezinInfo').textContent(), '');
      assert.equal(await wissel.locator('#gezinChat').textContent(), '');
    } finally { geefWisselVrij(); await wissel.unrouteAll({ behavior: 'wait' }); await wissel.close(); }
    // Zonder herladen moet de echte ontkoppelactie ook de eerder ontvangen
    // clientprojectie intrekken; een nieuwe lege context zou dit niet bewijzen.
    const page = await ctx.newPage();
    await openIngang(page, base, meet);
    const los = page.locator('#gezinFamilies [data-los]');
    await los.waitFor({ state: 'visible' });
    assert.equal(await los.count(), 1, 'de bestaande binding staat vóór intrekken werkelijk in de browser');
    await page.locator('#gezinInfo .card').first().waitFor({ state: 'visible' });
    await page.locator('#gezinChat [data-chat]').first().waitFor({ state: 'visible' });
    assert.match(await page.locator('#gezinInfo').textContent(), /Belangrijke info/);
    assert.match(await page.locator('#gezinChat').textContent(), /Papa/);
    await page.locator('#gezinChat [data-chat]').first().click();
    // Een nieuw gezin heeft nog geen berichten: de lege flex-lijst heeft nul
    // hoogte. Bewijs echte bediening én gevoelige inhoud vóór het intrekken.
    await page.locator('#grtIn').waitFor({ state: 'visible' });
    assert.match(await page.locator('#grtThread').textContent(), /Gesprek met Papa/);
    const priveBericht = 'Privé gezinsbericht vóór het intrekken.';
    await page.locator('#grtIn').fill(priveBericht);
    const [verstuurd] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/foundation/gezin/chat') && r.request().method() === 'POST'),
      page.locator('#grtStuur').click()
    ]);
    assert.equal(verstuurd.status(), 200, 'het privébericht is echt door de bevoegde serverroute aangenomen');
    assert.equal((await verstuurd.json()).bericht.tekst, priveBericht);
    await page.locator('#grtMsgs').getByText(priveBericht, { exact: true }).waitFor({ state: 'visible' });
    // Houd echte, vóór intrekken geautoriseerde antwoorden vast. Geen verzonnen
    // payload: na intrekken mag zelfs deze succesvolle oude inhoud niet terugkomen.
    let geefVrij, alleBinnen, stuk;
    const vrij = new Promise(resolve => { geefVrij = resolve; });
    const binnen = new Promise((resolve, reject) => { alleBinnen = resolve; stuk = reject; });
    const vast = new Set();
    const vertraag = /\/api\/(?:rtf\/(?:overzicht|kanaal)|foundation\/gezin\/[^/]+\/chat\/[^/?]+)$/;
    await page.route(vertraag, async route => {
      try {
        const antwoord = await route.fetch();
        assert.equal(antwoord.status(), 200, 'alle vertraagde antwoorden waren vóór intrekken bevoegd');
        const pad = new URL(route.request().url()).pathname;
        if (pad.includes('/chat/')) {
          assert.ok((await antwoord.json()).berichten.some(m => m.tekst === priveBericht),
            'de vertraagde echte thread bevat het eerder zichtbare privébericht');
        }
        vast.add(pad);
        if (vast.size === 3) alleBinnen();
        await vrij;
        await route.fulfill({ response: antwoord });
      } catch (e) { stuk(e); }
    });
    try {
      await page.evaluate(() => window.RTGRealtime.onSync('foundation'));
      await page.locator('#gezinChat [data-chat]').first().click();
      await binnen;
      let stateBinnen, stateFout, eerste = true;
      const stateVast = new Promise((resolve, reject) => { stateBinnen = resolve; stateFout = reject; });
      await page.route(/\/api\/state$/, async route => {
        if (!eerste) return route.continue();
        eerste = false;
        try {
          const antwoord = await route.fetch();
          assert.equal(antwoord.status(), 200);
          assert.equal((await antwoord.json()).state.foundation.gekoppeld[0].code, eigen.foundation.gekoppeld[0].code);
          vast.add('/api/state'); stateBinnen(); await vrij;
          await route.fulfill({ response: antwoord });
        } catch (e) { stateFout(e); }
      });
      await page.evaluate(() => { window.__appwerktOudeState = window.RTGRealtime.onSync('foundation'); });
      await stateVast;
      page.once('dialog', dialog => dialog.accept());
      const [ontkoppeld] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/rtf/ontkoppel') && r.request().method() === 'POST'),
        los.click()
      ]);
      assert.equal(ontkoppeld.status(), 200);
      await page.waitForFunction(() => document.querySelector('#tabGezin').classList.contains('h-weg') &&
        !document.querySelector('#gezinFamilies [data-los], #rtfReplyBtn'));
      assert.equal((await page.locator('#gezinFamilies').textContent()).includes(gekoppeld.gezinNaam), false,
        'dezelfde pagina bewaart geen oude gezinsbinding na intrekken');
      assert.equal(await page.locator('#gezinInfo').textContent(), '', 'intrekken wist de eerder zichtbare info');
      assert.equal(await page.locator('#gezinChat').textContent(), '', 'intrekken wist chat, leden en gesprek');
      assert.equal(await page.locator('#gezinChat').isVisible(), false);
      const afgerond = [...vast].map(pad => page.waitForEvent('requestfinished', {
        predicate: request => new URL(request.url()).pathname === pad
      }));
      geefVrij();
      await Promise.all(afgerond);
      await page.evaluate(() => window.__appwerktOudeState);
      await page.unrouteAll({ behavior: 'wait' });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#gezinInfo').textContent(), '', 'een laat overzicht zet geen ingetrokken info terug');
      assert.equal(await page.locator('#gezinChat').textContent(), '', 'laat kanaal/thread heropent het gezinsgesprek niet');
      assert.equal(await page.locator('#gezinChat').isVisible(), false);
      assert.equal(await page.locator('#grtMsgs, #grtIn, #grtStuur').count(), 0);
      assert.equal(await page.locator('#tabGezin').evaluate(el => el.classList.contains('h-weg')), true);
      assert.equal(await page.locator('#gezinFamilies [data-los], #rtfReplyBtn').count(), 0,
        'ook een laat volledig state-antwoord kan de ingetrokken binding niet opnieuw geldig maken');
    } finally { geefVrij(); await page.unrouteAll({ behavior: 'wait' }); }
    const na = await stateVan(gekoppeld.token);
    assert.equal(na.user.tier, 'guest');
    assert.equal(Object.hasOwn(na, 'foundation'), false, 'de volledige serverprojectie laat de ingetrokken binding weg');
    for (const pad of ['/api/rtf/kanaal', '/api/rtf/bericht']) {
      const geweigerd = await fetch(base + pad, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + gekoppeld.token
      }, body: JSON.stringify({ code: eigen.foundation.gekoppeld[0].code, tekst: 'Niet meer bevoegd' }) });
      assert.equal(geweigerd.status, 403, pad + ' blijft ook server-side ingetrokken');
      assert.match((await geweigerd.json()).error, /niet.*gekoppeld/i);
    }
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stopHard(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});

test('App-state bindt ontvangst en toepassing aan account en generatie; echte login mag het token wisselen', async () => {
  const vm = require('node:vm'), verzoeken = [];
  const zand = { location: { protocol: 'https:' }, user: {}, invoices: [], trip: null,
    posts: [], creatorLikes: 0, myApps: [], rtf: {}, syncGezinContext() {},
    fetch: (url, opties) => new Promise(resolve => { verzoeken.push({ url, opties, resolve }); }) };
  zand.window = zand;
  const context = vm.createContext(zand);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/shared/appshell.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(__dirname, '../public/apps/app-main/app-main-02_state.js'), 'utf8') +
    '\nthis.eigenaar = maakAppState();', context);
  const { API, applyState, verwerpOudeState, refreshState, aanvaardSessie } = zand.eigenaar;
  const antwoord = data => verzoeken.at(-1).resolve({ ok: true, status: 200, json: async () => data });
  const a = { user: { id: 'A', account: true, tier: 'guest' }, foundation: { gekoppeld: [{ code: 'GEZIN-A' }] } };
  const b = { user: { id: 'B', account: true, tier: 'guest' } };
  const vroeg = API.call('/auth/verify-email', { token: 'emailbewijs' });
  antwoord({ ok: true }); await vroeg;
  assert.equal(Object.hasOwn(zand, 'grtEpoch'), false, 'de vroege API-call heeft geen later geïnitialiseerde gezinsvariabelen nodig');
  const login = API.call('/auth/login', { login: 'A' });
  antwoord({ token: 'token-A', state: a }); const ingelogd = await login;
  aanvaardSessie(ingelogd);
  assert.equal(API.token, 'token-A', 'een echt API-loginantwoord mag zijn nieuwe token aannemen');
  assert.equal(zand.user.id, 'A');

  const oud = API.call('/api/state');
  const oudVerzoek = verzoeken.at(-1);
  const tweedeFactor = API.call('/auth/2fa', { bewijs: 'bewijs-B' });
  antwoord({ token: 'token-B', state: b }); const gewisseld = await tweedeFactor;
  aanvaardSessie(gewisseld);
  assert.equal(API.token, 'token-B', 'ook een doorgegeven tweede-factor/passkey-antwoord blijft gebonden');
  const geweigerd = assert.rejects(oud, /niet meer actueel/);
  oudVerzoek.resolve({ ok: true, status: 200, json: async () => ({ state: a }) }); await geweigerd;
  assert.equal(zand.user.id, 'B'); assert.equal(zand.rtf.gekoppeld.length, 0);
  assert.equal(applyState(a), false, 'een reeds ontvangen antwoord van A kan na tokenwissel niet worden toegepast');
  assert.equal(applyState({ ...b }), false, 'een ongebonden kopie is geen nieuw gezaghebbend antwoord');

  const ontvangen = API.call('/state'); antwoord({ state: b }); const klaar = await ontvangen;
  const onderweg = API.call('/api/state'); const oudGezin = verzoeken.at(-1);
  verwerpOudeState();
  assert.equal(applyState(klaar.state), false, 'intrekken verwerpt ook reeds ontvangen maar nog niet toegepaste state');
  const ingetrokken = assert.rejects(onderweg, /niet meer actueel/);
  oudGezin.resolve({ ok: true, status: 200, json: async () => ({ state: a }) }); await ingetrokken;
  const vers = refreshState(); antwoord({ state: { ...b } });
  assert.equal(await vers, true, 'een vers verzoek na intrekken werkt normaal');
  assert.equal(zand.user.id, 'B'); assert.equal(zand.rtf.gekoppeld.length, 0);
  assert.equal(verzoeken.at(-1).opties.headers.Authorization, 'Bearer token-B');

  // Roep ook de echte login/restore-callers aan: alleen de factory testen zou
  // een oude restore-catch die het nieuwe token wist niet aan het licht brengen.
  const drie = fs.readFileSync(path.join(__dirname, '../public/apps/app-main/app-main-03.js'), 'utf8');
  const vier = fs.readFileSync(path.join(__dirname, '../public/apps/app-main/app-main-04.js'), 'utf8');
  const loginBron = drie.slice(drie.indexOf('  async function login('), drie.indexOf('  // Blijf ingelogd:'));
  const restoreBron = drie.slice(drie.indexOf('  async function restoreSession(){')) +
    vier.slice(0, vier.indexOf('  async function doLogout(){'));
  const opslag = new Map(), verwijderd = [];
  Object.assign(zand, { API, applyState, aanvaardSessie, vastePas: 'lifestyle', wervingscode: '',
    laadPersonalOS: async () => {}, pasAdres: pas => '/apps/app.html?pas=' + pas,
    localStorage: { getItem: key => opslag.get(key), setItem: (key, value) => opslag.set(key, value),
      removeItem: key => { verwijderd.push(key); opslag.delete(key); } } });
  zand.location.replace = adres => { zand.omleiding = adres; };
  vm.runInContext(loginBron + '\n' + restoreBron, context);
  for (const status of [200, 401]) {
    API.token = null; opslag.set('rtg_member_token', 'restore-A-' + status);
    const herstel = zand.restoreSession(), vertraagd = verzoeken.at(-1);
    const huidig = API.call('/auth/login', { login: 'B' });
    antwoord({ token: 'login-B-' + status, state: { ...b } });
    await zand.login('rtg', { response: await huidig });
    assert.equal(API.token, 'login-B-' + status); assert.equal(zand.user.id, 'B');
    assert.equal(zand.omleiding, '/apps/app.html?pas=rtg');
    vertraagd.resolve({ ok: status === 200, status, json: async () => status === 200 ? { state: { ...a } } : { error: 'Oude sessie verlopen' } });
    await herstel;
    assert.equal(API.token, 'login-B-' + status, 'late restore ' + status + ' mag de nieuwe login niet afmelden');
    assert.equal(opslag.get('rtg_member_token'), 'login-B-' + status);
    assert.equal(zand.user.id, 'B'); assert.deepEqual(verwijderd, []);
  }
  const oudLogin = API.call('/auth/login', { login: 'A' });
  antwoord({ token: 'ontvangen-maar-oud', state: { ...a } }); const oudAntwoord = await oudLogin;
  verwerpOudeState();
  await assert.rejects(zand.login('rtg', { response: oudAntwoord }), /niet meer actueel/);
  assert.equal(API.token, 'login-B-401', 'een inmiddels verworpen login zet zijn token niet vóór de statecontrole');
  assert.equal(zand.user.id, 'B'); assert.equal(opslag.get('rtg_member_token'), 'login-B-401');
});

test('GezinRT intrekken wist sessie en callbacks; late tickets, retries en media blijven gesloten', async () => {
  const vm = require('node:vm'), nodes = new Map(), requests = [], tickets = [], media = [], streams = [], timers = new Map();
  let timerId = 0;
  const later = () => { let resolve, reject; const promise = new Promise((ja, nee) => { resolve = ja; reject = nee; }); return { promise, resolve, reject }; };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '', srcObject: null, appendChild() {}, classList: { toggle() {} } });
    return nodes.get(id);
  };
  const antwoord = data => ({ ok: true, json: async () => data });
  const zand = {
    document: { getElementById: node, createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} } },
    fetch: (url, opts) => {
      requests.push({ url, opts });
      if (url.endsWith('/stroom/ticket')) { const d = later(); tickets.push(d); return d.promise; }
      return Promise.resolve(antwoord({ iceServers: [], chats: [], berichten: [], bericht: { tekst: 'nieuw' } }));
    },
    EventSource: class {
      constructor(url) { this.url = url; this.listeners = {}; this.readyState = 1; streams.push(this); }
      addEventListener(naam, fn) { this.listeners[naam] = fn; }
      close() { this.closed = true; this.readyState = 2; }
      emit(naam, data) { this.listeners[naam]?.({ data: JSON.stringify(data) }); }
    },
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
    RTGMedia: { vraag: () => { const d = later(); media.push(d); return d.promise; } },
    alert: () => assert.fail('ingetrokken media mag geen dialoog terugzetten'), console
  };
  zand.window = zand;
  const bron = ['01', '02', '03'].map(n => fs.readFileSync(path.join(__dirname,
    '../public/apps/foundation/gezin-rt/gezin-rt-' + n + '.js'), 'utf8')).join('\n');
  vm.runInNewContext(bron, zand);
  const rt = zand.GezinRT, spoel = () => new Promise(resolve => setImmediate(resolve));
  let oudeChat = 0, nieuweChat = 0;
  const init = (code, token, onChat) => rt.init({ code, token, mijnId: 'oppas', leden: [{ id: 'ouder', naam: code }], onChat });
  init('OUD', 'oud-token', () => oudeChat++);
  rt.stop(); tickets[0].resolve(antwoord({ ticket: 'oud-ticket' })); await spoel();
  assert.equal(streams.length, 0, 'een laat ticket opent geen stroom na stop');
  assert.equal(timers.size, 0);
  const voor = requests.length;
  await assert.rejects(rt.stuur('ouder', 'verboden'), /gesloten/);
  await assert.rejects(rt.thread('ouder'), /gesloten/);
  await assert.rejects(rt.chats(), /gesloten/);
  rt.setToken('oud-token');
  assert.equal(requests.length, voor, 'stop wist token/code; oude bedieningscalls starten geen verzoek');

  init('HERSTEL', 'herstel-token', () => oudeChat++);
  tickets[1].reject(new Error('netwerk')); await spoel();
  assert.equal(timers.size, 1, 'een levende sessie houdt zijn normale herstelroute');
  const oudeRetry = [...timers.values()][0];
  rt.stop(); const gestopt = requests.length; oudeRetry(); await spoel();
  assert.equal(requests.length, gestopt, 'ook een al klaargezette retry is na stop inert');
  assert.equal(timers.size, 0);

  init('NIEUW', 'nieuw-token', () => nieuweChat++);
  tickets[2].resolve(antwoord({ ticket: 'nieuw-ticket' })); await spoel();
  assert.equal(streams.length, 1);
  const kanaal = streams[0];
  kanaal.emit('chat', { van: 'ouder', tekst: 'actueel' }); assert.equal(nieuweChat, 1);
  kanaal.emit('bel', { naar: 'oppas', van: 'ouder', vanNaam: 'Privé naam', kind: 'ring' });
  assert.equal(node('grt-incoming').style.display, 'flex');
  assert.equal(node('grt-inaam').textContent, 'Privé naam');
  rt.bel('ouder', false); assert.equal(media.length, 1);
  rt.stop();
  let gestopteTracks = 0;
  media[0].resolve({ getTracks: () => [{ stop: () => gestopteTracks++ }] }); await spoel();
  assert.equal(gestopteTracks, 1, 'media die pas na stop beschikbaar komt wordt direct gestopt');
  assert.equal(kanaal.closed, true);
  assert.equal(node('grt-incoming').style.display, 'none');
  assert.equal(node('grt-inaam').textContent, '');
  assert.equal(node('grt-call').style.display, 'none');
  assert.equal(node('grt-local').srcObject, null);
  assert.equal(node('grt-remote').srcObject, null);
  assert.equal(timers.size, 0);

  init('VOLGEND', 'volgend-token', () => nieuweChat++);
  tickets[3].resolve(antwoord({ ticket: 'volgend-ticket' })); await spoel();
  kanaal.emit('chat', { van: 'ouder', tekst: 'oud' });
  kanaal.emit('bel', { naar: 'oppas', van: 'ouder', kind: 'ring' }); kanaal.onerror();
  assert.equal(oudeChat, 0); assert.equal(nieuweChat, 1, 'oud kanaal mag ook de nieuwe callback niet aanroepen');
  assert.equal(node('grt-incoming').style.display, 'none'); assert.equal(timers.size, 0);
  streams[1].emit('chat', { van: 'ouder', tekst: 'nieuw' }); assert.equal(nieuweChat, 2);
  await rt.stuur('ouder', 'nieuw');
  const verzonden = JSON.parse(requests.at(-1).opts.body);
  assert.equal(verzonden.code, 'VOLGEND'); assert.equal(verzonden.token, 'volgend-token');
  rt.bel('ouder', false);
  let actieveTracks = 0;
  media[1].resolve({ getTracks: () => [{ stop: () => actieveTracks++ }] }); await spoel();
  assert.equal(node('grt-call').style.display, 'flex', 'nieuwe sessie kan normaal een oproep starten');
  const ticketAantal = tickets.length, levendKanaal = streams[1];
  rt.setToken('ververst-in-gesprek');
  assert.equal(tickets.length, ticketAantal, 'tokenverversing verbreekt het actieve gesprek niet');
  assert.notEqual(levendKanaal.closed, true);
  levendKanaal.emit('chat', { van: 'ouder', tekst: 'na tokenverversing' });
  assert.equal(nieuweChat, 3, 'het eigen levende kanaal blijft chat doorgeven na tokenverversing');
  levendKanaal.emit('bel', { naar: 'oppas', van: 'ouder', kind: 'hangup' });
  assert.equal(actieveTracks, 1, 'ook het echte hangup-signaal blijft het actieve gesprek beëindigen');
  assert.equal(node('grt-call').style.display, 'none');
  rt.bel('ouder', false);
  media[2].resolve({ getTracks: () => [{ stop: () => actieveTracks++ }] }); await spoel();
  assert.equal(JSON.parse(requests.at(-1).opts.body).token, 'ververst-in-gesprek');
  levendKanaal.readyState = 2; levendKanaal.onerror();
  assert.equal(timers.size, 1, 'een echt gesloten kanaal behoudt de herstelroute tijdens een gesprek');
  const herstel = [...timers.entries()][0]; timers.delete(herstel[0]); herstel[1](); await spoel();
  assert.equal(requests.at(-1).opts.headers.Authorization, 'Bearer ververst-in-gesprek',
    'herstel gebruikt het actuele token, niet het token van het oude stroomticket');
  tickets.at(-1).resolve(antwoord({ ticket: 'ververst-ticket' })); await spoel();
  const hersteldKanaal = streams.at(-1);
  levendKanaal.emit('chat', { van: 'ouder', tekst: 'oude stroom' });
  assert.equal(nieuweChat, 3, 'de vervangen stroom mag geen callback meer leveren');
  hersteldKanaal.emit('chat', { van: 'ouder', tekst: 'hersteld' });
  assert.equal(nieuweChat, 4);
  rt.stop();
  assert.equal(actieveTracks, 2, 'ook opnieuw actieve mediatracks stoppen bij intrekken');
  assert.equal(node('grt-local').srcObject, null);
  hersteldKanaal.emit('chat', { van: 'ouder', tekst: 'na stop' });
  hersteldKanaal.emit('bel', { naar: 'oppas', van: 'ouder', kind: 'ring' });
  hersteldKanaal.onerror();
  assert.equal(nieuweChat, 4); assert.equal(node('grt-incoming').style.display, 'none');
  assert.equal(timers.size, 0, 'intrekken sluit ook het met vernieuwd token herstelde kanaal');
  init('LAAT', 'laat-token', () => assert.fail('een gestopte sessie heeft geen callback'));
  rt.stop(); tickets.at(-1).reject(new Error('laat netwerkfalen')); await spoel();
  assert.equal(timers.size, 0, 'een pas na stop afgewezen ticket plant geen nieuwe retry');
});

test('APPWERKT wacht op het echte Zorg-aanbod voordat het de tab bedient',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies, opslagVoor } = require('../scripts/lib/proefsessies');
  const { rijen, meetIngang, maakContext, bezoek, bedien } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-zorg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies, overgeslagen } = await haalSessies(base, ['lid']);
    assert.deepEqual(overgeslagen, []);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await maakContext(browser, opslagVoor({ lid: sessies.lid }));
    const rij = rijen().find((r) => r.functie === 'tab:zorg');
    const meet = meetIngang(rij);
    const gezien = await bezoek(ctx, base, meet);
    assert.deepEqual(gezien.crash, [], 'de zorgstand opent niet');
    assert.equal(gezien.poort, false, 'de zorgstand bleef achter een poort');
    const bediening = await bedien(ctx, base, meet);
    assert.ok(bediening.gevonden >= 1, 'het echte zorgaanbod leverde geen eigen bediening');
    assert.equal(bediening.geklikt, bediening.gevonden,
      'niet alle zorgbediening is aangeraakt (' + bediening.geklikt + '/' + bediening.gevonden + ')');
    assert.deepEqual(bediening.crash.concat(bediening.serverfout), [],
      'de zorgbediening veroorzaakte fouten');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});

test('APPWERKT kwalificeert Navigatie met het echte lokale kaartpakket',
  /* Navigatie heeft meer dan twintig toestandsafhankelijke acties en opent bij
     iedere replay opnieuw het echte SQLite-net. Geef de volledige klikroute
     ruimte; de meter zelf behoudt al zijn begrensde wachttijden. */
  { skip: geenBrowser(pw), timeout: 300000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies, opslagVoor } = require('../scripts/lib/proefsessies');
  const { rijen, meetIngang, maakContext, bezoek, bedien,
    bereidAppwerktDatamapVoor } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-navigatie-'));
  bereidAppwerktDatamapVoor(data);
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies, overgeslagen } = await haalSessies(base, ['lid']);
    assert.deepEqual(overgeslagen, []);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await maakContext(browser, opslagVoor({ lid: sessies.lid }));
    const rij = rijen().find((r) => r.functie === 'link:navigatie');
    const meet = meetIngang(rij);
    const gezien = await bezoek(ctx, base, meet);
    assert.deepEqual(gezien.crash, [], 'Navigatie opent niet met het kaartpakket');
    assert.deepEqual(gezien.config, [], 'Navigatie meldt nog ontbrekende kaartconfiguratie');
    const bediening = await bedien(ctx, base, meet);
    assert.ok(bediening.gevonden >= 1, 'Navigatie heeft geen eigen bediening');
    assert.equal(bediening.geklikt, bediening.gevonden,
      'niet alle navigatiebediening is aangeraakt (' + bediening.geklikt + '/' + bediening.gevonden + ')');
    assert.deepEqual(bediening.config, [], 'bediening raakte ontbrekende kaartconfiguratie');
    assert.deepEqual(bediening.crash.concat(bediening.serverfout), [],
      'Navigatie veroorzaakte fouten');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});
