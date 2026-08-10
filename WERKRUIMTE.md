# RTG Spatial Workspace

> **RTG Desktop is not a collection of pages. It is a movable operational space.**

`ONTWERP.md` legt de vormtaal vast, `PLATFORM.md` hoe apps zich tot elkaar
verhouden. Dit bestand legt vast hoe RTG zich op een groot scherm gedraagt — en
dat is fundamenteel iets anders dan de mobiele app, niet een uitvergroting
ervan.

Wat het **niet** wordt:

- geen grotere mobiele app;
- geen klassieke Windows-desktop met titelbalken en drie knopjes;
- geen SaaS-sidebar links met één pagina rechts;
- geen `max-width: 1200px` op een 32-inch scherm.

---

## 1. Drie omgevingen, één shell

| Naam | Voor | Waar |
|---|---|---|
| **RTG Mobile** | de persoonlijke wereld | telefoon, het bestaande OS |
| **RTG Workspace** | waar iemand werkt | laptop en groter |
| **RTG Command** | besturing en toezicht | operations, directie, security |

Eronder ligt **de RTG Spatial Shell**: vensters, docking, formaat, context,
slepen, werkruimtes, toetsenbord, meerdere schermen en AI-schikking. Elke app
erft dat gedrag; geen enkele app vindt zelf uit hoe desktop werkt. Dat is niet
alleen prettiger, het is de enige manier waarop twintig apps hetzelfde blijven
doen.

---

## 2. De centrale console

Midden op het scherm staat een smalle console (420–520px). Geen menu met twintig
apps, maar **de huidige context**:

```
RTG COMMAND
Rahul · Nederland / RTG
⌘K  Vraag of open iets

NU          3 dingen vragen aandacht
WERELDEN    Reizen · Geld · Werk · Salon · Huis
ACTIEF      Reizen · Mail · Agenda · Finance
RAHUL       "Wat wil je doen?"
```

De console is het **anker**, niet de navigatie-sidebar. Alles eromheen is vrije
werkruimte: een digitale commandotafel.

**De console beweegt mee.** Bij één open app staat hij naast die app; bij vier
staat hij in het midden met apps eromheen; wordt één app dominant, dan schuift de
console naar de rand. De werkruimte vormt zich rond het werk, niet andersom.

---

## 3. Surfaces, geen vensters

Een app is een **surface**. Een surface kan bewegen, van formaat veranderen,
docken (links/rechts/boven/onder), zweven, tijdelijk volledig scherm worden,
inklappen tot een smalle rail, aan de console vastklikken, naar een tweede
scherm, en samen met andere surfaces als werkruimte worden bewaard.

**Frameless.** Geen dikke rand, geen titelbalk met drie knopjes — dat is Windows
in bordeaux. In plaats daarvan één **dunne gouden RTG Handle** bovenaan:

```
 ─────────                         ← de handle: pakken = bewegen
 REIZEN                       ···
 ─────────────────────────────────
 3 komende reizen    + Nieuwe reis
 29 AUG   Ibiza
 17 SEP   Gstaad
 06 OKT   Monaco
```

| Handeling | Gevolg |
|---|---|
| handle slepen | surface beweegt |
| naar schermrand slepen | dockt daar |
| naar de console slepen | koppelt eraan |
| dubbelklik op handle | focus (Deep) |
| rand aanwijzen | `grab · resize · dock` verschijnt subtiel |

---

## 4. Drie zoomniveaus per surface

| Stand | Toont |
|---|---|
| **Glance** | `REIZEN · 3 komend · 3 wachten · €5.830` |
| **Work** | het register, de normale app |
| **Deep** | register + filters + dossier + tijdlijn |

Klik je Finance aan terwijl Reizen Deep staat, dan wordt Finance Deep en krimpt
Reizen vanzelf naar Glance. Daardoor voelt de werkruimte vloeiend in plaats van
als een stapel vensters.

---

## 5. RTG Context Linking

Dit maakt het meer dan een windowmanager. Selecteer je in Reizen een boeking:

```
RTG-R-6F612F · Ibiza
```

dan volgt de rest **automatisch**:

| Surface | Wordt |
|---|---|
| Mail | berichten over RTG-R-6F612F |
| Finance | transacties gekoppeld aan die boeking |
| Agenda | Ibiza, 29 augustus |
| Bestanden | documenten van deze reis |
| Rahul | context: Ibiza / RTG-R-6F612F |

Vijf zelfstandige apps gedragen zich tijdelijk als één applicatie. Dat is exact
de super-app-regel uit `PLATFORM.md`: **de apps houden hun diepte, de bovenlaag
verbindt ze.**

