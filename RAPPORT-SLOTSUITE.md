# Rapport van de Slotsuite

_Automatisch geschreven door `scripts/slotsuite.js` op 2026-07-31 01:54 UTC. Niet met de hand bijwerken:
de volgende ronde overschrijft dit bestand en leest het JSON-blok onderaan terug als geheugen._

## Oordeel

**ALLES STAAT** -- elke laag is doorlopen zonder breuk.

| Laag | Uitslag | Tijd | Toelichting |
|---|---|---|---|
| DE BOUW | staat | 1.9 s | het bouwsel stond al vers |
| DE POORTEN | staat | 35.3 s | alle stappen staan |
| DE TESTSUITE | staat | 17m 6s | alle stappen staan |
| DE TOEGANKELIJKHEID | staat | 23.3 s | alle stappen staan |
| DE BEPROEVING | staat | 4m 16s | alle stappen staan |
| DE KEURING | staat | 16.3 s | 0 stuk, 0 scheef, 126 kan beter |

## Het logica-oordeel

- endpoints die in een test voorkomen: **1756 van 2523** (70%)
- genres op pariteit bekeken: **48**
- teksten gescand op beloftes: **1743** bestanden, 2 zin(nen) eerder gewogen en goedgekeurd
- oordeel: **0 stuk, 0 scheef, 126 kan beter**

## Sinds de vorige ronde

- opgelost: **0**
- nieuw: **0**
- blijft staan: **126**

## De backlog -- wat de volgende ronde verdient

Op volgorde van gewicht. Een punt dat rondes overleeft klimt vanzelf; dat is met opzet,
want wat blijft liggen wordt niet minder waar.

