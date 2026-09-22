# Eerste capabilitypilot — de betekenis van verwijderen

Status: eerste trash/restore-implementatie en gerichte lokale bewijsronde. Historische ontwerpbasis:
`3af1a3edba382aee9bdf7b45a294ff35691a9765`.
Hoort bij [RTG 2030](rtg-2030.md).

## Semantiek vóór deze pilot

De [route](../server/routes/bestanden.js) `POST /api/bestanden/weg` roept
`bestandenWeg` aan in [bestanden-delen.js](../server/kern/bestanden-delen.js):

| Actor en state | Effect in de historische ontwerpbasis |
|---|---|
| Eigenaar, bestand actief | `weg = true`, tijdstip opslaan, prullenbak tonen |
| Eigenaar, bestand al in prullenbak | `wisItem`, huidige bytes en versies verwijderen, item verwijderen |
| Ontvanger van gedeeld bestand | Eigen codenaam uit de toegangslijst verwijderen |

Een synthetische moduleproef op deze bron gaf bij twee opeenvolgende aanroepen
`{prullenbak: true}` en daarna `{weg: true}`. Deze proef gebruikte uitsluitend
geheugenfixtures; hij bewijst geen productie-incident of gedrag van HTTP-
idempotentiemiddleware. De [bestaande bestandentest](../test/bestanden.test.js)
legt prullenbak, herstel en delen afzonderlijk vast.

De nieuwe capability mag dus niet simpelweg `document.delete` heten en de oude
handler ongemodificeerd aanroepen. Daarmee kan dezelfde intentie bij herhaling
een zwaarder effect krijgen.

## Vier expliciete contracten

| Betekenis-ID v1 | Bevoegdheid | Toegestane overgang | Verboden effect |
|---|---|---|---|
| `document.trash` | Eigenaar van het persoonlijke bestand | Actief → prullenbak; prullenbak → dezelfde prullenbak | Bytes of versies definitief verwijderen |
| `document.restore` | Eigenaar | Prullenbak → actief; actief → actief bij geldige herhaling | Oude deelrechten ongemerkt uitbreiden of verloren bytes als hersteld melden |
| `document.remove_from_my_view` | Geverifieerde ontvanger | Eigen deeltoegang → ingetrokken; herhaling blijft ingetrokken | Bestand of toegang van een ander verwijderen |
| `document.purge` | Eigenaar plus expliciet bevoegd besluit voor dit effect | Prullenbak → purge pending → aantoonbaar verwijderd | Een onduidelijke retry behandelen als nieuwe purge, of succes melden terwijl bytes onverklaard achterblijven |

Persoonlijke trash is voorgesteld R1; bij gedeelde gevolgen minimaal R2. Restore
krijgt dezelfde contextafhankelijke beoordeling. Purge is R5 wegens het
onomkeerbare effect; een financieel ledger is alleen relevant als er ook een
economisch effect ontstaat. Organisatie-, gezin-, juridische bewaring en
bulkprullenbak zijn vervolgcontracten, geen impliciete uitbreiding van deze pilot.

## Uitvoeringscontext en invoer

De server levert actor, sessie, tenant/eigenaarscope, beleid, huidig mandaat en
eventuele geverifieerde bevestiging. De gebruiker of AI kan die velden niet zelf
autoriseren. De aanroep draagt resource-ID, contractversie, operatie-ID en
verwachte resourceversie. Resource-ID's worden vóór iedere read en mutatie aan
de geverifieerde scope gebonden.

Het resultaat noemt operatie-ID, resourcestatus, versie, auditreferentie en of dit
een herhaling is. Bij een fout wordt geen geslaagde eindstate geprojecteerd.
Foutcodes krijgen afzonderlijke betekenis- en vertaal-ID's voor ongeldige invoer,
geweigerde/onbekende resource, versieconflict, benodigde toestemming/step-up,
tijdelijke opslagfout en nog onzekere uitvoering.

## Invarianten en bewijscriteria

| Claim | Vereist bewijs vóór vrijgave |
|---|---|
| Eén intentie, één soort effect | Herhaalde en gelijktijdige `trash` laat bytes en versies intact, ook na herstart. |
| Duurzame bevestiging | Een bevestigd resultaat blijft na reconnect, refresh en procesherstart bestaan. Opslagfout geeft geen vals succes. |
| Beperkte bevoegdheid | Directe API-aanroep en ID-wissel door andere eigenaar/ontvanger veranderen en onthullen geen ongeautoriseerd bestand. |
| Intrekking | Intrekking tussen preview, bevestiging en uitvoering voorkomt het effect; ook bij worker, cache en realtime. |
| Versieconcurrentie | Een gelijktijdige restore/upload/trash wordt geserialiseerd of geeft expliciet conflict; geen stille overschrijving. |
| Idempotentiescope | Dezelfde operatie-ID met dezelfde betekenis/invoer geeft hetzelfde resultaat; gewijzigde betekenis/invoer onder die ID geeft conflict. |
| Privacy | Logs en events bevatten geautoriseerde referenties, geen documentbytes, tokens of vrije inhoud. De tweede actor ontvangt alleen wat nog gedeeld mag zijn. |
| Purge en herstel | Onderbreek iedere relevante metadata/blob-grens; het systeem hervat gecontroleerd, houdt een verklaarbare pending-state en bevestigt pas het afgesproken verwijderresultaat. |
| Gelijke betekenis | Edge Bar, documentenscherm, API en toegelaten Rahul-aanvraag passeren dezelfde servercapability. Taalwisseling verandert het effect niet. |