**De regel eronder:** de shell verstuurt alleen een **verwijzing** (soort, id,
label), nooit een kopie van de gegevens. Elke surface lost die verwijzing op met
zijn eigen sessie en zijn eigen rechten. Anders wordt de werkruimte een sluiproute
om iets te zien waar je niet bij mag — precies de fout die de Media OS bij het
delen van een stuk in een gesprek al vermeed.

---

## 6. Objecten slepen tussen apps

Niet alleen surfaces bewegen; de **objecten** bewegen door RTG heen.

| Sleep | Naar | Gevolg |
|---|---|---|
| een mail | Reizen | toevoegen aan dossier |
| een persoon | Agenda | uitnodigen |
| een factuur | een boeking | koppelen |
| een foto | Salon | nieuwe post |
| een voertuig | Dispatch | toewijzen |
| een hotelreservering | Agenda | reisblok toevoegen |

Dat maakt het een *operating environment* en geen verzameling webpagina's.

**Een sleep is een voorstel, geen handeling.** Loslaten toont wat er gaat
gebeuren en wie het uitvoert; bevestigen doet een mens. Dezelfde drempel als bij
geld en bij Rahul (`CLAUDE.md`).

---

## 7. Werkruimtes

Een gerangschikte set surfaces is opslaanbaar en met één klik terug te halen.

```
Mijn Directie   Command centraal · Finance linksboven · Agenda linksonder
                Operations rechts · Mail als rail · Rahul in Command

Reisbureau      Reizen rechts · Mail links · Klantdossier rechts
                Agenda onder · Finance zwevend

Restaurantavond Kassa · keuken · reserveringen · bezetting · voorraad
```

Eén klik en de hele kamer staat er. Dat voelt zwaarder dan "apps openen", en dat
is het ook.

---

## 8. Extra pixels worden extra informatie

| Scherm | Comfortabel |
|---|---|
| laptop | 2–3 surfaces |
| 27 inch | 3–4 |
| ultrawide | 5–6 |
| twee schermen | één werkruimte over beide |

Een 32-inch scherm hoort **méér RTG** te tonen dan een laptop, niet hetzelfde
maar groter. De dichtheid schaalt mee (`ONTWERP.md` par. 2): meer ruimte betekent
een dichtere modus, niet grotere letters.

---

## 9. Rustig blijven met vijf apps open

Vijf surfaces mogen nooit vijf gekleurde vensters worden.

- diep zwart/antraciet als grond;
- bordeaux voor grote omgevingsvlakken;
- ivoor voor tekst;
- **goud alleen voor focus, autoriteit en interactie**;
- één uiterst subtiele contextkleur per actieve wereld.

Een surface draagt: 1px haarlijn, minimale radius, zachte diepte, en een dunne
gouden handle **alleen als hij actief is**. Precies één surface is actief.

**Ruimte tussen de surfaces** (12–20px workspace gutters) is geen decoratie: het
is wat maakt dat de apps als losse voorwerpen op een commandotafel liggen in
plaats van als een dichtgeplempt raster. Dat is de combinatie waar het om gaat —
lucht én informatiedichtheid.

---

## 10. De console is de navigator

Geen sidebars overal. `⌘K` in de console doet het werk:

```
facturen ibiza        → Finance opent, gefilterd op Ibiza
boekingsnummer 6F612F → Reizen opent dat dossier
maak ruimte voor mail → Rahul herschikt de werkruimte
```

En daarmee wordt Rahul nuttig in plaats van decoratief:

> *"Zet mijn werkdag klaar."* → Agenda linksboven, Mail links, Werk centraal,
> CRM rechts, console versmalt, drie urgente onderwerpen open.
>
> *"Ik wil alleen alles rondom Ibiza zien."* → irrelevante surfaces sluiten,
> Reizen + Mail + Finance + Bestanden + Agenda openen, alle vijf op Ibiza.

Ook hier geldt de bestaande drempel: **Rahul schikt de ruimte, maar verstuurt
niets en betaalt niets.** Een model dat vensters verplaatst is iets anders dan
een model dat handelingen doet.

---

## 11. De volgorde van bouwen

Klein en omkeerbaar, en elke stap levert op zichzelf iets op.

1. ✅ **Deze specificatie.**
2. **De shell-primitieven**: surface, handle, verplaatsen, docken, de drie
   zoomstanden, en de gutters. Zonder inhoud, puur het gedrag.
3. **De console** als anker, met de actieve surfaces erin.
4. **Context Linking**: de verwijzingenbus, en twee apps die erop reageren.
5. **Werkruimtes** bewaren en terughalen.
6. **⌘K** in de console.
7. **Slepen van objecten** tussen surfaces, met de bevestigingsstap.
8. **Rahul schikt de ruimte.**

Stap 2 en 3 zijn de voorwaarde voor de rest: zolang een surface geen shell-gedrag
erft, bouwt elke app zijn eigen desktop en zijn we terug bij twintig stijlen.
