/* De handelsketen, deel "regels": de levensloop en het zicht erop. Zuivere
   functies van (handel, zaak) -- geen database, geen meldingen. Afgesplitst uit
   ../handelsketen.js omdat een productbestand niet over de 10 KB hoort
   (keuringsregel), en omdat dit precies het deel is dat een toets uitputtend
   moet kunnen aflopen zonder server. Het waarom van de keten staat in
   ../handelsketen.js. */
'use strict';

/* De toestanden, en wie er vanaf mag. De sleutel is de toestand waarin de
   handel STAAT, de waarde zegt wie de volgende stap zet. Een tabel en geen reeks
   losse ifs, want dan is de hele levensloop op een plek te lezen. */
const STAPPEN = {
  aanvraag:      { offreren: 'leverancier', gunnen: 'koper', intrekken: 'koper' },
  gegund:        { plannen: 'leverancier', leveren: 'leverancier' },
  gepland:       { leveren: 'leverancier' },
  geleverd:      { factureren: 'leverancier' },
  gefactureerd:  { betalen: 'koper' },
  betaald:       {},
  ingetrokken:   {}
};
const EENHEDEN = ['stuk', 'set', 'kg', 'liter', 'uur', 'dag', 'rit', 'order'];

/* Welke rol heeft deze zaak bij deze handel? De koper is de aanvrager; de
   leverancier is wie de gunning heeft -- of, zolang de aanvraag open staat,
   iedereen in het gevraagde genre. Dat laatste IS het vinden: een wasserij die
   zich gisteren aanmeldde hoort vandaag te kunnen offreren. */
function rolVan(h, s) {
  if (h.koper.code === s.code) return 'koper';
  if (h.gegundAan && h.gegundAan.code === s.code) return 'leverancier';
  if (h.status === 'aanvraag' && s.type === h.genre) return 'leverancier';
  return null;
}

/* De enige poort van de keten: mag deze zaak deze stap nu zetten? Geeft null
   als het mag, en anders de fout met zijn eigen statuscode -- 403 als het niet
   aan jou is, 409 als het niet in deze stand kan. Dat onderscheid is geen
   nettigheid: "u bent niet aan zet" en "dat kan nu niet" zijn voor de
   aanroeper twee verschillende antwoorden. */
function magStap(h, s, stap) {
  const rol = rolVan(h, s);
  if (!rol) return { status: 403, error: 'Deze aanvraag is niet van u.' };
  const nodig = (STAPPEN[h.status] || {})[stap];
  if (!nodig) return { status: 409, error: 'Dat kan niet in de stand "' + h.status + '".' };
  if (nodig !== rol) return { status: 403, error: 'Deze stap is aan de ' + nodig + '.' };
  return null;
}

/* Wat een zaak van een handel mag zien. De prijzen van CONCURRENTEN zijn niet
   van haar: een leverancier ziet zijn eigen offerte en niet die van de buren,
   want anders bepaalt de eerste bieder wat de rest vraagt.

   `mag` gaat mee naar de client, zodat het scherm de levensloop niet hoeft na
   te spelen. Zou het dat wel doen, dan weten twee plekken de volgorde en lopen
   ze uiteen -- dezelfde fout die de PDA had met de caps (LAT-regel 4). */
function publiek(h, s) {
  const rol = rolVan(h, s);
  const isKoper = rol === 'koper';
  return {
    id: h.id, ref: h.ref, titel: h.titel, genre: h.genre, genreLabel: h.genreLabel,
    regels: h.regels, ophalen: h.ophalen, retour: h.retour, status: h.status,
    koper: h.koper, gegundAan: h.gegundAan, planning: h.planning, levering: h.levering,
    factuur: h.factuur, betaaldAt: h.betaaldAt, at: h.at,
    rol: rol || 'geen',
    offertes: isKoper ? h.offertes : h.offertes.filter(o => o.code === s.code),
    mag: Object.entries(STAPPEN[h.status] || {})
      .filter(([, wie]) => wie === rol).map(([stap]) => stap)
  };
}

/* Het overzicht van één zaak: wat ik vraag, wat ik lever, en wat er open staat
   in mijn genre. Die derde lijst is het VINDEN: elke wasserij ziet elke
   linnenaanvraag, ook een wasserij die zich gisteren heeft aangemeld. Zonder
   die lijst is de keten een postbus waar je het adres al van moet weten. */
function overzicht(alles, types, s) {
  return {
    alsKoper: alles.filter(h => h.koper.code === s.code).map(h => publiek(h, s)).reverse(),
    alsLeverancier: alles.filter(h => h.gegundAan && h.gegundAan.code === s.code).map(h => publiek(h, s)).reverse(),
    open: alles.filter(h => h.status === 'aanvraag' && h.genre === s.type && h.koper.code !== s.code)
      .map(h => publiek(h, s)).reverse(),
    genres: Object.entries(types).filter(([id]) => id !== s.type)
      .map(([id, t]) => ({ id, label: t.label, industry: t.industry || null }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label))),
    eenheden: EENHEDEN
  };
}

module.exports = { STAPPEN, EENHEDEN, rolVan, magStap, publiek, overzicht };
