/* De dagcoach: wat er vandaag staat, op volgorde van de klok.

   HIJ PLANT NIETS, EN DAT IS EEN KEUZE. Een coach die uw dag indeelt -- ontbijt
   half acht, wandeling om elf uur, training om zes uur -- moet weten hoeveel
   energie u heeft, wat er buiten RTG in uw dag staat, wanneer u kinderen ophaalt
   en wat u lekker vindt. Daarvan weet RTG niets. Een dagindeling verzinnen uit
   wat RTG toevallig wel weet, levert een zelfverzekerd verkeerd plan, en dat is
   erger dan geen plan: het ziet er even goed uit.

   Wat hij daarom WEL doet: alles wat u vandaag al ergens heeft staan op een rij
   zetten, op volgorde van de klok, met bij elke regel waar hij vandaan komt en
   waar u hem afhandelt. Hij bezit niets. Er wordt hier geen enkel gegeven
   vastgelegd en niets afgetekend -- aftekenen gebeurt in de laag die het ding
   bezit (LAT.md regel 4), anders liggen er twee waarheden over dezelfde dag.

   GEEN SCORE. Er staat hoeveel er nog open is, want dat is een aantal dingen.
   Er staat NERGENS "vier van de zeven" en er is geen balk die vol loopt: dat
   maakt van een dag een cijfer, en van een rustige dag een slechte.

   Een lege dag is een geldige uitkomst en geen leeg scherm. Een laag die het
   niet doet wordt gemeld en niet stil overgeslagen (regel 5). */

const dagVan = d => new Date(d).toISOString().slice(0, 10);

/* Waar een regel vandaan komt, en waar het lid hem afhandelt. Deze lijst is de
   enige plek waar een bron een naam en een bestemming krijgt. */
const BRONNEN = {
  medicijnen: { naam: 'Medicijnen', naar: '/apps/medicijnen.html' },
  zorg: { naam: 'Zorg', naar: '/apps/app.html' },
  verzorging: { naam: 'Verzorging', naar: '/apps/app.html' },
  gewoonten: { naam: 'Gewoonten', naar: '/apps/life.html' },
  metingen: { naam: 'Vandaag invullen', naar: '/apps/life.html' },
  checkin: { naam: 'Hoe zit u erbij', naar: '/apps/life.html' }
};

