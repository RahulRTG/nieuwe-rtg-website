# Saloon — levende interface en publicatielussen

Saloon is de gezamenlijke lees- en handelingslaag op `/apps/wereld.html`.
Het bestaande RTG-werkvlak en de domeinapps blijven de ingang voor identiteit,
rechten en uitvoering. Deze versie verbindt daadwerkelijk vijf bronfamilies.

| Bron | Wat verschijnt | Waar de handeling plaatsvindt |
| --- | --- | --- |
| Mensen en communities | Salon, Pulse, zakelijk prikbord, eigen genootschappen en bijeenkomsten; verhalen in Privé | Berichten plaatsen en reacties lezen/schrijven in Saloon; overige handelingen bij de bron |
| Journalistiek | Gepubliceerde artikelen uit de bestaande kranten | Artikel lezen binnen Saloon of in de krant; schrijven, corrigeren en intrekken in Redactie |
| Makers en media | De geautoriseerde selectie van Media OS | Werk openen in de bestaande stuk-hub, met dezelfde maker, mediarechten en vervolgacties |
| Zaken en plekken | Zichtbare zaken uit de bestaande Mall-gids | De zaak openen voor het actuele aanbod en de bestaande order- of boekingsstappen |
| Mijn reizen | De eigen komende reizen | Expliciet aanzetten; de reis openen voor vervolgacties |

## Eén ervaring

Voor u (Overzicht), Agenda en Bewaard delen dezelfde bronobjecten. De gebruiker kiest
bronnen, onderwerpzoekterm en plaats. Deze voorkeuren en maximaal 200 bewaarde
verwijzingen worden per account onthouden. Mijn reizen staat standaard uit.
Een bewaarde verwijzing verleent geen toegang: bronrechten en publicatiestatus
worden bij elke lezing opnieuw toegepast.

De weergave gebruikt de bestaande contextsecties; Agenda ordent op begindatum.
Publicaties worden op publicatiedatum geordend, met een stabiele ID als tweede
sorteersleutel. Zaken zonder publicatiedatum staan achter de publicaties.
Er is geen advertentieveiling, betaalde plaatsingsscore of rangschikking op
kliktijd toegevoegd. De bestaande bronselectie van Salon en Media OS blijft
van toepassing, inclusief hun eigen curatie en voorkeuren.

Elke kaart vermeldt bron, zichtbaarheid en reden van selectie. Onderwerpen
verbinden zichtbare kaarten onderling; de relatie wordt expliciet als
**gedeeld onderwerp** benoemd. Er wordt geen identiteit of feitelijke relatie
afgeleid uit vergelijkbare namen. Dit is een eerste projectie van samenhang,
geen volledige knowledge graph van RTG.

Bij verversen vergelijkt de browser inhoudsversies binnen dezelfde selectie.
Nieuwe en gewijzigde kaarten worden geteld. Ingetrokken of ontoegankelijke
publicaties verdwijnen uit de actuele resultaten, ook uit Bewaard. Dit is
wijzigingsdetectie binnen de opgehaalde selectie; geen achtergrondmonitor,
volledige historie of garantie dat iedere tussenliggende verandering is gezien.

### Mobiele Saloon en Edge

De startpagina gebruikt de goedgekeurde donkere RTG-stijl, Bodoni-koppen,
fotografie uit de bronpublicatie, een zoekveld en Voor u / Dichtbij / Bewaard.
Dichtbij gebruikt de zelfgekozen plaats, zonder een locatie te veronderstellen.
Agenda, bronnen en omgeving blijven bereikbaar via de voorkeuren en Edge.
De desktop toont dezelfde bronvolgorde in twee kolommen; er wordt geen tweede
dashboard of appcatalogus voor Saloon opgebouwd.

Een artikel opent als leesscherm binnen Saloon. De gedeelde Edge blijft daarbij
bedienbaar: Home, Werelden, Rahul, Acties en Menu. De Saloon-acties worden via
de bestaande projectie van bronknoppen aangeboden. Het menu behoudt de echte
RTG-werelden en krijgt lokaal het donkere Saloon-materiaal. In een ingebed
werkvlak blijft de Edge van de bovenliggende schil eigenaar.

