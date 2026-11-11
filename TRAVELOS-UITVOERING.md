# RTG TravelOS — federatieve reisarchitectuur en uitvoeringscontract

Dit document is de uitvoeringsbijlage bij `REIZEN.md` en
`TRAVELCOMMERCE.md`. Het is geen nieuw Travel-platform, PartnerOS,
boekingsregister of completion-register. `APPWERKT.json` blijft de enige bron
die een app voltooid mag noemen; de bestaande ketenproeven, Deep Green en
EXPERIENCEWERKT blijven de bronnen voor bewijs en vrijgave.

**Meetdatum:** 11 november 2026. **Bronstand:** commit
`22171d7d9ca1f7918c82be268f1e02bd350b8538` plus de lokale implementatiewerkboom.
Deze werkboom is nog geen onveranderlijke, integraal gekwalificeerde kandidaat.
Een codeverwijzing bewijst dat code bestaat. Zij bewijst niet dat een externe
leverancier is aangesloten, een juridische rol juist is vastgesteld of een
reisvorm operationeel of direct boekbaar is. De actuele productiestatus blijft
**NO-GO**.

## 1. Architectuurbesluit

TravelOS is de federatieve contract- en uitvoeringslaag waarmee RTG Travel,
een zelfstandig reisbureau en een leverancier dezelfde bestaande RTG-vermogens
kunnen gebruiken zonder hun commerciële zelfstandigheid of bronadministratie
over te dragen.

De kern is daarom niet één reismotor in de betekenis van één database of één
service. De kern is één **contractfamilie en uitvoeringsruggengraat**:

```text
werktafels
reiziger · reisagent · touroperator · leverancier · operatie · financiën
                              │
projecties
PersonalOS · Reis · Servicezaak · WorkOS · communicatie · Edge
                              │
TravelOS-contractfamilie
reisvraag · offerteversie · reisorder · reserveringsref · levering · incident
                              │
FoundationOS
Authority · Agreement · Commercial Core · Pay · Execution · Proof · herstel
                              │
bronnen
eigen administratie · provider · boekhoudpakket · airline · hotel · transfer
```

De Reis blijft een projectie. Hij bezit een verwijzing, voornemen en bewijs,
niet de reservering, voorraad, prijs of status van een andere bron. Een domein
of partner schrijft nooit rechtstreeks in de bronadministratie van een ander.

### Vier harde architectuurregels

1. **Autonomie:** softwaregebruik verleent geen netwerkdeelname; netwerkdeelname
   verleent geen toegang tot andermans klanten, leveranciers of tarieven.
2. **Rol per transactie:** reisagent, organisator, bemiddelaar, leverancier,
   platform en betaler zijn geen vaste etiketten op een organisatie. De rol en
   verantwoordelijkheid worden voor iedere overeenkomst en levering vastgelegd.
3. **Economische sluiting:** iedere euro heeft verkoper, schuldenaar,
   begunstigde, grond, valuta, contractversie, uitvoering en herstelroute.
4. **Geen breedteclaim:** een reisvorm mag ondersteund zijn zonder operationeel
   of direct boekbaar te zijn. De kwalificatie staat per reisvorm en keten.

## 2. Zelfstandigheid van iedere partner

De bestaande `org` blijft de juridische, contractuele en beveiligingsgrens.
Een workspace is een productinstantie binnen die grens; een leveranciercode is
een relatie en nooit een identiteit. RTG Travel wordt in een neutrale
partnerketen als gewone tenant behandeld.

Een partner behoudt minimaal:

- eigen klanten en codenamenkoppelingen;
- eigen medewerkers, rollen en goedkeuringen;
- eigen leveranciersrelaties;
- eigen product- en tariefbronnen;
- eigen contracten en voorwaarden;
- eigen betaalprovider en uitbetaalrekening waar gekozen;
- eigen boekhoud- en reserveringsbronnen;
- eigen merk binnen de bestaande tenantgrenzen;
- export, leesbare historie en controleerbare beëindiging.

De tenantgrens is niet genoeg. Iedere beschermde handeling vereist daarnaast
een actor, workspace, zaak of order, doel, rol, relatie, capability en actuele
bevoegdheid. Platformbeheer is geen generieke dossierrol.

### Deelnamevormen zijn rechtenbundels, geen productkopieën

| Deelname | Wat wel | Wat niet vanzelf ontstaat |
|---|---|---|
| Alleen software | Eigen klanten, offertes, reizen, werk, documenten en geldbronnen | Geen handelsnetwerk, gedeelde voorraad of distributie |
| Software + verbindingen | Expliciet gekozen providerverbindingen, aanvragen en statusuitwisseling | Geen publicatie aan andere verkopers |
| Software + distributie | Geselecteerd aanbod onder een versievaste commerciële afspraak | Geen onbeperkte wederverkoop of gebruik van klantdata |

Een netwerkmandaat is doelgebonden, herroepbaar en beperkt op product, actie,
partij en tijd. Het staat los van het softwarecontract.

## 3. De rol is transactioneel

Eén organisatie kan bij reis A bemiddelaar zijn, bij reis B organisator en bij
reis C leverancier. Daarom draagt iedere commerciële transactie een
**rolblad** met minimaal:

