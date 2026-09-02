/* ============================================================================
   DE ARENA VAN EEN APP -- een ranglijst PER APP, en nooit die van het huis.

   BESLOTEN 31 AUGUSTUS 2026. Een spel in de App Store mag een score bewaren.
   Dat is nieuw voor dit kanaal, en het is de eerste keer dat er via de brug iets
   naar buiten gaat dat een ANDER lid kan zien. Daarom staat het in een eigen
   bestand, met zijn grenzen erboven in plaats van in een document ernaast.

   VIER GRENZEN, EN ELK VAN DE VIER KOMT UIT EEN REGEL DIE DIT HUIS AL HAD.

   1. EEN BORD PER APP, NOOIT DAT VAN DE ARENA. De ranglijsten van RTG zelf
      (kern/spellen/) worden gevuld door code die wij hebben geschreven; hier
      stuurt een DERDE het getal in. Die twee bij elkaar zetten maakt de
      ranglijst van het huis precies zo betrouwbaar als de minst betrouwbare app
      erin. Het bord hoort bij de app: verdwijnt de app, dan verdwijnt het bord
      (`wisApp`). Een ingetrokken VERSIE laat het staan -- net als de opslag van
      een lid, want de volgende versie is dezelfde app.

   2. DE 18+-POORT IS DEZELFDE POORT, en hij wordt hier niet nagebouwd:
      `progressieMag` uit kern/spellen/grens.js, die `volwassen()` leest. Zou
      hier een tweede leeftijdsregel staan, dan is de vraag "wat wordt er van een
      kind bewaard" op twee plekken te beantwoorden (LAT-regel 4).

   3. ONDER DE GRENS SPEELT HET SPEL GEWOON DOOR. Een score van een lid dat de
      poort niet haalt, is GEEN fout: de brug antwoordt `bewaard: false` met de
      reden, precies zoals kern/spellen/arcade.js dat al doet. Een spel dat
      stukgaat omdat een kind het speelt, straft het kind voor onze regel.

   4. OP HET BORD STAAN ALLEEN MENSEN DIE ZELF MEEDEDEN. Een codenaam van een
      ander is hier het enige wat een app te zien krijgt dat niet van de speler
      zelf is. Daarom staat er niemand op die niet zelf, in deze app, met deze
      machtiging een score heeft ingestuurd -- meedoen IS het akkoord. Er komt
      geen ledenlijst, geen zoekfunctie en geen "wie speelt dit ook".

   WAT DE APP NIET BEPAALT: wie er wint. De richting (is hoog goed, of laag?) en
   de eenheid staan in het MANIFEST en gaan dus door de keuring langs een mens.
   Zou de app ze per aanroep meesturen, dan kan hij het bord omdraaien zodra hij
   verliest.
   ========================================================================== */
'use strict';

const BORD_MAX = 20;          // wat een bord toont; wie er niet op staat krijgt zijn eigen positie
const SCORE_MAX = 1e12;       // een getal, geen wetenschappelijke notatie en geen oneindig

/* De week waarin een score valt. Een bord "deze week" is er omdat een
   ranglijst-voor-altijd na drie maanden hetzelfde is als geen ranglijst: wie
   later begint, komt er nooit meer op. Hij wordt AFGELEID uit het tijdstip en
   niet apart bijgehouden, zodat hij niet kan achterlopen. */
