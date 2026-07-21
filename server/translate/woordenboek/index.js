/* Vertaallaag (deelmodule): de woordenboeken. NL2EN dekt de vaste seed-inhoud
   (./nl2en), WORDS_NL_EN/WORDS_EN_NL de woord-voor-woord terugval, EN2NL is de
   afgeleide omkering. Pure data, geen logica. */
const NL2EN = require('./nl2en');

/* Veelgebruikte woorden voor de woord-voor-woord terugval (demo zonder API).
   Niet perfect, maar geeft de ontvanger een leesbaar idee in zijn eigen taal. */
const WORDS_NL_EN = {
  'hallo':'hello','hoi':'hi','dank':'thanks','dankjewel':'thank you','bedankt':'thanks','alsjeblieft':'please',
  'ja':'yes','nee':'no','graag':'gladly','mooi':'beautiful','prachtig':'gorgeous','geweldig':'great',
  'reis':'trip','reizen':'travel','hotel':'hotel','kamer':'room','diner':'dinner','lunch':'lunch','ontbijt':'breakfast',
  'wanneer':'when','waar':'where','hoe':'how','welk':'which','welke':'which','wat':'what','wie':'who',
  'boeken':'to book','geboekt':'booked','prijs':'price','korting':'discount','betalen':'to pay','betaald':'paid',
  'ik':'I','je':'you','jij':'you','u':'you','wij':'we','met':'with','voor':'for','naar':'to','van':'from','in':'in','op':'on',
  'en':'and','of':'or','niet':'not','ook':'also','heel':'very','erg':'very','goed':'good','leuk':'nice','stad':'city',
  'strand':'beach','zon':'sun','weer':'weather','vraag':'question','antwoord':'answer','bericht':'message','groeten':'regards',
  'zie':'see','ik zie':'I see','morgen':'tomorrow','vandaag':'today','avond':'evening','ochtend':'morning',
  'restaurant':'restaurant','tafel':'table','fles':'bottle','wijn':'wine','koffie':'coffee','thee':'tea',
  'is':'is','ben':'am','was':'was','zijn':'are','heb':'have','heeft':'has','kan':'can','kunnen':'can','wil':'want','willen':'want'
};
const WORDS_EN_NL = Object.fromEntries(Object.entries(WORDS_NL_EN).map(([k, v]) => [v, k]));

const EN2NL = {};
for (const [nl, en] of Object.entries(NL2EN)) if (!(en in EN2NL)) EN2NL[en] = nl;

/* Spaans voor de werkvloer (demo zonder AI-sleutel): een personeelslid met
   moedertaal Spaans ziet zijn PDA, bonnen en taken toch in het Spaans. De
   sleutels dekken Nederlands EN Engels (de UI-woordenboeken zijn Engels, de
   vaste teksten Nederlands), de waarde is steeds het Spaanse woord. Met een
   echte AI-sleutel vertaalt Claude alles volledig; dit is het vangnet. */
const WORDS_ES = {
  // de werkvloer zelf
  'taken':'tareas','tasks':'tareas','taak':'tarea','task':'tarea','klus':'trabajo','klussen':'trabajos','jobs':'trabajos',
  'rooster':'horario','schedule':'horario','dienst':'turno','shift':'turno','vandaag':'hoy','today':'hoy',
  'morgen':'mañana','tomorrow':'mañana','week':'semana','team':'equipo','hulp':'ayuda','help':'ayuda',
  'open':'abierto','dicht':'cerrado','closed':'cerrado','klaar':'listo','done':'listo','ready':'listo',
  'bezig':'en curso','busy':'ocupado','nieuw':'nuevo','new':'nuevo','oppakken':'recoger','wachten':'esperar',
  'schoon':'limpio','clean':'limpio','vuil':'sucio','dirty':'sucio','schoonmaken':'limpiar','kamer':'habitación',
  'room':'habitación','kamers':'habitaciones','rooms':'habitaciones','tafel':'mesa','table':'mesa','tafels':'mesas','tables':'mesas',
  'bon':'ticket','bonnen':'tickets','bestelling':'pedido','order':'pedido','orders':'pedidos','bestellingen':'pedidos',
  'keuken':'cocina','kitchen':'cocina','bar':'barra','bediening':'servicio','service':'servicio','gast':'cliente',
  'guest':'cliente','gasten':'clientes','guests':'clientes','menu':'carta','kaart':'carta','gerecht':'plato','dish':'plato',
  'drinken':'bebidas','drinks':'bebidas','warm':'caliente','hot':'caliente','koud':'frío','cold':'frío',
  'kassa':'caja','betalen':'pagar','pay':'pagar','betaald':'pagado','paid':'pagado','contant':'efectivo','cash':'efectivo',
  'prijs':'precio','price':'precio','totaal':'total','total':'total','rekening':'cuenta','bill':'cuenta',
  // eten en drinken (de bonnen)
  'koffie':'café','coffee':'café','thee':'té','tea':'té','wijn':'vino','wine':'vino','bier':'cerveza','beer':'cerveza',
  'water':'agua','brood':'pan','bread':'pan','kip':'pollo','chicken':'pollo','vis':'pescado','fish':'pescado',
  'vlees':'carne','meat':'carne','kaas':'queso','cheese':'queso','soep':'sopa','soup':'sopa','salade':'ensalada','salad':'ensalada',
  'ontbijt':'desayuno','breakfast':'desayuno','lunch':'almuerzo','diner':'cena','dinner':'cena','dessert':'postre',
  // tijd, richting en beleefdheid
  'ochtend':'mañana','morning':'mañana','middag':'tarde','afternoon':'tarde','avond':'noche','evening':'noche',
  'nu':'ahora','now':'ahora','laat':'tarde','late':'tarde','minuten':'minutos','minutes':'minutos','uur':'hora','hour':'hora',
  'ja':'sí','yes':'sí','nee':'no','no':'no','goed':'bien','good':'bien','dank':'gracias','thanks':'gracias',
  'alsjeblieft':'por favor','please':'por favor','welkom':'bienvenido','welcome':'bienvenido',
  'en':'y','and':'y','of':'o','or':'o','met':'con','with':'con','voor':'para','for':'para','zonder':'sin','without':'sin',
  'niet':'no','not':'no','alles':'todo','all':'todo','geen':'ningún','uw':'su','your':'su','mijn':'mi','my':'mi',
  // meldingen en acties
  'melden':'avisar','melding':'aviso','bericht':'mensaje','message':'mensaje','berichten':'mensajes','messages':'mensajes',
  'verlof':'permiso','ziek':'enfermo','sick':'enfermo','pauze':'descanso','break':'descanso',
  'inloggen':'iniciar sesión','uitloggen':'cerrar sesión','wissel':'cambiar','switch':'cambiar',
  'aandacht':'atención','attention':'atención','nodig':'necesario','needed':'necesario','entree':'entrada','entrance':'entrada',
  'security':'seguridad','beveiliging':'seguridad','manager':'gerente','medewerker':'empleado','staff':'personal'
};

module.exports = { NL2EN, WORDS_NL_EN, WORDS_EN_NL, EN2NL, WORDS_ES };
