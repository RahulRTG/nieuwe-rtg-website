/* ============================================================================
   HET APP-CONTRACT -- welke bestaande proef mag een bewijs van een app leveren.

   WAAROM DIT BESTAAT. APPWERKT.json meet per onderdeel uit MAPPEN acht bewijzen
   (BETROUWBAARHEID.md), en vijf daarvan stonden voor alle 102 apps op
   GEEN_FIXTURE. Tegelijk liggen er gesloten ketenproeven (tafel, rit,
   toelating, Adam, moment, zaak-live, lus) die complete stromen van begin tot
   bevestiging lopen -- en APPWERKT las er geen enkele. Dit is de naad: een app
   mag bewijs SAMENSTELLEN uit onafhankelijke proeven die al bestaan, in plaats
   van een tweede fixture te bouwen die hetzelfde nog eens vaststelt.

   WAT HET CONTRACT IS, EN WAT NIET. Het is een VERKLARING en geen uitslag: er
   staat per app welke bron een bewijs mag leveren, nooit dat het bewijs
   geleverd is. De uitslag verdient de bron zelf, op een vers register
   (scripts/lib/bewijsbron.js). Er staat nergens PASS in dit bestand, en
   test/appcontract.test.js zakt als iemand het er toch in zet.

   DE ACHT BEWIJZEN BLIJVEN CANONIEK. Een contract mag alleen een van de acht
   namen uit BETROUWBAARHEID.md dragen. Er komt geen negende ("storingsvast"
   valt onder herstelbaar) -- acht stabiele begrippen zijn meer waard dan een
   steeds fijner kwaliteitsmodel.

   EEN KETEN LEVERT PRECIES EEN BEWIJS, EN DAT IS MET OPZET. Een ketenproef
   bewijst `voltooibaar`: de hele stroom kan worden afgemaakt, tot en met wat de
   ANDERE partij daarvan ziet. Hij bewijst niet:
     herstelbaar      -- zijn storingen zijn dubbele tikken, verkeerde rollen en
                         verboden standen; herstelbaar gaat over uitval van
                         Redis/PostgreSQL, een providertimeout en een verzoek dat
                         midden in een mutatie afbreekt. Dat is een ander
                         experiment (verraad.js, crashproef), en een groen vinkje
                         op het verkeerde experiment is BEWIJSMACHINE.md par. 6a.
     persistent       -- er is geen herstart op dezelfde data.
     waarheidsgetrouw -- hij leest API-antwoorden, niet wat het SCHERM zegt.
     bevoegd          -- een handvol verkeerde-rol-storingen is geen kruisproef
                         over de hele app.
   Wie een keten voor een van die vier laat tellen, verzint bewijs.

   DE KOPPELING WORDT GEMETEN, NIET GELOOFD. Elke regel hieronder moet een
   gedeelde route hebben met de ingang van de app (SCHERMROUTES.json, via de
   scripts die de ingang laadt). Anders beweert het contract iets over een
   scherm dat de proef nooit heeft aangeraakt. Die overlap is NODIG en niet
   VOLDOENDE -- vandaar de `belofte` in woorden: een mens zegt dat de keten de
   KERNbelofte van de app dekt, en niet een deelbelofte ervan.

   DE KETENS ZONDER APP staan er even groot bij (`ZONDER_APP`). Van de zeven
   gesloten ketens landt er vandaag EEN op de kernbelofte van een app in MAPPEN.
   Weglaten zou lezen als "nog niet gedaan"; ze staan er met de reden, zodat
   zichtbaar is waarom en wat er zou moeten gebeuren om ze wel te laten tellen.
   ========================================================================== */
'use strict';

/* De acht, in de volgorde van BETROUWBAARHEID.md. Gelijk aan de sleutels die
   scripts/appwerkt.js per rij schrijft; de toets houdt die twee gelijk. */
const BEWIJZEN = ['bereikbaar', 'bedienbaar', 'voltooibaar', 'waarheidsgetrouw',
  'persistent', 'bevoegd', 'herstelbaar', 'menselijk'];

/* Welke soort bron welk bewijs mag leveren. Gesloten: een ketenproef levert
   voltooibaar en verder niets (zie de kop). Een nieuwe bronsoort (wereldproef,
   authority, verraad) komt hier met zijn eigen bewijs bij, en niet door een
   bestaande soort op te rekken. */
