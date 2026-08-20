/* RTG Link: DE CAPABILITY -- een code die geen ding aanwijst maar een HANDELING
   draagt: wie, wat, waarop, hoe lang, en een keer. Zie LINK.md par. 0 en 3.4.

   HET VERSCHIL MET DE REST VAN DEZE LAAG. Een pin, een tafel en een entree zijn
   ADRESSEN: ze wijzen iets aan en er gebeurt pas iets als een mens daarna een
   weg kiest. Een capability draagt de weg al in zich -- "betaal mij 18,50 voor
   diner" -- en daarom gelden er andere regels. Hij leeft minuten, hij is een
   keer te gebruiken, en hij is in te trekken zolang hij niet gebruikt is.

   DE INHOUD ZIT ER NIET IN, en dat is de belangrijkste keuze in dit bestand.
   De code draagt een verse, willekeurige VERWIJZING; wat de handeling is, staat
   hier in het geheugen. Wie de QR fotografeert, houdt een string over die naar
   niets meer wijst -- en, minstens zo belangrijk, kan er niet aan aflezen dat
   iemand geld vraagt en hoeveel. Een zelfdragende code (alles in het token,
   alleen ondertekend) zou dat wel doen: de romp van een RTG-code is gewoon
   base64. Zelfde keuze en dezelfde reden als bij de levende contactcode
   (kern/sociaal/pin-live.js).

   IN HET GEHEUGEN, EN DAT HOORT ZO. Ze leven hooguit vijf minuten, ze horen een
   herstart niet te overleven en er hoort niets van in een back-up te komen. Een
   openstaande vraag die een nacht in de database blijft liggen, is precies het
   blijvende ding dat LINK.md par. 3.4 verbiedt.

   DRIE BESTANDEN, DRIE ONDERWERPEN, dezelfde knip als bij de contactpin. Hier
   woont het BEZIT: de kluis met openstaande codes, het uitgeven, het opzoeken en
   de kaart. Het AANVAARDEN staat in ./cap-in.js -- daar staat alles wat een
   aanvaller raakt, en daar wordt de handeling van het domein uitgevoerd. Het
   BEHEER (wat staat er van mij open, en hoe haal ik het weg) staat in
   ./cap-beheer.js: dat is de kant van de uitgever, met een eigen naam per code
   en zonder token. */
'use strict';

const rem = require('./rem');

const MAX_OPEN = 20000;
const UUR = 60 * 60 * 1000;

