# Publieke RTG Mail

## De naam

`.rtg` is de korte interne naamruimte. Publieke adressen gebruiken het bestaande
groepsdomein en, zodra het geregistreerd is, het afzonderlijke Foundation-domein:

```text
Werk        voor.achternaam@bedrijf.rahultravelgroup.com
RTG-lid     voor.achternaam@rtgpass.rahultravelgroup.com
Lifestyle   voor.achternaam@lifestyle.rahultravelgroup.com
Business    voor.achternaam@business.rahultravelgroup.com
Foundation  codenaam@rahultravelfoundation.com
```

De twee adressen openen hetzelfde persoonlijke postvak. De openbare vertaling
staat standaard uit en gaat pas aan met:

```text
RTG_MAIL_PUBLIEK_BASIS=rahultravelgroup.com
RTF_MAIL_PUBLIEK_DOMEIN=rahultravelfoundation.com
MAIL_PROVIDER_DKIM=1
MAIL_INBOUND_PROVIDER=aws-ses
SES_INBOUND_SECRET=<minimaal 32 willekeurige tekens, uitsluitend als geheim>
```

Intern blijven leden en Foundation-profielen op codenaam. Alleen het publieke
RTG-ledenadres gebruikt voor- en achternaam. Het pasdomein komt uit het account,
nooit uit het verzoek. Bij gelijke namen voegt de server een volgnummer toe.

## Waarom `.rtg` niet direct publiek wordt

Een top-leveldomein is geen normaal domein dat bij een registrar kan worden
gekocht. De organisatie moet bij ICANN een nieuwe gTLD aanvragen, aantonen dat
zij technisch en financieel een registry kan voeren, een Registry Service
Provider aanwijzen en na goedkeuring een registry-overeenkomst uitvoeren. De
ICANN-ronde van 2026 sloot op 12 augustus 2026. Daarom is de subdomeinroute de
enige vorm die nu direct onder eigen beheer kan worden gedelegeerd.

## Veilige volgorde

1. Kies eerst de SMTP- en inkomende mailprovider. Publiceer nog geen MX-record.
2. Registreer eerst `rahultravelfoundation.com`; laat de provider daarna beide
   publieke domeinen als verzend- en ontvangstdomein verifiëren.
3. Genereer de RTG-DKIM-sleutel met `npm run eigenpost -- rahultravelgroup.com <mail-ip>`
   of gebruik de door de provider opgegeven DKIM-records. De private sleutel
   hoort uitsluitend in het productiegeheim, nooit in Git of Cloudflare DNS.
4. Publiceer SPF en DKIM en verstuur een proefbericht. Er mag maar één
   `v=spf1`-record op dezelfde DNS-naam bestaan.
5. Publiceer DMARC eerst in meetstand. Gebruik pas `quarantine` en daarna
   `reject` als de rapporten aantonen dat alle legitieme verzenders slagen.
6. Zet [het meegeleverde SES-sjabloon](../infra/aws-ses/template.yaml) in
   `eu-central-1` in. Het accepteert alle subdomeinen via de SES-conditie
   `.rahultravelgroup.com`; de Foundation-conditie blijft uit totdat het domein
   bestaat. Activeer daarna expliciet de receipt rule set.
7. Geef Cloudflare pas daarna de SES-MX. SES bewaart het ruwe bericht kort in
   een versleutelde S3-bucket; Lambda ondertekent de bytes en de echte
   envelop-ontvanger voor `/api/mail/ses`. De gewone `/api/mail/binnen`-proefdeur
   staat in deze stand dicht.
8. Meet verzending, ontvangst, antwoord, bounce, SPF, DKIM en DMARC.
9. Zet als laatste de publieke domeinschakelaars aan en herstart gecontroleerd.

## Cloudflare DNS-model

Voor AWS SES in Frankfurt is het inkomende MX-doel
`inbound-smtp.eu-central-1.amazonaws.com`. DKIM komt uit de CloudFormation-
uitgangen; SPF moet ook alle werkelijk gebruikte uitgaande verzenders dekken.
Het doelmodel is:

| Type | Naam | Waarde | Opmerking |
| --- | --- | --- | --- |
| MX | `*` op `rahultravelgroup.com` | `10 inbound-smtp.eu-central-1.amazonaws.com` | bedrijfs- en pasdomeinen; DNS-only |
| MX | `@` op `rahultravelfoundation.com` | `10 inbound-smtp.eu-central-1.amazonaws.com` | pas na registratie; DNS-only |
| TXT | `@` | één SPF-record met alle echte verzenders | huidig record eerst samenvoegen |
| TXT | `rtg._domainkey` | publieke DKIM-sleutel | private sleutel niet publiceren |
| TXT | `_dmarc` | `v=DMARC1; p=none; sp=none; rua=mailto:<werkend-rapportadres>; adkim=r; aspf=r` | na meten gefaseerd aanscherpen |

Cloudflare proxy't SMTP op poort 25 standaard niet. Een eigen mailhost moet dus
een openbaar, DNS-only adres, bereikbaar poort 25, TLS, een passende PTR en
reputatiebeheer hebben. Een provider is voor de eerste publieke uitrol veiliger.

## Wat al automatisch gaat

- Het pasniveau bepaalt server-side het ledenadres; een lid kan zichzelf geen
  Business-adres geven.
- Een dubbele SES/Lambda-poging wordt zeven dagen herkend en niet opnieuw
  bezorgd.
- De SES-envelop wint van `To:`/`Cc:`. Daardoor werkt BCC en kan een vervalste
  kop geen ander postvak kiezen.
- S3-objecten worden na geslaagde bezorging verwijderd; gestrande objecten
  verlopen na twee dagen.
- Een paswijziging of ingetrokken werk-/Foundation-profiel maakt het oude adres
  onbruikbaar bij de ontvangertoets.

Wat niet vanzelf kan: een nog niet gekocht domein registreren, AWS- en
Cloudflare-bevoegdheden verlenen, DNS publiceren of de eerste live proef
goedkeuren. Dat zijn bewuste eigenaarsbesluiten.

## Huidige live meting van 21 augustus 2026

- nameservers: Cloudflare;
- SPF: aanwezig (`include:spf.mijndomeinhosting.nl`);
- MX: ontbreekt;
- DMARC: ontbreekt;
- RTG-DKIM-selector: ontbreekt.
- `rahultravelfoundation.com`: bestaat publiek nog niet (NXDOMAIN).

Daarom blijft de publieke schakel uit totdat provider, MX, DKIM en DMARC samen
zijn ingericht en beproefd.
