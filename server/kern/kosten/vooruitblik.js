/* WAT WORDT HET DEZE MAAND? -- een projectie, en een trefzekerheid die GEMETEN
   is in plaats van beweerd.

   De rekensom is eenvoudig: wat er tot nu toe verbruikt is, gedeeld door de
   dagen die voorbij zijn, maal de dagen van de maand. Dat is het makkelijke
   deel. Het moeilijke deel is de zin eronder.

   EEN BANDBREEDTE IS EEN BELOFTE. "Verwacht: 284,20 euro, marge 279-289,
   betrouwbaarheid 99,1%" ziet er indrukwekkend uit en is een verzinsel met een
   decimaal zolang niemand die 99,1% heeft nagemeten. Dit huis heeft daar een
   regel voor (BESTUUR.md par. 3): wat niet gemeten is, wordt niet als getal
   getoond. Dus:

     - de projectie staat er altijd, met de graad van de cijfers eronder;
     - de trefzekerheid staat er ALLEEN als er afgesloten maanden zijn om hem op
       te baseren, en anders staat er waarom niet;
     - en de band volgt uit die gemeten trefzekerheid, niet uit een aanname.

   HOE DE METING WERKT. Elke dag legt de onderhoudsronde de projectie van de
   lopende maand vast. Als die maand voorbij is, staat de werkelijke uitkomst
   ernaast en is het verschil te rekenen. Na drie afgesloten maanden zegt deze
   laag voor het eerst iets over zijn eigen betrouwbaarheid -- en dan is het een
   meting.

   DRIE MAANDEN EN NIET EEN. Met een enkele maand is de "gemiddelde afwijking"
   die ene maand, en dan lijkt een toevallige treffer op precisie.

   OP HET HUISTOTAAL EN NIET PER GEBRUIKER. Dat scheelt een snapshot per lid per
   dag (een gedragslogboek in vermomming), en het is eerlijk over wat er gemeten
   is: het antwoord zegt met zoveel woorden dat de trefzekerheid over het geheel
   gaat en niet over uw eigen rekening. */
'use strict';

const MIN_MAANDEN = 3;
const BEWAAR = 24;