1. **[BETER / dekking]** Het domein "foundation" heeft 165 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/foundation/agenda, /api/foundation/agenda/verwijder, /api/foundation/ai, /api/foundation/bord/stroke, /api/foundation/bord/undo`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
2. **[BETER / dekking]** Het domein "member" heeft 130 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/member/berichten/afspraken, /api/member/leren/herhaal, /api/member/leren/herhaal-antwoord, /api/member/leren/herhaal-stand, /api/member/leren/lijst-ai`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
3. **[BETER / dekking]** Het domein "supplier" heeft 124 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/supplier/advies/dossier/status, /api/supplier/agenda/toevoegen, /api/supplier/agenda/verwijder, /api/supplier/agenda/wijzig, /api/supplier/apply/chat/send`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
4. **[BETER / dekking]** Het domein "rtf" heeft 90 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/rtf/baby/boek, /api/rtf/baby/entry-weg, /api/rtf/baby/favoriet, /api/rtf/baby/gezin-zet, /api/rtf/baby/moment-ai`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
5. **[BETER / dekking]** Het domein "office" heeft 72 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/office/architect/verwijder, /api/office/atelier/verwijder, /api/office/atelierweb/bewaar, /api/office/atelierweb/haal, /api/office/atelierweb/lijst`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
6. **[BETER / dekking]** Het domein "werkplek" heeft 64 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/werkplek/bureau/architect, /api/werkplek/bureau/architect/bouwstaat, /api/werkplek/bureau/architect/concept, /api/werkplek/bureau/architect/kritiek, /api/werkplek/bureau/architect/maak`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
7. **[BETER / dekking]** Het domein "thuis" heeft 11 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/thuis/annuleer, /api/thuis/bericht, /api/thuis/berichten, /api/thuis/blokkeer, /api/thuis/checkuit`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
8. **[BETER / dekking]** Het domein "rtfkantoor" heeft 10 endpoint(s) zonder test. _(2e ronde open)_
   - waar: `/api/rtfkantoor/club/afspraak, /api/rtfkantoor/club/bericht, /api/rtfkantoor/club/maak, /api/rtfkantoor/club/programma, /api/rtfkantoor/club/team`
   - aanpak: Neem er de volgende ronde twee of drie mee in een bestaande testfile.
9. **[BETER / omvang]** Dit bestand zit met 10013 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/db/geheugen.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
10. **[BETER / omvang]** Dit bestand zit met 10065 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/foundation/gasten/gezinsleven.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
11. **[BETER / omvang]** Dit bestand zit met 9665 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/agenda-pro.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
12. **[BETER / omvang]** Dit bestand zit met 10090 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/antivirus/index.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
13. **[BETER / omvang]** Dit bestand zit met 10233 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/appgids-data/deel3.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
14. **[BETER / omvang]** Dit bestand zit met 9948 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/appgids-data/deel6.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
15. **[BETER / omvang]** Dit bestand zit met 9559 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/assets/winkel.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
16. **[BETER / omvang]** Dit bestand zit met 9859 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/autoverkoop/deal.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
17. **[BETER / omvang]** Dit bestand zit met 9462 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/baby.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
18. **[BETER / omvang]** Dit bestand zit met 10009 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/creator.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
19. **[BETER / omvang]** Dit bestand zit met 9446 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/eenaccount.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
20. **[BETER / omvang]** Dit bestand zit met 9439 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/factuur.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
21. **[BETER / omvang]** Dit bestand zit met 10189 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/fluister/seintjes.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
22. **[BETER / omvang]** Dit bestand zit met 9734 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/gebouw.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
23. **[BETER / omvang]** Dit bestand zit met 9472 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/geloofbieb-kern/deel2.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
24. **[BETER / omvang]** Dit bestand zit met 9755 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/genootschap/index.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
25. **[BETER / omvang]** Dit bestand zit met 9642 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/groothandel/orderlaag.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
26. **[BETER / omvang]** Dit bestand zit met 9471 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/koppel.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
27. **[BETER / omvang]** Dit bestand zit met 10033 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/marechaussee.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
28. **[BETER / omvang]** Dit bestand zit met 10103 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/markt.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
29. **[BETER / omvang]** Dit bestand zit met 10087 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/muziek-uitgave.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
30. **[BETER / omvang]** Dit bestand zit met 9717 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/overheid/rechtbank.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
31. **[BETER / omvang]** Dit bestand zit met 9541 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/rtgonderzoeker.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
32. **[BETER / omvang]** Dit bestand zit met 9510 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/rtmail-team.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
33. **[BETER / omvang]** Dit bestand zit met 9606 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/salon/index.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
34. **[BETER / omvang]** Dit bestand zit met 10119 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/spellen.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
35. **[BETER / omvang]** Dit bestand zit met 10217 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/staffseed.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
36. **[BETER / omvang]** Dit bestand zit met 9805 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/thuis/boeken.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
37. **[BETER / omvang]** Dit bestand zit met 9423 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/webmaker.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
38. **[BETER / omvang]** Dit bestand zit met 9423 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/werkplek.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
39. **[BETER / omvang]** Dit bestand zit met 9680 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/werkvenster.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.
40. **[BETER / omvang]** Dit bestand zit met 10115 bytes vlak onder de grens van 10.240. _(6e ronde open)_
   - waar: `server/kern/zaakdoos/index.js`
   - aanpak: Knip er een deelbestand af zolang het rustig kan.

_(nog 86 punten van lagere prioriteit; zie het JSON-blok.)_

## Wat deze suite niet bewijst

- Eén machine, één node; geen echte productie-opslag en geen echt netwerk tussen de lagen.
- De Keuring leest de code, niet de bedoeling: zij vermoedt, en een mens weegt.
- De dekkingscijfers tellen of een endpoint in een test VOORKOMT, niet of hij goed getoetst is.
- De Beproeving draaide in sqlite-modus tenzij DATABASE_URL was gezet; de 100M-schaal vraagt Postgres.

<!-- geheugen van de Slotsuite; hier leest de volgende ronde uit terug -->
```json
{
 "ronde": "2026-07-31 01:54",
 "gezakt": 0,
 "backlog": [
  {
   "sleutel": "dekking|/api/foundation/agenda, /api/foundation/agenda/verwijder, /api/foundation/ai, /api/foundation/bord/stroke, /api/foundation/bord/undo|Het domein \"foundation\" heeft 165 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"foundation\" heeft 165 endpoint(s) zonder test.",
   "waar": "/api/foundation/agenda, /api/foundation/agenda/verwijder, /api/foundation/ai, /api/foundation/bord/stroke, /api/foundation/bord/undo",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/member/berichten/afspraken, /api/member/leren/herhaal, /api/member/leren/herhaal-antwoord, /api/member/leren/herhaal-stand, /api/member/leren/lijst-ai|Het domein \"member\" heeft 130 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"member\" heeft 130 endpoint(s) zonder test.",
   "waar": "/api/member/berichten/afspraken, /api/member/leren/herhaal, /api/member/leren/herhaal-antwoord, /api/member/leren/herhaal-stand, /api/member/leren/lijst-ai",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/supplier/advies/dossier/status, /api/supplier/agenda/toevoegen, /api/supplier/agenda/verwijder, /api/supplier/agenda/wijzig, /api/supplier/apply/chat/send|Het domein \"supplier\" heeft 124 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"supplier\" heeft 124 endpoint(s) zonder test.",
   "waar": "/api/supplier/advies/dossier/status, /api/supplier/agenda/toevoegen, /api/supplier/agenda/verwijder, /api/supplier/agenda/wijzig, /api/supplier/apply/chat/send",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/rtf/baby/boek, /api/rtf/baby/entry-weg, /api/rtf/baby/favoriet, /api/rtf/baby/gezin-zet, /api/rtf/baby/moment-ai|Het domein \"rtf\" heeft 90 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"rtf\" heeft 90 endpoint(s) zonder test.",
   "waar": "/api/rtf/baby/boek, /api/rtf/baby/entry-weg, /api/rtf/baby/favoriet, /api/rtf/baby/gezin-zet, /api/rtf/baby/moment-ai",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/office/architect/verwijder, /api/office/atelier/verwijder, /api/office/atelierweb/bewaar, /api/office/atelierweb/haal, /api/office/atelierweb/lijst|Het domein \"office\" heeft 72 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"office\" heeft 72 endpoint(s) zonder test.",
   "waar": "/api/office/architect/verwijder, /api/office/atelier/verwijder, /api/office/atelierweb/bewaar, /api/office/atelierweb/haal, /api/office/atelierweb/lijst",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/werkplek/bureau/architect, /api/werkplek/bureau/architect/bouwstaat, /api/werkplek/bureau/architect/concept, /api/werkplek/bureau/architect/kritiek, /api/werkplek/bureau/architect/maak|Het domein \"werkplek\" heeft 64 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"werkplek\" heeft 64 endpoint(s) zonder test.",
   "waar": "/api/werkplek/bureau/architect, /api/werkplek/bureau/architect/bouwstaat, /api/werkplek/bureau/architect/concept, /api/werkplek/bureau/architect/kritiek, /api/werkplek/bureau/architect/maak",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/thuis/annuleer, /api/thuis/bericht, /api/thuis/berichten, /api/thuis/blokkeer, /api/thuis/checkuit|Het domein \"thuis\" heeft 11 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"thuis\" heeft 11 endpoint(s) zonder test.",
   "waar": "/api/thuis/annuleer, /api/thuis/bericht, /api/thuis/berichten, /api/thuis/blokkeer, /api/thuis/checkuit",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "dekking|/api/rtfkantoor/club/afspraak, /api/rtfkantoor/club/bericht, /api/rtfkantoor/club/maak, /api/rtfkantoor/club/programma, /api/rtfkantoor/club/team|Het domein \"rtfkantoor\" heeft 10 endpoint(s) zonder test.",
   "soort": "beter",
   "groep": "dekking",
   "tekst": "Het domein \"rtfkantoor\" heeft 10 endpoint(s) zonder test.",
   "waar": "/api/rtfkantoor/club/afspraak, /api/rtfkantoor/club/bericht, /api/rtfkantoor/club/maak, /api/rtfkantoor/club/programma, /api/rtfkantoor/club/team",
   "hoe": "Neem er de volgende ronde twee of drie mee in een bestaande testfile.",
   "rondes": 2,
   "punten": 73
  },
  {
   "sleutel": "omvang|server/db/geheugen.js|Dit bestand zit met 10013 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10013 bytes vlak onder de grens van 10.240.",
   "waar": "server/db/geheugen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/foundation/gasten/gezinsleven.js|Dit bestand zit met 10065 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10065 bytes vlak onder de grens van 10.240.",
   "waar": "server/foundation/gasten/gezinsleven.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/agenda-pro.js|Dit bestand zit met 9665 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9665 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/agenda-pro.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/antivirus/index.js|Dit bestand zit met 10090 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10090 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/antivirus/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/appgids-data/deel3.js|Dit bestand zit met 10233 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10233 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/appgids-data/deel3.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/appgids-data/deel6.js|Dit bestand zit met 9948 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9948 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/appgids-data/deel6.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/assets/winkel.js|Dit bestand zit met 9559 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9559 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/assets/winkel.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/autoverkoop/deal.js|Dit bestand zit met 9859 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9859 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/autoverkoop/deal.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/baby.js|Dit bestand zit met 9462 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9462 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/baby.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/creator.js|Dit bestand zit met 10009 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10009 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/creator.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/eenaccount.js|Dit bestand zit met 9446 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9446 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/eenaccount.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/factuur.js|Dit bestand zit met 9439 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9439 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/factuur.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/fluister/seintjes.js|Dit bestand zit met 10189 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10189 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/fluister/seintjes.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/gebouw.js|Dit bestand zit met 9734 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9734 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/gebouw.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/geloofbieb-kern/deel2.js|Dit bestand zit met 9472 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9472 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/geloofbieb-kern/deel2.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/genootschap/index.js|Dit bestand zit met 9755 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9755 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/genootschap/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/groothandel/orderlaag.js|Dit bestand zit met 9642 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9642 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/groothandel/orderlaag.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/koppel.js|Dit bestand zit met 9471 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9471 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/koppel.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/marechaussee.js|Dit bestand zit met 10033 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10033 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/marechaussee.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/markt.js|Dit bestand zit met 10103 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10103 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/markt.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/muziek-uitgave.js|Dit bestand zit met 10087 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10087 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/muziek-uitgave.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/overheid/rechtbank.js|Dit bestand zit met 9717 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9717 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/overheid/rechtbank.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/rtgonderzoeker.js|Dit bestand zit met 9541 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9541 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/rtgonderzoeker.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/rtmail-team.js|Dit bestand zit met 9510 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9510 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/rtmail-team.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/salon/index.js|Dit bestand zit met 9606 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9606 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/salon/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/spellen.js|Dit bestand zit met 10119 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10119 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/spellen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/staffseed.js|Dit bestand zit met 10217 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10217 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/staffseed.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/thuis/boeken.js|Dit bestand zit met 9805 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9805 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/thuis/boeken.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/webmaker.js|Dit bestand zit met 9423 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9423 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/webmaker.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/werkplek.js|Dit bestand zit met 9423 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9423 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/werkplek.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/werkvenster.js|Dit bestand zit met 9680 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9680 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/werkvenster.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/zaakdoos/index.js|Dit bestand zit met 10115 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10115 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/zaakdoos/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/zaakdoos/proxy.js|Dit bestand zit met 9573 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9573 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/zaakdoos/proxy.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/kantoren/bank.js|Dit bestand zit met 9405 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9405 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/kantoren/bank.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/member/betalen.js|Dit bestand zit met 10195 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10195 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/member/betalen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/member/persoonlijk.js|Dit bestand zit met 10123 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10123 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/member/persoonlijk.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/member/salon.js|Dit bestand zit met 10205 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10205 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/member/salon.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/overheid.js|Dit bestand zit met 10024 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10024 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/overheid.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/rtmail.js|Dit bestand zit met 9772 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9772 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/rtmail.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/supplier/backoffice.js|Dit bestand zit met 10177 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10177 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/backoffice.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/supplier/events/catering.js|Dit bestand zit met 9727 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9727 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/events/catering.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/supplier/kassa/afrekenen.js|Dit bestand zit met 9979 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9979 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/kassa/afrekenen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/supplier/tickets.js|Dit bestand zit met 9776 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9776 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/tickets.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/supplier/vervoer.js|Dit bestand zit met 9947 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9947 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/vervoer.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/routes/techniek/beheer.js|Dit bestand zit met 9414 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9414 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/techniek/beheer.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/school/toets.js|Dit bestand zit met 10231 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10231 bytes vlak onder de grens van 10.240.",
   "waar": "server/school/toets.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/smtp.js|Dit bestand zit met 9782 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9782 bytes vlak onder de grens van 10.240.",
   "waar": "server/smtp.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/talen.js|Dit bestand zit met 9568 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9568 bytes vlak onder de grens van 10.240.",
   "waar": "server/talen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 6,
   "punten": 43
  },
  {
   "sleutel": "omvang|server/kern/aanmeldingen.js|Dit bestand zit met 10189 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10189 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/aanmeldingen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 4,
   "punten": 38
  },
  {
   "sleutel": "omvang|server/papieren/vragen.js|Dit bestand zit met 9889 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9889 bytes vlak onder de grens van 10.240.",
   "waar": "server/papieren/vragen.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 4,
   "punten": 38
  },
  {
   "sleutel": "omvang|server/routes/techniek.js|Dit bestand zit met 10239 bytes vlak onder de grens van 10.2",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 10239 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/techniek.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 3,
   "punten": 35
  },
  {
   "sleutel": "dubbeling|server/kern/aanmeldingen.js, server/kern/bank/krediet.js, server/kern/bankregie/autorisatie.js, server/kern/beveiliging/rooster/aanvragen.js|De functie \"aanvraag\" staat in 5 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"aanvraag\" staat in 5 kernmodules.",
   "waar": "server/kern/aanmeldingen.js, server/kern/bank/krediet.js, server/kern/bankregie/autorisatie.js, server/kern/beveiliging/rooster/aanvragen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/aanmeldingen.js, server/kern/autoverkoop/deal.js, server/kern/ketenchat.js, server/kern/labfonds/voorstellen.js|De functie \"beslis\" staat in 9 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"beslis\" staat in 9 kernmodules.",
   "waar": "server/kern/aanmeldingen.js, server/kern/autoverkoop/deal.js, server/kern/ketenchat.js, server/kern/labfonds/voorstellen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingen/boardroom/index.js, server/kern/leren/projecten.js, server/kern/planners/weddings.js, server/kern/rtfkantoor.js|De functie \"taakMaak\" staat in 5 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"taakMaak\" staat in 5 kernmodules.",
   "waar": "server/kern/afdelingen/boardroom/index.js, server/kern/leren/projecten.js, server/kern/planners/weddings.js, server/kern/rtfkantoor.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingen/boardroom/index.js, server/kern/leren/projecten.js, server/kern/rtfkantoor.js, server/kern/werkplek.js|De functie \"taakZet\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"taakZet\" staat in 4 kernmodules.",
   "waar": "server/kern/afdelingen/boardroom/index.js, server/kern/leren/projecten.js, server/kern/rtfkantoor.js, server/kern/werkplek.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingen/boardroom/index.js, server/kern/meet.js, server/kern/rtfkantoor.js|De functie \"kamers\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"kamers\" staat in 3 kernmodules.",
   "waar": "server/kern/afdelingen/boardroom/index.js, server/kern/meet.js, server/kern/rtfkantoor.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingen/kameradvies.js, server/kern/rampbeeld/advies.js, server/kern/reisbureau.js, server/kern/vakwerk/advies.js|De functie \"regelAdvies\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"regelAdvies\" staat in 4 kernmodules.",
   "waar": "server/kern/afdelingen/kameradvies.js, server/kern/rampbeeld/advies.js, server/kern/reisbureau.js, server/kern/vakwerk/advies.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingshotel.js, server/kern/bankregie/autorisatie.js, server/kern/groothandel/orderlaag.js, server/kern/koppel.js|De functie \"annuleer\" staat in 7 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"annuleer\" staat in 7 kernmodules.",
   "waar": "server/kern/afdelingshotel.js, server/kern/bankregie/autorisatie.js, server/kern/groothandel/orderlaag.js, server/kern/koppel.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/agenda-pro.js, server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/directpay/index.js|De functie \"publiek\" staat in 18 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"publiek\" staat in 18 kernmodules.",
   "waar": "server/kern/agenda-pro.js, server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/directpay/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/agenda-pro.js, server/kern/agenda.js, server/kern/appbieb.js, server/kern/atelierweb.js|De functie \"verwijder\" staat in 16 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"verwijder\" staat in 16 kernmodules.",
   "waar": "server/kern/agenda-pro.js, server/kern/agenda.js, server/kern/appbieb.js, server/kern/atelierweb.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/agenda.js, server/kern/keuken/voorraad.js, server/kern/tafelwensen.js|De functie \"telling\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"telling\" staat in 3 kernmodules.",
   "waar": "server/kern/agenda.js, server/kern/keuken/voorraad.js, server/kern/tafelwensen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/algpin.js, server/kern/eenaccount.js, server/kern/sleutelwoorden.js|De functie \"teVaak\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"teVaak\" staat in 3 kernmodules.",
   "waar": "server/kern/algpin.js, server/kern/eenaccount.js, server/kern/sleutelwoorden.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/rijksbieb.js, server/kern/schoolbieb.js|De functie \"appVan\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"appVan\" staat in 4 kernmodules.",
   "waar": "server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/rijksbieb.js, server/kern/schoolbieb.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/geloofbieb.js, server/kern/reisbieb/index.js|De functie \"catalogus\" staat in 8 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"catalogus\" staat in 8 kernmodules.",
   "waar": "server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/geloofbieb.js, server/kern/reisbieb/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/geloofbieb.js, server/kern/reisbieb/index.js|De functie \"installeer\" staat in 7 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"installeer\" staat in 7 kernmodules.",
   "waar": "server/kern/appbieb.js, server/kern/beroepenbieb/index.js, server/kern/geloofbieb.js, server/kern/reisbieb/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/architect/bank.js, server/kern/atelier/bank.js, server/kern/hardwarelab/bank.js, server/kern/studio/bank.js|De functie \"maakConcept\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"maakConcept\" staat in 4 kernmodules.",
   "waar": "server/kern/architect/bank.js, server/kern/atelier/bank.js, server/kern/hardwarelab/bank.js, server/kern/studio/bank.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js|De functie \"ontwerpMaak\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"ontwerpMaak\" staat in 4 kernmodules.",
   "waar": "server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js|De functie \"ontwerpZet\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"ontwerpZet\" staat in 4 kernmodules.",
   "waar": "server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js|De functie \"ontwerpVerwijder\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"ontwerpVerwijder\" staat in 4 kernmodules.",
   "waar": "server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js|De functie \"collectieMaak\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"collectieMaak\" staat in 4 kernmodules.",
   "waar": "server/kern/architect/index.js, server/kern/atelier/index.js, server/kern/hardwarelab/index.js, server/kern/studio/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/atelierweb.js, server/kern/journalistiek-blokken.js, server/kern/webmaker.js|De functie \"schoonBlok\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"schoonBlok\" staat in 3 kernmodules.",
   "waar": "server/kern/atelierweb.js, server/kern/journalistiek-blokken.js, server/kern/webmaker.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/atelierweb.js, server/kern/journalistiek-blokken.js, server/kern/webmaker.js|De functie \"schoonVolgorde\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"schoonVolgorde\" staat in 3 kernmodules.",
   "waar": "server/kern/atelierweb.js, server/kern/journalistiek-blokken.js, server/kern/webmaker.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/atelierweb.js, server/kern/autoverkoop/deal.js, server/kern/muziek.js, server/kern/notities.js|De functie \"bewaar\" staat in 7 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"bewaar\" staat in 7 kernmodules.",
   "waar": "server/kern/atelierweb.js, server/kern/autoverkoop/deal.js, server/kern/muziek.js, server/kern/notities.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/baby.js, server/kern/geloof/feesten.js, server/kern/tiener.js, server/kern/welzijn.js|De functie \"vandaag\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"vandaag\" staat in 4 kernmodules.",
   "waar": "server/kern/baby.js, server/kern/geloof/feesten.js, server/kern/tiener.js, server/kern/welzijn.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bank/grootboek.js, server/kern/fiscaal/regelwacht.js, server/kern/pay/index.js|De functie \"pasToe\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"pasToe\" staat in 3 kernmodules.",
   "waar": "server/kern/bank/grootboek.js, server/kern/fiscaal/regelwacht.js, server/kern/pay/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bank/index.js, server/kern/klok.js, server/kern/pay/index.js|De functie \"seintje\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"seintje\" staat in 3 kernmodules.",
   "waar": "server/kern/bank/index.js, server/kern/klok.js, server/kern/pay/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bank/index.js, server/kern/genootschap/inzicht.js, server/kern/lifestyle/dossier.js|De functie \"gezondheid\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"gezondheid\" staat in 3 kernmodules.",
   "waar": "server/kern/bank/index.js, server/kern/genootschap/inzicht.js, server/kern/lifestyle/dossier.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bank/rekeningen.js, server/kern/markt.js, server/kern/thuis/boeken.js|De functie \"detail\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"detail\" staat in 3 kernmodules.",
   "waar": "server/kern/bank/rekeningen.js, server/kern/markt.js, server/kern/thuis/boeken.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bankregie/autorisatie.js, server/kern/munten.js, server/kern/rtgid.js|De functie \"bevestig\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"bevestig\" staat in 3 kernmodules.",
   "waar": "server/kern/bankregie/autorisatie.js, server/kern/munten.js, server/kern/rtgid.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/bankregie/autorisatie.js, server/kern/fiscaal/regelwacht.js, server/kern/fluister/sparren.js, server/kern/ketenchat.js|De functie \"status\" staat in 8 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"status\" staat in 8 kernmodules.",
   "waar": "server/kern/bankregie/autorisatie.js, server/kern/fiscaal/regelwacht.js, server/kern/fluister/sparren.js, server/kern/ketenchat.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/beveiliging.js, server/kern/groothandel.js, server/kern/zaak.js|De functie \"functieAan\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"functieAan\" staat in 3 kernmodules.",
   "waar": "server/kern/beveiliging.js, server/kern/groothandel.js, server/kern/zaak.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/beveiliging.js, server/kern/groothandel/assortiment.js, server/kern/zaak.js|De functie \"functieLijst\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"functieLijst\" staat in 3 kernmodules.",
   "waar": "server/kern/beveiliging.js, server/kern/groothandel/assortiment.js, server/kern/zaak.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/boerderij.js, server/kern/creator.js, server/kern/directpay/index.js|De functie \"ensure\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"ensure\" staat in 3 kernmodules.",
   "waar": "server/kern/boerderij.js, server/kern/creator.js, server/kern/directpay/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/borden.js, server/kern/geloofbieb.js, server/kern/markt.js|De functie \"zichtbaar\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"zichtbaar\" staat in 3 kernmodules.",
   "waar": "server/kern/borden.js, server/kern/geloofbieb.js, server/kern/markt.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/clips.js, server/kern/kletspraat/index.js, server/kern/office/basis.js, server/kern/ontmoeting.js|De functie \"lijsten\" staat in 15 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"lijsten\" staat in 15 kernmodules.",
   "waar": "server/kern/clips.js, server/kern/kletspraat/index.js, server/kern/office/basis.js, server/kern/ontmoeting.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/clips.js, server/kern/podium/kanaal.js, server/kern/theater/video.js|De functie \"signaal\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"signaal\" staat in 3 kernmodules.",
   "waar": "server/kern/clips.js, server/kern/podium/kanaal.js, server/kern/theater/video.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/clips.js, server/kern/ideeen.js, server/kern/theater/index.js|De functie \"reactie\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"reactie\" staat in 3 kernmodules.",
   "waar": "server/kern/clips.js, server/kern/ideeen.js, server/kern/theater/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/clips.js, server/kern/podium/kanaal.js, server/kern/theater/index.js|De functie \"officeLijst\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"officeLijst\" staat in 3 kernmodules.",
   "waar": "server/kern/clips.js, server/kern/podium/kanaal.js, server/kern/theater/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/flits.js, server/kern/ontmoeting/date.js, server/kern/spellen.js|De functie \"opschonen\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"opschonen\" staat in 3 kernmodules.",
   "waar": "server/kern/flits.js, server/kern/ontmoeting/date.js, server/kern/spellen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/fluister/seintjes.js, server/kern/spellen/rahul.js, server/kern/stad/domeinen.js|De functie \"standVan\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"standVan\" staat in 3 kernmodules.",
   "waar": "server/kern/fluister/seintjes.js, server/kern/spellen/rahul.js, server/kern/stad/domeinen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/foodcourt.js, server/kern/gemeente/burgerzaken.js, server/kern/vakwerk/agenda.js|De functie \"bezetOp\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"bezetOp\" staat in 3 kernmodules.",
   "waar": "server/kern/foodcourt.js, server/kern/gemeente/burgerzaken.js, server/kern/vakwerk/agenda.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/gemeente/burgerzaken.js, server/kern/rtfclubs.js, server/kern/zorgketen/balie.js|De functie \"afspraakMaak\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"afspraakMaak\" staat in 3 kernmodules.",
   "waar": "server/kern/gemeente/burgerzaken.js, server/kern/rtfclubs.js, server/kern/zorgketen/balie.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/genootschap/bijeenkomst.js, server/kern/genootschap/index.js, server/kern/genootschap/prikbord.js, server/kern/salon/index.js|De functie \"nieuwId\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"nieuwId\" staat in 4 kernmodules.",
   "waar": "server/kern/genootschap/bijeenkomst.js, server/kern/genootschap/index.js, server/kern/genootschap/prikbord.js, server/kern/salon/index.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/genootschap/bijeenkomst.js, server/kern/lesmaker.js, server/kern/markt/handel/chat.js, server/kern/residentie/spel.js|De functie \"antwoord\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"antwoord\" staat in 4 kernmodules.",
   "waar": "server/kern/genootschap/bijeenkomst.js, server/kern/lesmaker.js, server/kern/markt/handel/chat.js, server/kern/residentie/spel.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/genootschap/prikbord.js, server/kern/markt.js, server/kern/residentie/spellen.js|De functie \"plaats\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"plaats\" staat in 3 kernmodules.",
   "waar": "server/kern/genootschap/prikbord.js, server/kern/markt.js, server/kern/residentie/spellen.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/genootschap/prikbord.js, server/kern/markt/handel/chat.js, server/kern/muziek-uitgave.js, server/kern/samenwerking.js|De functie \"reageer\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"reageer\" staat in 4 kernmodules.",
   "waar": "server/kern/genootschap/prikbord.js, server/kern/markt/handel/chat.js, server/kern/muziek-uitgave.js, server/kern/samenwerking.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/journalistiek.js, server/kern/webmaker.js, server/kern/werkplaats.js|De functie \"publiceer\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"publiceer\" staat in 3 kernmodules.",
   "waar": "server/kern/journalistiek.js, server/kern/webmaker.js, server/kern/werkplaats.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/ketenchat.js, server/kern/overheid/index.js, server/kern/thuis/extra.js, server/kern/vonk/match.js|De functie \"bericht\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"bericht\" staat in 4 kernmodules.",
   "waar": "server/kern/ketenchat.js, server/kern/overheid/index.js, server/kern/thuis/extra.js, server/kern/vonk/match.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/lesmaker.js, server/kern/samen.js, server/kern/samenrtf.js|De functie \"doeMee\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"doeMee\" staat in 3 kernmodules.",
   "waar": "server/kern/lesmaker.js, server/kern/samen.js, server/kern/samenrtf.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/luchthaven/grond.js, server/kern/marechaussee.js, server/kern/sportclub/zakelijk.js|De functie \"cockpit\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"cockpit\" staat in 3 kernmodules.",
   "waar": "server/kern/luchthaven/grond.js, server/kern/marechaussee.js, server/kern/sportclub/zakelijk.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/markt/handel/deal.js, server/kern/rtmail-team.js, server/kern/rtmail.js|De functie \"postvak\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"postvak\" staat in 3 kernmodules.",
   "waar": "server/kern/markt/handel/deal.js, server/kern/rtmail-team.js, server/kern/rtmail.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/markt/toezicht.js, server/kern/podium/interactie.js, server/kern/sociaal.js, server/kern/thuis/aanbod.js|De functie \"blokkeer\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"blokkeer\" staat in 4 kernmodules.",
   "waar": "server/kern/markt/toezicht.js, server/kern/podium/interactie.js, server/kern/sociaal.js, server/kern/thuis/aanbod.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/metier/bewijs.js, server/kern/metier/netwerk.js, server/kern/muziek-uitgave.js, server/kern/paspoort/verzoeken.js|De functie \"trekIn\" staat in 4 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"trekIn\" staat in 4 kernmodules.",
   "waar": "server/kern/metier/bewijs.js, server/kern/metier/netwerk.js, server/kern/muziek-uitgave.js, server/kern/paspoort/verzoeken.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/ontmoeting.js, server/kern/paspoort.js, server/kern/podium/index.js, server/kern/rtgid.js|De functie \"accountVanKey\" staat in 5 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"accountVanKey\" staat in 5 kernmodules.",
   "waar": "server/kern/ontmoeting.js, server/kern/paspoort.js, server/kern/podium/index.js, server/kern/rtgid.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/residentie/index.js, server/kern/samen.js, server/kern/samenrtf.js|De functie \"ruimOp\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"ruimOp\" staat in 3 kernmodules.",
   "waar": "server/kern/residentie/index.js, server/kern/samen.js, server/kern/samenrtf.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 6,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/directpay/index.js|Dit bestand zit met 9993 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9993 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/directpay/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/fluister/gesprek.js|Dit bestand zit met 9430 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9430 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/fluister/gesprek.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/luchthaven/index.js|Dit bestand zit met 9620 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9620 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/luchthaven/index.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/ontmoeting/date.js|Dit bestand zit met 9733 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9733 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/ontmoeting/date.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/samenwerking.js|Dit bestand zit met 9971 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9971 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/samenwerking.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/sportclub/zakelijk.js|Dit bestand zit met 9956 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9956 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/sportclub/zakelijk.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/kern/vracht.js|Dit bestand zit met 9602 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9602 bytes vlak onder de grens van 10.240.",
   "waar": "server/kern/vracht.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/routes/member/voertuigen/charter.js|Dit bestand zit met 9766 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9766 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/member/voertuigen/charter.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/routes/member/voertuigen/huur.js|Dit bestand zit met 9697 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9697 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/member/voertuigen/huur.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "omvang|server/routes/supplier/werving/personeel.js|Dit bestand zit met 9952 bytes vlak onder de grens van 10.24",
   "soort": "beter",
   "groep": "omvang",
   "tekst": "Dit bestand zit met 9952 bytes vlak onder de grens van 10.240.",
   "waar": "server/routes/supplier/werving/personeel.js",
   "hoe": "Knip er een deelbestand af zolang het rustig kan.",
   "rondes": 2,
   "punten": 33
  },
  {
   "sleutel": "dubbeling|server/kern/aanmeldgesprek.js, server/kern/gegevensgesprek.js, server/kern/kantoorgesprek.js, server/kern/leren.js|De functie \"opruimen\" staat in 6 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"opruimen\" staat in 6 kernmodules.",
   "waar": "server/kern/aanmeldgesprek.js, server/kern/gegevensgesprek.js, server/kern/kantoorgesprek.js, server/kern/leren.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 2,
   "punten": 23
  },
  {
   "sleutel": "dubbeling|server/kern/afdelingshotel.js, server/kern/aidata.js, server/kern/alpine.js, server/kern/appbieb.js|De functie \"overzicht\" staat in 47 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"overzicht\" staat in 47 kernmodules.",
   "waar": "server/kern/afdelingshotel.js, server/kern/aidata.js, server/kern/alpine.js, server/kern/appbieb.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 2,
   "punten": 23
  },
  {
   "sleutel": "dubbeling|server/kern/bestanden-delen.js, server/kern/lidboard/schakel.js, server/kern/zelfzorg/repareren.js|De functie \"herstel\" staat in 3 kernmodules.",
   "soort": "beter",
   "groep": "dubbeling",
   "tekst": "De functie \"herstel\" staat in 3 kernmodules.",
   "waar": "server/kern/bestanden-delen.js, server/kern/lidboard/schakel.js, server/kern/zelfzorg/repareren.js",
   "hoe": "Kijk of er een gedeelde helper van te maken is; zo niet, geef ze een eigen naam zodat de gelijkenis niet misleidt.",
   "rondes": 2,
   "punten": 23
  }
 ]
}
```
