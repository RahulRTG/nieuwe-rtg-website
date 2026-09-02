# RTG Economic Control Plane

**De financiële intelligentielaag van het hele RTG-ecosysteem.**

De belofte: *every action accounted for, every cost understood, every bill
correct.* En voor de gebruiker: RTG denkt financieel mee zonder dat hij iets
hoeft uit te zoeken.

Dit is een **richtingsdocument**, zoals `PLATFORM.md` en `DEVELOPERCLOUD.md`.
Per onderdeel staat erbij of het **staat**, **een stap weg** is, **een besluit
vraagt**, of **jaren weg** is. Die vier zijn niet uitwisselbaar, en ze staan er
juist omdat een visiedocument zonder die kolom binnen een maand als
functielijst wordt gelezen.

`KOSTEN.md` is de laag eronder die vandaag draait: wat kost elke gebruiker, en
wie betaalt dat. Dit document zegt waar dat heen gaat.

---

## 1. De correctie die aan alles vooraf ging

De eerste versie van de kostprijslaag verdeelde één nota van de hoster over
**alle** gebruikers tegelijk: leden, zaken en de gezinnen van de RTFoundation in
één pot, naar hun aandeel in het gemeten verbruik. Dat rekende netjes en het
klopte niet.

**De RTFoundation is geen kostenpost van RTG die je over gebruikers uitsmeert.**
Het is een zelfstandige economische entiteit met een eigen vermogen, eigen
begrotingen, eigen bestuur en een eigen verantwoording. Die stond er in de code
zelfs al (`kern/rtfos/geld.js`: bronnen met een oormerk, uitgaven met vier ogen
en een limiet, projecten, subsidies, audit) -- alleen de kostenlaag wist dat niet.

Een gedeelde pot maakt drie dingen tegelijk kapot:

- **boekhoudkundig**: kosten van de ene rechtspersoon landen in het resultaat van
  de andere;
- **juridisch**: een subsidiegever die vraagt waar zijn geld heen ging, krijgt een
  antwoord waarin commerciële klanten voorkomen;
- **praktisch**: één programmeerfout zet Foundation-kosten op de factuur van een
  bedrijf, en dat is niet met een creditnota te repareren.

Vandaar de werelden en de firewall hieronder. Dat is het stuk dat je **niet later
kunt toevoegen** zonder de facturen van het jaar ervoor opnieuw te moeten
uitleggen; al het andere in dit document kan er wel bij komen.

---

## 2. Vier economische werelden -- **staat**

`server/kern/economie/werelden.js`. Vier economieën die niet in elkaar overlopen:

| wereld | dragers | factureert gebruikers |
|---|---|---|
| `consument` | lid | ja |
| `commercieel` | zaak | ja |
| `rtg-intern` | huis | nee |
| `rtfoundation` | gezin | **nee** |

**De wereld is een eigenschap van de identiteit en niet van de transactie.** Dat
onderscheid is de hele grap. Wie de wereld per boeking laat meegeven, laat de
aanroeper bepalen wat de grens is die hem had moeten tegenhouden. Er is daarom
ook met opzet geen route om de wereld van een gebruiker te veranderen.

`rtg-intern` **verkoopt** infrastructuur aan de andere drie. Daardoor is een
werelddeel niet alleen een kostenregel maar het begin van het antwoord op "kan
dit product op zichzelf uit".

---

## 3. De Economic Firewall -- **staat**

`server/kern/economie/firewall.js`, met het relatieregister in `relaties.js`.

Vier vragen, in volgorde, en elke nee stopt de rest:

1. Kennen we beide werelden? Onbekend is nee -- niet "waarschijnlijk het huis".
2. Is het dezelfde wereld? Dan mag het; binnen een rechtspersoon is doorbelasten
   een interne verdeling en geen levering.
3. Bestaat er een **relatie** tussen die twee werelden? Zo nee: geweigerd, met de
   reden **en met hoe het wel kan**. Een weigering die dat niet zegt, wordt
   omzeild.
4. Past het bedrag onder het **plafond** van die relatie?

**Het register is standaard leeg.** Er staat geen enkele relatie
voorgeprogrammeerd, dus in de grondstand belast RTG helemaal niets door -- ook
niet aan zijn eigen leden. Wie dat wil, legt de relatie vast met een grondslag
(welke overeenkomst of welk bestuursbesluit) en een plafond (een doorbelasting
zonder maximum is een open kraan). Beide zijn verplicht en beide worden
geweigerd als ze ontbreken.

