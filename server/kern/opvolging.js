/* RTG School: No-Lost-Child -- de bewaking van opvolging.

   De hulplijn bestaat al: een knop van het kind zelf, acuut apart,
   vertrouwelijk apart. Wat ontbrak is de bewaking dat er ook IETS MEE GEBEURT.
   Een melding die niemand oppakt hoort niet stil te verdwijnen; hij hoort
   luider te worden.

   De keten:

     gevraagd -> toegewezen -> gezien -> afspraak -> afgerond

   En de grens die even hard is als het proces zelf:

     HET SYSTEEM BEWAAKT DAT ER OPVOLGING PLAATSVINDT.
     HET SYSTEEM BESLIST NOOIT WAT ER MET HET KIND AAN DE HAND IS.

   Daarom ziet deze module de TEKST VAN DE MELDING NIET. Ze krijgt vier dingen:
   of het kind zelf zei dat het niet kan wachten, wanneer het is gemeld, en
   welke stappen er zijn gezet. Meer heeft ze niet nodig om te weten dat er
   niemand heeft gekeken -- en met meer zou ze gaan wegen wat er aan de hand is.
   Dat is geen bescheidenheid maar het verschil tussen bewaken en beoordelen.

   De termijnen. Acuut betekent dat het kind zelf zei dat het niet kan wachten;
   dan is twee uur de grens. Anders een schooldag. Dat zijn geen doelen om te
   halen maar het punt waarop iemand anders het moet weten. */
const UUR = 3600000;
const TERMIJN = { acuut: 2 * UUR, gewoon: 24 * UUR };
const AFRONDEN = 14 * 24 * UUR;

const FASEN = ['gevraagd', 'toegewezen', 'gezien', 'afspraak', 'afgerond'];

/* Waar staat deze melding in de keten. Alleen op de stappen die gezet zijn;
   er wordt niets afgeleid uit wat er in de melding staat. */
function fase(m) {
  if (m.afgerondAt) return 'afgerond';
  if (m.afspraak) return 'afspraak';
  if (m.gezienAt) return 'gezien';
  if (m.toegewezen) return 'toegewezen';
  return 'gevraagd';
}

/* Loopt deze te lang? Twee soorten, en ze zeggen allebei alleen iets over TIJD
   ZONDER REACTIE -- nooit iets over het kind. */
function stand(m, nu) {
  const f = fase(m);
  const t = Date.parse(nu) - Date.parse(m.at || nu);
  const grens = m.acuut ? TERMIJN.acuut : TERMIJN.gewoon;
  if (f === 'afgerond') return { fase: f, escaleert: false, wacht: null };
  if (!m.gezienAt && t > grens) return { fase: f, escaleert: true, ernst: 'hoog',
    wacht: 'Er heeft nog niemand naar deze melding gekeken.',
    sinds: Math.round(t / UUR) };
  if (t > AFRONDEN) return { fase: f, escaleert: true, ernst: 'midden',
    wacht: 'Deze melding staat lang open zonder te zijn afgerond.',
    sinds: Math.round(t / UUR) };
  return { fase: f, escaleert: false, wacht: null, sinds: Math.round(t / UUR) };
}

/* De volgende stap, in gewone taal. Ook dit gaat over de KETEN en niet over
   de inhoud: er staat nooit wat iemand zou moeten doen met het kind. */
const VOLGENDE = {
  gevraagd: 'Wijs een mentor toe die hiernaar kijkt.',
  toegewezen: 'Laat weten dat u het gezien heeft; dan stopt de klok.',
  gezien: 'Spreek af wanneer en met wie, of rond het af.',
  afspraak: 'Rond af als het gesprek is geweest.',
  afgerond: null
};

module.exports = { stand, fase, VOLGENDE, TERMIJN, AFRONDEN, FASEN };
