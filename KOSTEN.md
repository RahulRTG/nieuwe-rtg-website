# RTG Kostprijs

**Wat kost elke gebruiker ons, en wie betaalt dat.**

RTG betaalt elke maand voor modellen, machines, stroom en betaalverkeer. Tot nu
toe kon niemand zeggen welk deel daarvan bij welke gebruiker hoort. Zonder dat
antwoord is een pasprijs een gok, is een gratis account een onbekend risico, en
is "onze kosten worden gedekt" een gevoel in plaats van een cijfer.

Deze laag beantwoordt de vraag voor **iedereen**: particuliere leden, zaken, en
de gezinnen van de RTFoundation. In één zin: *elke euro die dit huis uitgeeft
krijgt een eigenaar, of de eerlijke mededeling dat hij er geen heeft.*

Code: `server/kern/kosten/`, routes in `server/routes/kosten.js`, toetsen in
`test/kosten.test.js`.

---

## 1. De drie grenzen

Die mogen niet sneuvelen. Alles hieronder volgt eruit.

**1. Er staat nooit een getal waar er geen is.** Ontbreekt een tarief, een nota
of een teller, dan komt er een **reden** en geen nul. Nul betekent gratis, en dat
is een bewering die je niet moet doen als je het niet weet. Elke regel draagt een
**bewijsgraad** (BESTUUR.md par. 3: `onbekend`, `vermoed`, `gemeten`,
`bewezen`), en een toerekening kan nooit `gemeten` heten.

**2. Deze laag kent geen namen.** Gebruikers staan hier met hun sessiesleutel,
zaakcode of gezinscode -- dezelfde handvatten waarmee de facturen al werken.
Echte namen wonen in de kluis (`accounts.js`) en komen hier niet. Een
kostenoverzicht is een gedragsbeeld; dat hoort niet naast een naam te liggen.

**3. De machine zet klaar, een mens geeft vrij.** Er wordt niets gefactureerd
zonder dat een mens uit de boardroom de maand vrijgeeft, met zijn sleutel
eronder, en maximaal één keer per maand (GELD.md par. 3).

---

## 2. Negen kostensoorten, en wat ervan te meten is

`kern/kosten/soorten.js` is de enige lijst. Een soort die daar niet staat,
bestaat in deze laag niet: de meter weigert hem, het overzicht toont hem niet en
de doorbelasting kan hem niet op een factuur zetten.

| soort | eenheid | meetweg | plafond |
|---|---|---|---|
| `ai-invoer` | 1.000 tokens | gemeten | gemeten |
| `ai-uitvoer` | 1.000 tokens | gemeten | gemeten |
| `verzoek` | 1.000 verzoeken | gemeten | gemeten |
| `opslag` | GB-maand | gemeten | gemeten |
| `bericht` | 1 bericht | gemeten | gemeten |
| `transactie` | 1 transactie | gemeten | gemeten |
| `transactiewaarde` | 1 euro omzet | gemeten | gemeten |
| `stroom` | toegerekend | **toegerekend** | **vermoed** |
| `hosting` | toegerekend | **toegerekend** | **vermoed** |

**Het plafond wordt afgeleid uit de meetweg en niet per regel ingetikt.** Dat is
geen stijlkeuze: het stond er eerst wel per regel, en een mutatie liet zien
waarom dat fout was. Het plafond van `stroom` op `gemeten` zetten veranderde
niets, want `toerekening.js` schreef zijn eigen `vermoed` op. Twee plekken die
hetzelfde bedoelen, en geen van beide die de ander tegenhield. Nu is er één plek
en die bijt -- `test/kosten.test.js` is er tegen gemuteerd.

**Waarom AI in twee soorten valt:** invoer- en uitvoertokens kosten bij elke
aanbieder een ander bedrag. Eén soort zou een gemiddelde nodig hebben, en een
gemiddelde over twee uiteenlopende prijzen is een verzonnen getal.

**Waarom transactiekosten in twee soorten vallen:** een betaalpartner rekent een
vast bedrag per transactie **plus** een deel van het bedrag. Wie dat in één
eenheid propt, rekent een tikkie van 5 euro even duur als een boeking van 5.000.

---

## 3. Elektriciteit: de eerlijke vorm van een schatting

RTG heeft geen stroommeter per lid en krijgt er ook nooit een. Een lid deelt een
machine met duizend anderen, en de stroom van dat rek staat op een nota van de
hoster. `server/kern/toegankelijk.js` zei het al met zoveel woorden: *RTG meet
geen energie.*

