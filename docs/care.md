# Toren 4: RTG Care (zorg & welzijn)

Spa's, wellness en klinieken in het ecosysteem. Een lid boekt een
behandeling bij een behandelaar in een tijdslot en rekent af via RTG Pay.
De motor is `server/kern/care.js`; de routes wonen in
`routes/member/persoonlijk.js` (de persoonlijke laag), en De Butler boekt
het in gewone taal via de acties-registry.

## Model

- **Aanbieder** (`careAanbieders`): een spa, wellness of kliniek met
  behandelaars en behandelingen.
- **Behandeling**: naam, soort (`wellness` of `medisch`), duur, prijs, de
  behandelaar die hem doet, en de vrije tijdsloten.
- **Boeking** (`careBoekingen`): een lid, een behandeling, een dag en een
  slot. De agenda van de behandelaar is de schaarste: **een behandeling
  per behandelaar per tijdslot**. Betalen loopt via `careBetaal`
  (RTG Pay-punten via `verdienPunten`), net als tickets.

## De zorgvolle keten (waarom deze toren bij het ecosysteem hoort)

1. **Het zorgprofiel reist mee.** Allergenen, dieet en aandachtspunten die
   het lid al deelt (met toestemming, `zorgVoor`), gaan automatisch mee
   naar de behandelaar — een aromamassage met een notenallergie hoort de
   spa te weten.

2. **Aparte, veilige intake-deling.** Voor een kliniek is het algemene
   zorgprofiel niet genoeg. Daar deelt het lid *apart en uitdrukkelijk*
   een intake (medische context) met precies die ene aanbieder, met een
   einddatum (90 dagen), en het lid kan het altijd stoppen. Exact hetzelfde
   toestemmingsmodel als het live meekijken met de locatie: niets zonder
   een "ja", en niet langer dan nodig. Een boeking draagt de intake alleen
   mee zolang de deling actief is.

## Routes

| route | doet |
| --- | --- |
| `POST /api/care` | overzicht: aanbieders, behandelingen, mijn lopende intakes |
| `POST /api/care/boek` | een behandeling boeken (wacht-op-betaling) |
| `POST /api/care/betaal` | de boeking afrekenen |
| `POST /api/care/annuleer` | annuleren |
| `POST /api/care/mijn` | mijn boekingen |
| `POST /api/care/intake/deel` | een intake delen met een aanbieder |
| `POST /api/care/intake/stop` | de deling intrekken |

## De Butler

"Boek een hot stone massage bij Zenith morgen om 11:00" wordt een voorstel
met behandeling, tijd, duur en prijs; na "ja" is het geboekt en betaald,
met de referentie terug. Voor een medisch consult wijst hij op de
intake-deling. Alles met geld wacht op de gelddrempel, precies als bij de
andere torens. De actie staat in `kern.butlerActies.boekBehandeling`,
volgens het contract `(session, body) -> { ok, ... } | { status, error }`.

## Testdekking

`test/care.test.js`: het overzicht, boeken en betalen met agenda-schaarste,
het zorgprofiel dat meereist, de intake-deling (uitdrukkelijk, per
aanbieder, met einddatum en stopbaar), de gasten-grens, en de
Butler-boeking end-to-end.

## Vervolg (bewust nog niet gedaan)

Een eigen leden-tab voor Care (nu loopt het via De Butler en de API); de
aanbieder-kant als echte leverancier met de PDA en agenda voor de
behandelaar; en herstel-/verblijfpakketten die een behandeling aan een
hotelverblijf koppelen.