module.exports = ({ kern }) => {
  /* Zelfde vorm als kern/life.js: elke laag apart, en kapot is niet leeg. */
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { fout: 'De laag ' + naam + ' is niet aangesloten.' };
    try { return { waarde: fn() }; } catch (e) { return { fout: 'De laag ' + naam + ' gaf een fout.' }; }
  }

  function dagVoor(key, codenaam, nu = new Date()) {
    const vandaag = dagVan(nu);
    const klok = nu.toISOString().slice(11, 16);
    const punten = [];
    const storingen = [];
    const punt = (p) => punten.push({ ...p, ...BRONNEN[p.bron],
      geweest: p.tijd ? p.tijd <= klok : false });

    /* ---- medicijnen: de enige regels met een echte kloktijd van het lid ---- */
    const med = lees('Medicijnen', kern.medicatieVan && (() => kern.medicatieVan(key, nu)));
    if (med.fout) storingen.push(med.fout);
    for (const m of (med.waarde && med.waarde.vandaag) || []) {
      punt({ bron: 'medicijnen', tijd: m.moment, gedaan: m.afgetekend,
        wat: m.naam + (m.sterkte ? ' ' + m.sterkte : ''),
        /* Geen "neem dit in": dat is een doseerinstructie en daar gaat RTG niet
           over (zie kern/medicatie.js). */
        uitleg: m.afgetekend ? 'Afgetekend.' : 'Staat in uw schema.' });
    }

    /* ---- afspraken van vandaag: zorg en verzorging ---- */
    const zorg = lees('Zorg', kern.careMijn && (() => kern.careMijn(key)));
    const verz = lees('Verzorging', kern.verzorgingLeden && (() => kern.verzorgingLeden.mijn(codenaam)));
    if (zorg.fout) storingen.push(zorg.fout);
    if (verz.fout) storingen.push(verz.fout);
    for (const b of ((zorg.waarde && zorg.waarde.boekingen) || []).filter(b => b.datum === vandaag)) {
      punt({ bron: 'zorg', tijd: b.tijd, gedaan: false, wat: b.behandelingNaam, uitleg: 'Bij ' + b.aanbiederNaam + '.' });
    }
    for (const a of ((verz.waarde && verz.waarde.afspraken) || []).filter(a => a.datum === vandaag)) {
      punt({ bron: 'verzorging', tijd: a.van, gedaan: false, wat: a.behandeling, uitleg: 'Bij ' + a.salon + '.' });
    }

    /* ---- wat geen tijd heeft: gewoonten, metingen, de check-in ----
       Ze krijgen er ook geen. Een gewoonte om kwart over drie zetten omdat het
       schema dan leeg is, is precies het verzinnen waar dit bestand niet aan
       doet. Ze staan onderaan, als "ergens vandaag". */
    const gw = lees('Gewoonten', kern.gewoontenVan && (() => kern.gewoontenVan(key, nu)));
    if (gw.fout) storingen.push(gw.fout);
    for (const g of (gw.waarde && gw.waarde.gewoonten) || []) {
      if (g.status && g.status !== 'loopt') continue;
      punt({ bron: 'gewoonten', tijd: null, gedaan: !!g.vandaagGedaan, wat: g.naam,
        uitleg: g.waarom || 'Iets dat u vaker wilde doen.' });
    }

    const mt = lees('Metingen', kern.metingenVan && (() => kern.metingenVan(key, nu)));
    if (mt.fout) storingen.push(mt.fout);
    const onderwerpen = (mt.waarde && mt.waarde.onderwerpen) || {};
    const beeld = (mt.waarde && mt.waarde.beeld) || {};
    for (const [id, def] of Object.entries(onderwerpen)) {
      punt({ bron: 'metingen', tijd: null, gedaan: (beeld[id] || {}).vandaag != null,
        wat: def.label, uitleg: def.vraag });
    }

    const gm = lees('Check-in', kern.gemoedVan && (() => kern.gemoedVan(key, nu)));
    if (gm.fout) storingen.push(gm.fout);
    if (gm.waarde) {
      punt({ bron: 'checkin', tijd: null, gedaan: !!gm.waarde.vandaagIngevuld,
        wat: 'Hoe zit u erbij', uitleg: 'Een tik, meer hoeft niet.' });
    }

    /* Met tijd eerst, op de klok; daarna wat geen tijd heeft, in de volgorde
       waarin het binnenkwam. */
    punten.sort((a, b) => {
      if (a.tijd && b.tijd) return a.tijd.localeCompare(b.tijd);
      if (a.tijd) return -1;
      if (b.tijd) return 1;
      return 0;
    });

    const open = punten.filter(p => !p.gedaan).length;
    return {
      ok: true, vandaag, klok, punten, open,
      kop: kopVan(punten, open),
      /* Rust komt uit kern/balans.js en niet uit dit bestand: als de agenda zegt
         dat er deze week geen lege dag is, mag dat hier staan. Verzinnen doet
         hij het niet. */
      rust: rustVan(kern, codenaam, key, nu, punten, storingen),
      uitleg: 'RTG deelt uw dag niet in. Dit is wat u zelf al ergens heeft staan, '
        + 'op volgorde van de klok. Afvinken doet u in de app waar het thuishoort.',
      storingen
    };
  }

  return { dagVoor };
};

/* De zin bovenaan. Alleen uit wat er ECHT staat, met een uitweg naar niets:
   een scherm dat elke dag iets moet vinden, verzint het op den duur. */
function kopVan(punten, open) {
  if (!punten.length) return 'Er staat vandaag niets. Dat is ook een dag.';
  if (!open) return 'Alles wat er vandaag stond, is gedaan.';
  const eerste = punten.find(p => !p.gedaan && p.tijd && !p.geweest);
  if (eerste) return 'Om ' + eerste.tijd + ': ' + eerste.wat + '.';
  return open === 1 ? 'Er staat nog een ding open.' : 'Er staan nog ' + open + ' dingen open.';
}

/* Een lege dag mag zo blijven, maar alleen als de agenda dat zegt. */
function rustVan(kern, codenaam, key, nu, punten, storingen) {
  let bl;
  try { bl = kern.balans && kern.balans.balansVoorLid && kern.balans.balansVoorLid(codenaam, key, nu); }
  catch (e) { storingen.push('De laag Balans gaf een fout.'); return null; }
  const beeld = bl && bl.beeld;
  if (!beeld) return null;
  if (beeld.vrijeDagen === 0) {
    return 'Er staat deze week geen enkele lege dag in uw agenda. Niks doen is ook een afspraak.';
  }
  if (!punten.some(p => p.tijd)) {
    return 'Er staat vandaag niets op een tijdstip. Laat dat gerust zo.';
  }
  return null;
}

module.exports.kopVan = kopVan;
