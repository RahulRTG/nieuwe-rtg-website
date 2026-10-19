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
  /* De standen van RTG Geld, familie Geld (19 oktober 2026). */
  'link:wallet': Object.assign({
    belofte: 'een lid legt zijn kaarten in de wallet, koopt feestmunten die echt betaald worden en wisselt ze in, nooit onder nul -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash laat hem nooit twee keer betalen'
  }, voltooi('wallet', 'het scenario loopt /api/wallet, /voeg, /weg, /munt/koop en /munt/wissel, de routes die /apps/geld.html#wallet (apps/geld/walletb.js) zelf aanroept, met een goedgekeurde identiteit, een gebonden toestel en de simulatiebank onder het bijladen')),
  'link:bank': Object.assign({
    belofte: 'zodra het kantoor de leden-bank live zet, geeft een lid akkoord, krijgt een rekening, stort geld van buiten, boekt over tussen eigen rekeningen en leest het afschrift; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde -- een ander lid kan er niet bij, en een dubbele tik, een afgebroken verzoek of een crash boekt nooit dubbel'
  }, voltooi('bank', 'het scenario loopt /api/bank/overzicht, /akkoord, /rekening/open, /storten, /overboek en /afschrift, de routes die /apps/geld.html#bank (apps/geld/bankb.js en bankc.js) zelf aanroept, met de leden-bank live gezet langs /api/office/bank/leden, een gebonden toestel en de simulatiebank als rail')),
  'link:wbw': Object.assign({
    belofte: 'twee Salon-vrienden houden een gedeeld lijstje bij: wie betaalde wat en wie staat er hoe voor, tot op de cent; wie rood staat verrekent in een tik via RTG Pay -- wie buiten het lijstje staat leest of raakt niets, en een dubbele tik, een afgebroken verzoek of een crash betaalt nooit twee keer'
  }, voltooi('wbw', 'het scenario loopt /api/wbw/mijn, /maak, /groep, /uitgave en /verreken, de routes die /apps/geld.html#wbw (apps/geld/wbwb.js) zelf aanroept, met twee leden die langs de Salon verbonden zijn, een derde erbuiten en de simulatiebank onder het bijladen')),
  'link:labfonds': Object.assign({
    belofte: 'leden zeggen samen geld toe aan de pot van een plek, dienen een voorstel in en beslissen gezamenlijk met de scheidsrechter; alleen de indiener sluit de stemming, en een dubbele tik, een afgebroken verzoek of een crash legt een toezegging nooit twee keer in de pot'
  }, voltooi('labfonds', 'het scenario loopt /api/labfonds/overzicht, /doneer, /voorstel/maak, /stem en /beslis, de routes die /apps/geld.html#labfonds (apps/geld/labfondsb.js) zelf aanroept, met een tweede lid dat stemt en de stemming niet mag sluiten')),
  'link:rtgcode': Object.assign({
    belofte: 'een lid toont een levende, ondertekende code die alleen de RTG-app maakt en leest en die na een halve minuut vervalt; een valse, gewone of verlopen code wordt geweigerd, een ander lid leest er niets van het lid uit, en de code overleeft een herstart en een crash -- en hij is persoonlijk, zoals het scherm belooft'
  }, voltooi('rtgcode', 'het scenario loopt /api/code/dyn en /api/code/scan, de routes die /apps/geld.html#rtgcode (apps/geld/rtgcode.js en rtgcodeb.js) zelf aanroept, met een tweede lid dat de code scant')),
  'link:geldcommand': Object.assign({
    belofte: 'een lid ziet hoe het er financieel voor staat, zet potten en regels binnen de harde grens van GELD.md en leest elke handeling terug in het actielog -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash zet een bedrag nooit twee keer opzij'
  }, voltooi('geldcommand', 'het scenario loopt /api/geld/cockpit, /beleid, /beleid/zet, /api/geld/pot/zet, /reserveer, /weg en /api/geld/actielog, de routes die de eerste stand van /apps/geld.html (apps/geld/overzichtb.js en overzichtc.js) zelf aanroept, met een tweede lid dat er niet bij mag')),
  /* Het geldscherm laadt de delen van alle standen (Balans telde zo 113 routes);
     gekoppeld wordt op de twee delen die de stand Balans zelf tekenen. */
  'link:balans': Object.assign({
    belofte: 'een lid ziet zijn komende week uit zijn eigen agenda, met eerlijke adviezen over rust en avonden, zonder dat RTG er iets nieuws over hem vastlegt -- een ander lid ziet er niets van, en een dubbele tik, een afgebroken verzoek of een crash verandert het beeld niet',
    bestanden: ['public/apps/geld/balans.js', 'public/apps/geld/balansb.js']
  }, voltooi('balans', 'het scenario loopt /api/balans, de route die /apps/geld.html#balans (apps/geld/balans.js en balansb.js) zelf aanroept, met de agenda gevuld langs /api/agenda/toevoegen en /wijzig en een tweede lid dat er niets van ziet')),
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
  /* FoundationOS (19 oktober 2026): de gezinswereld met een eigenaar-account
     (scripts/lib/voltooigezin.js). */
  'link:buurtruil': Object.assign({
    belofte: 'een buurtbewoner zet iets weg te geven of gezocht in zijn RTF-stad, een buur toont belangstelling en de eigenaar sluit het als het weg is'
  }, voltooi('buurtruil', 'het scenario loopt /api/rtfos/publiek/steden en /api/rtfos/ruil/lijst, /mijn, /plaats, /interesse en /sluit, de routes die /apps/foundation/buurtruil.html zelf aanroept, met een buur en het kind van het gezin')),
  'link:geven': Object.assign({
    belofte: 'wie geeft ziet eerst wat er zou gebeuren en bevestigt een keer; een oormerk landt op een echt project, en een meerjarig plan en zijn machtiging beheert de gever zelf'
  }, voltooi('geven', 'het scenario loopt /api/rtfos/gift/stand, /voorbereid, /bevestig, /projecten, /plan/* en /machtiging/*, de routes die /apps/foundation/geven.html zelf aanroept, met het kantoor dat het plan vastlegt')),
  'link:rtfbord': Object.assign({
    belofte: 'een begeleider start een les, tekent op het bord, zet opgaven en de agenda klaar, ziet de inzendingen en leest een schrift -- de klas en een andere les beschrijven zijn bord niet'
  }, voltooi('rtfbord', 'het scenario loopt /api/foundation/bord/*, /opgave, /opgaven, /agenda, /schrift en /les/code/roteer, de routes die /apps/foundation/bord.html zelf aanroept, met de les zoals Leren & Groei hem start en het kind van het gezin als leerling')),
  'link:rtfschrift': Object.assign({
    belofte: 'een leerling doet mee met een les, schrijft in zijn eigen schrift, levert in en vraagt de bijleshulp -- een klasgenoot of een andere les leest zijn schrift niet'
  }, voltooi('rtfschrift', 'het scenario loopt /api/foundation/schrift/opslaan, /schrift, /opgave/inleveren, /ai, /tip, /les en /bord, de routes die /apps/foundation/schrift.html zelf aanroept, met het kind van het gezin als leerling en een klasgenoot')),
  'link:klimaat': Object.assign({
    belofte: 'wie in de buurt woont ziet de lopende duurzaamheidsprojecten en geeft erheen, stelt in het Living Lab een vraag over duurzaamheid, steunt die van een ander en ziet welk onderzoek er loopt'
  }, voltooi('klimaat', 'het scenario loopt /api/rtfos/gift/projecten en /api/lab2/bewoner/labs, /themas, /thema, /stem en /overzicht, de routes die /apps/foundation/klimaatfonds.html zelf aanroept, met een buur die steunt')),
  'link:library': Object.assign({
    belofte: 'een maker begint een werk, legt het vast in onderdelen met revisies, geeft met afspraak en rechten een editie vrij die niet meer verandert, leest hem en verwerkt feedback'
  }, voltooi('library', 'het scenario loopt /api/library/work/*, /studio/workspace, /revision/add, /agreement/*, /rights/grant, /edition/*, /publication/*, /reader/* en /feedback/*, de routes die /apps/library.html via apps/library/app.js aanroept')),
  'link:rtfbuurt': Object.assign({
    belofte: 'wie in een stad woont ziet welke RTF-afdeling open is, wat er loopt, waar hij binnen kan lopen en welke campagne er is -- en niets wat niet op een poster in het buurthuis zou hangen'
  }, voltooi('rtfbuurt', 'het scenario loopt /api/rtfos/publiek/steden, /stad en /campagnes, de routes die /apps/foundation/os-publiek.html zelf aanroept, met wat het kantoor opent en stopt')),
  'link:rtfportaal': Object.assign({
    belofte: 'een partnerstichting, gemeente of ondernemer opent met de code van het kantoor zijn eigen dossier -- de gemeente alleen getelde cijfers -- en elke code opent precies een dossier'
  }, voltooi('rtfportaal', 'het scenario loopt /api/rtfos/portaal/partner, /gemeente en /ondernemer, de routes die /apps/foundation/os-portaal.html zelf aanroept, met codes die het kantoor uitgaf en een tweede stichting')),
  'link:vrienden': Object.assign({
    belofte: 'een kind zoekt niet zelf: zijn ouder voegt een vriendje toe, de ouder van dat vriendje keurt goed, en pas dan sturen de kinderen elkaar berichten'
  }, voltooi('vrienden', 'het scenario loopt /api/rtf/social/connections, /find, /connect, /oudervoeg, /goedkeuren, /dm, /dm/send en /kind/contacten, de routes die /apps/foundation/vrienden.html zelf aanroept, met drie gezinnen')),
  'link:foundationzorg': Object.assign({
    belofte: 'het gezin ziet zijn zorgafspraken (betalen, annuleren) en de gezondheidskaart van het gezin bij elkaar, en een hulpwijzer denkt mee zonder de tekst te bewaren'
  }, voltooi('foundationzorg', 'het scenario loopt /api/care, /api/care/mijn, /betaal, /annuleer, /api/foundation/gezin/:code/gezondheid en /api/foundation/hulp/ai, de routes die /apps/foundation/zorg.html via zorg-hulp.js aanroept')),
  'link:passkeys': Object.assign({
    belofte: 'een lid zet na zijn wachtwoord een passkey op zijn account, logt daarna in zonder wachtwoord, ziet zijn sleutels en haalt er een weg met zijn vinger'
  }, voltooi('passkeys', 'het scenario loopt /api/webauthn/registreer/opties, /registreer, /lijst, /opties, /login, /bevestig/opties en /weg, de routes die /apps/passkeys.html zelf aanroept, met een software-authenticator')),
  /* De zorgtab heeft geen eigen adres: de ledenapp kent de sprong #tab=zorg
     (app-main-12a.js) en de knop #tabZorg. Gekoppeld wordt op de drie delen die
     de tab tekenen en aanroepen: app-main-13 (laden, betalen, annuleren, intake
     stoppen), -14 (intake delen, boeken) en -15 (pakketten). */
  'tab:zorg': Object.assign({
    belofte: 'het lid ziet het zorgaanbod, boekt en betaalt een behandeling of pakket, deelt medische context apart met een kliniek en stopt dat zelf, en annuleert wat hij niet meer wil',
    ingang: '/apps/app.html',
    via: '#tab=zorg',
    bestanden: ['public/apps/app-main/app-main-13.js', 'public/apps/app-main/app-main-14.js', 'public/apps/app-main/app-main-15.js']
  }, voltooi('tabzorg', 'het scenario loopt /api/care, /mijn, /boek, /betaal, /annuleer, /intake/deel, /intake/stop en /pakket/*, de routes die de zorgtab in app-main-13, -14 en -15 aanroept')),
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
  /* TravelOS: aankomst, vervoer en verblijf (19 oktober 2026). */
  'link:aankomst': Object.assign({
    belofte: 'een gast zet zijn wens om in een aanvraag bij de zaak, krijgt een tijdelijke pass met beloften die de zaak persoonlijk bevestigt, en deelt vrijwillig zijn aankomststatus'
  }, voltooi('aankomst', 'het scenario loopt /api/arrival/interpret, /request, /pass en /pulse, de routes die /apps/arrival.html zelf aanroept, met de zaak die de beloften bevestigt en een tweede zaak die niets ziet')),
  'link:move': Object.assign({
    belofte: 'een lid ziet per overgang in zijn reis of hij het haalt, met de dekking erbij, wat er breekt als iets uitloopt en waar hij nu heen moet -- en een vraag verzet niets'
  }, voltooi('move', 'het scenario loopt /api/move/reis, /gevolg en /volgende, de drie routes die /apps/move.html zelf aanroept, over betaalde afspraken bij twee zaken en met een tweede lid dat niets van de reis ziet')),
  'link:navigatie': Object.assign({
    belofte: 'een lid zoekt een bestemming uit de eigen bronnen, krijgt een route van het eigen wegennet of een eerlijke weigering waar dat net er niet is, en meldt onderweg wat hij ziet op codenaam'
  }, voltooi('navigatie', 'het scenario loopt /api/nav/status, /bestemmingen, /route, /kaart, /gebieden, /gebied/kies, /gebied/weg, /gebied/pakket, /meld en /poi, de routes die /apps/navigatie.html zelf aanroept, eerst zonder en daarna met een NWB-raster en gebiedsindex langs de eigen importscripts, met een tweede lid dat melding en kaartkeuze niet ziet')),
  'link:ov': Object.assign({
    belofte: 'een lid koopt bij een vervoerder waarmee RTG een overeenkomst heeft een kaartje uit zijn wallet, toont het, en de controleur ziet het een keer als geldig; weigert de bank, dan is er geen kaartje'
  }, voltooi('ov', 'het scenario loopt /api/mob/kaart/aanbod, /koop, /mijn en /toon, de routes die /apps/ov.html zelf aanroept, met de overeenkomst langs het kantoor, de controleur van de vervoerder en de simulatiebank als rail')),
  'link:ovroutes': Object.assign({
    belofte: 'de manager van een OV-zaak tekent een lijn met haltes, frequentie en tarief, en leden zien hem meteen op de OV-kaart; weghalen haalt hem ook bij hen weg'
  }, voltooi('ovroutes', 'het scenario loopt /api/staff/ov/lijnen en /lijn/zet, de routes die /apps/ovroutes.html zelf aanroept, met een lid dat de lijn op de OV-kaart ziet en een chauffeur en een horecazaak die niet mogen tekenen')),
  'link:stad': Object.assign({
    belofte: 'een bewoner ziet hoe de stad erbij staat en meldt iets dat kapot of vol is; de melding staat meteen op de werklijst van de veldploeg en hij ziet op codenaam wanneer die klaar is'
  }, voltooi('stad', 'het scenario loopt /api/stad/bewoner en /api/stad/melding, de routes die /apps/stad.html zelf aanroept, met de veldploeg die klaarmeldt en een tweede lid dat de melding niet ziet')),
  'link:residentie': Object.assign({
    belofte: 'een lid richt zijn eigen suite in met de Maison-catalogus, geeft hem een naam en zet hem open of dicht; de gids toont een open suite en een ander lid kan hem binnenlopen, een gesloten niet'
  }, voltooi('residentie', 'het scenario loopt /api/residentie/suite, /suite/zet, /meubel/zet, /meubel/weg, /gids en /betreed, de routes die de bundel van /apps/residentie.html aanroept, met een tweede lid als bezoeker')),
  'link:flits': Object.assign({
    belofte: 'een lid meldt met een tik wat hij onderweg ziet en wie in de buurt is ziet het op codenaam; vlakbij dezelfde soort is een bevestiging, drie verschillende leden halen hem weg, en waar het verboden is wordt een flitser geweigerd'
  }, voltooi('flits', 'het scenario loopt /api/flits/rond, /meld, /stem en /vooruit, de routes die /apps/flits.html zelf aanroept, met drie andere leden die bevestigen en wegstemmen')),
  'link:vluchten': Object.assign({
    belofte: 'een lid boekt een vlucht na het opgeven van zijn paspoortgegevens, checkt in met koffers en krijgt een boarding pass met een eenmalige code die hij kan roteren of intrekken, en vraagt een charter aan'
  }, voltooi('vluchten', 'het scenario loopt /api/member/vluchten/bord, /boek, /mijn, /incheck, /pass/roteer, /pass/intrek en /charter, de routes die /apps/vluchten.html zelf aanroept, met een tweede lid dat niets van de boeking ziet')),
  'link:routedossier': Object.assign({
    belofte: 'een medewerker van het kantoor ziet per schakel hoeveel routes bewezen, gezakt of ongemeten zijn, filtert en bladert, en opent een route met al zijn cellen en hun bron'
  }, voltooi('routedossier', 'het scenario loopt /api/office/routedossier, de enige route die /apps/routedossier.html aanroept, met een lid, een zaak en een vreemde die de kantoordeur dicht vinden')),
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
  'link:loonstrook': Object.assign({
    belofte: 'een medewerker ziet zijn eigen loonstrook met uitleg en dossier, en een ander lid ziet hem niet'
  }, voltooi('loonstrook', 'het scenario loopt /api/member/loonstroken, /api/member/dossier en /api/member/identiteit/verzoeken, de routes die /apps/loonstrook.html zelf aanroept, met de strook langs zaak en kantoor op naam en een ander lid dat er niet bij komt')),
  'link:vertegenwoordiging': Object.assign({
    belofte: 'een lid bepaalt zelf wie namens hem mag handelen, met een eigen grens, simulatie vooraf, spoor en intrekken per direct'
  }, voltooi('vertegenwoordiging', 'het scenario loopt /api/vertegenwoordiging/bevoegdheden, /mijn, /grens, /simulatie, /aanvaard en /intrek, de routes die /apps/vertegenwoordiging.html zelf aanroept, met de vertegenwoordiger via /voorstel en /handel en een derde lid dat er niet bij komt')),
  'link:onderneming': Object.assign({
    belofte: 'een ondernemer begint met een werktitel, kiest een rechtsvorm, werkt de oprichting af en schrijft zich in, en dat staat precies een keer op zijn naam'
  }, voltooi('onderneming', 'het scenario loopt /api/onderneming/nieuw, /mijn, /rechtsvorm, /oprichting/zet, /intake, /verkenning, /plan/vastleggen, /ingeschreven, /kas/saldo en /dagbeeld, de routes die /apps/onderneming.html zelf aanroept, met een ander lid dat er niet bij komt')),
  'link:magnaat': Object.assign({
    belofte: 'een lid pakt een dossier uit zijn dagdienst op, opent het juiste RTG-scherm en beantwoordt de keuzes; wat hij verdient blijft van hem en telt een keer'
  }, voltooi('magnaat', 'het scenario loopt /api/member/magnaat/overzicht, /taak/start, /taak/handeling en /taak/antwoord, onder het voorvoegsel dat /apps/magnaat.html via api() aanroept, met een tweede speler die er niet bij komt')),
  'link:office': Object.assign({
    belofte: 'een medewerker maakt een document in de kantoordrive, bewaart met versies en zet een versie terug; een oud venster schrijft er niet overheen en een zaak of lid komt er niet bij'
  }, voltooi('office', 'het scenario loopt /api/office/kantoorpakket/mijn, /maak, /open, /bewaar, /versies en /terug, het voorvoegsel dat /apps/office.html in de kantoorstand aanroept, met een zaak en een lid die er niet bij komen')),
  'link:sitemaker': Object.assign({
    belofte: 'een lid bouwt een eigen website, zet hem online en bepaalt zelf wanneer een wijziging naar buiten gaat, en een ander lid komt er niet aan'
  }, voltooi('sitemaker', 'het scenario loopt /api/site/sjablonen, /mijn, /haal, /bewaar, /publiceer, /live, /versies, /herstel en /offline, de routes die /apps/sitemaker.html zelf aanroept, met een bezoeker via /api/browser/open en een ander lid dat er niet bij komt')),
  /* Partner Network, echt gebouwd op besluit van de eigenaar (19 oktober 2026):
     de netwerkkant van een partnerzaak, alleen tellingen met een bron. */
  'link:partnernetwerk': Object.assign({
    belofte: 'een partnerzaak ziet de vragen van leden die bij haar passen, haar beloften en wat aandacht vraagt, met bij elk getal zijn bron, en antwoordt op een vraag'
  }, voltooi('partnernetwerk', 'het scenario loopt /api/supplier/netwerk/overzicht en /api/supplier/mall/aanvraag/reageer, de routes die /apps/partner-network.html zelf aanroept, met een lid dat de vraag stelt en het antwoord leest en een andere zaak die het niet ziet')),
  /* Werk heeft geen eigen adres: het is de werkkiezer in /apps/app.html. Het
     OS-beginscherm is bewust onbereikbaar (WERELD.md), dus de via loopt langs
     de rand: "open werk" bij Rahul lost in de functiegids exact op naar os:werk
     (app-main-29.js) en openItem opent de kiezer (app-main-26.js). */
  'os:werk': Object.assign({
    belofte: 'een lid opent zijn werk met zijn eigen account, in de rollen die er werkelijk aan hangen, en een rol die hij niet heeft opent niets',
    ingang: '/apps/app.html',
    via: 'de rand: "Praat met Rahul" -> "open werk", dat in de functiegids exact op os:werk uitkomt en de werkkiezer opent',
    // app-main-25.js: de werkkiezer (openWerkKiezer) met /api/account/rollen en /api/account/start
    bestanden: ['public/apps/app-main/app-main-25.js']
  }, voltooi('werk', 'het scenario loopt /api/account/rollen en /api/account/start, de routes die de werkkiezer in app-main-25.js zelf aanroept, met personeel via de wervingslink, het kantoor via een uitnodiging en een ander lid dat geen rol krijgt')),
  'link:browser': Object.assign({
    belofte: 'een lid vindt en opent de site van een ander lid en stuurt via het formulier een bericht dat precies een keer als gesprek aankomt, alleen tussen verbonden leden'
  }, voltooi('browser', 'het scenario loopt /api/browser/gids, /zoek, /open en /bericht, de routes die /apps/browser.html zelf aanroept, met de maker die het gesprek leest, een zaak die de klus in haar werklijst ziet en een vreemde die er niet door komt')),
  /* Tot 19 oktober 2026 droeg de tafelproef (scripts/tafelproef.js) hier
     voltooibaar. De voltooiproef loopt nu dezelfde stroom van openen tot
     afrekenen en meet daarnaast de herstart, de crash en de offline sync; een
     scenario levert alle vier of geen (test/voltooiproef.test.js). De
     tafelproef blijft zijn eigen register, voor de overdracht naar de gast. */
  'link:horeca': Object.assign({
    belofte: 'een zaak bedient een tafel van rekening openen tot afrekenen, en een offline opgenomen bestelling komt precies een keer binnen'
  }, voltooi('horeca', 'het scenario loopt /api/supplier/horeca/rekening/*, /keuken/*, /betaal en /offline/sync onder het voorvoegsel dat /apps/horeca.html via RTGHoreca.api aanroept, met een tweede zaak die de rekening niet ziet')),
  /* LivingOS-A (APPWERKT, 19 oktober 2026). */
  'link:appdossier': Object.assign({
    belofte: 'een lid leest over een app van een derde wie de leverancier is en wie hem toeliet, wat er draait, wat hij nooit krijgt en wat het dossier niet kan zeggen -- pas nadat een mens van RTG publiceerde'
  }, voltooi('appdossier', 'het scenario loopt /api/appstore/kanaal en /api/appstore/dossier, de routes die /apps/appstore-dossier.html zelf aanroept, met een uitgever die inzendt en een kantoormens op naam die publiceert')),
  'link:berichten': Object.assign({
    belofte: 'een lid begint een gesprek met iemand die het kent, stuurt, antwoordt, wijzigt en trekt in, en de ander ziet precies dat; wie niet in het gesprek zit leest en schrijft niets'
  }, voltooi('berichten', 'het scenario loopt /api/comm/begin, /stuur, /inbox, /gesprek, /lees, /reactie, /wijzig en /wis, de routes die /apps/comm.html zelf aanroept, met een verbonden tweede lid en een derde dat buiten blijft')),
  'link:vonk': Object.assign({
    belofte: 'een gekeurd volwassen lid krijgt een eindige selectie van wederzijds passende mensen, en pas bij wederzijdse interesse een chat en een tafel die beiden vooraf betalen en de zaak bevestigt'
  }, voltooi('vonk', 'het scenario loopt /api/vonk/profiel, /selectie, /like, /edge, /bericht, /mijn, /betaal en /blokkeer, de routes die /apps/vonk.html zelf aanroept, met twee gekeurde leden, de simulatiebank en de zaak die bevestigt')),
  'link:theater': Object.assign({
    belofte: 'een lid met een door het kantoor goedgekeurd kanaal zet een film in de zaal, byte voor byte; een ander lid kijkt met een kijkticket, spoelt, reageert, abonneert en meldt'
  }, voltooi('theater', 'het scenario loopt /api/theater/zaal, /kanaal/aanmeld, /video/maak, /upload/:id, /kijk/:id met /api/stroom/ticket, /reactie, /reacties, /abonneer en /meld, de routes die /apps/theater.html zelf aanroept, met een tweede lid als kijker')),
  'link:spelavond': Object.assign({
    belofte: 'een speler koppelt met een eenmalige code een televisie aan het potje, en die toont vanaf dan elke zet -- alleen wat publiek is, met een eigen schermsessie die geen ledensessie is'
  }, voltooi('spelavond', 'het scenario loopt /api/projectie/koppel en /api/projectie/kijk, de routes die /apps/spelscherm.html zelf aanroept, met twee spelers die het potje en de code maken langs /api/member/spel/*')),
  'link:vooruitzicht': Object.assign({
    belofte: 'een lid legt een intentie vast, verkent routes en geeft de voorbereiding vrij, en het vooruitzicht toont uitsluitend wat een bron gaf -- geen providerstatus die niemand bevestigde'
  }, voltooi('vooruitzicht', 'het scenario loopt /api/instant-reality, /event en /partner en de acht bronnen die /apps/living-os.html ernaast leest, met een tweede lid dat zijn eigen vooruitzicht houdt')),
  'link:krant': Object.assign({
    belofte: 'een lid leest de kranten die nieuwsbedrijven binnen RTG publiceren, met de correcties die de redactie openbaar maakte; een concept of teruggehaald artikel bestaat voor de lezer niet'
  }, voltooi('krant', 'het scenario loopt /api/krant/gids, /open en /artikel, de routes die /apps/krant.html zelf aanroept, met de redactie van een nieuwszaak die schrijft, publiceert, corrigeert en terughaalt')),
  'link:podium': Object.assign({
    belofte: 'een lid met een door het kantoor goedgekeurd kanaal gaat live; een kijker vindt het, kijkt mee, chat, stuurt een cadeau via RTG Pay en meldt, en de maker blokkeert wie over de schreef gaat'
  }, voltooi('podium', 'het scenario loopt /api/podium/kanalen, /mijn, /kanaal/aanmeld, /live, /kijk, /chat, /cadeau, /blokkeer en /meld, de routes die /apps/podium.html zelf aanroept, met een gekeurde kijker die over de simulatiebank oplaadt')),
  'link:huis': Object.assign({
    belofte: 'een lid zet zijn huis open, een ander lid vindt en vraagt het aan zonder dat er iets wordt afgeschreven, de host beslist, en het verblijf loopt van inchecken tot review; een bezette periode blijft bezet'
  }, voltooi('huis', 'het scenario loopt /api/thuis/huis, /huizen, /zoek, /detail, /boek, /bord, /beslis, /mijn, /checkin, /checkuit, /bericht, /review en /reviews, de routes die /apps/thuis.html zelf aanroept, met een host, een gast en een derde lid')),
  'link:leven': Object.assign({
    belofte: 'een lid ziet op zijn lijn alleen wat hij zelf ergens vastlegde en wat deze week speelt, zonder knop die iets voor hem doet, en niemand anders ziet het'
  }, voltooi('leven', 'het scenario loopt /api/leven/cockpit, /api/foodcourt en /api/uitgaan, de routes die /apps/leven.html zelf aanroept, met een afspraak uit de eigen agenda en een tweede lid')),
  /* De standen van LivingOS-A in de ledenapp: geen eigen adres, dus ingang
     /apps/app.html en de sprong #tab=<stand>; gekoppeld op de delen die de stand
     tekenen en aanroepen (die roepen hun routes letterlijk als /api/... aan). */
  'tab:gezin': Object.assign({
    belofte: 'een oppas of familielid koppelt zich met de eenmalige uitnodiging van een RTFoundation-gezin, ziet wat het gezin hem toevertrouwt, stuurt het gezin een bericht en ontkoppelt zelf',
    ingang: '/apps/app.html',
    via: '#tab=gezin',
    // app-main-43.js: kanaal en ontkoppelen; -44.js: overzicht, uitnodiging accepteren, bericht
    bestanden: ['public/apps/app-main/app-main-43.js', 'public/apps/app-main/app-main-44.js']
  }, voltooi('gezin', 'het scenario loopt /api/rtf/uitnodiging/accepteer, /overzicht, /kanaal, /bericht en /ontkoppel, de routes die de stand Gezin in app-main-43 en -44 aanroept, met een echte ouder aan de andere kant')),
  'tab:betalen': Object.assign({
    belofte: 'een lid rekent het betaalverzoek van een zaak een keer af, betaalt een zaak rechtstreeks en hoort het als de bank weigert',
    ingang: '/apps/app.html',
    via: '#tab=betalen',
    // app-main-46.js: verzoeken, rechtstreeks betalen en de eigen betalingen
    bestanden: ['public/apps/app-main/app-main-46.js']
  }, voltooi('betalen', 'het scenario loopt /api/betaal/verzoeken, /verzoek/pay, /direct en /mijn, de routes die de stand Betalen in app-main-46 aanroept, met de simulatiebank en een gebonden toestel')),
  'tab:bestellen': Object.assign({
    belofte: 'een lid bestelt boodschappen bij een groothandel, ziet de bestelling verder gaan en annuleert er een die nog niet bevestigd is',
    ingang: '/apps/app.html',
    via: '#tab=bestellen',
    // app-main-19.js: de markt, bestellen, mijn bestellingen en annuleren
    bestanden: ['public/apps/app-main/app-main-19.js']
  }, voltooi('bestellen', 'het scenario loopt /api/groothandel/markt, /bestel, /mijn en /annuleer, de routes die de stand Bestellen in app-main-19 aanroept, met de groothandel die de bestelling verder zet')),
  'tab:assets': Object.assign({
    belofte: 'een betalend lid vraagt tickets aan, een mens van RTG op naam keurt, en pas een bevestigde betaling geeft precies de tickets; herroepen zegt alleen wat waar is',
    ingang: '/apps/app.html',
    via: '#tab=assets',
    // app-main-32.js: overzicht en aanvragen; -32a.js: aanvragen, betalen, intrekken; -33.js: herroepen, document, gebruik
    bestanden: ['public/apps/app-main/app-main-32.js', 'public/apps/app-main/app-main-32a.js', 'public/apps/app-main/app-main-33.js']
  }, voltooi('assets', 'het scenario loopt /api/assets, /api/asset/koop, /aanvragen, /aanvraag/betaal, /mijn en /herroep, de routes die de stand Assets in app-main-32, -32a en -33 aanroept, met een kantoormens op naam en de simulatiebank')),
  /* Bellen heeft geen tegel: de werktafel is het beginscherm (WERELD.md). De
     route is de rand "Praat met Rahul", dan "open bellen" (LivingOS-B, 19 oktober
     2026); de functiegids opent de kiezer in app-main-26, RTGSocial.bel in -10
     belt en -11 geeft de signalen van de live-verbinding door. */
  'os:bellen': Object.assign({
    belofte: 'een lid belt een verbonden lid met spraak: het gaat over, opnemen, ophangen en weigeren komen aan, niemand anders hoort iets, en van het gesprek wordt niets bewaard',
    ingang: '/apps/app.html',
    via: 'de rand "Praat met Rahul", dan "open bellen": de functiegids opent de kiezer met Salon-contacten, en een tik op een contact belt',
    // app-main-26 (de kiezer) roept zelf geen route aan; de koppeling loopt op -10, -10a en -11
    bestanden: ['public/apps/app-main/app-main-10.js', 'public/apps/app-main/app-main-10a.js', 'public/apps/app-main/app-main-11.js']
  }, voltooi('bellen', 'het scenario loopt /api/member/call met een echte live-verbinding (/api/stroom/ticket, /api/stream) per lid, de signalering die RTGSocial.bel in app-main-10 en de doorgifte in app-main-11 gebruiken, met een onverbonden, een geblokkeerd en een gratis lid')),

  /* De lusproef stond tot 24 september 2026 in ZONDER_APP: hij schreef geen
     register, en Ontdekken leek /apps/rtg.html te zijn. Beide klopten niet meer:
     link:connect is /apps/connect.html, dat acht /api/connect-routes met de proef
     deelt, en de proef schrijft nu LUSPROEF.json met het huisstempel. De proef
     loopt als LID over /api/connect, de deur die connect.html zelf aanroept; de
     gezinsdeur /api/rtf/connect is dezelfde motor maar wordt niet gelopen, en dat
     staat in `waarom` in plaats van weggelaten. */
  /* Sinds 19 oktober 2026 komen alle vier de bewijzen uit de voltooiproef, die
     de GEZINSDEUR loopt -- de persona van deze rij, en de deur die connect.html
     bij een gezinssessie kiest. De lusproef (LUSPROEF.json, scripts/lusproef.js)
     blijft bestaan en loopt de ledendeur met een tweede mens die bevestigt; dat
     deel van de belofte draagt de voltooiproef niet, en dat staat in zijn grens. */
  'link:connect': Object.assign({
    belofte: 'je ontdekt iets, begrijpt het, doet er iets mee, en een ander bevestigt dat het hem hielp -- zonder score, rangorde of niveau'
  }, voltooi('connect', 'het scenario loopt /api/rtf/connect/ontdek, /open, /signaal, /schuif, /horizon, /dossier, /portfolio, /noteer en /werk, de gezinsdeur die /apps/connect.html bij een gezinssessie aanroept; de bevestiging door een tweede mens loopt de lusproef')),
  /* LivingOS-B: media, sociaal en spel (19 oktober 2026). */
  'link:muziek': Object.assign({
    belofte: 'een lid deelt zijn eigen muziek, een ander lid vindt, hoort en waardeert haar, alleen de maker haalt haar weg, en samen luisteren brengt de luisteraar in de kamer van de gastheer'
  }, voltooi('muziek', 'het scenario loopt /api/muziek/bestand, /feed, /bestand-ticket, /luister, /mooi en /bestand-weg, en /api/samen/maak, /mee, /muziek en /staat, de routes die /apps/muziek.html (muziek-feed.js, muziek-bestanden.js) zelf aanroept, met twee leden en een gratis account')),
  'link:nieuws': Object.assign({
    belofte: 'een lid leest het gepubliceerde werk van RTG Redactie per rubriek, opent een artikel en laat Rahul het samenvatten of een vraag beantwoorden uit alleen de artikeltekst; een concept of teruggetrokken stuk ziet het niet'
  }, voltooi('nieuws', 'het scenario loopt /api/member/nieuws, /artikel en /ai, de routes die /apps/nieuws.html zelf aanroept, met twee leden en de redactie (eigenaarsaccount) die publiceert en terugtrekt')),
  'link:sport': Object.assign({
    belofte: 'een lid reserveert tickets op een vak van de plattegrond die de club zelf tekent, ziet zijn toegangscode, en die code gaat bij de entree een keer naar binnen; een vol vak zegt hoeveel plaatsen er nog zijn, en een herhaalde tik reserveert nooit dubbel'
  }, voltooi('sport', 'het scenario loopt /api/member/sport/bord, /plattegrond, /ticket/koop, /tickets, /sponsors en /sponsor, de routes die /apps/sport.html zelf aanroept, met twee leden, een gratis account en de seedclub die tekent en scant')),
  'link:clips': Object.assign({
    belofte: 'een lid deelt een korte clip waarvan het beeld op zijn eigen toestel blijft; andere leden zien hem in een eindige dagselectie met gevolgde makers eerst, reageren en melden, en alleen de maker knipt, ondertitelt en haalt weg'
  }, voltooi('clips', 'het scenario loopt /api/clips/feed, /maak, /volg, /reactie, /reacties, /meld, /knip, /ondertitels en /weg, de routes die /apps/clips.html zelf aanroept, met drie leden, een gratis account en het kantoor; het beeld zelf (P2P via /aanwezig en /signaal) loopt niet mee')),
  'link:rendezvous': Object.assign({
    belofte: 'Signature-leden met een geverifieerd paspoort zien elkaar op codenaam, een match ontstaat alleen wederzijds en alleen de twee zien hem, en een blokkade werkt in beide richtingen'
  }, voltooi('rendezvous', 'het scenario loopt /api/member/rendezvous/profiel, /profiel/zet, /kandidaten, /like, /pas, /matches en /blokkeer, de routes die /apps/rendezvous.html zelf aanroept, met vier leden die een medewerker op naam verifieerde en het kantoor een Lifestyle Pass gaf, en twee leden zonder het volle recht')),
  'link:sociaal': Object.assign({
    belofte: 'Rahul zet klaar wat er in de kring van het lid openstaat, de mens bevestigt, de ander ziet het antwoord en het actielog verantwoordt het'
  }, voltooi('sociaal', 'het scenario loopt /api/sociaal/wereld, /command, /lijn, /object en /voorstel/bevestig, de routes die /apps/sociaal.html zelf aanroept, met twee leden in een besloten genootschap (opgebouwd over de routes van Genootschap) en een derde erbuiten')),
  'link:spelen': Object.assign({
    belofte: 'een lid nodigt een vriend uit, ze spelen om de beurt tot het potje klaar is, en de uitslag telt alleen voor geverifieerde volwassenen; onder die grens speelt het spel gewoon en wordt er niets bewaard'
  }, voltooi('spelen', 'het scenario loopt /api/member/spel/nieuw, /antwoord, /mijn, /staat, /zet, /uitslagen en /stand, de routes die /apps/spelen.html zelf aanroept, met twee geverifieerde volwassenen, twee leden onder de progressiegrens en een schaakpartij die echt eindigt')),
  /* De momentproef (ZONDER_APP hieronder) blijft de deelbelofte volgen en gewekt
     worden; dit scenario is de kernbelofte van RTG Media. */
  'link:mediaos': Object.assign({
    belofte: 'een lid ziet de mediawereld met bij elk stuk waarom het er staat, bewaart wat het wil houden, maakt een eigen afspeellijst en deelt die om te lezen met wie het kent; de lezer verandert niets en een vreemde ziet niets'
  }, voltooi('mediaos', 'het scenario loopt /api/mediaos/wereld, /bewaar, /bieb, /lijsten, /lijst, /lijst/maak, /lijst/stuk, /lijst/zet en /lijst/deel, de routes die /apps/media.html (media/wereld.js, blad.js, lijst.js) zelf aanroept, met twee verbonden leden, een vreemde en een gratis account; de stukken zijn clips van het tweede lid')),
  'link:ontdek': Object.assign({
    belofte: 'een lid ziet in zijn Overzicht zijn dossier, wat er wacht en de afspraken van zijn eigen dag, en maakt het huis het zijne met een eigen foto die alleen hij ziet'
  }, voltooi('ontdek', 'het scenario loopt /api/member/huis/dossier, /api/sociaal/lijn, /api/sociaal/wereld, /api/agenda/mijn-lijst, /api/bestanden/upload, /api/bestanden/haal, /api/ik/beelden en /api/ik/beelden/zet, de routes die /apps/rtg.html (rtg-dossier.js, rtg-vandaag.js, shared/interface/personal-images.js en personal-image-editor.js) zelf aanroept, met twee leden')),
  /* LivingOS-B zonder eigen adres: de stand Salon en de os-tegel Snaps van de
     ledenapp (19 oktober 2026). De koppeling loopt op de delen die DEZE app
     tekenen, niet op de schil. */
  'tab:salon': Object.assign({
    belofte: 'een lid ziet de posts van De Salon, waardeert ze en reageert onder zijn codenaam, en een post voor vrienden ziet alleen een vriend',
    ingang: '/apps/app.html',
    via: '#tab=salon',
    // app-main-58.js: de knoppen onder een Salon-bericht (waarderen, reageren)
    bestanden: ['public/apps/app-main/app-main-58.js']
  }, voltooi('salon', 'het scenario loopt /api/state, /api/like en /api/comment, de routes die de stand Salon van /apps/app.html (app-main-58.js) aanroept, met een vriend, een vreemde en een gratis account')),
  'os:snaps': Object.assign({
    belofte: 'een lid stuurt een vriend een snap, de vriend ziet hem een keer en daarna is de foto weg, ook uit de opslag',
    ingang: '/apps/app.html',
    via: "Praat met Rahul in de rand, 'open snaps', dan de kiezer met Salon-contacten",
    // app-main-07.js stuurt de snap, 08b.js tekent de strip, 09.js opent hem een keer
    bestanden: ['public/apps/app-main/app-main-07.js', 'public/apps/app-main/app-main-08b.js', 'public/apps/app-main/app-main-09.js']
  }, voltooi('snaps', 'het scenario loopt /api/member/snap/send, /api/member/snaps en /api/member/snap/view, de routes die de snapkiezer en de snapstrip van /apps/app.html zelf aanroepen, met een vriend, een derde lid en een blokkade')),
  /* Het tweede scherm is van de zaak (werkrol zaak, app-main-23b.js): het leest
     alleen /api/supplier/state. Gekoppeld op het scherm zelf, niet op de schil. */
  'link:tweedescherm': Object.assign({
    belofte: 'een zaak zet haar kassa, keuken, bar of reserveringen op een tweede scherm en ziet daar wat er in de zaak gebeurt; een andere zaak, een lid of een anonieme bezoeker ziet het niet',
    // scherm.html roept zelf alleen /api/supplier/state aan; de rest is de gedeelde schil
    bestanden: ['public/apps/scherm.html']
  }, voltooi('tweedescherm', 'het scenario loopt /api/supplier/state, de enige route die /apps/scherm.html zelf aanroept, met een verkoop op de kassa van dezelfde zaak en een tweede zaak ernaast')),
  /* Het Privékantoor (11 oktober 2026). De concierge-lus had tot die dag geen
     scherm; nu staat de lid-kant in het tabblad Zaken van /apps/lifestyle.html
     (apps/lifestyle-lus.js), en die roept /api/member/bureau/lus/* aan -- precies
     de lid-routes die de conciergeproef loopt. De proef dekt de lus en niet het
     hele Privékantoor (woning, kring, bezit, mandaat lopen hier niet mee); dat
     staat in `waarom` in plaats van weggelaten. */
  /* Sinds 19 oktober 2026 levert de voltooiproef alle vier: hij loopt dezelfde
     lus over een ECHT Lifestyle-lid (aangevraagd en door een mens geaccepteerd)
     met een herstart, een crash en een afgebroken verzoek, en een scenario
     levert zijn bewijzen samen (test/voltooiproef.test.js). De conciergeproef
     blijft de keten met de zaakkant; zie ZONDER_APP. */
  'link:rechterhand': Object.assign({
    belofte: 'een lid vertelt een wens in een zin, De Rechterhand regelt hem, en het lid beslist alleen over een concreet voorstel buiten zijn mandaat'
  }, voltooi('rechterhand', 'het scenario loopt /api/member/bureau/lus/intake, /zaak, /beslis en /toelichting en /api/member/bureau/zaken, de routes die het tabblad Zaken van /apps/lifestyle.html (apps/lifestyle-lus.js) aanroept, met een kantoormens op naam langs /api/office/bureau/lus/*; de andere tabbladen van het Privékantoor loopt hij niet'))
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
  { register: 'CONCIERGEPROEF.json', instrument: 'scripts/conciergeproef.js',
    reden: 'leverde tot 19 oktober 2026 voltooibaar voor het Privekantoor (link:rechterhand); dat komt nu met persistent en herstelbaar uit de voltooiproef (scripts/lib/voltooi/rechterhand.js), over een echt Lifestyle-lid in plaats van de demo-inlog. De keten blijft wat het scenario niet loopt: de zaakkant, vertragingen en herstel na een omgevallen onderdeel',
    nodig: 'een zaakregister naast APPWERKT, zoals bij de toelatingsproef; of de zaakkant in het scenario van link:rechterhand' },
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
  'os:videobellen': 'videobellen vraagt test-identiteiten voor WebRTC in een headless browser, en dat vraagt een besluit (BETROUWBAARHEID.md par. 4)'
};

module.exports = { BEWIJZEN, BRONSOORTEN, CONTRACT, ZONDER_APP, WERELD, ALGEMEEN, TESTWERELD_ONTBREEKT };
