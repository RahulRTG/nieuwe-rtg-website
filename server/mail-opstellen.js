/* HET OPSTELLEN VAN EEN BERICHT: de RFC-vorm die over de lijn gaat.

   WAAROM DIT EEN EIGEN BESTAND IS

   ./mail.js stond op 13302 byte, ruim over de 10 kB-grens uit keuringsregel 13.
   De snede is niet nieuw bedacht: scripts/check.js schreef bij de uitzondering
   voor mail.js al "de naad zit tussen het opstellen en het afleveren". Dit is
   het opstellen.

   HET IS OOK EEN ANDER SOORT KENNIS. Hierin staat wat een ONTVANGER verwacht --
   een datum in RFC-vorm, een uniek Message-ID, een tekencodering die onderweg
   heel blijft, en een DKIM-handtekening. In mail.js staat waar een bericht
   HEEN gaat en wat er gebeurt als dat niet lukt. Wie een kop toevoegt hoeft
   niets van de outbox te weten, en omgekeerd.

   ALLEEN NODIG BIJ DIRECTE BEZORGING. Met een smarthost ervoor vult die de
   koppen aan; bouwen wij het bericht zelf, dan is er niemand meer die dat doet.
   Vandaar dat alles erin moet staan en niets "wel goed komt".

   WAT ER BINNENKOMT. De vier waarden die uit de omgeving komen (de afzender,
   het domein, en het DKIM-paar). Ze worden hier NIET opnieuw uit process.env
   gelezen: dan zou dezelfde regel op twee plekken staan en kan de ene ooit
   iets anders vinden dan de andere.
   ========================================================================== */
'use strict';
const rtgKlok = require('./lib/klok');

module.exports = ({ FROM, MAIL_DOMEIN, DKIM_SLEUTEL, DKIM_SELECTOR }) => {
  /* Het bericht zoals het over de lijn gaat. Bij directe bezorging bouwen wij
     het zelf op -- er is geen provider meer die koppen aanvult -- en dus hoort
     alles erin te staan wat een ontvanger verwacht: een datum, een uniek
     Message-ID, en de tekst als UTF-8. */
  function bouwBericht(to, subject, text, opties) {
    const crypto = require('crypto');
    /* De opmaak-hulpjes komen uit server/smtp.js en worden hier NIET nagemaakt:
       een onderwerp met een accent hoort in beide standen op dezelfde manier
       gecodeerd te worden, en twee kopieen van die regel lopen ooit uiteen. */
    const { _kopWaarde: kopWaarde, _rfcDatum: rfcDatum } = require('./smtp');
    const id = '<' + crypto.randomBytes(12).toString('hex') + '@' + (MAIL_DOMEIN || 'localhost') + '>';
    const van = opties && opties.from || FROM;
    const koppen = {
      From: van, To: to, Subject: kopWaarde(subject), Date: rfcDatum(rtgKlok.datum()),
      'Message-ID': id, 'MIME-Version': '1.0',
      'Content-Type': 'text/plain; charset=utf-8', 'Content-Transfer-Encoding': 'base64'
    };
    /* Base64 en niet 8bit: wij onderhandelen bij directe bezorging geen 8BITMIME,
       en een ontvanger die dat niet aanbiedt mag hoge bytes weggooien -- dan komt
       de mail aan met kapotte accenten. Het lost meteen het punt-aan-het-begin-
       van-een-regel-probleem op. */
    const lijf = Buffer.from(String(text == null ? '' : text) + '\n', 'utf8')
      .toString('base64').replace(/(.{76})/g, '$1\r\n');
    let dkim = null;
    if (DKIM_SLEUTEL && MAIL_DOMEIN) {
      try {
        const uit = require('./dkim').onderteken({ koppen, lijf, domein: MAIL_DOMEIN,
          selector: DKIM_SELECTOR, priveSleutel: DKIM_SLEUTEL });
        if (uit.ok) dkim = uit.kop;
        else console.warn('[mail] niet ondertekend:', uit.waarom);
      } catch (e) { console.warn('[mail] DKIM mislukt:', e.message); }
    }
    const kop = (dkim ? dkim + '\r\n' : '') +
      Object.keys(koppen).map(k => k + ': ' + koppen[k]).join('\r\n');
    return { rauw: kop + '\r\n\r\n' + lijf, ondertekend: !!dkim, messageId: id };
  }

  return { bouwBericht };
};
