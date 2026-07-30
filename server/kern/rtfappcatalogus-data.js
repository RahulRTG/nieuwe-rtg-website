/* De ECHTE RTF App-Bibliotheek: geen twintigduizend verzonnen namen meer, maar
   de apps die werkelijk in de RTFoundation draaien. Elke tegel opent een
   bestaande, werkende pagina. Alles is en blijft gratis: een cadeau van de
   RTFoundation. Geen aankopen, geen reclame, geen verslavende trucjes.

   Dit is pure data; de motor (kern/rtfbieb.js) toont, doorzoekt en installeert
   ze, met de leeftijdspoort van het profiel. Nieuwe RTF-pagina's krijgen hier
   gewoon een regel.

   [id, naam, categorie, doelgroep, url, uitleg]
   doelgroep: mini (0-5), kind (6-11), tiener (12+) of gezin (iedereen). */

const CATEGORIEEN = [
  { id: 'leren', label: 'Leren & school', icon: 'diploma' },
  { id: 'creatief', label: 'Maken & ontdekken', icon: 'ontwerp' },
  { id: 'gezin', label: 'Samen in het gezin', icon: 'maison' },
  { id: 'gevoel', label: 'Gevoelens & steun', icon: 'hart' },
  { id: 'geld', label: 'Geld & later', icon: 'rekening' },
  { id: 'veilig', label: 'Veilig & gezond', icon: 'schild' },
  { id: 'bieb', label: 'Bibliotheken', icon: 'ontdek' }
];

