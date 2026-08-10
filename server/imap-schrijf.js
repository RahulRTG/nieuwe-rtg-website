/* IMAP: de SCHRIJFKANT -- de map Drafts en het commando APPEND.

   Afgesplitst van ./imap.js op een echte naad (dat bestand zat op 9,7 kB en de
   grens ligt op 10) en niet alleen daarom: lezen en schrijven zijn hier twee
   verschillende vraagstukken. De leeslaag vertaalt wat er al staat. Deze laag
   laat een vreemd programma iets NEERZETTEN, en dat is de kant waar het mis kan
   gaan.

   DE REGEL DIE HIER ALLES BEPAALT: EEN CLIENT KAN GEEN ONTVANGEN POST MAKEN.

   APPEND is in IMAP een vrij commando: de client levert een compleet
   RFC 5322-bericht en zegt in welke map het moet. Wie dat naar de INBOX zou
   toelaten, bouwt een gereedschap om post te VERZINNEN -- met een From van je
   bank, een datum van vorige week, en in het postvak van het slachtoffer zelf.
   Dat is precies de vorm van een geloofwaardige zwendel, en het is geen
   theoretisch bezwaar: de aanvaller heeft alleen een apparaatsleutel nodig, en
   die bewaart een mailclient jaren op schijf.

   Daarom kan APPEND hier EEN ding: een CONCEPT maken. Dat is geen beperking om
   de veilige kant te kiezen maar de eerlijke vertaling -- wat een client bij
   APPEND werkelijk doet, is bijna altijd "bewaar dit concept" of "leg een kopie
   van wat ik verstuurde in Sent". Een concept in RTMAIL is precies dat, en het
   draagt zijn eigen herkomst: kern/rtmail-schrijf.js zet `van` op het adres
   waarop is INGELOGD en kijkt niet naar de From-kop. Een client die From
   verzint, verzint dus niets.

   Wat er van APPEND wordt GEWEIGERD, met een duidelijke reden en niet
   stilzwijgend: elke andere map dan Drafts. Een client die denkt dat zijn post
   ergens staat waar hij niet staat, verliest werk -- dezelfde afweging die in
   ./imap.js al gold toen APPEND helemaal niet bestond.

   HET BERICHT WORDT NIET HIER ONTLEED. Dat doet kern/mailmime.js, dezelfde
   ontleder waarmee post van buiten binnenkomt. Een tweede ontleder ernaast zou
   uiteenlopen zodra iemand er een aanraakt, en dan begrijpt de ene weg een
   bericht dat de andere weghaalt. */
'use strict';

const { koppenVan, ontcijferKop, adresVan, delen } = require('./kern/mailmime');

// een concept boven deze omvang nemen we niet aan; RTMAIL kapt de tekst zelf op 8000
const MAX_APPEND = 1 * 1024 * 1024;

module.exports = ({ schrijf }) => {
  const DRAFTS = 'Drafts';

  /* Concepten in de vorm van een bericht, zodat de leeslaag er niets van hoeft
     te weten: FETCH, alsBericht() en de nummering werken erop zoals op post.
     Oudste eerst, om dezelfde reden als in ./imap.js -- IMAP nummert oplopend. */
  function alsBerichten(adres) {
    return (schrijf.concepten(adres) || []).slice().reverse().map(c => ({
      id: c.id, van: adres, naar: c.naar || '', onderwerp: c.onderwerp || '(geen onderwerp)',
      tekst: c.tekst || '', at: c.gewijzigd || c.at, antwoordOp: c.antwoordOp || null,
      // een concept is van jezelf; "vertrouwd" gaat over post van buiten en zegt
      // hier dus niets. Niet op true zetten: dat zou een uitspraak zijn die we
      // niet doen.
      vertrouwd: false, gelezen: true, favoriet: false, labels: [], concept: true
    }));
  }

  /* De kop van APPEND: `APPEND "Drafts" (\Seen) {310}` of zonder vlaggen/datum.
     Geeft { map, bytes } terug, of { fout } met een reden in gewone taal. */
  function begin(arg) {
    const m = /^"?([^"\s]+)"?\s*(\([^)]*\))?\s*("[^"]*")?\s*\{(\d+)\+?\}$/.exec(String(arg || '').trim());
    if (!m) return { fout: 'onbegrepen APPEND; verwacht een map en een omvang tussen accolades' };
    const map = m[1];
    const bytes = parseInt(m[4], 10);
    if (!(bytes >= 0)) return { fout: 'die omvang begrijp ik niet' };
    if (bytes > MAX_APPEND) return { fout: 'dat bericht is groter dan ' + Math.round(MAX_APPEND / 1024) + ' kB' };
    if (map.toLowerCase() !== DRAFTS.toLowerCase())
      return { fout: 'APPEND kan hier alleen in ' + DRAFTS + '. Een client kan geen ONTVANGEN post maken; ' +
        'dat zou een manier zijn om post te verzinnen in het postvak van de eigenaar' };
    return { map: DRAFTS, bytes };
  }

  /* De brief zelf, als concept. `adres` komt uit de INLOG en niet uit de brief:
     rtmail-schrijf.js zet `van` daarop, dus de From-kop van de client is
     hoogstens informatie en nooit een bewering over wie dit stuurde. */
  function legAf(adres, ruw) {
    const s = String(ruw || '');
    const scheiding = s.search(/\r?\n\r?\n/);
    if (scheiding < 0) return { fout: 'dit bericht heeft geen kop en geen lijf' };
    const koppen = koppenVan(s.slice(0, scheiding));
    const lijf = s.slice(scheiding).replace(/^\r?\n\r?\n/, '');
    const d = delen(koppen, lijf, 0);
    const r = schrijf.bewaar(adres, {
      naar: adresVan(koppen.to) || '',
      onderwerp: ontcijferKop(koppen.subject) || '(geen onderwerp)',
      tekst: String(d.tekst || '')
    });
    if (r.error) return { fout: r.error };
    return { ok: true, concept: r.concept };
  }

  return { DRAFTS, MAX_APPEND, alsBerichten, begin, legAf };
};
