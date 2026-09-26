# Saloon — eerste werkende implementatie

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

Overzicht, Agenda en Bewaard delen dezelfde bronobjecten. De gebruiker kiest
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
het lezen van een artikel binnen Saloon. De drie nieuwe testbestanden zijn met
de mutatiemotor op foutgevoeligheid beproefd. `scripts/check.js` controleert
de bron, documentatie, registers en ondertitelbeslissing.

De volledige CI is niet bewezen. De lokale kantoorrolproef kan geen
demo-kantoorsessie openen; hetzelfde is gereproduceerd op de ongewijzigde
basiscommit `c82e3f94d89be9512a2f80044205dfa83b7b8e04`. PostgreSQL-, Redis-,
container- en GitHub-specifieke controles vragen hun eigen voorzieningen.
Dit document is geen vrijgave voor productie.

De grotere productvisie vraagt nog afzonderlijke bouwstappen: een volledige
redactionele research/review/correctiehistorie, creatoropdrachten met rechten,
levering en afrekening, alle event- en transactiedomeinen in de projectie, een
uitgebreide knowledge graph en een generatieve interface met gecontroleerde
acties. Deze versie levert de werkende verbinding en de genoemde lussen.
