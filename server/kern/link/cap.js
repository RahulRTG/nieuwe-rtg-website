/* RTG Link: DE CAPABILITY -- een code die geen ding aanwijst maar een HANDELING
   draagt: wie, wat, waarop, hoe lang, en een keer. Zie LINK.md par. 0 en 3.4.

   HET VERSCHIL MET DE REST VAN DEZE LAAG. Een pin, een tafel en een entree zijn
   ADRESSEN: ze wijzen iets aan en er gebeurt pas iets als een mens daarna een
   weg kiest. Een capability draagt de weg al in zich -- "betaal mij 18,50 voor
   diner" -- en daarom gelden er andere regels. Hij leeft minuten, hij is een
   keer te gebruiken, en hij is in te trekken zolang hij niet gebruikt is.

   DE INHOUD ZIT ER NIET IN, en dat is de belangrijkste keuze in dit bestand.
   De code draagt een verse, willekeurige VERWIJZING van 128 bits; wat de
   handeling is, staat in ./cap-bak.js -- als hash plus een opdracht die met de
   code zelf is versleuteld. Wie de QR fotografeert, kan er niet aan aflezen dat
   iemand geld vraagt en hoeveel. Een zelfdragende code (alles in het token,
   alleen ondertekend) zou dat wel doen: de romp van een RTG-code is base64.

   NIET MEER IN HET GEHEUGEN (besluit B15, 29 september 2026). De kluis was een
   Map in het procesgeheugen met een verwijzing van 72 bits als sleutel: niet
   hash-only, en een claim of intrekking op de ene instance bestond niet voor de
   andere. Nu staat hij in een collectietransactie (./cap-bak.js), met dezelfde
   korte geldigheid en een bezem die hem minuten na het verval weghaalt.

   VIER BESTANDEN, VIER ONDERWERPEN. Hier woont het uitgeven en de kaart; de
   kluis zelf (hash, verval, claim, intrekken) staat in ./cap-bak.js. Het AANVAARDEN staat in ./cap-in.js -- daar staat alles wat een
   aanvaller raakt, en daar wordt de handeling van het domein uitgevoerd. Het
   BEHEER (wat staat er van mij open, en hoe haal ik het weg) staat in
   ./cap-beheer.js: dat is de kant van de uitgever, met een eigen naam per code
   en zonder token. */
'use strict';

const MAX_OPEN = 20000;
const UUR = 60 * 60 * 1000;

