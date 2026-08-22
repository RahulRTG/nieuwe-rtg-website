/* BRON-ADAPTER: de TEDB-vorm (btw-tarieven per land).

   DE OFFICIELE BRON voor de btw-tarieven van de EU is de Taxes in Europe
   Database van de Europese Commissie (TEDB), die een SOAP-dienst aanbiedt.
   Daaromheen bestaan spiegels die diezelfde gegevens als JSON aanbieden. Wat ze
   allemaal delen is het VOCABULAIRE, en dat is wat deze adapter kent:

     standard         het standaardtarief
     reduced          een of meer verlaagde tarieven
     super_reduced    het extra verlaagde tarief
     parking          het parkeertarief
     effectiveFrom    vanaf wanneer

   HET PROBLEEM DAT DEZE ADAPTER OPLOST -- EN WAT HIJ WEIGERT.

   Een tarievenbron zegt WELKE TARIEVEN een land kent. Hij zegt NIET welke
   categorie welk tarief krijgt, en dat is precies wat RTG bewaart. Kijk naar
   het verschil:

     NL   eten 9   (verlaagd)      DE   eten 19  (standaard!)
     NL   logies 9 (verlaagd)      DE   logies 7 (verlaagd)

   In Duitsland valt een restaurantmaaltijd onder het STANDAARDtarief en een
   hotelovernachting onder het verlaagde. In Nederland allebei verlaagd. Dezelfde
   "reduced rate" landt dus in het ene land op eten en in het andere niet -- dat
   is een juridische toewijzing per land, en geen tarievenbron ter wereld levert
   hem mee.

   Wat deze adapter daarom doet:

     AUTOMATISCH   het standaardtarief. Dat is eenduidig: `standard` is
                   `tarieven.standaard`, in elk land, zonder oordeel.
     SIGNALEREN    verandert een verlaagd tarief, dan wordt er NIETS toegewezen.
                   In plaats daarvan komt er een signaal: "eten staat bij ons op
                   9%, maar dat tarief bestaat in deze bron niet meer; de
                   verlaagde tarieven zijn nu 10%." Een mens beslist.
     NOOIT         een categorie een tarief geven dat de bron niet over die
                   categorie heeft gezegd.

   Dat is dezelfde regel als in kern/fiscaal/zekerheid.js: automatiseer wat
   objectief automatiseerbaar is, en maak nergens zekerheid waar die niet is. Een
   adapter die de verlaagde tarieven "slim" verdeelt, levert een tabel op die er
   goed uitziet en in de helft van de landen fout is. */
'use strict';

const getal = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : null;
};

/* De verlaagde tarieven van een land uit de bron halen, als vlakke lijst.
   Bronnen schrijven dit verschillend op (een getal, een lijst, of allebei), dus
   dit accepteert beide vormen en maakt er een gesorteerde lijst van. */
function verlaagde(rij) {
  const uit = new Set();
  for (const sleutel of ['reduced', 'reduced1', 'reduced2', 'super_reduced', 'superReduced', 'parking']) {
    const w = rij[sleutel];
    if (Array.isArray(w)) { for (const x of w) { const n = getal(x); if (n !== null) uit.add(n); } }
    else { const n = getal(w); if (n !== null) uit.add(n); }
  }
  return [...uit].sort((a, b) => a - b);
}

/* De categorieen die in ONZE tabel een ander tarief dragen dan het
   standaardtarief. Dat zijn precies de categorieen waarvoor een verlaagd tarief
   is toegewezen, en dus de categorieen die een mens moet nalopen als dat
   verlaagde tarief verschuift. `jet` blijft erbuiten: 0% voor internationaal
   personenvervoer is een REGEL en geen tariefkeuze. */
function verlaagdeCategorieen(tarieven) {
  const std = tarieven.standaard;
  return Object.keys(tarieven).filter(c => c !== 'standaard' && c !== 'jet' && tarieven[c] !== std);
}

/* De vertaling. `ruw` is wat de bron levert: { landen: { NL: {standard, reduced,
   ...} } } of een lijst rijen met een `country`-veld. `huidig` is de
   LANDEN-tabel zoals hij nu geldt -- nodig om te zien wat er verandert.

   Geeft twee dingen apart terug, en dat is de hele opzet: `landen` mag zo de
   Regelwacht in, `signalen` is werk voor een mens. */
function vertaal(ruw, huidig) {
  const rijen = Array.isArray(ruw) ? ruw
    : Array.isArray(ruw && ruw.rates) ? ruw.rates
      : Object.entries((ruw && ruw.landen) || (ruw && ruw.rates) || ruw || {})
        .map(([code, r]) => Object.assign({ country: code }, r));

  const landen = {};
  const signalen = [];
  for (const rij of rijen) {
    if (!rij || typeof rij !== 'object') continue;
    const cc = String(rij.country || rij.code || rij.land || '').toUpperCase();
    const nu = huidig && huidig[cc];
    if (!cc || !nu || !nu.tarieven) continue;

    const std = getal(rij.standard != null ? rij.standard : rij.standaard);
    if (std !== null && std !== nu.tarieven.standaard) landen[cc] = { tarieven: { standaard: std } };

    /* De verlaagde kant: NIET toewijzen, wel nakijken. Een categorie die bij ons
       een tarief draagt dat in de bron niet meer voorkomt, is het signaal. */
    const bron = verlaagde(rij);
    if (!bron.length) continue;
    for (const cat of verlaagdeCategorieen(nu.tarieven)) {
      const onsTarief = nu.tarieven[cat];
      if (bron.includes(onsTarief)) continue;
      signalen.push({ land: cc, categorie: cat, onsTarief, bronTarieven: bron,
        let: 'Bij ons staat ' + cat + ' in ' + cc + ' op ' + onsTarief + '%, maar dat tarief komt in deze bron niet voor. ' +
          'De verlaagde tarieven daar zijn nu ' + bron.join('%, ') + '%. Welke categorie welk tarief krijgt, ' +
          'zegt deze bron niet -- dat is een toewijzing die een mens maakt.' });
    }
  }
  return { landen, signalen };
}

module.exports = { vertaal, verlaagde, verlaagdeCategorieen };
