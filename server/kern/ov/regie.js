/* RTG Move-regie: tier-afhankelijke ervaring en veilige automatisering.
   De regie mag voorbereiden, bewaken en voorstellen. Boeken, betalen, locatie
   delen en beveiligingskeuzes blijven altijd een expliciete gebruikersactie. */
const ERVARING = {
  rtg: {
    naam: 'RTG Move', belofte: 'Slim, eerlijk en zonder gedoe', modus: 'everyday', accent: '#5EE7F7',
    functies: ['live-ov', 'taxi', 'prijszekerheid', 'slimme-overstap', 'veilig-thuis']
  },
  lifestyle: {
    naam: 'Lifestyle Move', belofte: 'Uw reis voelt persoonlijk verzorgd', modus: 'lifestyle', accent: '#E8C98B',
    functies: ['live-ov', 'taxi', 'comfortprofiel', 'bagagehulp', 'favoriete-chauffeur', 'reisbutler', 'flexibel-omboeken']
  },
  business: {
    naam: 'Business Private', belofte: 'Discrete regie voor u en uw gezelschap', modus: 'private', accent: '#D8C8A0',
    functies: ['live-ov', 'executive-vervoer', 'entourage', 'kostenplaats', 'reisbeleid', 'private-modus', 'reserveplan', 'control-tower']
  }
};

const AUTOMATEN = {
  verstoring: { naam: 'Verstoringen opvangen', uitleg: 'Maakt een nieuw voorstel als een aansluiting dreigt te mislukken.', risico: 'laag', tiers: ['rtg', 'lifestyle', 'business'] },
  vertreksein: { naam: 'Vertreksein', uitleg: 'Waarschuwt wanneer het echt tijd is om te vertrekken.', risico: 'laag', tiers: ['rtg', 'lifestyle', 'business'] },
  comfort: { naam: 'Comfort voorbereiden', uitleg: 'Zet uw opgeslagen comfortwensen klaar voor de vervoerder.', risico: 'laag', tiers: ['lifestyle', 'business'] },
  agenda: { naam: 'Agenda vooruitkijken', uitleg: 'Maakt conceptreizen; er wordt nooit vanzelf geboekt.', risico: 'midden', tiers: ['business'] },
  entourage: { naam: 'Gezelschap coördineren', uitleg: 'Maakt een afgeschermd conceptdraaiboek per rol.', risico: 'midden', tiers: ['business'] },
  reserveplan: { naam: 'Reserveplan gereedhouden', uitleg: 'Bereidt een alternatief voor zonder het te activeren of te betalen.', risico: 'laag', tiers: ['business'] }
};
const { datum: klokDatum } = require('../../lib/klok');

module.exports = ctx => {
  const { db, save, schoon } = ctx;
  const tierVan = tier => ERVARING[tier] ? tier : 'rtg';
  function ensure() { if (!db.data.ovRegie || typeof db.data.ovRegie !== 'object') db.data.ovRegie = {}; }
  function standaard(tier) {
    return {
      automaten: { verstoring: true, vertreksein: true, comfort: tier !== 'rtg', agenda: false, entourage: false, reserveplan: tier === 'business' },
      comfort: { stilte: tier !== 'rtg', temperatuur: 21, bagagehulp: false },
      privacy: { discreteMeldingen: tier === 'business', locatieNaRitWissen: true },
      bijgewerkt: null
    };
  }
  function profiel(key, tier) {
    ensure(); tier = tierVan(tier);
    const bewaard = db.data.ovRegie[key] || standaard(tier);
    const toegestaan = Object.fromEntries(Object.entries(AUTOMATEN).filter(([, a]) => a.tiers.includes(tier)).map(([id, a]) => [id, { ...a, aan: !!bewaard.automaten[id] }]));
    return { status: 200, ervaring: ERVARING[tier], tier, automaten: toegestaan,
      comfort: bewaard.comfort || standaard(tier).comfort,
      privacy: { ...(bewaard.privacy || standaard(tier).privacy), locatieNaRitWissen: true },
      grenzen: [
        'Boeken en betalen vragen altijd uw bevestiging.',
        'Live locatie delen start nooit vanzelf.',
        'Een mens beslist over beveiliging, medische zorg en protocol.',
        'U kunt iedere automaat direct uitzetten.'
      ],
      briefing: briefing(tier, bewaard)
    };
  }
  function briefing(tier, p) {
    if (tier === 'business') return { status: 'gereed', titel: 'Uw regie staat paraat', tekst: p.automaten.reserveplan ? 'Hoofdroute bewaakt · reserveplan voorbereid · niets geboekt zonder akkoord' : 'Hoofdroute bewaakt · u houdt elke beslissing zelf' };
    if (tier === 'lifestyle') return { status: 'rustig', titel: 'Uw reis wordt verzorgd', tekst: p.automaten.comfort ? 'Comfortwensen staan klaar · u bevestigt voor vertrek' : 'Live vervoer en eerlijke prijzen staan klaar' };
    return { status: 'helder', titel: 'Alles voor uw volgende rit', tekst: 'Live vervoer · beste halte · betalen pas bij uitchecken' };
  }
  function zet(key, tier, data) {
    ensure(); tier = tierVan(tier);
    const p = db.data.ovRegie[key] || standaard(tier);
    if (data.automaat) {
      const a = AUTOMATEN[data.automaat];
      if (!a || !a.tiers.includes(tier)) return { status: 403, error: 'Deze regie hoort niet bij uw lidmaatschap.' };
      p.automaten[data.automaat] = data.aan === true;
    }
    if (data.comfort && tier !== 'rtg') {
      p.comfort.stilte = data.comfort.stilte === true;
      p.comfort.bagagehulp = data.comfort.bagagehulp === true;
      p.comfort.temperatuur = Math.min(25, Math.max(17, Number(data.comfort.temperatuur) || 21));
    }
    if (data.privacy) p.privacy.discreteMeldingen = tier === 'business' && data.privacy.discreteMeldingen === true;
    p.privacy.locatieNaRitWissen = true;
    p.bijgewerkt = klokDatum().toISOString();
    db.data.ovRegie[key] = p; save();
    return profiel(key, tier);
  }
  return { ovRegie: profiel, ovRegieZet: zet, OV_ERvaring: ERVARING };
};
