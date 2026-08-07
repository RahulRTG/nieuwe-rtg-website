/* ============================================================================
   DE PDF-BEWERKINGEN OP EEN EIGEN BESTAND.

   Samenvoegen, splitsen, annoteren en redigeren. Ze stonden tussen de gewone
   bestandsroutes (./bestanden.js) en dat is een ander onderwerp: die gaan over
   een map met bestanden -- uploaden, delen, versies, prullenbak -- en deze over
   wat je met de BYTES van een document kunt doen.

   EEN DING DAT VOOR ALLE VIER GELDT en dat de reden is dat ze bij elkaar horen:
   het id komt uit de body, dus dit is precies de plek waar iemand het id van een
   ander probeert. pdfBytes() haalt het bestand daarom op met de SESSIESLEUTEL
   erbij; wie een vreemd id meestuurt krijgt geen document maar een weigering.
   test/mailpost-kantoor.test.js rekent dat na.
   ========================================================================== */
module.exports = (kern) => {
  const { app, bestanden, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session && req.session.gast) { res.status(403).json({ error: 'Een gast kan geen bestanden bewerken.' }); return true; }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  const pdfBytes = (key, id) => {
    const bron = bestanden.bestandenHaal(key, String(id || ''), null);
    if (bron.error) return bron;
    const m = /^data:([^;]+);base64,(.*)$/.exec(String(bron.dataUrl || ''));
    if (!m) return { status: 422, error: 'Dat bestand is niet terug te lezen.' };
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.slice(0, 5).equals(Buffer.from('%PDF-'))) return { status: 422, error: '"' + bron.naam + '" is geen PDF.' };
    return { buf, naam: bron.naam };
  };
  const bewaar = (req, res, naam, buf, extra) => {
    const nieuw = bestanden.bestandenUpload(req.session.key, { naam, map: (req.body || {}).map || null,
      dataUrl: 'data:application/pdf;base64,' + buf.toString('base64') });
    if (nieuw.error) return stuur(res, nieuw);
    res.json(Object.assign({ ok: true, bestand: nieuw, naam }, extra));
  };

  app.post('/api/bestanden/pdf/samenvoegen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(String).slice(0, 20);
    if (ids.length < 2) return res.status(400).json({ error: 'Kies minstens twee PDF-bestanden om samen te voegen.' });
    const bufs = [];
    for (const id of ids) {
      const b = pdfBytes(req.session.key, id);
      if (b.error) return stuur(res, b);
      bufs.push(b.buf);
    }
    const uit = require('../kern/pdf-bouw').voegSamen(bufs);
    if (!uit.ok) return res.status(422).json({ error: uit.waarom });
    bewaar(req, res, 'Samengevoegd (' + uit.paginas + ' pagina\'s).pdf',
      uit.bestand, { paginas: uit.paginas, documenten: uit.documenten, let: uit.let });
  });

  app.post('/api/bestanden/pdf/splitsen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const bron = pdfBytes(req.session.key, b.id);
    if (bron.error) return stuur(res, bron);
    const uit = require('../kern/pdf-bouw').splits(bron.buf, b.van, b.tot);
    if (!uit.ok) return res.status(422).json({ error: uit.waarom });
    const naam = String(bron.naam || 'document.pdf').replace(/(\.pdf)?$/i, '') +
      ' (pagina ' + uit.van + (uit.tot > uit.van ? '-' + uit.tot : '') + ').pdf';
    bewaar(req, res, naam, uit.bestand, { paginas: uit.paginas, van: uit.van, tot: uit.tot,
      let: uit.let + ' Het bronbestand blijft staan; wie een deel van een dossier deelt, wil het geheel houden.' });
  });

  /* Een notitie op een pagina. Dit is de ENIGE PDF-ingang die het bestand niet
     opnieuw opbouwt maar er iets ACHTER schrijft (kern/pdf-notitie.js): het
     origineel blijft byte voor byte staan, met een tweede kruisverwijzing die
     met /Prev naar de eerste wijst. Wie iets echt weg wil hebben, gebruikt de
     redactie hieronder. */
  app.post('/api/bestanden/pdf/notitie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const bron = pdfBytes(req.session.key, b.id);
    if (bron.error) return stuur(res, bron);
    const uit = require('../kern/pdf-notitie')().annoteer(bron.buf,
      { pagina: b.pagina, tekst: b.tekst, wie: b.wie, rechthoek: b.rechthoek });
    if (!uit.ok) return res.status(422).json({ error: uit.waarom });
    const naam = String(bron.naam || 'document.pdf').replace(/(\.pdf)?$/i, '') + ' (met notitie).pdf';
    bewaar(req, res, naam, uit.bestand, { pagina: uit.pagina, let: uit.let });
  });

  app.post('/api/bestanden/pdf/notities', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const bron = pdfBytes(req.session.key, (req.body || {}).id);
    if (bron.error) return stuur(res, bron);
    const uit = require('../kern/pdf-notitie')().notities(bron.buf);
    if (!uit.ok) return res.status(422).json({ error: uit.waarom });
    res.json(uit);
  });

  app.post('/api/bestanden/pdf/redigeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const woorden = (Array.isArray(b.woorden) ? b.woorden : [b.woorden])
      .map(w => String(w || '').trim()).filter(Boolean).slice(0, 50);
    if (!woorden.length) return res.status(400).json({ error: 'Geef op welke tekst eruit moet.' });

    const bron = bestanden.bestandenHaal(req.session.key, String(b.id || ''), null);
    if (bron.error) return stuur(res, bron);
    const m = /^data:([^;]+);base64,(.*)$/.exec(String(bron.dataUrl || ''));
    if (!m) return res.status(422).json({ error: 'Dit bestand is niet terug te lezen.' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.slice(0, 5).equals(Buffer.from('%PDF-')))
      return res.status(422).json({ error: 'Dit is geen PDF; redactie werkt op de tekenopdrachten van een PDF.' });

    const uit = require('../kern/pdf-redactie').redigeer(buf, woorden);
    if (!uit.ok) return res.status(422).json({ error: uit.waarom });
    if (!uit.geraakt) return res.json({ ok: true, geraakt: 0, waarom: uit.waarom });

    const naam = String(bron.naam || 'document.pdf').replace(/(\.pdf)?$/i, '') + ' (geredigeerd).pdf';
    const nieuw = bestanden.bestandenUpload(req.session.key, { naam, map: b.map || null,
      dataUrl: 'data:application/pdf;base64,' + uit.bestand.toString('base64') });
    if (nieuw.error) return stuur(res, nieuw);
    res.json({ ok: true, geraakt: uit.geraakt, bestand: nieuw, naam,
      let: uit.let + ' Het ORIGINEEL staat nog gewoon in uw kluis, met de tekst er nog in. Dat is met opzet: een redactie die uw origineel opruimt zonder dat u het zegt, is onomkeerbaar en dus niet aan ons. Wilt u het weg, haal het dan zelf weg.' });
  });
};
