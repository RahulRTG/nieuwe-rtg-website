/* RTG Mall, deelbestand "vraagbeeld": WAT ER GEVRAAGD WORDT EN NIET GELEVERD.

   De Mall weet iets wat niemand anders weet: waar mensen naar zoeken en niets
   vinden. Dat is de eerlijkste vorm van marktinformatie die er is -- iemand
   heeft de moeite genomen het te vragen en kreeg niets terug. Voor een
   ondernemer is dat een kans, voor een stad een tekort, en voor de Mall zelf
   het antwoord op "wat missen we".

   ================== DE PRIVACYREGELS, EN WAAROM ==================

   Bijhouden waar mensen naar zoeken is precies het soort ding dat je verkeerd
   kunt bouwen. Vier regels, en ze staan hier niet als belofte maar als code:

   1. GEEN SLEUTEL. Er wordt nergens bijgehouden WIE iets zocht. Geen
      lidsleutel, geen codenaam, geen sessie, geen IP. Een teller per woord per
      plaats per week, en verder niets. Wie zoekprofielen wil bouwen kan dat met
      deze gegevens niet, ook niet achteraf.
   2. LOSSE WOORDEN, GEEN ZINNEN. Er wordt per WOORD geteld, niet per
      zoekopdracht. "kinderstoel huren voor de bruiloft van mijn zus" is als
      zin herkenbaar; als vier losse woorden in een weekteller is dat niemand
      meer. Dit is de belangrijkste van de vier.
   3. EEN DREMPEL VOOR HET NAAR BUITEN KOMT. Een woord wordt pas getoond -- aan
      een ondernemer of aan het kantoor -- als het minstens DREMPEL keer is
      gezocht. Wat een enkeling zocht blijft binnen.
   4. HET VERVALT. Alleen de laatste WEKEN weken blijven staan. Een vraagbeeld
      is bedoeld om op te handelen, niet om een geschiedenis van een stad aan te
      leggen.

   Wat er OOK niet in gaat: cijfers, e-mailadressen, en woorden die te lang zijn
   om een gewoon zoekwoord te zijn. Die dragen het meeste risico en het minste
   nut.

   ================== DE LUS ==================

   Mensen zoeken -> de Mall ziet een tekort -> de Kansenlaag van het
   stadsweefsel (kern/stadsweefsel/kansen.js) ziet een ondernemerskans -> een
   ondernemer begint -> zijn aanbod staat automatisch in de Mall -> het tekort
   wordt kleiner. Die laatste stap is geen belofte: het aanbod van elke nieuwe
   zaak komt via kern/mall/aanbod.js vanzelf in dezelfde zoekmachine terecht. */

const DREMPEL = 5;      // zo vaak moet een woord gezocht zijn voor het naar buiten komt
const WEKEN = 8;        // zo lang blijft een week staan
const MAX_WOORDEN = 6;  // per zoekopdracht; een zin van twintig woorden is geen zoekopdracht

// het weeknummer als ISO-achtige sleutel; puur zodat oude weken weg kunnen
function weekVan(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - jan1) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

/* Mag dit woord worden geteld? Geen cijfers (huisnummers, telefoonnummers,
   bedragen), geen adresachtige tekens, en een gewone woordlengte. */
function telbaar(w) {
  const t = String(w || '');
  if (t.length < 3 || t.length > 24) return false;
  if (!/^[a-zà-ÿ]+$/.test(t)) return false;
  return true;
}

