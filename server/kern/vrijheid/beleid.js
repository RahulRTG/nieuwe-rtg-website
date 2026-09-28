/* VRIJHEID: BELEID IN LAGEN -- en wat nog niet besloten is, blijft open.

   Vijf lagen, van hard naar zacht:

     LEGAL_BASELINE          wat de wet geeft
     COLLECTIVE_AGREEMENT    wat een cao daarbovenop geeft
     CONTRACT                wat de arbeidsovereenkomst geeft
     ORGANIZATION_POLICY     hoe deze organisatie het inricht
     RTG_ADDITIONAL_BENEFIT  wat RTG er EXTRA bovenop legt

   DE CONFLICTREGEL. Elke variabele draagt een RICHTING. Bij `recht` (meer is
   beter voor de mens: vakantie-uren, minimale rust) wint het HOOGSTE getal over
   alle lagen; bij `grens` (minder is beter: maximale uren achter elkaar) wint
   het LAAGSTE. Een latere laag kan een recht dus nooit verminderen -- en
   probeert hij het, dan wordt dat een CONFLICT met naam en laag, en niet stil
   genegeerd. Dat is "een extra RTG-benefit mag nooit stilzwijgend een hoger
   recht verminderen", als rekenregel in plaats van als belofte.

   NIETS VERZONNEN. De variabelen hieronder staan zonder waarde. Hoeveel RTG
   Days, wat er met een verjaardag in het weekend gebeurt, welke drempel een
   capaciteitsprobleem is: dat is een arbeidsvoorwaardenbesluit en voor een deel
   een juridische vraag (VRIJHEID.md par. 6). Een variabele zonder waarde geeft
   `open` terug MET de reden, en de motor die hem nodig heeft zegt dan
   UNKNOWN of BLOCKED_BY_LAW_OR_POLICY -- nooit een stille standaardwaarde. */
'use strict';
const crypto = require('crypto');

const LAGEN = Object.freeze(['LEGAL_BASELINE', 'COLLECTIVE_AGREEMENT', 'CONTRACT', 'ORGANIZATION_POLICY', 'RTG_ADDITIONAL_BENEFIT']);

/* richting: 'recht' (hoogste wint) | 'grens' (laagste wint) | 'keuze' (de
   laatst gezette laag wint, want een keuze kent geen "meer"). */
const VARIABELEN = Object.freeze({
  'rust.minUurTussenDiensten':    { richting: 'recht', soort: 'getal', over: 'Minimale rust tussen twee diensten, in uren.' },
  'rtgDag.perJaar':               { richting: 'recht', soort: 'getal', over: 'Aantal RTG Days per kalenderjaar.' },
  'verjaardag.weekend':           { richting: 'keuze', soort: ['vervalt', 'vorige-werkdag', 'volgende-werkdag'], over: 'Verjaardag op een dag zonder dienst in het weekend.' },
  'verjaardag.feestdag':          { richting: 'keuze', soort: ['vervalt', 'vorige-werkdag', 'volgende-werkdag'], over: 'Verjaardag op een officiele feestdag.' },
  'verjaardag.geenWerkdag':       { richting: 'keuze', soort: ['vervalt', 'vorige-werkdag', 'volgende-werkdag'], over: 'Verjaardag op een doordeweekse dag waarop iemand (parttime) niet werkt.' },
  'verjaardag.schrikkeldag':     { richting: 'keuze', soort: ['28-februari', '1-maart'], over: 'Welke dag geldt voor wie op 29 februari jarig is, in een gewoon jaar.' },
  'verjaardag.nachtdienst':       { richting: 'keuze', soort: ['dienst-die-begint', 'meeste-uren'], over: 'Welke dienst vrij is als een nachtdienst over de verjaardag heen loopt.' },
  'vroegVertrek.autoTotMinuten':  { richting: 'grens', soort: 'getal', over: 'Tot hoeveel minuten eerder weg zonder menselijke beoordeling mag.' },
  'eerlijkheid.vensterDagen':     { richting: 'keuze', soort: 'getal', over: 'Over hoeveel dagen extra dekking wordt geteld.' },
  'eerlijkheid.maxExtraDekking':  { richting: 'grens', soort: 'getal', over: 'Hoe vaak een mens binnen het venster extra mag dekken voordat het oneerlijk heet.' },
  'eerlijkheid.maxOpenSchaars':   { richting: 'grens', soort: 'getal', over: 'Hoeveel openstaande aanvragen voor schaarse momenten een mens tegelijk mag hebben.' },
  'herstel.maxUren14Dagen':       { richting: 'grens', soort: 'getal', over: 'Geplande uren in veertien dagen waarboven herstelruimte ontbreekt.' },
  'herstel.maxDagenAchterElkaar': { richting: 'grens', soort: 'getal', over: 'Aantal dagen achter elkaar ingepland waarboven herstelruimte ontbreekt.' },
  'capaciteit.minAantal':         { richting: 'keuze', soort: 'getal', over: 'Minimaal aantal geblokkeerde verzoeken voordat een capaciteitsgat wordt gemeld.' },
  'capaciteit.minAandeel':        { richting: 'keuze', soort: 'getal', over: 'Aandeel geblokkeerde verzoeken (0-1) waarboven een capaciteitsgat wordt gemeld.' }
});

