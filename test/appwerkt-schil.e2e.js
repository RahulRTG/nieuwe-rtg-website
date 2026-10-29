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
