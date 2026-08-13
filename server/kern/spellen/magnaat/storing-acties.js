/* Magnaat: EEN STORING VERHELPEN -- dezelfde vraag, een hoogte hoger.

   DIT IS DE DERDE HOOGTE UIT VERHAAL.md par. 0f, en hij moest er zijn zodra
   ./storing.js bestond. Anders zit een zaak zonder vakkracht eeuwig aan een
   kapotte koeling vast: de werkvloer is dan de ENIGE plek waar iets gemaakt kan
   worden, en dat is geen bedrijf maar een bottleneck.

   DEZELFDE UITWEGEN, EEN ANDERE STOEL. Een vakkracht kiest ze op zijn dienst,
   midden in de drukte, met een half oog op de rest van zijn avond. De eigenaar
   kiest ze op zijn zaakscherm, rustig, met het maandoverzicht ernaast. De
   uitkomst is exact dezelfde -- ./storing.js `pas()` is de enige plek waar
   staat wat repareren doet -- en dat is precies de belofte: de wereld geeft je
   geen moeilijker spel, dezelfde werkelijkheid stelt je een grotere vraag.

   ER KOMT GEEN DERDE RECHTENMODEL BIJ (CONCERN.md: toegang verlenen gebeurt
   waar de rol woont). Wie mag dit? Wie de zaak bezit, of wie er een rol heeft
   die `onderhoud` mag -- en dat wordt beantwoord door `magAan` in ./dienst.js,
   dezelfde functie die `werk-beleid` al gebruikt. Een tweede antwoord op "mag
   deze speler aan deze zaak zitten" is een gat.

   DE KOSTEN LOPEN DOOR DE MAAND EN NIET DOOR DE KAS. Deze actie zet geen bedrag
   af; hij zet een stand. Wat het kost verschijnt op het maandoverzicht in de
   ONDERHOUDSPOST, net als bij de vakkracht (./rush-maand.js). Zou hij hier
   meteen afboeken, dan kost repareren op het zaakscherm iets anders dan
   repareren op de werkvloer -- en dan zijn het twee handelingen met een naam. */
'use strict';

const STORING = require('./storing');
const D = require('./dienst');
const { SOORTEN } = require('./rush-voorvallen');

/* De uitwegen die bij een storing horen, uit dezelfde tabel als de werkvloer.
   Zonder `overzetten`: dat is mitigeren tijdens een dienst en niet iets wat je
   vanaf een scherm doet -- de waar ligt er nu, niet volgende maand. En zonder
   `escaleren`, want dat is de weg NAAR dit scherm toe; hem hier aanbieden zou
   betekenen dat de zaak het naar zichzelf doorschuift. */
const UITWEGEN = (soort) => ((SOORTEN.find(x => x.storing === soort) || {}).opties || [])
  .filter(o => o.mag === 'onderhoud' && o.id !== 'escaleren');

module.exports = ({ mijnVestiging }) => {
  const vind = (st, id) => (st.vestigingen ? Object.values(st.vestigingen).flat()
    .find(v => v.id === id) : null) || null;

  return {
    ACTIES: {
      'storing-verhelpen'(potje, h, zet) {
        const st = potje.staat;
        const id = String(zet.vestiging || '');
        /* TWEE WEGEN EN NIET MEER: je bezit de zaak, of je hebt er een rol die
           onderhoud mag. Precies `magAan` uit ./dienst.js -- de enige plek waar
           die vraag beantwoord wordt. */
        const eigen = mijnVestiging(st, h, id);
        const v = eigen || (D.magAan(st, h, id, 'onderhoud') ? vind(st, id) : null);
        if (!v) return { status: 403, error: 'Dat is niet jouw zaak.' };
        /* IN WELKE HOEDANIGHEID je dit doet. Dezelfde twee wegen als hierboven,
           en het is precies wat de vloer straks te lezen krijgt: "besluit: Anna
           (eigenaar)" leest anders dan "besluit: Sven (bedrijfsleider)". Geen
           derde rechtenmodel -- dit is een LABEL en geen bevoegdheid. */
        const rol = eigen ? 'eigenaar' : ((D.dienstVan(st, h) || {}).rol || null);
        const s = STORING.vind(v, String(zet.storing || ''));
        if (!s) return { status: 404, error: 'Daar is niets mis mee.' };
        const optie = UITWEGEN(s.soort).find(o => o.id === String(zet.hoe || ''));
        if (!optie) return { status: 400, error: 'Dat kun je hier niet doen.' };
        if (optie.staat === s.staat) return { status: 409, error: 'Zo staat hij al.' };
        const uit = STORING.pas(v, s.soort, optie, st.maand, { wie: h, rol });
        if (!uit) return { status: 409, error: 'Dat lukt niet.' };
        /* HET SPOEDBEDRAG WACHT OP DE MAAND. Hij hangt aan de VESTIGING en niet
           aan een speler, want dat is waar de rekening thuishoort -- en zo telt
           hij mee of de zaak intussen van eigenaar wisselt. */
        if (uit.spoed > 0) v.spoedOpen = (v.spoedOpen || 0) + uit.spoed;
        if (uit.herstel > 0) v.onderhoud = Math.min(100, (v.onderhoud || 0) + uit.herstel);
        return { status: 200, ok: true, staat: s.staat,
          spoed: Math.round(uit.spoed || 0), deed: optie.deed };
      }
    },
    /* VRIJ VAN BEURT, en hier is dat geen gemak maar de aard van de zaak: een
       koeling die stuk is wacht niet tot jij aan zet bent. Dezelfde redenering
       als bij `beheer-regels` -- het verandert de kaart niet en gaat niemand
       anders aan. */
    VRIJE_ACTIES: ['storing-verhelpen'],
    UITWEGEN
  };
};
