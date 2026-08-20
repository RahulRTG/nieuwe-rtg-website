/* ============================================================================
   DE LIEGPOORT -- laat een endpoint met opzet liegen, en kijk of er iets omvalt.

   WAAROM DIT ER IS. De dekkingsmeting noemt een endpoint gedekt zodra zijn pad
   ergens in een toetsbestand voorkomt. Dat meet AANWEZIGHEID, geen juistheid: een
   toets die een route aanroept en alleen kijkt of er geen 500 komt, zet hem op
   groen. Ik heb dat op 2026-08-05 zelf gebruikt om zevenendertig endpoints
   "gedekt" te krijgen door de paden voluit te schrijven. De toets erachter deed
   echt werk, maar het legde bloot dat het getal niet betekent wat het lijkt.

   De enige eerlijke vraag is: als dit endpoint iets ANDERS zou antwoorden, zou
   dan een toets rood worden? Zo nee, dan is er niemand die hem controleert --
   hoe vaak hij ook wordt aangeroepen.

   HOE. Met RTG_LIEG=<patroon> gezet vervangt deze laag het antwoord van elke
   route waarvan het pad op dat patroon past. Het antwoord blijft GELDIG van vorm
   (status 200, JSON, `ok: true`) en is inhoudelijk leeg. Dat is met opzet: een
   500 of een 404 valt op door de ruwste toets, en dan meet je of de route
   bestaat. Een plausibel maar leeg antwoord valt alleen op als iemand naar de
   INHOUD kijkt -- en dat is precies wat we willen weten.

   WAT DEZE PROEF NIET BEWIJST, eerlijk:

   - Een endpoint dat zijn werk in de DATABASE doet en weinig teruggeeft (een
     wisactie, een boeking) kan blijven liegen terwijl een toets even later wel
     ziet dat de data niet klopte. Zo'n endpoint slaagt hier terecht.
   - Andersom: een toets die alleen `ok: true` verwacht, wordt hier niet rood
     terwijl hij ook niets bewijst. Die vallen dus WEL op als ongedekt, en dat
     is de bedoeling.
   - Het zegt niets over de kwaliteit van de assertie, alleen dat er een is die
     van de inhoud afhangt.

   Deze laag doet NIETS zonder RTG_LIEG. Hij staat in de gewone keten zodat er
   geen tweede opstartpad ontstaat dat alleen bij een proef wordt gebruikt -- een
   pad dat je niet draait, is een pad dat niet werkt.
   ========================================================================== */
'use strict';

/* Het patroon is een lijst padvoorvoegsels, gescheiden door komma's. Een
   voorvoegsel en geen reguliere expressie: een proef die per ongeluk alles
   raakt, geeft een groene uitslag om de verkeerde reden. */
function maakPatroon(ruw) {
  const delen = String(ruw || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!delen.length) return null;
  /* Een patroon met een PADPARAMETER (/api/gezin/:code/mij) matcht op vorm:
     elk :segment staat voor precies een echt segment. Zonder dit ging de
     leugen over zo'n route wel AAN maar nooit AF -- het letterlijke patroon
     matcht het echte verzoek (/api/gezin/ABC123/mij) niet, en drieendertig
     routes stonden daardoor op "blind" zonder dat er ooit over ze gelogen is.
     Letterlijke patronen houden het oude voorvoegsel-gedrag. */
  const vormen = delen.map(d => {
    if (!d.includes('/:')) return { letterlijk: d };
    const rx = new RegExp('^' + d.split('/').map(s =>
      s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$');
    return { rx };
  });
  return (pad) => vormen.some(v => v.rx ? v.rx.test(pad) : (pad === v.letterlijk || pad.startsWith(v.letterlijk)));
}

/* WAT NOOIT LIEGT, en dit is de kern van de scherpe ronde.

   Met RTG_LIEG=/api/ liegt ALLES, ook /api/auth/register en /api/supplier/login.
   Dan struikelt een toets al bij zijn voorbereiding: hij kan niet meer inloggen,
   en alles daarna zakt vanzelf. Dat is echte afhankelijkheid van echt gedrag,
   dus het telt -- maar het is zwakker bewijs dan een assertie die precies op de
   INHOUD viel, en bij een uitslag van "399 van de 399 gezakt" weet je niet meer
   welke van de twee je hebt gemeten.

   RTG_LIEG_NIET spaart een lijst voorvoegsels. Zet je daar de deuren in
   (/api/auth/, /api/login, /api/supplier/login, /api/office/login), dan komt de
   toets gewoon binnen en liegt alleen zijn eigen domein. Zakt hij dan nog steeds,
   dan kijkt er echt iemand naar de inhoud.

   De infra staat er standaard in en niet als aparte if-tak: de poortwachter
   (server/trio.js) leest /api/health om te zien of een server leeft, en een
   liegende health-check laat de hele opstelling omvallen om een reden die niets
   met de proef te maken heeft. */
const INFRA = ['/api/health', '/api/ready', '/api/cluster/'];

/* De beslissing als losse functie, zodat ze te toetsen is zonder server. Een
   poort die je alleen via een draaiende app kunt nakijken, kijkt niemand na. */
function magLiegen(pad, lieg, niet) {
  if (!pad.startsWith('/api/')) return false;
  const spaar = maakPatroon([INFRA.join(','), niet || ''].filter(Boolean).join(','));
  if (spaar && spaar(pad)) return false;
  const patroon = maakPatroon(lieg);
  return !!(patroon && patroon(pad));
}

module.exports = function liegpoort({ app, log }) {
  const patroon = maakPatroon(process.env.RTG_LIEG);
  if (!patroon) return { actief: false, geraakt: () => [] };
  const niet = process.env.RTG_LIEG_NIET || '';

  const geraakt = new Set();
  /* VOOR alle routes, want het antwoord moet vervangen worden voordat de handler
     eraan komt. De poortwachters blijven ervoor staan: een leugen achter een
     dichte deur zegt niets, en een toets die op een 401 rekent hoort die te
     krijgen. */
  app.use((req, res, next) => {
    if (!magLiegen(req.path, process.env.RTG_LIEG, niet)) return next();
    geraakt.add(req.method + ' ' + req.path);
    res.status(200).json({ ok: true });
  });
  log.info('[lieg] de liegpoort staat AAN voor: ' + process.env.RTG_LIEG +
    (niet ? '  (behalve: ' + niet + ')' : ''));
  return { actief: true, geraakt: () => [...geraakt] };
};

module.exports.magLiegen = magLiegen;
module.exports.INFRA = INFRA;
