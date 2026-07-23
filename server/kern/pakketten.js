/* RTG Bedrijfspakketten: een lid dat onderneemt (of dat wil) kiest zijn
   bedrijfstype -- tech, horeca, retail, hotel, zorg, creatief, vervoer,
   vastgoed -- en krijgt de JUISTE indeling voor zijn zaak: welke werkplekken,
   welke RTG-werk-apps en welke technieken (3D-indeling, QR, Zegel, kassa,
   borden, facturatie, AI-boekhouder) hij nodig heeft, plus welk gehuurd
   kantoor daarbij past.

   BEROEPSGEHEIM: dit gaat UITSLUITEND over wat de zaak van het lid krijgt.
   De interne werking van de RTG-kantoren zelf (hun eigen kamers, cijfers en
   schakelkast) komt hier NOOIT in voor -- die is en blijft bedrijfsgeheim.
   Deze module raakt die laag dan ook niet aan.

   maakPakketten volgt het vaste kern-patroon; de catalogus is pure data en
   los te toetsen. */

// de technieken die we een zaak kunnen geven (het "over de top"-arsenaal)
const TECHNIEK = {
  indeling3d: { naam: '3D-plattegrond', wat: 'Je vloer in 3D: sleep werkplekken op hun plek, zie de looplijnen.' },
  qrbestel: { naam: 'QR bestellen & betalen', wat: 'Elke tafel, kamer of plek een eigen QR: de gast bestelt en rekent zelf af.' },
  zegel: { naam: 'RTG Zegel (ID & leeftijd)', wat: 'Officiële ID- en leeftijdscheck aan de deur of de kassa, in één scan.' },
  kassa: { naam: 'Kassa (contant of RTG Pay)', wat: 'Per sector een eigen kassa; bonnen, tafels en afrekenen.' },
  borden: { naam: 'Werkborden', wat: 'Trello-stijl planning voor het team, op elk scherm gelijk.' },
  facturatie: { naam: 'Auto-facturatie', wat: 'Facturen komen vanzelf, beide kanten, direct in de boekhouding.' },
  boekhouder: { naam: 'AI-boekhouder', wat: 'Btw per land, personeelskosten en advies; vraagt en doet.' },
  extern: { naam: 'Extern scherm', wat: 'Spiegel je werkplek of open een tweede werkplek op een tweede scherm.' },
  rooster: { naam: 'AI-rooster', wat: 'Rooster dat zichzelf vult op drukte, verlof en kunde.' },
  eye: { naam: 'RTG Eye (camera-visie)', wat: 'Hands-free vastleggen: voertuigschouw, werkvloerlog, voor/na-foto.' },
  voorraad: { naam: 'Voorraad & inkoop', wat: 'AI-inkoop met jouw goedkeuring; nooit misgrijpen.' },
  salon: { naam: 'Salon voor bedrijven', wat: 'Je etalage in De Salon: volgers, aanbiedingen met claimcodes, polls.' }
};

// de werk-apps (RTG-kanten) waar een zaak mee werkt -- geen interne RTG-functies
const APP = {
  leverancier: 'Leverancier-app (je backoffice)',
  pda: 'Personeels-app / PDA (op de vloer)',
  kassa: 'Kassa-scherm',
  keuken: 'Keukenscherm (KDS)',
  bar: 'Barscherm',
  bediening: 'Bedieningspost',
  receptie: 'Receptie / check-in',
  cockpit: 'Bureau-cockpit',
  boekhoud: 'Boekhouding & belasting',
  salon: 'Salon-bedrijfsprofiel'
};

/* De catalogus. `indeling` beschrijft de 3D-plattegrond: kamers op een raster
   (r,k = rij/kolom, w/h = breedte/hoogte in vakken) met een kleur-accent. */
