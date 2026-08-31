/* Foundation OS, deel "donateur-kantoor": wat het KANTOOR met een gever doet --
   de code uitgeven en de periodieke overeenkomst vastleggen.

   AFGESPLITST VAN ./donateur.js toen die over de 10 KB ging, en de naad loopt
   langs de LEZER: hiernaast staat wat de gever ziet (zijn eigen giften, zijn
   bewijs), hier staat wat een medewerker doet. Dezelfde snede als bij ./gift.js,
   en om dezelfde reden -- die twee hebben elk hun eigen deur.

   Twee grendels komen uit ./gift-vormen.js en staan hier dus niet nog een keer:
   de ondergrens van vijf jaar, en de zin die zegt wat de ANBI-stand betekent.
   Die tweede stond hier ooit als onvoorwaardelijk "aftrekbaar zonder drempel",
   en dat is precies de belofte die een gever geld kost als zij niet klopt. */
'use strict';

const { JAREN_MIN, anbiZin } = require('./gift-vormen');

module.exports = (ctx, { code }) => {
  const { nu, schoon, S, audit, wie, poort, save } = ctx;

  /* ---------- de kantoorkant: de code uitgeven ---------- */
  function codeVoor(req, bronId) {
    const b = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!b) return { status: 404, error: 'Deze bron bestaat niet.' };
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    /* Alle giften van DEZELFDE gever in deze stad krijgen dezelfde code. Anders
       heeft een trouwe gever twaalf codes en ziet hij bij elke code een stukje
       van zichzelf. */
    const bestaand = S().bronnen.find(x => x.stad === b.stad && x.gever === b.gever && x.donateurcode);
    const sleutel = bestaand ? bestaand.donateurcode : code('RTFS');
    let n = 0;
    for (const x of S().bronnen) {
      if (x.stad === b.stad && x.gever === b.gever && !x.donateurcode) { x.donateurcode = sleutel; n++; }
    }
    audit(w.key, 'donateur.code', b.gever, n + ' gift(en) op deze code');
    save();
    return { ok: true, code: sleutel, giften: n,
      melding: 'Deze code opent alle ' + n + ' gift(en) van ' + b.gever + ' in deze stad, en niets van iemand anders.' };
  }

  /* De periodieke schenkingsovereenkomst vastleggen. De grendel zit hier: onder
     de vijf jaar is het geen periodieke gift, hoe je het ook noemt. */
  function periodiekVast(req, bronId, b) {
    b = b || {};
    const bron = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    const w = wie(req);
    const g = poort(w, bron.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    const jaren = Math.round(Number(b.jaren) || 0);
    if (jaren < JAREN_MIN) {
      return { status: 400, error: 'Een periodieke gift loopt ten minste ' + JAREN_MIN + ' jaar. Korter kan, maar dan is het een gewone gift ' +
        'met een drempel -- en een bewijs dat iets anders suggereert kost de gever geld bij zijn aangifte.' };
    }
    const kenmerk = schoon(b.kenmerk, 60);
    if (!kenmerk) return { status: 400, error: 'Wat is het kenmerk van de overeenkomst? Zonder vindbare overeenkomst is er niets vastgelegd.' };
    const tot = schoon(b.tot, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { status: 400, error: 'Tot wanneer loopt de overeenkomst?' };
    bron.periodiek = { jaren, kenmerk, tot, door: w.key };
    audit(w.key, 'donateur.periodiek', bron.gever, jaren + ' jaar, kenmerk ' + kenmerk);
    save();
    /* Hier stond onvoorwaardelijk "aftrekbaar zonder drempel" -- onwaar zodra de
       stichting geen ANBI is, en juist bij de aangifte. De zin staat nu in
       ./gift-vormen.js en de stand komt uit ./gift.js. */
    const anbi = (ctx.giftAnbi && ctx.giftAnbi()) || 'onbekend';
    return { ok: true, melding: 'Vastgelegd onder kenmerk ' + kenmerk + '. ' +
      anbiZin(anbi, (ctx.giftRsin && ctx.giftRsin()) || '', 'periodiek') };
  }

  return { codeVoor, periodiekVast };
};
