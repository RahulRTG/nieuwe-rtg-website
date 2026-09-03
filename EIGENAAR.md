# RTG Sovereign Identity — het eigenaarsaccount

*Richtingsdocument, zoals `PLATFORM.md` en `OS.md`: per onderdeel staat erbij of
het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren weg** is —
zodat niemand die vier voor elkaar aanziet.*

## 0. De zin die dit draagt

**Je logt niet in als eigenaar; je toestellen bewijzen dat jij het bent.**

Dat is geen belofte over de toekomst maar een richting met een prijs, en die
prijs staat in paragraaf 5: een cryptografische identiteit zonder herstelweg is
geen sterker slot maar een enkelvoudig totaalverlies. Zolang het quorum van
paragraaf 5 niet staat, blijft het wachtwoord het vangnet — en dat is een
besluit en geen achterstand.

## 1. Vier begrippen, en ze zijn niet hetzelfde

| Begrip | Vraag | Waar het woont |
|---|---|---|
| **Identiteit** | wie is de eigenaar | `server/eigenaar.js` — één adres, overdraagbaar |
| **Toestel** | met welke sleutel | `kern/webauthn.js`, `kern/isolatie/apparaatsleutel.js` |
| **Sessie** | welke ingang, nu | het bearer-token; de binding in `kern/zwaarbewijs.js` |
| **Handeling** | mag dít, nu, hier | `kern/bevoegdheid/`, `kern/webauthn-acties.js` |

Ze door elkaar halen is de fout die dit hele document probeert te voorkomen. Een
geslaagde biometrie zegt iets over **toestel**, niet over **handeling**; dat is
precies waarom een assertie aan een actienaam hangt en niet aan een tijdvenster.

## 2. Wat er staat — gemeten, niet aangenomen

| Onderdeel | Stand | Waar |
|---|---|---|
| Passkeys, alleen publieke sleutels op de server | **staat** | `kern/webauthn.js` + eigen WebAuthn-laag, geen dependency |
| Vindbare passkeys (geen e-mailadres vooraf nodig) | **staat** | `residentKey: 'required'` |
| Bevestiging per benoemde handeling, eenmalig | **staat** | `kern/webauthn-actie.js`, `kern/webauthn-stapop.js` |
| Zeven zware handelingen achter die bevestiging | **staat** | `kern/webauthn-acties.js`, `kern/zwaarbewijs.js` |
| Toestelidentiteit uit de passkey (HKDF) | **staat** | `kern/isolatie/apparaatsleutel.js` |
| Spoor van weggehaalde sleutels | **staat** | `kern/webauthn-beheer.js` |
| Toestellenkaart voor de eigenaar | **staat** | boardroom, `public/apps/kantoren.html` |
| Beleidsmotor met vier dimensies en acht uitkomsten | **staat** | `kern/bevoegdheid/`, zie `CONTROLPLANE.md` |
| Gezagsherkomst op elk verzoek | **staat** | `envelop.zet(... gezagBron, gezagBaas)` |
| Wachtwoordloze eigenaar | **vraagt een besluit** | par. 5 |
| Recovery-quorum (2-uit-3) | **jaren weg zonder besluit, een maand met** | par. 5 |
| Sessies met aflopend vertrouwen | **een stap weg** | par. 4 |
| Eigenaar als sleutel-root los van het e-mailadres | **vraagt een besluit** | par. 6 |

Wat er **niet** is en ook niet stiekem half: er is geen Shamir-implementatie, geen
tijdslot op een gevoelige handeling, en geen herstelweg die buiten het
wachtwoord om loopt. Nagemeten op 3 september 2026.

## 3. De ratel, en waarom er een terugval in zit

Een account zonder passkey kan niets bevestigen. Zou de zware poort dan
weigeren, dan sluit de eerste installatie zichzelf buiten — de eigenaar heeft
juist de technische pagina nodig om zijn eerste sleutel te zetten.

