/* OPNIEUW BEGINNEN -- het zevende werkwoord van de bodem (SAMENLEVING.md par. 2).

   "Opnieuw beginnen is het werkwoord zonder eigenaar. Er zijn onderdelen die
   erbij horen: een account dat je terugkrijgt, een verleden dat je kunt
   meenemen, een verleden dat je kunt achterlaten en een schuld die niet voor
   altijd op je scherm staat. ... Wie dat bouwt, bouwt het als PROJECTIE over
   wat er al staat (HDI.md par. 5.1), niet als nieuw dossier."

   Dit is die projectie, en niets meer. Drie regels die haar klein houden:

   1. ZE BEWAART NIETS. Er is geen eigen tak in db.data en geen teller. Wat er
      staat, wordt bij elke vraag opnieuw gelezen uit de plek waar het woont:
      het account, het bewaarbeleid. Het huisbrede handelingenspoor
      (opzet/auditspoor.js) noteert wel dat de route werd aangeroepen, zoals
      bij elke POST -- dat is geen eigenschap van deze laag en wordt hier ook
      niet weggepoetst: het scherm zegt het erbij.
   2. ZE DOET NIETS. Exporteren, wissen en herstellen gebeuren waar ze al wonen
      (/api/privacy/export, /api/privacy/delete, /api/auth/forgot). Een tweede
      wisknop hier zou een tweede plek zijn waar een gegeven weggaat, en die
      doet het binnen een jaar net iets anders (routes/member/gegevenskaart.js
      zegt hetzelfde). Elk onderdeel noemt daarom zijn INGANG.
   3. ZE OORDEELT NIET. Er is geen voortgang, geen "je bent klaar om opnieuw te
      beginnen" en geen cijfer. Of iemand een breuk achter zich heeft, weet deze
      laag niet en hoort ze niet te weten. Wat er over de persoon zelf staat,
      zijn JA/NEE-feiten die hij nodig heeft om te kunnen kiezen (is er een
      e-mailadres om op te herstellen) -- nooit de waarde zelf.

   En een onderdeel dat er niet is, staat er MET de reden: een schuld die van je
   scherm verdwijnt heeft in dit huis geen module, en dat zeggen is eerlijker
   dan het onderdeel weglaten. */
'use strict';

function maakOpnieuwBeginnen({ accounts, naOpheffen }) {
  function beeld(account, key) {
    const email = !!(account && accounts.emailOf(account));
    const telefoon = !!(account && accounts.phoneOf(account));
    /* Wat er na wissen blijft, staat al op EEN plek: de gegevenskaart
       (kern/identiteit/gegevenskaart.js, `naOpheffen`). Een eigen lijst hier,
       bijvoorbeeld uit het bewaarbeleid, zou een tweede antwoord op dezelfde
       vraag zijn (LAT.md regel 4) -- dus deze laag leest die van de kaart. */
    const blijft = account && naOpheffen ? naOpheffen(key, account) : null;
    return {
      ok: true,
      wat: 'Opnieuw beginnen',
      uitleg: 'Na een breuk kunt u opnieuw instappen zonder dat de breuk u blijft volgen. Dit overzicht laat zien wat er daarvoor al bestaat en waar het woont. Het voert zelf niets uit.',
      onderdelen: [
        {
          id: 'terugkomen', wat: 'Uw account terugkrijgen',
          ingang: { route: '/api/auth/forgot', scherm: '/apps/app.html', waar: 'Bij het inloggen: uw toegang herstellen' },
          /* Een sessie zonder account (een demo-inlog) heeft geen herstelweg om
             te beschrijven; "er staat geen e-mailadres" zou dan iets beweren over
             een account dat er niet is. */
          jouwStand: !account ? { emailBekend: null, telefoonBekend: null,
            lezing: 'Deze sessie hangt niet aan een account, dus er is geen herstelweg om te beschrijven.' } : {
            emailBekend: email, telefoonBekend: telefoon,
            lezing: !email ? 'Er staat geen e-mailadres bij uw account, dus een herstellink kan nergens heen. Een mens bij de ledenbalie kan u verder helpen.'
              : telefoon ? 'Herstellen gaat in twee stappen: een link per e-mail en een code op uw telefoon.'
              : 'Herstellen gaat met een link per e-mail. Er staat geen telefoonnummer bij, dus er is geen tweede stap.'
          },
          dektNiet: 'Dit overzicht toont nooit uw e-mailadres of telefoonnummer zelf, alleen of ze er zijn.'
        },
        {
          id: 'meenemen', wat: 'Uw verleden meenemen',
          ingangen: [
            { route: '/api/privacy/export', scherm: '/apps/app.html', waar: 'Bedieningspaneel: "Download mijn gegevens"', wat: 'uw hele dossier onder uw codenaam, als bestand' },
            { scherm: '/apps/bewijsmap.html', wat: 'aantonen dat u aan een eis voldoet, zonder uw nummer te laten zien' },
            { scherm: '/apps/mijn-gegevens.html', wat: 'wat RTG van u weet, per gegeven' }
          ],
          dektNiet: 'Meenemen naar een andere aanbieder in een vast formaat bestaat niet; het bestand is van RTG-makelij.'
        },
        {
          id: 'achterlaten', wat: 'Uw verleden achterlaten',
          ingangen: [
            { route: '/api/privacy/delete', scherm: '/apps/app.html', waar: 'Bedieningspaneel: "Verwijder mijn gegevens"', wat: 'uw gegevens definitief wissen; u wordt overal uitgelogd' },
            { scherm: '/apps/mijn-sessies.html', wat: 'zien waar u nog bent ingelogd en daar weggaan' }
          ],
          blijftStaan: blijft,
          blijftStaanBron: 'de gegevenskaart, "Als u uw account opheft" op /apps/mijn-gegevens.html',
          dektNiet: 'Wat van u in het werk van een ander zit, blijft daar staan zonder uw naam.'
        },
        {
          id: 'schuld', wat: 'Een schuld die niet voor altijd op uw scherm staat',
          stand: 'nietGebouwd',
          reden: 'Geen module in dit huis heeft als opdracht dat een afgeloste of verjaarde schuld van uw scherm verdwijnt. Dat staat hier liever dan een lege plek.'
        }
      ],
      nietGedaan: [
        'Dit overzicht schrijft zelf niets weg. Wel noteert het handelingenspoor van het huis, zoals bij elke aanroep, dat u het opvroeg; dat ziet u terug in uw eigen export.',
        'Er is geen voortgang en geen oordeel over waar u staat.'
      ]
    };
  }
  return { beeld };
}

module.exports = { maakOpnieuwBeginnen };