**En er is een vijfde regel die geen relatie kan openen.** Een rekening landt bij
de **entiteit** van een wereld, nooit bij een gebruiker van die wereld. RTG mag
de stichting factureren voor infrastructuur; RTG mag daarvoor nooit een gezin
factureren, ook niet als de relatie `rtg-intern → rtfoundation` wagenwijd
openstaat. Dat is een aparte poort (`magDragerBelasten`), en de zakkende kant
ervan is beproefd -- over de routes is hij namelijk niet te raken, want het beleid
houdt een gezin al eerder tegen. Een controle waarvan je de zakkende kant nooit
hebt gezien, is geen controle.

De geldstroom is dus:

```
RTFoundation-kost -> RTFoundation Treasury -> Foundation-begroting -> betaling
```

en nooit:

```
Foundation-kost -> factuur van een willekeurige gebruiker
```

---

## 4. Verdelen per wereld -- **staat**

`server/kern/kosten/toerekening.js`, in twee stappen:

1. De nota van de infrastructuur staat in de wereld die hem betaalt
   (`rtg-intern`) en wordt eerst over de **vier werelden** verdeeld, naar hun
   gemeten verbruik. Dat geeft per economie één bedrag.
2. Elk werelddeel wordt daarna **binnen zijn eigen wereld** over de dragers
   verdeeld, tot op de cent (restverdeling naar de grootste resten).

Elk werelddeel gaat langs de firewall. Is er geen relatie, dan blijft het bedrag
bij RTG -- dat is geen fout en geen nul, en het staat er met de reden bij. Het
gezin ziet nog steeds wat het kost, alleen niet als iets dat het betaalt.

Rekenkundig is stap 2 hetzelfde als de oude gedeelde verdeling, en dat hoort
erbij: wat verandert is niet het getal van een lid maar de vraag eronder -- van
wie is deze kost, en wie mag hem betalen. Die vraag werd hiervoor niet gesteld,
en kon dus ook niet fout beantwoord worden.

---

## 5. Eén economische identiteit voor alles -- **deels; de rest vraagt een besluit**

Wat er **staat**: **vijf** dragersoorten (lid, zaak, gezin, lab, huis), elk met
een wereld, en per drager kosten, verbruik en facturen.

`lab` is de vijfde en de eerste die geen mens en geen huishouden is (31 augustus
2026). Hij staat voor een lab van het RTF Living Lab en hoort bij de wereld
`rtfoundation`, om dezelfde reden als een gezin: het is een **entiteit van de
stichting** en geen gebruiker van RTG. Hij is er niet om de lijst vol te maken
maar omdat er iets is dat hem meet -- en omdat zonder hem al het verbruik van het
lab terugviel op `huis`. Dat is de juiste terugval voor verbruik zonder eigenaar,
maar hier is er een eigenaar: RTG betaalde stilzwijgend het onderzoek van een
andere rechtspersoon, en die rechtspersoon kon niet zeggen wat haar eigen werk
kostte. Het onderzoeksgrootboek (`kern/livinglab/ledger.js`) leest die meter per
lab en per studie, en zet er het firewallbesluit naast: staat er geen relatie
`rtg-intern -> rtfoundation` met een grondslag en een plafond, dan is er **geen**
doorbelasting en staan de kosten bij RTG -- met de reden en de weg ernaartoe, en
niet als nul.

Wat er **niet** staat: vestiging, voertuig, apparaat, API-client, AI-agent,
project, afdeling, dochtermaatschappij, interne dienst. Die staan er met opzet
niet als achttien lege soorten. **Een soort zonder teller is een leeg vakje dat
als dekking leest.** Ze komen erbij op het moment dat er iets is dat ze meet.

Het besluit dat eronder ligt is niet technisch maar hetzelfde als in
`DEVELOPERCLOUD.md` par. 2: een universeel objectmodel moet worden **gevonden**
in de domeinen, niet eroverheen verklaard. `OBJECTMODEL.json` heeft die meting al
een keer gedaan en was streng -- `Asset` bestaat niet. Voor economische
identiteiten hoort diezelfde meting te gebeuren voordat er soorten worden
bijgezet.

**Wat wel een stap weg is**: een *ouder*-relatie tussen dragers (een vestiging
hoort bij een zaak, een voertuig bij een vestiging). Dat is één veld en een
optelling, en het maakt de economische graaf uit paragraaf 24 mogelijk zonder
achttien nieuwe soorten.

---

## 6. Money provenance -- **staat, tot aan de factuur die wij invoeren**

