/* ============================================================================
   DE PERSOONLIJKE VOLGORDE -- wat iemand zelf zei, mag naar voren; meer niet.

   Besluit van de eigenaar (11 oktober 2026), en NEIGING.md noemde het al "een
   stap weg": neigingen mogen de volgorde in een projectie beinvloeden, en die
   weging hoort HIER (ADAPT-05: de laag die iets toont beslist de volgorde, niet
   de laag die de voorkeur bewaart). Vijf regels, en alle vijf staan in de code:

   1. ALLEEN WAT GEZEGD OF GEKOZEN IS. `afgeleid` telt nooit mee, ook niet als
      hij nog geldig is -- een vermoeden van RTG hoort niet te bepalen wat een
      lid als eerste ziet. Dat is strenger dan de graadladder van
      kern/neiging/ladder.js, en met opzet.
   2. EEN STABIELE TWEEDELING, GEEN SCORE. Wat bij zo'n neiging hoort komt eerst,
      in de volgorde waarin de domeinen het leverden; de rest erna, ook in die
      volgorde. Er wordt niets opgeteld, gewogen of gesorteerd op een getal --
      twee neigingen maken een object niet "belangrijker" dan een.
   3. NIETS VERDWIJNT. Dezelfde objecten, alleen in een andere volgorde
      (ADAPTIEF.md: verbergen bestaat niet).
   4. ELKE VERSCHUIVING DRAAGT HAAR REDEN IN WOORDEN, op het object zelf. Een
      object dat naar voren kwam zonder dat iemand kan zien waarom, is een
      ondoorzichtige ranking.
   5. DE KOPPELING WORDT NIET UITGEVONDEN. Een neiging wijst via de vragenlijst
      (kern/neiging/vraag-lijst.js) naar sleutels in public/shared/sprongindex.json
      -- de enige lijst onderdelen van dit huis -- en die naar een adres. Een
      object hoort bij een neiging als zijn deepLink naar dat adres wijst. Er is
      hier geen tweede indeling.

   GEEN OPSLAG en geen kennis van wie er kijkt: alles komt als argument binnen. */
'use strict';

const MEETELLEND = Object.freeze(['gezegd', 'gekozen']);

/* Het pad van een adres, zonder hash of query: /apps/geld.html#x en
   /apps/geld.html zijn hetzelfde onderdeel. */
const padVan = (u) => String(u || '').split('#')[0].split('?')[0];

/* `neigingen` zoals kern.neiging.lees() ze geeft; `wijstVan(onderwerp)` de
   sleutels uit de vragenlijst; `adresVan(sleutel)` het adres uit de sprongindex. */
function persoonlijk(objects, neigingen, { wijstVan, adresVan, labelVan }) {
  const rij = Array.isArray(objects) ? objects : [];
  const bruikbaar = (Array.isArray(neigingen) ? neigingen : [])
    .filter((n) => n && n.telt && MEETELLEND.includes(n.grond));
  if (!bruikbaar.length) return { objects: rij, persoonlijk: false,
    uitleg: 'De volgorde is die waarin de onderdelen hun gegevens leverden; er is geen gezegde of gekozen voorkeur om op te letten.' };

  /* Per adres de eerste neiging die erheen wijst. EERSTE en geen optelling:
     zie regel 2. */
  const reden = new Map();
  for (const n of bruikbaar) {
    for (const sleutel of (wijstVan(n.onderwerp) || [])) {
      const adres = padVan(adresVan(sleutel));
      if (!adres || reden.has(adres)) continue;
      const wat = labelVan(n.onderwerp) || n.onderwerp;
      reden.set(adres, n.grond === 'gezegd'
        ? 'Eerder getoond omdat je zelf zei dat ' + wat + ' bij je past.'
        : 'Eerder getoond omdat je ' + wat + ' vaker koos.');
    }
  }
  const voor = [], na = [];
  for (const o of rij) {
    const r = reden.get(padVan(o && o.deepLink));
    if (r) voor.push(Object.assign({}, o, { reden: r })); else na.push(o);
  }
  return { objects: voor.concat(na), persoonlijk: voor.length > 0,
    uitleg: voor.length
      ? voor.length + ' onderdeel/onderdelen staan eerder omdat je dat zelf zei of koos; de rest staat in de volgorde ' +
        'waarin de onderdelen hun gegevens leverden. Er is niets weggelaten, en wat RTG alleen vermoedt telt niet mee.'
      : 'Je voorkeuren raken geen van deze onderdelen, dus de volgorde is ongewijzigd.' };
}

/* Alleen onderdelen met een EIGEN adres: een tab staat in de sprongindex als
   /apps/app.html#tab=..., en zonder hash zou dat elk object op de app-schil raken. */
const ZONDER_EIGEN_URL = new Set(['tab', 'os']);
const ADRES = new Map((require('../../../public/shared/sprongindex.json').items || [])
  .filter((i) => i.sleutel && i.url && !ZONDER_EIGEN_URL.has(i.soort)).map((i) => [i.sleutel, i.url]));

/* De aansluiting voor ./projections.js: leest de neigingen van dit lid met doel
   `tonen`. Is de laag er niet of faalt hij, dan blijft de volgorde staan en zegt
   de uitleg dat -- een stille terugval leest als "je hebt geen voorkeuren". */
function maakOrdening(kern) {
  return function ordenVoor(key, objects) {
    const n = kern && kern.neiging;
    if (!n || typeof n.lees !== 'function') return { objects, persoonlijk: false,
      uitleg: 'Er is geen voorkeurslaag aangesloten; de volgorde is die waarin de onderdelen hun gegevens leverden.' };
    try {
      const r = n.lees(key, 'tonen');
      return persoonlijk(objects, (r && r.neigingen) || [],
        { wijstVan: n.wijstVan, adresVan: (s) => ADRES.get(s), labelVan: n.labelVan });
    } catch (e) {
      return { objects, persoonlijk: false, uitleg: 'De voorkeuren waren niet te lezen; de volgorde is ongewijzigd.' };
    }
  };
}

module.exports = { persoonlijk, maakOrdening, MEETELLEND, ADRES };
