/* App-gids data, deel1 (de leden-apps, eerste helft; het vervolg staat in
   deel6). Zie ../appgids.js voor de uitleg; nieuwe pagina's krijgen hier (of in
   het passende deel) een eigen entry. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = Object.assign({
  /* ---- het leden-OS en de leden-apps (RTG-toon: ingetogen, je/jij) ---- */
  /* Er is nog maar EEN beginscherm. /apps/index.html (het scrollende
     bureaublad) en /apps/bureau.html brengen je allebei hier; ze houden een
     entry omdat de gids op pad zoekt en een oude link niets mag opleveren. */
  '/apps/app.html': G('Je homescreen: mappen boven de klok, bellen en je wallet eronder, Rahul in de balk.',
    ['Tik een app; omhoog vegen op het streepje onderin brengt je terug op de homescreen', 'Typ in de balk onderaan: het OS doet het zelf of Rahul pakt het op', 'Je ledenpas ligt in je wallet, de tegel rechts onder de klok'],
    'Je echte naam blijft in de kluis; partners zien alleen je codenaam. Dat is bewust ons ontwerp.'),
  '/apps/index.html': G('De homescreen (dit pad brengt je daarheen).',
    ['Tik een app; omhoog vegen op het streepje onderin brengt je terug',
      'Bewaar liever / als bladwijzer: dit pad is een doorverwijzing en geen eigen scherm'],
    'Het scrollende bureaublad met alle apps in secties bestaat niet meer: een OS heeft een beginscherm, geen tweede.'),
  '/apps/bureau.html': G('De homescreen (dit pad brengt je daarheen).',
    ['Tik een app; omhoog vegen op het streepje onderin brengt je terug',
      'Kom je hier via een oude link of bladwijzer, vervang die dan door /'],
    'Een oude ingang uit de tijd dat er nog een apart bureaublad was.'),
  /* comm.html en berichten.html zijn HETZELFDE scherm: comm is de ene app
     waar Berichten, Bellen, Videobellen, Snaps en Meet in zijn opgegaan, en
     berichten.html is de oude naam die er nog heen wijst. Twee ingangen, dus
     twee sleutels -- maar de uitleg mag niet uiteenlopen, dus hij staat er
     letterlijk twee keer met hetzelfde verhaal. */
  '/apps/comm.html': G('Berichten: al je contact in een app. Sturen, bellen, videobellen, snaps en afspraken in een gesprekslijst.',
    ['Open een gesprek en kies daar wat het wordt: tekst, bellen of videobellen', 'Deel een snap of plan een afspraak vanuit hetzelfde gesprek', 'Zoek op codenaam om een nieuw gesprek te beginnen'],
    'Contact met iemand is EEN ding, geen vier apps: alles van dezelfde persoon staat in hetzelfde gesprek, ook wat vroeger in Bellen of Snaps woonde.'),
  '/apps/berichten.html': G('Je berichten met vrienden en partners, automatisch vertaald als dat nodig is.',
    ['Stuur een bericht op codenaam', 'Bel of videobel vanuit het gesprek', 'Deel een snap of verhaal met wie jij kiest'],
    'Berichten in een andere taal worden voor je vertaald; jij leest en schrijft gewoon in je eigen taal.'),
  '/apps/genootschap.html': G('Genootschap: je besloten groepen binnen RTG, met een prikbord en bijeenkomsten.',
    ['Richt er een op en kies wie erbij mag: openbaar, besloten of geheim', 'Zet iets op het prikbord, of stel een peiling voor met een paar keuzes', 'Roep een bijeenkomst uit en zie wie ja, misschien of nee zegt'],
    'Geheim is hier echt geheim: zo\'n genootschap staat in geen enkele lijst en is alleen met een uitnodiging te vinden.'),
  '/apps/metier.html': G('Métier: je vak binnen RTG. Een beroepsprofiel op je codenaam, met de rollen die RTG echt heeft gezien.',
    ['Vul je beroepskop in en zet erbij wat je doet; je RTG-rollen staan er al bij, bevestigd', 'Geef je naam vrij aan een werkgever als je ergens op solliciteert, en trek hem daarna weer in', 'Laat Rahul meekijken naar je profiel, een brief opstellen of een gesprek met je oefenen'],
    'Je naam is hier een sleutel, geen veld op een pagina: je geeft hem per werkgever, en je ziet altijd wie hem heeft bekeken.'),
  '/apps/salon.html': G('De Salon: het besloten sociale netwerk van RTG. Leden en partners plaatsen hier zelf, op codenaam.',
    ['Plaats een bericht met een of meer foto\'s; geef elke foto een korte beschrijving voor wie niet ziet', 'Volg leden en partners die je wilt blijven zien, en bewaar posts voor jezelf', 'Vraag Rahul om een bijschrift of om de reacties samen te vatten; jij drukt zelf op plaatsen'],
    'Je bepaalt zelf wie op je post mag reageren, en verbergen is prive: alleen jij ziet die post niet meer.'),
  '/apps/rtmail.html': G('RTG Mail: je eigen postvak binnen RTG, op je codenaam. Post lezen en schrijven, opbergen, zoeken en gesprekken volgen.',
    ['Wissel van map met de balk bovenaan: postvak in, archief, prullenbak en verzonden -- opbergen is een MAP, je post is nooit weg omdat je op een knop drukte', 'Zoek in je eigen postvak; berg op, geef een ster of laat een bericht sluimeren tot morgen', 'Open het gesprek om vraag en antwoord onder elkaar te zien, en vraag Rahul om een samenvatting: elke regel wijst terug naar het bericht waar hij vandaan komt', 'Je vindt RTG Mail ook als kanaal in de Berichten-app, tussen je andere gesprekken', 'RTG Mail bezorgt en bewaart; geld en toegang regel je altijd zelf in de bron-app'],
    'Alles op codenaam: je echte naam blijft in de kluis, ook in je post. Links en bijlagen van niet-geverifieerde afzenders blijven geblokkeerd.'),
  '/apps/pulse.html': G('Pulse: wat er nu speelt in jouw RTG-wereld, rustig gebundeld.',
    ['Lees de hoogtepunten van vandaag', 'Tik door naar de app waar iets gebeurt', 'Stel in waarover je seintjes wilt'],
    'Geen eindeloze feed: Pulse toont wat er is en houdt dan op. Dat is bewust.'),
}, require('./deel1b'));
