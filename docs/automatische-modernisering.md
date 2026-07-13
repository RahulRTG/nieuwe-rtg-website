# Automatische modernisering en beveiliging (met goedkeuring van de eigenaar)

Rahul Travel Group wil dat de code automatisch fris, modern en maximaal veilig
blijft, zonder ooit de controle uit handen te geven. Daarom werkt de automatische
modernisering volgens een vaste, veilige afspraak: **Claude Code stelt voor, de
eigenaar keurt goed.** Er wordt nooit iets zonder menselijke goedkeuring
samengevoegd.

## De gouden regels

1. **Alleen voorstellen, nooit zelf samenvoegen.** Elke automatische ronde levert
   een *pull request* op. Samenvoegen naar de hoofdtak gebeurt uitsluitend nadat
   de eigenaar (Rahul Imran Ismail, `RTG_OWNER_EMAIL`) de PR heeft goedgekeurd.
2. **Alles moet groen zijn.** Een voorstel wordt alleen ingediend als de volledige
   testsuite (`node --experimental-sqlite --test --test-concurrency=1 test/*.test.js`)
   en de huisstijlcheck (`node scripts/check.js`) slagen.
3. **Kleine, omkeerbare stappen.** Liever meerdere kleine, goed uitgelegde PR's dan
   een grote, ondoorzichtige. Elke PR beschrijft precies wat er verandert en waarom.
4. **Volledig audit-spoor.** Elke wijziging staat in git met een duidelijke
   commit-boodschap; de PR-omschrijving vat de ronde samen.

## Privacy & security: altijd de strengste norm

Elke automatische wijziging moet de beveiliging en privacy **verbeteren of
gelijk houden, nooit verzwakken**. Concreet blijven deze altijd overeind:

- **Versleuteling & geheimen:** versleuteling-at-rest (`RTG_ENC_KEY`), token-hashing,
  geen enkel geheim (sleutels, wachtwoorden, tokens) in de code of in een PR.
- **Toegang:** rate-limits, sessieverloop, CSP met per-antwoord nonce, security-headers
  (HSTS, nosniff, frame-deny), de owner-only technische pagina en de zekeringen.
- **Dataminimalisatie & AVG/GDPR:** niet meer data verzamelen of tonen dan nodig;
  privacy by design en by default.
- **De juridische grenzen (`server/eigenaar.js`, GRENZEN) blijven onaantastbaar.**
  Zelfs de eigenaar heeft hier bewust GEEN inzage, en een automatische ronde mag
  die grenzen nooit openen:
  - privé-sociale berichten van kinderen t/m 15;
  - privé-DM's en ouder-leraar-berichten;
  - ruwe identiteitsdocumenten voorbij de KYC-beoordeling;
  - platte (leesbare) wachtwoorden.
- **Kinderbescherming** (t/m 15 gesloten) en de leeftijdslaag blijven gelden.
- **Geen dev-velden in productie** en geen modelnaam/-identifier in commits, PR's of code.

## Wat een moderniseringsronde wél doet

- Kwetsbaarheden en verouderde patronen opsporen en veilig bijwerken.
- Afhankelijkheden en configuratie moderniseren waar dat veilig kan.
- Beveiliging en privacy verder aanscherpen (defense in depth).
- Doode code, kleine bugs en inconsistenties opruimen.
- Tests uitbreiden waar dekking ontbreekt.

## Wat een ronde NOOIT doet

- Zonder goedkeuring samenvoegen of naar productie duwen.
- Een grote herschrijving in één klap.
- De juridische grenzen of de kinderbescherming aanraken.
- Geheimen, tokens of persoonsgegevens in de PR opnemen.
- De beveiliging verzwakken "voor het gemak".

## Het draaiboek (per ronde)

1. Start vanaf de laatste hoofdtak; maak een verse werk-branch
   (`claude/moderniseren-<datum>`).
2. Voer de ronde uit binnen bovenstaande regels.
3. Draai de volledige suite + `scripts/check.js`; beide moeten groen zijn.
4. Commit in kleine, duidelijke stappen.
5. Open een pull request met een heldere samenvatting (wat, waarom, risico's,
   hoe getest). **Niet samenvoegen.**
6. Meld de eigenaar dat er een voorstel klaarstaat; hij keurt goed of vraagt om
   aanpassing.

## Instellen van de wekelijkse routine

De automatische ronde loopt als geplande routine (fresh session per keer) die dit
draaiboek volgt en een PR opent. De eigenaar kan de routine altijd pauzeren of
stoppen. Wordt er in een ronde niets veiligs gevonden om te verbeteren, dan wordt
er geen PR geopend en volgt een korte melding "geen wijzigingen nodig".
