# RTG V1: de menselijke lus sluit

Een functie werkt wanneer de juiste persoon kan beginnen, werk werkelijk wordt overgedragen, een bevoegde partij beslist en uitvoert, het resultaat terugkomt en later kan worden teruggevonden, gewijzigd of gecontroleerd hersteld.

BEGINNEN → OVERDRAGEN → BESLISSEN → UITVOEREN → RESULTAAT → TERUGVINDEN → WIJZIGEN/HERSTELLEN

Deze norm geldt voor bestaande functies. Nieuwe schermen of extra features lossen een ontbrekende schakel niet op. De functiecatalogus in `server/functies/register` blijft de bron van geregistreerde capabilities. Zolang geen expliciet V1-scopebesluit bestaat, houdt de meter alle geregistreerde functies in de V1-noemer. Een gekoppelde deelketen is geen bewijs voor een volledig domein.

| Bewijs | Vereiste waarneming |
| --- | --- |
| ENTRY | De bedoelde persoon kan beginnen via een bereikbaar scherm en een echte bronhandeling. |
| AUTHORITY | De actuele identiteit, bevoegdheid, policy en bronstatus staan de handeling toe; negatieve gevallen worden geweigerd. |
| HANDOFF | Het werk is terug te vinden bij de bedoelde ontvanger/eigenaar. |
| DECISION | Die partij kan daadwerkelijk besluiten, inclusief weigeren of teruggeven. |
| STATE | De bron slaat de juiste toestand duurzaam op, binnen een expliciet geteste opslag- en storingsgrens. |
| RESULT | Het bedoelde resultaat ontstaat; een ontvangen aanvraag is geen geleverde dienst. |
| RETURN | De oorspronkelijke gebruiker kan het resultaat zien. |
| RECALL | Het resultaat en zijn herkomst blijven later terugvindbaar. |
| CHANGE | Geldige wijzigingen werken door; oude schermen kunnen een nieuw besluit niet overschrijven. |
| REVOKE | Rechten en resultaten kunnen waar nodig worden ingetrokken, ook in afgeleide weergaven. |
| FAILURE | Een storing levert geen schijnsucces of onzichtbaar verlies op. |
| RECOVERY | Een waargenomen fout kan gecontroleerd worden hersteld, met een menselijke eigenaar waar nodig. |
| REPLAY | Dezelfde opdracht veroorzaakt geen dubbele gevolgen, ook bij een verloren antwoord. |
| DEGRADED | De lus blijft verantwoord bruikbaar zonder optionele afhankelijkheden. |
| PROOF | Actuele, herleidbare proeven onderbouwen de bewering en benoemen hun grenzen. |

Geen gemiddelden: een ontbrekende vereiste houdt de hele keten op `NOT_PROVEN`. Een ontbrekende meting is `UNKNOWN`, nooit nul. Een verzonnen eigenaar, SLA, bevestiging of betaalstatus telt niet als oplossing.

## Uitvoeren

```sh
npm run operationeel
npm run operationeel -- --json
```

De draaier start nieuwe bron-, API-, browser-, productieaccount- en PostgreSQL-proeven. Voor het volledige bewijs is een bereikbare PostgreSQL via `DATABASE_URL` (of `PG_URL`) nodig; de test maakt een eigen tijdelijke database en verwijdert alleen die database. Ontbreekt PostgreSQL, dan komt er geen journaalbewijs en blijft de keten rood. Hij gebruikt een nieuw journaal, een run-id en een SHA-256 van de actuele bronbestanden, inclusief ongecommitteerde bronwijzigingen. Een oud journaal, ontbrekende browser, mislukte proef, ontbrekend bewijsveld of wijziging tijdens de ronde levert geen groen op. Per ronde worden JSON-bewijs en de volledige testlogs in een eigen tijdelijke map bewaard; het pad staat in de uitvoer. Bewaar die map als CI-artefact voor een releasebesluit.