const TYPEN = [
  {
    id: 'tech', naam: 'Tech-onderneming', kort: 'Software, hardware, een studio of een lab.',
    werkplekken: [
      { naam: 'Development-cockpit', wat: 'Sprints, borden en releases op één plek.' },
      { naam: 'Sales & partnerships', wat: 'Leads, deals en samenwerkingen met andere zaken.' },
      { naam: 'HR & recruitment', wat: 'Vacatures, sollicitaties en contracten.' },
      { naam: 'Finance', wat: 'Facturatie, btw per land en de AI-boekhouder.' },
      { naam: 'Demo- & vergaderruimte', wat: 'Een tweede scherm voor pitches en reviews.' }
    ],
    apps: ['leverancier', 'cockpit', 'boekhoud', 'salon'],
    technieken: ['borden', 'facturatie', 'boekhouder', 'extern', 'indeling3d', 'salon'],
    indeling: [
      { naam: 'Development', r: 0, k: 0, w: 2, h: 1, kleur: '#7F1634' },
      { naam: 'Sales', r: 0, k: 2, w: 1, h: 1, kleur: '#A98F1C' },
      { naam: 'HR', r: 1, k: 0, w: 1, h: 1, kleur: '#4C9A75' },
      { naam: 'Finance', r: 1, k: 1, w: 1, h: 1, kleur: '#C23A5E' },
      { naam: 'Demo', r: 1, k: 2, w: 1, h: 1, kleur: '#857007' }
    ],
    huur: { kantoor: 'Zuidas · kantoorverdieping', wat: 'Een verdieping met vergaderzalen, toegangspassen en een executive lounge; schaalt mee met je team.' }
  },
  {
    id: 'horeca', naam: 'Horeca-ondernemer', kort: 'Restaurant, bar, club of beachclub.',
    werkplekken: [
      { naam: 'Keuken (KDS)', wat: 'Bonnen live, mise en place en allergenen die vanzelf afkeuren.' },
      { naam: 'Bar', wat: 'Bonnen op zak, snel tappen, leeftijdscheck ingebouwd.' },
      { naam: 'Bediening', wat: 'Tafelplan, lopende rekening en betaal-na-het-eten.' },
      { naam: 'Kassa & entree', wat: 'Afrekenen, deurverkoop en de Zegel aan de deur.' },
      { naam: 'Reserveringen & events', wat: 'Tafelplanning en events met menukeuze vooruit.' }
    ],
    apps: ['leverancier', 'pda', 'keuken', 'bar', 'bediening', 'kassa', 'receptie'],
    technieken: ['qrbestel', 'zegel', 'kassa', 'rooster', 'voorraad', 'indeling3d', 'salon'],
    indeling: [
      { naam: 'Keuken', r: 0, k: 0, w: 1, h: 2, kleur: '#7F1634' },
      { naam: 'Bar', r: 0, k: 1, w: 1, h: 1, kleur: '#A98F1C' },
      { naam: 'Zaal', r: 0, k: 2, w: 2, h: 2, kleur: '#4C9A75' },
      { naam: 'Kassa', r: 1, k: 1, w: 1, h: 1, kleur: '#C23A5E' },
      { naam: 'Entree', r: 2, k: 0, w: 4, h: 1, kleur: '#857007' }
    ],
    huur: { kantoor: 'Horeca-unit met terras', wat: 'Een casco of ingerichte zaak met keuken, bar en terras; wij leveren de schermen en de kassa erbij.' }
  },
  {
    id: 'retail', naam: 'Retail / mode', kort: 'Boetiek, concept store of eigen merk.',
    werkplekken: [
      { naam: 'Winkelvloer', wat: 'Maat vragen in de paskamer, verlanglijst en styling.' },
      { naam: 'Kassa', wat: 'Afrekenen, bezorgen met code en pas-aan-de-deur.' },
      { naam: 'Voorraad & inkoop', wat: 'Drops, maten en aanvullen zonder misgrijpen.' },
      { naam: 'Backoffice', wat: 'Dagcijfers, toppers en de weektrend.' }
    ],
    apps: ['leverancier', 'pda', 'kassa', 'boekhoud', 'salon'],
    technieken: ['qrbestel', 'kassa', 'voorraad', 'facturatie', 'indeling3d', 'salon'],
    indeling: [
      { naam: 'Vloer', r: 0, k: 0, w: 3, h: 2, kleur: '#7F1634' },
      { naam: 'Paskamers', r: 0, k: 3, w: 1, h: 1, kleur: '#A98F1C' },
      { naam: 'Kassa', r: 1, k: 3, w: 1, h: 1, kleur: '#C23A5E' },
      { naam: 'Magazijn', r: 2, k: 0, w: 4, h: 1, kleur: '#857007' }
    ],
    huur: { kantoor: 'Winkelpand + magazijn', wat: 'Een pand op de winkelstraat of in de Mall, met magazijn en een tweede scherm voor styling.' }
  },
  {
    id: 'hotel', naam: 'Hotel / verblijf', kort: 'Hotel, appartementen of villa\'s.',
    werkplekken: [
      { naam: 'Receptie', wat: 'Check-in/out, keyless en de gastenkaart.' },
      { naam: 'Housekeeping', wat: 'Statussen, prioriteit, minibar en lost & found.' },
      { naam: 'Roomservice & gastchat', wat: 'De gast chat rechtstreeks met de zaak.' },
      { naam: 'Revenue', wat: 'Kamerkalender, bezetting en ADR.' }
    ],
    apps: ['leverancier', 'pda', 'receptie', 'boekhoud'],
    technieken: ['zegel', 'kassa', 'rooster', 'facturatie', 'indeling3d', 'salon'],
    indeling: [
      { naam: 'Receptie', r: 0, k: 0, w: 2, h: 1, kleur: '#7F1634' },
      { naam: 'Kamers', r: 1, k: 0, w: 3, h: 2, kleur: '#4C9A75' },
      { naam: 'Housekeeping', r: 0, k: 2, w: 1, h: 1, kleur: '#A98F1C' },
      { naam: 'Lounge', r: 0, k: 3, w: 1, h: 1, kleur: '#857007' }
    ],
    huur: { kantoor: 'Verblijfspand (keyless)', wat: 'Hotel, appartementencomplex of villa met slimme deuren; wij regelen de keyless-laag en de receptie-app.' }
  },
  {
    id: 'zorg', naam: 'Zorg / beauty', kort: 'Spa, kliniek, salon of praktijk.',
    werkplekken: [
      { naam: 'Agenda & intake', wat: 'Behandelingen boeken en veilige intake delen.' },
      { naam: 'Behandelkamers', wat: 'Per kamer de dagplanning en het zorgprofiel.' },
      { naam: 'Receptie & kassa', wat: 'Afrekenen en de vervolgafspraak.' }
    ],
    apps: ['leverancier', 'pda', 'kassa', 'boekhoud'],
    technieken: ['zegel', 'kassa', 'rooster', 'facturatie', 'indeling3d'],
    indeling: [
      { naam: 'Receptie', r: 0, k: 0, w: 2, h: 1, kleur: '#7F1634' },
      { naam: 'Behandelkamer 1', r: 1, k: 0, w: 1, h: 1, kleur: '#4C9A75' },
      { naam: 'Behandelkamer 2', r: 1, k: 1, w: 1, h: 1, kleur: '#A98F1C' },
      { naam: 'Wachtruimte', r: 0, k: 2, w: 1, h: 2, kleur: '#857007' }
    ],
    huur: { kantoor: 'Praktijkruimte', wat: 'Een rustige praktijk of spa-unit; wij leveren de agenda, de intake-deling en de kassa.' }
  },
  {
    id: 'creatief', naam: 'Creatief / studio', kort: 'Content, design, atelier of productie.',
    werkplekken: [
      { naam: 'Studio', wat: 'Opnames, scripts en de content-agenda.' },
      { naam: 'Bureau / atelier', wat: 'Ontwerpen, lookbooks en samenwerkingen.' },
      { naam: 'Finance', wat: 'Facturen en de AI-boekhouder.' }
    ],
    apps: ['leverancier', 'cockpit', 'boekhoud', 'salon'],
    technieken: ['borden', 'eye', 'facturatie', 'extern', 'indeling3d', 'salon'],
    indeling: [
      { naam: 'Studio', r: 0, k: 0, w: 2, h: 2, kleur: '#7F1634' },
      { naam: 'Atelier', r: 0, k: 2, w: 2, h: 1, kleur: '#A98F1C' },
      { naam: 'Finance', r: 1, k: 2, w: 1, h: 1, kleur: '#C23A5E' },
      { naam: 'Edit', r: 1, k: 3, w: 1, h: 1, kleur: '#4C9A75' }
    ],
    huur: { kantoor: 'Studio / atelier-unit', wat: 'Een studio met licht en geluid of een atelier; tweede scherm voor edits en pitches.' }
  }
];