| Vraag | Contractveld | Eigenaar van de waarheid |
|---|---|---|
| Wie verkoopt? | `sellerRef` + juridische rol | offerte-/overeenkomstsdomein |
| Wie sluit de overeenkomst met de reiziger? | `contractingPartyRef` | Agreement/Contract Engine |
| Wie organiseert of bemiddelt? | `travelRole` + versie | reisorder |
| Wie levert ieder onderdeel? | `supplierRef` per verplichting | leveringsbron |
| Wie factureert? | `invoiceIssuerRef` | factuurbron |
| Wie int? | `paymentCollectorRef` | betaalintentie en providerbewijs |
| Wie ontvangt welk deel? | allocatieregels | economische bronadministratie |
| Wie draagt wijziging, uitval en aansprakelijkheid? | verplichting + voorwaardenref | overeenkomst/leveringscontract |
| Welke bescherming geldt? | gecontroleerde verklaring of besluitref | bevoegde bewijsbron |

Een organisatietype of genre mag een standaard voorstellen, maar mag het
rolblad nooit automatisch invullen. De bevoegde contractpartij bevestigt de
rol vóór een offerte bindend of een betaling opeisbaar wordt. De precieze
juridische kwalificatie blijft een extern beslispunt per markt en product.

## 4. De contractfamilie

De contractfamilie gebruikt bestaande domeinen en voegt alleen ontbrekende
verbindingen toe. Zij hoeft niet als één tabel, service of universeel object te
worden opgeslagen.

| Contract | Draagt | Bezit nadrukkelijk niet |
|---|---|---|
| Reisvraag | bedoeling, deelnemersrefs, periode, grenzen, eigenaar klantrelatie | boeking of prijsbelofte |
| Reisprojectie | tijdlijn, bronrefs, actualiteit, afhankelijkheden, bewijsrefs | bronstatus of voorraad |
| Productreferentie | provider, product-ID, versie, bereik, bronactualiteit | kopie van providerproduct |
| Offerteversie | aanbod, rolblad, prijsopbouw, voorwaarden, verval, aannames | toekomstige wijzigingen |
| Reisorder | geaccepteerde offerte, partijen, opdrachten, betaalverplichtingen | leverancierbevestiging |
| Reserveringsref | provider-ID, hold, aanvraag, acceptatie, bevestiging, versie | reservering van de provider |
| Leveringsverplichting | wat, wanneer, waar, leverancier, bewijs- en herstelregel | intern leveranciersdossier |
| Wijzigingsvoorstel | impact, alternatieven, kosten, goedkeuringen | uitgevoerde wijziging |
| Incidentzaak | waarneming, getroffen refs, eigenaar, klok, herstel en communicatie | stille overschrijving van reis of order |
| Financiële intentie | grond, bedrag, valuta, partijen, allocatie, idempotentie | boeking zonder providerbewijs |
| Bewijsbundel | refs naar besluit, levering, betaling, correctie en audit | een kopie van alle persoonsgegevens |
| Netwerkmandaat | doel, capabilities, producten, partijen, verval en intrekking | algemene partner- of tenanttoegang |

### De gedeelde overgangstaal

```text
waargenomen → voorgesteld → goedgekeurd → aangevraagd → geaccepteerd
             → bevestigd → in uitvoering → geleverd → afgewikkeld
```

Zijpaden zijn minimaal: `geweigerd`, `verlopen`, `gedeeltelijk-bevestigd`,
`wijziging-vereist`, `annulering-aangevraagd`, `geannuleerd`, `betwist` en
`herstel-vereist`.

Deze woorden zijn een contracttaal, geen generieke toestandmachine die alle
domeinen bestuurt. Een provider behoudt zijn eigen standen en mapt die
expliciet. Onbekende of onverenigbare providerstanden worden niet geraden maar
als `onbekend` of `herstel-vereist` behandeld.

## 5. De vier lussen

### Reizigerslus

Wens → ontwerp → versievaste offerte → akkoord → voorbereiding → uitvoering →
verstoring/herstel → thuiskomst → nazorg → volgende reis.

### Partnerlus

Aansluiten → zelfstandig configureren → eigen werk uitvoeren → optioneel
verbinden → gecontroleerd distribueren → prestaties meten → uitbreiden of
vertrekken.

### Bewijslus

Gebeurtenis → bevoegdheidscontrole → bron- en versiebewijs → uitvoering →
afwijking → compensatie → aansluiting → kwalificatie.

### Economische verbeterlus

Nulmeting → proces via bestaande RTG-vermogens → echte resultaten meten →
verbetering voorstellen → bevoegde uitvoering → nameting.

De economische verbeterlus draait per tenant. Zij gebruikt geen centrale
ranglijst van partners. Vrijgekomen tijd is capaciteit en niet automatisch een
gerealiseerde kostenbesparing. Iedere uitkomst toont meetperiode, teller,
noemer, bron, ontbrekende gegevens, implementatiekosten en verschil tussen
capaciteitswaarde, besparing en extra opbrengst.

## 6. Drie kwalificatieniveaus

Deze niveaus vervangen geen APPWERKT-stand en verhogen geen registerteller. Zij
voorkomen alleen dat brede reisdekking als directe boekbaarheid wordt gelezen.

| Niveau | Minimale betekenis | Verplicht bewijs |
|---|---|---|
| Ondersteund | Reisvorm kan worden vastgelegd, samengesteld, geprijsd als voorstel en als aanvraag aan een bevoegde actor worden overgedragen | vormcontract, bron/herkomst, rechten, foutuitleg, opslag/herstel en negatieve test |
| Operationeel bewezen | Bevoegde medewerkers kunnen de volledige keten met een echte leverancier uitvoeren | echte actor- en tenantgrenzen, acceptatie, levering, wijziging, incident, financieel spoor, menselijke Experience-proef |
| Direct boekbaar bewezen | Actuele beschikbaarheid en prijs kunnen zonder handmatige tussenstap tot bevestiging komen | echte provider, concurrency, hold/verval, idempotentie, betaling, wijziging, annulering, refund, uitval en twee onafhankelijke groene runs |