De terugval is dus noodzakelijk. Hij is alleen **nooit stil**: elke zware
handeling die zonder passkeybewijs doorgaat, schrijft een regel in het logboek
én een kritieke melding op het beveiligingsbord. Zodra er één sleutel staat, is
de bevestiging hard. En omlaag komt de eis niet vanzelf, want `passkey-weg`
staat zelf in de zware lijst — anders haalt een gestolen sessie eerst de
sleutels weg en staat daarna alles weer open met alleen een wachtwoord.

**De prijs daarvan staat hier ook.** Wie maar één toestel heeft en dat
kwijtraakt, krijgt zijn eigen sleutel er niet meer af en zit vast op elke zware
handeling. Daarom twee toestellen, en daarom is paragraaf 5 geen extraatje.

## 4. De vier ringen, en wat er echt van bestaat

| Ring | Voorbeeld | Vereist vandaag |
|---|---|---|
| L0 | het bord bekijken | een sessie |
| L1 | een gewone beheerhandeling | een sessie achter `techAuth`/`boardroomAuth` |
| L2 | rechten of configuratie wijzigen | **verse passkey**, gebonden aan de actienaam |
| L3 | eigendom, sleutels, de terugstortstand | verse passkey **plus** het bestaande tweede slot (wachtwoord bij overdracht) |

L2 en L3 lopen vandaag door hetzelfde mechanisme; het verschil is dat L3 een
tweede, andersoortig slot ernaast heeft. Een echt onderscheid — quorum over twee
toestellen — is wat paragraaf 5 toevoegt.

**Wat hier bewust niet staat: een vertrouwensCIJFER op een toestel.** WebAuthn
geeft één eerlijk onderscheid (`singleDevice` tegenover `multiDevice`, dus vast
in dit toestel tegenover meereizend met een sleutelhanger) en dat is een GROND,
geen score. Een getal zou een oordeel suggereren dat nergens gemeten is. Zie ook
`LIFE.md`: er komt geen cijfer op een mens, en een toestel is hier de dichtste
benadering van een mens die dit huis heeft.

**Aflopend sessievertrouwen is een stap weg** en niet meer: de bouwstenen liggen
er (de sessie draagt al een apparaatsleutel, de zware poort vraagt al opnieuw).
Wat ontbreekt is een leeftijd op de sessie plus een lezer die daarop let. Doe je
dat, doe het dan zo dat *lezen* nooit afloopt — een cockpit die om je vinger
vraagt om een getal te tonen, wordt een cockpit die niemand meer opent.

## 5. Het recovery-quorum — het ontwerp

Dit is het stuk dat er niet is, en het stuk dat er moet zijn vóór het wachtwoord
weg kan.

### 5.1 Wat het moet kunnen

Eén ding: **een nieuwe passkey registreren op het eigenaarsaccount, zonder enig
bestaand toestel.** Niet meer. Het is geen tweede inlog en geen noodsleutel naar
de data; het herstelt alleen het vermogen om weer sleutels te hebben.

### 5.2 De vorm

Bij inrichting ontstaat één herstelgeheim. Dat wordt met Shamir gesplitst in
**drie delen waarvan er twee volstaan**. De server bewaart **alleen een
verifier** (een commitment), nooit het geheim en nooit een deel — anders is een
gestolen database een gestolen platform, en dat is precies wat deze hele
architectuur wil uitsluiten.

### 5.3 De drie eigenschappen die het veilig maken

Zonder deze drie is een herstelweg de zwakste schakel, en dan is alles ervoor
theater.

1. **Traag.** Een geslaagd quorum start een herstel dat pas na een wachttijd
   effect heeft. Instant herstel maakt van twee gestolen delen een instant
   overname.
2. **Luid.** Het starten van een herstel is een gebeurtenis: mail naar het
   eigenaarsadres, kritieke melding op het beveiligingsbord, regel in het
   journaal. Een herstel dat niemand ziet gebeuren, is een achterdeur.
3. **Afbreekbaar.** Zolang de wachttijd loopt, breekt **elke nog werkende
   passkey** het herstel af. Dat is wat een gestolen delenpaar overleefbaar
   maakt: de dief moet niet alleen twee delen hebben, hij moet ook een week lang
   voorkomen dat de echte eigenaar één keer zijn vinger op zijn telefoon legt.

