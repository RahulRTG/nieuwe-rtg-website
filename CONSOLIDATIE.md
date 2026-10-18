# Consolidatie — besluit van de eigenaar (12 oktober 2026)

RTG wordt opgeruimd zonder de ambitie of de bestaande productwerelden op te geven. Het doel is niet minder rode tellers, maar een RTG dat technisch beheersbaar, aantoonbaar veilig en betrouwbaar genoeg is om als Europees technologieplatform te groeien. Een planning is geen kwaliteitsdeadline: RTG is klaar wanneer toetsen, bewijslast en productiepoorten dat aantonen. Volgorde: eerst de beveiligingsfouten, dan de bredere herstructurering.

**Lanceerbare kern.** RTG Pass, TravelOS, WorkOS (het kantoor), betalen, en Rahul met de Edge — die twee zijn de centrale ervaring waarmee RTG zich onderscheidt. LivingOS, FoundationOS, De Salon en de overige mogelijkheden blijven bestaan en worden verder ontworpen, maar zijn standaard niet publiek beschikbaar tot ze ieder afzonderlijk hun productiepoort halen. **Een vlag vervangt nooit een beveiligingsgrens**: een uitgeschakeld domein is ook via een directe API-aanroep niet bereikbaar.

**Eén integrator.** Pull requests gaan via één integrerende agent naar main, en elke PR begint vanaf een verse main. Tot de inventaris van de domeinen (fase 4) klaar is, worden er geen nieuwe domeinen geïmplementeerd; beveiligingsreparaties, onderzoek, ontwerp en documentatie mogen doorgaan zolang ze de integratie niet verstoren.

**Gegenereerde registers.** CI genereert en controleert de registers; een PR hoeft ze niet mee te nemen. CI faalt wanneer een register niet overeenkomt met de broncode: mergeconflicten verminderen mag, een architectuurafwijking verbergen niet.

**Vier harde voorwaarden**, ook voor elke reparatie:

1. **Geen kunstmatige verbetering van normen.** Een lager getal telt alleen als het onderliggende risico aantoonbaar kleiner is. Een norm gaat niet omhoog zonder akkoord van de eigenaar; een notitie in NORM.json is geen akkoord.
2. **Geen bewijsachterstand verbergen.** De lanceerbare kern en het totale platform worden afzonderlijk gerapporteerd. Een totaal (zoals de 2714 muterende routes zonder as in MACHINEDEKKING.json) verdwijnt nooit doordat de meetlat kleiner wordt gemaakt.
3. **Geen automatische productie-uitrol.** Elke fase krijgt een aantoonbaar groene toets, een review en een expliciet integratiebesluit.
4. **Geen nieuwe technische schuld.** Een reparatie introduceert geen nieuwe uitzondering, geen duplicatie en geen ongedocumenteerde afhankelijkheid.

**Domeingrenzen, geen bestandsgrenzen.** Wie `server/server.js` of een ander te groot bestand opknipt, brengt echte domeingrenzen aan. Een bestand alleen onder de 10 kB krijgen verplaatst de schuld en lost haar niet op.

## Werkwijze voor de V1-afbouw (besluit van de eigenaar, 18 oktober 2026)

Dit vervangt voor de duur van de V1-afbouw het deel "elke PR gaat naar main" uit **Eén integrator** hierboven. De rest van dit besluit blijft staan.

- **Eén integratiebranch, geen merges naar main tot V1.** De afbouw loopt op `claude/v1-integratie`, afgetakt van main op `dc91a23a921e70d3290b6aadc0377751cf21995b`. Tot V1 gereed is (de einddefinitie in `AFBOUWPROGRAMMA.md` par. 10), gaat er niets van deze afbouw naar main. Eén draft-PR van de integratiebranch naar main blijft open als het enige spoor dat CI en reviewers zien; hij wordt pas gemerged na het integratiebesluit van de eigenaar.
- **Open PR's worden in de branch geïntegreerd, niet in main.** Beveiligingsfixes eerst, daarna overlappend productwerk ontdubbeld. Elke geïntegreerde PR krijgt een eigen mergecommit die zijn nummer noemt, zodat terug te vinden is wat er van wie kwam.
- **Geen merges is geen vrijbrief voor één oncontroleerbare megawijziging.** Kleine commits, elk met de toetsen die het raakt groen; de release-image-workflow draait op de branch (workflow_dispatch); reviews gaan per commit of per fase, en wat niet bewezen is staat er met de reden bij.
- **Main loopt niet stil mee.** Wat er toch op main landt, wordt met een mergecommit in de branch gehaald (nooit rebase of force-push), zodat de eindmerge geen verrassing bevat.
