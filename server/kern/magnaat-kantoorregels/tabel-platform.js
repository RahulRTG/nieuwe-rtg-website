/* De eigenaarsregels van het RTG Controleregister: DE PLATFORMLAAG.

   Afgesplitst van ./tabel.js toen die over de 9400 bytes van de waarschuwband
   van keuringsregel 13 kwam. Dat is dezelfde knip als bij ./tabel-lid.js en
   ./tabel-breed.js, en om dezelfde reden: dit is een TABEL en geen logica.

   VOLGORDE IS GEDRAG, en die loopt door alsof dit bestand er niet was: ./tabel.js
   plakt deze lijst er op exact dezelfde plaats weer achter. Een regel hierheen
   verplaatsen mag dus alleen als hij aaneengesloten blijft en in dezelfde
   volgorde staat; nagemeten met de volledige kantoortoewijzing van de
   Capability Graph -- nul punten verschoven.

   Wat hier woont zijn de deuren die NIET bij een werkkamer horen maar bij het
   platform zelf: vakbewijzen, tenants, het eigenaarsherstel, SCIM, isolatie en
   RTG Link. Per blok staat de reden erbij.
   ========================================================================== */
'use strict';

module.exports = [
  /* Het vakbewijs en de persoonseis liggen bij Juridisch, en met opzet in
     dezelfde regel als `verifications`: het is dezelfde handeling, een stap
     verder. Een mens van RTG ziet een stuk (VOG, BIG-registratie,
     legitimatiebewijs) en tekent af dat hij het heeft gezien -- zonder de
     inhoud te beoordelen, want RTG is geen inspectie. Bij HR zou het niet
     kloppen: dit is geen personeelsbeheer maar een controle die juist NIET bij
     de werkgever hoort te liggen. */
  [/office\/(?:bewaarverzoek|uitgifte|verifications|vakbewijs)|\/vakbewijs|\/persoonseis|\/onboarding|\/zegel|\/codewoord/, 'juridisch', 'Juridisch'],
  /* DE TENANT CONTROL PLANE, van main overgenomen op 25 augustus 2026. Deze twee
     regels stonden alleen in main's kopie van deze tabel; bij de samenvoeging is
     onze kopie gehouden (identieke inhoud, betere vorm) en vielen ze weg. Zeven
     werkprocessen kwamen daardoor op 'terugval' te staan -- 22 dekkingsgaten,
     en test/kantoren.test.js zag het.
     Het exit-recht, de bewaring en de bewijsstand zijn een AVG- en contractzaak
     en liggen bij Juridisch. De bootstrap en de groepsafbeelding zijn
     toegangsbeheer en liggen bij Intern & IT. De tweede regel sluit ZONDER
     afsluitende slash af, want de functiecatalogus draagt het prefix
     `/api/tenant` als codepunt: een regel die de routes wel pakt en de functie
     niet, dekt de helft en meldt zich niet. */
  [/\/api\/tenant\/(?:export|herstelproef|status)/, 'juridisch', 'Juridisch'],
  /* Het herstel van het eigenaarsaccount (EIGENAAR.md par. 5). Bij Intern & IT
     en niet bij Techniek: dit gaat over de SLEUTELS van een account, net als
     /api/webauthn, en niet over de gezondheid van het systeem. Expliciet
     opgeschreven omdat de terugval hier rood is -- onbekend werk hoort niet
     stilletjes bij Onderzoek te belanden. */
  [/\/api\/herstel\/eigenaar(?:\/|$)|\/api\/techniek\/herstel(?:\/|$)/, 'intern', 'Intern & IT'],
  [/\/api\/tenant(?:\/|$)/, 'intern', 'Intern & IT'],
  /* SCIM (routes/scim.js) is de deur waar de IdP van een klant zelf accounts
     aanmaakt en uitzet: toegangsbeheer, dezelfde familie als de bootstrap. */
  [/\/api\/scim(?:\/|$)/, 'intern', 'Intern & IT'],
  [/office\/(?:aidata)|\/belastingkantoor|\/loonstrook/, 'financien', 'Financiën'],
  [/office\/wereld|\/wereld\b/, 'controleregister', 'RTG Controleregister'],
  [/\/api\/office\b|\/kantoor\/gesprek|\/living-os|\/scherm\.html|\/app\.html/, 'intern', 'Intern & IT'],
  /* ISOLATIE HOORT BIJ DEZELFDE HAND ALS DE INCIDENTCONTROLE, en dat is geen
     naamsgelijkenis maar de opzet: kern/isolatie/ leest zijn huisstand uit de
     incidentcontrole en de cockpit staat achter dezelfde deur (techAuth,
     eigenaarAlleen). De ledenkant valt er ook onder -- wie een gestolen sessie
     dichtzet doet incidentwerk, ook als hij het over zijn eigen account doet.
     Zonder deze regel viel de hele laag in de terugval "Onderzoek & data", en
     die terugval is met opzet rood: onbekend werk hoort niet stilletjes een
     eigenaar te krijgen. */
  [/\/techniek|\/wacht|\/incident|\/storing|[/-]isolatie/, 'techniek', 'Techniek & De Wacht'],
  /* RTG Link (LINK.md): de adres- en capabilitylaag. Hij hoort bij Intern & IT,
     bij de familie waar hij thuishoort -- codes, scanners, sleutels, identiteit
     (zie de platformregel verderop met /code, /scanner en /rtgid).

     Hij staat HIER en niet in dat blok, want zijn deuren wonen in drie werelden:
     /api/link (leden), /api/rtf/link (gezin) en /api/supplier/link (de kassa).
     Verderop zouden `rtf` en `supplier` hem eerder afvangen en lag dezelfde laag
     bij drie kantoren. Een laag heeft een eigenaar; waar zijn deuren staan doet
     daar niet aan af.

     Zonder deze regel viel elk Link-punt terug op de restpost, en dat is met
     opzet rood: onbekend werk hoort niet stilletjes bij Onderzoek te belanden.
     De volle toetssuite wees dat aan (test/kantoren.test.js, acht gaten).
     Het patroon liet eerst een schuine streep NA `link` vallen, waardoor
     /api/link zelf erbuiten viel; /api/linkkaart matcht nog steeds niet. */
  [/(?:^|\/)link(?:\/|$)/, 'intern', 'Intern & IT']
];
