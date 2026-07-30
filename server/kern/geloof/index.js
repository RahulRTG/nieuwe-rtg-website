/* De geloofslaag rond een lid: wat het zelf heeft aangegeven, wat dat vandaag
   betekent, en hoe Rahul daar rekening mee houdt.

   Twee regels die alles bepalen:

   1. RAHUL RAADT NOOIT. Hij leidt geen geloof af uit een naam, een land, een
      taal of een gewoonte. Er staat een keuze in het profiel of er staat er
      geen. Dat is respectvol en het is ook eenvoudig.
   2. WAT ER STAAT, IS VAN HET LID. De keuze is optioneel, is per stuk uit te
      zetten, en verlaat het huis niet. Gebedstijden worden hier uitgerekend,
      niet elders opgehaald (zie ./tijden.js voor waarom dat uitmaakt).

   Wie niets invult merkt hier helemaal niets van, en dat is geen tweederangs
   ervaring maar precies hetzelfde huis. */
const tijden = require('./tijden');
const feesten = require('./feesten');

/* De tradities zoals ze in het profiel staan. Bewust een vlakke lijst zonder
   volgorde van belangrijkheid, met "geen" er gewoon tussen. */
const KEUZES = [
  { id: 'islam', naam: 'Islam' },
  { id: 'christendom', naam: 'Christendom' },
  { id: 'jodendom', naam: 'Jodendom' },
  { id: 'hindoeisme', naam: 'Hindoeisme' },
  { id: 'boeddhisme', naam: 'Boeddhisme' },
  { id: 'sikhisme', naam: 'Sikhisme' },
  { id: 'nowruz', naam: 'Nowruz en Perzische feesten' },
  { id: 'anders', naam: 'Anders, zeg ik zelf' },
  { id: 'geen', naam: 'Geen, of liever niet zeggen' }
];

