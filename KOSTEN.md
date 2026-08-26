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

**Deze laag rekent; `ECONOMIE.md` bepaalt wie mag betalen.** De vier economische
werelden en de firewall ertussen staan daar (`kern/economie/`). Wat hieronder over
verdelen en doorbelasten staat, gaat langs die firewall: in de grondstand is er
geen enkele relatie vastgelegd en wordt er tussen twee werelden dus **niets**
doorbelast. Dat is geen storing maar de veilige stand.

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
| `opslag` | GB-maand | gemeten (**stand**) | gemeten |
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

**Stroom of stand, en dat is geen woordspel.** Zes van de zeven meetbare soorten
zijn een **stroom**: tokens, verzoeken, berichten en transacties gebeuren, en je
telt ze op. Opslag is een **stand**: er staat op enig moment zoveel, en die peil
je. Wie een stand als stroom telt, rekent een lid dat een maand lang niets doet
bij elke peiling opnieuw zijn hele kluis aan -- en dan groeit de rekening van wie
niets doet het hardst. Het peilen woont daarom in `meterstand.js`, apart van de
tellers, en houdt het **gemiddelde** over de peilingen van de maand: een GB-maand
is een oppervlakte en geen momentopname.

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

- **Eerst per wereld.** De nota gaat eerst over de vier economische werelden
  (ECONOMIE.md par. 4) en pas daarna binnen elke wereld over haar eigen
  gebruikers. Een gezin krijgt dus nooit een cent uit het deel van de zaken, en
  andersom. Elk werelddeel gaat langs de firewall; zonder relatie blijft het
  bedrag bij RTG, met de reden erbij.
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
| gezin (RTF) | rtfoundation | de RTFoundation is gratis voor elk gezin; zij betaalt uit haar eigen begroting (`kern/rtfos/geld.js`) |
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

**Wat de async-context wel en niet weet.** Alles wat tijdens een verzoek gebeurt
krijgt die gebruiker als eigenaar, ook werk dat na het antwoord doorloopt. Dat is
meestal juist -- hij veroorzaakte het -- maar het klopt niet als een verzoek een
taak start die voor iedereen werkt (een cache die opnieuw wordt gevuld, een ronde
die toevallig door hem werd getriggerd). Die kosten landen dan bij hem in plaats
van bij het huis. Wie zo'n taak schrijft, hoort hem los te trekken van de context;
tot dat ergens knelt is dit een bekende scheefheid en geen opgelost probleem.

**Alle negen soorten zijn nu aangesloten.** Waar ze hangen:

| soort | waar | hoe |
|---|---|---|
| `ai-invoer` / `ai-uitvoer` | `server/ai.js` | uit `usage`, bij elke aanbieder |
| `verzoek` | de drie poorten | een per afgehandeld verzoek |
| `bericht` | `server/mail.js` (mail) en `server/mail-lokaal.js` (sms) | elk bericht dat het huis aanneemt te versturen; twee choke points, want er is een aanroeper die rechtstreeks langs `sendSms` komt |
| `opslag` | `kern/kosten/peiling.js` via de onderhoudsronde | de ledenkluis, gepeild en gemiddeld, hooguit een keer per uur |
| `transactie` / `transactiewaarde` | `kern/pay/opladen.js` | op het **oplaadmoment**: daar komt geld van buiten binnen (WAARDE.md par. 1). Wat een lid daarna met zijn saldo doet, kost de betaalpartner niets meer |
| `stroom` / `hosting` | `kern/kosten/toerekening.js` | verdeeld uit de echte nota, per wereld |

De opslagmeter dekt de **ledenkluis**, niet alle bytes van het huis: de media van
zaken, de back-ups en de bijlagen van RTmail staan elders en tellen niet mee. De
soort zegt dat zelf in zijn grond.

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


---

## 9. De herkomstketen: waarom betaal ik dit?

`kern/kosten/herkomst.js`. Elk bedrag is terug te lopen:

```
bedrag -> aantal x tarief -> de bron van dat tarief -> de leveranciersfactuur
       -> ingevoerd door een mens, op een dag
```

Voor een toegerekende regel loopt hij anders en dat staat er ook: bedrag ->
verdeelsleutel -> nota -> factuur.

**De keten eindigt bij een mens en niet bij een provider**, en dat is de laatste
schakel die er zelf bij staat. Er wordt geen PDF ingelezen en niets bij de
leverancier geverifieerd; wat in `kern/kosten/providerfactuur.js` staat is wat
iemand heeft overgenomen. Een keten die zich voordoet als bewijs tot aan de bron,
is erger dan een keten die zegt waar hij ophoudt.

