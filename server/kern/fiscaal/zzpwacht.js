/* DE ZZP-WACHT: de ondernemersregimes per ingangsdatum.

   De landentabel (btw, werkgeverslasten, minimumloon) staat sinds
   ./jaargangen.js per ingangsdatum vast en is dus terug te rekenen. De
   ZZP-tabel was dat NIET: schijven, zelfstandigenaftrek, MKB-vrijstelling en
   heffingskortingen stonden als vaste data op het peiljaar, en de Regelwacht
   raakte ze niet aan. Daardoor rekende de zzp-tool elk jaar met de tarieven van
   nu -- een antwoord dat eruitziet als "de regels van 2023" en het niet is.

   Dat gat is nu dicht, met exact hetzelfde mechaniek: dezelfde jaargangen-store
   (./jaargangen.js), een eigen bak in de database, een eigen basis en eigen
   GENESTE velden. Wat hier apart staat is alleen de VALIDATIE, want wat een
   bron mag leveren verschilt per tabel -- een btw-tarief tussen 0 en 30 zegt
   niets over een heffingskorting.

   DE SCHIJVEN ZIJN HET GEVOELIGSTE VELD, en ze worden als geheel vervangen en
   nooit samengevoegd. Een halve schijventabel over een oude heen leggen levert
   een tabel op die niemand heeft vastgesteld: schijf 1 van 2026 met schijf 3
   van 2024 eronder telt gewoon door en ziet er volstrekt normaal uit. Daarom
   staat `schijven` niet bij de geneste velden, en daarom keurt de controle
   hieronder de tabel als geheel: oplopende grenzen, tarieven binnen bereik, en
   een bovenste schijf zonder grens.

   WAT DEZE WACHT NIET DOET is oordelen of een tarief KLOPT. Hij houdt het
   onmogelijke tegen -- een aftrek van een miljoen, een tarief van 300% -- en
   verder is een mens aan zet. Een keuring die stiekem het aannemelijke afwijst,
   houdt echte tariefwijzigingen tegen, en dan zet de eerste de beste hem uit
   (LAT.md regel 8). */
'use strict';

const { ZZP } = require('./landen');
const { maakJaargangen } = require('./jaargangen');
const { zzpBerekening } = require('./zzp');

/* De geneste velden van een regime: de twee heffingskortingen, die elk uit
   {max, afbouwVanaf, afbouw} bestaan. `schijven` staat er met opzet NIET bij
   (zie de kop) en `regels` evenmin: dat is een lijst zinnen die je heel
   vervangt of niet. */
const GENEST = ['ahk', 'arbeidskorting'];

const GETALLEN = {
  zelfstandigenaftrek: [0, 25000],
  startersaftrek: [0, 25000],
  mkbVrijstelling: [0, 0.5],
  korGrens: [0, 500000],
  simpel: [0, 0.7]
};
const KORTINGVELDEN = { max: [0, 25000], afbouwVanaf: [0, 500000], afbouw: [0, 0.5] };

