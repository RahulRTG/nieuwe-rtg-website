/* ============================================================================
   HOE EEN BESLUIT VAN DE WERKGEVER BIJ DE SOLLICITANT KOMT.

   Afgesplitst uit ./werk.js toen dat door de omvangband van keuringsregel 13
   ging. De naad is echt en niet cosmetisch: werk.js gaat over vacatures en de
   sollicitatiechat, en dit over de vraag langs welke WEG je een mens bereikt
   die misschien geen lid is. Dezelfde soort knip als
   foundation/leeftijdsgroepen.js.

   DE FOUT DIE HIER IS OPGEHEVEN stond op een regel in werk.js en is door de
   Adam-keten gevonden (scripts/adamproef.js, schakel 10):

       if (!a.key) return;

   Een sollicitant uit een RTF-gezin heeft geen lidsessiesleutel; zijn rij
   draagt `rtf: { code, profielId }`. Een aangenomen zeventienjarige hoorde dus
   niets, terwijl zijn stand wel werd bijgewerkt. De vraag zelf staat nu in
   ./ontvanger.js, zodat de volgende ontvangervorm niet opnieuw stil wegvalt.
   ========================================================================== */
'use strict';

const ontvangerlaag = require('./ontvanger');

module.exports = ({ rtf, mail, meldLidVan, sseToCustomer }) => {
  /* DE DRIE WEGEN NAAR EEN SOLLICITANT, en waarom dit geen `if` meer is.

     Hier stond `if (!a.key) return;` -- een sollicitant zonder LIDsessie kreeg
     stil niets. De Adam-keten mat dat (scripts/adamproef.js, schakel 10): een
     aangenomen zeventienjarige uit een RTF-gezin hoorde het nooit, terwijl zijn
     stand wel werd bijgewerkt. Een tweede tak voor RTF zou de volgende vorm
     precies zo laten vallen, dus de vraag zelf staat nu in kern/ontvanger.js.

     DE GEZINSWEG IS NIET db.data.notifications. Dat is de bak van het LID, en
     geen enkele foundation-route leest hem -- gemeten, zie de kop van
     foundation/systeembericht.js. Een melding daarheen ziet er goed uit en komt
     nergens aan.

     `meldLid` KOMT LAAT. Hij wordt in opzet/kernlaag1.js op de kern gezet, ver
     na de aanroep van maakWerk() in server.js; een directe verwijzing zou hier
     voor altijd undefined zijn. Vandaar `meldLidVan()`, dezelfde late binding
     als `commWerk` hierboven en als `meldLidVan` in opzet/kernlaag2.js.

     EN `notify` IS HIER MET OPZET WEG. Die schrijft op TIER ("alle
     Business-leden krijgen bericht") en niet op de sleutel van een mens; een
     persoonlijk bericht daarin verdwijnt bij de eerste herlaadbeurt, want
     /api/notifications leest de andere bak. Dat is op 10 september een keer
     gerepareerd (TRAVELCOMMERCE.md par. 9a) en noemde toen letterlijk de
     aangenomen sollicitant -- deze aanroep was er een die bleef staan. */
  const bezorger = ontvangerlaag.maakBezorger({
    lid: (key, bericht) => {
      const melden = typeof meldLidVan === 'function' ? meldLidVan() : null;
      if (typeof melden !== 'function') return { ok: false, reden: 'meldlaag-nog-niet-gebouwd' };
      /* `apply` en niet een eigen woord: dat is de bestaande scope uit
         MELDING_SCOPES (kern/ervaring.js) en dezelfde die de live-tik hieronder
         draagt. Een verzonnen scope staat in niemands voorkeurenlijst, en
         `meldLid` filtert alleen op `=== false` -- dan krijgt een lid dat
         sollicitatiemeldingen heeft UITGEZET ze alsnog. */
      melden(key, { icon: bericht.icon, title: bericht.titel, body: bericht.tekst, scope: 'apply' });
      /* De live-tik hoort bij deze weg en niet bij de bezorging als geheel: hij
         zegt een OPEN app dat er iets veranderde, en alleen een lid heeft er een. */
      try { sseToCustomer(key, 'sync', { scope: 'apply' }); } catch (e) {}
      return { ok: true };
    },
    gezin: (doel, bericht) => {
      if (!rtf || typeof rtf.aanGezinslid !== 'function') return { ok: false, reden: 'foundation-niet-ingericht' };
      return rtf.aanGezinslid({ code: doel.code, profielId: doel.profielId,
        naam: 'RTG', tekst: bericht.titel + ' -- ' + bericht.tekst });
    },
    mail: (adres, bericht) => {
      /* Een bericht mag zeggen dat het niet per mail hoort. Dat komt terug als
         een REDEN in de uitslag en niet als stilte -- zie regel 1 van
         ./ontvanger.js. Het vervolgbericht na een aanname gebruikt dit: het
         gaat over binnenkomen in de app, en dat stond al in de eerste mail. */
      if (bericht.geenMail) return { ok: false, reden: 'met-opzet-geen-mail' };
      if (!mail || typeof mail.send !== 'function') return { ok: false, reden: 'mail-niet-ingericht' };
      mail.send(adres, bericht.mailOnderwerp || bericht.titel, bericht.mailTekst || bericht.tekst);
      return { ok: true };
    }
  });

  /* Bezorg een bericht bij de sollicitant, langs elke weg die hij heeft.
     Geeft de uitslag terug zodat een aanroeper kan zien dat er NIETS aankwam --
     zwijgen is wat deze reparatie ophief. */
  function bezorgAanSollicitant(a, bericht) {
    return bezorger.bezorg(ontvangerlaag.uitSollicitatie(a), bericht);
  }

  /* Het besluit van de werkgever, bij de sollicitant -- lid of gezinslid.

     `vervolg` is een TWEEDE bericht dat bij hetzelfde besluit hoort: na een
     aanname zegt de route er praktisch bij hoe hij binnenkomt (werkplek klaar,
     of: vraag je werkgever om de uitnodigingslink). Dat staat hier als
     parameter en niet als eigen functie op de kern, om twee redenen. Het is
     dezelfde handeling -- de sollicitant inlichten -- en het houdt de belofte
     dat ALLES wat naar hem gaat langs dezelfde ontvangeroplossing loopt. Een
     tweede ingang is een tweede plek waar iemand `if (!a.key)` kan schrijven. */
  function notifyApplicant(a, supplier, opties) {
    const vervolg = opties && opties.vervolg;
    const hired = a.status === 'aangenomen';
    const staart = hired ? ' geaccepteerd.' : ' helaas afgewezen.';
    const uit = bezorgAanSollicitant(a, {
      icon: hired ? 'ster' : 'werk',
      titel: hired ? 'U bent aangenomen!' : 'Sollicitatie afgerond',
      tekst: supplier.name + ' heeft uw sollicitatie als ' + a.func + staart +
        (hired ? ' Het bedrijf neemt contact met u op.' : ''),
      mailOnderwerp: hired ? 'U bent aangenomen bij ' + supplier.name : 'Uw sollicitatie bij ' + supplier.name,
      mailTekst: 'Beste ' + a.name + ',\n\n' + supplier.name + ' heeft uw sollicitatie als ' + a.func +
        (hired ? ' geaccepteerd. Het bedrijf neemt contact met u op over uw eerste werkdag.' : ' helaas afgewezen.') +
        '\n\nRahul Travel Group'
    });
    /* Het vervolgbericht gaat NIET per mail: het gaat over het binnenkomen in
       de app, en dat staat al in de mail hierboven. Twee mails op een besluit
       leest als een storing. */
    if (vervolg) bezorgAanSollicitant(a, Object.assign({ geenMail: true }, vervolg));
    return uit;
  }

  return { bezorgAanSollicitant, notifyApplicant };
};
