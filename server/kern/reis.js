/* De Reiswijzer: van elk land van de wereld ALLE reisregels op een rij --
   visum (soort + maximale verblijfsduur), rijrichting, alarmnummer,
   kraanwater, fooi-gebruik, alcoholleeftijd, btw en let-op-regels. De rijen
   (./reis/*.js) worden IN PLACE als `reis` op de gedeelde LANDEN-tabel
   gezet, zodat de Regelwacht ze automatisch kan bijwerken (zelfde overlay-
   mechanisme als de belastingtabellen) en elke plek die LANDEN leest per
   direct de nieuwe regels ziet.

   landVind() herkent een land in vrije tekst (een bestemming als
   "Ibiza, Spanje" of "Gstaad"): eerst de landcode, dan de landnaam, dan een
   kleine plaats-naar-land-tabel voor bekende bestemmingen. Zo krijgt
   iedereen die ergens naartoe gaat automatisch de regels van dat land.
   Indicatie voor een Nederlands paspoort; geen juridisch advies. */
module.exports = ({ LANDEN }) => {
  const REGIOS = ['europa', 'amerika', 'azie', 'afrika', 'oceanie'].map(n => require('./reis/' + n));

  const VISUM_LABEL = {
    geen: 'Geen visum nodig -- vrij verblijf',
    vrij: 'Visumvrij',
    toestemming: 'Elektronische reistoestemming vooraf aanvragen',
    aankomst: 'Visum bij aankomst',
    evisum: 'E-visum vooraf aanvragen',
    visum: 'Visum vooraf aanvragen (ambassade of consulaat)'
  };

  // de rijen in place op LANDEN zetten; de Regelwacht muteert ze later door
  for (const [, fooi, rijen] of REGIOS) {
    for (const [code, visum, dagen, rijden, alarm, water, letOp] of rijen) {
      if (!LANDEN[code]) continue;
      LANDEN[code].reis = { visum, dagen, rijden, alarm, water: water === 1, fooi, letOp: letOp || '' };
    }
  }
  // vangnet: elk land een reis-record, ook als er ooit een land bij komt
  for (const l of Object.values(LANDEN)) if (!l.reis)
    l.reis = { visum: 'visum', dagen: 0, rijden: 'rechts', alarm: '112', water: false,
      fooi: 'Fooi-gebruik verschilt; vraag het RTG-reisbureau', letOp: 'Nog geen reisrijen voor dit land; controleer de regels voor vertrek' };

  /* Bekende bestemmingen naar hun land (voor vrije tekst zoals een trip-dest). */
  const PLAATSEN = {
    ibiza: 'ES', formentera: 'ES', marbella: 'ES', mallorca: 'ES', barcelona: 'ES', madrid: 'ES',
    gstaad: 'CH', zermatt: 'CH', geneve: 'CH', monaco: 'MC', 'monte carlo': 'MC',
    parijs: 'FR', nice: 'FR', 'st-tropez': 'FR', londen: 'GB', london: 'GB',
    amsterdam: 'NL', rotterdam: 'NL', antwerpen: 'BE', brussel: 'BE', berlijn: 'DE', munchen: 'DE',
    milaan: 'IT', rome: 'IT', 'new york': 'US', miami: 'US', 'los angeles': 'US', dubai: 'AE',
    'abu dhabi': 'AE', doha: 'QA', tokio: 'JP', tokyo: 'JP', kyoto: 'JP', bali: 'ID', phuket: 'TH',
    bangkok: 'TH', singapore: 'SG', 'hong kong': 'HK', mykonos: 'GR', athene: 'GR', lissabon: 'PT',
    'kaapstad': 'ZA', marrakech: 'MA', 'rio de janeiro': 'BR', 'buenos aires': 'AR', sydney: 'AU',
    melbourne: 'AU', auckland: 'NZ', malediven: 'MV', seychellen: 'SC', mauritius: 'MU'
  };

  /* DE PLAATS in vrije tekst, en niet alleen het land. De Invoerbalie moet uit
     een ingelezen document kunnen halen dat er "Dubai" staat en niet alleen dat
     het AE is -- een reis heet naar zijn bestemming en niet naar zijn land.
     Zelfde tabel als landVind hieronder, want een tweede plaatsenlijst is
     binnen een maand een andere lijst (LAT-regel 4).

     De langste treffer wint: staat er "Abu Dhabi", dan is dat de plaats en niet
     toevallig iets korters dat er ook in zit. Niets gevonden is niets terug --
     een bestemming raden is precies wat de Invoerbalie niet mag. */
  function plaatsVind(invoer) {
    const laag = String(invoer || '').toLowerCase();
    if (!laag) return null;
    let beste = null;
    for (const [plaats, cc] of Object.entries(PLAATSEN)) {
      if (!laag.includes(plaats)) continue;
      if (!beste || plaats.length > beste.plaats.length) beste = { plaats, land: cc };
    }
    if (!beste) return null;
    return { plaats: beste.plaats.replace(/(^|[\s-])([a-z])/g, (m, v, l) => v + l.toUpperCase()),
      land: beste.land, bron: 'de plaatsenlijst van de Reiswijzer' };
  }

  // een land vinden in vrije tekst: code, landnaam of bekende plaats
  function landVind(invoer) {
    const t = String(invoer || '').trim();
    if (!t) return null;
    const up = t.toUpperCase();
    if (LANDEN[up]) return up;
    const laag = t.toLowerCase();
    for (const [cc, l] of Object.entries(LANDEN)) if (laag.includes(l.naam.toLowerCase())) return cc;
    for (const [plaats, cc] of Object.entries(PLAATSEN)) if (laag.includes(plaats)) return cc;
    return null;
  }

  /* De volledige reiswijzer van een land (of een bestemming in vrije tekst). */
  function reiswijzer(invoer) {
    const cc = landVind(invoer);
    if (!cc) return { status: 404, error: 'Dat land of die bestemming kennen we (nog) niet; vraag het RTG-reisbureau.' };
    const l = LANDEN[cc], r = l.reis;
    return { ok: true, code: cc, naam: l.naam, regio: l.regio || '',
      visum: { soort: r.visum, label: VISUM_LABEL[r.visum] || r.visum,
        dagen: r.dagen || 0,
        tekst: VISUM_LABEL[r.visum] + (r.visum === 'vrij' || (r.dagen && r.visum !== 'geen') ? ' · verblijf tot ' + r.dagen + ' dagen' : '') },
      paspoort: 'Reis met een paspoort dat nog minstens 6 maanden geldig is na terugkeer; dat is de veilige wereldwijde norm.',
      rijden: r.rijden, alarm: r.alarm, water: r.water,
      waterTekst: r.water ? 'Kraanwater is drinkbaar.' : 'Drink flessenwater; kraanwater is niet vanzelfsprekend veilig.',
      fooi: r.fooi, letOp: r.letOp || null,
      alcoholLeeftijd: l.alcoholLeeftijd, btwStandaard: l.tarieven && l.tarieven.standaard,
      basis: 'Indicatie voor een Nederlands paspoort; de Regelwacht houdt deze regels automatisch bij. Controleer voor vertrek het actuele reisadvies.' };
  }

  function reisLanden() {
    return Object.entries(LANDEN).map(([code, l]) => ({ code, naam: l.naam, regio: l.regio || '' }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
  }

  return { reiswijzer, reisLanden, landVind, plaatsVind };
};