function typenLijst() {
  return TYPEN.map(t => ({ id: t.id, naam: t.naam, kort: t.kort }));
}

function techniekUit(namen) {
  return (namen || []).map(n => ({ id: n, ...(TECHNIEK[n] || { naam: n, wat: '' }) })).filter(t => t.naam);
}

function advies(id) {
  const t = TYPEN.find(x => x.id === id);
  if (!t) return null;
  return {
    id: t.id, naam: t.naam, kort: t.kort,
    werkplekken: t.werkplekken,
    apps: (t.apps || []).map(a => ({ id: a, naam: APP[a] || a })),
    technieken: techniekUit(t.technieken),
    indeling: t.indeling,
    huur: t.huur
  };
}

function maakPakketten({ anthropic } = {}) {
  /* Optioneel: Rahul kleurt het pakket bij op de specifieke situatie van het
     lid (bijv. "40 couverts, 2 bars, veel events"). Zonder AI-sleutel blijft
     het bij het vaste, degelijke advies. Nooit interne RTG-cijfers. */
  async function adviesAI(id, situatie) {
    const basis = advies(id);
    if (!basis) return null;
    if (!anthropic || !String(situatie || '').trim()) return { ...basis, opmaat: null };
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 400,
        system: 'Je adviseert een RTG-lid over de indeling van zijn zaak, ALLEEN op basis van het meegegeven pakket. ' +
          'Noem nooit interne RTG-cijfers, marges of commissies. Antwoord kort en concreet in het Nederlands: 3-5 zinnen op maat.',
        messages: [{ role: 'user', content: 'Bedrijfstype: ' + basis.naam + '. Pakket-onderdelen: ' +
          basis.werkplekken.map(w => w.naam).join(', ') + '. Situatie van het lid: ' + String(situatie).slice(0, 400) +
          '. Geef kort advies wat hij als eerste inricht en waarop te letten.' }]
      });
      const tekst = resp.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
      return { ...basis, opmaat: tekst || null };
    } catch (e) { return { ...basis, opmaat: null }; }
  }
  return { typenLijst, advies, adviesAI };
}

module.exports = { maakPakketten, typenLijst, advies, TYPEN, TECHNIEK };
