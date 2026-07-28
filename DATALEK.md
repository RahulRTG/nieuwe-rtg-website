# Datalek: wat te doen, en binnen hoeveel tijd

Dit is geen juridisch advies. Het is het draaiboek dat voorkomt dat de eerste
drie uur na een lek opgaan aan uitzoeken wie je moet bellen. Laat het door een
jurist nakijken voordat je live gaat, en vul de namen en telefoonnummers in.

**De klok: 72 uur.** Vanaf het moment dat je *bekend bent* met het lek heb je
72 uur om het bij de Autoriteit Persoonsgegevens te melden (AVG art. 33). Die
klok loopt in het weekend gewoon door. Bij hoog risico moet je de betrokkenen
zelf ook informeren, en dan geldt "onverwijld" (art. 34).

---

## Wie doet wat

| Rol | Wie | Bereikbaar op |
|---|---|---|
| Beslisser (meldt of niet) | **[VUL IN -- eigenaar]** | **[VUL IN]** |
| Techniek (dicht het gat) | **[VUL IN]** | **[VUL IN]** |
| Communicatie naar leden | **[VUL IN]** | **[VUL IN]** |
| Jurist / DPO | **[VUL IN]** | **[VUL IN]** |

Eén beslisser. Bij twijfel meldt die; een melding die achteraf niet nodig bleek
kost niets, een gemiste melding kost een boete.

---

## Stap 1 -- eerst stoppen, dan begrijpen (eerste uur)

Het gat dichten gaat voor het onderzoek. Bewijs verzamelen mag niet betekenen
dat het lek blijft lopen.

- Zet de betrokken functie uit met de functieschakelaars op de technische
  pagina, of schakel de zekering om. Dat is sneller dan een deploy.
- Trek sessies in als tokens gelekt kunnen zijn.
- Roteer de sleutel die geraakt is (`RTG_ENC_KEY`, `RTG_VAULT_KEY`,
  `RTG_SECRET_KEY`) in de secrets manager, en herstart.
- **Niets weggooien.** Geen logs opschonen, geen "opruimen". Draai de
  bewaartermijn-veger niet. Wat je nu wist, kun je straks niet meer uitleggen.

## Stap 2 -- vastleggen wat je weet (eerste dag)

Schrijf mee vanaf minuut één, in een apart document buiten het systeem:

- Wanneer begon het, wanneer ontdekt, door wie, hoe?
- Welke gegevens: alleen codenamen, of ook namen en e-mailadressen uit de kluis?
  Dat verschil bepaalt het risico. Codenamen alleen is pseudonimisering die
  standhield; namen erbij is een identiteitslek.
- Hoeveel betrokkenen, bij benadering. Een schatting mag; nietsweten niet.
- Wat is er inmiddels aan gedaan?

Bronnen die hierbij helpen: het inzagejournaal (wie keek in de identiteitskluis
-- `/api/techniek/status`, veld `inzage`), het beveiligingslogboek, de
verzoeklog, en het auditlogboek van de boardroom.

## Stap 3 -- melden of niet (binnen 72 uur)

**Melden aan de AP** tenzij het lek waarschijnlijk *geen* risico oplevert voor
de betrokkenen. Codenamen zonder namen, of goed versleutelde gegevens waarvan
de sleutel niet mee is, kunnen zo'n geval zijn. Leg vast waarom je niet meldt --
die afweging moet je later kunnen tonen.

Melden kan bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).
Een eerste melding met onvolledige informatie mag; je vult later aan.

**Ook de betrokkenen informeren** bij hoog risico: namen, adressen, paspoortdata,
betaalgegevens of zorggegevens op straat. Schrijf in gewone taal: wat er is
gebeurd, welke gegevens, wat zij nu zelf kunnen doen, en waar ze terechtkunnen.
Geen juridisch jargon, geen bagatelliseren.

## Stap 4 -- erna

- Registreer het lek in het interne register (ook als je niet gemeld hebt --
  dat is verplicht, art. 33 lid 5).
- Wat maakte dit mogelijk, en wat verandert er zodat het niet terugkomt?
- Als een test dit had kunnen vangen: schrijf die test. Dat is de enige manier
  waarop een incident zich terugbetaalt.

---

## Vooraf regelen (nu, niet straks)

- [ ] Namen en nummers hierboven ingevuld
- [ ] Iemand aangewezen die 's nachts bereikbaar is
- [ ] Verwerkersovereenkomst met elke partner die klantdata ziet -- zij zijn
      verwerker, en moeten een lek *bij jou* melden, niet zelf afhandelen
- [ ] Intern register aangelegd (een spreadsheet volstaat)
- [ ] Dit draaiboek een keer droog doorgelopen met de betrokkenen
