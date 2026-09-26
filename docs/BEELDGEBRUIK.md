# Eigen beelden per verhaal

Een sfeerfoto hoort bij een concreet verhaal of scherm. De vier wereldfoto's zijn
geen algemene achtergrondbank voor alle apps en widgets uit die wereld.

- Wereldhomes houden hun eigen hoofdbeeld. Verhalen, vervolgkaarten, websites en
  afzonderlijke apps krijgen een ander beeld dat bij hun onderwerp past.
- Functionele widgets tonen hun eigen gegevens en pictogram. Alleen een passend
  onderwerp gebruikt een eigen sfeerbeeld. Een compacte favoriete widget herhaalt
  dat beeld niet naast de volledige widget.
- Algemene wereldmaterialen gebruiken kleur, licht en verloop. Ze injecteren geen
  gedeelde foto in ieder scherm.
- Een productafbeelding blijft een opname van de echte app. Gebruikersfoto's,
  profielfoto's en dezelfde inhoud die iemand opnieuw opent vallen buiten het
  verbod op hergebruik van redactionele sfeerfoto's.

De nieuwe beelden staan in `public/images/editorial/`. `PROVENANCE.json` bevat per
beeld het volledige prompt, de oorspronkelijke bestandsnaam, afmetingen en
SHA-256. De 49 beelden zijn met de ingebouwde ImageGen gemaakt en als WebP
gecodeerd. Het zijn illustraties, geen bewijs van echte klanten, medewerkers,
locaties, boekbaar aanbod of productresultaten.

Dezelfde bestandsverwijzing kan technisch op meerdere plekken staan: een preload
en de uiteindelijke afbeelding, responsive CSS, of de JavaScript- en no-JavaScript-
versie van hetzelfde onderdeel. Dat is dezelfde inhoud, geen tweede verhaal met
een geleende foto. Controleer daarom ook het uiteindelijke scherm.

## Controle bij wijziging

`test/startpagina.test.js` controleert de geregistreerde bytes, ontbrekende
beeldregistraties en identieke kopieën onder een andere bestandsnaam.
`test/rtg-heritage.test.js` bewaakt de algemene wereldmaterialen zonder foto.
De bestaande home-, desktop-, first-steps-, daily-rooms- en storyline-browsertests
blijven verantwoordelijk voor de werking van die onderdelen.

Controleer mobiel en desktop na het verdwijnen van het opstartscherm, laad ook de
beelden onder de vouw en controleer interactieve vervolgschermen. Een statische
URL-inventarisatie bewijst op zichzelf niet dat iedere runtime-toestand vrij van
dubbele beelden is.

De losse www-bundel moet ook `public/images/editorial/` meenemen wanneer hij de
gedeelde platformbestanden uit deze repository kopieert.