`Direct boekbaar bewezen` is altijd provider-, markt-, product- en
broncommitgebonden. Een groene hoteladapter maakt een privéjet, cruise of
wandelreis niet direct boekbaar.

## 7. Repository-audit en implementatiecontract

De classificaties zijn: **aanwezig**, **aanwezig maar onvoldoende bewezen**,
**gedeeltelijk**, **ontbrekend**, **extern afhankelijk** en **besluit nodig**.
De tabel hieronder is de auditnulmeting vóór de eerste implementatie.
Paragraaf 15 beschrijft de daarna daadwerkelijk aangesloten software;
uitslagen en blokkades worden uitsluitend in `AFBOUWPROGRAMMA.md` bijgehouden.

| Verantwoordelijkheid | Bestaande eigenaar/bronnen | Contract dat al bestaat | Grootste ontbrekende overgang | Vereiste proef die de blokkade opheft | Stand |
|---|---|---|---|---|---|
| Reisprojectie en herkomst | `server/kern/reiswereld*.js`, `server/kern/reis.js` | bron, soort, herkomst, actualiteit | order- en leveringsrefs uit meerdere tenants uniform projecteren | bronverlies, stale data en conflicterende providerstand in echte keten | aanwezig maar onvoldoende bewezen |
| RTG-reisaanvraag | `server/kern/reisbureau.js`, `reisbureau-opslag.js` | aanvraag, codenaam, personen, status | actor-/tenantneutrale verkoper in plaats van alleen RTG-balie | dezelfde aanvraag voor RTG Travel en onafhankelijke tenant | gedeeltelijk |
| Menselijk besluit en nazorg | `reisbureau-besluit.js`, `-nazorg.js`, `-wijziging.js` | besluit, wijzigingsverzoek, afzegging | beslisser en contractpartij uit actieve tenant/rol | onbevoegd, ingetrokken rol, tweede tenant en gelijktijdige wijziging | gedeeltelijk |
| Reiscompositie | `reisbureau-samenstelling.js`, `reiswereld-regel.js` | soort, herkomst, economische eigenaar, centen | versievaste offerte/order met providerproductrefs | prijs-/compositiewijziging tussen offerte, akkoord en betaling | gedeeltelijk |
| Reisgeld en herkomst | `reisbureau-betaling.js`, `-geldrijen.js` | één inning, geldrijen, economische sleutel | betaalprovider per tenant, allocatie en settlement naar echte partijen | crash/replay, gedeeltelijke levering, multi-provider aansluiting | gedeeltelijk |
| Teruggave | `reisbureau-teruggave.js`, `-terugboeking.js`, kantoorroutes | recht, spiegel, menselijke uitvoering | proportionele refund per verplichting en contractregel | gedeeltelijke annulering, providerweigering en dubbele callback | gedeeltelijk |
| Commercial Core | `server/kern/commercie/`, `server/kern/commerce/` | catalogus, contract, fee, allocatie, intentie | reisofferte en reisorder als echte callers van de bestaande kern | contractprijs blijft vast; factuur en refund sluiten op order | gedeeltelijk |
| Overeenkomst en rolblad | `server/kern/commercie/contract.js`, bestaande Agreement-vormen | partij, prijs, verplichting en bewijsrefs | transactionele reisrol en voorwaardenversie | één organisatie in twee verschillende rollen zonder rechtenlek | gedeeltelijk |
| Tenantautonomie | `server/kern/tenant/`, `TENANT.md` | org, workspace, rol, merk, uitgang | eigen providers/contracten/tarieven als tenantgebonden configuratie | export/herimport van volledige reiszaak; RTG Travel ziet niets | aanwezig maar onvoldoende bewezen |
| Authority | `server/kern/bevoegdheid/`, commerciële en servicepoorten | actor, rol, capability, context en bewijs | netwerkmandaat per product/actie/partij/tijd | intrekken tijdens lopende opdracht; stale token wordt geweigerd | gedeeltelijk |
| Leverancierswerk | `server/kern/leverancier/`, `server/routes/supplier/` | zaak, genre, opdrachten en relevante caps | gedeelde leveringsverplichting en expliciete acceptatie | hotel, transfer en activiteit met eigen tenant en minste gegevens | gedeeltelijk |
| Capaciteit en beschikbaarheid | supplier-tickets, activiteiten- en reserveringskernen | tijdslot, capaciteit en providerbewijs | uniforme hold, verval en concurrency per adapter | twee kopers op laatste plek; één bevestiging, één eerlijk herstel | gedeeltelijk |
| Service en incident | `server/kern/service/`, `server/kern/reisoplosser.js` | zaak, tijdlijn, eigenaar, voorstel | incident aan order, verplichtingen en geldgevolg koppelen | vertraging raakt transfer/hotel/communicatie zonder automatische wijziging | gedeeltelijk |
| Uitvoering en compensatie | bestaande plan-, mandaat- en uitvoeringskernen | voorstel, goedkeuring, stap, resultaat | providercommando met inbox/outbox en compensatiebewijs | timeout na extern succes, herhaling en handmatig herstel | gedeeltelijk |
| Offline continuïteit | `server/kern/zaakdoos/`, Travel-continuity clientlaag | beperkte lokale kopie, synchronisatie en journaal | minimale reisnoodset plus offline commandowachtrij | verlies netwerk/apparaat; geen schijnbevestiging; veilig herstel | gedeeltelijk |
| Bewijs en observatie | `server/kern/envelop.js`, `server/kern/bewijsvlak/` | oorzaak, correlatie, actor, bron en bewijs | reisbrede causatie over externe adapters zonder PII-log | keten opnieuw opbouwen uit refs; log bevat geen reisdocumenten | gedeeltelijk |
| Economische meting | kosten-, economie- en bewijsmodules | meetbare gebeurtenis en herkomst | tenantgebonden nul-/nameting en kostentoerekening | echte periodevergelijking met aannames en ontbrekende data | ontbrekend voor TravelOS |
| Externe airline-/hotelproviders | geen productieprovider bewezen | lokale bron- en providerbewijs-vormen | versiebeheerbare adapters en conformance-profiel | sandbox plus echte acceptatie en storingsproeven | extern afhankelijk |
| Juridische reisrol en bescherming | genre-/handelingsbewijs en contractvelden deels aanwezig | `pakketreis` als handelingssignaal | rol, markt, bescherming en aansprakelijkheid per transactie | jurist/verzekeraar/garantiefonds en contractacceptatie | extern afhankelijk |