function geldig(def, w) {
  if (Array.isArray(def.soort)) return def.soort.includes(w);
  return typeof w === 'number' && Number.isFinite(w) && w >= 0;
}

/* lagen: { LEGAL_BASELINE: { 'rust.minUurTussenDiensten': { waarde, bron } }, ... } */
function maakBeleid(lagen) {
  const bron = lagen || {};
  const onbekendeLaag = Object.keys(bron).filter(l => !LAGEN.includes(l));
  if (onbekendeLaag.length) throw new Error('Onbekende beleidslaag: ' + onbekendeLaag.join(', '));
  const versie = crypto.createHash('sha256').update(JSON.stringify(LAGEN.map(l => [l, bron[l] || {}]))).digest('hex').slice(0, 16);
  const conflicten = [];
  const opgelost = {};

  for (const [pad, def] of Object.entries(VARIABELEN)) {
    let huidig = null;
    for (const laag of LAGEN) {
      const v = bron[laag] && bron[laag][pad];
      if (!v) continue;
      if (!geldig(def, v.waarde)) { conflicten.push({ pad, laag, reden: 'Ongeldige waarde ' + JSON.stringify(v.waarde) + '.' }); continue; }
      const kandidaat = { waarde: v.waarde, laag, bron: v.bron || null };
      if (!huidig || def.richting === 'keuze') { huidig = kandidaat; continue; }
      const beter = def.richting === 'recht' ? v.waarde >= huidig.waarde : v.waarde <= huidig.waarde;
      if (beter) huidig = kandidaat;
      else conflicten.push({ pad, laag, reden: laag + ' probeert ' + pad + ' te verminderen van ' + huidig.waarde +
        ' (' + huidig.laag + ') naar ' + v.waarde + '. Het hogere recht blijft staan.' });
    }
    if (huidig) opgelost[pad] = Object.freeze(huidig);
  }
  for (const laag of Object.keys(bron)) for (const pad of Object.keys(bron[laag]))
    if (!VARIABELEN[pad]) conflicten.push({ pad, laag, reden: 'Onbekende variabele; genegeerd.' });

  function waarde(pad) {
    if (!VARIABELEN[pad]) throw new Error('Onbekende beleidsvariabele: ' + pad);
    return opgelost[pad] || { open: true, pad, reden: 'Nog niet vastgesteld: ' + VARIABELEN[pad].over };
  }
  const open = () => Object.keys(VARIABELEN).filter(p => !opgelost[p]);
  return Object.freeze({ versie, waarde, open, conflicten: Object.freeze(conflicten.slice()), opgelost: Object.freeze({ ...opgelost }) });
}

module.exports = { LAGEN, VARIABELEN, maakBeleid };