const getal = (w, min, max) => {
  const n = Number(w);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/* Een schijventabel keuren en normaliseren. Vorm: [[grens, tarief], ...] met
   oplopende grenzen; de laatste grens mag ontbreken (null) en betekent dan
   "en al het meerdere" -- zo staat Infinity ook in de basistabel. */
function keurSchijven(waarde) {
  if (!Array.isArray(waarde) || !waarde.length || waarde.length > 8) return null;
  const uit = [];
  let vorige = 0;
  for (let i = 0; i < waarde.length; i++) {
    const rij = waarde[i];
    if (!Array.isArray(rij) || rij.length !== 2) return null;
    const laatste = i === waarde.length - 1;
    const tarief = getal(rij[1], 0, 1);
    if (tarief === null) return null;
    if (rij[0] === null || rij[0] === undefined || rij[0] === Infinity) {
      if (!laatste) return null;            // alleen de bovenste schijf is open
      uit.push([Infinity, tarief]);
      continue;
    }
    const grens = getal(rij[0], 1, 100000000);
    if (grens === null || grens <= vorige) return null;   // moet oplopen
    vorige = grens;
    uit.push([grens, tarief]);
  }
  return uit;
}

module.exports = ({ db, save, peiljaar, nu }) => {
  const { jaargangen } = maakJaargangen({ db, save, tabel: ZZP, peiljaar, nu,
    bak: 'fiscaalZzpJaargangen', genest: GENEST });

  /* Valideer en leg vast. Zelfde vorm en zelfde volgorde als
     regelwacht.pasToe: eerst vastleggen (dan weet de jaargang nog wat hij
     verving), daarna projecteren. */
  function pasToe(update, bron, versie, opties) {
    const o = opties || {};
    const gedaan = {};
    for (const [cc, velden] of Object.entries((update && update.landen) || update || {})) {
      const huidig = ZZP[cc];
      if (!huidig || typeof velden !== 'object') continue;
      const wijz = {};
      for (const [veld, waarde] of Object.entries(velden)) {
        if (GETALLEN[veld]) {
          const n = getal(waarde, GETALLEN[veld][0], GETALLEN[veld][1]);
          if (n !== null && huidig[veld] !== n) wijz[veld] = n;
        } else if (GENEST.includes(veld) && waarde && typeof waarde === 'object' && !Array.isArray(waarde)) {
          for (const [k, w] of Object.entries(waarde)) {
            if (!KORTINGVELDEN[k]) continue;
            const n = getal(w, KORTINGVELDEN[k][0], KORTINGVELDEN[k][1]);
            if (n !== null && (!huidig[veld] || huidig[veld][k] !== n)) (wijz[veld] = wijz[veld] || {})[k] = n;
          }
          if (wijz[veld] && !Object.keys(wijz[veld]).length) delete wijz[veld];
        } else if (veld === 'schijven') {
          const s = keurSchijven(waarde);
          if (s && JSON.stringify(s) !== JSON.stringify(huidig.schijven || null)) wijz.schijven = s;
        } else if (veld === 'regime' && typeof waarde === 'string' && waarde.trim()) {
          const t = waarde.replace(/[<>]/g, '').slice(0, 120);
          if (huidig.regime !== t) wijz.regime = t;
        } else if (veld === 'regels' && Array.isArray(waarde)) {
          const r = waarde.filter(x => typeof x === 'string' && x.trim())
            .slice(0, 12).map(x => x.replace(/[<>]/g, '').slice(0, 300));
          if (r.length && JSON.stringify(r) !== JSON.stringify(huidig.regels || [])) wijz.regels = r;
        }
      }
      if (Object.keys(wijz).length) {
        const r = jaargangen.neemOp({ land: cc, wijzigingen: wijz, geldigVanaf: o.geldigVanaf,
          bron: typeof bron === 'string' ? { soort: bron } : bron, versie,
          rechtsgrond: o.rechtsgrond, bekendgemaaktOp: o.bekendgemaaktOp, door: o.door });
        if (r && r.ok) gedaan[cc] = wijz;
      }
    }
    if (Object.keys(gedaan).length) jaargangen.projecteer();
    return { ok: true, gedaan, landen: Object.keys(gedaan).length };
  }

  /* Het regime van een land op een datum -- wat de zzp-tool nodig heeft om een
     ander jaar eerlijk te kunnen beantwoorden. Geeft null voor een land dat
     geen eigen regime in de tabel heeft; die vallen in ./zzp.js terug op de
     wereldindicatie, en die terugval hoort daar te blijven. */
  const regimeOp = (land, datum) => jaargangen.regelsOp(land, datum);

  /* DE REKENINGANG: de zzp-som voor een JAAR, met de regels van dat jaar.

     De peildatum is 1 januari van het gevraagde jaar. Een inkomstenbelasting-
     regime geldt per belastingjaar en wordt op de jaargrens vastgesteld; een
     wijziging die in juni ingaat hoort dus niet bij het jaar dat in januari
     begon. Dat is een keuze, hij staat hier, en hij staat maar op deze plek --
     drie schermen die er elk hun eigen datum bij verzinnen, geven drie
     antwoorden.

     EN HIER ZIT DE VALKUIL waar dit eerst in liep. `regimeOp` geeft ALTIJD een
     regime terug: is er niets vastgelegd, dan is dat de basis -- de tabel van
     het peiljaar. Dat doorgeven als "de regels van 2023" is precies de
     schijnzekerheid die deze hele ronde moet wegnemen: het antwoord ziet er dan
     teruggerekend uit terwijl het de tabel van nu is.

     Er wordt daarom pas een regime meegegeven als de TIJDLIJN iets over die
     datum te zeggen heeft, oftewel als er een jaargang is die op of voor de
     peildatum inging. Is die er niet, dan gaat er niets mee en zegt ./zzp.js
     zelf dat er met de tabel van nu is gerekend. Dat is de eerlijke uitkomst:
     niets vastgelegd, dus niets terug te halen. */
  function bereken(land, winst, opties) {
    const o = opties || {};
    const jaar = Number(o.jaar) || peiljaar;
    const cc = ZZP[land] ? land : (o.land && ZZP[o.land] ? o.land : land);
    const peildag = jaar + '-01-01';
    const gedekt = jaar !== peiljaar &&
      jaargangen.geschiedenis(cc).some(j => j.geldigVanaf <= peildag);
    return zzpBerekening(land, winst,
      Object.assign({}, o, { jaar, regime: gedekt ? regimeOp(cc, peildag) : null }));
  }

  const status = () => {
    const st = jaargangen.stand();
    const bak = db.data.fiscaalZzpJaargangen || {};
    return { peiljaar, wijzigingen: st.wijzigingen, ongecontroleerd: st.ongecontroleerd, wachtend: st.wachtend,
      landen: Object.keys(ZZP).map(cc => ({ code: cc, regime: ZZP[cc].regime,
        bijgewerkt: (bak[cc] || []).length > 0 })) };
  };

  return { zzpwacht: { pasToe, regimeOp, bereken, status, herstel: () => jaargangen.projecteer(),
    geschiedenis: jaargangen.geschiedenis, merkAan: jaargangen.merkAan, jaargangen } };
};
