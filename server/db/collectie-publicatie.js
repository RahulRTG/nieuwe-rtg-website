/* Publiceer een reeds GECOMMITTE collectiemutatie terug naar de levende
   werkkopie, zonder gewone mutaties uit hetzelfde proces weg te drukken.

   Een databasebewerking werkt op een geisoleerde kopie en wacht onderweg op
   I/O. In dat wachtvenster kan een normale route db.data wijzigen en save()
   plannen. `db.data[sleutel] = commitWaarde` zou die wijziging na de commit
   alsnog wissen. Daarom is de publicatie een drie-weg-samenvoeging:

     basis  = de levende waarde op het moment dat de werkkopie werd gemaakt
     live   = wat db.data NU bevat (inclusief gewone openstaande mutaties)
     commit = wat de databasebewerking zojuist committe

   Bij een botsing op hetzelfde veld wint de database-transactie. Dat is het
   fail-closed beleid voor beveiligingsstaat: een gewone, verouderde live
   mutatie mag een gecommitte intrekking, teller of nieuwe binding niet
   terugdraaien. Onafhankelijke live velden blijven wel behouden.

   Die basis kan al gewone, openstaande mutaties bevatten die vóór het DB-slot
   ontstonden. Het is NIET de verenigde werkkopie: die kan verse wijzigingen
   van een andere DB-instance bevatten die nog niet in live stonden. Alleen de
   delta tussen deze live-basis en live-nu mag boven op de commit worden gelegd.
   `laatsteJson` blijft bewust de COMMIT-json en niet de samengevoegde live
   waarde. Het verschil tussen beide is precies het nog openstaande werk dat de
   gewone write-behind flush moet zien. Versieboekhouding mag bij twee lokaal
   overlappende commits nooit achteruit lopen.

   Voor economische collecties kan `combineer` domeinspecifieke semantiek
   leveren (bijvoorbeeld een saldo-delta); standaard geldt de hieronder
   vastgelegde commit-wint-merge. */
'use strict';

const { itemSleutel, soort } = require('./merge');

const MIST = Symbol('mist');
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* De gewone merge3 laat bij `ours verwijdert / theirs wijzigt` de wijziging
   winnen. Voor een reeds gecommitte code-intrekking of geheimverwijdering is
   dat onveilig. Deze variant houdt dezelfde recursieve, keybare-arraymerge,
   maar laat COMMIT bij iedere echte botsing winnen, ook als COMMIT verwijdert. */
function commitWint(basis, commit, live, hb = true, hc = true, hl = true) {
  const cAnders = hc !== hb || (hc && hb && !gelijk(commit, basis));
  const lAnders = hl !== hb || (hl && hb && !gelijk(live, basis));
  if (!cAnders) return hl ? live : MIST;
  if (!lAnders) return hc ? commit : MIST;
  if (!hc) return MIST;
  if (!hl || gelijk(commit, live)) return commit;

  const sc = soort(commit), sl = soort(live), sb = hb ? soort(basis) : sc;
  if (sc !== sl || (hb && sb !== sc)) return commit;
  if (sc === 'object') {
    const b = hb ? basis : {}, uit = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(commit), ...Object.keys(live)])) {
      const r = commitWint(b[k], commit[k], live[k], heeft(b, k), heeft(commit, k), heeft(live, k));
      if (r !== MIST) uit[k] = r;
    }
    return uit;
  }
  if (sc === 'array') {
    const b = hb ? basis : [];
    const keybaar = [b, commit, live].every(a => Array.isArray(a) && a.every(x => itemSleutel(x) != null));
    if (!keybaar) return commit;
    const map = a => new Map(a.map(x => [itemSleutel(x), x]));
    const mb = map(b), mc = map(commit), ml = map(live), uit = [];
    for (const k of new Set([...mb.keys(), ...mc.keys(), ...ml.keys()])) {
      const r = commitWint(mb.get(k), mc.get(k), ml.get(k), mb.has(k), mc.has(k), ml.has(k));
      if (r !== MIST) uit.push(r);
    }
    return uit;
  }
  return commit;
}

module.exports = function publiceerCollectie({ dataNu, sleutel, basisJson,
  commitWaarde, commitJson, versie, toegepast, laatsteJson, combineer }) {
  if (!dataNu || !sleutel || typeof basisJson !== 'string' ||
      typeof commitJson !== 'string' || !toegepast || !laatsteJson) {
    throw new Error('Collectiepublicatie mist data, sleutel, basis of cachekaarten.');
  }
  const basis = JSON.parse(basisJson);
  const liveBestaat = heeft(dataNu, sleutel);
  const live = dataNu[sleutel];
  const samen = typeof combineer === 'function'
    ? combineer({ basis, live, commit: commitWaarde })
    : commitWint(basis, commitWaarde, live, true, true, liveBestaat);
  /* Een ongewijzigde transactie op een nog afwezige live collectie hoort die
     key niet als `undefined`/sentinel aan te maken. saveSqlite serialiseert
     iedere aanwezige key; JSON.stringify(undefined).length zou daar crashen. */
  if (samen === MIST || samen === undefined) delete dataNu[sleutel];
  else dataNu[sleutel] = samen;

  const nummer = versie == null ? null : Number(versie);
  const bekend = Number(toegepast.get(sleutel) || 0);
  /* Een andere lokale schrijfbaan kan tussen COMMIT en deze callback al een
     nieuwere DB-versie hebben gepubliceerd. De levende merge blijft nuttig,
     maar haar oudere DB-basis mag de nieuwere cache dan niet terugzetten. */
  /* Geen versie betekent dat er geen autoritatieve DB-rij is geschreven; dan
     mag deze helper ook niet doen alsof commitJson al een DB-basis is. */
  const cacheBijgewerkt = nummer != null && Number.isFinite(nummer) && nummer >= bekend;
  if (cacheBijgewerkt) {
    laatsteJson.set(sleutel, commitJson);
    toegepast.set(sleutel, nummer);
  }
  return { waarde: samen === MIST ? undefined : samen, cacheBijgewerkt };
};
