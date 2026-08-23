/* Horeca (kern): DE WIJK -- welke tafels zijn van wie, en wanneer.

   WAAROM DIT ER NIET WAS, EN WAAROM HET ER NU IS. De werklijst van de PDA toont
   de hele zaak, en dat stond er ook bij: een sectie-indeling bestond nergens in
   de data, dus deed het scherm niet alsof. Dat is eerlijk maar niet genoeg --
   op een avond met veertig tafels is "alles" geen werklijst maar een muur.

   DRIE REGELS DIE DIT VEILIG MAKEN, en ze gaan alle drie over hetzelfde: een
   wijk mag werk VERDELEN en nooit VERBERGEN.

   1. EEN TAFEL DIE IN GEEN ENKELE WIJK ZIT, IS VAN IEDEREEN. Wie hem vergeet in
      te delen, verliest hem niet -- hij staat gewoon bij iedereen op de lijst.
      Andersom zou de eerste vergeten tafel de laatste zijn die iemand ziet.
   2. EEN WIJK DIE NIEMAND HEEFT, IS VAN IEDEREEN. Iemand klokt uit, iemand
      wordt ziek, iemand vergeet zijn wijk te nemen: dan valt het werk terug
      naar de hele ploeg in plaats van in een gat.
   3. EEN TAFEL HOORT BIJ HOOGSTENS EEN WIJK. Twee wijken op dezelfde tafel
      geven twee antwoorden op "van wie is dit", en dan gaat er niemand of gaan
      er twee. Bij het opslaan wordt hij daarom uit elke andere wijk gehaald,
      zichtbaar en met een melding -- niet stil.

   EN DE VIERDE, DIE OP HET SCHERM STAAT EN NIET HIER: een lijst die filtert,
   zegt hoeveel hij daarmee NIET toont. Een filter dat zwijgt over wat het
   wegliet, is een filter waarin werk verdwijnt.

   WAT DIT NIET IS: een dienstrooster. Wie wanneer werkt staat in de
   personeelslaag; dit zegt alleen wie op DIT moment welke tafels draagt. Een
   wijk nemen is een handeling van een halve seconde aan het begin van een
   dienst, en hem loslaten net zo -- geen planning vooraf, want die klopt op een
   drukke avond toch nooit. */
'use strict';

const MAXWIJKEN = 24;
const MAXTAFELS = 60;

function doosWijken(h) {
  if (!h.instel || typeof h.instel !== 'object') h.instel = {};
  if (!Array.isArray(h.instel.wijken)) h.instel.wijken = [];
  return h.instel.wijken;
}
function doosDienst(h) {
  if (!h.wijkdienst || typeof h.wijkdienst !== 'object') h.wijkdienst = {};
  return h.wijkdienst;
}