Een leveranciersfactuur heeft een leverancier, een nummer en een bedrag, en
bestaat maar één keer per nummer. Een tarief of een nota kan ernaar verwijzen, en
dan wordt de bron **afgeleid** in plaats van ingetikt -- twee keer dezelfde
herkomst intikken levert twee teksten op die uiteenlopen.

Routes: `/api/kosten/herkomst` (eigen regel; de drager komt uit de sessie en er
is geen parameter om die van een ander te vragen) en
`/api/office/kosten/herkomst`.

---

## 10. Een maand sluiten: no unexplained cost

`kern/kosten/periode.js`. Drie standen, en de middelste heeft tanden:

| stand | wat het betekent |
|---|---|
| `open` | er is nog niet naar gekeken. De grondstand. |
| `in-onderzoek` | er is een verschil gevonden dat nog niet klopt. **In deze stand gaat er niets naar de rekening van een lid.** |
| `gesloten` | elk verschil is verklaard. De nota's van die maand zijn niet meer te veranderen. |

**Twee soorten verschil, en ze zijn niet hetzelfde.** *Afstemming*: onze optelsom
tegenover de echte nota -- loopt dat uiteen, dan klopt het tarief niet of mist de
meter verbruik. *Onverdeeld*: een nota voor stroom in een maand waarin niemand
iets verbruikte. Dat is geld dat het huis heeft uitgegeven zonder dat er iemand
tegenover staat, en precies het soort post dat anders in "overige kosten"
verdwijnt.

**Een verklaring is tekst en geen vinkje.** Er wordt niet gecontroleerd of hij
waar is -- dat kan software niet -- maar wel dat er iets staat, met een naam en
een datum eronder. Over een jaar is dat het enige antwoord dat er nog is.

**Een maand die nog loopt gaat niet dicht**, en heropenen vraagt een reden: op een
gesloten maand kunnen facturen zijn gebaseerd. Alles staat in een journaal dat
aangroeit.

---

## 11. De vooruitblik, en waarom er meestal geen bandbreedte staat

`kern/kosten/vooruitblik.js`. De projectie is eenvoudig: verbruik tot nu toe,
gedeeld door de dagen die voorbij zijn, maal de dagen van de maand -- gerekend in
millicenten en één keer afgerond, want op hele centen valt een klein lid stil.

De zin eronder is het moeilijke deel. **Een bandbreedte is een belofte.**
"Verwacht 284,20, marge 279-289, betrouwbaarheid 99,1%" is een verzinsel met een
decimaal zolang niemand die 99,1% heeft nagemeten. Dus:

- de projectie staat er altijd, met de graad van de cijfers eronder;
- de **band staat er alleen** als er ten minste drie afgesloten maanden zijn met
  een opgeschreven voorspelling om hem op te baseren;
- en zolang dat niet zo is, staat er **waarom niet**.

De meting werkt doordat de onderhoudsronde elke dag de projectie van de lopende
maand vastlegt. Is die maand voorbij, dan staat de werkelijke uitkomst ernaast.
De trefzekerheid wordt gemeten op het **huistotaal** en niet per gebruiker; dat
scheelt een snapshot per lid per dag (een gedragslogboek in vermomming), en het
antwoord zegt zelf dat het over het geheel gaat.

---

## 12. Verbruiksgrenzen die echt weigeren

`kern/kosten/grens.js`. Twee dingen die van elkaar verschillen:

- **waarschuwen** -- erboven staat er een melding bij het verbruik; er verandert
  niets aan wat er kan;
- **een plafond** -- erboven gaat de **AI-weg dicht** voor die gebruiker. Niet de
  hele app: alles blijft werken in de regelgestuurde werkmodus die dit huis toch
  al heeft voor als er geen model is. Dat is het verschil tussen een grens en een
  storing.

**Twee sloten, en de strengste wint.** Een lid zet er een voor zichzelf; het
kantoor zet er een voor een gebruiker (fair use). Een lid dat de kantoorgrens zou
kunnen ophogen, heeft geen kantoorgrens.

**Standaard is er geen grens**, en `geen-grens` is een andere stand dan `ruim`.
Een ingebouwd plafond dat niemand heeft gekozen, gaat op de dag dat het bijt over
voor een storing.

De grens hangt aan `kern/kosten/haak.js` en wordt gevraagd in `server/ai.js`,
vlak voordat er een model wordt aangeroepen. Een **kapotte** grenswacht sluit de
AI-weg niet: hij geeft dan groen. Het omgekeerde zou betekenen dat een fout in de
boekhouding de AI van het hele huis stilzet.