const BRONSOORTEN = {
  ketenproef: ['voltooibaar'],
  /* De liegronde levert waarheidsgetrouw en verder niets: zijn JS-fouten en
     rommel op een leeg antwoord zeggen iets over robuustheid, niet over bewijs 8
     (menselijk), want een echte backend antwoordt nooit zo. */
  liegronde: ['waarheidsgetrouw'],
  /* De bevoegdronde levert bevoegd en verder niets: IDOR en ROLPROEF zeggen
     wie er NIET bij kan, niet of het scherm iets bewaart of herstelt. */
  bevoegdronde: ['bevoegd'],
  /* De voltooiproef (scripts/voltooiproef.js, BETROUWBAARHEID.md par. 4h) levert
     drie bewijzen, en precies de drie die een ketenproef NIET mag: hij loopt de
     bedoeling af (voltooibaar), herstart netjes op dezelfde datamap en leest de
     uitkomst daarna in een nieuwe sessie EN in de opslag buiten de server om
     (persistent), en laat het proces sterven direct na een bevestiging, herhaalt
     en breekt verzoeken af (herstelbaar). Hij leest geen scherm en kruist geen
     vreemde rol, dus waarheidsgetrouw en bevoegd levert hij niet.
     MENSELIJK (18 oktober 2026) levert hij als vierde, en alleen de helft die
     scripts/appwerkt.js niet kon: dat scherm ziet of een kale fout de
     gebruiker bereikt bij de bediening, en zei zelf dat de bruikbaarheid van
     een melding "de storingen uit bewijs 7" vraagt. De voltooiproef leidt het
     af uit alle antwoorden onder die storingen (geen kale 5xx, geen leeg
     antwoord, elke weigering met een melding in woorden); een scenario kan het
     niet zelf schrijven, en zonder uitgelokte weigering is het niet beproefd.
     Een kale fout die APPWERKT zelf op het scherm zag, blijft staan: de
     bewijsbron vervangt een GEBLOKKEERD_DOOR_DEFECT van het scherm nooit. */
  voltooiproef: ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk']
};

/* Een onderdeel met een scenario in scripts/lib/voltooi/ krijgt zijn drie
   bewijzen uit VOLTOOIPROEF.json. Het instrument is het SCENARIObestand en niet
   scripts/voltooiproef.js: daarop meet de bewijsbron de koppeling, en het
   gedeelde instrument noemt de routes van geen enkel scherm. */
function voltooi(scenario, waarom) {
  const bron = { soort: 'voltooiproef', register: 'VOLTOOIPROEF.json', instrument: 'scripts/lib/voltooi/' + scenario + '.js', waarom };
  return { voltooibaar: bron, persistent: bron, herstelbaar: bron, menselijk: bron };
}

/* Sleutel: de functie-id uit MAPPEN (zoals APPWERKT.json hem als `functie`
   schrijft), zodat een hernoemde app het contract niet stil laat vallen. */
