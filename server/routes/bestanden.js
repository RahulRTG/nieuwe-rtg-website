/* RTG Bestanden: de kluis van het lid. Uploaden binnen het quotum, mappen,
   delen op codenaam (de ander haalt op en zet nieuwe versies), versies en
   de prullenbak als zichtbare la. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, bestanden, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account om bestanden te bewaren.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/bestanden/mijn', auth, (req, res) => stuur(res, bestanden.bestandenLijst(req.session.key)));

  /* ---------- PDF-redactie ----------
     De machine staat in kern/pdf-redactie.js: de passage gaat UIT de
     tekenopdrachten, niet onder een zwart balkje. Wat hier bij komt, is de
     eerlijkheid eromheen, en die is belangrijker dan de knop.

     HET RESULTAAT IS EEN NIEUW BESTAND, GEEN NIEUWE VERSIE. Deze kluis bewaart
     namelijk elke oude versie en zet ze desgewenst terug -- dat is precies wat
     je wilt bij een document, en precies wat je NIET wilt bij een redactie: dan
     staat het origineel met de naam erin een klik verderop. Het geredigeerde
     stuk komt daarom als los bestand binnen, en het antwoord zegt met zoveel
     woorden dat het origineel er NOG STAAT en dat weghalen uw eigen,
     onomkeerbare handeling is. Doen alsof een redactie het origineel opruimt,
     is de gevaarlijkste leugen die deze laag zou kunnen vertellen. */
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
  app.post('/api/bestanden/map', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, b.id ? bestanden.bestandenMapWijzig(req.session.key, String(b.id), b)
      : bestanden.bestandenMapNieuw(req.session.key, b.naam, b.ouder));
  });
  app.post('/api/bestanden/upload', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, b.id ? bestanden.bestandenVersieNieuw(req.session.key, String(b.id), b.dataUrl)
      : bestanden.bestandenUpload(req.session.key, b));
  });
  // grote bestanden: in stukken (de globale JSON-grens is 8 MB)
  app.post('/api/bestanden/upstart', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpStart(req.session.key, req.body || {}));
  });
  app.post('/api/bestanden/updeel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpDeel(req.session.key, (req.body || {}).uploadId, (req.body || {}).stuk));
  });
  app.post('/api/bestanden/upklaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpKlaar(req.session.key, (req.body || {}).uploadId));
  });
  app.post('/api/bestanden/wijzig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenWijzig(req.session.key, String((req.body || {}).id || ''), req.body || {}));
  });
  app.post('/api/bestanden/deel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await bestanden.bestandenDeel(req.session.key, String((req.body || {}).id || ''),
      String((req.body || {}).codenaam || ''), (req.body || {}).aan !== false));
  });
  app.post('/api/bestanden/haal', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, bestanden.bestandenHaal(req.session.key, String(b.id || ''), b.versie == null ? null : b.versie));
  });
  app.post('/api/bestanden/versies', auth, (req, res) =>
    stuur(res, bestanden.bestandenVersies(req.session.key, String((req.body || {}).id || ''))));
  app.post('/api/bestanden/versieterug', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenVersieTerug(req.session.key, String((req.body || {}).id || ''), (req.body || {}).n));
  });
  app.post('/api/bestanden/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenWeg(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/bestanden/herstel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenHerstel(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/bestanden/leeg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenLeegPrullenbak(req.session.key));
  });
};