Geen rij in deze tabel is een productieverklaring. De historische meting in
`TRAVELCOMMERCE.md` paragraaf 9 blijft bewijs van die datum; latere code zoals
de reisbetaling en geldherkomst maakt die historische meting niet automatisch
tot een actuele integrale kwalificatie.

## 8. Technisch uitvoeringscontract

### Eén modulaire backend totdat metingen een splitsing eisen

De eerste implementatie blijft binnen de bestaande backend. Nieuwe
verantwoordelijkheden krijgen modulegrenzen, geen vooraf bedachte microservice.
Een afzonderlijke service is pas gerechtvaardigd door aantoonbaar afwijkende
schaal, beschikbaarheid, sleutelgrens of wettelijk eigenaarschap.

### Betrouwbare mutaties

Iedere muterende provideractie gebruikt:

- een door de caller aangeleverde idempotentiesleutel;
- verwachte versie of ETag;
- tenant-, actor-, order- en providerbinding;
- correlation- en causation-ID uit de bestaande envelop;
- transactionele outbox voor verzending na lokale commit;
- inbox/ontvangstregister tegen dubbele providerantwoorden;
- expliciete timeoutstand: `onbekend`, nooit automatisch `mislukt`;
- compensatie als nieuwe, aantoonbare handeling;
- onveranderlijk bewijs van aanvraag en antwoord.

Er wordt niet overal event sourcing ingevoerd. Bestaande domeinopslag blijft de
bron; gebeurtenissen dragen integratie, audit en herstel.

### Adaptergrens

Een provideradapter verklaart minimaal:

- provider- en contractversie;
- ondersteunde producten en acties;
- statusmapping inclusief onbekende waarden;
- prijs- en beschikbaarheidsactualiteit;
- hold- en vervalgedrag;
- idempotentie- en replaygedrag;
- authenticatiemethode en sleutelrotatie;
- rate limits en storingsbeleid;
- persoonsgegevens en bewaartermijnen;
- reconciliatie- en exitroute.

OpenAPI beschrijft synchrone opdrachten en queries. AsyncAPI/CloudEvents kan de
externe gebeurtenisgrens beschrijven; intern blijft `server/kern/envelop.js`
leidend. IATA NDC/ONE Order en OpenTravel worden adapters, geen vervanging van
het RTG-domeinmodel.

### API-beveiliging

Externe professionele clients gebruiken waar de integratie dat ondersteunt:

- OAuth-profielen voor hoogwaardige API's;
- confidential clients;
- korte, doelgroepgebonden tokens;
- sender-constrained tokens via mTLS of DPoP;
- PKCE/PAR bij interactieve delegatie;
- gestructureerde autorisatie voor product, actie, bedrag en tijd;
- onmiddellijke intrekking en sleutelrotatie;
- geen providergeheimen in browser of AI-context.

Dit is een invulling van de bestaande Authority-grens, geen tweede
autorisatiemotor.

## 9. De economisch gesloten reis

```text
offerteversie
  → overeenkomst + transactioneel rolblad
  → reisorder
  → leveranciersverplichtingen
  → betaalintentie
  → inning en providerbewijs
  → economische allocatie
  → levering of afwijking
  → settlement / refund / correctie
  → reconciliatie
  → afsluitbewijs
```

Harde geldregels:

- bedragen worden als gehele minor units bewaard, nooit als binaire float;
- valuta, exponent, koersbron, koerstijd en koersgeldigheid staan vast;
- catalogusprijs, offerteprijs, contractprijs, kostprijs, factuurbedrag,
  belasting, fee en marge blijven afzonderlijk;
- een bedrag zonder economische eigenaar of grond wordt geweigerd;
- betaling, uitbetaling en refund hebben elk een eigen idempotentiesleutel;
- een providercallback is pas bewijs na authenticatie, replaycontrole en
  aansluiting op de oorspronkelijke intentie;
- gedeeltelijke levering maakt een proportionele, contractueel verklaarde
  correctie en nooit een handmatige stille overschrijving;
- faillissement of uitval opent een incident- en herstelzaak; software verzint
  geen dekking of aansprakelijkheid.

