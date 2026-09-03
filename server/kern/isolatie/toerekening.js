/* WIE HET BESLUIT DROEG -- de toerekening, los van het besluit zelf.

   Los van ./besluit.js omdat het een andere vraag beantwoordt: dat bestand zegt
   OF iets mag, dit zegt aan wie dat te danken of te wijten is. De tweede is
   alleen voor de uitleg -- een scherm, een auditregel, een mens die zoekt --
   en verandert om andere redenen dan de eerste.

   Hij staat ook apart omdat hij een keer schadelijk fout is geweest, en dat
   verhaal hoort bij deze functie en niet verspreid door de besluitlaag. */
'use strict';

const ordening = require('./ordening');
const { NAMEN: DRAGERNAMEN } = require('./dragers');

/* WELKE DRAGER HET BESLUIT DROEG. Niet "de fijnste" en ook niet "iedereen met
   dezelfde trede": een drager droeg dit besluit als de stand ZONDER hem zwakker
   zou zijn geweest. Dat is de definitie, en hij is hier uitgerekend en niet
   benaderd.

   DE BENADERING DIE HIER EERST STOND, EN WAAROM HIJ SCHADELIJK WAS. Versie een
   noemde elke drager mee wiens trede gelijk was aan de samengevoegde trede.
   Voor `normaal` is dat altijd waar, dus een lid in de beschermstand kreeg te
   lezen: "er staat een beveiligingsstand aan op huis en identiteit" -- terwijl
   het huis gewoon draaide. Een mens die dat leest, gaat de verkeerde kant op
   zoeken, en bij een incident is dat het duurste wat een scherm kan doen. */
function dragersVanStand(standen, samen) {
  const aanwezig = DRAGERNAMEN.filter(n => standen[n] !== null && standen[n] !== undefined);
  const raak = [];
  for (const naam of aanwezig) {
    const zonder = ordening.strengste(aanwezig.filter(n => n !== naam).map(n => standen[n]));
    /* Zou het zonder deze drager zwakker zijn geweest, dan droeg hij mee. Twee
       dragers die allebei isolatie zeggen, dragen dus geen van beiden alleen --
       daarom is er een tweede ronde die dat opvangt. */
    if (ordening.vergelijk(zonder, samen) === 'zwakker') raak.push({ drager: naam, stand: standen[naam] });
  }
  if (raak.length) return raak;
  /* Niemand droeg hem ALLEEN: meer dragers zeggen hetzelfde. Dan dragen ze hem
     samen, en noemen we ze samen -- behalve de dragers die niets sluiten, want
     die noemen zou weer de fout van versie een zijn. */
  return aanwezig
    .filter(n => ordening.vergelijk(standen[n], 'normaal') === 'strenger')
    .map(n => ({ drager: n, stand: standen[n] }));
}

module.exports = { dragersVanStand };
