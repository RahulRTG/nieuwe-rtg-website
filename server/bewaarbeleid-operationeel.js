/* BEWAARTERMIJNEN, deel "operationeel": weg zodra het zijn doel heeft gediend.

   Afgesplitst van ./bewaarbeleid.js toen dat over de leesgrens ging, en de knip
   loopt langs een echte naad: daar staat wat de WET voorschrijft en wat een
   incident navertelbaar houdt (twee groepen die zelden veranderen), hier staat
   wat een domein nodig heeft zolang het iets doet. Deze lijst groeit met elk
   domein dat erbij komt; die andere twee niet.

   De uitleg over het geheel -- waarom er termijnen zijn, waarom er standaard
   niets wordt gewist, en waarom een tak zonder termijn wordt genoemd -- staat
   in ./bewaartermijnen.js en geldt hier onverkort. */
'use strict';
const DAG = 86400000;
const JAAR = 365 * DAG;

module.exports = [
  { tak: 'applications', label: 'sollicitaties', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een jaar na indienen; daarna heeft niemand er nog iets aan' },
  { tak: 'guestChats', label: 'gastgesprekken met een zaak', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'servicegesprek over een bezoek van vorig jaar is voorbij' },
  /* De sollicitatiechats. Deze tak had NOOIT een termijn -- ook niet voor de
     verhuizing -- terwijl de sollicitatie waar hij bij hoort er wel een had
     (een jaar, hierboven). Dat is de scheefste vorm die er is: het dossier
     verloopt en het gesprek erover blijft eeuwig staan. Dezelfde termijn dus
     als de sollicitatie zelf; de berichten wonen sinds de verhuizing in
     commBerichten en verlopen op hun eigen twee jaar. */
  { tak: 'applyChats', label: 'sollicitatiegesprekken (schakel)', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'volgt de sollicitatie waar hij bij hoort' },
  /* DE GESPREKKEN VAN HET PLATFORM (kern/comm). Twee takken, want een gesprek
     en zijn berichten staan apart: commGesprekken draagt de deelnemers en het
     tijdstip van het laatste bericht, commBerichten de berichten zelf.

     Dezelfde twee jaar als de oude ledenchat hieronder, en dat is geen luiheid:
     de reden is niet veranderd doordat de opslag verhuisde. Een termijn die bij
     een verhuizing stilletjes ruimer wordt is precies hoe "we bewaren niet
     eindeloos" een dode letter wordt.

     De volgorde klopt vanzelf: `laatst` op een gesprek IS de tijd van zijn
     nieuwste bericht, dus een gesprek verloopt nooit eerder dan zijn inhoud. */
  { tak: 'commGesprekken', label: 'gesprekken (alle kanalen)', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'laatst', waarom: 'een gesprek waar twee jaar niets in gebeurde is voorbij' },
  { tak: 'commBerichten', label: 'berichten in gesprekken', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'persoonlijke berichten, maar niet eindeloos' },
  /* De oude ledenchat is sinds de verhuizing naar de kern een ARCHIEF: er komt
     niets meer bij, hij wordt niet meer gelezen. De termijn blijft er staan --
     juist omdat er niets meer bij komt, moet wat er nog in zit gewoon
     verlopen. Een bevroren voorraad zonder termijn is een voorraad die voor
     altijd blijft. */
  { tak: 'memberChats', label: 'gesprekken tussen leden (oud archief)', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'verhuisd naar commBerichten; wat er nog staat verloopt gewoon' },
  /* En de collegaberichten van de werkvloer, om dezelfde reden bevroren. Deze
     tak had NOOIT een termijn -- ook niet voor de verhuizing -- en dat viel
     niet op omdat de gatenlijst per tak kijkt en niemand hem miste. Een chat
     tussen twee collega's over de late dienst van drie jaar geleden is geen
     bedrijfsadministratie; hij verloopt. */
  { tak: 'collegaChats', label: 'collegaberichten op de werkvloer (oud archief)', dagen: 2 * JAAR / DAG,
    grond: 'nodig', vorm: 'mapVanLijsten', datum: 'at',
    waarom: 'verhuisd naar commBerichten; wat er nog staat verloopt gewoon' },
  /* De standen (gelezen tot, vastgezet, stilgezet) dragen GEEN datum en kunnen
     dus niet verlopen -- er valt ook niets aan te bewaren: het is geen inhoud
     maar een schakelaarstand per gesprek. Ze staan hier genoemd zodat de
     gatenlijst niet suggereert dat iemand ze vergeten is. */
  { tak: 'commStand', label: 'leesstanden en gesprekvlaggen', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'geen inhoud, alleen standen; volgt het gesprek' },
  { tak: 'notifications', label: 'meldingen', dagen: 180, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een melding van een half jaar oud is geen melding meer' },
  { tak: 'reports', label: 'misbruikmeldingen', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'herhaling moet zichtbaar blijven, maar niet voor altijd' },
  { tak: 'paspoortLog', label: 'paspoortcontroles', dagen: JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'aantonen dat een leeftijdscheck is gedaan' },
  /* Uitslagen van potjes: de bron onder winrate, niveaus en toernooien. Een
     jaar, en dat is een keuze met twee kanten. Korter en een seizoen past er
     niet in; langer en een partij van jaren terug bepaalt nog steeds iemands
     stand, terwijl niemand daar nog om vroeg. Deelnemers onder de
     progressiegrens staan er zonder codenaam in (kern/spellen/uitslagen.js),
     dus wat hier verloopt is de historie van volwassen leden. */
  /* Het verloop van een partij (de replay). Dertig dagen: een uitslag is een
     feit dat een jaar meegaat, een verloop is een geheugen dat je binnen een
     maand nog eens naspeelt en daarna niet meer. Aparte tak, want anders erft
     het een de termijn van het ander. */
  { tak: 'spelZetten', label: 'verloop van partijen (replay)', dagen: 30, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'alleen om je eigen partij terug te kijken; daarna heeft het geen doel meer' },
  /* Toernooien: een begrensd evenement, dus korter dan de uitslagen zelf. Wie
     het gewonnen heeft blijft als partij in spelUitslagen staan; het bord met
     de loting hoeft niet een jaar te blijven hangen. */
  { tak: 'spelToernooien', label: 'toernooien', dagen: 90, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'draagt codenamen; een afgelopen toernooi is na een kwartaal geen nieuws meer' },
  { tak: 'spelUitslagen', label: 'uitslagen van potjes', dagen: JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'draagt codenamen; een partij van meer dan een jaar terug hoeft geen stand meer te bepalen' },
  /* De dagtelling van de spellen draagt GEEN persoon: een rij is
     `{ dag, spel, potjes, spelers }`. Hij staat hier toch, en dat is met opzet:
     "er zit niemand in dus het mag blijven staan" is precies de redenering
     waarmee tellingen eeuwig worden. Twee jaar is genoeg om een seizoen met
     het vorige te vergelijken; daarna zegt een dagcijfer niets meer over een
     spel dat sindsdien is veranderd. */
  { tak: 'spelTelling', label: 'dagtelling van gespeelde potjes (geen personen)', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'alleen aantallen per spel per dag; ouder dan twee jaar is geen vergelijking meer' },
  /* Teams verlopen op `laatst` en niet op `at`: een club waarmee gespeeld wordt
     blijft bestaan, een club waar een jaar niets mee gebeurde is een restant
     met sleutels erin. Op `at` zou een actief team na een jaar verdwijnen. */
  { tak: 'spelTeams', label: 'spelteams', dagen: JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'laatst', waarom: 'draagt sleutels van de leden; een team waar een jaar niets mee gebeurde bestaat niet meer' },
  /* Stadsweefsel: gebeurtenissen verlopen, het register (db.data.weefsel) niet --
     een lantaarnpaal verloopt niet en de tijdreeksen vegen zichzelf per laag. */
  { tak: 'weefselZaken', label: 'stadszaken (openbare ruimte)', dagen: 3 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'draagt codenaam en vrije tekst van een melder' },
  { tak: 'weefselWerk', label: 'werkorders openbare ruimte', dagen: 3 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'de uitvoering; wat er is gedaan blijft in de onderhoudshistorie' },
  /* DE PLAATSLAAG (PLAATS.md). Plaats was de enige categorie die nergens in dit
     beleid stond, terwijl de positie op vier plekken tegelijk woonde met vier
     eigen bewaarregels. Dat is precies waar zonderBeleid() voor bestaat, en het
     was de langste tijd het grootste gat erin.

     De termijnen zijn kort en dat is geen zuinigheid maar het ontwerp: een
     venster hoort binnen een dienst af te lopen, en wat er buiten valt heeft
     geen doel meer. kern/plaats ruimt zelf op bij elke aanraking; dit is het
     tweede slot, voor de tak die stil blijft liggen omdat niemand hem meer
     aanraakt. */
  { tak: 'plaatsVensters', label: 'toestemmingsvensters voor plaats', dagen: 2, grond: 'nodig',
    vorm: 'lijst', datum: 'geopend', waarom: 'een venster duurt hoogstens een dienst; wat er na twee dagen nog staat is een venster dat niemand heeft gesloten' },
  { tak: 'plaatsWaarnemingen', label: 'hek-waarnemingen (binnen/buiten)', dagen: 2, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'hoort bij een venster en gaat met dat venster mee weg; dit vangt wat een gemist opruimmoment liet staan' },
  { tak: 'plaatsLog', label: 'actielog van de plaatslaag', dagen: 90, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'een lid moet kunnen navragen waarom zijn toestel iets over zijn plaats heeft gemeld; dat is de tegenhanger van de laag zelf en mag hem overleven' }
];
