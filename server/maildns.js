/* DE MAIL-DNS NAMETEN: staat het er ook echt, en klopt het?

   WAAROM DIT ER IS. scripts/eigenpost.js schrijft de records voor die een mens
   moet publiceren: SPF, DKIM, DMARC en (sinds de ontvanger bestaat) MX plus het
   A-record eronder. Dat is de helft van het werk. De andere helft is nagaan of
   het ook GEBEURD is, en dat deed niemand -- dus was de uitkomst van een goede
   instructie en een vergeten instructie precies hetzelfde: post die niet aankomt
   en niemand die zegt waarom.

   Dit bestand maakt van een VOORSCHRIFT een METING. Het verschil in de praktijk:

     voorschrift   "publiceer een MX-record voor rahultravelgroup.nl"
     meting        "uw MX wijst naar mail.rahultravelgroup.nl, maar daar zit geen
                    A-record onder -- dat is een dood spoor"

   DE RESOLVER GAAT ERIN EN WORDT NIET HIER GEPAKT. Daardoor is dit te beproeven
   met een tabel in plaats van met het internet, en dat is niet alleen sneller:
   een toets die van het echte DNS afhangt, zakt ooit op een storing bij iemand
   anders en leert iedereen om hem te negeren.

   WAT DIT NIET DOET: iets repareren. Een DNS-record publiceren kan dit huis niet
   -- dat gebeurt bij de registrar, en een PTR bij de hostingpartij. Wat het wel
   doet is precies zeggen wat er mis is, zodat het werk dat een mens moet doen
   klein en concreet is. */
'use strict';

// Elke uitkomst heeft deze drie: wat het is, of het klopt, en wat eraan te doen.
const uit = (wat, ok, zegt, doen) => ({ wat, ok, zegt, doen: ok ? '' : (doen || '') });

/* De vraag "wijst dit naar ons" is niet triviaal: een MX-record wijst naar een
   NAAM, en pas het A-record daaronder wijst naar een adres. Beide moeten goed
   zijn, en als er een van de twee ontbreekt hoort dat apart te heten. */
async function mxKlopt(dns, domein, ip) {
  let rijen;
  try { rijen = await dns.resolveMx(domein); }
  catch (e) {
    return [uit('MX', false, 'geen MX-record voor ' + domein + ' (' + (e && e.code) + ')',
      'publiceer:  ' + domein + '  MX  10 mail.' + domein + '.')];
  }
  if (!rijen || !rijen.length) {
    return [uit('MX', false, 'het MX-record is leeg',
      'publiceer:  ' + domein + '  MX  10 mail.' + domein + '.')];
  }
  const namen = rijen.slice().sort((a, b) => a.priority - b.priority).map(r => r.exchange);
  const regels = [uit('MX', true, 'wijst naar ' + namen.join(', '))];

  /* Onder ELKE naam hoort een A-record, en een ervan hoort ons IP te zijn. Een
     MX naar een naam zonder adres is de stilste manier waarop post niet aankomt:
     de verzendende server probeert netjes, vindt niets, en geeft het na dagen op. */
  let raakOns = false;
  for (const naam of namen) {
    let adressen = [];
    try { adressen = await dns.resolve4(naam); } catch (e) { adressen = []; }
    if (!adressen.length) {
      regels.push(uit('A', false, naam + ' heeft geen A-record -- dat is een dood spoor',
        'publiceer:  ' + naam + '  A  ' + (ip || 'UW-IP')));
      continue;
    }
    regels.push(uit('A', true, naam + ' -> ' + adressen.join(', ')));
    if (ip && adressen.includes(ip)) raakOns = true;
  }
  if (ip) {
    regels.push(raakOns
      ? uit('MX->IP', true, 'een van de MX-namen komt uit op ' + ip)
      : uit('MX->IP', false, 'geen enkele MX-naam komt uit op ' + ip,
        'de post gaat nu naar een andere machine dan deze. Zet het A-record goed, of geef het juiste IP mee.'));
  }
  return regels;
}

