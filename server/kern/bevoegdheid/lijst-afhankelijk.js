/* DE AFHANKELIJKE VERMOGENS -- dezelfde handeling is een ANDERE handeling
   geworden, en welke het is hangt af van een schakelaar in de boardroom.

   Ze staan apart van ./lijst.js omdat ze anders van vorm zijn dan de rest: waar
   een gewoon vermogen EEN regel is, draagt een afhankelijk vermogen twee
   volledig uitgeschreven gezichten, een `hangtAf` die zegt welke schakelaar
   beslist, en een `zonderStand` die zegt wat er geldt als niemand die
   schakelaar heeft gezet. Dat is te veel tekst om tussen de eenregelige
   vermogens te hangen, en het is ook te BELANGRIJK daarvoor: dit is het stuk
   waar de code en de juridische positie aan elkaar vastzitten.

   DE REGEL DIE OVER ALLE DRIE GAAT: de schakelaar IS de positie, niet iets dat
   er toevallig naast staat. Daarom staat elk gezicht hier voluit, en wordt er
   nergens een stand "afgeleid" uit een ander veld. Een stand die je kunt
   afleiden, kun je ook ongemerkt omzetten.

   EN DE STAND WORDT PER VERMOGEN OPGEHAALD, op naam van zijn eigen `hangtAf`
   (./index.js). Dat was eerst EEN stand voor alle afhankelijke vermogens, en
   dat werkte zolang er maar een schakelaar was; met de tweede zou
   RUGDEKKING_BEURS stilletjes de terugstortstand lezen -- en die twee heten
   allebei `gesloten` en `open`, dus niemand had het gemerkt. */
'use strict';