Punt 3 is de kern van het ontwerp. Punt 1 zonder punt 3 is alleen vertraging;
samen zijn ze een slot.

### 5.4 Wat het NIET mag worden

- **Geen RTG-deel dat RTG zelf kan gebruiken.** Zie par. 6.
- **Geen herstel via e-mail.** Het adres is een communicatiekanaal en geen
  sleutel; dat is de hele reden dat dit document bestaat.
- **Geen herstel dat meer opent dan sleutels.** Een quorum dat ook de kluis of
  het geld opent, is een quorum waar iemand op gaat jagen.
- **Geen tweede plek waar het quorum ook werkt.** Eén route, en die route hangt
  aan dezelfde verifier.

### 5.5 De prijs, eerlijk

Drie delen bewaren is fysiek werk dat een mens moet doen en dat niemand leuk
vindt. Een quorum dat in een la ligt naast het toestel waar het voor bedoeld is,
is geen quorum. Wie dit bouwt en de bewaarplek niet regelt, heeft complexiteit
toegevoegd en geen veiligheid.

## 6. De grenzen

1. **Er komt geen tweede rechtenmodel.** De zware poort zegt niets over of
   iemand mág — dat doen `techAuth`/`eigenaarAlleen` en `boardroomAuth`. Twee
   vragen, twee lagen; samenvoegen zou betekenen dat een geslaagde bevestiging
   ook toegang gaat betekenen.
2. **Eén poort, één naam op de kern.** Per domein bouwen zou auth, techniek én
   kantoren rechtstreeks bij `accounts` zetten, en dan mag het kantoor in de
   identiteitskluis kijken. De domeingrens (`GRENZEN.json`) sloeg daar terecht
   op aan.
3. **De woordenlijsten van de poorten delen geen woord.** Dat is geen
   naamgeving maar de scheiding zelf: anders is een PIN-ceremonie inwisselbaar
   voor een eigenaarshandeling.
4. **Geen cijfer op een toestel** (par. 4).
5. **RTG kan het account van de eigenaar niet overnemen.** Dat is vandaag waar —
   er is geen achterdeur — en het recovery-quorum mag die eigenschap niet
   stilletjes opgeven. Een deel bij RTG plus één gestolen deel is een overname
   door het huis zelf.
6. **`voorbehouden` blijft voorbehouden.** Wat `eigenaar.js` als juridische
   grens noemt (het besloten sociale domein van kinderen, privé-DM's, ruwe
   identiteitsbewijzen, platte wachtwoorden) wordt door geen enkele hoeveelheid
   passkeys alsnog opengezet. Een sterkere sleutel geeft geen breder recht.

## 7. Wat er nog niet is, en de drie besluiten die openstaan

**Besluit 1 — waar liggen de drie delen?** Alle drie bij de eigenaar (dan is een
huisbrand totaalverlies), of één bij een derde (dan bestaat er een partij die
met één diefstal erbij binnen is). Dit is een besluit van de eigenaar over zijn
eigen risico en niet van wie het bouwt. **Dit besluit gaat vooraf aan de bouw**,
want het bepaalt de vorm.

**Besluit 2 — hoe lang is de wachttijd?** Te kort en punt 3 van par. 5.3 werkt
niet; te lang en een echte noodsituatie duurt een maand. Zeven dagen is de
verdedigbare middenweg, maar het is een keuze en geen afleiding.

**Besluit 3 — verdwijnt het wachtwoord van het eigenaarsaccount?** Pas
beantwoordbaar als 1 en 2 staan en het quorum daadwerkelijk een keer is
beproefd. Tot dan is "wachtwoord + verplichte passkey op zware handelingen" de
eerlijke stand, en die staat nu.

**Nog te bouwen, met de reden erbij:** het quorum zelf (besluit 1), het tijdslot
(besluit 2), de afbreekknop op een lopend herstel (volgt uit het tijdslot), en
sessies met aflopend vertrouwen (par. 4 — een stap weg, geen besluit nodig).