const CONTRACT = {
  'link:sessies': Object.assign({
    belofte: 'een lid ziet waar het is ingelogd en sluit een ander toestel op afstand -- en dat toestel blijft buiten, ook na een herstart of een crash'
  }, voltooi('sessies', 'het scenario loopt /api/mijn/sessies, /sluit en de toestelbinding, de routes die /apps/mijn-sessies.html zelf aanroept, met een echte sleutel voor het bezitsbewijs')),
  'link:post': Object.assign({
    belofte: 'een lid geeft en trekt zelf toestemming in voor commerciele post, alles staat uit tot hij het aanzet, en de geschiedenis bewijst wanneer en waar'
  }, voltooi('post', 'het scenario loopt /api/mijn/post, /zet, /alles-uit en /geschiedenis, de routes die /apps/mijn-post.html zelf aanroept')),
  /* Instellingen: wie ik ben, wat RTG van mij denkt te weten, wie bij mij mag,
     en mijn identiteit (18 oktober 2026). */
  'link:verificatie': Object.assign({
    belofte: 'een lid stuurt zijn identiteitsbewijs en een selfie in, een medewerker op naam beslist, het lid ziet de uitkomst en krijgt bericht, en een afwijzing wist het bewijs'
  }, voltooi('verificatie', 'het scenario loopt /api/verify/upload, /selfie en /status, de routes die /apps/verificatie.html zelf aanroept, met het besluit langs /api/office/verify')),
  'link:neigingen': Object.assign({
    belofte: 'een lid vertelt RTG wat hij graag doet, ziet op een geheugenkaart wat RTG van hem denkt te weten, en haalt het weg of verbiedt het gebruik'
  }, voltooi('neigingen', 'het scenario loopt /api/neiging/intake, /antwoord, /geheugen, /vergeet, /niet-voor, /overslaan en /opnieuw, de routes die /apps/mijn-neigingen.html zelf aanroept')),
  'link:relaties': Object.assign({
    belofte: 'een lid ziet per partij wie wat van hem mag, bekijkt vooraf wat sluiten doet, en zet het bij de bron stop -- en de andere partij merkt het'
  }, voltooi('relaties', 'het scenario loopt /api/toestemming, /relaties, /relatie/gevolgen, /relatie/sluit en /intrek, de routes die /apps/mijn-relaties.html zelf aanroept, met een tweede lid dat de machtiging ontvangt')),
  'link:ik': Object.assign({
    belofte: 'een lid zegt hoe hij genoemd wil worden, welke toon Rahul aanslaat en hoe elk scherm zich gedraagt, binnen de grens van zijn leeftijd'
  }, voltooi('ik', 'het scenario loopt /api/ik, /api/ik/zet en /api/ik/toegankelijk/zet, de routes die /apps/ik.html zelf aanroept')),
  /* Geld van buiten het huis, over de simulatiebank (18 oktober 2026). */
  'link:pay': Object.assign({
    belofte: 'een geverifieerd lid laadt zijn wallet op en ziet het nieuwe saldo; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde en wordt er niets bijgeschreven -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash'
  }, voltooi('pay', 'het scenario loopt /api/pay/oplaad en /api/pay/overzicht, de routes die /apps/pay.html zelf aanroept, met een goedgekeurde identiteit, een gebonden toestel en de simulatiebank als rail')),
  /* LivingOS met een tweede actor: de kring, de zaak (18 oktober 2026). */
  'link:veilig': Object.assign({
    belofte: 'als het misgaat krijgen de mensen die het lid zelf koos bericht, met alleen wat hij per persoon toestond, en een lege kring wordt eerlijk geweigerd'
  }, voltooi('veilig', 'het scenario loopt /api/veiligheid, /kring/toevoegen, /aanpassen, /verwijderen, /mail, /plek, /alarm en /alarm/afsluiten, de routes die /apps/veilig.html zelf aanroept, met een tweede lid dat het alarm ontvangt')),
  'link:reizen': Object.assign({
    belofte: 'een lid deelt een Moment rond een reis met wie hij kiest, op het niveau dat hij kiest, de ontvanger ziet de voortgang, en na een pauze of stop niets meer'
  }, voltooi('reizen', 'het scenario loopt /api/veiligheid/moment, /maak, /status, /pauze en /stop, de routes die /apps/reizen-veilig.html zelf aanroept, met de codenaam die het formulier vraagt en een tweede lid als ontvanger')),
  'link:foodcourt': Object.assign({
    belofte: 'een lid ziet de restaurants en hun vrije tijden, vraagt een tafel aan, en de zaak beslist -- het lid ziet de bevestiging'
  }, voltooi('foodcourt', 'het scenario loopt /api/foodcourt, /api/foodcourt/tijden, /api/reserveer en /api/reserveringen/mijn, de routes die /apps/foodcourt.html zelf aanroept, met de zaak die bevestigt')),
  'link:uitgaan': Object.assign({
    belofte: 'een lid zet zich met zijn gezelschap op de gastenlijst van een avond, de zaak ziet hem op codenaam, en afmelden geeft de plek vrij'
  }, voltooi('uitgaan', 'het scenario loopt /api/uitgaan, /api/uitgaan/mijn, /api/event/rsvp en /api/event/rsvp/annuleer, de routes die /apps/uitgaan.html zelf aanroept, met de zaak die de gastenlijst leest')),
  'link:commerce': Object.assign({
    belofte: 'een lid legt koopbare dingen in een mand, ziet per verkoper een afrekening met btw en wat bevestigen blokkeert, en geeft zijn keuze als briefje door aan de deur die wel bevestigt'
  }, voltooi('commerce', 'het scenario loopt /api/commerce/aanbod, /mand, /mand/zet, /mand/leeg en /overdracht/maak, de routes die /apps/commerce.html zelf aanroept, met een ander lid dat het briefje niet mag lezen')),
  /* De tweede ronde van 18 oktober 2026: werelden met een tweede lid (Pulse,
     RTMail, de wereldlaag), het eigen dossier (gegevens, bescherming,
     loopbaan) en de Mall, School en Kwesties. */
  'link:mall': Object.assign({
    belofte: 'een lid vindt aanbod in de Mall, zet het in een eigen lijst, bewaart het met een hartje in een vaste lijst, en zet een app uit de bibliotheek in zijn kast'
  }, voltooi('mall', 'het scenario loopt /api/mall/zoek, de lijstroutes, /bewaar en /bewaard en /api/mall/apps/*, de routes die /apps/mall.html zelf aanroept')),
  'link:pulse': Object.assign({
    belofte: 'een lid schrijft een kort bericht, een ander lid vindt het, waardeert het, reageert en bewaart het; wie het schreef haalt het weg en dan is het voor iedereen weg'
  }, voltooi('pulse', 'het scenario loopt /api/member/pulse/* en /api/member/wauw/stemming, de routes die /apps/pulse.html zelf aanroept, met een tweede lid')),
  'link:rtmail': Object.assign({
    belofte: 'een lid verstuurt binnen RTG een bericht naar een ander lid, dat het ongelezen in zijn postvak op codenaam ziet en leest; andermans post is niet te lezen'
  }, voltooi('rtmail', 'het scenario loopt /api/member/rtmail/adres, /inbox, /lees en de conceptroutes, de routes die /apps/rtmail.html zelf aanroept, met een tweede lid')),
  'link:gegevens': Object.assign({
    belofte: 'een lid ziet wat RTG van hem heeft, neemt het mee onder zijn codenaam, ziet wie in zijn dossier was, en wijzigt zijn wachtwoord zo dat het oude nergens meer opent'
  }, voltooi('gegevens', 'het scenario loopt /api/mijn/gegevens, /api/privacy/export, /inzage en /api/auth/password, de routes die /apps/mijn-gegevens.html zelf aanroept')),
  'link:loopbaan': Object.assign({
    belofte: 'een lid schrijft feiten in een ledger dat niets wist, trekt er een terug met reden, en deelt een feit met een code die hij weer stopzet'
  }, voltooi('loopbaan', 'het scenario loopt /api/carriere/ledger/* en /api/carriere/regel/toon, de routes die /apps/loopbaan.html zelf aanroept, met een vreemde zonder sessie')),
  'link:bescherming': Object.assign({
    belofte: 'een lid zet zijn eigen beveiliging zonder drempel strenger en krijgt hem alleen via een ceremonie met reden en stappen weer omlaag'
  }, voltooi('bescherming', 'het scenario loopt /api/isolatie/mijn, /zet en de ontsluitceremonie, de routes die /apps/mijn-isolatie.html zelf aanroept')),
  'link:school': Object.assign({
    belofte: 'een lid oefent een examen zoals bij een echt examen en krijgt aan het eind een terugblik en een oefenindicatie die geen echt cijfer is'
  }, voltooi('school', 'het scenario loopt /api/leerstof/examen, /examen-antwoord en /api/onderwijs/advies, de routes die /apps/rtgschool.html zelf aanroept')),
  'link:kwesties': Object.assign({
    belofte: 'een mens brengt in wat er speelt, ziet de kwestie op zijn naam, opent de uitkomst en trekt hem in -- een ander kan er niets mee'
  }, voltooi('kwesties', 'het scenario loopt /api/member/democratie/kwestie/*, de routes die /apps/foundation/kwesties.html zelf aanroept, als lid en met een tweede lid')),
  'link:wereldlaag': Object.assign({
    belofte: 'een lid plaatst een post in De Salon, een verbonden lid reageert, de maker ziet het en haalt de post weg -- en dan is hij voor iedereen weg'
  }, voltooi('wereldlaag', 'het scenario loopt /api/salon/plaats, /feed, /reacties, /reageer en /weg, waarvan /apps/wereld.html er drie zelf aanroept')),
  'link:vandaag': Object.assign({
    belofte: 'een lid houdt zijn dag bij: een gewoonte afvinken en weer uitzetten, een meting met herkomst, een dagcheck-in, en een noodkaart die alleen hij zelf toont'
  }, voltooi('vandaag', 'het scenario loopt /api/life, /api/gewoonten (maak, tik, reeks, stop), /api/metingen (zet, weg), /api/gemoed (zet, weg) en /api/noodkaart (zet, weg), de routes die /apps/life.html zelf aanroept')),
  'link:wonen': Object.assign({
    belofte: 'een lid meldt wat er thuis stuk is zonder dat RTG een vakman veinst, en houdt zijn woningdocumenten bij in een eigen dossier in de kluis'
  }, voltooi('wonen', 'het scenario loopt /api/home/onderhoud, /meld, /annuleer, /api/bestanden/map, /upload en /mijn, de routes die /apps/wonen.html zelf aanroept')),
  'link:mijnmall': Object.assign({
    belofte: 'een lid vraagt wat niemand aanbiedt, alleen zaken met het juiste vak zien het, het lid kiest een reactie en vindt het antwoord terug -- zonder boeking of betaling'
  }, voltooi('mijnmall', 'het scenario loopt /api/mall/aanvraag, /aanvragen/mijn, /aanvraag/kies en /wijzig, de routes die /apps/mijnmall.html zelf aanroept, met twee zaken aan de andere kant')),
  /* De apps van de Lifestyle Pass (18 oktober 2026). Elk scenario loopt met een
     lid dat zijn pas kreeg langs het menselijke besluit van het kantoor; het
     scenario van Reisboek loopt dat besluit zelf als schakels. */
  'link:reisboek': Object.assign({
    belofte: 'een Lifestyle-lid -- na het menselijke besluit van het kantoor -- legt een reis vast met vluchten, verblijven, documenten en programma en ziet op tijd welk document verloopt'
  }, voltooi('reisboek', 'het scenario loopt /api/member/rechterhand/reisboek, /reis/zet, /reis/item en /weg, de routes die /apps/reisboek.html zelf aanroept, met een lid dat zijn pas via /api/aanmelding/beslis kreeg')),
  'link:cellier': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn wijnkelder bij: aantal, waarde en drinkvenster per fles, wat op dronk is, en inschenken telt af'
  }, voltooi('cellier', 'het scenario loopt /api/member/rechterhand/cellier, /zet, /schenk en /weg, onder het voorvoegsel dat /apps/cellier.html aanroept')),
  'link:table': Object.assign({
    belofte: 'een Lifestyle-lid organiseert een prive-diner: gelegenheid, gastenlijst met dieet en tafelindeling, en het menu per gang'
  }, voltooi('table', 'het scenario loopt /api/member/rechterhand/table en zijn gast- en menuroutes, onder het voorvoegsel dat /apps/table.html aanroept')),
  'link:maison': Object.assign({
    belofte: 'een Lifestyle-lid bestuurt zijn huishouden: staf, taken voor wie en wanneer, af te vinken, en een logboek'
  }, voltooi('maison', 'het scenario loopt /api/member/rechterhand/maison en zijn staf-, taak- en logroutes, onder het voorvoegsel dat /apps/maison.html aanroept')),
  'link:garderobe': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn garderobe bij: per stuk wat het is en waar het hangt, per categorie geteld, met zijn vaklui'
  }, voltooi('garderobe', 'het scenario loopt /api/member/rechterhand/garderobe, /stuk en /vakman, onder het voorvoegsel dat /apps/garderobe.html aanroept')),
  'link:mecenaat': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn filantropie bij: doel, bedrag, toegezegd of betaald, en het deel via de RTFoundation'
  }, voltooi('mecenaat', 'het scenario loopt /api/member/rechterhand/mecenaat, /gift, /betaald en /gift/weg, de routes die /apps/geld.html zelf aanroept')),
  'link:nalatenschap': Object.assign({
    belofte: 'een Lifestyle-lid legt zijn nalatenschap vast -- documenten, vertrouwenspersonen, wensen -- met de gevoelige velden versleuteld op schijf'
  }, voltooi('nalatenschap', 'het scenario loopt /api/member/rechterhand/nalatenschap en zijn doc-, contact- en wensroutes, de routes die /apps/geld.html zelf aanroept')),
  'link:logboek': Object.assign({
    belofte: 'een Lifestyle-lid houdt het onderhoud van kostbaar bezit bij, en het overzicht seint wat binnenkort weer moet'
  }, voltooi('logboek', 'het scenario loopt /api/member/rechterhand/logboek, /object en /regel, de routes die /apps/geld.html zelf aanroept')),
  'link:cercle': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn clubs bij, vraagt waar hij in een stad terecht kan, en zijn gastpassen lopen met een boekhouding terug'
  }, voltooi('cercle', 'het scenario loopt /api/member/rechterhand/cercle, /club, /gast, /gast/terug en /waarheen, onder het voorvoegsel dat /apps/cercle.html aanroept')),
  'link:hangar': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn toestellen en vluchten bij: laatst bekende positie, eerstvolgende vlucht en vlieguren'
  }, voltooi('hangar', 'het scenario loopt /api/member/rechterhand/hangar, /toestel en /vlucht, onder het voorvoegsel dat /apps/hangar.html aanroept')),
  'link:entourage': Object.assign({
    belofte: 'een Lifestyle-lid houdt zijn reisgezelschap bij: documenten met vervaldatum, en bij het samenstellen ziet hij wat ontbreekt'
  }, voltooi('entourage', 'het scenario loopt /api/member/rechterhand/entourage, /persoon, /doc en /gezelschap, onder het voorvoegsel dat /apps/entourage.html aanroept')),
  'link:attenties': Object.assign({
    belofte: 'een Lifestyle-lid onderhoudt zijn relaties: wie binnen dertig dagen een attentie verdient, met de giftgeschiedenis'
  }, voltooi('attenties', 'het scenario loopt /api/member/rechterhand/attenties, /relatie en /gift, onder het voorvoegsel dat /apps/attenties.html aanroept')),
  'link:werkos': Object.assign({
    belofte: 'een toegelaten medewerker opent zijn eigen WorkOS-werkruimte, maakt werk aan en vindt dat na een herstart, netwerkherhaling en crash precies een keer terug'
  }, voltooi('werkos', 'het scenario loopt /api/bedrijf/start, /taak/maak en /taken, dezelfde routes die /apps/werk.html via zijn gedeelde modules aanroept; de beheerder laat de medewerker langs de bestaande werkruimtedeur toe')),
  /* WorkOS, de kantoorkant van RTG One (19 oktober 2026): een medewerker op naam,
     met de kantoorrol via een uitnodiging van de eigenaar. */
  'link:rtgone': Object.assign({
    belofte: 'een medewerker op naam legt beloften, bedoelingen en frictie vast in het werkgeheugen en rondt een belofte omkeerbaar af, en dat staat er na een herstart en een crash precies een keer'
  }, voltooi('rtgone', 'het scenario loopt /api/account/start, /api/rtgone/state, /belofte, /intentie, /frictie, /overdracht en /automatisering/*, de routes die /apps/rtgone.html zelf aanroept, met een lid zonder kantoorrol dat er niet bij komt')),
  'link:decisionroom': Object.assign({
    belofte: 'een medewerker legt een voorstel neer en mensen met de juiste rol beslissen het, nooit de aanvrager zelf en boven de drempel met twee stemmen'
  }, voltooi('decisionroom', 'het scenario loopt /api/account/start, /api/rtgone/state, /goedkeuring en /goedkeuring/beslis, de routes die /apps/decision-room.html zelf aanroept, met drie mensen: aanvrager, beoordelaar met rol en de eigenaar')),
  'link:projectroom': Object.assign({
    belofte: 'een medewerker voert een project dat uit een RTMAIL ontstond aantoonbaar uit, met taken, bewijs en een menselijke oplevering, en een collega wijzigt er niets aan'
  }, voltooi('projectroom', 'het scenario loopt /api/account/start, /api/rtgone/state, /project/taak, /project/bewijs en /project/oplever, de routes die /apps/project-room.html zelf aanroept, met een collega en een lid die er niet bij komen')),
  /* Tot 19 oktober 2026 droeg de tafelproef (scripts/tafelproef.js) hier
     voltooibaar. De voltooiproef loopt nu dezelfde stroom van openen tot
     afrekenen en meet daarnaast de herstart, de crash en de offline sync; een
     scenario levert alle vier of geen (test/voltooiproef.test.js). De
     tafelproef blijft zijn eigen register, voor de overdracht naar de gast. */
  'link:horeca': Object.assign({
    belofte: 'een zaak bedient een tafel van rekening openen tot afrekenen, en een offline opgenomen bestelling komt precies een keer binnen'
  }, voltooi('horeca', 'het scenario loopt /api/supplier/horeca/rekening/*, /keuken/*, /betaal en /offline/sync onder het voorvoegsel dat /apps/horeca.html via RTGHoreca.api aanroept, met een tweede zaak die de rekening niet ziet')),
  /* De lusproef stond tot 24 september 2026 in ZONDER_APP: hij schreef geen
     register, en Ontdekken leek /apps/rtg.html te zijn. Beide klopten niet meer:
     link:connect is /apps/connect.html, dat acht /api/connect-routes met de proef
     deelt, en de proef schrijft nu LUSPROEF.json met het huisstempel. De proef
     loopt als LID over /api/connect, de deur die connect.html zelf aanroept; de
     gezinsdeur /api/rtf/connect is dezelfde motor maar wordt niet gelopen, en dat
     staat in `waarom` in plaats van weggelaten. */
  'link:connect': {
    belofte: 'je ontdekt iets, begrijpt het, doet er iets mee, en een ander bevestigt dat het hem hielp -- zonder score, rangorde of niveau',
    voltooibaar: {
      soort: 'ketenproef',
      register: 'LUSPROEF.json',
      instrument: 'scripts/lusproef.js',
      waarom: 'de lusproef loopt de ontdeklus van CONNECT.md over /api/connect/*, de routes die /apps/connect.html zelf aanroept, met twee leden; de gezinsdeur /api/rtf/connect (dezelfde motor) loopt hij niet'
    }
  },
  /* Het Privékantoor (11 oktober 2026). De concierge-lus had tot die dag geen
     scherm; nu staat de lid-kant in het tabblad Zaken van /apps/lifestyle.html
     (apps/lifestyle-lus.js), en die roept /api/member/bureau/lus/* aan -- precies
     de lid-routes die de conciergeproef loopt. De proef dekt de lus en niet het
     hele Privékantoor (woning, kring, bezit, mandaat lopen hier niet mee); dat
     staat in `waarom` in plaats van weggelaten. */
  'link:rechterhand': {
    belofte: 'een lid vertelt een wens in een zin, De Rechterhand regelt hem, en het lid beslist alleen over een concreet voorstel buiten zijn mandaat',
    voltooibaar: {
      soort: 'ketenproef',
      register: 'CONCIERGEPROEF.json',
      instrument: 'scripts/conciergeproef.js',
      waarom: 'de conciergeproef loopt de lus van CONCIERGE.md over /api/member/bureau/lus/*, de routes die het tabblad Zaken van /apps/lifestyle.html aanroept, met het kantoor en twee zaken ernaast; de andere tabbladen van het Privékantoor loopt hij niet'
    }
  }
};