function weekVan(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '?';
  const dag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const nr = (dag.getUTCDay() + 6) % 7;                 // maandag = 0
  dag.setUTCDate(dag.getUTCDate() - nr + 3);            // de donderdag van deze week
  const eerste = new Date(Date.UTC(dag.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dag - eerste) / 86400000 - 3 + ((eerste.getUTCDay() + 6) % 7)) / 7);
  return dag.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function maakArena({ S, save, nu, progressieMag, GEEN_PROGRESSIE, versieVan }) {
  /* De inzendingen van een app. Ze staan onder de APPSLEUTEL en niet onder het
     lid: een bord hoort bij een app, en het verdwijnt met die app. */
  function pot(sleutel) {
    const s = S();
    if (!s.arena || typeof s.arena !== 'object') s.arena = {};
    if (!s.arena[String(sleutel)] || typeof s.arena[String(sleutel)] !== 'object') s.arena[String(sleutel)] = {};
    return s.arena[String(sleutel)];
  }

  /* De vorm van het bord komt uit het manifest van de LIVE versie -- door de
     keuring, afgetekend door een mens. Ontbreekt hij, dan is hoog goed en heet
     het "punten"; dat is een keuze en geen aanname, en hij staat in de uitvoer
     zodat een app kan zien waar hij op speelt. */
  function vorm(sleutel) {
    const v = versieVan ? versieVan(sleutel) : null;
    const a = v && v.manifest && v.manifest.arena ? v.manifest.arena : null;
    return { richting: a && a.richting === 'laag' ? 'laag' : 'hoog',
      eenheid: (a && a.eenheid) || 'punten',
      uitManifest: !!a };
  }

  const beterDan = (richting) => (a, b) => (richting === 'laag' ? a - b : b - a);

  /* Een score insturen. Twee uitkomsten die allebei `ok` zijn: bewaard, of niet
     bewaard met de reden. De derde -- een fout -- bestaat alleen bij een getal
     dat geen getal is. */
  function zet(ctx, args) {
    const score = Number(args && args.score);
    if (!Number.isFinite(score) || score < 0 || score > SCORE_MAX) {
      return { fout: 'Een score is een getal van 0 tot ' + SCORE_MAX + '.' };
    }
    const v = vorm(ctx.sleutel);
    if (!progressieMag(ctx.key)) {
      /* GEEN FOUT. Het spel speelt door; er wordt alleen niets bewaard. */
      return { bewaard: false, ranglijst: false, reden: GEEN_PROGRESSIE, vorm: v };
    }
    const p = pot(ctx.sleutel);
    const rij = p[String(ctx.key)] || (p[String(ctx.key)] = { beste: null, at: null, n: 0, codenaam: null, week: null, weekBeste: null });
    const t = nu();
    const w = weekVan(t);
    rij.n += 1;
    rij.codenaam = ctx.codenaam || rij.codenaam;
    if (rij.week !== w) { rij.week = w; rij.weekBeste = null; }
    const beter = (oud) => oud == null || beterDan(v.richting)(score, oud) < 0;
    const nieuwPersoonlijk = beter(rij.beste);
    if (nieuwPersoonlijk) { rij.beste = score; rij.at = t; }
    if (beter(rij.weekBeste)) rij.weekBeste = score;
    save();
    return { bewaard: true, ranglijst: true, score, persoonlijkRecord: nieuwPersoonlijk,
      beste: rij.beste, positie: positieVan(ctx.sleutel, ctx.key, 'altijd'), vorm: v };
  }

  /* De gesorteerde deelnemers van een periode. `altijd` telt de beste ooit,
     `week` alleen wat er deze week is neergezet -- en dat tweede bestaat omdat
     een lijst voor altijd na een half jaar niemand meer laat meedoen. */
  function rangen(sleutel, periode) {
    const p = pot(sleutel);
    const v = vorm(sleutel);
    const nuWeek = weekVan(nu());
    const uit = [];
    for (const key of Object.keys(p)) {
      const r = p[key];
      const s = periode === 'week' ? (r.week === nuWeek ? r.weekBeste : null) : r.beste;
      if (s == null) continue;
      uit.push({ key, score: s, at: r.at, codenaam: r.codenaam || 'onbekend' });
    }
    uit.sort((a, b) => beterDan(v.richting)(a.score, b.score));
    return uit;
  }

  function positieVan(sleutel, key, periode) {
    const lijst = rangen(sleutel, periode);
    const i = lijst.findIndex(r => r.key === String(key));
    return i === -1 ? null : i + 1;
  }

  /* Het bord. De SLEUTEL van een lid gaat er nooit uit -- alleen zijn codenaam
     en zijn plaats. Wie zelf buiten de eerste twintig valt, krijgt zijn eigen
     regel er apart bij: een ranglijst waarop je jezelf niet ziet, is een
     ranglijst die je niet leest. */
  function bord(ctx, args) {
    const periode = (args && args.periode) === 'week' ? 'week' : 'altijd';
    const v = vorm(ctx.sleutel);
    if (!progressieMag(ctx.key)) {
      return { bord: [], ranglijst: false, reden: GEEN_PROGRESSIE, periode, vorm: v };
    }
    const lijst = rangen(ctx.sleutel, periode);
    const mij = positieVan(ctx.sleutel, ctx.key, periode);
    return {
      periode, vorm: v, deelnemers: lijst.length, ranglijst: true,
      bord: lijst.slice(0, BORD_MAX).map((r, i) => ({ plaats: i + 1, codenaam: r.codenaam, score: r.score, ik: r.key === String(ctx.key) })),
      ik: mij == null ? null : { plaats: mij, buitenBord: mij > BORD_MAX,
        score: lijst[mij - 1].score }
    };
  }

  /* Alleen over jezelf: je beste, je aantal pogingen, je plaats. Dit is de enige
     arena-methode die ook iets zinnigs kan zeggen zonder ranglijst -- maar niet
     zonder de poort, want een bewaarde score IS de progressie die de grens
     bedoelt. */
  function mijn(ctx) {
    const v = vorm(ctx.sleutel);
    if (!progressieMag(ctx.key)) return { beste: null, ranglijst: false, reden: GEEN_PROGRESSIE, vorm: v };
    const r = pot(ctx.sleutel)[String(ctx.key)] || null;
    return { vorm: v, ranglijst: true, beste: r ? r.beste : null, pogingen: r ? r.n : 0,
      sinds: r ? r.at : null, plaats: positieVan(ctx.sleutel, ctx.key, 'altijd'),
      plaatsDezeWeek: positieVan(ctx.sleutel, ctx.key, 'week') };
  }

  /* Een app die VERDWIJNT, neemt zijn bord mee. Dat is grens 1 in uitvoering:
     het bord is van de app en niet van het huis. Een ingetrokken versie valt
     hier niet onder -- die komt terug, en dan hoort het bord er nog te zijn. */
  function wisApp(sleutel) {
    const s = S();
    if (s.arena && Object.prototype.hasOwnProperty.call(s.arena, String(sleutel))) {
      delete s.arena[String(sleutel)]; save();
    }
  }

  /* En een lid dat zijn opslag wist, wist ook zijn plaats. Zou dat niet zo zijn,
     dan blijft er een score met een codenaam staan van iemand die alles heeft
     laten verwijderen. */
  function wisLid(sleutel, key) {
    const p = pot(sleutel);
    if (Object.prototype.hasOwnProperty.call(p, String(key))) { delete p[String(key)]; save(); }
  }

  return { zet, bord, mijn, wisApp, wisLid, weekVan, BORD_MAX };
}

module.exports = { maakArena, weekVan, BORD_MAX };