Terug, browsergeschiedenis en vernieuwen werken met de leesstand. Iedere opening
vraagt de gepubliceerde editie opnieuw aan de krant, inclusief beeld en correcties.
Een laat antwoord kan een gesloten lezer niet heropenen; bronuitval geeft een
zichtbare melding met opnieuw proberen. Bewaren gebruikt dezelfde accountkeuze
vanuit de kaart, de lezer en Edge. De voorbeeldverhalen uit de ontwerptekening
worden niet in de productfeed ingevoegd.

## De lus terug naar de bron

`Maken` biedt een echte Salon-publicatie met publiekskeuze en plaats, plus
werkruimtes voor media, journalistiek, communities en ondernemingen. Er wordt
geen tweede publicatieregister aangelegd. Lezen en reageren gebruiken de
bestaande domeinroutes; boekingen, betalingen en leveringen blijven bij hun
bestaande eigenaar. Een knop naar een zaak is geen bevestigde bestelling.

Getoetste journalistieke lus: concept → publicatie → zichtbaar in Saloon →
lezen → bewaren → correctie met nieuwe inhoudsversie → intrekking → verdwenen
uit Saloon en onleesbaar via de artikelroute. Getoetste sociale lus: plaatsen
met doelgroep → geautoriseerd lezen → reageren → bewaren → filteren en opnieuw
openen → verbergen.

### Redactionele werkversie en gepubliceerde editie

De bestaande Redactie heeft nu een interne werkversie, research- en
verificatienotities, de werkstand Eindredactie en een publicatiehistorie.
Bewaren of naar eindredactie sturen verandert een live artikel niet. Alleen
Publiceren vervangt de gepubliceerde editie. Krant en Saloon lezen diezelfde
editie; interne notities, werkhistorie en personeels-ID's gaan niet mee.

Een correctie of herpublicatie vraagt een openbare toelichting. Die verschijnt
bij het artikel in zowel de krant als Saloon, met editienummer en datums. De
oorspronkelijke publicatiedatum en auteur blijven behouden; de handelende
redacteur staat in de interne historie. Ook een correctie van uitsluitend de
artikeltekst verandert de Saloon-inhoudsversie. Intrekken sluit onmiddellijk
de publieke leesroute en de Saloon-projectie.

De editor stuurt de gelezen werkversie mee bij bewaren, publiceren en intrekken.
Een achterhaalde versie levert een conflictmelding op. Bestaande API-clients
zonder versienummer blijven compatibel; deze bescherming geldt voor opdrachten
die een versienummer meesturen. Oude live artikelen blijven leesbaar en krijgen
bij hun eerste bewerking een afzonderlijke gepubliceerde editie.

De laatste 100 werkhandelingen en de laatste 100 openbare correctietoelichtingen
blijven bij het bronartikel. Dit is een publicatiehistorie, geen volledig archief
van iedere tekstversie. Bij 500 artikelen weigert de redactie nieuwe stukken in
plaats van het oudste artikel stil te verwijderen. Eindredactie is een werkstand
voor de bestaande bevoegde redactie; onafhankelijke goedkeuring door een tweede
persoon, embargo's en automatische publicatieplanning zijn nog niet gebouwd.

### Creator en publiek

Bij werk uit Clips en Theater kan de lezer de maker direct gratis volgen of
ontvolgen. Saloon gebruikt de bestaande Media-OS-handeling en leest de volgstand
terug uit de bron. De relatie is zichtbaar op het makersbord. Eigen werk krijgt
geen volgknop. Deze handeling verandert geen betaald Podium-abonnement.
Creatoropdrachten, overdracht van gebruiksrechten en afrekening vragen nog hun
eigen uitvoerlus.

## Architectuur

- `server/kern/wereld/saloon/bronnen.js` adapteert bestaande bronlezers. Nieuwe
  bronfamilies krijgen hier een expliciete adapter en toegangstoetsen.
- `server/kern/wereld/saloon/index.js` projecteert, filtert en ordent; meldt
  uitgevallen bronnen afzonderlijk. Geen contentkopieën in de database.