module.exports = (ctx) => {
  const { db, save } = ctx;
  const { VERDIEPINGEN } = require('./aanbodvorm');

  function bak() {
    if (!db.data.mallVraag || typeof db.data.mallVraag !== 'object') db.data.mallVraag = { weken: {} };
    if (!db.data.mallVraag.weken) db.data.mallVraag.weken = {};
    return db.data.mallVraag;
  }
  // oude weken opruimen; een vraagbeeld is om op te handelen, niet om te bewaren
  function veeg(v) {
    const weken = Object.keys(v.weken).sort();
    while (weken.length > WEKEN) delete v.weken[weken.shift()];
  }

  /* Noteren. Wordt alleen aangeroepen vanuit een ECHTE zoekopdracht van een
     mens (de route zet `noteer`), nooit vanuit een interne aanroep -- anders
     telt de Mall zijn eigen verkeer mee en wijst het vraagbeeld naar binnen. */
  function noteerVraag({ woorden, verdieping, plek, treffers }) {
    const lijst = (woorden || []).filter(telbaar).slice(0, MAX_WOORDEN);
    if (!lijst.length) return { ok: true, geteld: 0 };
    const v = bak();
    const week = weekVan(new Date());
    if (!v.weken[week]) v.weken[week] = {};
    const vak = v.weken[week];
    const plaats = plek || '';
    for (const w of lijst) {
      const sleutel = plaats + '|' + w;
      const r = vak[sleutel] || (vak[sleutel] = { woord: w, plek: plaats || null, verdieping: verdieping || null, n: 0, gevonden: 0, leeg: 0 });
      r.n++;
      r.gevonden += Math.max(0, Number(treffers) || 0);
      if (!treffers) r.leeg++;
      if (verdieping && !r.verdieping) r.verdieping = verdieping;
    }
    veeg(v);
    save();
    return { ok: true, geteld: lijst.length, week };
  }

  // alle rijen over de bewaarde weken heen, opgeteld
  function opgeteld() {
    const v = bak();
    const per = new Map();
    for (const week of Object.keys(v.weken)) {
      for (const r of Object.values(v.weken[week])) {
        const s = (r.plek || '') + '|' + r.woord;
        const b = per.get(s) || { woord: r.woord, plek: r.plek, verdieping: r.verdieping, n: 0, gevonden: 0, leeg: 0 };
        b.n += r.n; b.gevonden += r.gevonden; b.leeg += r.leeg;
        if (r.verdieping && !b.verdieping) b.verdieping = r.verdieping;
        per.set(s, b);
      }
    }
    return [...per.values()];
  }

  /* Een tekort: vaak gezocht, weinig gevonden. `gemiddeld` is het gemiddelde
     aantal treffers per zoekopdracht; onder de 1 betekent dat de meeste mensen
     met lege handen wegliepen. */
  function tekorten(plekSlug) {
    return opgeteld()
      .filter(r => r.n >= DREMPEL)
      .filter(r => !plekSlug || r.plek === plekSlug)
      .map(r => ({
        woord: r.woord, plek: r.plek, verdieping: r.verdieping,
        gezocht: r.n, zonderResultaat: r.leeg,
        gemiddeld: Math.round((r.gevonden / r.n) * 10) / 10
      }))
      .filter(r => r.gemiddeld < 1)
      .sort((a, b) => b.gezocht - a.gezocht || a.woord.localeCompare(b.woord));
  }

  /* Wat een zaak te zien krijgt: de woorden uit haar eigen vak en haar eigen
     plaats, boven de drempel. Geen bezoekersaantallen en geen conversie -- dit
     zegt wat mensen zochten, niet wat zij deden. */
  function vraagVoorZaak(s) {
    const { GENRE_VERDIEPING } = require('./aanbodvorm');
    const mijnVak = GENRE_VERDIEPING[s.type] || null;
    const mijnPlek = ctx.plek.plekVan({ stad: s.city, land: s.country }).slug;
    const rijen = opgeteld()
      .filter(r => r.n >= DREMPEL)
      .filter(r => !r.plek || r.plek === mijnPlek)
      .filter(r => !mijnVak || !r.verdieping || r.verdieping === mijnVak)
      .sort((a, b) => b.n - a.n)
      .slice(0, 20)
      .map(r => ({ woord: r.woord, gezocht: r.n, gemiddeld: Math.round((r.gevonden / r.n) * 10) / 10 }));
    return {
      zoekwoorden: rijen,
      drempel: DREMPEL, weken: WEKEN,
      opmerking: 'Woorden waarmee mensen in uw vak en uw plaats zochten. Geteld per woord, nooit per persoon, en pas zichtbaar vanaf ' + DREMPEL + ' keer.'
    };
  }

  /* Het beeld voor het kantoor en de Kansenlaag: waar wordt naar gevraagd en
     niets gevonden. Per verdieping gebundeld, zodat er een ondernemersvraag
     uit te lezen valt in plaats van een woordenlijst. */
  function kansen(plekSlug) {
    const t = tekorten(plekSlug);
    const perVak = new Map();
    for (const r of t) {
      const id = r.verdieping || 'onbekend';
      const b = perVak.get(id) || { verdieping: id, label: (VERDIEPINGEN.find(v => v.id === id) || {}).label || 'Onbekend', woorden: [], gezocht: 0 };
      b.woorden.push(r.woord); b.gezocht += r.gezocht;
      perVak.set(id, b);
    }
    return {
      ok: true,
      tekorten: t.slice(0, 50),
      perVerdieping: [...perVak.values()].sort((a, b) => b.gezocht - a.gezocht)
        .map(b => ({ ...b, woorden: b.woorden.slice(0, 8) })),
      drempel: DREMPEL, weken: WEKEN,
      privacy: 'Per woord geteld, nooit per persoon; alleen woorden die minstens ' + DREMPEL + ' keer zijn gezocht, en alleen over de laatste ' + WEKEN + ' weken.',
      lus: 'Een tekort hier is een ondernemerskans in het stadsweefsel; begint er een zaak, dan staat haar aanbod vanzelf in dezelfde zoekmachine.'
    };
  }

  const api = { noteer: noteerVraag, tekorten, voorZaak: vraagVoorZaak, kansen, opgeteld, DREMPEL, WEKEN };
  ctx.vraagbeeld = api;
  return { mallVraagbeeld: api };
};

module.exports.DREMPEL = DREMPEL;
module.exports.WEKEN = WEKEN;
module.exports.telbaar = telbaar;
module.exports.weekVan = weekVan;
