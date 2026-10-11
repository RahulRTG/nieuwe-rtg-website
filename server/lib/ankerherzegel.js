/* ============================================================================
   DE HERZEGELING -- een AVG-wissing die het externe anker UITLEGT in plaats
   van het te breken.

   HET PROBLEEM. Sinds audit P1-3b vergelijkt de ankertimer eerst het laatst
   weggebrachte blok met het journaal en brengt hij bij een herschrijving niets
   meer weg (./ankertimer.js). Dat is juist. Maar een wettige AVG-wissing in het
   API-spoor (kern/command/journaal.js `wisActor`) vervangt de actor door
   "gewist" en HERZEGELT het venster: vanaf de eerste geraakte regel krijgt elke
   regel een nieuwe zegel. Het geankerde volgnummer bestaat dan nog met een
   andere hash, en dat is precies het patroon van een vervalsing. Elke wissing
   zette het anker dus stil tot een mens met de hand opnieuw ankerde -- en een
   alarm dat bij elk recht op vergetelheid afgaat, leert mensen het te negeren.

   DE UITWEG IS GEEN UITZONDERING MAAR EEN BEWIJS. Vóór de wissing rekent deze
   module UIT wat de herzegeling gaat doen (het is deterministisch: actor naar
   "gewist", daarna de keten opnieuw) en legt per geraakte regel vast:
   volgnummer, oude zegel, nieuwe zegel, en of juist DEZE regel zijn actor
   verloor. Dat record wordt getekend met dezelfde sleutel als het ankerblok
   (buiten de database, ./ankerzegel.js), bewaard, en met de wissing mee naar
   de tweede machine gebracht.

   WAT HET ANKER DAARNA ACCEPTEERT -- en alleen dat (`verklaar`):
     1. elk gebruikt record is getekend door DEZE installatie;
     2. de geankerde regel (nr, hash) staat erin als (nr, oud), en via de
        records komt diezelfde regel uit bij de hash die er NU staat -- meerdere
        wissingen na elkaar vormen zo een ketting van oud naar nieuw;
     3. het laatste record dekt de huidige stand PRECIES: elke regel in zijn
        bereik heeft nu exact de nieuwe zegel, de zegel klopt met de inhoud,
        een als gewist gemerkte regel draagt "gewist", en een NIET gewiste regel
        rekent met zijn oude voorganger terug tot zijn oude zegel -- dus het
        enige wat aan die regel veranderde is de keten, en niets van de inhoud.
   Valt er één weg, dan is de herschrijving niet verklaard en gaat het alarm af
   zoals altijd. Een record met een andere sleutel, een record dat andere
   regels noemt, of een vervalsing die ná de wissing nog een regel bijstelt:
   alle drie blijven een afwijking.

   WAT HIER NIET IN STAAT: de sleutel van de gewiste persoon. Het record zegt
   WELKE regels hun actor verloren en wie de wissing deed (uit de sessie, een
   rol -- nooit de gewiste sleutel zelf), niet van wie die regels waren.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

/* Dezelfde zegel als kern/command/journaal.js en pg/verzoeksporen.js. Dat het
   echt dezelfde is, houdt test/ankerherzegel.test.js vast door het plan naast
   een echte wisActor te leggen. */
const zegelVan = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
const zonderZegel = (r) => { const { zegel, ...rest } = r; return rest; };

/* Het plan: wat wisActor met dit venster gaat doen. Oudste-eerst, zoals het
   journaal zelf. Het volgnummer volgt uit de teller (zie ankerjournalen.js
   zegelRij): de laatste regel is regel `totaal`. */
function plan(lijst, totaal, actor) {
  const rij = Array.isArray(lijst) ? lijst : [];
  const wie = String(actor || '');
  const t = Math.max(Number(totaal) || 0, rij.length);
  const nrVan = (i) => t - (rij.length - 1 - i);
  const regels = [];
  if (!wie || !rij.some(r => r && r.actor === wie)) return { regels, kopVoor: null };
  let vorig = rij.length ? rij[0].vorig : null, begonnen = false;
  for (let i = 0; i < rij.length; i++) {
    const kopie = { ...rij[i] };
    const gewist = kopie.actor === wie;
    if (gewist) kopie.actor = 'gewist';
    kopie.vorig = vorig;
    const nieuw = zegelVan(zonderZegel(kopie));
    if (gewist) begonnen = true;
    if (begonnen) regels.push({ nr: nrVan(i), oud: rij[i].zegel, nieuw, gewist });
    vorig = nieuw;
  }
  const kop = rij[rij.length - 1];
  return { regels, kopVoor: { nr: t, hash: kop.zegel } };
}

