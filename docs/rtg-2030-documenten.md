# Eerste capabilitypilot — de betekenis van verwijderen

Status: ontwerp, nog geen nieuwe runtimecapabilities. Basis:
`3af1a3edba382aee9bdf7b45a294ff35691a9765`.
Hoort bij [RTG 2030](rtg-2030.md).

## Bestaande semantiek

De [route](../server/routes/bestanden.js) `POST /api/bestanden/weg` roept
`bestandenWeg` aan in [bestanden-delen.js](../server/kern/bestanden-delen.js):

| Actor en state | Huidig effect |
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

Er wordt in deze ontwerpronde niets omgeschakeld. Deze pilot maakt één bestaande
betekenisgrens concreet; de bestaande financiële P0-bewijsstap blijft daarnaast
een zelfstandige releaseblokkade totdat het vereiste bewijs aanwezig is.