Wat er **staat**: elke kostenregel draagt het aantal, de eenheid, het tarief, de
**bron** van dat tarief (welke prijslijst, welk contract), de datum waarop dat
tarief werd gezet, en de **bewijsgraad**. Een toegerekende regel draagt daarnaast
de verdeelsleutel en de nota waar hij uit komt.

Wat er **inmiddels ook staat**: de keten loopt door tot de **leveranciersfactuur**
(`kern/kosten/providerfactuur.js`). Leverancier, nummer, bedrag; een tarief of een
nota verwijst ernaar en leidt zijn bron eruit af in plaats van hem in te tikken --
twee keer dezelfde herkomst intikken levert twee teksten op die uiteenlopen.
`kern/kosten/herkomst.js` levert de keten in de volgorde waarin je hem naleest,
met per schakel wat die schakel wel en niet zegt.

De keten eindigt bij **een mens en niet bij een provider**, en dat staat er als
laatste schakel bij: er wordt geen PDF ingelezen en niets geverifieerd. Een keten
die zich voordoet als bewijs tot aan de bron, is erger dan een keten die zegt waar
hij ophoudt.

Wat er **jaren weg** is: doorklikken van een euro naar de 812 losse AI-taken
eronder. Dat vraagt een gebeurtenislogboek per verbruik, en dat is precies wat de
meter met opzet **niet** doet: hij houdt tellers, geen journaal, omdat een
gedragslogboek per lid voor een factuur niet nodig is en niet mag uitlekken. Wie
die keten wil, moet eerst een antwoord hebben op de bewaartermijn en de
toegang -- dat is een privacybesluit en geen bouwopdracht.

---

## 7. No unexplained cost -- **staat**

Wat er **staat**: de afstemming. Voor elke gemeten soort waarvan de boardroom ook
de echte nota heeft ingevoerd, staan twee getallen naast elkaar -- de optelsom van
alle gebruikers en de rekening -- met het verschil erbij, getoond en niet
weggewerkt.

Wat er **inmiddels ook staat**: het sluiten zelf (`kern/kosten/periode.js`). Een
maand heeft een stand -- open, in onderzoek, gesloten -- en gaat pas dicht als elk
verschil een verklaring draagt, met een naam en een datum eronder. Een gesloten
maand neemt geen nota's meer aan; heropenen vraagt een reden en staat in het
journaal.

De middelste stand heeft tanden: **in onderzoek gaat er niets naar de rekening van
een lid.** Open betekent "er is nog niet naar gekeken" en dat mag; in onderzoek
betekent dat dit huis zelf heeft vastgesteld dat de cijfers niet kloppen, en dan
factureren is de duurste fout die deze laag kan maken.

Naast de afstemming telt een tweede soort verschil mee: een nota in een maand
waarin niemand iets verbruikte. Dat is geld zonder eigenaar -- geen
afrondingsverschil maar een gat, en precies het soort post dat anders in "overige
kosten" verdwijnt.

Wat er **nog niet** is: het onderzoek zelf automatiseren (prijswijziging, btw,
regio, een onbekende dienst herkennen). Dat blijft mensenwerk met een tekstveld.

---

## 8. Cost digital twin en forecast -- **staat, met een trefzekerheid die zichzelf meet**

Wat er **staat**: realtime weten wat een gebruiker deze maand tot nu toe kost, wat
inbegrepen is en wat er op de rekening zou komen.

Wat er **inmiddels ook staat**: de projectie en de meting van zijn eigen
trefzekerheid (`kern/kosten/vooruitblik.js`). De onderhoudsronde legt elke dag de
voorspelling van de lopende maand vast; is die maand voorbij, dan staat de
uitkomst ernaast en is het verschil te rekenen.

**De bandbreedte verschijnt pas als hij gemeten is** -- ten minste drie afgesloten
maanden met een opgeschreven voorspelling -- en tot dan staat er waarom niet. Dat
is BESTUUR.md par. 3 toegepast op een voorspelling: een betrouwbaarheids-
percentage dat niemand heeft nagerekend, is een verzonnen getal met een decimaal.
De trefzekerheid wordt gemeten op het **huistotaal** en niet per gebruiker -- dat
scheelt een snapshot per lid per dag, een gedragslogboek in vermomming -- en het
antwoord zegt dat zelf.

**Zero Surprise Billing** is daarmee een stap dichterbij; de **Cost Guarantee**
(par. 23) blijft een besluit: garanderen kan pas als de gemeten trefzekerheid
maanden achtereen binnen een band blijft, en die historie moet eerst groeien.

