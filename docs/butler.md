# De Butler: architectuur van de persoonlijke assistent

De Butler is de leden-AI van het ecosysteem. Dezelfde motor bedient het
personeel ("mijn assistent" op de PDA) en de zaak-AI (geheugenfuncties).
De interne naam is `fluister` (kern/fluister.js): opslag en routes zijn
stabiel gebleven toen de assistent zijn Butler-gezicht kreeg.

## De lagen

1. **Geheugen** - weetjes ("onthoud dat..."), gebruikstellers (FocusUI,
   alleen tellers, nooit inhoud) en het korte gesprek (laatste 5 beurten).
   Volledig transparant ("wat weet je over mij") en wisbaar ("vergeet
   alles" wist alles: weetjes, gesprek, tellers en open voorstellen).
2. **Seintjes** - proactief: datums uit weetjes, de agenda (reserveringen,
   check-in/uit, 24-uursblokken) en lopende zaken (bedenktijd, terugkoop).
   Nieuwe seintjes worden via `fluisterPush` een melding (bel + web-push),
   met dedupe. De halfuurlijkse ronde (`fluisterPushAlle`) bouwt eerst een
   index (een datapass) en loopt dan alle gebruikers langs.
3. **Doen** - de commando-laag in `fluisterZeg`. Vrije vragen gaan naar
   Claude (met het persoonlijke beeld als context) of vallen terug op de
   eigen regels; `pakte: false` betekent "dit gesprek is niet voor de
   motor" en de app geeft het dan aan de gewone gesprekslaag.

## Het voorstel-contract (de gelddrempel)

Alles met geld of een claim op een gedeeld object wordt eerst een
voorstel (`voorstel: true`); pas op "ja" voert `voerUit` het uit
(`gedaan: true`). "Nee" haalt het van tafel; een voorstel verloopt na
tien minuten; "ja" zonder open voorstel doet nooit zomaar iets.

| actie | drempel | waarom |
| --- | --- | --- |
| tafel reserveren / annuleren | direct | gratis en omkeerbaar |
| betaalverzoek maken (Klompje) | direct | er verlaat geen geld de rekening |
| zoeken, dagplan, saldo | direct | alleen lezen |
| bestellen, tickets, rit, Tik, verzoeken betalen | voorstel | geld |
| 24-uursblok | voorstel | claim op het gedeelde object |

## De acties-registry (geen drift)

De doe-functies voor bestellen, tickets en ritten wonen in
`routes/member.js` (daar staan de regels: ledenprijs, 86, leeftijd,
zorgprofiel, betaalmoment). Ze worden geregistreerd in
`kern.butlerActies` en de motor roept ze via dat expliciete contract aan:

```
actie(session, body) -> { ok, ... } | { status, error }
```

Het zijn exact dezelfde functies die de app-knoppen bedienen; er is dus
een codepad, geen tweede.

## Bescherming

- **Rem**: hooguit 60 berichten per minuut per gebruiker in de motor
  zelf (naast de generieke 300/min per IP in productie). Beschermt de
  AI-kosten en de doe-laag tegen scripts en vastgelopen spraak-loops.
- **Invoer**: berichten worden op 600 tekens geknipt; teksten door
  `schoon()`; itemmatching bouwt regexes alleen uit alfanumerieke
  menuwoorden.
- **Privacy**: geheugens zijn strikt gescheiden per gebruiker (leden,
  personeel per persoonlijke login, zaak per medewerker) en worden nooit
  met de werkgever of de zaak gedeeld.

## Testdekking

`test/fluister.test.js` dekt elke laag: geheugen en transparantie,
seintjes en push-dedupe, elk doe-commando end-to-end (tot en met de
betaalde order/het ticket in de database), de gelddrempel ("geld gaat
nooit zonder bevestiging de deur uit"), het pakte-contract, de
gescheiden geheugens en de rem.
