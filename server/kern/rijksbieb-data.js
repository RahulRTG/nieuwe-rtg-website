/* De naamdelen van de Rijks-Bibliotheek (kern/rijksbieb.js): de twaalf
   afdelingen met hun twintig taken, en de merk- en editienamen. Apart gehouden
   zodat de motor klein blijft; pure data, geen logica. */

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

module.exports = { AFDELINGEN, MERKEN, EDITIES };