// Een TXT-record is een lijst stukken die je aan elkaar moet plakken (DNS knipt
// boven de 255 tekens). Wie dat vergeet, mist elke lange DKIM-sleutel.
async function txt(dns, naam) {
  const rijen = await dns.resolveTxt(naam);
  return (rijen || []).map(r => (Array.isArray(r) ? r.join('') : String(r)));
}

async function txtKlopt(dns, naam, wat, begint, doen) {
  let waarden;
  try { waarden = await txt(dns, naam); }
  catch (e) { return uit(wat, false, 'geen ' + wat + '-record op ' + naam + ' (' + (e && e.code) + ')', doen); }
  const raak = waarden.find(v => v.toLowerCase().startsWith(begint));
  if (!raak) return uit(wat, false, 'op ' + naam + ' staat wel een TXT-record, maar geen dat met "' + begint + '" begint', doen);
  /* De VOLLEDIGE waarde gaat mee naast de afgekapte weergave. Zonder dat is een
     half opgehaalde DKIM-sleutel niet van een hele te onderscheiden: allebei
     beginnen ze met "v=DKIM1" en allebei zien ze er in een lijst van 90 tekens
     identiek uit. Precies daar glipte de mutatie doorheen die de TXT-stukken
     niet meer aan elkaar plakte. */
  return Object.assign(uit(wat, true, raak.length > 90 ? raak.slice(0, 90) + '...' : raak), { waarde: raak });
}

/* De PTR: van IP terug naar naam. Grote ontvangers weigeren post van een IP
   waarvan de omgekeerde naam nergens op slaat, ook met een geldige handtekening.
   Dit is het enige record dat NIET bij de registrar staat maar bij de partij die
   het IP uitgeeft, en daarom het record dat het vaakst ontbreekt. */
async function ptrKlopt(dns, ip, helo) {
  if (!ip) return uit('PTR', false, 'geen IP meegegeven, dus niet na te kijken', 'geef het verzendende IP mee');
  let namen;
  try { namen = await dns.reverse(ip); }
  catch (e) {
    return uit('PTR', false, 'geen omgekeerde naam voor ' + ip + ' (' + (e && e.code) + ')',
      'vraag uw hostingpartij een PTR te zetten die gelijk is aan de naam waarmee wij ons voorstellen');
  }
  if (!namen || !namen.length) return uit('PTR', false, 'de omgekeerde naam is leeg', 'zie hierboven');
  if (helo && !namen.some(n => n.toLowerCase() === String(helo).toLowerCase())) {
    return uit('PTR', false, ip + ' heet omgekeerd ' + namen.join(', ') + ', en wij stellen ons voor als ' + helo,
      'maak die twee gelijk: of de PTR aanpassen, of MAIL_HELO gelijkzetten aan ' + namen[0]);
  }
  return uit('PTR', true, ip + ' -> ' + namen.join(', '));
}

/* Alles op een rij. `dns` is de resolver (node:dns/promises, of een tabel in een
   toets). Geeft een lijst uitkomsten en de telling erbij, zodat de aanroeper
   niet zelf hoeft te tellen wat er mis is. */
async function controleer({ dns, domein, ip, selector, helo } = {}) {
  const sel = selector || 'rtg';
  const regels = [];
  regels.push(...await mxKlopt(dns, domein, ip));
  regels.push(await txtKlopt(dns, domein, 'SPF', 'v=spf1',
    'publiceer:  ' + domein + '  TXT  "v=spf1 ip4:' + (ip || 'UW-IP') + ' -all"'));
  regels.push(await txtKlopt(dns, sel + '._domainkey.' + domein, 'DKIM', 'v=dkim1',
    'draai npm run eigenpost en publiceer het DKIM-record dat daar uit komt'));
  regels.push(await txtKlopt(dns, '_dmarc.' + domein, 'DMARC', 'v=dmarc1',
    'publiceer:  _dmarc.' + domein + '  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domein + '"'));
  regels.push(await ptrKlopt(dns, ip, helo));
  return { regels, goed: regels.filter(r => r.ok).length, mis: regels.filter(r => !r.ok).length };
}

module.exports = { controleer, mxKlopt, ptrKlopt, txtKlopt };
