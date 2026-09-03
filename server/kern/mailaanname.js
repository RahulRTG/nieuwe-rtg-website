/* Kern-module "mailaanname": post van buiten aannemen -- op EEN plek.

   WAAROM DIT BESTAAT. Het aannemen van een bericht van buiten is een keten van
   zeven stappen die in deze volgorde moeten: ontleden, stempelen (DKIM/SPF/
   DMARC), het ORIGINEEL bewaren, de ontvanger vaststellen, bezorgen in de
   onbetrouwde baan, de bijlagen langs de scanner, en de uitkomst in de tekst van
   het bericht zetten. Die keten stond in routes/mailpost.js, in de HTTP-poort.

   Sinds er ook een SMTP-ontvanger is (server/smtp-in.js) zijn er twee deuren
   naar dezelfde kamer. Twee kopieen van deze keten zouden uiteenlopen -- en de
   manier waarop is voorspelbaar: iemand repareert de bijlagescanner in de ene
   deur en de andere blijft besmette post doorlaten. Regel 4 van de lat. Vandaar
   dit bestand: de deuren verschillen alleen in hoe ze de bytes krijgen.

   WAT HIER NIET IN ZIT, en met opzet: de REM. Een HTTP-poort remt per minuut op
   verzoeken, een SMTP-verbinding remt op verbindingen, berichten en ontvangers
   tegelijk. Die twee zijn niet dezelfde maatregel en horen te staan waar ze
   gelden. Wat hier wel staat, staat voor allebei.

   DE ONTVANGERTOETS (kentAdres) staat er wel, want die is een BESLUIT over dit
   huis en niet over een protocol: wie hier geen postvak heeft, krijgt geen post.
   Een ontvanger die pas na het aannemen onbekend blijkt, levert of een berg post
   voor niemand op of een bounce naar een afzender die vaak vervalst is
   (backscatter). SMTP kan dat voorkomen omdat hij bij RCPT al mag weigeren; de
   HTTP-poort krijgt een heel bericht in een keer en weigert hem daar.

   Gemount vanuit opzet/diensten2.js, naast de andere mail-modules. */
'use strict';


