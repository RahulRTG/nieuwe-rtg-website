/* De Rijks-Bibliotheek: voor ELKE afdeling van de overheid 10.000
   professionele werk-apps, inbegrepen voor rijksambtenaren. Twaalf
   afdelingen x 10.000 = 120.000 apps, deterministisch samengesteld
   (20 taken x 25 merken x 20 edities per afdeling); alleen installaties
   worden bewaard, per ambtenaar. Zelfde motorpatroon als de School- en
   Reis-Bibliotheek: het nummer bepaalt de app, RAM blijft leeg. */

const AFDELINGEN = [
  { id: 'belastingdienst', label: 'Belastingdienst', icon: '🧾',
    taken: ['Aangiftecontrole', 'Aanslagbeheer', 'Btw-analyse', 'Invordering', 'Kwijtschelding', 'Bezwaardossier', 'Fraudesignalen', 'Steekproef', 'Rentetool', 'Loonheffing', 'Vooroverleg', 'Boekenonderzoek', 'Fiscale kennis', 'Brievenmaker', 'Termijnbewaking', 'Belscript', 'Wetswijzer', 'Jurisprudentie', 'Dossierscan', 'Teamrapportage'] },
  { id: 'toeslagen', label: 'Dienst Toeslagen', icon: '🤝',
    taken: ['Toeslagcheck', 'Inkomenstoets', 'Herberekening', 'Terugvordering', 'Betaalschema', 'Bezwaardossier', 'Signaalbeheer', 'Huurtoets', 'Zorgtoets', 'Kindregeling', 'Brievenmaker', 'Belscript', 'Termijnbewaking', 'Dossierscan', 'Wetswijzer', 'Hardheidstoets', 'Herstelpad', 'Kwaliteitscheck', 'Teamrapportage', 'Ketenoverleg'] },
  { id: 'rdw', label: 'RDW', icon: '🚗',
    taken: ['Kentekenregister', 'Keuringsagenda', 'APK-controle', 'Rijbewijsbeheer', 'Vlootbeheer', 'Tenaamstelling', 'Schorsing', 'Importkeuring', 'Typegoedkeuring', 'Tellerstand', 'Voertuigscan', 'Handhaving', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Kwaliteitscheck', 'Teamrapportage'] },
  { id: 'kvk', label: 'KVK & Handelsregister', icon: '🏢',
    taken: ['Inschrijving', 'Uittrekselbeheer', 'Rechtsvormwissel', 'Functionarissen', 'Deponering', 'Adrescontrole', 'Fraudesignalen', 'Uitschrijving', 'Naamtoets', 'SBI-codering', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Registeranalyse'] },
  { id: 'sociaal', label: 'UWV & SVB', icon: '🛟',
    taken: ['Uitkeringstoets', 'WW-dossier', 'Bijstandsdossier', 'AOW-beheer', 'Kinderbijslag', 'Re-integratie', 'Werkcoach', 'Betaalschema', 'Terugvordering', 'Bezwaardossier', 'Signaalbeheer', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Hardheidstoets', 'Kwaliteitscheck', 'Teamrapportage', 'Ketenoverleg'] },
  { id: 'provincie', label: 'Provincie', icon: '🌳',
    taken: ['Subsidieloket', 'Subsidietoets', 'Natuurbeheer', 'Wegenbeheer', 'Vergunningen', 'Omgevingstoets', 'Kaartenmaker', 'Gebiedsanalyse', 'Erfgoedbeheer', 'Faunabeheer', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Begrotingstool'] },
  { id: 'waterschap', label: 'Waterschap', icon: '💧',
    taken: ['Peilbeheer', 'Dijkinspectie', 'Waterkwaliteit', 'Meldingenbeheer', 'Heffingenbeheer', 'Zuiveringsbeheer', 'Gemalenbeheer', 'Calamiteitenplan', 'Kaartenmaker', 'Gebiedsanalyse', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Neerslagmonitor'] },
  { id: 'rechtspraak', label: 'De Rechtspraak', icon: '⚖️',
    taken: ['Zaaksbeheer', 'Zittingsrol', 'Uitspraakregister', 'Beroepdossier', 'Griffierechten', 'Oproepingen', 'Procesbewaking', 'Jurisprudentie', 'Anonimisering', 'Publicatie', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Zaalplanning'] },
  { id: 'gemeenten', label: 'Gemeenten', icon: '🏛️',
    taken: ['Burgerzaken', 'Vergunningen', 'Meldingenbeheer', 'Buitendienst', 'WOZ-beheer', 'Parkeerbeheer', 'Evenementen', 'Welzijnsloket', 'Wijkbeheer', 'Raadsstukken', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Begrotingstool'] },
  { id: 'bestuur', label: 'Bestuur & Berichtenbox', icon: '📨',
    taken: ['Berichtenbox', 'Bekendmakingen', 'Referendumbeheer', 'Bezwaarloket', 'Regiepaneel', 'Machtigingen', 'Wetgevingsagenda', 'Consultaties', 'Archivering', 'Openbaarmaking', 'Brievenmaker', 'Belscript', 'Wetswijzer', 'Dossierscan', 'Termijnbewaking', 'Steekproef', 'Ketenoverleg', 'Kwaliteitscheck', 'Teamrapportage', 'Persberichten'] },
  { id: 'facilitair', label: 'Rijkskantoren & Facilitair', icon: '🗝️',
    taken: ['Receptiebeheer', 'Bezoekersregistratie', 'Toegangspassen', 'Zaalreservering', 'Schoonmaakronde', 'Onderhoudsbeheer', 'Postkamer', 'Bodeplanning', 'Cateringbeheer', 'Veiligheidsronde', 'BHV-planner', 'Inkooporders', 'Voorraadbeheer', 'Energiemonitor', 'Werkplekboeking', 'Storingsmeldingen', 'Sleutelbeheer', 'Kwaliteitscheck', 'Teamrapportage', 'Duurzaamheidsmonitor'] },
  { id: 'ict', label: 'Digitale Overheid & ICT', icon: '🖥️',
    taken: ['Identiteitsbeheer', 'Toegangsbeheer', 'Loggingmonitor', 'Datakoppelingen', 'API-beheer', 'Privacytoets', 'Beveiligingsscan', 'Incidentbeheer', 'Wijzigingsbeheer', 'Releasekalender', 'Servicedesk', 'Kennisbank', 'Monitoringsbord', 'Backupbeheer', 'Continuiteitsplan', 'Leveranciersbeheer', 'Licentiebeheer', 'Kwaliteitscheck', 'Teamrapportage', 'Architectuurkaart'] }
];

const MERKEN = ['Rijksatlas', 'Staten', 'Loket', 'Dossier', 'Archief', 'Zegel', 'Griffie', 'Kroon', 'Balie', 'Register',
  'Mandaat', 'Decreet', 'Paraaf', 'Stempel', 'Kadaster', 'Kompas', 'Peiler', 'Wachter', 'Bode', 'Pijler',
  'Vizier', 'Anker', 'Baken', 'Schakel', 'Fundament'];
const EDITIES = ['Pro', 'Compleet', 'Premium', 'Expert', 'Kantoor', 'Veld', 'Compact', 'Analyse', 'Keten', 'Audit',
  'Signature', 'Studio', 'Meester', 'Grand', 'Atlas', 'Nova', 'Editie X', 'Balie', 'Mobiel', 'Suite'];

const PER_TAAK = MERKEN.length * EDITIES.length;                  // 500
const PER_AFDELING = 20 * PER_TAAK;                               // 10.000
const TOTAAL = AFDELINGEN.length * PER_AFDELING;                  // 120.000

function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const a = Math.floor(i / PER_AFDELING);
  const rest = i % PER_AFDELING;
  const t = Math.floor(rest / PER_TAAK);
  const m = Math.floor((rest % PER_TAAK) / EDITIES.length);
  const e = rest % EDITIES.length;
  const afd = AFDELINGEN[a];
  const waarde = 49900 + ((i * 7919) % 90) * 1000;                // 499 .. 1.388: professioneel werkgereedschap
  return {
    id: 'rijk-' + i, nr: i,
    naam: MERKEN[m] + ' ' + afd.taken[t] + ' ' + EDITIES[e],
    afdeling: afd.id, afdelingLabel: afd.label, taak: afd.taken[t], icon: afd.icon,
    winkelwaardeCenten: waarde, ambtenaarprijsCenten: 0,
    sterren: (41 + ((i * 31) % 9)) / 10, versie: (3 + (i % 5)) + '.' + ((i * 13) % 10), grootteMB: 40 + ((i * 97) % 420),
    uitleg: afd.taken[t] + ' voor ' + afd.label + ': professioneel, veilig en AVG-proof, gebouwd voor de dagelijkse praktijk. ' +
      'Winkelwaarde EUR ' + (waarde / 100).toFixed(2).replace('.', ',') + '; voor rijksambtenaren inbegrepen.'
  };
}

let SOM_WAARDE = 0;
for (let i = 0; i < TOTAAL; i++) SOM_WAARDE += 49900 + ((i * 7919) % 90) * 1000;

function maakRijksBieb({ db, save }) {
  const rij = (key) => {
    if (!db.data.rijksInstallaties) db.data.rijksInstallaties = {};
    if (!Array.isArray(db.data.rijksInstallaties[key])) db.data.rijksInstallaties[key] = [];
    return db.data.rijksInstallaties[key];
  };

  function overzicht() {
    return { totaal: TOTAAL, perAfdeling: PER_AFDELING, totaleWinkelwaardeCenten: SOM_WAARDE,
      afdelingen: AFDELINGEN.map(a => ({ id: a.id, label: a.label, icon: a.icon, aantal: PER_AFDELING, taken: a.taken })) };
  }

  // bladeren: kies een afdeling en/of taak, of zoek in de naam-bouwstenen
  function catalogus({ afdeling, taak, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(5000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    let A = AFDELINGEN.map((_, ix) => ix);
    if (afdeling) A = A.filter(ix => AFDELINGEN[ix].id === String(afdeling));
    const treffers = [];                                          // [afdIx, taakIx]
    for (const ix of A) {
      AFDELINGEN[ix].taken.forEach((tk, ti) => {
        if (taak && tk !== String(taak)) return;
        if (q && !tk.toLowerCase().includes(q) && !AFDELINGEN[ix].label.toLowerCase().includes(q)) return;
        treffers.push([ix, ti]);
      });
    }
    if (!treffers.length) return { items: [], totaal: 0, pagina: 1, paginas: 1, hint: 'Zoek op een afdeling (bijv. RDW) of een taak (bijv. dossierscan).' };
    const totaal = treffers.length * PER_TAAK;
    const start = (p - 1) * n;
    const items = [];
    for (let k = start; k < Math.min(start + n, totaal); k++) {
      const [aIx, tIx] = treffers[Math.floor(k / PER_TAAK)];
      items.push(appVan(aIx * PER_AFDELING + tIx * PER_TAAK + (k % PER_TAAK)));
    }
    return { items, totaal, pagina: p, paginas: Math.max(1, Math.ceil(totaal / n)) };
  }

  function installeer(key, id) {
    const nr = Number(String(id || '').replace(/^rijk-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de Rijks-Bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 300) return { status: 400, error: 'Het maximum van 300 werk-apps is bereikt; ruim eerst op.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(key, id) {
    const nr = Number(String(id || '').replace(/^rijk-/, ''));
    const mijn = rij(key);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij uw werk-apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (key) => rij(key).map(appVan).filter(Boolean);

  return { rijksbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, TOTAAL } };
}

module.exports = { maakRijksBieb, TOTAAL };
