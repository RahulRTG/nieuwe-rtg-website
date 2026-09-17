# Betekenis en taal in de toegang tot RTG

Er is één account- en bevoegdhedenmodel. Een taal verandert de presentatie, niet de identiteit, de gekozen handeling of het servergezag. Deze eerste stap geldt voor de bestaande ledenaanmelding en de gedeelde vertaallaag. Het is geen nieuwe uitvoeringsmotor en geen bewijs dat alle RTG-schermen inhoudelijk in 114 talen zijn gecontroleerd.

## De bestaande keten gebruiken

`Person → Context → Goal → Intent → Plan → Authority → Capability → Effect → Evidence` blijft de richting. De persoon en sessie komen uit de bestaande authenticatie. De gekozen taal, stap en in het geheugen bewaarde invoer zijn presentatiecontext. Acht versievaste betekenis-ID's in `public/apps/access/meaning.js` verbinden een doel en getypeerde parameters aan bestaande account-routes. Het plan uit die module is een verzoek, nooit een toestemming of bewijs van uitvoering. Authenticatie, WebAuthn, tweede factor, herstel en ondertekening blijven uitsluitend door de bestaande serverhandlers beoordeeld.

De module kiest geen actie op basis van vertaalde knoptekst. Onbekende betekenis-ID's, versies en parameters worden geweigerd. Er wordt geen betekenis uit vrije tekst afgeleid. Er is geen nieuwe route die modeluitvoer uitvoert. RTG Laws, bestaande toegangsgrenzen en serverbeleid blijven boven de presentatie staan. De volledige toekomstige keten met perceptie, wereldstaat en generatieve projecties wordt hier niet nagebouwd.

## Zes fundamenten en hun huidige bereik

1. **Meaning los van text.** De acht accountacties hebben stabiele ID's en versie 1. Parameters zijn gestructureerd; de registratie vraagt altijd het bestaande gratis guest-account aan. Een UI-label kan geen betaald abonnement of extra bevoegdheid toevoegen.
2. **LANGUAGECAPABILITY.json.** Een echte mobiele Chromium-run meet 114 keuzes, Unicode-invoer en teruglezen, focus, stapbehoud, richting, schermbreedte en de werkelijk opgeloste Intl-locale. Alle accountstappen worden ook in Nederlands/Engels doorlopen. Volledige glyph-dekking, fysieke toetsenborden/IME, alle apparaten en alle overige app-schermen blijven expliciet niet gemeten.
3. **MEANINGPARITY.json.** 114 presentatiecontexten worden op dezelfde acht getypeerde bindings getoetst. Dit zijn 912 structurele vergelijkingen, geen bewijs dat 912 menselijk geformuleerde opdrachten dezelfde betekenis hebben. De browser doorloopt accountaanmaak en akkoord via echte serverroutes.
4. **LANGUAGEFAILOVER.json.** De bestaande vertaalketen praat eerst met een synthetische lokale HTTP-modeladapter. De test sluit daarna werkelijk die luisterende socket. Bekende vertaling blijft uit de cache beschikbaar; onbekende tekst valt terug zonder als geslaagde vertaling te worden opgeslagen. Na herstart kan die tekst alsnog worden vertaald. Er is geen productiemodelserver gestopt en er wordt geen modelkwaliteit geclaimd.
5. **Risicoklassen.** Zie de tabel hieronder. Kritieke accounttekst is codebeheerd en versiegebonden. Een model of oude vertaalcache kan deze tekst niet vervangen. Akkoord vermeldt de werkelijk gelezen contractversie; een ontbrekende, ongeldige of gewijzigde versie krijgt 409 zonder ondertekening. De browser laadt de actuele tekst, behoudt de naam en wist het eerdere akkoord. Het bestaande ondertekenbewijs bewaart daarnaast betekenis-ID en betekenisversie.
6. **Cache vóór inference.** De bestaande gedeelde UI-cache en serververtaalcache worden hergebruikt. Bekende brontekst wordt niet opnieuw ingestuurd. Mislukte of onveranderde modeluitvoer wordt niet als voltooide vertaling bewaard. De semantische cache bevat uitsluitend bevroren definities, geen wachtwoorden, namen, tokens of andere invoer.

| Tekstsoort | Beleid | Bereik van deze wijziging |
| --- | --- | --- |
| Marketing/verhaal | Flexibele presentatie mag geen toegang of effect verlenen. | Bestaande marketing; geen nieuwe generatieve inhoud. |
| Interface en uitleg | Sleutelgebonden vertaling, bronterugval, behoud van invoer en toestand. | Gedeelde laadlaag en accountportaal. |
| Accountbeslissing | Vaste betekenis-ID, getypeerde parameters en codebeheerste NL/EN-bevestiging. | Registratie, inloggen, passkey, tweede factor en herstel. |
| Juridisch akkoord | Expliciete toestemming voor de actuele versie, opnieuw vragen bij wijziging. | `/api/onboarding/teken` voor leden. Foundation- en leveranciersroutes zijn geen onderdeel van deze versiegrendel. |
| Betaling of mandaat | Vereist bewezen betekenis, versie en bestaande serverbevoegdheid. | Niet door deze portalwijziging gemigreerd of bewezen. |

## Eerlijke beschikbaarheid

Alle 114 talen zijn technisch selecteerbaar, ook wanneer de talen-API ontbreekt. De geselecteerde taal werkt door in de gedeelde interface en accountschermen zonder de aanvraag opnieuw te starten. De woordenboeken worden volledig in begrensde batches geladen; de eerdere afkap na 400 sleutels is verwijderd. Een antwoord voor een inmiddels verlaten taal kan de actieve taal niet terugzetten.

Dit is geen volledige inhoudelijke vrijgave van 114 talen. Nederlands en Engels hebben vaste accounttekst. Andere talen gebruiken aanwezige woordenboeken, cache en de beschikbare vertaaldienst. Ontbrekende vertalingen vallen terug. Kritieke bevestigingen blijven Nederlands/Engels; de afwijkende taal wordt gemeld. De overeenkomst blijft de Nederlandse brontekst, met een expliciete Engelse toelichting. Voor ondertekening vraagt de interface bij andere talen eerst een keuze voor Nederlands of Engels via de bestaande Edge Bar. Er komt geen tweede bediening bij.

Lange woordenboekteksten boven 300 tekens, vrije servertekst, alle domeinschermen en menselijke vertaalbeoordeling vallen buiten het gemeten bereik. De rapporten houden `productionReady114Languages` daarom op `false`. FoundationOS is en blijft 100% gratis.

## Bewijs herhalen

Draai na de build `npm run language:proof`. Dat voert de browser-, betekenis-, cache-, uitval- en ondertekeningstests uit. Alleen na een volledig geslaagde run worden de drie rapporten vervangen. Ze bevatten de SHA-256-afdrukken van de geteste bron, de browserversie, het meetmoment en de grenzen van het bewijs. De uitkomst is werkboomgebonden, geen productieattest.

`npm run language:check` weigert verouderde rapporten. De gewone `npm run check` voert die controle ook uit. Fysieke Face ID en een moedertaalbeoordeling mogen niet uit een geslaagde synthetische browserproef worden afgeleid.