/* Gesloten ketens die (nog) geen bewijs voor een app in MAPPEN leveren, met de
   reden. `nodig` zegt wat er moet veranderen voordat ze wel tellen -- en dat is
   nooit "het contract ruimer lezen". */
const ZONDER_APP = [
  { register: 'RITPROEF.json', instrument: 'scripts/ritproef.js',
    reden: 'geen enkel scherm in SCHERMROUTES.json roept /api/ride/request aan; de rit wordt vanuit de ledenapp gestart (standen reizen/terplaatse), die geen eigen adres heeft',
    nodig: 'de ledenapp-standen meetbaar maken (appwerkt kan ze vandaag alleen als niet getest melden)' },
  { register: 'ADAMPROEF.json', instrument: 'scripts/adamproef.js',
    reden: 'de stroom loopt over /api/rtf/solliciteer en /api/concern/*; geen ingang in MAPPEN roept die aan (werk.html van de Foundation en concern.html staan er niet in)',
    nodig: 'een besluit welke app in FoundationOS "werk vinden" belooft, en die ingang in MAPPEN' },
  { register: 'MOMENTPROEF.json', instrument: 'scripts/momentproef.js',
    reden: 'raakt RTG Media (/api/mediaos/aanwezig/*), maar alleen de deelbelofte volgen en gewekt worden -- niet wat RTG Media als geheel belooft',
    nodig: 'een tweede bron voor de kernbelofte van RTG Media, of een splitsing van die app in MAPPEN' },
  { register: 'TOELATINGSPROEF.json', instrument: 'scripts/toelatingsproef.js',
    reden: 'de klant is geen lid en de keten loopt over kantoor en aanmeldbalie; MAPPEN kent alleen lid- en gezinswerelden',
    nodig: 'niets aan de keten -- dit bewijs hoort bij een zaak- of kantoorregister, niet bij APPWERKT' },
  { register: 'ZAAKLIVEPROEF.json', instrument: 'scripts/zaakliveproef.js',
    reden: 'de zaakkant (poort, rondleidingen, live gaan); geen ingang in MAPPEN',
    nodig: 'idem: een zaakregister naast APPWERKT' }
];