Een partner mag een eigen betaalprovider gebruiken. TravelOS bewaart dan
minimaal intentie, bewijsref, bedrag, status en reconciliatie-uitkomst; RTG Pay
wordt niet verplicht om netwerkdeelname af te dwingen.

## 10. Eerste twee spiegelketens

De eerste verticale kwalificatie gebruikt één beperkte reiscompositie met een
verblijf, transfer en activiteit. De specialistische zestien reisdisciplines
komen niet tegelijk in scope.

### Keten A — RTG Travel

```text
wens → offerteversie → menselijk akkoord → drie leveranciersaanvragen
→ expliciete acceptaties → betaling → uitvoering → één wijziging
→ gedeeltelijke correctie → settlement → reconciliatie → nazorg
```

### Keten B — onafhankelijk reisbureau

Dezelfde productvorm en contracten, maar met:

- eigen org en workspace;
- eigen klantrelatie en merk;
- eigen medewerker en goedkeuring;
- eigen prijzen, marge en voorwaarden;
- minstens één eigen leverancier;
- eigen betaalprovider of aantoonbaar afzonderlijke RTG Pay-configuratie;
- geen dossier- of concurrentie-inzage voor RTG Travel;
- volledige export en veilige beëindiging.

De spiegelproef is pas geldig wanneer hetzelfde testscript beide ketens via
dezelfde contractfamilie uitvoert en alleen tenantconfiguratie, partijen en
adapters verschillen.

## 11. Integrale testmatrix

| Scenario | Positief bewijs | Negatieve of storingsproef | Verplichte eigenaar |
|---|---|---|---|
| Offerteversie | getoonde versie is geaccepteerd | prijs wijzigt vóór akkoord; oude versie blijft bewijs | verkoper |
| Transactionele rol | verkoper, organisator, leverancier en factuurpartij staan vast | organisatie wisselt rol bij tweede reis zonder rechtenoverloop | contractpartij |
| Laatste capaciteit | één hold en bevestiging | twee gelijktijdige kopers, timeout en verval | provider |
| Partneracceptatie | aanbieder accepteert zelf | platform of verkoper probeert namens aanbieder te accepteren | leverancier |
| Betaling | intentie, providerbewijs en order sluiten | dubbele callback, crash na provideracceptatie, bedrag gewijzigd | financiële eigenaar |
| Gedeeltelijke levering | geleverd deel en open deel apart | totaal als geleverd markeren na één onderdeel | uitvoerder |
| Wijziging | voorstel, prijsimpact, akkoord en providerbevestiging | Rahul of reiziger wijzigt bronstatus direct | contractpartij/provider |
| Annulering/refund | recht, bedrag, uitvoering en aansluiting | dubbele refund, verkeerde rekening, deel zonder grond | financieel bevoegde mens |
| Vluchtvertraging | impact op transfer/hotel wordt zichtbaar | stale bron, conflicterende tijden, geen automatische uitvoering | incident-eigenaar |
| Provideruitval | alternatief en menselijke keuze | onbekende externe uitkomst wordt als mislukt overschreven | zaakverantwoordelijke |
| Offline | laatst bevestigde noodset leesbaar | offline voorstel verschijnt als bevestigde boeking | continuiteitseigenaar |
| Tenantisolatie | twee spiegelreizen blijven gescheiden | IDOR, cachelek, oude async respons, gedeeld provider-ID | Authority/tenant |
| Bevoegdheid ingetrokken | nieuwe actie direct geweigerd | stale token, open browser en replay | Authority |
| Partner vertrekt | export is leesbaar en herimporteerbaar | geheimen, RTG-koppelsleutel of ontbrekende historie in export | tenant-eigenaar |
| Economische waarde | nul- en nameting met teller/noemer | bespaarde minuten als gerealiseerde euro's presenteren | partner zelf |
| AI onbeschikbaar | handmatige keten blijft werken | AI-output creëert order, geld of providercommando | uitvoeringslaag |

## 12. Bouw- en kwalificatievolgorde

1. **Contractaudit:** bestaande reis-, geld-, tenant-, leverancier- en
   Agreement-vormen naar de contractfamilie mappen; niets migreren zonder
   bron- en eigenaarbesluit.
2. **Rolblad en offerteversie:** transactionele partijen, prijs, voorwaarden,
   verval en akkoord vastleggen.
3. **RTG Travel-keten sluiten:** bestaande reisbetaling, compositie,
   wijziging en teruggave aan echte leveringsverplichtingen koppelen.
4. **Drie leveranciersrollen:** accommodatie, transfer en activiteit met
   expliciete acceptatie en minste gegevens.
5. **Onafhankelijke spiegeltenant:** dezelfde keten zonder RTG
   Travel-bevoegdheid of verplichte RTG-provider.
6. **Storingslus:** idempotentie, gedeeltelijke acceptatie, timeout, offline,
   annulering, refund en provideruitval.
7. **Economische verbeterlus:** nulmeting, meetbare interventie en nameting per
   tenant; geen centrale ranglijst.
8. **Deep Green-kwalificatie:** actuele APPWERKT- en Experience-bewijzen,
   security/privacy/finance, browserproeven en twee onafhankelijke groene runs
   op dezelfde kandidaatcommit.
9. **Daarna pas verbreden:** iedere volgende reisdiscipline begint op
   `ondersteund` en verdient afzonderlijk de hogere niveaus.

