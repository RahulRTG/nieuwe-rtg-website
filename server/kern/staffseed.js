/* Het demopersoneel per leverancier (alleen in demostand gebruikt): per
   zaak een manager (PIN 1234) en vloerpersoneel (PIN 5678) voor de PDA.
   Pure data, geen logica. */
// Demo-personeel per leverancier: een manager (PIN 1234) en een medewerker (PIN 5678).
const STAFF_SEED = {
  SAKURA: [['Marc Bosch', 'manager', 'Beheer'], ['Rosa Torres', 'staff', 'Onderhoud']],
  // de hulpdiensten: per korps een meldkamer-chef (PIN 1234) en een collega
  GUARDIA: [['Marta Colom', 'manager', 'Meldkamer'], ['Jordi Ripoll', 'staff', 'Noodhulp']],
  BOMBERS: [['Pere Marti', 'manager', 'Meldkamer'], ['Aina Bonet', 'staff', 'Bevelvoerder']],
  URGENCIA: [['Laura Cardona', 'manager', 'Meldkamer'], ['Toni Serra', 'staff', 'Verpleegkundige']],
  CANMISSES: [['Dr. Elena Roig', 'manager', 'Spoedeisende hulp'], ['Marc Tur', 'staff', 'Opnamecoordinator']],
  CONSULTA: [['Dr. Pau Ferrer', 'manager', 'Huisarts'], ['Ines Planells', 'staff', 'Assistente']],
  FALCO: [['Cdt. Vidal', 'manager', 'Operatieleider'], ['Sgt. Mari', 'staff', 'Teamleider']],
  FARMACIA: [['Clara Bonet', 'manager', 'Apotheker'], ['Omar Haddad', 'staff', 'Assistent']],
  CARDIO: [['Dr. Sofia Marti', 'manager', 'Cardioloog'], ['Rosa Tur', 'staff', 'Poli-assistente']],
  ESTETICA: [['Dr. Lena Vos', 'manager', 'Cosmetisch arts'], ['Mireia Camps', 'staff', 'Intake & nazorg']],
  // defensie: een commandant/staf (beheer) en een logistiek onderofficier
  GARNIZOEN: [['Kap. Reinier Vos', 'manager', 'Commando & staf'], ['Sgt. Ilias Ben Ali', 'staff', 'Logistiek']],
  KIKUNOI: [['Mateo Ferrer', 'manager', 'Keuken'], ['Nora Prins', 'staff', 'Bediening']],
  PONTO: [['Diego Serra', 'manager', 'Bar'], ['Lisa Groen', 'staff', 'Bediening']],
  HOSHI: [['Carla Vidal', 'manager', 'Receptie'], ['Ibrahim Yildiz', 'staff', 'Housekeeping']],
  MKKX: [['Paolo Mendez', 'manager', 'Taxi centrale'], ['Yara El Idrissi', 'staff', 'Chauffeur']],
  TRANSIT: [['Marisol Vega', 'manager', 'Verkeersleiding'], ['Diego Ferrer', 'staff', 'Buschauffeur'], ['Nuria Camps', 'staff', 'Schipper']],
  JETAG: [['Sophie Bakker', 'manager', 'Operations'], ['Lucas de Jong', 'staff', 'Crew']],
  // zelfstandigen: eenmanszaken, dus alleen een eigenaar met beheer-rechten
  AYAKA: [['Livia Bergkamp', 'manager', 'Goudsmid']],
  KAITO: [['Milan de Wit', 'manager', 'Personal trainer']],
  // activiteiten: beheer plus de mensen aan de deur en op de boot
  ESVEDRA: [['Marta Salas', 'manager', 'Beheer'], ['Joel Ferrer', 'staff', 'Gids']],
  MACE: [['Elena Costa', 'manager', 'Beheer'], ['Dani Ruiz', 'staff', 'Security']],
  ISLAREN: [['Carmen Vidal', 'manager', 'Beheer'], ['Pau Riera', 'staff', 'Balie']],
  IBIZALIV: [['Sofia Marin', 'manager', 'Makelaar'], ['Bram Kessler', 'staff', 'Bezichtigingen']],
  // boerderij: een bedrijfsleider en twee knechten voor het land en de dieren
  CANFERRER: [['Aina Torres', 'manager', 'Bedrijfsleider'], ['Marc Prats', 'staff', 'Veehouderij'], ['Lucia Roig', 'staff', 'Akker & kas']],
  // content creator: vaak solo; de creator zelf plus een editor
  LUMINA: [['Nora Vidal', 'manager', 'Creator'], ['Tim Bakker', 'staff', 'Editor']],
  IBIZAIR: [['Nadia Fischer', 'manager', 'Operations'], ['Tomas Weller', 'staff', 'Piloot']],
  // charter: een vlootbeheerder en een schipper aan boord
  AZUL: [['Nerea Costa', 'manager', 'Charterbeheer'], ['Marco Silva', 'staff', 'Schipper']],
  // mode & retail: een store manager en een verkoper/stylist op de winkelvloer
  MAISON: [['Camille Moreau', 'manager', 'Store manager'], ['Théo Blanc', 'staff', 'Verkoop & styling']],
  // groothandel: een inkoopmanager en een orderpicker/chauffeur
  MERCABIZA: [['Rosa Bennasar', 'manager', 'Inkoop & beheer'], ['Joan Tur', 'staff', 'Orderpicking & bezorging']],
  // beveiliging: een operationeel leider (commandocentrum) en een ploeg bewakers voor de PDA
  AEGIS: [['Viktor Novak', 'manager', 'Operationeel leider'], ['Samir Haddad', 'staff', 'Beveiliger'],
    ['Elena Ruiz', 'staff', 'Beveiliger'], ['Marcus Kane', 'staff', 'Beveiliger'], ['Nadia Petrova', 'staff', 'Beveiliger']],
  // de negen nieuwe sectoren: elk een manager en vloerpersoneel voor de PDA
  // Nora Prins staat ook bij de beachclub op het rooster: samen met de
  // netwerkverbinding hieronder is zij geaccrediteerd om van afdeling te wisselen
  VORA: [['Ines Ferrer', 'manager', 'Club manager'], ['Diego Ramos', 'staff', 'Bediening strand'], ['Yara Klein', 'staff', 'Bar'], ['Nora Prins', 'staff', 'Bediening strand']],
  BRISA: [['Marta Colom', 'manager', 'Eigenaar'], ['Leo Duran', 'staff', 'Barista']],
  FUEGO: [['Alba Fuego', 'manager', 'Chef-eigenaar'], ['Nico Serra', 'staff', 'Sous-chef']],
  LUNARA: [['Claudia Mas', 'manager', 'Villamanager'], ['Pere Joan', 'staff', 'Huismeester'], ['Rosa Vives', 'staff', 'Housekeeping']],
  MOTOISLA: [['Jordi Pons', 'manager', 'Verhuurmanager'], ['Mia Sastre', 'staff', 'Uitgifte & inname']],
  FESTA: [['Luz Romero', 'manager', 'Eventproducent'], ['Sam Ortega', 'staff', 'Crew & entree'], ['Vera Lind', 'staff', 'VIP-host']],
  SERENA: [['Anouk Visser', 'manager', 'Spa manager'], ['Carla Nunez', 'staff', 'Therapeut'], ['Iris Blom', 'staff', 'Therapeut']],
  // zorg & welzijn: de zorgbalie draait op de PDA, dus ook hier demo-personeel
  ZENITH: [['Nadia Sol', 'manager', 'Massagetherapeut'], ['Bram Veer', 'staff', 'Huidtherapeut']],
  CLARA: [['Elena Ruiz', 'manager', 'Huisarts'], ['Tomas Blad', 'staff', 'Fysiotherapeut']],
  ORODOR: [['Esteban Oro', 'manager', 'Meester-juwelier'], ['Lia Costa', 'staff', 'Salon & taxatie']],
  LIENZO: [['Valeria Pinto', 'manager', 'Galeriehouder'], ['Hugo Ram', 'staff', 'Exposities & entree']]
};

module.exports = { STAFF_SEED };
