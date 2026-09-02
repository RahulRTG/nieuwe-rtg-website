/* Foundation OS, deel "index-spiegel": wie ben ik hier, en wat is er gebeurd.

   WAAROM DIT APART STAAT. ./index.js is bedrading: het bouwt vijftig delen op
   en geeft ze door. Deze twee functies zijn dat niet -- ze zijn de enige plek
   in dit OS waar het systeem naar ZICHZELF kijkt. Ze stonden ertussen omdat ze
   klein zijn, en toen liep het bestand tegen de 10 KB van regel 13. Die grens
   is een dakpan en geen wet: hij zegt dat er een tweede onderwerp in zit, en
   dat klopte hier.

   TWEE VRAGEN, EN ZE HOREN BIJ ELKAAR: "wat mag ik zien" (./index.js kan er
   geen menu van bouwen zonder) en "wat is er gedaan". Samen zijn ze de spiegel
   van dit OS.

   DRIE DINGEN DIE NIET MOGEN SNEUVELEN:

   1. HET AUDITSPOOR IS ALLEEN VAN HET LANDELIJKE BESTUUR, en alleen te LEZEN.
      Er is nergens een functie die erin schrijft behalve ctx.audit zelf, en
      nergens een die eruit haalt.

   2. DE AFKAPTELLER GAAT MEE. "Er staat niets meer" en "er is nooit iets
      geweest" mogen niet hetzelfde lezen (LAT.md regel 3). Zonder die teller
      leest een afgekapt spoor als een schoon spoor, en dat is precies het
      verkeerde soort geruststelling.

   3. `ik` VERZINT GEEN RECHTEN. Wat hier uit komt is wat ctx.wie() zegt; het
      scherm bouwt er een menu van, maar de poort staat op de route en niet
      hier. Een menu is geen bevoegdheid. */
'use strict';

module.exports = (ctx) => {
  function auditlog(req, filter) {
    const w = ctx.wie(req);
    if (!w.landelijk) return { status: 403, error: 'Het auditspoor is van het landelijke RTF-bestuur.' };
    const f = filter || {};
    let rijen = ctx.S().audit;
    if (f.wat) rijen = rijen.filter(r => r.wat.startsWith(String(f.wat)));
    if (f.wie) rijen = rijen.filter(r => r.wie === String(f.wie));
    return { ok: true, totaal: rijen.length, afgekapt: Number(ctx.S().auditAfgekapt) || 0,
      regels: rijen.slice(0, 300) };
  }

  /* Wie ben ik in dit OS: het scherm bouwt hier zijn menu op. */
  function ik(req) {
    const w = ctx.wie(req);
    return { ok: true, ingelogd: !!w.key, key: w.key, landelijk: w.landelijk,
      zetels: w.zetels.map(z => ({ stad: z.stad, rol: z.rol,
        stadNaam: (ctx.stadVan(z.stad) || {}).naam || z.stad })),
      vlaggen: ctx.VLAGGEN, rollen: ctx.ROLLEN };
  }

  return { auditlog, ik };
};