Er worden vóór stap 8 geen productieclaims of registerstanden groen gemaakt op
grond van alleen unit-, mock- of lokale integratietests.

## 13. Beslispunten vóór productie

| ID | Besluit | Waarom code dit niet mag verzinnen |
|---|---|---|
| TRV-01 | Juridische rol en contractpartij per product/markt | bepaalt informatieplicht, geld, aansprakelijkheid en herstel |
| TRV-02 | Prijsmodel van RTG Travel en RTG Technologies | platformfee, reiswinst en netwerkvergoeding moeten gescheiden blijven |
| TRV-03 | Aanbetaling, termijnen, wijziging en annulering | zijn contractuele toezeggingen, geen UI-keuze |
| TRV-04 | Settlement- en insolventieroute | geld en bescherming verschillen per rol en markt |
| TRV-05 | Criteria voor netwerkpublicatie | bepaalt keuring, intrekking en verantwoordelijkheid |
| TRV-06 | Achtergrondbewaking en responstijden | maakt van waarneming een operationele belofte |
| TRV-07 | Provider- en adapteracceptatie | bepaalt welke externe bron als bevestiging mag gelden |
| TRV-08 | Supporttoegang en onafhankelijke controle | platformbeheer mag geen commerciële achterdeur worden |
| TRV-09 | Economische meetmethode | voorkomt dat capaciteit als besparing wordt verkocht |
| TRV-10 | Externe security-, privacy-, betaal- en juridische toets | interne tests kunnen die acceptatie niet vervangen |

## 14. Vrijgavecontract en actuele conclusie

TravelOS kan pas een eerste operationele netwerkclaim doen wanneer:

- Keten A en B op dezelfde contractfamilie integraal groen zijn;
- drie zelfstandige leveranciers hun eigen levering accepteren en bewijzen;
- RTG Travel geen ongeautoriseerde toegang tot de spiegeltenant heeft;
- betaling, allocatie, refund, settlement en reconciliatie sluiten;
- dubbele, late en conflicterende providerantwoorden veilig herstellen;
- offline gebruik geen schijnbevestiging produceert;
- een vertrekkende partner zijn bruikbare geschiedenis kan meenemen;
- de economische waarde met nul- en nameting wordt getoond zonder
  besparingsclaim zonder grond;
- de relevante bestaande APPWERKT-, EXPERIENCEWERKT-, Authority-, security-,
  privacy-, finance- en Deep Green-poorten geldig zijn;
- twee onafhankelijke volledige runs dezelfde kandidaatcommit kwalificeren.

Tot die tijd is de eerlijke conclusie:

> De bestaande RTG-reiskern bevat reisprojecties, een eigen reisbureau,
> samenstelling, betaling, wijziging en teruggave op software-niveau. De
> federatieve partnerketen, transactionele juridische rol, echte externe
> leveranciersacceptatie, economische aansluiting en integrale kwalificatie
> zijn nog niet als één operationele keten bewezen. TravelOS blijft NO-GO.

## 15. Aangesloten lokale verticale keten

De eerste implementatie gebruikt dezelfde `reisAanvragen`-collectie en
transactionele opslagpoort als het bestaande reisbureau. Een `keten`-envelop
onderscheidt de nieuwe contractvorm; er is geen tweede boekingsdatabase,
catalogus, login of administratie gestart. Oude RTG-balieprojecties selecteren
uitsluitend de klassieke aanvragen. Hun vervangende schrijfbewerking bewaart
de ketenrijen; ook andere globale lezers krijgen geen partnerdossiers mee.

### Eigenaars en aansluitingen

| Bestaande grens | Aangesloten module | Verantwoordelijkheid en beperking |
|---|---|---|
| Reisaanvragen / collectieopslag | `server/kern/reisbureau-keten.js`, `-ketenopslag.js` | aanvraag, exacte zaakversie, actor-gebonden ontvangst, offerte, akkoord en leveranciersopdracht; geen providerbronboekingen |
| Reiscontract | `server/kern/reisbureau-ketencontract.js` | gehashte offerteversie, rolverklaring, verval, EUR-centbedragen en bronreferenties; geen juridische goedkeuring |
| Bestaande sessie-, kantoor-, staff- en tenantpoorten | `server/kern/reisbureau-toegang.js` | persoonlijke medewerker, actuele managerrol, org én leverancierscode; geen rechten uit de requestbody of gedeelde zaakcode |
| Ledenreisbureau | `server/routes/member/reisketen.js` | eigen aanvraag lezen/starten, actuele offerte aanvaarden, overeengekomen bedrag betalen |
| Bestaand RTG-kantoor | `server/routes/kantoren/reisketen.js` | alleen eigen RTG-reizen; platformbeheer geeft geen partnerinzage |
| Bestaande leverancierswerkplek | `server/routes/supplier/reisketen.js` | bureau ziet eigen verkopen; aanbieder ziet uitsluitend eigen opdrachten en leveranciersbedrag |
| RTG Pay | `server/kern/reisbureau-ketenbetaling.js`, `reisbureau-betaaltoestemming.js` | inning op vaste economische sleutel, bestaande identiteitspoort, huisvrijgave, waardepoort en grootboek; alleen nieuw innen vraagt actuele betaaltoestemming, alleen bestaand exact bewijs kan read-only herstellen |
| Nazorg binnen dezelfde zaak | `server/kern/reisbureau-ketennazorg.js` | klant vraagt wijziging/annulering van exacte geaccepteerde onderdelen; eigen verkoper antwoordt; geen uitvoerings-, annulerings- of terugbetaalmandaat |
| Transportreplay | `server/lib/ontvangst-operatiepad.js` | exact begrensde ketenroutes lezen opnieuw actuele bevoegdheid en projectie; geen heruitgifte van een gecachet gevoelig antwoord |
| Bestaande mutatiecontracten | `server/lib/idemsleutels-reisketen.js`, `mutatiecontracten-reisketen.js` | registratie in de bestaande poorten, geen tweede mutatie- of bewijsstelsel |
| Bestaande werktafels | `public/apps/reisketen-werktafel.js`, `reisketen-offerte.js`, `reisketen-nazorg.js` | gedeelde offerte-/nazorgbediening voor kantoor en partner; tijdelijk offerteconcept in schermgeheugen, expliciete herbeoordeling na conflict |
| Bestaand reizigersscherm | `public/apps/reisbureau-keten.js` | reiswens, exacte offerte met expliciet akkoord, bevestigingsstand, Pay-inning en broncontrole na antwoordverlies |
| Bestaand aanbiedersscherm | `public/apps/reisketen-leverancier.js` | uitsluitend eigen opdrachten accepteren, weigeren en levering verklaren; geen bevestiging namens een andere aanbieder |
| Bestaande tenantuitgang | `server/kern/reisbureau-ketenexport.js`, `server/kern/tenant/uitgang-reis.js` | documentair archief via bestaande export/import, beperkt tot de huidige persoonlijke zaakbevoegdheid; geen actieve contracten, oude accountsleutels, betaalrechten of volledige tenantuitgang |