const R = [
  // ---- leren & school ----
  ['leren', 'Leren', 'leren', 'kind', '/apps/foundation/leren.html', 'Oefenen en samen leren, in je eigen tempo.'],
  ['overhoren', 'Overhoren', 'leren', 'kind', '/apps/foundation/overhoren.html', 'Woordjes en sommen overhoren; alleen of als duel met een vriend.'],
  ['school', 'School', 'leren', 'kind', '/apps/foundation/school.html', 'Klas, rooster, huiswerk en cijfers voor het hele gezin.'],
  ['schrift', 'Schrift', 'leren', 'kind', '/apps/foundation/schrift.html', 'Je eigen schrift: aantekeningen en sommen netjes bij elkaar.'],
  ['projecten', 'Samen aan een project', 'leren', 'kind', '/apps/foundation/projecten.html', 'Werkstukken en groepswerk stap voor stap, met taken en een planning.'],
  ['toetsen', 'Toetsplanner', 'leren', 'tiener', '/apps/foundation/toetsen.html', 'Je toetsweek uitgesmeerd over de dagen, zodat je niet hoeft te stampen.'],
  ['studie', 'Verder leren', 'leren', 'tiener', '/apps/foundation/studie.html', 'Opleidingen en vervolgstappen verkennen, zonder druk.'],
  ['presenteren', 'Spreekbeurt en presentatie', 'leren', 'tiener', '/apps/foundation/presenteren.html', 'Je verhaal opbouwen in vaste stukken, met tijdverdeling en een oefenklok.'],
  ['klas', 'Klas', 'leren', 'tiener', '/apps/foundation/klas.html', 'Het klasoverzicht: wie zit erin, wat staat er deze week op het rooster.'],

  // ---- maken & ontdekken ----
  ['schrijven', 'Schrijven', 'creatief', 'kind', '/apps/foundation/schrijven.html', 'Samen verhalen bedenken en schrijven; de app helpt met een begin.'],
  ['tellen', 'Tellen tot tien', 'creatief', 'mini', '/apps/foundation/tellen.html', 'Dingen aantikken en samen hardop tellen; geen klok, geen puntentelling.'],
  ['kleuren', 'Kleuren en vormen', 'creatief', 'mini', '/apps/foundation/kleuren.html', 'Zoek de rode cirkel: spelen op kleur, op vorm, of op allebei tegelijk.'],
  ['memorie', 'Memorie', 'creatief', 'mini', '/apps/foundation/memorie.html', 'Kaartjes omdraaien en paren zoeken, met drie, zes of acht paren.'],
  ['verhaaltje', 'Voorleesverhaaltjes', 'creatief', 'mini', '/apps/foundation/verhaaltje.html', 'Zes korte verhaaltjes om samen voor te lezen, bladzijde voor bladzijde.'],
  ['liedjes', 'Liedjes en versjes', 'creatief', 'mini', '/apps/foundation/liedjes.html', 'Oude Nederlandse liedjes met de tekst groot in beeld, om samen te zingen.'],
  ['babyboek', 'Fotoboekje', 'creatief', 'gezin', '/apps/foundation/babyboek.html', 'De eerste momenten in een boekje, met zinnen die vanzelf mooi worden.'],
  ['magazine', 'Magazine', 'creatief', 'gezin', '/apps/foundation/magazine.html', 'Het RTF-magazine: verhalen, tips en werk van gezinnen zelf.'],
  ['dromen', 'Onze dromen', 'creatief', 'gezin', '/apps/foundation/dromen.html', 'Waar het gezin van droomt, bewaard en af en toe teruggelezen.'],
  ['bord', 'Bord', 'creatief', 'gezin', '/apps/foundation/bord.html', 'Een bord met kaartjes: ideeen, plannen en wat af is.'],

  // ---- samen in het gezin ----
  ['agenda', 'Gezinsagenda', 'gezin', 'gezin', '/apps/foundation/agenda.html', 'Alle afspraken van het gezin op een rij, voor iedereen zichtbaar.'],
  ['ochtend', 'Ochtendritme', 'gezin', 'mini', '/apps/foundation/ochtend.html', 'Aankleden, tanden, jas: de ochtend in stapjes die een kleuter zelf snapt.'],
  ['klusjes', 'Klusjes en sterren', 'gezin', 'kind', '/apps/foundation/klusjes.html', 'Klusjes verdelen en sterren verdienen, zonder gedoe aan tafel.'],
  ['keuken', 'Gezinskeuken', 'gezin', 'gezin', '/apps/foundation/keuken.html', 'Wat eten we: recepten, boodschappen en de weekplanning.'],
  ['verjaardagen', 'Verjaardagen & wensen', 'gezin', 'gezin', '/apps/foundation/verjaardagen.html', 'Niemand vergeten: verjaardagen en wensenlijstjes bij elkaar.'],
  ['reis', 'Op reis', 'gezin', 'gezin', '/apps/foundation/reis.html', 'Samen op pad: inpakken, plannen en onderweg iets te doen.'],
  ['vrienden', 'Contacten', 'gezin', 'kind', '/apps/foundation/vrienden.html', 'Vrienden, snaps en verhalen van 24 uur, veilig en op codenaam.'],
  ['markt', 'Koopje', 'gezin', 'gezin', '/apps/foundation/markt.html', 'Ruilen, weggeven en delen in de buurt.'],
  ['opvoeden', 'Opvoedhulp', 'gezin', 'gezin', '/apps/foundation/opvoeden.html', 'Rustige hulp bij het gedoe van elke dag, zonder oordeel.'],
  ['club', 'Clubportaal', 'gezin', 'gezin', '/apps/foundation/club.html', 'De club om de hoek: activiteiten, leden en aanmelden.'],

  // ---- gevoelens & steun ----
  ['gevoel', 'Hoe voel je je?', 'gevoel', 'mini', '/apps/foundation/gevoel.html', 'Tik het gezichtje aan dat bij je past; er wordt niets opgeslagen.'],
  ['rust', 'Even rust', 'gevoel', 'kind', '/apps/foundation/rust.html', 'Een stille plek in de app als het te druk wordt in je hoofd.'],
  ['pesten', 'Sterker dan pesten', 'gevoel', 'kind', '/apps/foundation/pesten.html', 'Wat je kunt doen als je gepest wordt, en bij wie je terechtkunt.'],
  ['kompas', 'Kompas', 'gevoel', 'tiener', '/apps/foundation/kompas.html', 'Het tienerkompas: koers houden als alles tegelijk komt.'],
  ['steun', 'Steun voor jou', 'gevoel', 'tiener', '/apps/foundation/steun.html', 'Een luisterend oor en echte hulplijnen, altijd bereikbaar.'],
  ['hulpwijzer', 'Hulpwijzer', 'gevoel', 'gezin', '/apps/foundation/hulpwijzer.html', 'Welke hulp bestaat er, en waar klop je aan? Alles op een rij.'],

  // ---- geld & later ----
  ['zakgeld', 'Zakgeld', 'geld', 'kind', '/apps/foundation/zakgeld.html', 'Het zakgeldpotje: sparen voor iets, samen bijgehouden.'],
  ['geld', 'Geldmaatje', 'geld', 'kind', '/apps/foundation/geld.html', 'Snappen wat geld is en wat dingen kosten, spelenderwijs.'],
  ['cv', 'CV-maker', 'geld', 'tiener', '/apps/foundation/cv.html', 'Je eerste cv, in nette zinnen, klaar om te versturen.'],
  ['werk', 'Werk en vacatures', 'geld', 'tiener', '/apps/foundation/werk.html', 'Bijbanen en vacatures, met een sollicitatie die je zelf kunt volgen.'],
  ['budget', 'Maandbegroting', 'geld', 'tiener', '/apps/foundation/budget.html', 'Wat komt binnen, wat gaat eruit, wat houd je over; rekent mee terwijl je typt.'],
  ['rechten', 'Wat mag ik op welke leeftijd', 'geld', 'tiener', '/apps/foundation/rechten.html', 'Werken, geld, school en zorg per leeftijd, met de werktijden erbij.'],

  // ---- veilig & gezond ----
  ['veilig', 'Veilig thuis', 'veilig', 'gezin', '/apps/foundation/veilig.html', 'Online en thuis veilig: afspraken die werken voor kind en ouder.'],
  ['gezondheid', 'Gezondheidsmaatje', 'veilig', 'gezin', '/apps/foundation/gezondheid.html', 'Het gezondheidsboekje van het gezin, rustig bijgehouden.'],
  ['privacy', 'Privacy', 'veilig', 'gezin', '/apps/foundation/privacy.html', 'Wat er met jullie gegevens gebeurt, in gewone woorden.'],
  ['mediawijs', 'Online wijs', 'veilig', 'tiener', '/apps/foundation/mediawijs.html', 'Echte situaties van je telefoon, met eerlijke uitleg over wat je keuze oplevert.'],

  // ---- bibliotheken ----
  ['schoolbieb', 'School-Bibliotheek', 'bieb', 'kind', '/apps/foundation/schoolbieb.html', 'Lesmateriaal en oefenstof per vak en per jaar.'],
  ['beroepen', 'Beroepen-Bibliotheek', 'bieb', 'tiener', '/apps/foundation/beroepen.html', 'Wat je later kunt worden: honderden beroepen, eerlijk beschreven.'],
  ['geloofbieb', 'Geloof & Wijsheid', 'bieb', 'gezin', '/apps/foundation/geloofbieb.html', 'Alle tradities als gelijken naast elkaar, met echte leesbare teksten.']
];

module.exports = { CATEGORIEEN, R };
