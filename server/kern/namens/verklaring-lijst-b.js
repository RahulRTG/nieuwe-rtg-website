/* HET VERKLARINGSREGISTER, deel data (tweede helft: aan de ontvangende kant
   staat GEEN mens).

   De uitleg staat in ./verklaring.js; de reden voor de snede in
   ./verklaring-lijst-a.js. Hier staat alleen data.

   DIT IS DE HELFT WAAR HET WERK ZIT. Alle drie de `nietVanToepassing`-gronden
   staan hier, en alle acht openstaande posten op één na. Dat is geen toeval: de
   zeven werkwoorden zijn afgelezen aan een mechanisme met een mens aan beide
   kanten, en juist bij een agent, een instantie, een incassant en een derde
   partij is de vraag "wie zegt hier ja" soms zinloos en soms onbeantwoord. Het
   register houdt die twee uit elkaar, en dat is de hele reden dat het bestaat. */
'use strict';

module.exports = {
  'ai-mandaat': {
    wat: 'een agent handelt namens de mens die hem aanstuurt',
    waar: 'server/kern/stuur/mandaat.js',
    werkwoorden: {
      verlenen: { stand: 'ontbreekt',
        wat: 'er is geen route en geen scherm waarmee een lid een AI-mandaat afgeeft. De grammatica ' +
          'staat, de uitgifte niet -- EXECUTIE.md blok 7 is daarom bewust half gebleven.' },
      aanvaarden: { stand: 'nietVanToepassing',
        grond: 'de gever en de aanvaarder zijn dezelfde mens: een lid begrenst zijn EIGEN agent. Er is ' +
          'geen tweede partij die ja kan zeggen, en een aanvaardingsstap tussen iemand en zichzelf is ' +
          'een klik zonder betekenis. Zodra een mandaat namens een ANDER kan worden afgegeven, ' +
          'vervalt deze grond en wordt dit `ontbreekt`.' },
      versmallen: { stand: 'voert', waar: 'speelruimte() -- de doorsnede, structureel' },
      intrekken: { stand: 'ontbreekt',
        wat: 'hangt aan `verlenen`: zonder uitgifte is er niets in te trekken. Komt er een uitgifteweg, ' +
          'dan hoort deze in dezelfde stap mee.' },
      verlopen: { stand: 'voert', waar: 'mandaatGeldig() rekent `tot` na tegen de klok' },
      handelen: { stand: 'voert', waar: 'magZelfstandig()' },
      spoor: { stand: 'ontbreekt',
        wat: 'de module legt zelf niets vast. Een agent die zelfstandig handelt zonder spoor is precies ' +
          'wat REP-05 verbiedt, en dit is de scherpste openstaande post van de zeven.' }
    }
  },

  'fiscaal-mandaat': {
    wat: 'RTG dient in namens een ondernemer, richting de Belastingdienst',
    waar: 'server/kern/fiscaal/gateway/mandaat.js',
    werkwoorden: {
      verlenen: { stand: 'voert', waar: 'verleen(), en nooit door RTG zelf' },
      aanvaarden: { stand: 'nietVanToepassing',
        grond: 'de ondernemer IS de gever en hij geeft op naam af; er is geen derde die aanvaardt. Het ' +
          'mandaat werkt richting een INSTANTIE en niet richting een tweede mens, dus er is niemand ' +
          'die ja hoeft te zeggen behalve de gever zelf. Wat hier wél hoort en apart staat, is dat ' +
          'de gever aantoonbaar iemand van de zaak is -- dat controleert de route.' },
      versmallen: { stand: 'voert', waar: 'verleen() -- de doorsnede uit kern/namens/versmalling.js',
        opmerking: 'de snede is GROF en dat is een eigenschap van dit huis en geen tekort van deze ' +
          'laag: de zaakrol is een boolean (manager of staff) en er bestaat geen fiscaal recht per ' +
          'medewerker. Er wordt met OPZET niet gesneden op aangifteplicht -- daar is geen register ' +
          'voor, en zo\'n snede zou een fiscale positie innemen die RTG niet mag innemen. Wat de ' +
          'doorsnede hier wél afdwingt is dat de aanroeper MOET opgeven wat de gever zelf mag: wie ' +
          'zwijgt krijgt een verklaarde weigering in plaats van een mandaat.' },
      intrekken: { stand: 'voert', waar: 'trekIn()' },
      verlopen: { stand: 'voert', waar: 'geldt() rekent per datum' },
      handelen: { stand: 'voert', waar: 'de gateway vraagt het mandaat VOOR de zending wordt opgemaakt',
        opmerking: 'de meter mist dit: het werkwoord heet hier `geldt` en wordt door de aanroeper ' +
          'gebruikt, niet door deze module uitgevoerd.' },
      spoor: { stand: 'ontbreekt',
        wat: 'de module houdt geen eigen journaal van wat er onder het mandaat is ingediend.' }
    }
  },

  'sepa-machtiging': {
    wat: 'een incassant int namens een rekeninghouder',
    waar: 'server/kern/machtiging.js, server/school/machtiging.js',
    werkwoorden: {
      verlenen: { stand: 'nietVanToepassing',
        grond: 'dit bestand draagt met opzet de REGELS en niet de opslag: waar een machtiging woont ' +
          'verschilt legitiem (bij een school aan een leerling, bij een gift aan de gever), maar WAT ' +
          'een geldige machtiging is, is één ding. De uitgifte hoort bij de aanroeper.' },
      aanvaarden: { stand: 'voert', waar: 'keur() -- de rekeninghouder tekent, en zonder maximum weigert hij',
        aanvaarding: {
          wieGeeft: 'de rekeninghouder',
          wieOntvangt: 'de incassant',
          wieAanvaardt: 'de rekeninghouder; keur() weigert een machtiging zonder maximum als blanco cheque',
          welkeVersie: 'kenmerk plus maximum plus de laatste vier tekens van het rekeningnummer',
          wanneer: 'bij het tekenen',
          welkBewijs: 'het kenmerk; het volledige rekeningnummer wordt met opzet niet bewaard',
          bijIntrekking: 'intrekken kan altijd en per direct'
        } },
      versmallen: { stand: 'ontbreekt',
        wat: 'er wordt niet gesneden tegen wat de gever zelf mag. Voor een privépersoon op zijn eigen ' +
          'rekening is dat onschuldig; voor een zakelijke rekening met een tekenbevoegdheidsgrens niet.' },
      intrekken: { stand: 'voert', waar: 'vervang() plus de regel dat intrekken altijd en per direct kan' },
      verlopen: { stand: 'nietVanToepassing',
        grond: 'een SEPA-machtiging kent geen einddatum: hij loopt tot hij wordt ingetrokken. Een ' +
          'vervaltermijn verzinnen zou een juridische eigenschap toevoegen die het instrument niet heeft.' },
      handelen: { stand: 'nietVanToepassing',
        grond: 'dit huis heeft geen incassorail. server/betaal.js kent alleen uitbetalen en een betaling ' +
          'die de betaler zelf start; elk antwoord uit deze laag draagt daarom `geindNu: false`. ' +
          'Handelen onder deze machtiging kan hier structureel niet, en dat is een grens en geen gat.' },
      spoor: { stand: 'ontbreekt',
        wat: 'de regels leggen niets vast. Zolang er niets geïnd wordt is er weinig te sporen, maar ' +
          'zodra er een rail komt hoort dit er vóór te liggen en niet erna.' }
    }
  },

  'app-machtiging': {
    wat: 'een app van derden handelt namens een lid',
    waar: 'server/kern/appstore/{machtigingen,winkel,besluit,naad,context}.js',
    werkwoorden: {
      verlenen: { stand: 'voert', waar: 'winkel.js verleen() -- het manifest VRAAGT, het lid GEEFT' },
      aanvaarden: { stand: 'voert', waar: 'het lid verleent zelf; een niet-verleende machtiging bestaat niet',
        aanvaarding: {
          wieGeeft: 'het lid',
          wieOntvangt: 'de app, via de uitgever',
          wieAanvaardt: 'het lid; er is geen pad waarlangs een uitgever zichzelf een machtiging geeft',
          welkeVersie: 'de versie van het manifest die door de keuring kwam',
          wanneer: 'bij het verlenen in de winkel',
          welkBewijs: 'de tijdlijn van het lid in het inkoopdossier -- groeit aan, wordt nooit herschreven',
          bijIntrekking: 'intrekkenMetGevolgen(); bij een gekochte app blijft een teruggaveRECHT achter dat een mens afhandelt'
        } },
      versmallen: { stand: 'voert',
        waar: 'kern/appstore/gevermacht.js snijd() -- aangeroepen door installeer() en verleen()',
        opmerking: 'de snede snijdt op wat het LID zelf mag: `arena.meedoen` draagt ' +
          '`eistVanLid: \'progressie\'`, want wie zelf geen score bewaard krijgt kan dat ook niet ' +
          'uitlenen. Het gat was er een van EERLIJKHEID en niet van lekkage -- de arena weigerde al ' +
          'bij de uitvoering -- maar het lid werd wel om toestemming gevraagd voor iets dat ' +
          'structureel niet kon gebeuren, en bereik.js rekende zijn app op de zwaarste klasse.' },
      intrekken: { stand: 'voert', waar: 'besluit.js intrekkenKaal() en naad.js intrekkenMetGevolgen()' },
      verlopen: { stand: 'nietVanToepassing',
        grond: 'een appmachtiging loopt tot het lid hem intrekt of de app wordt teruggetrokken. Een ' +
          'termijn zou betekenen dat een werkende app op een dag stilvalt zonder dat iemand iets deed.' },
      handelen: { stand: 'voert', waar: 'brug.js -- de drie machtigingen worden daar uitgevoerd' },
      spoor: { stand: 'voert', waar: 'het inkoopdossier en de tijdlijn van het lid',
        opmerking: 'de meter mist dit omdat het spoor in dossier.js woont en niet in de gescopete bestanden.' }
    }
  }
};