Exitcodes: `0` uitsluitend bij `PROVEN`, `2` bij ontbrekend of onvoldoende ketenbewijs, `1` bij een fout in de draaier of invoer. Het ontbreken van een browser wordt niet overgeslagen. Playwright gebruikt zijn normale geïnstalleerde browser; een afwijkend browserpad kan via `PLAYWRIGHT_BROWSERS_PATH`.

De uitvoer maakt onderscheid tussen geregistreerd, een deelcontract, een volledig gemapt capability-contract, bewijs per dimensie en volledig bewezen kritieke ketens. Installatiebrede nulclaims en OFF-claims vereisen een afzonderlijke volledige inventarisproef, gekoppeld aan precies dezelfde V1-catalogus. Eén geslaagde aanvraag mag die cijfers niet invullen.

`test/operationeel-meter.test.js` ijkt de poort met ontbrekende schakels, oude bron/run, dubbele records, mislukte/overgeslagen uitvoeringen, leeg bereik, een extra ongemapte capability en niet-nulle problemen. De bestaande sabotageproeven in `KETENS.json` en `scripts/lib/ketenproef.js` blijven zelfstandig bewijs met hun eigen acht velden en grenzen; deze meter promoveert die historische uitslagen niet stilzwijgend naar actuele V1-certificering.

## Eerste aangesloten keten: een Mall-aanvraag

Saloon → Mijn Mall → vraag → passende zaak → reactie → keuze van het lid → blijvende werklijst bij de zaak → behandeling → vastgelegd antwoord → Mijn Mall en Saloon → intrekken/heropenen/wijzigen.

De bron blijft `mallAanvragen`. Een aanvraag met reacties maar zonder keuze heeft nog geen toegewezen behandelaar: het is een vraagmarkt, geen bevestigde serviceopdracht. Na de keuze is de gekozen zaak de eigenaar. De medewerker kan behandelen, afronden met een toelichting of teruggeven met een reden. RTG belooft geen contact, levering, reservering of betaling die niet door de bron is bevestigd.

`aanvraag-acties.js` bepaalt de toegestane bronhandelingen. De bron gebruikt hetzelfde besluit bij uitvoering. De bestaande routepoorten blijven sessies en leveranciersrechten handhaven. De centrale functiepolicy wordt via `functiebeleid.js` gedeeld met de bronprojectie: een uitgeschakelde handeling verdwijnt uit Saloon, Edge en de bronapp en wordt ook bij uitvoering geweigerd. Mijn Mall en de leverancierswerklijst tekenen de bronacties; Edge projecteert hun echte knoppen. Saloon toont dezelfde bronacties als doorgang naar het volledige werk in Mijn Mall. Een versie is verplicht voor wijzigende vervolgopdrachten; een achterhaalde of ontbrekende versie vraagt om verversen. Aanmaak ondersteunt een verzendsleutel; de app hergebruikt die bij een herhaalde verzending. Wijzigen of heropenen maakt oude aanbiedingen ongeldig. Intrekken neemt vervolgacties weg.

Mijn aanvragen is een expliciet gekozen privébron in Saloon. Wereld, Mijn leven en Actie zijn weergaven op bronprojecties. Een bronversie verandert de afgeleide kaart. Provenance beschrijft bron, bronversie, observatiemoment, geldigheid, zichtbaarheid en de bronkeuze; er komt geen tweede aanvraagdatabase of zelfstandige eventwaarheid bij.

De proeven onderscheiden bronlogica, echte API-overdracht, schermbediening en opslag. Aanvragen gebruiken de bestaande duurzame bundel: bij een niet-bevestigde schrijfactie krijgt de gebruiker 503 en keert de aanvraag terug naar de vorige versie, inclusief resultaat, historie en herhaalsleutel. `operationeel-herstel.test.js` bewijst via de echte routes dat een ingetrokken personeelsplek niet meer kan lezen of afronden, een verloren én een gooiende SQLite-write geen succes geeft, Saloon geen half resultaat toont en een SIGKILL na commit maar vóór antwoord bij herhaling precies één resultaat oplevert. Een tweede harde herstart leest hetzelfde resultaat terug.

