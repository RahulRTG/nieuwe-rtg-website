/* INKOMENDE POST VAN BUITEN: uitpakken, stempelen, en het origineel bewaren.

   De buitenpoort van het huis (routes/werkmail.js -> werkmail.buitenIn) nam tot
   nu toe een afzender, een onderwerp en platte tekst aan. Dat werkt zolang er
   een provider voor staat die het echte werk doet. Zodra RTG zijn eigen post
   ontvangt, komt er een RFC 5322-bericht binnen: koppen, MIME-delen, base64,
   bijlagen, en een afzender die van alles beweert.

   VIER REGELS, en de laatste is de belangrijkste:

   1. HET ORIGINEEL BLIJFT ONGEWIJZIGD BEWAARD. Wat wij ervan maken is een
      afgeleide. Voor een audit, een juridische bewaarplicht of gewoon om een
      fout te kunnen navertellen, moet je terug kunnen naar de bytes zoals ze
      binnenkwamen. Wie alleen het resultaat bewaart, kan achteraf nooit
      aantonen wat er stond.
   2. DE UITSLAG VAN DE CONTROLES WORDT OPGESLAGEN, NIET WEGGEGOOID. SPF, DKIM
      en DMARC leveren een oordeel; dat hoort bij het bericht te blijven staan,
      ook als het "geen" is. `Authentication-Results` van een tussenliggende
      server wordt GELEZEN maar nooit als waarheid aangenomen -- die kop kan
      iedereen typen.
   3. WAT WIJ NIET BEGRIJPEN, VERZINNEN WE NIET. Een onbekende codering levert
      een leesbare melding op, geen half ontcijferde tekst.
   4. ALLES VAN BUITEN IS ONBETROUWD. Dat was al zo (kern/rtmail.js), en deze
      laag verandert er niets aan: links blijven onklikbaar, bijlagen worden
      geregistreerd maar niet opgeslagen als iets dat te openen valt. Een
      ontleder die van een bijlage een bestand maakt, is precies de plek waar
      een malwarelaag hoort te zitten -- en die hebben we hier niet, dus doen
      we het niet. */
'use strict';

const mime = require('./mailmime');
const { MAX, koppenVan, ontcijferKop, ontcijferLijf, adresVan, delen } = mime;

