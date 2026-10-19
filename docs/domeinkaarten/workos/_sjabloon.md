# Sjabloon: premiumdomeinkaart per app (WorkOS)

Elke app-kaart in deze map volgt deze vorm. De opdracht komt van de eigenaar
(19 oktober 2026, drie rondes: Beyond Premium, de bijstelling en de aanscherping).
De architectuurregels blijven onverkort: geen nieuwe laag of motor, geen centrale
database, geen tweede eigenaar, geen work_items-tabel (ARBEID.md par. 2), AI
lokaal-eerst en nooit juridische autoriteit, een voorspelling is nooit een feit,
de merkregels. Dit is een KAART en geen bouwopdracht: een functie wordt pas werk
als de eigenaar haar per familie toezegt.

## Kop

`# <App> (<functie-id>)`, gevolgd door een regel met de eigenaar uit
SCHERMEIGENAAR.json, de ingang en de doelgroep (lid, zaak, kantoor).

## a. Inventaris van het bewezen bestaande

- Wat er staat: schermen, routes, kern, opslag, met paden.
- Wat BEWEZEN is, met de bron. Het bewijs komt uit:
  - APPWERKT.json, de acht bewijzen per functie (stempel noemen);
  - VOLTOOIPROEF.json en de verse voltooiproef op deze tak;
  - BEVOEGD.json en IDOR.json.

  Een functie die er staat maar niet bewezen is, heet "staat, onbewezen".
- Wat de code of het document zelf als "niet gebouwd" opgeeft.

## b. Marktvergelijking

Kies 2 à 3 marktleiders, ook het duurste enterprisepakket. Geef per leider:
- wat achter de betaalmuur zit;
- of wij dat hebben: ja, half of nee;
- de bron-URL en de datum.

Echte merken staan hier ALLEEN als vergelijking en nooit als partner. Een regel
die alleen via een zoeksamenvatting is gelezen, krijgt "(via zoektool, live te
controleren)".

## c. Analyse van het volledige domein

Hoe werkt dit werkgebied echt, van particulier via professioneel naar
organisatie? Beschrijf de wettelijke en normatieve eisen met bron (wet, norm,
brancheorganisatie): termijnen, bewaarplicht, rollen. Leg uit wat dat betekent
voor software.

## d. Functiecatalogus L1–L6

Gebruik deze lagen:
- L1 Persoonlijk
- L2 Professioneel
- L3 Organisatorisch
- L4 Domeinintelligentie: de bestaande scenario-engine en stuurlaag. Een
  voorspelling is nooit een feit; de uitkomst draagt een zekerheidsklasse.
- L5 Volledige levenscyclus
- L6 RTG-samenhang: wat de app uitgeeft en ontvangt, en de ketens. Geen dubbel
  eigenaarschap.

Per laag één tabel met deze kolommen:

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |

- Stand: bestaat, half of ontbreekt, met het pad.
- Kosten: klein, middel of groot.
- Bak: aanbevolen nu, later, of niet doen (met de reden).

Daarna volgen:
- **Modus LOS**: wat de kerntaak is als andere apps uit staan, en wat het scherm
  dan eerlijk zegt.
- **Modus SAMEN**: minstens één volledige gebruikersketen, stap voor stap, met
  de storingen erbij. Per storing: wat de gebruiker ziet en wat er bewaard blijft.

## e. RTG-exclusieve mogelijkheden

Wat ontstaat er alleen doordat apps, rollen en processen verbonden zijn? Noem
per mogelijkheid:
- wie de eigenaar is;
- welke capability het levert;
- waarom geen markt-app dit kan.

## f. Bouwstenen en ontbrekende koppelingen

- Bestaande modules om op te bouwen (paden).
- Ontbrekende koppelingen: van → naar, de vorm (verwijzing, projectie, gebeurtenis)
  en de toestemming.
- Twijfel over het eigenaarschap komt onder "Vraagt besluit".

## g. Prioritering

Eén tabel met de kolommen functie, bouwkosten, complexiteit, afhankelijkheden en
bak. "Aanbevolen nu" blijft binnen de bouwscope en de besluiten: verdiepen van
wat er is, geen nieuw domein.

## h. Toetsbaar eindcontract Beyond Premium

Acht dimensies, elk met een meetbare toets: breedte, professionele diepte,
levenscyclus, samenwerking en rollen, domeinintelligentie, los functioneren,
RTG-ketens en bewezen betrouwbaarheid. Geef per dimensie:
- de eis in gewone taal;
- hoe het getoetst wordt (welk script of welke proef);
- de stand nu.

Het contract VERVANGT NOOIT de acht bewijzen van APPWERKT.

## Vraagt besluit

Eigenaarsvragen in meerkeuze. Zet de aanbeveling vooraan en geef per optie wat
die kost.
