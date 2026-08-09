/* RTG Life: het ene scherm. Een lid hoeft niet te weten of hij Doelen, Balans,
   Zorg of Vitaal moet openen; hij weet dat hij moe is of dat hij naar de kapper
   moet. Deze motor leest de bestaande lagen en zet ze naast elkaar.

   HIJ MEET NIETS ZELF. Er wordt hier geen enkel nieuw gegeven over het lid
   vastgelegd; alles komt uit een laag die het al had. Dat is met opzet: een
   overzicht dat zelf gaat bijhouden, wordt een tweede waarheid naast de laag
   waar het vandaan kwam.

   EN HIJ VERZINT GEEN CIJFERS. Voor slaap, beweging en voeding is er geen bron
   aangesloten, dus die staan er als "niet gemeten" -- niet als nul en niet als
   een score die ergens vandaan lijkt te komen. Het verschil tussen "geen
   gegevens" en "slecht" is bij welzijn geen detail (LAT.md regel 3). Een bron
   die stukgaat wordt om dezelfde reden zichtbaar gemeld en niet stil
   overgeslagen (regel 5).

   De lagen worden op AANROEPMOMENT uit de kern gepakt en niet bij het
   opstarten: deze motor hangt later in de bouw dan sommige lagen die hij leest,
   en een kopie op montagemoment zou undefined bevriezen. */

const DAG = 86400000;
const dagVan = d => new Date(d).toISOString().slice(0, 10);

/* Een signaal is of gemeten, of eerlijk niet gemeten. Er is geen derde vorm, en
   vooral geen nul die zich voordoet als een meting. */
const gemeten = (waarde, eenheid, uitleg) => ({ gemeten: true, waarde, eenheid, uitleg });
const ongemeten = reden => ({ gemeten: false, reden });

/* De bronnen die er (nog) niet zijn. Ze staan met naam op het scherm, want een
   lege plek zonder uitleg leest als een scherm dat stuk is, en een weggelaten
   regel leest als "hier valt niets te halen". */
const GEEN_BRON = [
  ['slaap', 'Slaap', 'Er is geen bron aangesloten die uw slaap meet.'],
  ['beweging', 'Beweging', 'Er is geen bron aangesloten die uw beweging meet.'],
  ['voeding', 'Voeding', 'Er is geen bron aangesloten die uw voeding bijhoudt.']
];