module.exports = ({ db, save, crypto, dkim }) => {
  const nu = () => new Date().toISOString();

  const eigen = require('./eigencollectie')({ db, domein: 'kern/mailinkomend', bezit: { mailIn: 'kaart' } });
  function O() {
    const o = eigen.bak('mailIn');
    if (!Array.isArray(o.originelen)) o.originelen = [];
    return o;
  }

  /* De uitslag van de drie controles. DKIM rekenen we ECHT na als er een
     publieke sleutel wordt meegegeven. SPF en DMARC vragen DNS, en daarom komt
     er hieronder een tweede, ASYNCHRONE functie: `stempelVol`. Deze eerste
     blijft bestaan voor wie geen netwerk wil of kan doen, en zegt dan eerlijk
     "niet gecontroleerd" -- want een systeem dat niet-gecontroleerd als
     geslaagd toont, is misleidender dan een systeem dat niets toont. */
  function stempel(koppen, lijf, { publiekeSleutel, ip } = {}) {
    const uit = { dkim: 'geen', spf: 'niet gecontroleerd', dmarc: 'niet gecontroleerd', ip: ip || null };
    const veld = koppen['dkim-signature'];
    if (veld) {
      uit.dkim = 'aanwezig, niet nagerekend (geen publieke sleutel meegegeven)';
      if (publiekeSleutel && dkim) {
        try {
          const r = dkim.controleer({ koppen, lijf, veld, publiekeSleutel });
          uit.dkim = r.ok ? 'geslaagd' : 'GEZAKT: ' + r.waarom;
        } catch (e) { uit.dkim = 'GEZAKT: ' + e.message; }
      }
    }
    /* Wat een tussenliggende server beweert, bewaren we als BEWERING. Nooit als
       uitslag -- die kop kan iedereen typen. */
    if (koppen['authentication-results']) uit.beweerdDoorOnderweg = koppen['authentication-results'].slice(0, 300);
    if (koppen['arc-authentication-results']) uit.arc = koppen['arc-authentication-results'].slice(0, 300);
    return uit;
  }

  /* Een ruw bericht ontleden. Geeft altijd iets bruikbaars terug of een fout
     met de reden -- nooit een half ontcijferd bericht. */
  function ontleed(ruw, opties) {
    const s = String(ruw == null ? '' : ruw);
    if (!s.trim()) return { error: 'Er kwam een leeg bericht binnen.' };
    if (s.length > MAX) return { error: 'Dit bericht is groter dan ' + (MAX / 1048576) + ' MB en wordt niet aangenomen.' };
    const scheiding = s.search(/\r?\n\r?\n/);
    if (scheiding < 0) return { error: 'Dit bericht heeft geen kop-blok; het is geen e-mail.' };
    const koppen = koppenVan(s.slice(0, scheiding));
    const lijf = s.slice(scheiding).replace(/^\r?\n\r?\n/, '');
    if (!koppen.from) return { error: 'Een bericht zonder From nemen we niet aan.' };
    const d = delen(koppen, lijf, 0);
    return { ok: true,
      van: adresVan(koppen.from), naar: adresVan(koppen.to),
      onderwerp: ontcijferKop(koppen.subject) || '(geen onderwerp)',
      tekst: String(d.tekst || '').slice(0, 20000),
      bijlagen: d.bijlagen.slice(0, 40),
      messageId: koppen['message-id'] || null,
      datum: koppen.date || null,
      koppen, controles: stempel(koppen, lijf, opties || {}) };
  }

  /* Het origineel wegleggen. Alleen de bytes en een verwijzing; de afgeleide
     staat in RTMAIL. Bewust begrensd, want dit is de enige plek in het huis
     waar we ruwe post van buiten bewaren. */
  function bewaarOrigineel(ruw, afgeleideId) {
    const o = O();
    const rij = { id: crypto.randomBytes(6).toString('hex'), bericht: afgeleideId || null,
      bytes: Buffer.byteLength(String(ruw)), ruw: String(ruw).slice(0, MAX), at: nu() };
    o.originelen.unshift(rij);
    o.originelen = o.originelen.slice(0, 5000);
    save();
    return { id: rij.id, bytes: rij.bytes };
  }
  const origineel = (id) => O().originelen.find(r => r.id === id || r.bericht === id) || null;

  /* De VOLLEDIGE stempel: DKIM zoals hierboven, plus SPF en DMARC echt
     opgezocht. Vraagt een `auth` (kern/mailauth.js) en het IP van de
     verzendende server; zonder een van beide valt hij terug op de gewone
     stempel in plaats van iets te beweren.

     Het DKIM-domein komt uit de handtekening zelf (d=), want DMARC moet weten
     OP WELK DOMEIN de handtekening slaagde -- niet dat hij slaagde. Dat
     onderscheid is de hele reden dat uitlijning bestaat. */
  async function stempelVol(koppen, lijf, { publiekeSleutel, ip, envelopeVan, helo, auth } = {}) {
    const basis = stempel(koppen, lijf, { publiekeSleutel, ip });
    if (!auth || !ip) {
      basis.let = !ip ? 'Zonder het IP van de verzendende server zijn SPF en DMARC niet te controleren.'
                      : 'Er is geen controlelaag meegegeven; SPF en DMARC zijn niet opgezocht.';
      return basis;
    }
    const s = await auth.spf(ip, envelopeVan || koppen.from, helo);
    basis.spf = s.uitslag + (s.waarom ? ' (' + s.waarom + ')' : '');
    basis.spfUitslag = s.uitslag;

    const veld = koppen['dkim-signature'] || '';
    const dkimDomein = (/(?:^|;)\s*d\s*=\s*([^;\s]+)/.exec(veld) || [])[1] || null;
    const dkimUitslag = /^geslaagd/.test(basis.dkim) ? 'geslaagd' : 'gezakt';

    const d = await auth.dmarc({ vanKop: koppen.from, spfUitslag: s.uitslag,
      spfDomein: auth.domeinVan(envelopeVan || koppen.from), dkimUitslag, dkimDomein });
    basis.dmarc = d.uitslag + (d.beleid ? ' (beleid: ' + d.beleid + ')' : '');
    basis.dmarcUitslag = d.uitslag;
    basis.dmarcBeleid = d.beleid || null;
    basis.uitlijning = d.uitlijning || null;
    if (d.let) basis.let = d.let;
    return basis;
  }

  return { ontleed, stempel, stempelVol, bewaarOrigineel, origineel, koppenVan, ontcijferKop, ontcijferLijf, delen, adresVan };
};
