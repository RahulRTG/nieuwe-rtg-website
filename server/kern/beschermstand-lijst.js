/* WAT DE BESCHERMSTAND BEVRIEST EN WAT ER DOORLOOPT -- de indeling zelf.

   Dit bestand draagt de AFSPRAKEN; ./beschermstand.js draagt de beslissing en de
   fail-fasts die deze lijsten bewaken. Ze staan apart omdat ze anders veranderen:
   de indeling schuift mee met de functiecatalogus (een categorie erbij is een
   productbesluit), de beslissing verandert bijna nooit. Wie ze in één bestand
   zet, leest bij elke wijziging in de indeling ook de motor door -- en dan gaat
   hij op een dag de motor aanpassen om een categorie kwijt te raken.

   Waarom de methode hier het verkeerde signaal is, waarom er zes categorieën
   bevriezen en tien doorlopen, en waarom er vier uitzonderingen met naam staan:
   dat staat in de kop van ./beschermstand.js, bij de regel die het afdwingt. */
'use strict';

/* De zes die bevriezen. Per categorie waarom, want dat is het enige wat een
   volgende lezer nodig heeft om te beoordelen of de indeling nog klopt. */
const BEVRIEST = {
  'Toegang en identiteit': 'hier ontstaan nieuwe rechten: zegels, aanmeldingen, SSO-koppelingen, ' +
    'pincodes en wervingslinks. Wie zich tijdens een incident nestelt, doet dat hier.',
  'Identiteit en veiligheid': 'RTG iD en de onboarding maken identiteiten aan; een identiteit die ' +
    'tijdens een incident ontstaat, is de identiteit die je achteraf niet kunt terugdraaien.',
  'Betalen & verificatie': 'geld dat tijdens een incident beweegt, beweegt terug met een bank en ' +
    'niet met een knop.',
  'Geld': 'zelfde reden, en dit is de categorie waar het om bedragen gaat in plaats van om een ' +
    'betaalpoging.',
  'Partners (leveranciers)': 'mutaties van derden: een leverancier schrijft hier in onze gegevens.',
  'Personeel & integraties': 'ook mutaties van derden, en de integraties zijn de kant waar een ' +
    'systeem schrijft dat wij niet in de hand hebben.'
};

/* De tien die doorwerken. Ook met een reden, want "de rest" is geen indeling. */
const LOOPT_DOOR = {
  'RTG-Backoffice': 'dit is de hand die repareert en de hand die deze stand weer opheft. Die ' +
    'bevriezen zou de noodstand een deur zonder klink maken.',
  'Leden (RTG-app)': 'een lid dat zijn eigen reis bijwerkt, is geen derde partij en geen voorrecht.',
  'Diensten (leden)': 'zelfde reden.',
  'Sociaal (De Salon)': 'zelfde reden, en een besloten netwerk stilzetten is zichtbaar zonder iets ' +
    'te beschermen.',
  'Genres & diensten': 'de inrichting van een dienst raakt geen rechten en geen geld.',
  'Eigen apps': 'de apps zelf zijn schil; wat eronder wel bevriest, bevriest daar.',
  'RTFoundation': 'de foundation kent geen eigen rechten- of betaalpad; die lopen via de twee ' +
    'geldcategorieën hierboven en bevriezen dus daar.',
  'Cultuur en gezelschap': 'gezelschap en cultuur bewegen geen rechten en geen geld.',
  'Winkel en media': 'een bestelling raakt geld pas bij het betalen, en dat bevriest hierboven.',
  'Festival': 'terrein, diensten en gastzicht bewegen geen rechten en geen geld; kaartverkoop raakt geld pas bij het betalen, en dat bevriest in de geldcategorieën.',
  'Werk (zaken en personeel)': 'een zaak die zijn eigen bestellingen bijwerkt, is de eigenaar van ' +
    'die gegevens en geen derde. Wie er van buiten in schrijft, doet dat via "Partners".'
};

/* De uitzonderingen: functies in een BEVROREN categorie die toch doorlopen.
   Vier stuks, en elke reden is een vorm van "stilzetten kost meer dan de
   storing" -- de zin waar grens 6.10 op rust. */