module.exports = ({ rtmail, mailIn, mailBijlage, mailAuth, werkmail, findSupplier, team,
  schoolAdresActief, foundationAdresActief, accounts }) => {

  /* DE SERVICEBUS, LAAT GEBONDEN. RTG Service hangt pas in opzet/hulplaag.js en
     bestaat op het moment dat deze keten wordt opgezet nog niet; hem naar boven
     verhuizen zou de ontvangertoets NA de teams zetten die zij bevraagt.
     Dezelfde vorm en dezelfde reden als `zetServiceOverdracht` in kern/ai.js:
     een zetter, geen verwijzing die te vroeg leeg is. Wordt hij nooit gezet, dan
     is `hulp@` gewoon geen adres hier -- en post weigeren die nergens heen kan is
     eerlijker dan hem aannemen. */
  let servicePost = null;
  const zetServicePost = (p) => { servicePost = p || null; };
  const mailPubliek = require('./mail-publiek')({ accounts });

  /* De ontvangertoets staat in ./mailontvanger.js: een BESLUIT over dit huis
     (wie hier geen postvak heeft, krijgt geen post) en niet een stap in deze
     keten. Zelfde vraag voor allebei de deuren, dus hij hoort er maar een keer
     te staan. */
  const kentAdres = require('./mailontvanger')({ rtmail, werkmail, findSupplier, team,
    mailPubliek, schoolAdresActief, foundationAdresActief, servicePost: () => servicePost });

  /* ---- De keten zelf ----

     `ruw` zijn de bytes zoals ze binnenkwamen; de rest is wat de DEUR erover
     weet (het IP van de andere kant, wat hij bij MAIL FROM en EHLO zei). Die
     drie gaan mee in de stempel, want een SPF-uitslag zonder envelop-afzender
     en zonder IP is geen uitslag.

     Geeft { ok, id, origineel, controles, bijlagen, geweigerd, let } terug, of
     { error, status } -- de status is de HTTP-code die erbij hoort; de
     SMTP-kant vertaalt hem naar zijn eigen antwoordcode. */
  async function neemAan({ ruw, ip, envelopeVan, envelopeNaar, helo, publiekeSleutel,
    providerControles } = {}) {
    const tekstRuw = String(ruw == null ? '' : ruw);
    const d = mailIn.ontleed(tekstRuw, { publiekeSleutel, ip });
    if (d.error) return { error: d.error, status: 400 };

    /* SPF en DMARC ECHT opzoeken. Dit is de enige plek waar het aannemen het
       netwerk op gaat, en een storing daar mag de bezorging niet tegenhouden:
       de uitslag valt dan terug op wat er zonder DNS te zeggen valt. Post die
       binnen is, hoort bezorgd te worden -- de uitslag is een STEMPEL, geen
       poortwachter. */
    const pc=providerControles || {};
    const heeftProvider=!!(pc.spf || pc.dkim || pc.dmarc || pc.spam || pc.virus);
    if (heeftProvider) {
      const zeg = v => v === 'PASS' ? 'geslaagd' : v === 'FAIL' ? 'GEZAKT'
        : v === 'GRAY' ? 'onbeslist' : v === 'PROCESSING_FAILED' ? 'controle mislukt' : 'niet gemeld';
      d.controles={ provider:'AWS SES', dkim:zeg(pc.dkim), spf:zeg(pc.spf),
        dmarc:zeg(pc.dmarc), spam:zeg(pc.spam), virus:zeg(pc.virus),
        dkimUitslag:pc.dkim, spfUitslag:pc.spf, dmarcUitslag:pc.dmarc,
        let:'Deze uitslagen kwamen via de door RTG ondertekende SES-envelop.' };
    } else try {
      d.controles = await mailIn.stempelVol(d.koppen,
        tekstRuw.slice(tekstRuw.search(/\r?\n\r?\n/)).replace(/^\r?\n\r?\n/, ''),
        { publiekeSleutel, ip, envelopeVan, helo, auth: mailAuth });
    } catch (e) {
      d.controles.let = 'De SPF- en DMARC-controle liep vast (' + (e && e.message) + '); het bericht is wel bezorgd.';
    }

    /* Het origineel eerst, de afgeleide daarna. In die volgorde: gaat de
       bezorging mis, dan hebben we de bytes nog steeds. */
    const bewaard = mailIn.bewaarOrigineel(tekstRuw, null);
    /* De SMTP/SES-envelop wint van de zichtbare To-kop. Een BCC-ontvanger
       staat niet in To, en een afzender mag die kop bovendien zelf invullen.
       De deur heeft RCPT TO al gezien en is daarom de gezaghebbende bron. De
       terugval op To blijft uitsluitend voor de oude lokale proefpoort. */
    const naar = String(envelopeNaar || '').trim() || d.naar || '';
    if (!naar) return { error: 'Dit bericht heeft geen ontvanger in de To-kop.', origineel: bewaard.id, status: 400 };
    const bestemming = kentAdres(naar);
    if (!bestemming) {
      return { error: 'Dit adres bestaat hier niet.', origineel: bewaard.id, status: 550, onbekend: true };
    }

    /* Alles van buiten valt in de onbetrouwde baan -- links blijven onklikbaar.
       BIJLAGEN GAAN WEL DOOR, maar alleen langs de scanner: wat schoon is wordt
       bewaard, wat dat niet is verdwijnt MET de reden erbij (kern/mailbijlage.js).
       Dat gebeurt hieronder pas, want een bijlage hangt aan een bericht en dat
       moet er dus eerst zijn. */
    const controles = '\n\n[Controles: DKIM ' + d.controles.dkim + '; SPF ' + d.controles.spf + '; DMARC ' + d.controles.dmarc + '.]';
    const m = rtmail.stuur({ van: d.van, naar:bestemming.adres, onderwerp: d.onderwerp,
      tekst: d.tekst + controles, soort: 'extern', bron: 'extern' });
    if (m && m.error) return { error: m.error, origineel: bewaard.id, status: 400 };

    const bijlagen = mailBijlage.verwerk(m.id, d.bijlagen, { van: d.van });
    const geweigerd = bijlagen.filter(b => !b.bewaard);
    if (bijlagen.length) {
      /* De uitkomst gaat in de TEKST van het bericht, niet alleen in het
         antwoord aan de mailserver. Die server leest dit nooit; de ontvanger
         wel, en die hoort te weten dat er iets bij zat en wat ermee gebeurd
         is -- juist als het geweigerd werd. */
      m.tekst += '\n\n[Bijlagen: ' + bijlagen.map(b => b.naam + (b.bewaard ? '' : ' -- GEWEIGERD: ' + b.waarom)).join('; ') + ']';
    }
    /* De scannertekst hoort bij de inhoud. Na deze legitieme naverwerking moet
       het bericht opnieuw worden gezegeld en meteen worden bewaard; anders zou
       onze eigen scanner eruitzien als opslagmanipulatie. */
    if (rtmail.herzegel) rtmail.herzegel(m, true);

    /* EN DE SERVICEBUS MAAKT ER EEN ZAAK VAN. Pas hier, na het bewaren: gaat het
       openen mis, dan ligt de post er nog steeds -- dezelfde volgorde als bij het
       origineel hierboven. De uitkomst gaat MEE in het antwoord, ook als er geen
       zaak kwam: een weigering die alleen deze module kent, is een melding die
       niemand ziet. */
    let zaak = null;
    if (bestemming.soort === 'service' && servicePost) {
      try {
        const uit = servicePost.ontvang({ van: d.van, onderwerp: d.onderwerp, tekst: d.tekst,
          controles: d.controles, bericht: m.id });
        zaak = uit && uit.zaak ? { id: uit.zaak.id, team: uit.zaak.team }
          : { geen: true, waarom: (uit && (uit.error || uit.waarom)) || 'onbekend' };
      } catch (e) {
        zaak = { geen: true, waarom: 'Het openen van de zaak liep vast (' + (e && e.message) + '); de post is wel bewaard.' };
      }
    }

    return { ok: true, id: m.id, zaak, origineel: bewaard.id, controles: d.controles,
      ontvanger:bestemming.adres,
      publiekOntvanger:bestemming.publiek || mailPubliek.publiek(bestemming.adres),
      bijlagen, geweigerd: geweigerd.length,
      let: 'Het originele bericht is onveranderd bewaard; wat in het postvak staat is een afgeleide. Bijlagen zijn door de scanner gegaan; alleen wat schoon was, is bewaard.' };
  }

  return { mailAanname: { neemAan, kentAdres, zetServicePost } };
};
