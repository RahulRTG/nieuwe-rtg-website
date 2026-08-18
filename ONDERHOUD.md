# Onderhoud — de post die er niet uitzag als werk

`LAT.md` gaat over de code, `NORM.md` over de meters, `TOEZICHT.md` over het
bewijs. Dit document gaat over de kosten die overblijven als dat allemaal
staat: het onderhoud. Bij een codebase van deze omvang zonder runtime-
dependencies is dat naar gangbare maatstaven 15 à 20 procent van de bouwsom
per jaar — niet omdat er functies bijkomen, maar omdat de grond verschuift
terwijl de code stilstaat.

De kern van dit document is een verschuiving in wie wat doet:

```
                          DETECTIE          DIAGNOSE          REPARATIE        BESLUIT
vóór deze laag            machine           mens              mens             mens
met deze laag             machine           machine           machine (PR)     mens
```

Het besluit blijft bij een mens. Dat is geen restje voorzichtigheid maar het
sluitstuk van het hele poortenstelsel: elke poort in dit huis blijft een echte
poort zolang er een mens tussen fix en hoofdlijn staat.

## De vier verschuivingen van de grond

Code breekt op twee manieren. De bekende: iemand wijzigt iets en een toets
zakt — daar is `ci.yml` voor, en die werkt. De onbekende: er wijzigt NIETS in
de repo en toch klopt hij niet meer, omdat de wereld eronder doorschoof. Vier
vormen daarvan, elk met een eigen wachter:

| verschuift | wachter | ritme | zakt op |
|---|---|---|---|
| de runtime (Node-EOL, vlaggen, versie-drift) | `scripts/grondwacht.js` | wekelijks (`wacht.yml`) | einde in zicht, versies oneens, vlag weg |
| de browser en de toolchain | browsercanary in `wacht.yml` | wekelijks | de schermronde die vorige week groen was |
| de buitenwereld van de live-site | `scripts/sonde.js` + `scripts/triage.js` | elke 5 min (`live-monitor.yml`) | een reis die omvalt, mét duiding |
| de wet | `scripts/wetwacht.js` + `WETBRONNEN.json` | maandelijks (`wacht.yml`) | een gevolgde tekst die veranderd is |

Twee ontwerpkeuzes gelden voor alle vier:

**Niet kunnen meten is rood.** Elke wachter kent exitcode 2 — de kalender was
onbereikbaar, de sonde liep nul reizen, de wetbron gaf een 503. Dat is
nadrukkelijk géén 0. Een wacht die groen wordt omdat hij niets zag is de
gevaarlijkste meter die er is; dit is `LAT.md` regel 3, toegepast op metingen
die van het netwerk afhangen.

**Elke wachter kan aantoonbaar zakken.** `test/grondwacht.test.js` voert per
oordeel de mutatie uit die hem moet laten omvallen (regel 10). De duurste
staat er met naam en toenaam in: de eerste versie van de grondwacht meldde
`--experimental-test-coverage` als overbodig terwijl zijn proef niets mat —
die fout is nu een regressietoets, geen anekdote.

## De herstellus

De wachters produceren rode lichten; `herstel.yml` maakt er werk van:

```
rood licht ──────────────► fix-issue (label `herstel`, automatisch)
  ci.yml                     · welke workflow, tak, commit, log-adres
  ronde.yml                  · bij de sonde: de triage-duiding erbij
  wacht.yml                  · @claude-oproep met de spelregels van het huis
  live-monitor.yml                     │
                                       ▼
                             fix-PR (Claude: oorzaak, niet symptoom;
                             volledige poort vóór het openen)
                                       │
                                       ▼
                             merge ── ALTIJD een mens
```

Afspraken die de lus in bedwang houden:

- **Eén issue per workflow**, niet één per rode run. Vijf rode nachten zijn
  één storing met vijf metingen. Herhalingen komen als reactie, met een
  tijdrem van zes uur — een sonde die elke vijf minuten faalt levert geen 288
  reacties.
- **Alleen de hoofdlijn en de schema's.** Een rode feature-tak is werk in
  uitvoering, geen onderhoudsincident.
- **`herstel.yml` kan alleen issues schrijven.** Niet pushen, niet mergen,
  niet terugrollen, geen workflows starten. Wat de lus mag, staat in de
  `permissions:` van het bestand zelf — dat is de handhaving, geen belofte.

## De triage: waar terugrollen wél en níét helpt

Een rode sonde was een kale exitcode; nu zegt `TRIAGE.json` in welke laag het
zit. Het onderscheid dat geld waard is: **terugrollen repareert precies één
ding** — een app die stuk ging door wat er als laatste in ging. Bij `dns`,
`tls` en `rand` doet `deploy:terug` niets dan tijd kosten; alleen bij `app`
(alles antwoordt, alles antwoordt fout) is de laatste uitrol de eerste
verdachte, en dan nog blijft de knop bij een mens. Een enkele stukke route
(`deels`) rolt nooit terug: alles terugzetten voor iets wat op één plek zit
is duurder dan de storing.

## De wetwacht is de uitzondering

De andere wachters mogen een fix voorstellen; de wetwacht niet. `CONCERN.md`
legt vast dat de AI hier geen juridische autoriteit is, en een wacht die zelf
DPIA's bijwerkt produceert precies de lege-vakjes-compliance die `TOEZICHT.md`
afwijst. Hij meldt DAT een gevolgde tekst veranderd is en WELK document eraan
hangt (`WETBRONNEN.json`); de vertaalslag naar "en dus doen wij dit anders"
is mensenwerk. Vals alarm is hier de goede soort fout — een keer vergeefs
kijken kost minder dan een gemiste wijziging. Na beoordeling:
`npm run wetwacht:vast` legt de nieuwe vingerafdruk vast.

Let op: de afdrukken in `WETBRONNEN.json` zijn bij aanleg **nog niet gezet**
(vanuit de bouwomgeving waren de EUR-Lex-bronnen niet bereikbaar). De eerste
maandronde meldt daarom `NOG_GEEN_AFDRUK`; één keer `npm run wetwacht:vast`
draaien op een machine die erbij kan zet het nulpunt.

## Wat dit huis nog steeds zelf draagt

De nul-dependency-keuze blijft de dure keuze, en deze laag verandert dat
niet — hij maakt hem draagbaar. Eigen SMTP, IMAP, DKIM, STUN, WebAuthn en
pgwire betekenen dat er geen `npm update` bestaat die een lek daar dichtzet:
een advisory tegen andermans implementatie zegt niets over de onze. Wat er
wél voor staat: CodeQL wekelijks over de eigen code, de sabotage- en
beproevingsrondes, en de herstellus hierboven die elke rode uitslag tot
fix-PR brengt. Wie hier ooit tóch een dependency overweegt: dat is geen
onderhoudsbesluit maar een architectuurbesluit — `scripts/check.js` weigert
hem hoe dan ook totdat hij op de bewuste lijst staat.

## De knoppen op een rij

```
npm run grondwacht           de runtimewacht, nu
npm run wetwacht        de wetwacht, nu (meldt alleen)
npm run wetwacht:vast   nieuwe vingerafdrukken vastleggen ná menselijke beoordeling
npm run triage          een sonde-uitslag duiden: node scripts/triage.js --uit=sonde.json
npm run deploy:terug    terugrollen -- de knop die bewust bij een mens blijft
```