/* DE WERELD DIE EEN APP NODIG HEEFT (Ronde B, 24 september 2026). Een app
   verklaart alleen WELKE wereld; hoe die ontstaat en wat hij daarvoor nodig heeft
   staat in ./wereldcompositor.js. Net als bij een bewijsbron is de verklaring
   GEMETEN: de wereldbouwer moet routes raken die de ingang van de app aanroept
   (test/wereldcompositor.test.js). Alleen koppelingen met meerdere gedeelde
   routes staan hier; de wortels-wereld raakt twintig apps met elk EEN route, en
   een wereld op een enkele gedeelde route declareren is raden.

   Een wereld die niet opkomt blijft gewoon gedeclareerd: een declaratie
   verbergt niets. De spelwereld kwam eerst niet op -- hij vraagt een
   `member-account`-sessie die geen munter maakte. Die munter staat sinds
   ronde C in ./proefsleutels.js, en daarmee komt ook Spelen op. */
const WERELD = {
  'link:horeca': { werelden: ['horeca'], waarom: 'een open rekening op een tafel: de wortel van /api/supplier/horeca/*' },
  'link:spelen': { werelden: ['spel'], waarom: 'een potje dat loopt: de wortel van /api/member/spel/*' }
};

/* BRONNEN DIE VOOR ELKE APP GELDEN. Een contract noemt per app een bron; een
   ronde als de liegronde meet ELKE rij met dezelfde procedure, en heeft dus geen
   koppeling per app nodig maar een uitslag per rij. Het register is de
   koppeling: staat de rij er niet in, of is hij vervallen, dan blijft het bewijs
   NIET_GETEST. Een contract per app gaat voor. */
