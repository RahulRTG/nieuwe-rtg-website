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

const adresLaag = require('./rtmail-adres');

module.exports = ({ rtmail, mailIn, mailBijlage, mailAuth, werkmail, findSupplier, team }) => {

  /* ---- Is dit adres van iemand hier? ----

     Vier vragen, in deze volgorde, en alle vier zonder netwerk. De eerste die
     "ja" zegt wint; zegt niemand ja, dan hoort dit bericht hier niet.

     WAT HET NIET DOET: raden. Een adres in een domein dat wij voeren is nog
     geen postvak -- "vanalles@rtgpass.rtg" bestaat niet omdat het domein
     bestaat. Precies daar zou een postberg voor niemand ontstaan. */
  function kentAdres(adres) {
    const a = rtmail.normAdres(adres);
    if (!a || a.indexOf('@') < 1) return null;
    const o = adresLaag.ontleed(a);
    const lokaal = String(o.lokaal || '');

    // 1. een zaak met een eigen domein (kern/werkmail.js): het adres moet
    //    bestaan EN aan staan -- een ingetrokken adres is geen postvak meer
    if (werkmail && typeof werkmail.zaakAdresActief === 'function' && werkmail.zaakAdresActief(a)) {
      return { soort: 'werkmail', adres: a };
    }
    // buiten onze eigen domeinen zijn wij niet de bestemming. Post doorsturen
    // voor een ander is precies wat een open relay doet, dus: nee.
    if (!o.binnenshuis) return null;

    // 2. een zaak, op haar code
    if (findSupplier && findSupplier(lokaal)) return { soort: 'zaak', adres: a };
    // 3. een gedeeld postvak (team), opgezocht op adres -- de teams bewaren hun
    //    eigen adres, en `zelfdeBus` bepaalt of twee schrijfwijzen hetzelfde zijn
    if (team && typeof team.teamOpAdres === 'function' && team.teamOpAdres(a)) return { soort: 'team', adres: a };
    /* 4. WAAR AL POST LIGT, WOONT IEMAND. Dit is de regel die de LEDEN dekt, en
          hij is exacter dan hij klinkt: elk nieuw account krijgt bij aanmelding
          een welkom in zijn postvak (test/rtmail-lid.test.js), dus een bestaand
          lid heeft altijd post. Het alternatief -- het linkerdeel terugrekenen
          naar een codenaam -- kan dit huis niet: de gids zoekt op codenaam en
          niet op de geslugde vorm ervan, en de VORM herkennen zou "lijkt op een
          codenaam" antwoorden op de vraag "bestaat deze persoon". */
    if (rtmail.postvak(a, { limit: 1 }).length) return { soort: 'postvak', adres: a };
    return null;
  }

  /* ---- De keten zelf ----

     `ruw` zijn de bytes zoals ze binnenkwamen; de rest is wat de DEUR erover
     weet (het IP van de andere kant, wat hij bij MAIL FROM en EHLO zei). Die
     drie gaan mee in de stempel, want een SPF-uitslag zonder envelop-afzender
     en zonder IP is geen uitslag.

     Geeft { ok, id, origineel, controles, bijlagen, geweigerd, let } terug, of
     { error, status } -- de status is de HTTP-code die erbij hoort; de
     SMTP-kant vertaalt hem naar zijn eigen antwoordcode. */
  async function neemAan({ ruw, ip, envelopeVan, helo, publiekeSleutel } = {}) {
    const tekstRuw = String(ruw == null ? '' : ruw);
    const d = mailIn.ontleed(tekstRuw, { publiekeSleutel, ip });
    if (d.error) return { error: d.error, status: 400 };

    /* SPF en DMARC ECHT opzoeken. Dit is de enige plek waar het aannemen het
       netwerk op gaat, en een storing daar mag de bezorging niet tegenhouden:
       de uitslag valt dan terug op wat er zonder DNS te zeggen valt. Post die
       binnen is, hoort bezorgd te worden -- de uitslag is een STEMPEL, geen
       poortwachter. */
    try {
      d.controles = await mailIn.stempelVol(d.koppen,
        tekstRuw.slice(tekstRuw.search(/\r?\n\r?\n/)).replace(/^\r?\n\r?\n/, ''),
        { publiekeSleutel, ip, envelopeVan, helo, auth: mailAuth });
    } catch (e) {
      d.controles.let = 'De SPF- en DMARC-controle liep vast (' + (e && e.message) + '); het bericht is wel bezorgd.';
    }

    /* Het origineel eerst, de afgeleide daarna. In die volgorde: gaat de
       bezorging mis, dan hebben we de bytes nog steeds. */
    const bewaard = mailIn.bewaarOrigineel(tekstRuw, null);
    const naar = d.naar || '';
    if (!naar) return { error: 'Dit bericht heeft geen ontvanger in de To-kop.', origineel: bewaard.id, status: 400 };
    if (!kentAdres(naar)) {
      return { error: 'Dit adres bestaat hier niet.', origineel: bewaard.id, status: 550, onbekend: true };
    }

    /* Alles van buiten valt in de onbetrouwde baan -- links blijven onklikbaar.
       BIJLAGEN GAAN WEL DOOR, maar alleen langs de scanner: wat schoon is wordt
       bewaard, wat dat niet is verdwijnt MET de reden erbij (kern/mailbijlage.js).
       Dat gebeurt hieronder pas, want een bijlage hangt aan een bericht en dat
       moet er dus eerst zijn. */
    const controles = '\n\n[Controles: DKIM ' + d.controles.dkim + '; SPF ' + d.controles.spf + '; DMARC ' + d.controles.dmarc + '.]';
    const m = rtmail.stuur({ van: d.van, naar, onderwerp: d.onderwerp,
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

    return { ok: true, id: m.id, origineel: bewaard.id, controles: d.controles,
      bijlagen, geweigerd: geweigerd.length,
      let: 'Het originele bericht is onveranderd bewaard; wat in het postvak staat is een afgeleide. Bijlagen zijn door de scanner gegaan; alleen wat schoon was, is bewaard.' };
  }

  return { mailAanname: { neemAan, kentAdres } };
};