De montage staat in `server/opzet/kernlaag2.js` en de bestaande route-indexen.
De professionele actor wordt bij **ieder** verzoek opnieuw gecontroleerd.
Gedeelde toegangscodes, een medewerker zonder actuele managerrol, een gesloten
tenant en AI-toolbediening worden niet als persoonlijke contractbevoegdheid
geaccepteerd. De huidige lokale proef gebruikt drie leveranciersgenres, maar
die genres zijn geen bewijs van een echt hotel-, vervoer- of activiteitencontract.

### Uitgevoerde toestanden, niet alleen een ontwerp

| Overgang | Wie handelt | Bevestiging en foutgrens |
|---|---|---|
| aanvraag → aangeboden | eigen persoonlijke verkoper | offertehash, verval, voorwaarden, expliciet rolblad en providerrefs; oude zaakversie geeft 409 |
| aangeboden → geaccepteerd | eigenaar van de persoonlijke aanvraag | exact getoonde offertehash, niet verlopen, verkoper en aanbieders nog actief in dezelfde org |
| geaccepteerd → gedeeltelijk-bevestigd → bevestigd | iedere aanbieder afzonderlijk | eigen opdracht + bronreferentie; verkoper kan niet namens aanbieder bevestigen |
| aangevraagd onderdeel → geweigerd | eigen aanbieder | keten wordt `herstel-vereist`; geen inning, automatische vervanging of financiële compensatie |
| bevestigd → betaling bevestigd | reiziger via bestaande Pay-poort | durable claim vóór I/O, vaste van/naar/centen/grond, economisch eenmaal; onbekend antwoord is geen mislukking of nieuwe betaalintentie |
| bevestigd onderdeel → geleverd | eigen aanbieder, na betaling | nieuwe leveringsverklaring naast het oorspronkelijke acceptatiebewijs; één onderdeel maakt niet de hele reis geleverd |
| geaccepteerde offerte → nazorgvraag | eigen reiziger | exacte offertehash/onderdelen, zaakversie en ontvangstsleutel; oorspronkelijke reis, opdrachten en betaling blijven ongewijzigd |
| nazorgvraag → antwoord | huidige eigen verkoper | voorstel/toelichting met bronreferentie als verklaring; niet overschrijfbaar, niet juridisch geverifieerd en niet uitgevoerd |
| geleverd → afgewikkeld | nog niet vrijgegeven | harde weigering: settlement, mogelijke teruggaven en financiële aansluiting zijn niet aangesloten/gekwalificeerd voor deze contractvorm |

De proef is beperkt tot één valuta en expliciete handmatige
leveranciersverklaringen. Er is geen live beschikbaarheidscontrole of
capaciteitshold. `ondersteund` in een projectie betekent hier uitsluitend de
lokale softwarestand; `operationeelBewezen` en `directBoekbaarBewezen` blijven
beide `false`. De routegrens in `server/lib/reisketen-antwoord.js` sluit de
hele nieuwe contractketen buiten een bewezen lokale proefinstallatie. Er is
geen nieuwe omgevingsvlag waarmee iemand de productieblokkade kan overslaan.

### Reparaties aan de bestaande reiskern

De bestaande RTG-reisbetaling is niet omzeild. De samenstelling en prijsgrond
worden nu bij aanvraag vastgezet; betaling reconstrueert geen prijs uit een
ondertussen gewijzigde catalogus. Een oude aanvraag zonder prijsgrond wordt
veilig geweigerd en vraagt menselijke migratie, geen fictieve aanvulling.

De inningsclaim, wijziging en annulering lopen langs dezelfde transactionele
aanvraaggrens. Boekings- en componentrijen hebben stabiele identiteit. Daardoor
kan een retry na procesuitval geen tweede inning of tweede economische
componentprojectie publiceren. De bestaande nazorg- en teruggave-eigenaar
blijft eigenaar van de klassieke reisvorm; die contracten worden niet
stilzwijgend op federatieve partnerreizen toegepast.