---

## 9. Automatisch optimaliseren en cost routing -- **jaren weg, en het eerste besluit ligt elders**

De richting is duidelijk: RTG kiest de goedkoopste veilige route op
`cost × latency × reliability × sovereignty × carbon × capacity`, en de gebruiker
merkt er niets van.

Wat er vandaag van staat: de AI-uitwijk kent meerdere aanbieders en schakelt over
bij een storing (`server/ai.js`), en de meter weet per aanbieder wat er verbruikt
is. Dat is de invoer voor een routeringsbesluit, niet het besluit zelf.

Wat eraan vooraf gaat, en het is geen techniek: **een kwaliteitsmaat**. "81% van
deze taken kan met een goedkoper model zonder kwaliteitsverlies" is alleen te
zeggen als er een meting van kwaliteitsverlies bestaat. Die is er niet. Zonder die
meting is automatisch overschakelen naar een goedkoper model geen besparing maar
een stille verslechtering -- en juist onzichtbaar, want de rekening wordt lager.

`sovereignty` in die formule raakt bovendien de herkomstregel uit `TENANT.md`, en
die is in geen enkele modus uit te zetten. Een router die op prijs een andere
regio kiest, verplaatst persoonsgegevens.

---

## 10. Spend guardrails en autonomous budgeting -- **guardrails staan; budgetteren wacht op historie**

Wat er **staat**: `kern/kosten/grens.js` -- waarschuwen, en een plafond dat de
AI-weg werkelijk dichtzet, afgedwongen in `server/ai.js` vlak voordat er geld
gaat. De rest van de app blijft daarbij werken in de regelgestuurde werkmodus die
er toch al is voor als er geen model is; dat is het verschil tussen een grens en
een storing. Twee sloten (het lid zelf en het kantoor), de strengste wint,
standaard geen grens, en `geen-grens` is een andere stand dan `ruim`. Een kapotte
grenswacht geeft groen: het omgekeerde zou een fout in de boekhouding de AI van
het hele huis laten stilzetten.

Wat er **een stap weg** is: hetzelfde per afdeling, per applicatie en per agent in
plaats van per gebruiker -- dat wacht op de ouder-relatie uit par. 5.

Autonomous budgeting (een voorstel op basis van zes maanden historie) vraagt
alleen die historie, en die groeit vanzelf aan: de meter bewaart vierentwintig
maanden.

---

## 11. Pricing intelligence -- **vraagt een besluit, niet een bouwopdracht**

Uit marginale kosten, gebruik en betalingsbereidheid een optimale prijs afleiden
is rekenbaar. De vraag eronder is of dit huis dat *wil*: differentiëren naar
betalingsbereidheid is prijsdiscriminatie, en dat botst met de merkregel dat de
instap premium moet aanvoelen en met de belofte van nettoprijzen in de
voorwaarden.

Adviseren zonder automatisch te wijzigen is de veilige vorm, en die staat in de
visie ook zo. Maar zelfs een advies dat de eigenaar elke maand ziet, stuurt op
den duur het beleid. Dat hoort een expliciet besluit te zijn.

---

## 12. Wat de gebruiker ervan merkt -- **de belangrijkste paragraaf**

De wauw zit niet in duizend meetbare kostentypes. Die ziet een gebruiker niet.
Hij zit hierin:

- RTG weet wat alles kost voordat jij het hoeft uit te zoeken;
- RTG probeert te voorkomen dat je te veel betaalt;
- RTG kan iedere cent uitleggen;
- RTG waarschuwt vóórdat iets duur wordt;
- en als alles normaal gaat, val je nergens mee lastig.

Die laatste is de zwaarste eis en de makkelijkste om te verliezen. De beste versie
van dit systeem is niet een cockpit met negenhonderd grafieken; het is een scherm
dat zegt dat er niets aan de hand is, en dat alleen opvalt wanneer er wél iets is.

Dat sluit aan op `WERELD.md`: er is één beginscherm en dat is een lege keuze, geen
voorgekookte statusstrook. Een kostenmelding die er elke dag staat, is over een
maand behang.

**Wat hiervan inmiddels STAAT** (`KOSTEN.md` par. 13). Dat scherm bestaat, voor
alle drie de soorten klanten: een lid ziet het in RTG Geld (stand *Kosten*), een
zaak op `/apps/zaakkosten.html`, een gezin in het beheerscherm van de
RTFoundation -- de eerste twee op één gedeelde tekenlaag, het gezin bewust in de
eigen vormtaal en toon van de stichting. Het opent met één toestand en hooguit één
bedrag; de onderbouwing staat eronder, en "waarom betaal ik dit" opent de keten
terug naar de factuur van onze eigen leverancier.