- `voorkeur.js` valideert persoonlijke keuzes. Opslag wordt ingebracht door de
  bestaande samenstelling; het algoritme heeft geen eigen database-ingang.
- De bestaande `/api/wereld/state`, `/modus` en `/feed` zijn uitgebreid. De
  Saloon-weergave vraagt `/feed` met `ervaring: 'saloon'`. Bestaande aanroepers
  behouden de bestaande responsevorm.
- `public/apps/saloon/` bevat bediening, kaarten en bronacties. De bestaande
  `wereld.html` blijft de schermeigenaar. Het ingebedde werkvlak gebruikt
  `/apps/wereld.html?embed=1`.

De sociale bron begrenst de opgehaalde selectie op 300 regels en meldt dat.
Media OS levert zijn eigen begrensde selectie. Saloon retourneert 30 kaarten
per pagina. Deze laag vervangt het bestaande Salon-venster van 2000 berichten
niet door een duurzaam archief. De datum van een reis blijft een datum als de
bron geen tijd kent.

## Herstelde grenzen

De gezamenlijke Salon-leespoort sluit verborgen, gemodereerde en gearchiveerde
publicaties uit. Reacties, onderwerpentellingen, AI-onderwerpsamenvattingen en
oude interactieroutes kunnen de publiekskeuze niet meer omzeilen. Archiefbeheer
blijft bij de auteur. Stories verlopen in Wereld zonder dat eerst de bronapp
wordt geopend. Friends filtert op een echte kringrelatie. Communitykaarten
openen het juiste genootschap; krantenlinks openen het juiste artikel.
Salon-video gebruikt dezelfde ondertitelband als de bronapp.

## Verificatie en grenzen

De gerichte integratie- en schermtests toetsen publicatie, privacy,
correctie/intrekking, voorkeurisolatie, bronuitval, onderwerpverbanden,
plaatsen, reageren, bewaren, mobiel gebruik, de bestaande Wereld-navigatie en
het lezen van een artikel binnen Saloon. De nieuwe testbestanden zijn met
foutinjecties op gevoeligheid beproefd. De nieuwe Edge-schermtest controleert
320, 390, 834 en 1440 pixels, bewaren via Edge, terug/vooruit, herladen,
plaatsvoorkeuren en bronuitval. Alleen de Edge-balk tijdens lezen verbergen
laat precies de bewering over één zichtbare balk zakken; de bron is daarna
teruggezet. `scripts/check.js` controleert
de bron, documentatie, registers en ondertitelbeslissing.

De eerste GitHub-ronde vond verouderde afgeleide registers, twee testscenario's
die reageerden op voor de ontvanger onzichtbare posts, en te lage onderwerp-links
op telefoon en tablet. De scenario's gebruiken nu zichtbare publicaties; de
leespoort blijft gelden. De links krijgen grotere aanraakvlakken en de
schermtest meet ze op beide formaten. De volledige CI moet ook de bijgewerkte
branch beoordelen. Dit document is geen vrijgave voor productie.

De grotere productvisie vraagt nog afzonderlijke bouwstappen: een volledige
redactionele dossier- en goedkeuringsketen, creatoropdrachten met rechten,
levering en afrekening, alle event- en transactiedomeinen in de projectie, een
uitgebreide knowledge graph en een generatieve interface met gecontroleerde
acties. Deze versie levert de werkende verbinding en de genoemde lussen.


## Operationele terugkeer

De optionele privébron **Mijn aanvragen** leest de bestaande Mall-aanvragen.
Een reactie, de gekozen zaak, behandeling en het vastgelegde antwoord keren
terug in Saloon. Wereld, Mijn leven en Actie zijn filters op dezelfde bronitems.
De kaart en Edge verwijzen naar Mijn Mall voor de volledige handeling.
Mijn Mall en de leverancierswerklijst gebruiken de bronacties en verplichte
versies; Edge projecteert hun echte knoppen.

[KETENS.md](KETENS.md) beschrijft de V1-afmaaknorm en `npm run operationeel`.
Een geregistreerde functie of een geslaagde deelproef is geen volledige
capability-certificering. Ontbrekend ketenbewijs blijft zichtbaar en blokkeert
`OPERATIONAL_STATUS=PROVEN`.
