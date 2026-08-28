/* DE RECHTSVORMWACHT: rechtsvormen worden bijgewerkt, niet overgetypt.

   Hetzelfde ontwerp als de Regelwacht (kern/fiscaal/regelwacht.js), en met
   opzet hetzelfde -- dit huis heeft er al een die werkt, en twee verschillende
   manieren om hetzelfde te doen lopen uiteen (lat-regel 4):

   - de ingebouwde tabellen (./rechtsvorm.js voor Nederland,
     ./rechtsvorm-landen.js voor de rest) blijven de veilige basis: zonder bron
     draait alles gewoon door;
   - een update wordt streng gevalideerd en dan IN PLACE op het gedeelde
     register gezet, zodat elke lezer -- het scherm, het oprichtingsproject, de
     capslijst -- per direct met de nieuwe stand rekent;
   - de overlay wordt bewaard (collectie rechtsvormRegels) en bij het opstarten
     opnieuw toegepast: een herstart verliest nooit een update;
   - met RECHTSVORM_BRON_URL gezet haalt de dagelijkse controle de nieuwste
     tabel op; zonder bron meldt de status eerlijk dat de ingebouwde tabel geldt.

   DRIE GRENDELS DIE EEN BRON NOOIT MAG OPENEN. Een rechtsvorm is geen getal:
   hier hangen aansprakelijkheid en belastingplicht aan, en een bron die van
   alles mag, kan die stilletjes uitzetten.

   1. VERBODEN GROEIT ALLEEN. Een bron mag een verbod TOEVOEGEN en er nooit een
      weghalen. Zou dat wel mogen, dan is één regel in een bestand genoeg om een
      stichting winst te laten uitkeren -- precies de grendel waarvoor `verboden`
      apart van `caps` bestaat (zie de kop van ./rechtsvorm.js).
   2. CAPS KOMEN UIT HET WOORDENBOEK. Alleen namen die in dit huis al bestaan.
      Een verzonnen cap vult geen scherm maar kan wel een knop laten opduiken
      die niemand heeft ontworpen.
   3. RECHTSPERSOON EN NOTARIEEL LIGGEN VAST ZODRA EEN VORM BESTAAT. Ze mogen
      alleen worden gezet bij een NIEUWE vorm. `rechtspersoon` stuurt de
      belastinggrendel in ./belasting.js aan; hem omzetten op een bestaande B.V.
      zou daar een inkomstenbelastingsommetje op een rechtspersoon laten los.

   En wat een bron al helemaal niet kan: een rechtsvorm VERWIJDEREN. Er kan een
   onderneming aan hangen, en die zou dan een juridische vorm hebben die het
   systeem niet meer kent. */
'use strict';

const RV = require('./rechtsvorm');

const TEKSTEN = { label: 90, kort: 30, aansprakelijk: 300 };
const MAX_STAPPEN = 25;
const MAX_STAP = 140;

const schoonTekst = (v, max) => String(v).replace(/[<>]/g, '').trim().slice(0, max);
const isLandcode = (v) => typeof v === 'string' && /^[A-Z]{2}$/.test(v);

/* De caps uit een update: alleen wat in het woordenboek staat, ontdubbeld. */
const filterCaps = (lijst) => (Array.isArray(lijst)
  ? [...new Set(lijst.filter(c => RV.CAPS_WOORDENBOEK.includes(c)))] : null);

const filterStappen = (lijst) => (Array.isArray(lijst)
  ? lijst.filter(s => typeof s === 'string' && s.trim())
    .map(s => schoonTekst(s, MAX_STAP)).slice(0, MAX_STAPPEN) : null);