module.exports = ({ accounts }) => {

  /* Het geloofsdeel van een profiel. Alles optioneel; niets ingevuld is een
     geldig antwoord. */
  function profielVan(userId) {
    const md = (userId != null && accounts.getMemberState(userId)) || {};
    const g = md.geloof || {};
    return {
      tradities: Array.isArray(g.tradities) ? g.tradities.filter(t => KEUZES.some(k => k.id === t)) : [],
      feestdagen: g.feestdagen !== false,          // felicitaties aan/uit
      gebed: g.gebed === true,                     // gebedstijden tonen
      methode: g.methode || 'mwl',
      asr: g.asr === 'hanafi' ? 'hanafi' : 'standaard',
      eigen: String(g.eigen || '').slice(0, 120)   // "anders, zeg ik zelf"
    };
  }

  function profielZet(userId, body) {
    const md = accounts.getMemberState(userId) || {};
    const oud = md.geloof || {};
    md.geloof = {
      tradities: (Array.isArray(body.tradities) ? body.tradities : [])
        .filter(t => KEUZES.some(k => k.id === t)).slice(0, 4),
      feestdagen: body.feestdagen !== false,
      gebed: body.gebed === true,
      methode: tijden.METHODES[body.methode] ? body.methode : (oud.methode || 'mwl'),
      asr: body.asr === 'hanafi' ? 'hanafi' : 'standaard',
      eigen: String(body.eigen || '').replace(/[<>]/g, '').slice(0, 120)
    };
    accounts.saveMemberState(userId, md);
    return { status: 200, ok: true, geloof: profielVan(userId) };
  }

  /* Wat er vandaag speelt. `plek` is optioneel; zonder plek geen gebedstijden
     en geen qibla, want die bestaan niet zonder te weten waar je staat. */
  function vandaagVoor(userId, plek) {
    const p = profielVan(userId);
    const uit = { tradities: p.tradities, feesten: [], gebed: null, qibla: null };
    if (!p.tradities.length) return uit;

    if (p.feestdagen) {
      uit.feesten = feesten.feestenRond(p.tradities, new Date(), 40);
      uit.vandaag = uit.feesten.filter(f => f.overDagen === 0);
      // De avond ervoor telt mee: wie op de dag zelf feliciteert is te laat.
      uit.vanavond = uit.feesten.filter(f => f.overDagen === 1 && f.avondErvoor);
    }

    if (p.gebed && plek && Number.isFinite(plek.lat) && Number.isFinite(plek.lon)) {
      uit.gebed = tijden.gebedstijden(plek.lat, plek.lon, new Date(), { methode: p.methode, asr: p.asr });
      const graden = tijden.qibla(plek.lat, plek.lon);
      uit.qibla = {
        graden: Math.round(graden * 10) / 10,
        streek: tijden.streek(graden),
        afstandKm: tijden.afstandMekka(plek.lat, plek.lon),
        uitleg: 'Richting vanaf het noorden, over de kortste weg om de aarde. Houd uw telefoon vlak; ' +
          'het kompas van een toestel wijkt binnenshuis makkelijk af.'
      };
    }
    return uit;
  }

  /* De regel die in de system prompt belandt. Kort houden: de prompt is al
     lang, en dit is context, geen instructie om over te gaan preken. */
  function promptRegel(userId, plek) {
    const p = profielVan(userId);
    if (!p.tradities.length) {
      return 'Dit lid heeft geen geloof of levensbeschouwing opgegeven. Ga daar dus nergens van uit, ' +
        'raad het niet uit naam, land of taal, en begin er niet zelf over.';
    }
    const d = vandaagVoor(userId, plek);
    const stukken = ['Dit lid heeft zelf aangegeven: ' + p.tradities.join(', ') +
      (p.eigen ? ' (' + p.eigen + ')' : '') +
      '. Houd daar rustig rekening mee (eten, vasten, feestdagen, planning) zonder er een thema van te maken ' +
      'en zonder ooit iets voor te schrijven; jij bent geen geestelijke.'];
    if (d.vandaag && d.vandaag.length)
      stukken.push('VANDAAG is het ' + d.vandaag.map(f => f.naam).join(' en ') + '. Feliciteer daar warm en kort mee' +
        (d.vandaag[0].groet ? ' (bijvoorbeeld: "' + d.vandaag[0].groet + '")' : '') + ', in je eigen woorden, aan het begin van het gesprek.');
    if (d.vanavond && d.vanavond.length)
      stukken.push('VANAVOND begint ' + d.vanavond.map(f => f.naam).join(' en ') + ' (die dag begint bij zonsondergang).');
    const straks = (d.feesten || []).find(f => f.overDagen > 1 && f.overDagen <= 7);
    if (straks) stukken.push('Over ' + straks.overDagen + ' dagen is het ' + straks.naam + '; noem dat alleen als het past bij de planning.');
    if (d.gebed) stukken.push('Gebedstijden vandaag op de plek van het lid (' + d.gebed.methode + '): fajr ' +
      (d.gebed.fajr && d.gebed.fajr.tekst) + ', dhuhr ' + (d.gebed.dhuhr && d.gebed.dhuhr.tekst) + ', asr ' +
      (d.gebed.asr && d.gebed.asr.tekst) + ', maghrib ' + (d.gebed.maghrib && d.gebed.maghrib.tekst) + ', isha ' +
      (d.gebed.isha && d.gebed.isha.tekst) + ' (UTC; reken om naar de plaatselijke tijd). ' +
      'Gebruik dit om afspraken en reizen eromheen te plannen. Dring nooit aan en herinner alleen als het lid erom vraagt.');
    if (d.qibla) stukken.push('De richting van Mekka vanaf hier is ' + d.qibla.graden + ' graden (' + d.qibla.streek + '), ' +
      d.qibla.afstandKm + ' km hemelsbreed.');
    return stukken.join(' ');
  }

  return { KEUZES, profielVan, profielZet, vandaagVoor, promptRegel, tijden, feesten };
};
