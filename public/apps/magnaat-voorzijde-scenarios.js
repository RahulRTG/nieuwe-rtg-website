(function(){
'use strict';
window.RTGMagnaatVoorzijdeScenarios={
  operatie:{
    vraag:'De werkvloer loopt vol. Wat doet u?',
    situatie:'De vraag loopt op. Twee onderdelen van de operatie hebben tegelijk versterking nodig.',
    keuzes:[
      {titel:"Extra collega's oproepen",sub:'Meer rust · hogere kosten',score:86,klant:'Wachttijd 8 min korter',team:'Werkdruk beheersbaar',kosten:'€ 620 hoger',waarom:'U koos eerst voor mensen en continuïteit. Daardoor bleef de dienstverlening op niveau tijdens de piek.'},
      {titel:'Aanbod tijdelijk verkleinen',sub:'Sneller · minder keuze',score:78,klant:'Sneller geholpen',team:'Werkdruk daalt',kosten:'Binnen budget',waarom:'U maakte de operatie eenvoudiger. Dat gaf het team snelheid, maar beperkte tijdelijk de keuze voor klanten.'},
      {titel:'Vraag over de avond spreiden',sub:'Meer grip · klant wacht langer',score:71,klant:'Wachttijd 14 min langer',team:'Planning stabiel',kosten:'€ 180 lager',waarom:'U beschermde capaciteit en kosten. Een duidelijker bericht aan wachtende klanten zou deze keuze sterker maken.'}
    ]
  },
  planning:{
    vraag:'De planning verandert. Waar begint u?',
    situatie:'Een lopend dossier raakt meerdere mensen en afspraken. Eén rustige volgorde voorkomt dubbel werk.',
    keuzes:[
      {titel:'Eerst gevolgen controleren',sub:'Rustiger · minder herstelwerk',score:91,klant:'Belofte blijft helder',team:'Eén gedeelde planning',kosten:'Onnodige kosten voorkomen',waarom:'U controleerde eerst de afhankelijkheden. Daardoor kon iedereen vanuit dezelfde betrouwbare planning verder.'},
      {titel:'Meteen alles aanpassen',sub:'Snel · grotere herstelkans',score:64,klant:'Snel eerste antwoord',team:'Meer correctiewerk',kosten:'Mogelijke dubbeling',waarom:'U koos snelheid, maar zonder ketencontrole ontstaat extra herstelwerk. Een korte controle vooraf maakt deze aanpak sterker.'},
      {titel:'Eerst overdragen',sub:'Meer ogen · minder eigenaarschap',score:72,klant:'Antwoord later',team:'Extra overdracht',kosten:'Geen direct effect',waarom:'U betrok het team, maar hield het eigenaarschap nog niet scherp genoeg. Wijs bij overdracht altijd één verantwoordelijke aan.'}
    ]
  },
  controle:{
    vraag:'Een signaal wijkt af. Wat doet u eerst?',
    situatie:'Een synthetisch dossier valt buiten het normale patroon. Onderzoek zorgvuldig zonder direct te oordelen.',
    keuzes:[
      {titel:'Signaal gecontroleerd onderzoeken',sub:'Zorgvuldig · uitlegbaar',score:93,klant:'Niet onnodig geblokkeerd',team:'Duidelijk onderzoekspad',kosten:'Beheersbaar',waarom:'U behandelde het signaal als aanleiding voor onderzoek, niet als oordeel. Dat beschermt mensen én de controle.'},
      {titel:'Dossier direct blokkeren',sub:'Streng · weinig context',score:57,klant:'Onnodige blokkade mogelijk',team:'Snelle interventie',kosten:'Herstelwerk waarschijnlijk',waarom:'U beperkte het risico snel, maar sloeg de gecontroleerde beoordeling over. Onderzoek eerst wat het signaal werkelijk betekent.'},
      {titel:'Signaal bewaren voor later',sub:'Rustig · risico blijft open',score:61,klant:'Geen direct effect',team:'Open risico blijft staan',kosten:'Mogelijke vervolgschade',waarom:'U voorkwam een overhaaste actie, maar liet het signaal zonder eigenaar achter. Plan direct een gecontroleerd vervolg.'}
    ]
  },
  gesprek:{
    vraag:'De klant vraagt om hulp. Hoe opent u?',
    situatie:'De vraag is urgent, maar nog niet volledig duidelijk. Een goede eerste reactie geeft rust zonder onnodige gegevens.',
    keuzes:[
      {titel:'Bevestigen en één vraag stellen',sub:'Menselijk · doelgericht',score:90,klant:'Voelt zich gehoord',team:'Vraag direct duidelijker',kosten:'Minder herstelcontact',waarom:'U gaf eerst erkenning en stelde daarna precies één gerichte vraag. Zo ontstaat snelheid zonder informatie-overlast.'},
      {titel:'Een standaardantwoord sturen',sub:'Snel · weinig persoonlijk',score:66,klant:'Antwoord niet compleet',team:'Kans op vervolgcontact',kosten:'Extra behandeltijd',waarom:'U antwoordde snel, maar nog niet op de echte situatie. Eén persoonlijke controlevraag had veel vervolgwerk voorkomen.'},
      {titel:'Alle gegevens opvragen',sub:'Compleet · niet minimaal',score:52,klant:'Deelt te veel informatie',team:'Veel gegevens te beoordelen',kosten:'Meer behandeltijd',waarom:'U zocht volledigheid, maar vroeg meer dan nodig. Begin met de kleinste hoeveelheid informatie die de volgende stap mogelijk maakt.'}
    ]
  },
  impact:{
    vraag:'Een buurtkans dient zich aan. Wat kiest u eerst?',
    situatie:'Er is enthousiasme voor een nieuw initiatief. De doelgroep moet er aantoonbaar iets aan hebben.',
    keuzes:[
      {titel:'Eerst het concrete probleem kiezen',sub:'Meetbaar · dichtbij mensen',score:92,klant:'Behoefte wordt leidend',team:'Heldere proefopzet',kosten:'Klein beginnen',waarom:'U begon bij de mensen en het probleem dat zij werkelijk ervaren. Daardoor wordt de proef kleiner, eerlijker en beter meetbaar.'},
      {titel:'Meteen breed lanceren',sub:'Veel bereik · weinig bewijs',score:55,klant:'Niet voor iedereen passend',team:'Veel tegelijk organiseren',kosten:'Hoge startkosten',waarom:'U koos bereik voordat het effect bewezen was. Een kleine lokale proef geeft betere informatie en beperkt verspilling.'},
      {titel:'Eerst een campagne maken',sub:'Zichtbaar · oplossing nog open',score:62,klant:'Verwachting ontstaat vroeg',team:'Doel nog onduidelijk',kosten:'Communicatie voor bewijs',waarom:'U maakte de kans zichtbaar, maar nog vóór het probleem scherp was. Laat communicatie volgen op een toetsbare aanpak.'}
    ]
  },
  puzzel:{
    vraag:'Een gebruiker loopt vast. Wat verbetert u?',
    situatie:'Twee bestaande stappen sluiten niet goed op elkaar aan. De kleinste begrijpelijke verbetering kan het proces herstellen.',
    keuzes:[
      {titel:'Eerst het gebruikersdoel vaststellen',sub:'Gericht · minder aannames',score:89,klant:'Taak wordt begrijpelijker',team:'Klein verbeterpad',kosten:'Beperkte test nodig',waarom:'U begon bij wat iemand probeert te bereiken. Daardoor kan de oplossing klein blijven en precies op de frictie aangrijpen.'},
      {titel:'Meer functies toevoegen',sub:'Veel mogelijkheden · meer drukte',score:58,klant:'Meer om te begrijpen',team:'Grotere bouwopgave',kosten:'Hogere ontwikkelkosten',waarom:'U voegde mogelijkheden toe voordat de oorzaak duidelijk was. Los eerst het kleinste aantoonbare knelpunt op.'},
      {titel:'De foutmelding verbergen',sub:'Rustig beeld · probleem blijft',score:43,klant:'Loopt nog steeds vast',team:'Minder zichtbaar bewijs',kosten:'Herstel komt later terug',waarom:'U maakte het scherm rustiger, maar niet de taak. Een goed herstelmoment helpt de gebruiker werkelijk verder.'}
    ]
  }
};
})();