const UITZONDERINGEN = {
  'tg-inlog': 'inloggen is geen nieuw voorrecht maar de deur naar het lezen. Wie dit bevriest, ' +
    'zet ook het lezen stil en heeft dan isolatie gebouwd met een andere naam.',
  'dom-veiligheid': 'veiligheidsdiensten. Een hulpdienst stilzetten om een incident in te dammen, ' +
    'is de ruil die 6.10 verbiedt.',
  'dom-kmar': 'grensdiensten, om dezelfde reden.',
  'dom-foutmelder': 'dit is het kanaal waarlangs wij hóren dat er iets mis is. Hem dichtzetten ' +
    'tijdens een incident is de meter uitzetten omdat hij slecht nieuws geeft.',
  'supplier-haccp': 'het temperatuurlogboek van een keuken is een WETTELIJKE registratieplicht. ' +
    'Hem stilzetten omdat RTG een incident heeft, verplaatst onze storing naar de administratie van ' +
    'een ander -- en die schade is niet terug te draaien als het incident voorbij is. Gemeten: ' +
    'onder `beschermd` stond geen enkel zaak-verhaal op "werkt", en dit is het enige waar een WET ' +
    'aan hangt. Afrekenen blijft met opzet dicht: dat beweegt geld, en dat is precies wat een ' +
    'gesloten stand hoort te stoppen.'
};

/* WAT ER PER ONDERDEEL WEL EN NIET DOORLOOPT, en waar dat werkelijk wordt
   afgedwongen. Grens 6.10 noemt vijf dingen; vier daarvan staan hieronder met
   een plek in de code, en de vijfde staat er met `nietAfgedwongen` en de reden.
   Een onderdeel dat alleen in een document staat, hoort niet als geregeld te
   lezen in het antwoord van een server. */
function onderdelen({ zegel }) {
  return [
    { wat: 'lezen', stand: 'loopt door',
      hoe: 'een GET wordt in geen enkele categorie tegengehouden, en in de tien doorlopende ' +
        'categorieën loopt ook het schrijven door.',
      afgedwongen: 'server/middleware/functieschakelaars.js roept houdtTegen() aan',
      let: 'in dit huis is veel lezen een POST (3728 POST-routes tegenover 35 GET-routes). Binnen ' +
        'de zes bevroren categorieën wordt dat lezen dus ook tegengehouden. Dat is een gemeten ' +
        'kost en geen bijwerking: de prijs van deze stand is dat je tijdens een incident je ' +
        'betaalhistorie niet opvraagt.' },
    { wat: 'mutaties van derden', stand: 'bevroren',
      hoe: 'de categorieën "Partners (leveranciers)" en "Personeel & integraties" nemen niets ' +
        'meer aan behalve een GET.',
      afgedwongen: 'server/middleware/functieschakelaars.js roept houdtTegen() aan' },
    { wat: 'nieuwe bevoorrechte handelingen', stand: 'tegengehouden',
      hoe: 'de vier categorieën rond identiteit, rechten en geld nemen niets meer aan behalve ' +
        'een GET en de vier uitzonderingen.',
      afgedwongen: 'server/middleware/functieschakelaars.js roept houdtTegen() aan',
      uitzonderingen: Object.keys(UITZONDERINGEN) },
    { wat: 'bewijs veiligstellen', stand: 'gedaan bij het omzetten',
      hoe: 'bij het aanzetten wordt de hashketen van het journaal nagelopen en de uitslag als ' +
        'zegel bewaard. Vanaf dat punt is aantoonbaar of er nog iets aan de historie is veranderd.',
      afgedwongen: 'kern/incidentcontrole.js/bescherm() roept journaal.controleer() aan',
      gemeten: zegel || null,
      let: 'dit ZET het bewijs vast, het KOPIEERT het niet naar buiten. Wie de schijf heeft, heeft ' +
        'ook het zegel. Een tweede bewaarplaats buiten dit huis is een eigen besluit met een ' +
        'eigen prijs en staat hier niet als geregeld.' },
    { wat: 'sleutels roteren', stand: 'niet',
      hoe: null,
      nietAfgedwongen: 'er bestaat geen rotatiemechanisme voor secret.key en vault.key. Die ' +
        'sleutels versleutelen bestaande rijen; roteren betekent alles opnieuw versleutelen, en ' +
        'dat is een migratie en geen noodhandeling. Grens 6.10 noemt het, deze stand doet het ' +
        'niet, en dat staat hier zodat niemand denkt van wel.' }
  ];
}

module.exports = { BEVRIEST, LOOPT_DOOR, UITZONDERINGEN, onderdelen };
