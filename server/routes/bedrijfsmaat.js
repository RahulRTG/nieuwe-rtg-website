/* De bedrijfsmaten van RTG als onderneming (server/kern/bedrijfsmaat/stand.js),
   en eronder het banksaldo (server/kern/bankpositie.js) en het boek van RTG zelf
   (server/kern/rtgboek.js).

   DE BEDRIJFSMATEN: EEN ROUTE, LEZEND, ACHTER DE BOARDROOM. Wat hier staat, gaat over de hele
   onderneming, en dat is de kamer van de eigenaar. Elk getal dat over mensen
   optelt is al langs de groepspoort geweest: onder de grens staat er
   TE_KLEINE_GROEP met de grens en de reden, en geen waarde en geen aantal.

   Het kantoorstuur mag deze route lezen (besluit C2: tonen), en krijgt daarbij
   niets meer dan de mens die het vraagt -- de boardroomdeur geldt voor beide. */
'use strict';
const { BESLUITEN } = require('../kern/bedrijfsmaat/besluiten');

module.exports = (kern) => {
  const { app, boardroomAuth, boardroomWie, bedrijfsmaat, bankpositie, bankpositieZet, aanmeldkanaalStand, streefbeeld,
    officeAuth, naamAuth, rtgBoek, rtgBoekZet, rtgBoekCampagne, RTGBOEK_DELEN, rtgCampagnes, rtgCampagneMaak, AANMELDKANALEN,
    beslisgeheugen, beslisgeheugenLeg, beslisgeheugenTrekIn } = kern;
  app.post('/api/office/bedrijfsmaat', boardroomAuth, (req, res) => {
    const uit = bedrijfsmaat.stand({ maand: (req.body || {}).maand });
    res.json(Object.assign({ ok: true, besluiten: BESLUITEN.map(b => ({ id: b.id, naam: b.naam, kort: b.kort })) }, uit));
  });

  /* HET BANKSALDO VAN RTG (kern/bankpositie.js, besluit C4): lezen en, op naam,
     het saldo van een maand zetten met het afschrift als bron. Wie het zette komt
     uit de sessie en nooit uit het verzoek. */
  app.post('/api/office/bankpositie', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, bankpositie((req.body || {}).maand))));
  /* HET STREEFBEELD (kern/streefbeeld.js, besluit C7): lezen mag de boardroom;
     tekenen en intrekken alleen de eigenaar, op naam. */
  app.post('/api/office/streefbeeld', boardroomAuth, (req, res) => res.json({ ok: true,
    voorstel: streefbeeld.voorstel(), getekend: streefbeeld.getekend(), toets: streefbeeld.toets((req.body || {}).maand) }));
  const alleenEigenaar = (req, res) => {
    if (req.boardroomBaas) return true;
    res.status(403).json({ error: 'Alleen de eigenaar tekent of trekt een streefbeeld in.' }); return false;
  };
  const uit = (res, r) => (r.error ? res.status(r.status || 400).json(r) : res.json(r));
  app.post('/api/office/streefbeeld/teken', boardroomAuth, (req, res) => {
    if (alleenEigenaar(req, res)) uit(res, streefbeeld.teken((req.body || {}).id, boardroomWie(req)));
  });
  app.post('/api/office/streefbeeld/intrek', boardroomAuth, (req, res) => {
    if (alleenEigenaar(req, res)) uit(res, streefbeeld.intrek(boardroomWie(req)));
  });
  // hoe leden bij RTG kwamen, per maand en langs de groepspoort (kern/aanmeldkanaal.js, C6)
  app.post('/api/office/aanmeldkanaal', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, aanmeldkanaalStand((req.body || {}).maand))));
  app.post('/api/office/bankpositie/zet', boardroomAuth, (req, res) => {
    const wie = boardroomWie(req);
    if (!wie) return res.status(403).json({ error: 'Een saldo zet een mens op naam, niet de gedeelde kantoorcode.' });
    const b = req.body || {};
    const r = bankpositieZet({ maand: b.maand, centen: b.centen, peildatum: b.peildatum, bron: b.bron, wie });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  /* HET BOEK VAN RTG ZELF (server/kern/rtgboek.js, besluit C8), achter de
     KANTOORdeur en niet de boardroom: de kamer Financien leest en vult het. Lezen
     mag met de gedeelde code; schrijven staat achter naamAuth, zodat de deur al
     een mens op naam eist en de kern het niet als enige hoeft te weigeren. */
  app.post('/api/office/rtgboek', officeAuth, (req, res) =>
    res.json({ ok: true, boek: rtgBoek((req.body || {}).maand), delen: RTGBOEK_DELEN }));
  app.post('/api/office/rtgboek/zet', naamAuth, (req, res) => {
    const b = req.body || {};
    const r = rtgBoekZet({ maand: b.maand, deel: String(b.deel || ''), post: String(b.post || ''),
      centen: b.centen, bron: b.bron, wie: boardroomWie(req) });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  /* DE CAMPAGNES VAN RTG (kern/rtgcampagne.js, besluit C12): het register lezen,
     een campagne aanmaken en wat hij in een maand kostte boeken -- allemaal in de
     kamer Financien, en schrijven alleen op naam. */
  app.post('/api/office/rtgcampagne', officeAuth, (req, res) =>
    res.json({ ok: true, campagnes: rtgCampagnes(), kanalen: AANMELDKANALEN.filter(k => k !== 'vriend') }));
  app.post('/api/office/rtgcampagne/maak', naamAuth, (req, res) => {
    const b = req.body || {};
    uit(res, rtgCampagneMaak({ code: b.code, naam: b.naam, kanaal: b.kanaal, van: b.van, tot: b.tot, wie: boardroomWie(req) }));
  });
  app.post('/api/office/rtgboek/campagne', naamAuth, (req, res) => {
    const b = req.body || {};
    uit(res, rtgBoekCampagne({ maand: b.maand, code: b.code, centen: b.centen, bron: b.bron, wie: boardroomWie(req) }));
  });
  /* HET BESLISGEHEUGEN (kern/beslisgeheugen.js, besluit C13): lezen mag de
     boardroom; een besluit vastleggen of intrekken alleen een mens op naam. */
  app.post('/api/office/beslisgeheugen', boardroomAuth, (req, res) => res.json({ ok: true, besluiten: beslisgeheugen() }));
  app.post('/api/office/beslisgeheugen/leg', boardroomAuth, (req, res) => {
    const b = req.body || {};
    uit(res, beslisgeheugenLeg({ besluit: b.besluit, verwachting: b.verwachting, termijnDagen: b.termijnDagen, wie: boardroomWie(req) }));
  });
  app.post('/api/office/beslisgeheugen/intrek', boardroomAuth, (req, res) => {
    const b = req.body || {};
    uit(res, beslisgeheugenTrekIn({ id: b.id, reden: b.reden, wie: boardroomWie(req) }));
  });
};
