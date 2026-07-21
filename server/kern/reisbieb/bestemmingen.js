/* Reis-Bibliotheek, deel "bestemmingen": 250 bestemmingen van over de hele
   wereld, van Londen tot Gaza; pure data voor de deterministische catalogus.
   Steden, streken en eilanden door elkaar, elk werelddeel ruim gedekt. */

const BESTEMMINGEN = [
  // Europa (70)
  'Londen', 'Parijs', 'Amsterdam', 'Rome', 'Barcelona', 'Madrid', 'Lissabon', 'Porto', 'Berlijn', 'München',
  'Wenen', 'Praag', 'Boedapest', 'Warschau', 'Krakau', 'Kopenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Reykjavik',
  'Dublin', 'Edinburgh', 'Brussel', 'Brugge', 'Luxemburg', 'Zürich', 'Genève', 'Milaan', 'Venetië', 'Florence',
  'Napels', 'Sicilië', 'Sardinië', 'Athene', 'Santorini', 'Kreta', 'Istanbul', 'Cappadocië', 'Dubrovnik', 'Split',
  'Ljubljana', 'Zagreb', 'Belgrado', 'Sarajevo', 'Sofia', 'Boekarest', 'Transsylvanië', 'Riga', 'Tallinn', 'Vilnius',
  'Sevilla', 'Granada', 'Valencia', 'Mallorca', 'Ibiza', 'Canarische Eilanden', 'Madeira', 'Azoren', 'Nice', 'Provence',
  'Normandië', 'Bretagne', 'Bordeaux', 'Lyon', 'Corsica', 'Schotse Hooglanden', 'Lapland', 'Faeröer', 'Malta', 'Cyprus',
  // Midden-Oosten & Noord-Afrika (35)
  'Gaza', 'Jeruzalem', 'Bethlehem', 'Tel Aviv', 'Amman', 'Petra', 'Wadi Rum', 'Beiroet', 'Damascus', 'Caïro',
  'Luxor', 'Aswan', 'Alexandrië', 'Marrakech', 'Fez', 'Casablanca', 'Chefchaouen', 'Tunis', 'Algiers', 'Tripoli',
  'Dubai', 'Abu Dhabi', 'Doha', 'Riyad', 'Djedda', 'AlUla', 'Muscat', 'Salalah', 'Koeweit-Stad', 'Manama',
  'Bagdad', 'Erbil', 'Teheran', 'Isfahan', 'Sanaa',
  // Afrika (30)
  'Kaapstad', 'Johannesburg', 'Krugerpark', 'Nairobi', 'Masai Mara', 'Serengeti', 'Zanzibar', 'Kilimanjaro', 'Addis Abeba', 'Lalibela',
  'Accra', 'Lagos', 'Abuja', 'Dakar', 'Bamako', 'Timboektoe', 'Kigali', 'Kampala', 'Victoriameer', 'Victoriawatervallen',
  'Windhoek', 'Sossusvlei', 'Gaborone', 'Okavangodelta', 'Antananarivo', 'Mauritius', 'Seychellen', 'Kaapverdië', 'São Tomé', 'Luanda',
  // Azië (60)
  'Tokio', 'Kioto', 'Osaka', 'Hokkaido', 'Okinawa', 'Seoul', 'Busan', 'Peking', 'Shanghai', 'Chengdu',
  'Hongkong', 'Macau', 'Taipei', 'Hanoi', 'Ha Long Bay', 'Ho Chi Minhstad', 'Siem Reap', 'Angkor', 'Phnom Penh', 'Vientiane',
  'Luang Prabang', 'Bangkok', 'Chiang Mai', 'Phuket', 'Koh Samui', 'Kuala Lumpur', 'Penang', 'Borneo', 'Singapore', 'Jakarta',
  'Bali', 'Lombok', 'Java', 'Sumatra', 'Manilla', 'Palawan', 'Cebu', 'Yangon', 'Bagan', 'Kathmandu',
  'Everest Basiskamp', 'Pokhara', 'Thimphu', 'Delhi', 'Agra', 'Jaipur', 'Mumbai', 'Goa', 'Kerala', 'Varanasi',
  'Colombo', 'Kandy', 'Malediven', 'Dhaka', 'Islamabad', 'Lahore', 'Karachi', 'Tasjkent', 'Samarkand', 'Almaty',
  // Amerika's (40)
  'New York', 'Los Angeles', 'San Francisco', 'Las Vegas', 'Miami', 'Chicago', 'New Orleans', 'Hawaï', 'Alaska', 'Yellowstone',
  'Grand Canyon', 'Toronto', 'Vancouver', 'Montreal', 'Banff', 'Mexico-Stad', 'Cancun', 'Oaxaca', 'Havana', 'Kingston',
  'San Juan', 'Punta Cana', 'Guatemala-Stad', 'Antigua', 'San José', 'Panama-Stad', 'Bogotá', 'Cartagena', 'Medellín', 'Quito',
  'Galápagos', 'Lima', 'Cusco', 'Machu Picchu', 'La Paz', 'Santiago', 'Patagonië', 'Buenos Aires', 'Rio de Janeiro', 'Salvador',
  // Oceanië & polair (15)
  'Sydney', 'Melbourne', 'Uluru', 'Great Barrier Reef', 'Perth', 'Tasmanië', 'Auckland', 'Queenstown', 'Rotorua', 'Fiji',
  'Samoa', 'Tahiti', 'Cookeilanden', 'Antarctica', 'Spitsbergen'
];

module.exports = { BESTEMMINGEN };
