# AWS SES-ontvangst voor RTG Mail

Dit sjabloon maakt de veilige ontvangstbrug. Het zet geen DNS-records en maakt
geen SMTP-wachtwoord aan: domeinbezit, Cloudflare en productiegeheimen blijven
aparte bevoegdheden.

## Voorwaarden

- Gebruik een AWS-regio die SES-ontvangst ondersteunt; voor deze installatie is
  `eu-central-1` (Frankfurt) de logische keuze.
- `CallbackUrl` moet de echte app-URL plus `/api/mail/ses` zijn.
- Maak één willekeurig geheim van minimaal 32 tekens en plaats dezelfde waarde
  in de CloudFormation-parameter `InboundSecret` en in het app-geheim
  `SES_INBOUND_SECRET`. Zet ook `MAIL_INBOUND_PROVIDER=aws-ses`.
- Laat `EnableFoundation=false` totdat `rahultravelfoundation.com` werkelijk is
  geregistreerd en onder eigen beheer staat.

## Inzetten

Voorbeeld met AWS CLI (voer het geheim niet in shell history in; gebruik in de
echte uitrol bij voorkeur een beveiligde parameterfile of CI-secret):

```sh
aws cloudformation deploy \
  --region eu-central-1 \
  --stack-name rtg-mail-inbound \
  --template-file infra/aws-ses/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CallbackUrl=https://app.rahultravelgroup.com/api/mail/ses \
    InboundSecret=VUL_DIT_VEILIG_IN \
    EnableFoundation=false
```

Activeer na een geslaagde stack de rule set expliciet:

```sh
aws ses set-active-receipt-rule-set \
  --region eu-central-1 \
  --rule-set-name rtg-mail-inbound
```

Publiceer daarna de drie Easy-DKIM CNAME-uitgangen en pas na verificatie de MX:

```text
naam: *
type: MX
prioriteit: 10
doel: inbound-smtp.eu-central-1.amazonaws.com
```

Die wildcard op `rahultravelgroup.com` dekt de bedrijfs- en pas-subdomeinen.
Voor de Foundation komt later een afzonderlijke MX op `@`. Cloudflare-records
moeten DNS-only zijn. Voeg SPF/DMARC niet blind toe: voeg een bestaand SPF-record
samen en bouw DMARC op van `p=none` naar `quarantine` en pas daarna `reject`.

## Gegevensstroom en herstel

SES scant, zet het ruwe MIME-bericht onder `incoming/<message-id>` in een
versleutelde, niet-publieke S3-bucket en start Lambda. Lambda ondertekent tijd,
message-id, echte envelop-ontvanger en de SHA-256 van de bytes. RTG controleert
dat alles, voorkomt dubbele bezorging en gebruikt de envelop in plaats van de
vervalsbare `To:`-kop.

Na definitieve verwerking verwijdert Lambda het object. Bij 409, 429 of 5xx
wordt de Lambda-bezorging opnieuw geprobeerd; gestrande objecten verdwijnen na
twee dagen door de lifecycle-regel. De CloudFormation-stack behoudt de bucket
bij verwijderen om onbedoeld dataverlies te voorkomen.
