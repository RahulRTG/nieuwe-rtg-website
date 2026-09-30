# RTG World Network

Gebouwd op `main` f3978e914, 30 september 2026. RTG krijgt een gedeelde,
machineleesbare verbindingslaag boven de bestaande domeinen. Nieuwe aanbieders
met ondersteund, zichtbaar aanbod doen bij de volgende lezing mee. De vier
werelden gebruiken dezelfde kern en houden hun eigen presentatie.

## De verbetering van het oorspronkelijke idee

Beleid staat vóór ontdekking én opnieuw vóór handelen. Een relatie bewijst
geen bevoegdheid. Een gevonden combinatie is een voorstel; een opgeslagen
selectie is geen reservering of transactie. Mensen krijgen geen netwerkscore.
Een onbekende beschikbaarheid wordt nooit een groen vinkje.

Het netwerk is een afgeleide projectie, geen nieuwe database waarin personen,
organisaties, agenda's, voorraad en geld opnieuw worden beheerd. De bestaande
Mall biedt al één aanbodvorm over elf bronnen. Daarop aansluiten vermijdt een
tweede catalogus en individuele integraties per bedrijf van een ondersteund type.
Een nieuw extern systeem heeft nog steeds een gecontroleerde domeinadapter nodig.

## Werkende lus

Open in LivingOS, TravelOS, WorkOS of FoundationOS het paneel **Context en
aandacht**, kies **Stel samen**, geef het plan een naam en kies maximaal acht
soorten onderdelen. Plaats en tweeletterige landcode zijn optioneel. De
samensteller toont per onderdeel maximaal drie alfabetische alternatieven,
zonder commerciële rangschikking. Niet-gevonden onderdelen blijven staan.

Kies onderdelen en gebruik **Controleer en bewaar**, gevolgd door **Bevestig
en bewaar**. De selectie verschijnt in de bestaande **Mijn lijsten**. Prijs,
zichtbaarheid en beschikbaarheidsmelding worden opnieuw gelezen voordat de
broker atomair de domeinlijst en het bewijs vastlegt. Gelijktijdige herhalingen
met dezelfde sleutel leveren dezelfde lijst op. De actor komt uit de sessie.
Er wordt niets betaald, geboekt of naar een derde verstuurd.

**Bekijk bij aanbieder** controleert de aanbodversie opnieuw en opent de
bestaande domeinpagina. Die pagina vraagt en controleert de boekingsgegevens.
De koppeling is nu een domeiningang, geen automatische voorinvulling van datum,
reizigers, kamer of dienst. De tijdelijke zoekbedoeling leeft alleen in het
open paneel. Een bewust bewaarde lijst volgt de bestaande Mall-levenscyclus.

## Machinecontract en code-eigenaars

| Onderdeel | Eigenaar / ingang | Gedrag |
|---|---|---|
| Aanbod | `kern/mall/aanbod.js` | Eén normalisator, lijst én stream, elf bestaande bronnen |
| Netwerkcontract | `kern/experience/network-contract.js` | Versie, primitives, grenzen en aansluitdekking |
| Bronadapter en beleid | `network-offers.js` | Whitelist; geen zakelijke prijzen, privé-adressen of personeel |
| Intent en compositie | `network-compose.js` | Begrensde invoer, Unicode-plaats + land, expliciete onzekerheid |
| Graaf | `network-graph.js` | Organisatie, plaats, mogelijkheid, resource; optioneel eigen contextrefs |
| Orkestratie | `POST /api/experience/network` | Verse lezing, geen gedeelde gebruikerscache, `private, no-store` |
| Mutatie | `network.plan.save` | Preview, bevestiging, broncontrole, duurzame brokertransactie |
| Bewaren | `mallLijsten.samenstellen` | Bestaande domeinopslag, alle regels controleren vóór schrijven |
| Ervaring | `shared/experience-network.js` | Dezelfde bediening in vier bestaande wereldpanelen |

Graafknopen hebben stabiele, getypeerde ids. Aanbod draagt bron, inhoudsversie,
prijsbetekenis en een expliciete toestand. Randen zeggen `provides`, `offers`,
`locatedAt` of `hasContext`; iedere rand draagt `grantsAuthority: false`.
Particuliere advertenties worden niet tot een persoonsnetwerk samengevoegd.
Persoonlijke contextrefs verschijnen alleen na een expliciet verzoek en de
bestaande servercontrole op de huidige actor en context.

Er is één volledige, verse doorgang over aangesloten aanbod. Geen per-aanbod
lineaire leverancierszoekactie, geen cartesiaans product van combinaties en
geen tijdzoneberekening voor zaken zonder urenbron. De samensteller bewaart
maximaal drie opties per behoefte. Leveranciers- en identiteitsindexen groeien
nog wel met de bron: dit is geen constante geheugenbelofte.

## Bewijs en praktische grenzen

Proeven: `test/experience-network.test.js`, `experience-network-http.test.js`,
`experience-network-scale.test.js` en `experience-network.e2e.js`. Ze controleren
automatische toetreding, vier werelden, afgeschermde contexten, intrekken,
gewijzigde prijzen, bronuitval, dubbele uitvoering, privacy, onbekende plaatsen,
Unicode, mobiele/desktopbediening en herstel na netwerkverlies zonder AI.

Lokale synthetische proef met 100.000 retailbedrijven en één artikel per
bedrijf: eerste implementatie ongeveer 7.7 seconden / 1441 MiB proces-RSS;
na streamverwerking en uitgestelde tijdzoneberekening ongeveer 0.55 seconden /
303 MiB. Een gezamenlijke testuitvoering mat 0.66 seconden / 304 MiB. Geen harde
tijdassertie: hardware en gelijktijdige belasting verschillen. Dit meet één
Node-proces met testdata, geen productiedatabase of gelijktijdige gebruikers.

Het machinecontract vermeldt de nog niet aangesloten onderdelen expliciet:
werknemersrelaties en gedelegeerd gezag, externe livecapaciteit en federatieve
transacties. De bestaande domeinen blijven daar gezaghebbend. Een willekeurige
nieuwe medewerker of privérelatie maakt dus niet automatisch openbaar aanbod.
Ook Foundation-hulp wordt niet afgeleid uit commerciële voorkeuren.

Voor veel gelijktijdige zoekers op honderdduizenden organisaties is de volgende
stap een domeinonderhouden zoekprojectie met revisiecursor, verwijderingsberichten,
herbouwbaar checkpoint en gemeten achterstand. Eerst een productiebelastingproef;
geen globale TTL-cache die een ingetrokken recht nog minuten laat doorwerken.
Daarna kunnen capability-adapters worden aangesloten, elk met eigen
publicatie-, bevoegdheids-, herstel- en bewijstests. De universele vorm vervangt
geen sectorspecifieke betekenis of menselijke bevestiging.
