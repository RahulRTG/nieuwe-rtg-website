/* RTG Stadsweefsel, deel "objecten": het stedelijk objectregister -- de assets.

   Een stad die alleen op meldingen draait, loopt altijd achter de feiten aan.
   Wie wil VOORKOMEN dat pomp 14 uitvalt, moet weten dat pomp 14 bestaat, hoe
   oud hij is, wie hem beheert, wanneer hij voor het laatst is nagekeken en wat
   hij kost om te vervangen. Dat staat hier, en alleen hier.

   Elk object draagt: soort, plaats (lat/lng EN het gebied uit de geografie),
   eigenaar, beheerder, status, risicoklasse, conditie, bouwjaar en levensduur,
   aanschaf- en vervangingswaarde, en zijn eigen onderhoudshistorie.

   HET GEBIED IS AFGELEID, NOOIT INGETIKT. Wie een object plaatst geeft een
   positie; in welke zone en welk straatsegment dat valt rekent de geografie
   uit. Anders staat er straks een lantaarn met lat/lng in Marina en het woord
   "Centrum" ernaast, en dan is de vraag welke van de twee waar is.

   De soortentabel staat in ./objectsoorten.js en de startinrichting van de
   stad in ./objectseed.js; hier woont het register zelf.
   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon, coordPaar } = require('../util');
const { SOORTEN, STATUS, RISICO, CONDITIE } = require('./objectsoorten');

module.exports = (ctx) => {
  const { bak, save, crypto, nu, geo } = ctx;

  const objecten = () => bak().objecten;
  const object = (id) => objecten()[String(id || '')] || null;
  const jaarNu = () => new Date(nu()).getFullYear();

  /* Een object schrijven. De plaats gaat door coordPaar() (een ontbrekende
     positie mag nooit stilletjes 0,0 worden) en daarna door de geografie, die
     zegt in welke zone en welk straatsegment het valt. */
  function objectMaak(inv) {
    geo.zorgGeografie();
    const soort = String((inv && inv.soort) || '');
    const S = SOORTEN[soort];
    if (!S) return { status: 400, error: 'Kies een soort: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const p = coordPaar(inv.lat, inv.lng);
    if (!p) return { status: 400, error: 'Geef een geldige positie (lat en lng).' };
    const plek = geo.plaats(p.lat, p.lng);
    if (!plek.binnenStad) return { status: 400, error: 'Die positie ligt buiten de stad.' };
    if (Object.keys(objecten()).length >= 20000) return { status: 429, error: 'Het objectregister zit vol.' };
    const bouwjaar = Number(inv.bouwjaar);
    const o = {
      id: 'O-' + crypto.randomBytes(4).toString('hex'),
      soort, naam: schoon(inv.naam, 80) || S.label,
      lat: p.lat, lng: p.lng, gebied: plek.gebiedId, zone: plek.zone.id,
      eigenaar: schoon(inv.eigenaar, 60) || 'gemeente',
      beheerder: schoon(inv.beheerder, 60) || 'RTG Stadsbeheer',
      status: STATUS.includes(inv.status) ? inv.status : 'in-dienst',
      risico: RISICO.includes(inv.risico) ? inv.risico : S.risico,
      conditie: Number(inv.conditie) >= 1 && Number(inv.conditie) <= 6 ? Math.round(Number(inv.conditie)) : 2,
      bouwjaar: Number.isFinite(bouwjaar) && bouwjaar > 1800 && bouwjaar <= jaarNu() ? Math.round(bouwjaar) : jaarNu() - 3,
      levensduurJaar: S.jaar,
      waarde: { vervanging: Number(inv.waarde) > 0 ? Math.round(Number(inv.waarde)) : S.waarde },
      laatsteInspectie: null, onderhoud: [], bron: schoon(inv.bron, 40) || null, at: nu()
    };
    objecten()[o.id] = o;
    save();
    return { ok: true, object: publiek(o) };
  }

  // wat er naar buiten gaat: het object plus de afgeleide beheercijfers
  function publiek(o) {
    return { ...o, soortLabel: SOORTEN[o.soort] ? SOORTEN[o.soort].label : o.soort,
      domein: SOORTEN[o.soort] ? SOORTEN[o.soort].domein : null,
      conditieLabel: CONDITIE[o.conditie] || null,
      vervangingsjaar: o.bouwjaar + o.levensduurJaar,
      restlevensduur: o.bouwjaar + o.levensduurJaar - jaarNu(),
      plaats: geo.label(o.gebied) };
  }

  function objectZet(inv) {
    const o = object(inv && inv.id);
    if (!o) return { status: 404, error: 'Onbekend object.' };
    if (inv.status !== undefined) {
      if (!STATUS.includes(inv.status)) return { status: 400, error: 'Kies een status: ' + STATUS.join(', ') + '.' };
      o.status = inv.status;
    }
    if (inv.conditie !== undefined) {
      const c = Math.round(Number(inv.conditie));
      if (!(c >= 1 && c <= 6)) return { status: 400, error: 'De conditie loopt van 1 (uitstekend) tot 6 (zeer slecht).' };
      o.conditie = c;
    }
    if (inv.risico !== undefined) {
      if (!RISICO.includes(inv.risico)) return { status: 400, error: 'Kies een risicoklasse: ' + RISICO.join(', ') + '.' };
      o.risico = inv.risico;
    }
    if (inv.beheerder !== undefined) o.beheerder = schoon(inv.beheerder, 60) || o.beheerder;
    save();
    return { ok: true, object: publiek(o) };
  }

  /* Onderhoud boeken. Dit is de plek waar een klaargemelde werkorder landt:
     wat er is gedaan, door wie, wat het kostte. De historie is begrensd (de
     laatste 50 regels per object) en de inspectiedatum schuift mee. */
  function onderhoudBoek(id, regel) {
    const o = object(id);
    if (!o) return null;
    const r = { at: nu(), wat: schoon(regel && regel.wat, 200) || 'onderhoud',
      wie: schoon(regel && regel.wie, 60) || 'veld',
      kosten: Number(regel && regel.kosten) > 0 ? Math.round(Number(regel.kosten) * 100) / 100 : 0,
      werkorder: schoon(regel && regel.werkorder, 40) || null };
    o.onderhoud.unshift(r);
    if (o.onderhoud.length > 50) o.onderhoud.length = 50;
    o.laatsteInspectie = r.at;
    if (o.status === 'storing') o.status = 'in-dienst';
    save();
    return r;
  }

  /* Zoeken. Het gebiedsfilter loopt via de boom: filteren op de wijk "Kern"
     geeft ook alles in de zones en straten daaronder, want anders moet elke
     beller zelf de hierarchie nalopen en doet de helft dat verkeerd. */
  function zoek(f) {
    geo.zorgGeografie();
    f = f || {};
    let rij = Object.values(objecten());
    if (f.soort) rij = rij.filter(o => o.soort === String(f.soort));
    if (f.status) rij = rij.filter(o => o.status === String(f.status));
    if (f.risico) rij = rij.filter(o => o.risico === String(f.risico));
    if (f.gebied) rij = rij.filter(o => o.gebied === f.gebied || geo.binnen(f.gebied, o.gebied));
    if (f.beheerder) rij = rij.filter(o => o.beheerder === String(f.beheerder));
    return rij;
  }

  // het dichtstbijzijnde object van een soort: zo hangt een melding aan een
  // DING en niet aan een los kruispunt met een vage omschrijving
  function dichtstbij({ lat, lng, soort, straal }) {
    const p = coordPaar(lat, lng);
    if (!p) return null;
    const max = Number(straal) > 0 ? Number(straal) : 120;
    let best = null, bestM = Infinity;
    for (const o of zoek({ soort })) {
      const m = geo.afstand(p, { lat: o.lat, lng: o.lng });
      if (m != null && m < bestM && m <= max) { best = o; bestM = m; }
    }
    return best ? { object: best, meter: Math.round(bestM) } : null;
  }

  /* Wat vraagt om aandacht, zonder dat iemand belde: conditie 4 of slechter,
     of over zijn technische levensduur heen. Dit is de eerste steen onder
     voorspellend onderhoud -- nog geen voorspelling, wel een eerlijke lijst. */
  function aandacht() {
    return zoek({}).filter(o => o.status !== 'uit-dienst' &&
      (o.conditie >= 4 || o.bouwjaar + o.levensduurJaar <= jaarNu()))
      .map(o => ({ ...publiek(o), reden: o.conditie >= 4 ? 'conditie ' + o.conditie + ' (' + CONDITIE[o.conditie] + ')' : 'over de technische levensduur heen' }))
      .sort((a, b) => (b.conditie - a.conditie) || (a.restlevensduur - b.restlevensduur));
  }

  /* De startinrichting staat in ./objectseed.js: een aparte lijst omdat het
     zaaien van een stad iets anders is dan het beheren ervan. */
  const zorgObjecten = require('./objectseed')({ geo, save, objecten, objectMaak });

  return {
    SOORTEN, STATUS, RISICO, CONDITIE, zorgObjecten, object, publiek, zoek, dichtstbij, onderhoudBoek, objectMaak,
    api: {
      weefselObjecten: (f) => {
        zorgObjecten();
        const rij = zoek(f).slice(0, 500).map(publiek);
        return { status: 200, aantal: rij.length, soorten: SOORTEN, objecten: rij };
      },
      weefselObject: ({ id }) => {
        const o = object(id);
        return o ? { status: 200, object: publiek(o) } : { status: 404, error: 'Onbekend object.' };
      },
      weefselObjectMaak: objectMaak,
      weefselObjectZet: objectZet,
      weefselAandacht: () => { zorgObjecten(); const rij = aandacht(); return { status: 200, aantal: rij.length, objecten: rij.slice(0, 200) }; }
    }
  };
};
