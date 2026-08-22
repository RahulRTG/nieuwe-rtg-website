/* Plaatslaag, deel "venster": TOESTEMMING MET EEN EINDE.

   Toestemming voor plaats heeft hier altijd een einde, en dat einde staat in het
   venster zelf. Het model komt uit kern/veiligheid/plek.js ("toestemming heeft
   hier altijd een einddatum") en is hier huisregel geworden. Buiten een venster
   is er geen waarneming: niet minder, niet geanonimiseerd -- geen.

   Wat er BINNEN een venster valt staat in ./waarnemen.js; de lijsten en het
   opruimen in ./opslag.js. */
'use strict';

const VENSTER_MAX_MIN = 12 * 60;      // een venster van meer dan een dienst is geen venster

module.exports = ({ db, save, opslag, DOELEN }) => {
  const { nu, id, vensters, ruim, schrijfLog, open } = opslag;

  /* Een venster openen. `bron` zegt WAAROM het openging -- een lopende dienst,
     een rit, een alarm, of een uitdrukkelijke tik van het lid -- en staat in het
     actielog. Zonder bron is een venster niet te verantwoorden, en een
     toestemming die niemand kan navertellen is geen toestemming. */
  function vensterOpen(codenaam, v) {
    ruim();
    if (!codenaam) return { status: 401, error: 'Geen lid.' };
    const doel = String((v && v.doel) || '');
    if (!DOELEN.includes(doel)) return { status: 400, error: 'Onbekend doel.' };
    const bron = String((v && v.bron) || '').slice(0, 60);
    if (!bron) return { status: 400, error: 'Een venster zonder reden gaat niet open.' };
    const minuten = Math.min(VENSTER_MAX_MIN, Math.max(1, Number(v && v.minuten) || 60));
    /* Eén venster per doel. Twee open vensters voor hetzelfde doel betekent twee
       einddatums, en dan is de vroegste een leugen. Bestaat er al een, dan
       verlengen we die in plaats van er een tweede naast te zetten. */
    const bestaand = vensters().find(x => x.codenaam === codenaam && x.doel === doel && open(x));
    const sluit = new Date(Date.now() + minuten * 60000).toISOString();
    if (bestaand) {
      bestaand.sluit = sluit; bestaand.bron = bron;
      schrijfLog(codenaam, 'venster-verlengd', { doel, bron, sluit }); save();
      return { status: 200, venster: bestaand, verlengd: true };
    }
    const venster = { id: id(), codenaam, doel, bron, geopend: nu(), sluit };
    vensters().unshift(venster);
    schrijfLog(codenaam, 'venster-geopend', { doel, bron, sluit });
    save();
    return { status: 200, venster, verlengd: false };
  }

  /* Sluiten kan altijd, en sluiten wist. Een venster dat dicht is maar zijn
     waarnemingen houdt, is precies het spoor dat hier niet hoort te bestaan.

     HET WISSEN GEBEURT DOOR ruim() EN NIET HIER. Er stond een eigen filterregel
     op plaatsWaarnemingen, en die was een tweede kopie van de regel die ruim()
     al draagt: een waarneming leeft zolang haar venster leeft. Een mutatieproef
     wees hem aan -- de regel weghalen liet geen enkele toets zakken, want ruim()
     ving het toch al op. Twee plekken die dezelfde waarheid vasthouden lopen
     uiteen (geografie.js), dus er is er nog een. Het venster gaat weg, ruim()
     ziet dat en neemt de waarnemingen mee. */
  function vensterSluit(codenaam, doel) {
    ruim();
    const v = vensters().find(x => x.codenaam === codenaam && x.doel === String(doel || '') && open(x));
    if (!v) return { status: 404, error: 'Geen open venster voor dit doel.' };
    db.data.plaatsVensters = vensters().filter(x => x.id !== v.id);
    ruim();
    schrijfLog(codenaam, 'venster-gesloten', { doel: v.doel, bron: v.bron });
    save();
    return { status: 200, gesloten: true };
  }

  return { vensterOpen, vensterSluit, VENSTER_MAX_MIN };
};
