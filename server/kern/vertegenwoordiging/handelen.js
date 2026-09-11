/* ============================================================================
   RTG Vertegenwoordiging, deel "handelen": de eigen grens van de cliënt, en
   handelen ONDER een machtiging.

   Afgesplitst van ./acties.js op de 10 kB-grens (keuringsregel 13), en die
   grens wees hier een echte naad aan in plaats van een willekeurige byte. Daar
   staat de LEVENSLOOP van een machtiging -- voorstellen, aanvaarden, intrekken
   -- en hier staat wat er BINNEN of ONDANKS zo'n machtiging gebeurt. Twee
   onderwerpen, twee bestanden.

   DE EIGEN GRENS HOORT AAN DEZE KANT EN NIET BIJ HET INTREKKEN. Intrekken
   beëindigt EEN machtiging; een grens is een staande uitspraak over ALLE
   machtigingen, ook die er nog niet zijn. Wie ze bij elkaar zet, verleidt de
   volgende lezer om de grens als een soort intrekking te behandelen -- en dan
   verdwijnt hij zodra de machtiging weg is.

   Krijgt de gedeelde hulp van ./acties.js mee, plus `spoor` en
   `zoekAlsVertegenwoordiger`: die twee horen bij de opslag en niet bij een van
   de twee helften.
   ========================================================================== */
'use strict';

const { bestaat } = require('./bevoegdheden');
const M = require('./machtiging');

module.exports = (h) => {
  const { dossier, vastleggen, scho, naam, spoor, zoekAlsVertegenwoordiger } = h;
  /* ---------- de eigen grens van de client ---------- */
  async function grensZet(clientKey, sleutels) {
    const lijst = Array.isArray(sleutels) ? [...new Set(sleutels.map(x => String(x || '')))] : [];
    const onbekend = lijst.filter(k => !bestaat(k));
    if (onbekend.length) return { status: 400, error: 'Onbekende bevoegdheid: ' + onbekend.join(', ') + '.' };
    const mis = await vastleggen(() => {
      const d = dossier(clientKey);
      d.grens = lijst.sort();
      /* DE GRENS GELDT OOK VOOR WAT AL LOOPT. Een grens die alleen nieuwe
         machtigingen raakt, beschermt precies de mens niet die er al een heeft. */
      for (const m of d.machtigingen) {
        if (M.stand(m) !== 'actief') continue;
        const over = m.bevoegdheden.filter(k => !lijst.includes(k));
        if (over.length !== m.bevoegdheden.length) {
          m.bevoegdheden = over;
          spoor(clientKey, { soort: 'versmald', door: naam(clientKey), machtigingId: m.id, gelukt: true });
        }
      }
    });
    if (mis) return mis;
    return { status: 200, ok: true, grens: lijst,
      let: 'Deze bevoegdheden geeft u aan niemand, ook niet aan wie u al gemachtigd heeft.' };
  }

  /* ---------- handelen onder een machtiging ---------- */
  async function handel(vertegenwoordigerKey, mid, bevoegdheid, ctx) {
    const gevonden = zoekAlsVertegenwoordiger(vertegenwoordigerKey, mid);
    if (!gevonden) return { status: 404, error: 'U heeft deze machtiging niet.' };
    const { m, clientKey } = gevonden;
    const c = ctx || {};
    const oordeel = M.magHandelen(m, bevoegdheid, { bedragCenten: c.bedragCenten });
    const regel = { soort: 'handeling', door: naam(vertegenwoordigerKey), machtigingId: m.id,
      bevoegdheid: String(bevoegdheid || ''), wat: scho(c.wat, 200) || null,
      bedragCenten: c.bedragCenten == null ? null : Math.round(Number(c.bedragCenten) || 0),
      gelukt: !!oordeel.mag, reden: oordeel.reden };
    const mis = await vastleggen(() => spoor(clientKey, regel));
    if (mis) return mis;
    if (!oordeel.mag) return { status: 403, error: oordeel.reden, gelogd: true };
    return { status: 200, ok: true, klaarzetten: oordeel.klaarzetten, reden: oordeel.reden,
      let: oordeel.klaarzetten
        ? 'Klaargezet. De cliënt bevestigt; er is niets verstuurd of vastgelegd.'
        : 'Uitgevoerd binnen de machtiging, en het staat in het spoor van de cliënt.' };
  }

  return { grensZet, handel };
};
