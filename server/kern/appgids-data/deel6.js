/* App-gids data, deel6, eerste helft. Zie ../appgids.js voor de uitleg;
   nieuwe pagina's krijgen hier (of in het passende deel) een eigen entry. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

/* Opgeknipt op de 10 kB-grens: het vervolg staat in ./deel6b.js. De knip zit
   op een entry-grens en niet op een onderwerp -- een gidslijst is een lijst.
   Dat dit bestand er tot vandaag OVERHEEN ging kwam niet doordat niemand
   keek, maar doordat scripts/check.js deze hele map oversloeg: de mapfilter
   matchte 'data' als deelstring, en 'appgids-data' bevat dat. Sinds die
   reparatie ziet de check hem wel. */
module.exports = Object.assign({
  '/apps/muziek.html': G('RTG Sound: muziek voor je dag, samengesteld zonder gejaag.',
    ['Kies een sfeer of kanaal', 'Speel af en bedien vanaf elk scherm', 'Bewaar wat je mooi vindt'],
    'Muziek zonder eindeloos scrollen: kies één sfeer en laat hem gewoon spelen.'),
  '/apps/theater.html': G('RTG Theater: de videobibliotheek op bioscoopniveau, tot 4K zonder hercompressie.',
    ['Kies een kanaal of titel', 'Kijk in de kwaliteit die je verbinding aankan', 'Reageer op titels waar dat open staat'],
    'Alles is vooraf goedgekeurd door het kantoor; daarom vind je hier geen ruis.'),
  '/apps/clips.html': G('RTG Clips: korte video\'s van leden; jouw clips blijven op jouw toestel.',
    ['Bekijk de eindige dagselectie', 'Maak zelf een clip; hij blijft lokaal bij jou', 'Deel bewust, niet automatisch'],
    'De selectie is bewust eindig: als hij op is, is hij op. Geen oneindige scroll.'),
  '/apps/klankwerk.html': G('RTG Klankwerk: zelf muziek maken, met een raster, een notenrol en Rahul erbij.',
    ['Zet een figuur in het raster of laat Rahul iets neerzetten',
     'Bewerk het: elke noot is van jou en alles is terug te draaien',
     'Noem het klaar en zet het onder je eigen clip, of neem het mee als bestand'],
    'Elke klank wordt door de app zelf opgewekt. Daarom zit er geen licentie van iemand anders in wat je maakt, en mag het onder je eigen clip.'),
  '/apps/zaal.html': G('De Zaal: waar de muziek te horen is die leden in RTG Klankwerk gemaakt hebben.',
    ['Luister; wat je hoort rekent je eigen toestel uit',
     'Zeg "mooi" of schrijf er iets bij',
     'Filter op wat onder de RTG-naam uitkwam, of op je eigen werk'],
    'Er is geen hitlijst en geen aanbevolen volgorde: wie bovenaan staat, staat daar omdat hij de laatste was.'),
  '/apps/agenda.html': G('RTG Agenda: een echte kalender; maand, week en lijst.',
    ['Plan zelf, of zeg het Rahul in gewone taal ("lunch vrijdag 12:30")',
     'Nodig uit op codenaam; de ander zegt ja of nee en jij ziet de stand',
     'Exporteer als .ics; dat opent in elke agenda ter wereld'],
    'Je RTG-boekingen staan er vanzelf in, goudgemarkeerd en alleen-lezen: de agenda leest RTG, hij herschrijft RTG niet.'),
  '/apps/notities.html': G('RTG Notities & Taken: het bord dat elke dag opengaat.',
    ['Zet een notitie of een lijst met vinkjes op het bord; vastpinnen zet bovenaan',
     'Deel op codenaam en werk samen: de ander vinkt af en vult aan',
     'Geef een notitie een datum en tijd; er komt vanzelf een gekoppelde afspraak in RTG Agenda'],
    'Het archief is de la, niet de prullenbak: niets verdwijnt stiekem.'),
  '/apps/bestanden.html': G('RTG Bestanden: de versleutelde kluis voor alles wat je bewaren wilt.',
    ['Sleep bestanden naar het scherm of druk op Upload; mappen houden het overzichtelijk',
     'Deel op codenaam: de ander kijkt en plaatst nieuwe versies, de kluis blijft van jou',
     'Elke nieuwe versie bewaart de oude; terugzetten kan altijd'],
    'De prullenbak bewaart 30 dagen en telt eerlijk mee voor je quotum: weg is pas weg als jij dat zegt.'),
  '/apps/meet.html': G('RTG Meet: vergaderen op codenaam, met scherm delen.',
    ['Maak een kamer of kom binnen met de zes-tekens code',
     'Deel je scherm met een knop; je camera komt vanzelf terug als je stopt',
     'Op een agenda-afspraak staat een Vergaderruimte-knop: de uitnodiging is de sleutel'],
    'Beeld en geluid lopen rechtstreeks tussen de toestellen; de server geeft alleen seinen door en ziet het gesprek zelf nooit.'),
  '/apps/galerij.html': G('RTG Galerij: al je beelden op een plek, de tijdlijn is de kalender.',
    ['Blader per maand; je Salon-posts en de beelden uit Bestanden staan er vanzelf in',
     'Zet een ster op wat je lief is en bouw albums; dat zijn verwijzingen, geen kopieen',
     'Open een beeld voor de kijker: bladeren, favoriet en de diavoorstelling'],
    'Geen gezichtsherkenning en geen slimme sortering: de galerij kijkt niet naar je foto\'s, hij toont ze alleen.'),
  '/apps/gereedschap.html': G('RTG Gereedschap: de dagelijkse basics, op huisniveau.',
    ['Reken met de eigen rekenmachine; btw en rekening delen zitten ernaast',
     'Zet wekkers en timers: de SERVER telt af, dus ook met de app dicht gaat het alarm af',
     'Stopwatch met rondes en een wereldklok waar de zomertijd vanzelf klopt'],
    'Zeg het ook gewoon tegen Rahul: "maak me morgen om 7 uur wakker" is een aanroep, geen kunstje.'),
  '/apps/podium.html': G('RTG Podium: het eigen live-streamingkanaal (18+, met verificatie).',
    ['Kijk live streams van makers', 'Steun een maker met een cadeau via RTG Pay', 'Abonneer op wie je vaker wilt zien'],
    'Cadeaus zijn echt geld: de app vraagt altijd eerst een bevestiging.'),
  '/apps/camera.html': G('RTG Camera: foto\'s maken en nabewerken in de eigen studio.',
    ['Maak een foto met de zoeker', 'Bewerk in de studio: licht, kleur, kader', 'Bewaar of deel bewust'],
    'De beste bewerking is licht: probeer eerst de belichting voor je naar filters grijpt.')
}, require('./deel6b'));