Van de vijf beloften hierboven zijn er dus **drie** waar: RTG weet wat het kost,
kan iedere cent uitleggen, en waarschuwt vóórdat het duur wordt (de eigen grens,
par. 10). Wat er **niet** staat is de tweede -- *voorkomen dat je te veel
betaalt* -- want dat is cost routing, en dat is jaren weg (par. 9). En de vijfde,
"val je nergens mee lastig", is geen functie maar een vorm: het scherm is
uitzonderingsgestuurd en er staat geen melding tegenover als er niets aan de hand
is.

Eén ding daar is strenger dan het lijkt. Zonder tarief staat er op zo'n scherm
**geen bedrag** maar de reden -- ook geen nul. Een nul leest als "gratis", en dat
is een andere bewering dan "niet bekend". Op een klantscherm is dat de
makkelijkst te breken regel van deze hele laag, en er staan drie schermtoetsen op
die precies dat vastleggen.

---

## 13. Wat er vandaag staat, kort

| onderdeel | stand | waar |
|---|---|---|
| vier werelden, wereld hoort bij de identiteit | **staat** | `kern/economie/werelden.js` |
| firewall, standaard weigeren, met hoe-het-wel-kan | **staat** | `kern/economie/firewall.js` |
| relatieregister met grondslag, plafond en journaal | **staat** | `kern/economie/relaties.js` |
| tweede poort: een gebruiker draagt nooit een andere wereld | **staat** | `kern/kosten/factuurregel.js` |
| nota's eerst per wereld, dan per gebruiker | **staat** | `kern/kosten/toerekening.js` |
| kosten per gebruiker met bewijsgraad en bron | **staat** | `KOSTEN.md` |
| afstemming gerekend tegenover werkelijke nota | **staat** | `kern/kosten/overzicht.js` |
| Foundation-treasury met oormerk, vier ogen, audit | **staat** | `kern/rtfos/geld*.js` |
| alle negen kostensoorten gemeten of verdeeld | **staat** | KOSTEN.md par. 6 |
| provenance tot de leveranciersfactuur | **staat** | `kern/kosten/herkomst.js` |
| periode sluiten met verklaarde verschillen | **staat** | `kern/kosten/periode.js` |
| projectie met gemeten trefzekerheid | **staat** | `kern/kosten/vooruitblik.js` |
| guardrails die de AI-weg dichtzetten | **staat** | `kern/kosten/grens.js` |
| het rustige klantscherm voor lid, zaak en gezin | **staat** | KOSTEN.md par. 13 |
| ouder-relatie tussen dragers (economische graaf) | **een stap weg** | par. 5 |
| guardrails per afdeling of agent | **een stap weg** | par. 10 |
| autonomous budgeting | **een stap weg** (wacht op historie) | par. 10 |
| bandbreedte en betrouwbaarheid tonen | **vraagt een besluit** | par. 8 |
| meer economische identiteiten | **vraagt een besluit** | par. 5 |
| pricing intelligence | **vraagt een besluit** | par. 11 |
| automatisch optimaliseren, cost routing | **jaren weg** | par. 9 |
| provenance tot de losse AI-taak | **jaren weg** | par. 6 |

---

## 14. De grenzen die niet mogen sneuvelen

1. **Kosten van de ene wereld komen nooit bij een gebruiker van de andere.** Twee
   poorten, en de tweede is beproefd op zijn zakkende kant.
2. **Het relatieregister is standaard leeg.** Een firewall die standaard
   doorlaat, is een logboek.
3. **Een relatie heeft een grondslag en een plafond.** Zonder grondslag is een
   doorbelasting geen levering maar een verschuiving; zonder plafond is het een
   open kraan.
4. **De RTFoundation blijft gratis voor elk gezin.** Dat is een belofte en geen
   schakelaar; `kern/kosten/beleidkaart.js` weigert hem te verzetten en zegt
   waarom.
5. **Er staat nooit een getal waar er geen is.** Geen tarief, geen nota, geen
   teller: een reden en geen nul.
6. **Er komt geen tweede boekhouding bij.** Een doorbelasting is één regel op de
   factuur die er al is; de Foundation-treasury blijft die van `kern/rtfos/`.