module.exports = (opties) => {
const { crypto, dyncodeGeef, codenaamVan, bonSchrijf, handelingen, rate, nu } = opties;

const open = new Map();               // verwijzing -> gebonden opdracht

/* HET ENE ANTWOORD voor alles wat niets oplevert: vreemd, gemanipuleerd,
   verlopen, opgebruikt, ingetrokken, of het ding eronder is weg. Hij staat hier
   en gaat mee naar de deur; hij stond even alleen dáár, en toen greep capTrek
   naar een naam die hij niet had -- niet gevonden door een toets (dat pad raakte
   er geen), maar door regel 50 van de keuring. */
const WEG = 'Deze code is verlopen, al gebruikt, of hoort bij niets.';

/* WIE IEMAND IS, in een laag die niet alleen leden bedient. Een lid heeft een
   sleutel; een zaak heeft een code en geen sleutel. Zonder deze ene functie zou
   "is dit je eigen code?" en "onder wiens naam komt de bon?" per rol anders
   worden uitgerekend, en dan klopt er op een dag een van de twee niet. */
const idVan = (x) => (x && x.key) ? x.key : ((x && x.code) ? x.soort + ':' + x.code : null);
const klok = typeof nu === 'function' ? nu : () => Date.now();
const dyn = () => (typeof dyncodeGeef === 'function' ? dyncodeGeef() : null);

/* De bezem, niet de bewaker: hij houdt het geheugen klein en draait alleen waar
   de Map groeit. Of een code nog geldt, wordt op EEN plek besloten (losOp
   hieronder). Dezelfde rolverdeling als in pin-live.js, en om dezelfde reden:
   twee mechanismen voor een besluit is geen van beide verantwoordelijk. */
function opruimen() {
  const t = klok();
  for (const [v, x] of open) if (x.vervalt < t) open.delete(v);
}

/* Van token naar de gebonden opdracht erachter. Geeft null bij elke reden --
   vreemd, gemanipuleerd, verlopen, opgebruikt, ingetrokken -- want het verschil
   hoort niets te verklappen. `mis` zegt of dit als misser telt: een geldige
   handtekening bewijst dat de code van ons kwam, dus een verlopen code is geen
   raadster maar iemand met een oud scherm. */
function losOp(token) {
  const d = dyn();
  if (!d) return { fout: 'geen-codelaag' };
  const r = d.lees(token);
  if (!r.ok || r.soort !== 'cap') return { fout: 'weg', mis: r.reden !== 'verlopen' };
  const x = open.get(r.code);
  if (!x || x.vervalt < klok()) { open.delete(r.code); return { fout: 'weg' }; }
  return { verwijzing: r.code, cap: x };
}

/* Het bedoelingsscherm: wie, wat, waarom, welke gegevens, hoe lang. De naam komt
   uit de codenaam van de uitgever en nooit uit de kluis (LINK.md par. 3.5) -- de
   capability draagt zelf geen naam, ook niet in het geheugen. */
function kaartVan(cap) {
  const def = handelingen.haal(cap.handeling);
  const b = def.beschrijf(cap.opdracht) || {};
  return { handeling: cap.handeling, wat: b.wat || def.wat, waarom: b.waarom || null,
    /* `velden` is waar het domein zijn eigen detail kwijt kan (een bedrag, een
       reisnummer) -- al opgemaakt, want deze laag weet niet wat een euro is. */
    velden: Array.isArray(b.velden) ? b.velden : [],
    gegevens: Array.isArray(b.gegevens) ? b.gegevens : [],
    van: cap.uitgeverKey ? codenaamVan(cap.uitgeverKey) : null,
    eenmalig: def.eenmalig, tot: new Date(cap.vervalt).toISOString() };
}

/* Een capability uitgeven. De invoer gaat eerst door het DOMEIN (def.lees), want
   die weet wat een geldig bedrag of een geldige bron is; deze laag kent alleen
   de vorm eromheen. */
function capMaak(uitgever, invoer) {
  const d = dyn();
  if (!d) return { status: 503, error: 'De codelaag draait hier niet.' };
  const def = handelingen.haal(invoer && invoer.handeling);
  if (!def) return { status: 404, error: 'Deze handeling kennen we niet.' };
  if (!def.uitgever.includes(uitgever.soort)) return { status: 403, error: 'Deze code mag u niet maken.' };
  if (!uitgever.key) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
  /* De rem hangt aan de UITGEVER en niet aan de deur, en dat is hier de juiste
     kant: er valt niets te raden aan het maken van je eigen code. Wat je wel wil
     tegenhouden is een lid dat er duizend per minuut de wereld in pompt. */
  if (typeof rate === 'function' && !rate(uitgever.key, 'capmaak', 60, UUR))
    return { status: 429, error: 'Te veel codes achter elkaar. Probeer het later opnieuw.' };
  /* Ruimte maken VOOR het lezen, want lezen kan iets kosten. De kassacode maakt
     in zijn `lees` een echte code aan bij RTG Pay; zouden we daarna pas op de
     drukte stuiten, dan hebben we een code de wereld in geholpen waar geen enkel
     token bij hoort -- en die verdringt bij dat lid de code die hij wel had. */
  opruimen();
  if (open.size > MAX_OPEN) return { status: 503, error: 'Even te druk. Probeer het zo opnieuw.' };
  const opdracht = def.lees(invoer, uitgever);
  if (!opdracht || opdracht.error) return opdracht || { status: 400, error: 'Deze opdracht kan niet.' };
  const verwijzing = crypto.randomBytes(9).toString('base64url');
  /* TWEE NAMEN VOOR EEN CODE, EN DAT IS GEEN VERDUBBELING. De VERWIJZING zit in
     het ondertekende token en verzilvert; het ID staat in de lijst "mijn
     koppelingen" en beheert (intrekken). Zou het dezelfde string zijn, dan draagt
     een beheerscherm -- en elk logboek en elke schermafdruk daarvan -- het deel
     waarmee je hem kunt gebruiken. Nu kan een gelekt id hooguit iets DICHTdoen
     van iemand die het al mocht, en dat is de goede kant om fout te gaan. */
  const id = crypto.randomBytes(6).toString('base64url');
  const cap = { handeling: def.id, id, uitgeverId: idVan(uitgever), uitgeverKey: uitgever.key || null,
    uitgeverSoort: uitgever.soort, opdracht, vervalt: klok() + def.ttlMs };
  open.set(verwijzing, cap);
  const c = d.maak({ soort: 'cap', code: verwijzing, ttlMs: def.ttlMs });
  /* Wat alleen de UITGEVER te zien krijgt, en de scanner nooit. De kassacode
     heeft dat nodig: het lid moet zijn code ook kunnen voorlezen aan een kassa
     zonder camera, maar diezelfde code op de kaart zetten zou hem aan iedereen
     geven die scant. */
  const eigen = typeof def.voorUitgever === 'function' ? def.voorUitgever(opdracht) : null;
  return { status: 200, token: c.token, exp: c.exp, ttlMs: c.ttlMs, kaart: kaartVan(cap), eigen };
}

/* Kijken wat er in staat -- en niets doen. De code gaat hier bewust NIET op:
   een blik op de verkeerde code mag die van iemand anders niet verbranden. */
/* De deur krijgt het gereedschap mee dat hij nodig heeft en raakt de kluis
   verder niet aan: opzoeken, de kaart maken, weten wie iemand is. */
/* `verbruik` en niet de Map zelf: de deur mag een code OPGEBRUIKEN, niet in de
   kluis rondlopen. Dat de deur de Map wel kreeg (en er per ongeluk buiten zijn
   bereik naar greep) is precies wat er bij de knip misging -- het opgaan van een
   eenmalige code deed niets meer, en test/linkcap.test.js zag het meteen. */
const verbruik = (verwijzing) => open.delete(verwijzing);
const { capKijk, capAanvaard } = require('./cap-in')({ losOp, kaartVan, idVan, verbruik, handelingen, bonSchrijf, WEG });
/* Het beheer krijgt de kluis zelf, want "wat staat er van mij open" is een vraag
   over de hele kluis en niet over een code. Hij mag lezen en weghalen, meer niet. */
const { capOpenVan, capTrek } = require('./cap-beheer')({ open, losOp, kaartVan, idVan, opruimen, klok, WEG });

return { capMaak, capKijk, capAanvaard, capTrek, capOpenVan, capOpen: open, capHandelingen: handelingen.alle };
};