const ALGEMEEN = {
  waarheidsgetrouw: {
    soort: 'liegronde',
    register: 'LIEGRONDE.json',
    instrument: 'scripts/liegronde.js',
    waarom: 'dezelfde liegpoort als test/liegend-scherm.e2e.js, per rij met de persona van die rij; alleen een verzonnen zekerheid is een defect'
  },
  bevoegd: {
    soort: 'bevoegdronde',
    register: 'BEVOEGD.json',
    instrument: 'scripts/bevoegdronde.js',
    waarom: 'ledenschermen bakenen af op de sessie (BETROUWBAARHEID.md par. 4f), dus hun routes uit IDOR.json en ROLPROEF.json; gezinsschermen noemen hun code, dus een kruisproef met het token van een ander gezin'
  }
};

/* WAAR DE TESTWERELD ZELF NOG TEKORTSCHIET (BETROUWBAARHEID.md par. 4, de
   tabel). Voor de meeste onderdelen ontbreekt alleen een scenario; voor deze
   ontbreekt een ADAPTER, en dan helpt een scenario niet. Alleen wat de tabel
   als ontbrekend noemt staat hier -- geen gok per app. */
const TESTWERELD_ONTBREEKT = {
  'os:bellen': 'bellen vraagt test-identiteiten voor WebRTC in een headless browser, en dat vraagt een besluit (BETROUWBAARHEID.md par. 4)',
  'os:videobellen': 'videobellen vraagt test-identiteiten voor WebRTC in een headless browser, en dat vraagt een besluit (BETROUWBAARHEID.md par. 4)'
};

module.exports = { BEWIJZEN, BRONSOORTEN, CONTRACT, ZONDER_APP, WERELD, ALGEMEEN, TESTWERELD_ONTBREEKT };