module.exports = ({ kern }) => {
  /* Elke laag apart aanroepen, en een kapotte laag als kapot melden in plaats
     van als leeg. Zonder deze vorm is "geen afspraken" niet te onderscheiden
     van "de zorglaag deed het niet". */
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { fout: 'De laag ' + naam + ' is niet aangesloten.' };
    try { return { waarde: fn() }; } catch (e) { return { fout: 'De laag ' + naam + ' gaf een fout.' }; }
  }

  function lifeVoor(key, codenaam, nu = new Date()) {
    const vandaag = dagVan(nu);
    const signalen = [];
    const storingen = [];

    /* ---- ritme: uit de agenda, via kern/balans.js ---- */
    /* kern.balans is een OBJECT (kern/balans.js hangt zichzelf zo op), terwijl
       doelen, care en de veiligheidskern hun functies plat in de kern zetten.
       Dat verschil kostte hier een storing: de toets meldde "de laag Balans is
       niet aangesloten" op een systeem waar Balans gewoon draaide. */
    const balans = lees('Balans', kern.balans && kern.balans.balansVoorLid
      && (() => kern.balans.balansVoorLid(codenaam, key, nu)));
    if (balans.fout) storingen.push(balans.fout);
    const beeld = balans.waarde && balans.waarde.beeld;
    signalen.push({
      id: 'ritme', naam: 'Ritme',
      ...(beeld
        ? gemeten(beeld.vrijeDagen, beeld.vrijeDagen === 1 ? 'lege dag deze week' : 'lege dagen deze week',
          beeld.avonden ? beeld.avonden + ' avonden staan al vol.' : 'Uw avonden zijn nog vrij.')
        : ongemeten('Uw agenda is niet te lezen.'))
    });

    /* ---- doelen: uit kern/doelen.js ---- */
    const dl = lees('Doelen', kern.doelenVan && (() => kern.doelenVan(key, nu)));
    if (dl.fout) storingen.push(dl.fout);
    const doelen = (dl.waarde && dl.waarde.doelen) || [];
    const lopend = doelen.filter(d => !d.gehaald);
    signalen.push({
      id: 'doelen', naam: 'Doelen',
      ...(doelen.length
        ? gemeten(lopend.length, lopend.length === 1 ? 'doel loopt' : 'doelen lopen',
          doelen.length - lopend.length ? (doelen.length - lopend.length) + ' gehaald.' : null)
        : ongemeten('U heeft nog geen doel staan.'))
    });

    /* ---- afspraken: zorg (kern/care) en verzorging (kern/verzorging) ---- */
    const zorg = lees('Zorg', kern.careMijn && (() => kern.careMijn(key)));
    const verz = lees('Verzorging', kern.verzorgingLeden && (() => kern.verzorgingLeden.mijn(codenaam)));
    if (zorg.fout) storingen.push(zorg.fout);
    if (verz.fout) storingen.push(verz.fout);
    const komend = []
      .concat(((zorg.waarde && zorg.waarde.boekingen) || [])
        .filter(b => b.datum >= vandaag)
        .map(b => ({ soort: 'zorg', wat: b.behandelingNaam, waar: b.aanbiederNaam, datum: b.datum, tijd: b.tijd })))
      .concat(((verz.waarde && verz.waarde.afspraken) || [])
        .filter(a => a.datum >= vandaag)
        .map(a => ({ soort: 'verzorging', wat: a.behandeling, waar: a.salon, datum: a.datum, tijd: a.van })))
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd));
    signalen.push({
      id: 'afspraken', naam: 'Afspraken',
      ...(komend.length
        ? gemeten(komend.length, komend.length === 1 ? 'afspraak staat klaar' : 'afspraken staan klaar',
          'De eerste is ' + komend[0].datum + '.')
        : ongemeten('Er staat niets gepland bij zorg of verzorging.'))
    });

    /* ---- de dagelijkse check-in: uit de veiligheidskern (Vitaal) ---- */
    const wacht = lees('Vitaal', kern.wachtenVan && (() => kern.wachtenVan(key)));
    if (wacht.fout) storingen.push(wacht.fout);
    const vitaal = ((wacht.waarde && wacht.waarde.lopend) || []).filter(w => w.soort === 'vitaal');
    signalen.push({
      id: 'checkin', naam: 'Check-in',
      ...(vitaal.length
        ? gemeten(vitaal.length, 'check-in loopt', 'Meldt u zich niet, dan krijgt uw kring bericht.')
        : ongemeten('U gebruikt de dagelijkse check-in niet.'))
    });

    for (const [id, naam, reden] of GEEN_BRON) signalen.push({ id, naam, ...ongemeten(reden) });

    return {
      ok: true, vandaag,
      signalen,
      doelen: lopend.slice(0, 4).map(d => ({ id: d.id, titel: d.titel, bericht: d.bericht,
        aandeel: d.aandeel, eenheid: d.eenheid })),
      afspraken: komend.slice(0, 4),
      adviezen: ((balans.waarde && balans.waarde.adviezen) || []).slice(0, 2),
      winst: winstVan({ beeld, lopend, komend, vandaag }),
      storingen
    };
  }

  return { lifeVoor };
};

/* "Waar valt vandaag het meeste te winnen." Alleen uit wat er ECHT is, en met
   een uitweg naar niets: een scherm dat elke dag iets dringends moet vinden,
   verzint het op den duur. Stilte is hier een geldige uitkomst. */
function winstVan({ beeld, lopend, komend, vandaag }) {
  const bijna = lopend.find(d => d.mijlpalen && d.mijlpalen.length &&
    new Date(d.mijlpalen[0].op) - new Date(vandaag) <= 3 * DAG);
  if (bijna) {
    return { kop: 'Uw eerstvolgende stap', tekst: bijna.titel + ': ' + bijna.bericht.replace(/^Volgende stap: /, '') };
  }
  const straks = komend.find(a => a.datum === vandaag || a.datum === dagVan(new Date(new Date(vandaag).getTime() + DAG)));
  if (straks) {
    return { kop: straks.datum === vandaag ? 'Vandaag' : 'Morgen',
      tekst: straks.wat + ' bij ' + straks.waar + ', ' + straks.tijd + '.' };
  }
  if (beeld && beeld.vrijeDagen === 0) {
    return { kop: 'Rust', tekst: 'Er staat de komende week geen enkele lege dag in uw agenda. Niks doen is ook een afspraak.' };
  }
  if (!lopend.length && (!beeld || beeld.vrijeDagen >= 5)) {
    return { kop: 'Rustig', tekst: 'Er is niets dat om uw aandacht vraagt. Wilt u ergens naartoe werken, dan begint dat bij Doelen.' };
  }
  return { kop: 'Rustig', tekst: 'Er is vandaag niets dat om uw aandacht vraagt.' };
}

module.exports.winstVan = winstVan;
