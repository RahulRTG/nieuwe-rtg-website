# RTG enterprise super-app: mergecontract

Dit document maakt de brede super-appwijziging beheersbaar. Het is geen
marketingtekst, maar het contract waarmee een reviewer kan vaststellen wat
veilig samen kan worden gevoegd, wat geïsoleerd blijft en hoe terugdraaien
werkt.

## Grenzen

| Laag | Verantwoordelijkheid | Schrijft productiegegevens? |
|---|---|---|
| Command Workspace | Apps openen, naast elkaar zetten en context tonen | Nee |
| Rahul | Lezen, vergelijken en voorbereiden binnen de actieve rol | Alleen via bestaande beveiligde routes |
| Horeca OS | Operationele gast-, keuken-, vloer- en managerworkflows | Ja, via bestaande authenticatie en routes |
| Hospitality Universe | Voorspellen, counterfactuals en bewijs | Nee |
| Magnaat | Spelen met synthetische werelden | Nee |

De productiegrens is hard: Universe en Magnaat krijgen geen schrijfrecht naar
een live zaak. Een simulatiebrug stuurt uitsluitend voorstellen terug. Een
manager beslist apart of een voorstel ooit productie wordt.

Magnaat heeft daarnaast een productleerkring. Die bewaart uitsluitend
geaggregeerde actie-, fout-, scenario- en uitkomsttellingen. Herhaalde patronen
worden een verbeterhypothese met een herhaalbare testopdracht. Alleen de
boardroom kan die naar `test-klaar` zetten; de leerkring schrijft nooit code,
wijzigt nooit productie en verwerkt geen namen, vrije tekst of bedrijfsdata.

## Menselijke beslissingen

Rahul mag zoeken, ordenen, vergelijken, simuleren en een route voorbereiden.
Betalen, publiceren, toegang wijzigen, een gast verwijderen, een medische
diagnose stellen en veiligheidsprotocollen afsluiten blijven menselijke
handelingen. Human Reality bewaart alleen een privacyarm patroon, de gekozen
route en de uitkomst; geen namen of herkenbare persoonlijke details.

## Productie zonder demo

AI is een optionele assistentielaag: zonder AI blijven de gewone schermen,
zoekroutes en menselijke beslissingen volledig bruikbaar. Mail en betalingen vereisen
een echte provider en ondertekende webhook. Ontbrekende koppelingen worden als
ontbrekend getoond en niet met voorbeelddata gevuld. De go-livekeuring blijft de
laatste poort voor uitrol.

## Rollback

1. Stop een uitrol bij een rode CI-, beveiligings- of toegankelijkheidscontrole.
2. Zet de vorige applicatieversie terug; voer geen datamigratie terug zonder
   afzonderlijk herstelplan.
3. De nieuwe command-laag schrijft zelf geen bedrijfsdata en kan daardoor als
   statische UI-laag worden teruggezet.
4. Universe- en Magnaatwerelden zijn afgescheiden en mogen bij rollback worden
   afgesloten zonder de live zaak te wijzigen.
5. Controleer na herstel login, rollen, betaling, mail, realtime en de
   belangrijkste Horeca-route voordat verkeer wordt heropend.

## Mergebewijs

- `npm run check`: bron-, CSP-, toegankelijkheids- en moduleafspraken.
- `npm run ast-scan`: statische veiligheidsanalyse.
- `npm test`: unit- en integratieroutes.
- gerichte tests voor Command-routering, Hospitality Universe, Human Reality,
  Magnaat en Veilig Moment.
- `npm run build`: reproduceerbare frontend en service-workercache.
- `npm run golive`: blijft rood totdat alle echte providers, sleutels en
  juridische bedrijfsgegevens zijn aangesloten.

Samenvoegen betekent dat de code aanvaard is. Het betekent niet dat productie
mag worden aangezet voordat de go-livekeuring groen is.