const TEKENDOEL = 'rtg-herzegeling-v1\n';
const teTekenen = (rec, kanoniek) => {
  const { handtekening, ...kaal } = rec;
  return Buffer.from(TEKENDOEL + kanoniek(kaal), 'utf8');
};

/* De ketting van het anker naar de huidige hash. Geeft de gebruikte records in
   volgorde terug, of null als het anker niet in een record staat. */
function ketting(anker, records) {
  const gebruikt = [];
  let hash = anker.hash;
  for (;;) {
    const volgende = records.find(r => !gebruikt.includes(r) &&
      (r.regels || []).some(g => g && Number(g.nr) === anker.nr && g.oud === hash));
    if (!volgende) break;
    gebruikt.push(volgende);
    hash = volgende.regels.find(g => Number(g.nr) === anker.nr && g.oud === hash).nieuw;
  }
  return gebruikt.length ? { gebruikt, hash } : null;
}

/* Dekken de records de huidige stand PRECIES? Zie punt 3 bovenaan. `records`
   staan in de volgorde waarin ze ontstonden; per volgnummer telt het LAATSTE
   record dat hem noemt, want een latere wissing herzegelt wat een eerdere
   achterliet. */
function dektPrecies(records, lijst, totaal) {
  const rij = Array.isArray(lijst) ? lijst : [];
  const t = Math.max(Number(totaal) || 0, rij.length);
  const opNr = new Map(rij.map((r, i) => [t - (rij.length - 1 - i), r]));
  const laatst = new Map();
  for (const rec of records) {
    const regels = Array.isArray(rec.regels) ? rec.regels : [];
    if (!regels.length) return 'een record noemt geen regels';
    if (!regels[0].gewist) return 'het bereik begint niet bij een gewiste regel';
    for (let i = 1; i < regels.length; i++)
      if (Number(regels[i].nr) !== Number(regels[i - 1].nr) + 1) return 'het bereik is niet aaneengesloten';
    regels.forEach((g, i) => laatst.set(Number(g.nr), { regels, i }));
  }
  for (const [nr, { regels, i }] of laatst) {
    const g = regels[i], r = opNr.get(nr);
    if (!r) continue;                       // uit het begrensde venster geschoven
    if (r.zegel !== g.nieuw) return 'regel ' + nr + ' heeft niet de zegel die de herzegeling vastlegde';
    if (zegelVan(zonderZegel(r)) !== r.zegel) return 'regel ' + nr + ' klopt niet met zijn eigen zegel';
    if (i === 0) {
      const voor = opNr.get(nr - 1);
      if (voor && r.vorig !== voor.zegel) return 'de regel vóór het bereik is na de wissing gewijzigd';
    }
    if (g.gewist) { if (r.actor !== 'gewist') return 'regel ' + nr + ' staat als gewist maar draagt een actor'; continue; }
    const oud = zegelVan({ ...zonderZegel(r), vorig: regels[i - 1].oud });
    if (oud !== g.oud) return 'regel ' + nr + ' is méér veranderd dan zijn keten';
  }
  return null;
}

/* Is deze herschrijving van `naam` verklaard? `geldig(rec)` is de
   handtekeningcontrole van de ankerdienst; die bezit de sleutel, deze module
   niet. `records` in de volgorde waarin ze ontstonden. */
function verklaar({ naam, anker, lijst, totaal, records, geldig, huidigeHash }) {
  const eigen = (records || []).filter(r => r && r.journaal === naam);
  const getekend = eigen.filter(r => geldig(r) === true);
  if (!getekend.length) return { verklaard: false,
    reden: eigen.length ? 'er is een herzegeling, maar geen enkele is door deze installatie getekend'
      : 'er is geen herzegeling die deze herschrijving uitlegt' };
  const k = ketting(anker, getekend);
  if (!k) return { verklaard: false, reden: 'geen getekende herzegeling noemt de geankerde regel ' + anker.nr + ' met zijn oude zegel' };
  if (k.hash !== huidigeHash) return { verklaard: false, reden: 'de herzegelingen komen niet uit bij de zegel die er nu staat' };
  /* Alles vanaf de eerste gebruikte herzegeling telt mee: een latere wissing
     die de geankerde regel niet raakte, herzegelde wel wat erna kwam. */
  const vanaf = getekend.slice(getekend.indexOf(k.gebruikt[0]));
  const fout = dektPrecies(vanaf, lijst, totaal);
  if (fout) return { verklaard: false, reden: 'de herzegeling dekt de huidige stand niet precies: ' + fout };
  return { verklaard: true, gebruikt: vanaf };
}

module.exports = { plan, verklaar, dektPrecies, teTekenen, zegelVan, TEKENDOEL };