module.exports = (ctx) => {
  const { d, save, nu, meter, overzicht, dekking, periode } = ctx;

  const dagenIn = (p) => new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0)).getUTCDate();
  const dagNu = () => Number(String(nu()).slice(8, 10));

  function bak() {
    const k = d();
    if (!k.vooruitblik || typeof k.vooruitblik !== 'object') k.vooruitblik = {};
    return k.vooruitblik;
  }

  /* De projectie voor EEN drager, of voor het huis als er geen drager is. */
  function projectie(p, drager) {
    const per = meter.periodeVan(p);
    const lopend = per === meter.periodeVan();
    /* In MILLICENTEN rekenen en pas aan het eind afronden. Op hele centen valt
       een klein lid stil: een cent gedeeld door zesentwintig dagen maal
       eenendertig is weer een cent, en dan voorspelt de projectie niets. */
    const totNu = drager
      ? overzicht.voorDrager(per, drager).totaal
      : { centen: dekking.huis(per).kostenCenten, milliTotaal: dekking.huis(per).kostenCenten * 1000, graad: 'gemeten' };
    const milli = Number.isFinite(totNu.milliTotaal) ? totNu.milliTotaal : totNu.centen * 1000;
    const dagen = dagenIn(per);
    const voorbij = lopend ? Math.max(1, dagNu()) : dagen;
    const verwacht = lopend ? Math.round(milli / voorbij * dagen / 1000) : totNu.centen;
    return { periode: per, drager: drager || null, lopend,
      totNuCenten: totNu.centen, dagenVoorbij: voorbij, dagenInMaand: dagen,
      verwachtCenten: verwacht, graad: totNu.graad,
      zegtNiet: lopend
        ? 'Dit is het verbruik tot nu toe, recht doorgetrokken naar het eind van de maand. Een drukke laatste week zit er niet in.'
        : 'Deze maand is voorbij; dit is geen voorspelling meer maar de uitkomst.' };
  }

  /* De projectie van de LOPENDE maand vastleggen, hooguit een keer per dag.
     Heet niet `vastleggen`: die naam staat al in twee andere kernmodules en
     betekent daar iets anders (een reservering, een betaling). Een naam die in
     drie lagen iets anders doet, leest bij de vierde lezer fout. Dat
     is wat later de meting mogelijk maakt: zonder opgeschreven voorspelling valt
     er niets na te rekenen, en dan is elke bewering over trefzekerheid een
     herinnering. */
  function legVoorspellingVast() {
    const p = meter.periodeVan();
    const b = bak();
    const dag = dagNu();
    const r = b[p] || (b[p] = { dagen: {} });
    if (r.dagen[dag]) return { ok: true, overgeslagen: true, periode: p, dag };
    const pr = projectie(p, null);
    r.dagen[dag] = { verwachtCenten: pr.verwachtCenten, totNuCenten: pr.totNuCenten, op: nu() };
    /* Alleen de LAATSTE dag telt straks mee: dat is de voorspelling met de meeste
       informatie, en dus de eerlijkste om jezelf op af te rekenen. De eerdere
       dagen blijven staan om te kunnen zien hoe de schatting bewoog. */
    r.laatste = dag;
    for (const oud of Object.keys(b).sort().slice(0, Math.max(0, Object.keys(b).length - BEWAAR))) delete b[oud];
    save();
    return { ok: true, periode: p, dag, verwachtCenten: pr.verwachtCenten };
  }

  /* Hoe goed waren we? Alleen over maanden die VOORBIJ zijn en waarvan er een
     voorspelling is opgeschreven. Geeft `gemeten: false` met de reden zolang er
     te weinig zijn -- en dan staat er dus geen percentage. */
  function trefzekerheid() {
    const b = bak();
    const nuP = meter.periodeVan();
    const rijen = [];
    for (const p of Object.keys(b).sort()) {
      if (p >= nuP) continue;
      const r = b[p];
      const laatste = r && r.dagen && r.dagen[r.laatste];
      if (!laatste) continue;
      const werkelijk = dekking.huis(p).kostenCenten;
      if (!(werkelijk > 0)) continue;
      rijen.push({ periode: p, voorspeldCenten: laatste.verwachtCenten, werkelijkCenten: werkelijk,
        afwijkingPct: Math.round(Math.abs(laatste.verwachtCenten - werkelijk) / werkelijk * 1000) / 10,
        gesloten: !!(periode && periode.stand(p).stand === 'gesloten') });
    }
    if (rijen.length < MIN_MAANDEN) {
      return { gemeten: false, maanden: rijen.length, minimaal: MIN_MAANDEN, rijen,
        waarom: 'Er zijn ' + rijen.length + ' afgesloten maanden met een opgeschreven voorspelling; er zijn er ' +
          MIN_MAANDEN + ' nodig voordat hier een percentage mag staan. Tot dan is een bandbreedte een verzinsel met een decimaal.' };
    }
    const gem = rijen.reduce((a, r) => a + r.afwijkingPct, 0) / rijen.length;
    return { gemeten: true, maanden: rijen.length, gemiddeldeAfwijkingPct: Math.round(gem * 10) / 10, rijen,
      zegtNiet: 'Deze trefzekerheid is gemeten op het HUISTOTAAL over afgesloten maanden, niet op de rekening van een afzonderlijke gebruiker.' };
  }

  /* De projectie met de band eromheen -- en de band bestaat alleen als de
     trefzekerheid gemeten is. */
  function vooruitblik(p, drager) {
    const pr = projectie(p, drager);
    const tz = trefzekerheid();
    if (!tz.gemeten || !pr.lopend) return Object.assign(pr, { band: null, trefzekerheid: tz });
    const marge = Math.round(pr.verwachtCenten * tz.gemiddeldeAfwijkingPct / 100);
    return Object.assign(pr, {
      band: { vanCenten: Math.max(0, pr.verwachtCenten - marge), totCenten: pr.verwachtCenten + marge,
        opBasisVan: tz.maanden + ' afgesloten maanden', zegtNiet: tz.zegtNiet },
      trefzekerheid: tz });
  }

  return { projectie, vooruitblik, legVoorspellingVast, trefzekerheid, MIN_MAANDEN };
};