module.exports = ({ db, save, fetchImpl }) => {
  const haal = fetchImpl || ((...a) => fetch(...a));

  const eigen = require('../eigencollectie')({ db, domein: 'kern/onderneming/rechtsvormwacht', bezit: { rechtsvormRegels: 'kaart' } });
  const staat = () => eigen.bak('rechtsvormRegels',
    b => Object.assign(b, { versie: null, bron: null, at: null, wijzigingen: {} }));

  /* Een BESTAANDE vorm bijwerken. Geeft terug wat er echt veranderde, zodat de
     overlay alleen draagt wat hij ook heeft gedaan. */
  function werkBij(vorm, velden) {
    const wijz = {};
    for (const [veld, waarde] of Object.entries(velden)) {
      if (TEKSTEN[veld] && typeof waarde === 'string' && waarde.trim()) {
        const s = schoonTekst(waarde, TEKSTEN[veld]);
        if (vorm[veld] !== s) { vorm[veld] = s; wijz[veld] = s; }
      } else if (veld === 'oprichting') {
        const st = filterStappen(waarde);
        if (st && st.length && JSON.stringify(vorm.oprichting) !== JSON.stringify(st)) {
          vorm.oprichting = st; wijz.oprichting = st;
        }
      } else if (veld === 'caps') {
        const c = filterCaps(waarde);
        if (c && JSON.stringify(vorm.caps) !== JSON.stringify(c)) { vorm.caps = c; wijz.caps = c; }
      } else if (veld === 'verboden') {
        /* Grendel 1: alleen erbij. Zie de kop. */
        const nieuw = filterCaps(waarde) || [];
        const erbij = nieuw.filter(v => !vorm.verboden.includes(v));
        if (erbij.length) { vorm.verboden = vorm.verboden.concat(erbij); wijz.verboden = vorm.verboden.slice(); }
      }
      /* rechtspersoon, notarieel en land staan hier NIET: grendel 3. */
    }
    return wijz;
  }

  /* Een NIEUWE vorm. Alles wat een lezer nodig heeft moet erin staan; een halve
     rechtsvorm is erger dan geen, want hij verschijnt wel in de keuzelijst. */
  function maakNieuw(id, v) {
    if (!/^[a-z]{2}-[a-z0-9-]{2,40}$/.test(id)) return null;
    if (typeof v.label !== 'string' || !v.label.trim()) return null;
    if (typeof v.rechtspersoon !== 'boolean') return null;
    if (!isLandcode(v.land)) return null;
    const oprichting = filterStappen(v.oprichting);
    if (!oprichting || !oprichting.length) return null;
    return {
      land: v.land, label: schoonTekst(v.label, TEKSTEN.label),
      kort: typeof v.kort === 'string' && v.kort.trim() ? schoonTekst(v.kort, TEKSTEN.kort) : id,
      rechtspersoon: v.rechtspersoon, notarieel: v.notarieel === true,
      aansprakelijk: typeof v.aansprakelijk === 'string' && v.aansprakelijk.trim()
        ? schoonTekst(v.aansprakelijk, TEKSTEN.aansprakelijk)
        : 'De aansprakelijkheid van deze rechtsvorm staat niet in onze bron. Ga hem na bij een adviseur ter plaatse.',
      caps: filterCaps(v.caps) || [], verboden: filterCaps(v.verboden) || [],
      oprichting, nieuwUitBron: true
    };
  }

  function pasToe(update, bron, versie) {
    const inkomend = (update && update.rechtsvormen) || update || {};
    const gedaan = {};
    for (const [id, velden] of Object.entries(inkomend)) {
      if (!velden || typeof velden !== 'object') continue;
      if (RV.isRechtsvorm(id)) {
        const wijz = werkBij(RV.RECHTSVORMEN[id], velden);
        if (Object.keys(wijz).length) gedaan[id] = wijz;
      } else {
        const vorm = maakNieuw(id, velden);
        if (vorm) { RV.RECHTSVORMEN[id] = vorm; gedaan[id] = Object.assign({}, vorm); }
      }
    }
    const st = staat();
    /* De overlay stapelt: latere updates winnen per veld, zodat een herstart op
       de laatste stand uitkomt. Precies zoals de Regelwacht het doet. */
    for (const [id, wijz] of Object.entries(gedaan)) {
      st.wijzigingen[id] = Object.assign(st.wijzigingen[id] || {}, JSON.parse(JSON.stringify(wijz)));
    }
    if (Object.keys(gedaan).length || versie) {
      st.versie = versie || st.versie;
      st.bron = bron || st.bron || 'kantoor';
      st.at = new Date().toISOString();
      save();
    }
    return { ok: true, gedaan, vormen: Object.keys(gedaan).length };
  }

  /* Bij het opstarten: de bewaarde overlay opnieuw op het register zetten. */
  function herstelOverlay() {
    const st = staat();
    if (Object.keys(st.wijzigingen || {}).length) pasToe({ rechtsvormen: st.wijzigingen }, st.bron, st.versie);
  }

  /* De dagelijkse controle. Nooit een crash: een onbereikbare of rare bron laat
     de huidige tabel gewoon staan -- dat is het hele punt van een ingebouwde
     basis. */
  async function check() {
    const url = process.env.RECHTSVORM_BRON_URL || '';
    const st = staat();
    st.laatsteCheck = new Date().toISOString();
    if (!url) {
      st.checkUitslag = 'geen externe bron gekoppeld; de ingebouwde tabel geldt (' +
        RV.LANDEN_MET_VORMEN().length + ' landen) plus doorgevoerde updates';
      save();
      return { ok: true, bron: null };
    }
    try {
      const r = await haal(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) throw new Error('bron gaf ' + r.status);
      const data = await r.json();
      const uit = pasToe(data, url, data.versie);
      st.checkUitslag = 'bron opgehaald; ' + uit.vormen + ' rechtsvorm(en) bijgewerkt';
      save();
      return { ok: true, bron: url, bijgewerkt: uit.vormen };
    } catch (e) {
      st.checkUitslag = 'bron niet bereikbaar (' + String(e.message).slice(0, 80) + '); de huidige tabel blijft gelden';
      save();
      return { ok: false, fout: st.checkUitslag };
    }
  }

  function status() {
    const st = staat();
    const landen = RV.LANDEN_MET_VORMEN();
    return {
      versie: st.versie, bron: st.bron, laatsteUpdate: st.at,
      laatsteCheck: st.laatsteCheck || null, checkUitslag: st.checkUitslag || null,
      vormenMetUpdates: Object.keys(st.wijzigingen || {}),
      landen: landen.map(cc => {
        const l = RV.rechtsvormenVanLand(cc);
        return { land: cc, naam: l.naam, vormen: l.vormen.length };
      }),
      totaal: Object.keys(RV.RECHTSVORMEN).length,
      grendels: [
        'Een bron kan een verbod toevoegen en er nooit een weghalen.',
        'Caps komen uit het woordenboek van dit huis; verzonnen namen worden genegeerd.',
        'Rechtspersoon en notarieel liggen vast zodra een vorm bestaat.',
        'Een rechtsvorm kan nooit verdwijnen: er kan een onderneming aan hangen.'
      ]
    };
  }

  return { rechtsvormwacht: { pasToe, herstelOverlay, check, status } };
};
