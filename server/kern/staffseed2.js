/* Het demopersoneel van de vakmannen-golf (vervolg op staffseed.js, dat vol
   zit): per zaak een manager (PIN 1234) en medewerkers (PIN 5678). Bij de
   tandarts hoort naast de tandarts ook de mondhygienist en de assistente.
   Pure data, geen logica; server.js voegt beide seeds samen. */
const STAFF_SEED = {
  /* De club. Hij staat HIER en niet bij de andere horeca in staffseed.js om de
     reden waarvoor dit bestand bestaat: dat zat vol. Een club draait op een
     deur en een bar, en de portier beslist over de gastenlijst. */
  NACHT: [['Rocio Ferrer', 'manager', 'Clubmanager'], ['Tomas Vidal', 'staff', 'Deur']],
  TALLER: [['Toni Colomar', 'manager', 'Werkplaatschef'], ['Rafel Duro', 'staff', 'Monteur'], ['Mireia Fabre', 'staff', 'APK & banden']],
  BRILLA: [['Pilar Escandell', 'manager', 'Planning & teams'], ['Dorin Petrescu', 'staff', 'Schoonmaakteam'], ['Yolanda Cruz', 'staff', 'Eindschoonmaak']],
  VERDIA: [['Josep Verdera', 'manager', 'Hoofdhovenier'], ['Finn de Groen', 'staff', 'Tuinonderhoud']],
  LAVANDA: [['Carmen Lavilla', 'manager', 'Wasserijbeheer'], ['Bram Steen', 'staff', 'Route & bezorging']],
  ESCOLA: [['Xavi Riera', 'manager', 'Rij-instructeur'], ['Marta Vila', 'staff', 'Instructeur']],
  FAUNA: [['Dr. Ines Salvado', 'manager', 'Dierenarts'], ['Coen Mulder', 'staff', 'Paraveterinair']],
  DENTAL: [['Dr. Alba Cardell', 'manager', 'Tandarts'], ['Noor van Dijk', 'staff', 'Mondhygienist'], ['Rocio Pardo', 'staff', 'Assistente']],
  LUZ: [['Mar Estarellas', 'manager', 'Fotograaf'], ['Ties Hendrix', 'staff', 'Videograaf']],
  MUDANZA: [['Pere Salord', 'manager', 'Voorman & planning'], ['Andrei Lupu', 'staff', 'Verhuizer'], ['Koen Dijkema', 'staff', 'Verhuizer']],
  DIGITAL: [['Nuno Ferreira', 'manager', 'IT-specialist'], ['Lot Willems', 'staff', 'Smart home']]
};

module.exports = { STAFF_SEED };