Een herhaling wordt herkend vóór een stale-versionfout voor diezelfde geslaagde
operatie, maar pas na actuele autorisatie. Een ingetrokken actor krijgt daardoor
geen oud opgeslagen antwoord terug. Idempotentie wordt duurzaam en atomair met
de stateovergang vastgelegd. Bestaande transportcaches krijgen geen gezag over
dit domeincontract.

De [huidige opslag](../server/kern/bestanden.js) bewaart metadata en versleutelde
blobs via verschillende mechanismen. Purge vraagt daarom een expliciet herstelpad
en tombstone/taakstatus. Eerst bytes wissen en vervolgens hopen dat metadata
vastligt is onvoldoende als toekomstige garantie. Back-upbewaring, bewaarplichten
en fysieke verwijdergaranties moeten apart worden gedefinieerd; een herstelde
back-up mag een al bevestigde purge niet ongemerkt ongedaan maken.

## Migratievolgorde

1. Inventariseer alle aanroepers van `/weg`, `/herstel` en `/leeg`, inclusief
   widgets, gebaren, Office, AI en achtergrondopruiming. Houd verschillende
   documentmodellen apart totdat hun domeinrelatie bewezen is.
2. Implementeer eerst trash/restore in de bestaande bestandendomeinlaag, met
   versie en duurzame operatie-identiteit. Laat de oude API voor gemigreerde
   acties dezelfde implementatie gebruiken; geen alternatieve bypass.
3. Behoud definitieve verwijdering als expliciet afzonderlijke handeling en
   migreer haar pas met passend besluit-, storage- en herstelbewijs. Een
   compatibiliteitsadapter mag de bedoeling niet uit een gewijzigde state raden.
4. Laat de Edge Bar en het documentenscherm dezelfde actie aanvragen. Toon de
   uitkomst in volledige, beoordeelde zinnen in de gekozen taal. Activeer Rahul
   pas met identieke actor-, mandaat- en bevestigingsgrenzen.
5. Draai de gerichte actor/state/failurematrix en bestaande regressies op één
   kandidaat. Bewijs schema- en datacompatibiliteit van rollback. Gebruik voor
   onomkeerbare purge geen oude fallback die het nieuwe contract omzeilt.

## Implementatie van de eerste verticale proef

De betekenisbron is [document-contracten.js](../server/kern/document-contracten.js).
De uitvoering staat in [document-capability.js](../server/kern/document-capability.js).
Een SQLite- of PostgreSQL-collectietransactie bindt eigenaar, verwachte versie,
stateovergang en operatiebon. Een herhaling krijgt de oorspronkelijke effectbon
én de actuele resourcestatus; een latere restore wordt niet door een oude trash
ongedaan gemaakt. De opslag gooit replaybescherming nooit stil weg: bij 10.000
bonnen per kluis sluit deze ingang tot expliciet bewaarbeheer beschikbaar is.

`POST /api/bestanden/actie` accepteert alleen de twee v1-capabilities. De oude
owner-routes `/weg` en `/herstel` gebruiken dezelfde functie en vereisen nu ook
`operationId` en `expectedVersion`. Een oude client zonder deze velden krijgt
428 en moet herladen. Het bijgewerkte scherm, gebaren en de standaard Edge Bar
gebruiken [dezelfde adapter](../public/apps/bestanden/capability.js).
Rahul gebruikt de bestaande `/api/member/doe`-voorstelketen: de server bewaart
exacte invoer, en bevestiging hercontroleert actor en documentversie.
Ook de buitenste bevestigingsroute passeert de algemene antwoordcaches niet:
een hergebruikte bevestiging wordt door de goedkeuringsopslag geweigerd.

De [opslagproeven](../test/document-capability-storage.test.js) onderzoeken twee
processen, echte SQL-weigering en geïsoleerde crashes vóór/na commit. De
[HTTP-proeven](../test/document-capability.test.js) toetsen semantiek, rechten,
herhaling en Rahul. De [browserproef](../test/document-capability.e2e.js) bedient
het echte documentpaneel en de Edge Bar met verschillende taalinstellingen.
Uitvoer en cryptografische bronbinding staan bij de specifieke kandidaat in
het dossier `output/document-pilot/` van de Codex-werkruimte; deze tekst is geen
vervanging voor een geslaagde run.

Deze proef dekt de persoonlijke bestandenkluis. Office, juridische documenten,
organisationele bewaring en alle 114 vertalingen zijn hiermee niet bewezen.
De Engelse en Arabische browserproef bewijst dezelfde handeling bij die
taalinstellingen, geen volledige vertaling: met externe AI uit blijven delen
van de interface Nederlands of Engels. Fysieke apparaten, volledige menselijke
toegankelijkheidsbeoordeling en document-realtime zijn aparte bewijsstappen.
Prullenbak-expiratie, bulk leegmaken en de nu expliciete legacy-route `/wis`
behouden hun bestaande afzonderlijke uitvoering; hun blob/metadata-crashherstel
blijft onbewezen. `/wis` wordt nooit door een trash-retry of door Rahul gekozen.
Een onzekere uploadcommit laat voorbereide bytes behouden; opruiming van zulke
orphan blobs vraagt een afzonderlijk herstelcontract. Er wordt geen R5-purge-
correctness, volledige documentmigratie, productieartifact of rollback geclaimd.

Voor UI/rechtenprojectie is bovendien hersteld dat het detailpaneel de Edge Bar
verborg en zijn eigen contextgetter overschreef. Een Edge-actie meldt pas succes
na een succesvol domeinantwoord. De generieke Edge-tekst claimt vooraf geen al
gecontroleerd mandaat meer: de controle gebeurt bij uitvoering.

De bestaande financiële P0-bewijsstap MONEY-012 blijft onafhankelijk releaseblokkerend.
Deze ronde merge't of promoveert niets.