const AFHANKELIJK = {
/* -- afhankelijk: dezelfde handeling is een ANDERE handeling geworden --

   WALLET_SALDO was jarenlang een `besluit`: toegestaan omdat RTG had
   VASTGESTELD dat het buiten de vergunningplicht viel. De redenering was een
   beperkt netwerk, en hij stond op drie voorwaarden -- saldo alleen binnen RTG
   te besteden, niet uitbetaald aan het lid, en plafonds -- met een
   vervalclausule erbij: verandert een van die drie, dan hoort dit vermogen van
   soort te wisselen.

   Op 24 augustus 2026 is besloten dat leden hun saldo moeten kunnen
   terugstorten. Dat is de tweede voorwaarde. Saldo dat tegen de nominale
   waarde inwisselbaar is voor de houder, IS elektronisch geld; een besluit kan
   dat niet wegschrijven, want het gaat over wat de handeling is en niet over
   hoe we hem noemen.

   EN DAAROM STAAT HIER GEEN KEUZE MAAR EEN AFHANKELIJKHEID. RTG wil beide
   posities kunnen innemen -- dat is een legitieme bedrijfskeuze, en het is
   precies waarom die keuze niet los mag staan van wat hij juridisch betekent.
   Vandaar `soort: 'afhankelijk'`: welk gezicht geldt, hangt af van de
   terugstortstand in de boardroom (kern/bankregie/vergunning.js).

     gesloten -> een BESLUIT. Geen uitbetaling aan het lid, dus een gesloten
                 circuit met plafonds, dus een beperkt netwerk. Geen
                 vergunning nodig, en de grond staat erbij zodat iemand hem
                 kan tegenspreken.
     open     -> een RAIL. Draait de partnerrail (de partij die het geld
                 aanhoudt en bevoegd is), dan levert RTG het scherm en de
                 administratie. Over de EIGEN rails moet RTG het zelf mogen,
                 en dan is de eis elektronischgeldinstelling en niet
                 betaalinstelling: klantgeld aanhouden dat inwisselbaar is, is
                 zwaarder dan een betaling doorgeven.

   Zo kan de knop om zonder dat er ooit een stand bestaat waarin de code iets
   anders doet dan het document zegt. Dat was de fout die dit hele traject
   heeft blootgelegd, en dit is de vorm die hem structureel uitsluit.

   Waar de voorwaarden worden afgedwongen die in BEIDE standen gelden:
     plafond per wallet   kern/waarde/klassen.js  (plafondCenten per klasse)
     plafond per boeking  kern/pay/stand.js       (MAX_CENTEN)
     alleen binnen RTG    kern/waarde/policy.js   (bestedingsgebied)
     en de poort erlangs  kern/pay/poort.js       (bij elke boeking) */
WALLET_SALDO: { soort: 'afhankelijk', naam: 'Walletsaldo van leden aanhouden',
  hangtAf: 'terugstorting', zonderStand: 'open',   // een rail kan weigeren, een besluit nooit
  gesloten: { soort: 'besluit',
    besluit: 'Een gesloten circuit met harde plafonds: saldo is alleen binnen RTG te besteden, ' +
      'wordt niet uitbetaald aan het lid en kent een maximum per wallet en per boeking. ' +
      'RTG rekent dit tot een beperkt netwerk. Zet de boardroom het terugstorten open, dan ' +
      'vervalt deze grond en wordt dit vermogen een rail met een vergunningseis.' },
  open: { soort: 'rail', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'rekeningen' } },

/* De terugstorting zelf. Apart van WALLET_SALDO omdat het een andere handeling
   is: het aanhouden van saldo en het uitbetalen ervan kunnen los van elkaar
   dicht staan, en bij een storing op de uitbetaalrail hoort de wallet niet mee
   te vallen. Elke uitbetaalbare waardeklasse noemt haar vermogen bij naam
   (kern/waarde/klassen.js, `uitbetaalVermogen`), zodat uitbetaalbaarheid nooit
   met één boolean aan te zetten is zonder te zeggen waarop hij rust.

   In de stand `gesloten` bestaat deze handeling niet -- niet "hij mag even
   niet", maar hij hoort niet bij wat RTG dan is. Het antwoord zegt dat ook met
   zoveel woorden, want "geweigerd" zonder reden stuurt een lid naar de
   helpdesk voor iets dat een bewuste keuze is. */
LID_UITBETALING: { soort: 'afhankelijk', naam: 'Walletsaldo terugstorten naar het lid',
  hangtAf: 'terugstorting', zonderStand: 'gesloten',   // bij twijfel gaat er geen geld het huis uit
  gesloten: { soort: 'stand',
    reden: 'RTG betaalt walletsaldo op dit moment niet terug aan leden. Saldo is bedoeld om ' +
      'binnen RTG te besteden.' },
  open: { soort: 'rail', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'sepa' } },


  /* DE BEURS VAN DE RTFOUNDATION (kern/rugdekking/). RTG keert hier geld uit aan
     een MENS zonder dat daar een levering tegenover staat: geen factuur, geen
     tegenprestatie, geen omzet. Dat is met opzet een ander vermogen dan
     PARTNER_UITBETALING, want die gaat naar een ondernemer die iets heeft
     geleverd -- en het verschil tussen die twee is precies wat een
     toezichthouder als eerste vraagt.

     WAAROM HIJ STANDAARD DICHT STAAT, terwijl WALLET_SALDO standaard open staat:
     daar is `open` het strengste gezicht (een rail die een vergunning vraagt kan
     weigeren, een besluit nooit). Hier ligt het andersom, net als bij
     LID_UITBETALING: bij twijfel gaat er geen geld naar een mens.

       gesloten -> deze handeling BESTAAT NIET. Niet "hij mag even niet" maar
                   hij hoort niet bij wat RTG vandaag is. Commerciele
                   rugdekking kan wel, en het antwoord zegt dat erbij.
       open     -> een RAIL. Het geld gaat naar de bankrekening van een mens,
                   dus dezelfde sepa-eis als elke andere uitbetaling. Wie hem
                   omzet, neemt de positie in dat RTG geld uitkeert buiten een
                   levering om.

     WAT DEZE SCHAKELAAR NIET OPLOST, en dat staat er even groot bij: GIFT.md
     zegt dat de RTFoundation geen positie heeft om aan of vanaf te betalen. Gaat
     deze schakelaar open terwijl dat besluit nog niet genomen is, dan betaalt
     RTG zelf -- en dan is het geen beurs van de stichting maar een uitkering van
     een handelsonderneming (kern/economie/firewall.js). */
  RUGDEKKING_BEURS: { soort: 'afhankelijk', naam: 'Een beurs uitkeren aan een mens',
    hangtAf: 'rugdekkingBeurs', zonderStand: 'gesloten',   // bij twijfel gaat er geen geld naar een mens
    gesloten: { soort: 'stand',
      reden: 'RTG keert geen geld uit aan een mens buiten een levering om. Rugdekking loopt vandaag ' +
        'als KOOP: de mens levert iets, factureert als ondernemer, en wordt als leverancier betaald.' },
    open: { soort: 'rail', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' } }
};

module.exports = { AFHANKELIJK };
