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

   WAT HIER NIET GEBEURT: de handeling zelf. `doe` komt uit het domein dat hem
   bezit (zie ./handelingen.js). Deze laag controleert, laat een mens bevestigen,
   voert de opdracht van het domein uit en schrijft de bon. */
'use strict';

const rem = require('./rem');

const MAX_OPEN = 20000;
const UUR = 60 * 60 * 1000;

module.exports = (opties) => {
const { crypto, dyncodeGeef, codenaamVan, bonSchrijf, handelingen, rate, nu } = opties;

const open = new Map();               // verwijzing -> gebonden opdracht
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
  const opdracht = def.lees(invoer, uitgever);
  if (!opdracht || opdracht.error) return opdracht || { status: 400, error: 'Deze opdracht kan niet.' };
  opruimen();
  if (open.size > MAX_OPEN) return { status: 503, error: 'Even te druk. Probeer het zo opnieuw.' };
  const verwijzing = crypto.randomBytes(9).toString('base64url');
  const cap = { handeling: def.id, uitgeverKey: uitgever.key, uitgeverSoort: uitgever.soort,
    opdracht, vervalt: klok() + def.ttlMs };
  open.set(verwijzing, cap);
  const c = d.maak({ soort: 'cap', code: verwijzing, ttlMs: def.ttlMs });
  return { status: 200, token: c.token, exp: c.exp, ttlMs: c.ttlMs, kaart: kaartVan(cap) };
}

/* Kijken wat er in staat -- en niets doen. De code gaat hier bewust NIET op:
   een blik op de verkeerde code mag die van iemand anders niet verbranden. */
const WEG = 'Deze code is verlopen, al gebruikt, of hoort bij niets.';
function capKijk(kijker, token) {
  const r = losOp(token);
  if (r.fout === 'geen-codelaag') return { status: 503, error: 'De codelaag draait hier niet.' };
  if (r.fout) { if (r.mis) rem.misserGeteld(); return { status: 404, error: WEG }; }
  return { status: 200, kaart: kaartVan(r.cap), eigen: !!(kijker && kijker.key && kijker.key === r.cap.uitgeverKey) };
}

/* En dan pas uitvoeren. De volgorde is de weg van LINK.md par. 2: controleren,
   laten bevestigen (dat gebeurde op het scherm, voordat dit loket werd geroepen),
   uitvoeren, bon.

   DE CODE GAAT PAS OP ALS HET GELUKT IS. Zou hij bij het begin opgaan, dan is een
   vraag met te weinig saldo een vraag die je niet nog een keer kunt beantwoorden.
   Tegen dubbel indrukken staat de idempotentiesleutel: het domein krijgt de
   verwijzing mee en kan er zijn eigen "dit heb ik al gedaan" op zetten. */
async function capAanvaard(aanvaarder, token, sessie) {
  const r = losOp(token);
  if (r.fout === 'geen-codelaag') return { status: 503, error: 'De codelaag draait hier niet.' };
  if (r.fout) { if (r.mis) rem.misserGeteld(); return { status: 404, error: WEG }; }
  const def = handelingen.haal(r.cap.handeling);
  if (!def) return { status: 500, error: 'Deze handeling bestaat niet meer.' };
  if (!def.aanvaarder.includes(aanvaarder.soort)) return { status: 403, error: 'Deze code is niet voor u bedoeld.' };
  if (!aanvaarder.key) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
  if (aanvaarder.key === r.cap.uitgeverKey) return { status: 400, error: 'Dat is je eigen code.' };

  const kaart = kaartVan(r.cap);
  const uit = await def.doe({ opdracht: r.cap.opdracht, uitgeverKey: r.cap.uitgeverKey,
    aanvaarder, sessie, idem: 'cap:' + r.verwijzing });
  if (!uit || uit.error) return uit || { status: 500, error: 'De handeling gaf geen antwoord.' };
  if (def.eenmalig) open.delete(r.verwijzing);

  /* Twee bonnen, en dat is hier geen dubbeling. De aanvaarder deed iets (hij
     bevestigde); de uitgever zag zijn code gebruikt worden -- en dat tweede is
     precies het signaal waarmee hij merkt dat er een code van hem rondgaat.
     Dezelfde gedachte als de herkomst bij een verzoek via de contactpin. */
  bonSchrijf({ wie: aanvaarder.key, type: 'capability', intentie: r.cap.handeling,
    vorm: 'levend', naar: r.cap.uitgeverKey });
  bonSchrijf({ wie: r.cap.uitgeverKey, type: 'capability', intentie: r.cap.handeling + '.gebruikt',
    vorm: 'levend', naar: aanvaarder.key });
  return { status: 200, ok: true, kaart, uitkomst: uit };
}

/* Intrekken zolang er niets is gebeurd. Er komt geen bon van: intrekken sluit
   een deur die nooit is doorgelopen, en een bon zonder daad is een bon die niets
   zegt (LINK.md par. 3.6 gaat over het omgekeerde geval -- daar is er wel iets
   gebeurd, en dan blijft het staan). */
function capTrek(uitgever, token) {
  const r = losOp(token);
  if (r.fout) return { status: 404, error: WEG };
  if (!uitgever.key || uitgever.key !== r.cap.uitgeverKey)
    return { status: 403, error: 'Deze code is niet van u.' };
  open.delete(r.verwijzing);
  return { status: 200, ok: true };
}

return { capMaak, capKijk, capAanvaard, capTrek, capOpen: open, capHandelingen: handelingen.alle };
};