module.exports = (opties) => {
const { db, crypto, bewerkCollectie, dyncodeGeef, codenaamVan, bonSchrijf, handelingen, rate, nu } = opties;
const bak = require('./cap-bak')({ db, crypto, bewerkCollectie, nu });

/* HET ENE ANTWOORD voor alles wat niets oplevert: vreemd, gemanipuleerd,
   verlopen, opgebruikt, ingetrokken, of het ding eronder is weg. Hij staat hier
   en gaat mee naar de deur en het beheer. */
const WEG = 'Deze code is verlopen, al gebruikt, of hoort bij niets.';

/* WIE IEMAND IS, in een laag die niet alleen leden bedient. Een lid heeft een
   sleutel; een zaak heeft een code en geen sleutel. Zonder deze ene functie zou
   "is dit je eigen code?" en "onder wiens naam komt de bon?" per rol anders
   worden uitgerekend, en dan klopt er op een dag een van de twee niet. */
const idVan = (x) => (x && x.key) ? x.key : ((x && x.code) ? x.soort + ':' + x.code : null);
const dyn = () => (typeof dyncodeGeef === 'function' ? dyncodeGeef() : null);

/* Van token naar de verwijzing erin: alleen de ondertekening en de vorm. Een
   geldige handtekening bewijst dat de code van ons kwam, dus een verlopen of
   oude code (72 bits, van voor B15) is geen raadster maar iemand met een oud
   scherm -- `mis` telt alleen de vreemde of vervalste. */
function lees(token) {
  const d = dyn();
  if (!d) return { fout: 'geen-codelaag' };
  const r = d.lees(token);
  if (!r.ok || r.soort !== 'cap') return { fout: 'weg', mis: r.reden !== 'verlopen' };
  if (!bak.vormKlopt(r.code)) return { fout: 'weg' };
  return { code: r.code };
}

/* Het bedoelingsscherm: wie, wat, waarom, welke gegevens, hoe lang. De naam komt
   uit de codenaam van de uitgever en nooit uit de kluis (LINK.md par. 3.5); de
   beschrijving is bij het uitgeven door het DOMEIN gemaakt en draagt geen
   geheim. */
function kaartVan(rij) {
  const def = handelingen.haal(rij.handeling) || {};
  const b = rij.beschrijving || {};
  return { handeling: rij.handeling, wat: b.wat || def.wat, waarom: b.waarom || null,
    velden: Array.isArray(b.velden) ? b.velden : [],
    gegevens: Array.isArray(b.gegevens) ? b.gegevens : [],
    van: rij.uitgeverKey ? codenaamVan(rij.uitgeverKey) : null,
    eenmalig: !!def.eenmalig, tot: new Date(rij.vervalt).toISOString() };
}

/* Een capability uitgeven. De invoer gaat eerst door het DOMEIN (def.lees), want
   die weet wat een geldig bedrag of een geldige bron is; deze laag kent alleen
   de vorm eromheen. */
async function capMaak(uitgever, invoer) {
  const d = dyn();
  if (!d) return { status: 503, error: 'De codelaag draait hier niet.' };
  const def = handelingen.haal(invoer && invoer.handeling);
  if (!def) return { status: 404, error: 'Deze handeling kennen we niet.' };
  if (!def.uitgever.includes(uitgever.soort)) return { status: 403, error: 'Deze code mag u niet maken.' };
  if (!uitgever.key) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
  /* De rem hangt aan de UITGEVER: er valt niets te raden aan het maken van je
     eigen code, maar een lid dat er duizend per minuut uitpompt houd je tegen. */
  if (typeof rate === 'function' && !rate(uitgever.key, 'capmaak', 60, UUR))
    return { status: 429, error: 'Te veel codes achter elkaar. Probeer het later opnieuw.' };
  /* De drukte VOOR het lezen, want lezen kan iets kosten: de kassacode maakt in
     zijn `lees` een echte code aan bij RTG Pay. */
  if (bak.aantalOpen() > MAX_OPEN) return { status: 503, error: 'Even te druk. Probeer het zo opnieuw.' };
  const opdracht = await def.lees(invoer, uitgever);
  if (!opdracht || opdracht.error) return opdracht || { status: 400, error: 'Deze opdracht kan niet.' };
  const beschrijving = def.beschrijf(opdracht) || {};
  const g = await bak.uitgeven({ handeling: def.id, ttlMs: def.ttlMs, eenmalig: def.eenmalig,
    uitgever: { id: idVan(uitgever), key: uitgever.key || null, soort: uitgever.soort }, opdracht, beschrijving });
  /* TWEE NAMEN VOOR EEN CODE, EN DAT IS GEEN VERDUBBELING. De 128-bit code zit
     in het ondertekende token en verzilvert; het ID staat in "mijn koppelingen"
     en kan hooguit iets DICHTdoen van wie het al mocht. De kale code bestaat
     alleen in DIT antwoord. */
  const c = d.maak({ soort: 'cap', code: g.code, ttlMs: Math.max(1000, g.vervalt - Date.now()) });
  /* Wat alleen de UITGEVER te zien krijgt, en de scanner nooit (de kassacode die
     het lid aan een kassa zonder camera voorleest). */
  const eigen = typeof def.voorUitgever === 'function' ? def.voorUitgever(opdracht) : null;
  const kaart = kaartVan({ handeling: def.id, beschrijving,
    uitgeverKey: uitgever.key || null, vervalt: g.vervalt });
  return { status: 200, token: c.token, exp: c.exp, ttlMs: c.ttlMs, kaart, eigen };
}

/* De deur krijgt het gereedschap mee dat hij nodig heeft en raakt de bak verder
   niet aan: lezen, de kaart maken, weten wie iemand is, en de vier overgangen
   van de claim. */
const { capKijk, capAanvaard } = require('./cap-in')({ lees, bak, kaartVan, idVan, handelingen, bonSchrijf, WEG });
const { capOpenVan, capTrek } = require('./cap-beheer')({ lees, bak, kaartVan, idVan, WEG });

/* `idVan` gaat mee naar buiten omdat de DEUR dezelfde vraag heeft: onder welke
   naam staan de bonnen van wie er aanklopt. */
return { capMaak, capKijk, capAanvaard, capTrek, capOpenVan, capBak: bak,
  capHandelingen: handelingen.alle, idVan };
};