Een onbekende federatieve betaaluitkomst wordt eerst via de bestaande
economische sleutel gelezen met `pay.boekBekend`. Een reeds geboekte, exact
aansluitende beweging kan daarmee worden hersteld nadat een aanbieder sluit.
Alleen expliciet bewezen afwezigheid mag langs alle actuele bevoegdheids- en
contractcontroles opnieuw tot inning leiden. Een onbereikbare bron of afwijkend
bewijs is geen toestemming om opnieuw te betalen.

Bij een **nieuwe** inning gebruiken zowel het klassieke als het federatieve pad
de bestaande `onboarding.payGate` en `pay.vrijgavePoort.intern`. Ontbrekende of
onzekere toestemming sluit het pad. De route leest de bestaande identiteitspoort
vóór de aanvraagtransactie, omdat die poort bij eerste gebruik zelf een bestaand
onboardingspoor bewaart. Het bestaande-bewijsherstel verricht geen nieuwe inning
en kan daarom ook na intrekking aansluiten, uitsluitend bij een exacte match.

De documentaire reisexport gebruikt de bestaande ketenlezingen met opnieuw
getoetste persoonlijke managementrol, org en zaakcode. `vorm: uitvoer` of
`vorm: leesbaar` op de bestaande partner-/opdrachtenlezing geeft een checksum-
gedekt archief. Actoren zijn zaaklokale aliases; ontvangstsleutels, accountkeys
en ledgeradressen reizen niet mee. De aanbieder krijgt geen nazorg, reizigers-
of margedossier. Import in een werkruimte bewaart alleen een documentair
archief, geen uitvoerbare reis of nieuwe bevoegdheid.

### Nog geen volledige autonomie- of afrondingsclaim

De volgende delen zijn **nog niet geïmplementeerd of integraal bewezen** voor
de nieuwe contractvorm: uitvoering van wijzigingen na akkoord, gedeeltelijke annulering en
refund, provideruitval met alternatief, leverancierssettlement, externe PSP
per tenant, volledige tenantbrede reisexport, offline noodset en synchronisatie,
reisprojectie naar alle bestaande werelden en een economische nul-/nameting.
Het tonen van open leveranciersbedragen is geen uitbetaling of verrekening.

De zaakgebonden reisexport is daarom uitdrukkelijk geen bewijs dat een partner
na sluiting al zijn tenantbrede reisgeschiedenis kan meenemen. Import kan die
beperking niet veranderen, en kan geen oorspronkelijke accountsleutels of
nieuwe tenantgrenzen herstellen/overschrijven. Voor volledige reisuitgang moet
eerst de bevoegde tenantbrede actor en bewaar-/vertrekprocedure worden
vastgesteld; de werkruimtebeheerder wordt niet tot zo'n actor verheven.
Herstel van een geopende sessie na netwerkuitval is eveneens iets anders dan
een koude offline start met een veilig nood-dossier. De nieuwe UI bewaart
geen gevoelig reisarchief in browseropslag.

Dezelfde grens geldt nu voor de **Zaakdoos**: de bestaande online proxy mag
een actuele bron doorgeven, maar na uitval mag geen lokale reislezing,
mutatie, antwoordcache of journaalreplay die bron vervangen. De afbakening
hergebruikt de bestaande vijftien routecontracten, ook voor reeds ondertekende
oude journaalregels. Een 503 is hier bewust geen offline uitvoeringsbewijs.
De proef omvat een echte online proxy, het uitvallen daarvan, een koude doos
met bestaande reisdata en ongewijzigde gegevens na herstel.

De werkruimte-import controleert tevens vorm, unieke catalogussoorten,
aantallen en veilige documentaire reisrecords vóór opslag. De
tenantlevensloop stopt vernietiging wanneer de tenant als verkoper of
aanbieder betrokken is bij federatieve reishistorie. Een onleesbare bron
sluit eveneens. Dit is geen nieuwe bewaartermijn, volledige reisuitgang of
bevoegdheid om gedeelde contracten te wissen; juist die besluiten blijven
nodig voordat volledige vernietiging kan worden verklaard.

Verdere kwalificatie vereist de besluiten TRV-01, TRV-03, TRV-04, TRV-07,
TRV-08 en TRV-10, gekoppelde echte partijen en de bestaande integrale
releasecriteria. De uitgevoerde testcommando's, uitkomsten en resterende
blokkades staan in het bestaande centrale `AFBOUWPROGRAMMA.md`, niet in een
nieuw bewijsregister.

### Pilotkeuze van de eigenaar, 11 november 2026

De eigenaar heeft **beide** commerciële routes in scope bevestigd: RTG Travel
en een onafhankelijk reisbureau, naast de lokale softwareproeven. Geen
voorrangsrecht of verplichte deelname aan het RTG-handelsnetwerk volgt daaruit.
De bestaande spiegelproeven voeren beide verkopers uit via dezelfde kern en
afzonderlijke ontvangers; dat is geen acceptatie van echte pilotcontracten.

Per pilot blijven de eigen goedgekeurde contracten, juridische transactierol,
annulerings-/terugbetaalregels, betaalprovider en leveranciersafspraken nodig.
De keuze voor beide pilots verleent geen bevoegdheid om die voorwaarden zelf
vast te stellen, extern te tekenen of echte bedragen te verplaatsen. TRV-01,
TRV-03, TRV-04, TRV-07 en TRV-10 blijven open tot hun eigen bewijs er is.
