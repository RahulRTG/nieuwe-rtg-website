/* ============================================================================
   DE LEDENKANT VAN EEN VAKSCHEMA -- wat het lid met een voorstel doet.

   ./vakschema.js is de kant van de VAKMAN: daar zit de poort (het genre van de
   zaak en het vakbewijs van de mens) en daar wordt een voorstel klaargezet. Hier
   staat de andere helft, en de knip loopt langs de partij omdat dat precies is
   wat deze laag uit elkaar houdt: de een mag voorstellen, de ander beslist.

   ER WORDT HIER NIETS TERUGGEMELD AAN DE AFZENDER. Niet bij aanvaarden en niet
   bij weigeren, en de reden van een weigering al helemaal niet -- waarom u iets
   niet wilt, is niet aan wie het stuurde. ./vakschema.js laat de zaak dan ook
   alleen zien WAT zij verstuurde en nooit wat ermee gebeurde.
   ========================================================================== */
'use strict';

module.exports = function maakLedenkant({ kijk, save, scho, nu, trainingZet }) {
  function mijn(key) {
    const open = (kijk()[key] || []).filter(v => v.stand === 'open');
    return { status: 200, voorstellen: open.map(v => ({ id: v.id, at: v.at, naam: v.naam, wat: v.wat,
      dagen: v.dagen, duurMin: v.duurMin, van: v.zaakNaam, door: v.door, genre: v.genre })),
      let: 'Een voorstel staat hier en nergens anders. Neemt u het aan, dan komt het in uw eigen ' +
        'schema te staan met de naam van wie het gaf; doet u dat niet, dan gebeurt er niets.' };
  }

  function aanvaard(key, vid) {
    const v = (kijk()[key] || []).find(x => x.id === scho(vid, 20) && x.stand === 'open');
    if (!v) return { status: 404, error: 'Dit voorstel staat niet voor u open.' };
    if (typeof trainingZet !== 'function') {
      return { status: 503, error: 'Het schema kan nu niet worden weggeschreven; probeer het later opnieuw.' };
    }
    /* Het schema landt in het EIGEN schema van het lid, langs de gewone weg.
       Er komt geen tweede plek waar schema's wonen (LAT.md regel 4), en
       `vanWie` is hier voor het eerst geen bewering maar een vastgestelde mens
       bij een zaak met een gekeurd genre. */
    const r = trainingZet(key, { naam: v.naam, wat: v.wat, dagen: v.dagen, duurMin: v.duurMin,
      vanWie: v.door + ' (' + v.zaakNaam + ')' });
    if (r && r.error) return r;
    v.stand = 'aanvaard';
    v.beslistOp = nu();
    save();
    return { status: 200, schema: r,
      let: 'Het staat nu in uw eigen schema. Wilt u het weg, dan haalt u het daar weg -- dit voorstel ' +
        'komt niet terug.' };
  }

  function weiger(key, vid, reden) {
    const v = (kijk()[key] || []).find(x => x.id === scho(vid, 20) && x.stand === 'open');
    if (!v) return { status: 404, error: 'Dit voorstel staat niet voor u open.' };
    v.stand = 'geweigerd';
    v.beslistOp = nu();
    /* De reden blijft bij het LID en gaat niet terug naar de zaak: waarom u iets
       niet wilt, is niet aan de afzender. */
    v.reden = scho(reden, 300) || null;
    save();
    return { status: 200, let: 'Weg. De afzender krijgt hier geen bericht van.' };
  }

  return { mijn, aanvaard, weiger };
};