`operationeel-postgres.js`, uitgevoerd door de bestaande verplichte `postgres-requestcommit.pg.test.js`, bewijst dezelfde opslaggrens op een echte PostgreSQL-database met twee app-instances: een verbroken databaseverbinding tijdens commit geeft 503 zonder half resultaat; na herstel wordt de opdracht opgeslagen; een netwerkproxy houdt het echte antwoord tegen en de bronserver krijgt SIGKILL; herhaling op de andere instance veroorzaakt exact één versie en historisch gevolg. Een tweede herstart en gelijktijdige identieke wijzigingen bewaren dat resultaat. De eerste Saloon-lezing op een lege voorkeurenbron moet ook slagen zonder een verborgen schrijfactie.

`operationeel-productie.test.js` richt uitsluitend voor de proef een nieuw bedrijf en persoonlijke accounts in. De aanvraaglus draait daarna met `RTG_MAGNAAT_TEST=0` en `RTG_DEMO=0`. De oude PIN-deur en het ongebonden testtoken worden geweigerd. Na personeelsintrekking kan het oude account niet lezen of afronden; een actuele beheerder kan het werk overnemen. Dit bewijst productieaccountbinding, geen echte bedrijfscontrole of zakelijke toelating: de controledossiers bij de inrichting zijn expliciete lokale fixtures.

De browserproef moet bovendien dezelfde schermlus op een eigen lege PostgreSQL-database afleggen, zonder verborgen API-fouten. De browserproef trekt tijdens het werk de centrale Mall-policy in en vergelijkt Saloon en de bronacties, controleert Edge op mobiel en desktop en weigert een oude actie. PostgreSQL, productieaccountbinding en policy zijn verplichte AND-schakels in het register. De proeven bewijzen proces- en verbindingsstoringen binnen deze aanvraaglus, geen hoststroomuitval, volledige Mall, Wereld of RTG V1.

## Afhankelijkheden en menselijke overname

Geen optionele afhankelijkheid is eigenaar van de kernwaarheid van een menselijke handeling. Met `RTG_BETALEN_UIT=1`, `RTG_AI_UIT=1` en `RTG_PUSH_UIT=1` blijft de geteste aanvraaglus beschikbaar. Push uit stopt de web-pushlevering; brongegevens en de bestaande terugleeswegen blijven beschikbaar. Dit is nog geen installatiebrede OFF-certificering.

De betaalstop blokkeert ook handmatige eventaanbetalingen, uitgifte van geldbonnen en het als betaald vastleggen van offline horeca-bonnen. Een gemengd pakket wordt vóór de eerste mutatie geweigerd. Onbetaald opgenomen werk kan worden gesynchroniseerd en herhaald zonder een tweede bon. Een offerte en een expliciet akkoord blijven afzonderlijke bronfeiten.

Bij een vastgelopen automatisering is de vereiste lus: veilig wachten → bestaande menselijke eigenaar → concrete volgende handeling → vastgelegd resultaat → terugkeer. De eerste aanvraaglus gebruikt de werkelijk gekozen zaak en een reden bij teruggeven. Een algemene kantoorwachtrij, SLA-bewaking en externe leveranciersovername zijn nog niet aangesloten en blijven een afzonderlijke kritieke keten.

## Verdere kritieke ketens

Het uitvoerbare register bevat daarnaast eventdeelname tot en met personeel en toegang; journalistieke publicatie tot correctie en intrekking; creatorwerk en relatiebeheer; documentgoedkeuring en versiebeheer; bekwaamheid en personeelsbevoegdheid; offerte tot uitvoering; leveranciersstoring met menselijke overname; en offline werk met conflictbesluit.

Voor elk daarvan moeten actor, ontvanger, bron, bevoegdheid, resultaat, wijziging, intrekking, herstel en alle relevante productiegrenzen worden uitgewerkt en bewezen. Bestaande tests zijn nuttig startmateriaal, maar het bestaan van een testbestand of een route met HTTP 200 sluit de menselijke keten niet. De meter houdt ontbrekende contracten en proeven zichtbaar totdat het werk werkelijk is gedaan.
