/* De gegronde Rahul van RTG Geld (GELD.md par. 0: begrijpen en uitleggen).

   Rahul redeneert hier UITSLUITEND over het beeld dat de geldgraaf al heeft
   samengesteld (cijfers, uitzonderingen, vooruitblik): een eigen som naast de
   graaf zou een tweede waarheid zijn (LAT.md regel 4). Elke uitspraak komt met
   gegevens-regels terug, zodat de Waarom-knop kan tonen waar hij op rust
   (GELD.md par. 5) -- ook als de AI het antwoord schreef.

   DE HARDE GRENS, in de systeemcontext EN hier: Rahul belooft of verleent
   nooit toegang tot de Lifestyle of Business Pass, en bevestigt nooit dat een
   betaling of boeking daadwerkelijk verwerkt is. De cockpit voorspelt en legt
   uit; handelen doet het lid zelf in de standen. De grens staat in de context
   omdat het model hem moet dragen, en in dit commentaar omdat de volgende
   bouwer hem moet kennen voordat hij hier iets bijbouwt. */
module.exports = (kern) => {
  const { app, auth, schoon, anthropic } = kern;
  /* De omzetting centen -> euro-zin woont op EEN plek (geldgraaf/hulp.js) en
     wordt hier geleend, niet nagetikt: twee afrondlagen lopen een cent uiteen
     en niemand kan aanwijzen waarom. De AI-aanroep loopt via de bestaande
     helper in server/ai.js, zodat modelkeuze en aanbieder-uitwijk daar blijven
     wonen en dit bestand er geen tweede versie van begint. */
  const { euroTekst } = require('../kern/geldgraaf/hulp');
  const { tekst } = require('../ai-kort');

  /* Leden schrijven bedragen in euro's ("kan ik nog 250 uitgeven?"); intern is
     alles centen. De vertaling gebeurt hier een keer, aan de rand. Getallen
     die een duur aanduiden (30 dagen, 3 maanden) zijn geen bedrag.

     NEDERLANDSE SCHRIJFWIJZE, en dat is hier geen detail. De punt is bij ons
     het DUIZENDTALTEKEN en de komma de decimaal: 1.000 is duizend euro, niet
     een euro. Stond dat verkeerd, dan las deze functie de eigen voorbeeldvraag
     van de app ("Kan ik deze maand nog 1.000 euro uitgeven?") als een euro en
     antwoordde Rahul opgewekt "ja, dat past" op een bedrag dat er ver
     overheen ging. Van alle fouten die een geldassistent kan maken is te ruim
     ja-zeggen de gevaarlijkste, dus:
       - punten tussen cijfergroepen van drie zijn duizendtallen en gaan eruit;
       - een komma is de decimaal;
       - een punt met een of twee cijfers erachter (1.50) accepteren we ook als
         decimaal, want zo tikt een deel van de mensen het nu eenmaal, en het
         verschil met een duizendtal is eenduidig: 1.500 is duizendvijfhonderd,
         1.50 is anderhalve euro. */
  function centenUitVraag(q) {
    const m = /(?:€\s*)?(\d{1,3}(?:\.\d{3})+|\d{1,9})(?:[.,](\d{1,2})(?!\d))?(?!\d)(?!\s*(?:%|dag|week|maand|jaar|uur))/i.exec(q);
    if (!m) return null;
    const heel = Number(m[1].replace(/\./g, ''));
    return heel * 100 + Number((m[2] || '0').padEnd(2, '0'));
  }

  /* Het controlespoor achter elk antwoord: bron + feit, in rauwe centen zoals
     de conventie van kern/geldbeleid -- dit is waar het antwoord op rust. */
  function bronregels(beeld, buffer) {
    const g = [
      'graaf: vrij besteedbaar ' + beeld.cijfers.vrijCenten + ' centen',
      'graaf: vaste lasten komende 14 dagen ' + beeld.cijfers.lasten14dCenten + ' centen',
      'graaf: verwacht saldo over 30 dagen ' + beeld.vooruitblik.d30 + ' centen'
    ];
    if (buffer) g.push('beleid: minimumbuffer ' + buffer.drempelCenten + ' centen (regel ' + buffer.id + ')');
    if (beeld.stil.length) g.push('stil: geen cijfers uit ' + beeld.stil.join(', '));
    return g;
  }

  /* Het terugvalpad rekent ECHT met het graafbeeld in plaats van een vaste
     demozin te tonen: een geldassistent die doet alsof, is erger dan geen. */
  function rekenAntwoord(vraag, beeld, buffer) {
    const vrij = beeld.cijfers.vrijCenten;
    const bedrag = centenUitVraag(vraag);
    if (bedrag != null && bedrag > 0) {
      const na = vrij - bedrag;
      const drempel = buffer ? buffer.drempelCenten : null;
      if (na < 0) return 'Dat raad ik af: er is nu ' + euroTekst(vrij) + ' vrij besteedbaar, en een uitgave van ' +
        euroTekst(bedrag) + ' gaat daar ' + euroTekst(-na) + ' overheen.';
      if (drempel != null && na < drempel) return 'Het kan, maar dan zakt de vrije ruimte naar ' + euroTekst(na) +
        ', onder uw minimumbuffer van ' + euroTekst(drempel) + '. De beslissing blijft aan u; ik voer niets uit.';
      return 'Ja, dat past: na een uitgave van ' + euroTekst(bedrag) + ' blijft er naar verwachting ' + euroTekst(na) +
        ' vrij besteedbaar' + (drempel != null ? ', boven uw minimumbuffer van ' + euroTekst(drempel) : '') +
        '. Uitvoeren doet u zelf; ik verwerk geen betalingen.';
    }
    const u = beeld.uitzonderingen;
    return 'Er is nu ' + euroTekst(vrij) + ' vrij besteedbaar. ' + beeld.verwachting +
      (u.length ? ' Er ' + (u.length === 1 ? 'vraagt 1 punt' : 'vragen ' + u.length + ' punten') +
        ' uw aandacht; bovenaan: "' + u[0].titel + '".' : ' Er vraagt vandaag niets om uw aandacht.') +
      (beeld.stil.length ? ' Let op: ' + beeld.stil.join(' en ') + ' leverde geen cijfers; dit beeld is onvolledig.' : '');
  }

  // het graafbeeld als systeemcontext, in centen: het model krijgt de feiten, geen conclusies
  function contextVan(beeld, buffer) {
    const c = beeld.cijfers;
    return 'vrij besteedbaar ' + c.vrijCenten + ' centen; vaste lasten komende 14 dagen ' + c.lasten14dCenten +
      ' centen; verwacht einde maand ' + c.eindeMaandCenten + ' centen; buffer ' +
      (c.bufferMaanden == null ? 'onbekend' : c.bufferMaanden + ' maanden') +
      '; vooruitblik saldo 7/30/90 dagen: ' + beeld.vooruitblik.d7 + ' / ' + beeld.vooruitblik.d30 + ' / ' +
      beeld.vooruitblik.d90 + ' centen. Verwachting: ' + beeld.verwachting + ' Uitzonderingen: ' +
      (beeld.uitzonderingen.map(x => x.titel + (x.centen != null ? ' (' + x.centen + ' centen)' : '')).join('; ') || 'geen') + '.' +
      (buffer ? ' Beleid: minimumbuffer ' + buffer.drempelCenten + ' centen.' : '') +
      (beeld.stil.length ? ' Bronnen zonder cijfers, het beeld is onvolledig: ' + beeld.stil.join(', ') + '.' : '');
  }

  app.post('/api/geld/rahul', auth, async (req, res) => {
    /* Dezelfde poort als de andere geldroutes: een anonieme gast heeft geen
       codenaam, en zijn sessiesleutel hoort niet als opslagsleutel in de
       beleidslaag te belanden (zie het waarom in routes/geld.js). */
    if (req.session.tier === 'guest')
      return res.status(403).json({ error: 'RTG Geld is voor leden.' });
    try {
      const key = req.session.key;
      const vraag = schoon((req.body || {}).vraag, 400);
      const beeld = kern.geldgraaf.cockpit(key);
      /* De bufferregel komt uit het beleid van het lid zelf; valt die laag om,
         dan staat 'beleid' al in beeld.stil en rekent Rahul zichtbaar zonder. */
      let buffer = null;
      try { buffer = kern.geldbeleid.regels(kern.codenaamVan(key)).find(r => r.aan && r.soort === 'minimumbuffer') || null; }
      catch (e) { if (!beeld.stil.includes('beleid')) beeld.stil.push('beleid'); }
      const gegevens = bronregels(beeld, buffer);
      if (anthropic && vraag) {
        const uit = await tekst(anthropic,
          require('../kern/rahul').rahulLeadVoor(key) +
          'u bent de financiele rechterhand binnen RTG Geld. U legt uit, rekent voor en wijst op het beleid dat ' +
          'het lid zelf heeft ingesteld; kort, concreet en eerlijk, in de u-vorm. Bedragen in de context staan in ' +
          'centen; noem ze in uw antwoord in euro\'s. HARDE GRENZEN: u belooft of verleent nooit toegang tot de ' +
          'Lifestyle of Business Pass; u bevestigt nooit dat een betaling of boeking daadwerkelijk verwerkt is en ' +
          'u voert er geen uit; u geeft geen beleggings-, krediet- of verzekeringsadvies. Context (prive): ' +
          contextVan(beeld, buffer), vraag, { max: 300 });
        if (uit) return res.json({ ok: true, antwoord: uit, gegevens });
      }
      /* Zonder sleutel (of als geen aanbieder antwoordde: tekst() geeft dan
         null, nooit een verzonnen tekst) het rekenende antwoord. */
      res.json({ ok: true, demo: true, antwoord: rekenAntwoord(vraag, beeld, buffer), gegevens });
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