Wat er wél is, is de **nota**. Die wordt verdeeld (`toerekening.js`).

- **De sleutel:** het aandeel in de gemeten directe kosten van die maand. Wie een
  tiende van alle gemeten kosten veroorzaakte, krijgt een tiende van de stroom.
- **De sleutel is niet volmaakt, en dat staat erbij.** Externe AI-tokens draaien
  op de stroom van de aanbieder en niet op die van ons; voor een AI-zware
  gebruiker rekent deze sleutel aan de hoge kant. Wie een betere sleutel heeft,
  verandert hem op één plek.
- **Het huis doet mee in de sleutel.** Verbruik zonder eigenaar (cronrondes,
  achtergrondwerk, bezoekers zonder account) krijgt zijn eigen deel, en dat deel
  gaat níét naar de leden.
- **Geen nota, geen verdeling.** Dan een reden, geen bedrag.
- **De delen tellen op tot de nota, tot op de cent** (restverdeling naar de
  grootste resten). Zonder die stap raakt er per maand een handvol centen zoek,
  en dan is de vraag welke gebruiker die had moeten dragen.

---

## 4. Wie betaalt: vier standen

`kern/kosten/beleidkaart.js` -- een tabel zonder logica, apart van de machinerie
die hem uitvoert. Wie wil weten wat RTG belooft, moet daar niet doorheen hoeven.

| stand | wat het betekent |
|---|---|
| `inbegrepen` | de bijdrage van deze pas dekt het; er gaat niets naar de factuur |
| `doorbelasten` | het gemeten bedrag gaat als **één regel** naar de maandfactuur die er al is |
| `rtfoundation` | het gezin ziet wat het kost en krijgt er nooit een rekening voor |
| `huis` | verbruik zonder eigenaar; onze eigen rekening |

De standaardverdeling:

| pas | stand | waarom |
|---|---|---|
| gratis | inbegrepen | geen bijdrage; wat dit kost draagt RTG zelf, en het overzicht laat zien hoeveel |
| RTG Pass | inbegrepen | de maandbijdrage dekt het |
| Lifestyle Pass | inbegrepen | de maandbijdrage dekt het |
| Business Pass | inbegrepen | op maat afgesproken; het verbruik hoort in die afspraak |
| **RTG Lite** | **doorbelasten** | *bestaat nog niet* |
| **Business Lite** | **doorbelasten** | *bestaat nog niet* |
| zaak | inbegrepen | wat een zaak betaalt staat in zijn leverancierscontract |
| gezin (RTF) | rtfoundation | de RTFoundation is gratis voor elk gezin |
| huis | huis | onze eigen rekening |

**RTG Lite en Business Lite staan er al en bestaan nog niet.** Dat is met opzet
de eerlijke vorm: `bestaatNog: false`, zoals TENANT.md het met `nietGebouwd`
doet. De machinerie werkt zodra die passen er zijn, en tot dan zegt het voorstel
dat er nul gebruikers op zitten -- in plaats van dat er een pas verschijnt die
niemand kan kopen.

**Twee standen zijn geen instelling.** `gezin` en `huis` zijn beloften. Een
schakelaar waarmee de RTFoundation alsnog gaat factureren, is geen configuratie
maar het intrekken van "gratis voor elk gezin"; de boardroom krijgt daar een
weigering mét die reden. De andere passen kan de boardroom wél verzetten -- met
een opgeschreven reden, want dit verandert wat een lid op zijn rekening krijgt.

**Onder de drempel (5 euro) gaat er niets de deur uit.** Een rekening die minder
oplevert dan hij kost is geen inkomsten maar ergernis; het bedrag schuift door.

---

## 5. De RTFoundation

Een gezin **ziet** wat het kost, individueel, en krijgt er **nooit** een rekening
voor. De RTFoundation draagt het, en het huisbeeld toont dat als een eigen blok:
hoeveel gezinnen, wat ze samen kosten, en wie dat betaalt.

Per gezin komt er dus altijd "dekt niet" uit. Dat is geen probleem dat opgelost
moet worden maar de bedoeling.