module.exports = ({ horeca, schoon }) => {
  const { nu, id } = horeca;

  const tafelNaam = (t) => schoon(t, 30).trim();

  /* De wijken met wie ze op dit moment draagt. `van` is null als niemand hem
     heeft -- en dan is de wijk van iedereen (regel 2). */
  function lijst(h) {
    const dienst = doosDienst(h);
    return doosWijken(h).map((w) => Object.assign({}, w, { van: dienst[w.id] || null }));
  }

  /* Aanmaken of bijwerken. Tafels die al in een andere wijk zaten, worden daar
     weggehaald -- en de aanroeper krijgt te horen welke, zodat het geen stille
     verhuizing is (regel 3). */
  function zet(h, { wijkId, naam, tafels }) {
    const wijken = doosWijken(h);
    const n = schoon(naam, 40).trim();
    if (!n) return { status: 400, error: 'Hoe heet deze wijk?' };
    const lijstTafels = (Array.isArray(tafels) ? tafels : []).slice(0, MAXTAFELS)
      .map(tafelNaam).filter(Boolean);
    const uniek = [...new Set(lijstTafels)];

    let w = wijkId ? wijken.find((x) => x.id === String(wijkId)) : null;
    if (wijkId && !w) return { status: 404, error: 'Deze wijk kennen we niet.' };
    if (!w) {
      if (wijken.length >= MAXWIJKEN) return { status: 409, error: 'Meer dan ' + MAXWIJKEN + ' wijken wordt onleesbaar.' };
      w = { id: id(4), naam: n, tafels: [] };
      wijken.push(w);
    }
    const verhuisd = [];
    for (const t of uniek) {
      for (const ander of wijken) {
        if (ander.id === w.id) continue;
        const i = ander.tafels.indexOf(t);
        if (i >= 0) { ander.tafels.splice(i, 1); verhuisd.push({ tafel: t, van: ander.naam }); }
      }
    }
    w.naam = n;
    w.tafels = uniek;
    return { ok: true, wijk: w, verhuisd,
      let: verhuisd.length
        ? verhuisd.map((v) => v.tafel + ' kwam uit ' + v.van).join('; ') + '. Een tafel hoort bij hoogstens een wijk.'
        : 'Opgeslagen.' };
  }

  function weg(h, wijkId) {
    const wijken = doosWijken(h);
    const i = wijken.findIndex((x) => x.id === String(wijkId || ''));
    if (i < 0) return { status: 404, error: 'Deze wijk kennen we niet.' };
    const w = wijken.splice(i, 1)[0];
    delete doosDienst(h)[w.id];
    /* De tafels verdwijnen niet mee: ze zitten daarna in geen enkele wijk en
       zijn dus van iedereen (regel 1). */
    return { ok: true, wijk: w, let: w.tafels.length
      ? 'De ' + w.tafels.length + ' tafels staan nu bij iedereen op de lijst.' : 'Weg.' };
  }

  /* Een wijk nemen. Heeft een ander hem al, dan krijg je te horen wie -- en
     niet stilzwijgend de wijk afgepakt. Dezelfde regel als de claim op de pas. */
  function neem(h, wijkId, wie) {
    const w = doosWijken(h).find((x) => x.id === String(wijkId || ''));
    if (!w) return { status: 404, error: 'Deze wijk kennen we niet.' };
    const dienst = doosDienst(h);
    const al = dienst[w.id];
    if (al && String(al.staffId) !== String(wie.staffId)) {
      return { status: 409, code: 'al-genomen',
        error: al.naam + ' draagt deze wijk al. Vraag het even, of laat hem hem loslaten.', van: al };
    }
    if (al) return { ok: true, wijk: w, van: al, al: true };
    dienst[w.id] = { staffId: String(wie.staffId), naam: wie.naam, at: nu() };
    return { ok: true, wijk: w, van: dienst[w.id] };
  }

  /* Loslaten kan alleen wat van jou is, of door een manager die een wijk moet
     vrijmaken -- dezelfde regel als op de pas. */
  function laat(h, wijkId, wie) {
    const dienst = doosDienst(h);
    const al = dienst[String(wijkId || '')];
    if (!al) return { status: 404, error: 'Deze wijk draagt niemand.' };
    if (String(al.staffId) !== String(wie.staffId) && !wie.manager) {
      return { status: 409, error: al.naam + ' draagt deze wijk; alleen hij of een manager laat hem los.' };
    }
    delete dienst[String(wijkId)];
    return { ok: true, was: al, let: 'De tafels van deze wijk staan nu bij iedereen op de lijst.' };
  }

  /* ---------- de vraag waar het allemaal om draait ----------
     Is deze tafel van mij? Ja als hij in een wijk zit die ik draag, EN ja als
     hij van niemand is (regel 1 en 2). Nooit "nee" bij twijfel: een lijst mag
     verdelen, niet verbergen. */
  function vanMij(h, tafel, staffId) {
    const t = tafelNaam(tafel);
    if (!t) return true;
    const dienst = doosDienst(h);
    for (const w of doosWijken(h)) {
      if (!w.tafels.includes(t)) continue;
      const van = dienst[w.id];
      if (!van) return true;                                  // wijk zonder mens
      return String(van.staffId) === String(staffId);
    }
    return true;                                              // in geen enkele wijk
  }

  // welke wijken draag ik nu
  function mijne(h, staffId) {
    const dienst = doosDienst(h);
    return doosWijken(h).filter((w) => dienst[w.id] && String(dienst[w.id].staffId) === String(staffId));
  }

  return { lijst, zet, weg, neem, laat, vanMij, mijne, MAXWIJKEN, MAXTAFELS };
};