Het gezin ziet het zelf op `/api/foundation/kosten`, en dat antwoord **opent met
de belofte en niet met het bedrag**: het veld `betaald` staat vooraan en zegt dat
de RTFoundation dit betaalt en dat er nooit een rekening komt. Een kostenbeeld dat
opent met een bedrag leest als een openstaande post, en dat is precies de indruk
die hier niet mag ontstaan. Er staat ook geen vergelijking bij ("meer dan andere
gezinnen") -- LEVEN.md: de bijdrage-spiegel is nooit vergelijkend.

**Alleen de beheerder.** Niet omdat het geheim is, maar omdat dit een cijfer over
het hele gezin is en een kind geen boodschap heeft aan wat het kost dat het sommen
oefent. Dezelfde regel waarom de progressielaag bij 18+ stopt: je legt een bedrag
niet naast een kind neer.

De stand van het fonds staat er als **context** naast, met de mededeling erbij
dat het een stand sinds het begin is en geen maandbedrag -- twee getallen over
een verschillende periode naast elkaar zetten leest als een vergelijking die er
niet is.

---

## 6. Waar de metingen vandaan komen

De meter (`meter.js`) houdt **tellers, geen journaal**: per gebruiker per maand
één rij met een teller per soort. Een gedragslogboek per lid ("om 14:03 vroeg dit
lid 812 tokens") groeit oneindig en is voor een factuur niet nodig -- op een
rekening staat een totaal. Wat er niet is, kan ook niet uitlekken. Vierentwintig
maanden blijven staan.

**De tellers worden gebufferd en niet per verzoek weggeschreven.** Deze meter
hangt aan de poort, dus hij ziet ook de duizenden verzoeken die alleen lezen. Zou
hij daar meteen `save()` op doen, dan wordt elk leesverzoek van dit huis een
schrijfactie -- het soort verandering dat in een demo niets doet en in productie
de opslag verdubbelt. Dus: optellen in het geheugen, en in één keer wegschrijven.
Elke lezer spoelt eerst, en een timer spoelt wat blijft liggen. Bij een harde kill
kan hooguit een paar seconden aan tellers verloren gaan; die ruil is bewust en
staat in de code zodat hij niet stil is.

Wie de kosten draagt komt uit de **async-context** (`haak.js`, dezelfde techniek
als `server/db/bijeen.js`), één keer gezet door de poort:

| aansluiting | waar | wat |
|---|---|---|
| leden-poort | `opzet/diensten2.js` (`auth`) | drager + pas, en 1 `verzoek` |
| zaak-poort | `opzet/leverancierpoort.js` (`supplierAuth`) | drager op de **zaakcode**, en 1 `verzoek` |
| RTF-poort | `foundation/kostenpoort.js` | drager op de **gezinscode**, en 1 `verzoek` |
| AI-uitwijk | `server/ai.js` | `ai-invoer` en `ai-uitvoer` uit `usage`, bij elke aanbieder |

De drager van een zaak is de **zaakcode en niet de medewerker**: de rekening gaat
naar het bedrijf, en een teller per medewerker zou een productiviteitscijfer per
mens zijn. HORECA.md is daar niet vaag over.

**Wat er nog NIET is aangesloten**, en dus als reden in het overzicht staat in
plaats van als nul: `opslag`, `bericht`, `transactie` en `transactiewaarde`. De
soorten en tarieven staan er; er is nog geen teller die ze per gebruiker optelt.

---

## 7. De zelfcontrole

Voor elke gemeten soort waarvan de boardroom ook de echte nota heeft ingevoerd,
zet het overzicht twee getallen naast elkaar: **de optelsom van alle gebruikers**
(tellers maal tarief) en **de rekening**. Lopen ze uiteen, dan klopt het tarief
niet of mist de meter verbruik.

Dat verschil wordt getoond en niet weggewerkt. Een kostenbeeld zonder afstemming
vertelt je niet dat het misschien de helft mist.

---

## 8. Wat deze laag NIET doet

- **Geen tweede geldstroom.** Een doorbelasting is één regel in dezelfde
  `invoices`-lijst waar de maandbijdrage in staat, zodat betalen met de kaart,
  met munten, uit het RTG Pay-saldo, de PDF en de btw-aangifte er zonder
  wijziging bij kunnen (WAARDE.md).
- **Geen tweede boekhouding.** De btw komt uit `kern/fiscaal/tarief.js`, de
  pasprijs uit de geldregie, de 30%-afdracht uit `kern/fonds.js`. Een
  verbruiksregel is géén contributie, dus die 30% hoort er niet af -- en de
  omschrijving bevat de woorden waar `fonds.js` op let daarom bewust niet.
- **Geen automatische afschrijving.** Vrijgeven zet een factuurregel klaar; het
  innen loopt langs de wegen die er al zijn.
- **Geen naam bij een codenaam.** Ook niet voor het kantoor.
