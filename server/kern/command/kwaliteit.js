/* DE GEGEVENSKWALITEIT -- wat er scheef staat in de gegevens zelf.

   Dit is de tegenhanger van ./runbooks.js. Daar gaat het over toestanden die
   VERKEERD zijn (een status die achterloopt); hier over gegevens die KAPOT
   zijn: twee rijen met dezelfde sleutel, een rij zonder sleutel, een verwijzing
   naar iets wat niet bestaat. Dat is geen bedrijfsprobleem maar een
   administratieprobleem, en het valt zelden op -- tot iemand op de verkeerde
   rij klikt.

   DE VERWIJZINGEN WORDEN GEMETEN, NIET OPGESCHREVEN. Er is geen tabel die zegt
   "orders.supplierCode wijst naar zaken". Zo'n tabel veroudert zodra er een
   collectie bij komt, en dan controleert hij precies de nieuwe velden niet. In
   plaats daarvan kijkt deze module welk veld in de praktijk vrijwel altijd een
   bestaande sleutel van een andere soort bevat; DAT is dan het verwijsveld, en
   de rijen die er niet op passen zijn de wezen.

   De drempel ligt op 80%: een veld dat vier van de vijf keer raak is, is een
   verwijzing met vier wezen. Een veld dat de helft van de tijd raak is, is
   waarschijnlijk toeval en wordt niet gecontroleerd -- liever een wees missen
   dan een half platform als kapot melden.

   HARD EN ZACHT STAAN APART. De eerste drie bevindingen zijn zeker: een dubbele
   sleutel is een dubbele sleutel. De vierde (een waarde die één keer voorkomt
   waar de rest tientallen keren dezelfde waarden gebruikt) is een VERMOEDEN --
   meestal een typefout of een oude naam, soms gewoon een zeldzaam geval. Hij
   staat als vermoeden in de uitslag en telt niet mee als defect, want een meter
   die vermoedens als feiten telt, wordt terecht genegeerd. */
'use strict';

const { s } = require('./register');

const MAX_SCAN = 20000;      // per collectie
const REF_DREMPEL = 0.8;     // vanaf hier heet een veld een verwijzing
const REF_MIN = 5;           // en pas als er genoeg rijen zijn om dat te zeggen
const ZELDZAAM_MIN = 20;     // een vermoeden over waarden vraagt volume

/* Velden die nooit een verwijzing zijn: vrije tekst en tijdstempels lijken
   soms toevallig op een sleutel, en dan zou de meter wezen gaan verzinnen. */
const GEEN_REF = new Set(['at', 'created_at', 'createdAt', 'updatedAt', 'bijgewerkt',
  'tekst', 'text', 'naam', 'name', 'titel', 'omschrijving', 'reden', 'update']);

function maakKwaliteit({ db, register }) {
  function rijenVan(soort) {
    const alle = register.rijen(db, soort);
    return { alle, gekeken: Math.min(alle.length, MAX_SCAN) };
  }

  /* De sleutels per soort, één keer opgebouwd: daar wordt elke verwijzing
     tegenaan gehouden. */
  function sleutelkaart() {
    const kaart = new Map();
    for (const soort of register.SOORTEN) {
      const { alle, gekeken } = rijenVan(soort);
      const set = new Set();
      for (let i = 0; i < gekeken; i++) {
        const k = alle[i] ? s(alle[i][soort.sleutel]) : '';
        if (k) set.add(k.toLowerCase());
      }
      kaart.set(soort.type, set);
    }
    return kaart;
  }

  /* Welk veld van deze soort verwijst naar welke andere soort? Gemeten, met
     het aandeel erbij zodat de uitslag te beoordelen is. */
  function verwijsvelden(soort, kaart) {
    const { alle, gekeken } = rijenVan(soort);
    if (gekeken < REF_MIN) return [];
    const per = new Map();
    for (let i = 0; i < gekeken; i++) {
      const r = alle[i];
      if (!r) continue;
      for (const [veld, waarde] of Object.entries(r)) {
        if (veld === soort.sleutel || GEEN_REF.has(veld)) continue;
        if (waarde == null || typeof waarde === 'object') continue;
        const w = s(waarde).toLowerCase();
        if (!w || w.length < 2 || w.length > 60) continue;
        if (!per.has(veld)) per.set(veld, { gevuld: 0, raak: new Map() });
        const p = per.get(veld);
        p.gevuld++;
        for (const [type, set] of kaart) {
          if (type === soort.type) continue;
          if (set.has(w)) p.raak.set(type, (p.raak.get(type) || 0) + 1);
        }
      }
    }
    const uit = [];
    for (const [veld, p] of per) {
      if (p.gevuld < REF_MIN) continue;
      for (const [type, n] of p.raak) {
        const deel = n / p.gevuld;
        if (deel >= REF_DREMPEL && deel < 1) uit.push({ veld, wijstNaar: type, deel, gevuld: p.gevuld, raak: n });
        else if (deel === 1) uit.push({ veld, wijstNaar: type, deel, gevuld: p.gevuld, raak: n });
      }
    }
    return uit;
  }

  function meet() {
    const kaart = sleutelkaart();
    const hard = [];
    const vermoedens = [];
    let objecten = 0, onvolledig = false;

    for (const soort of register.SOORTEN) {
      const { alle, gekeken } = rijenVan(soort);
      if (alle.length > gekeken) onvolledig = true;
      objecten += alle.length;

      // 1 + 2: dubbele en lege sleutels
      const gezien = new Map();
      let leeg = 0;
      for (let i = 0; i < gekeken; i++) {
        const r = alle[i];
        if (!r) continue;
        const k = s(r[soort.sleutel]);
        if (!k) { leeg++; continue; }
        gezien.set(k, (gezien.get(k) || 0) + 1);
      }
      const dubbel = [...gezien.entries()].filter(([, n]) => n > 1);
      if (dubbel.length) hard.push({ soort: soort.type, label: soort.label, wat: 'dubbele sleutel',
        aantal: dubbel.length, zeker: true,
        uitleg: 'twee of meer rijen dragen dezelfde ' + soort.sleutel + '; welke je opent is toeval',
        voorbeelden: dubbel.slice(0, 5).map(([k, n]) => k + ' (' + n + '×)') });
      if (leeg) hard.push({ soort: soort.type, label: soort.label, wat: 'sleutel ontbreekt',
        aantal: leeg, zeker: true,
        uitleg: 'deze rijen zijn nergens mee aan te wijzen en vallen dus buiten elk dossier',
        voorbeelden: [] });

      // 3: wezen op een gemeten verwijsveld
      for (const ref of verwijsvelden(soort, kaart)) {
        if (ref.deel === 1) continue;
        const doelen = kaart.get(ref.wijstNaar);
        const wezen = [];
        for (let i = 0; i < gekeken && wezen.length < 200; i++) {
          const r = alle[i];
          if (!r) continue;
          const w = s(r[ref.veld]).toLowerCase();
          if (w && !doelen.has(w)) wezen.push(s(r[soort.sleutel]) + ' → ' + s(r[ref.veld]));
        }
        if (wezen.length) hard.push({ soort: soort.type, label: soort.label, wat: 'verwijzing zonder doel',
          aantal: wezen.length, zeker: true, veld: ref.veld, wijstNaar: ref.wijstNaar,
          uitleg: ref.veld + ' wijst in ' + Math.round(ref.deel * 100) + '% van de gevallen naar een bestaande ' +
            ref.wijstNaar + '; deze rijen wijzen nergens heen',
          voorbeelden: wezen.slice(0, 5) });
      }

      // 4: een waarde die er als typefout uitziet (VERMOEDEN)
      if (gekeken >= ZELDZAAM_MIN) {
        for (const veld of ['status', 'staat', 'soort', 'type']) {
          const per = new Map();
          for (let i = 0; i < gekeken; i++) {
            const w = alle[i] ? s(alle[i][veld]) : '';
            if (w) per.set(w, (per.get(w) || 0) + 1);
          }
          if (per.size < 2 || per.size > 12) continue;
          const totaal = [...per.values()].reduce((a, b) => a + b, 0);
          for (const [waarde, n] of per) {
            if (n === 1 && totaal >= ZELDZAAM_MIN) vermoedens.push({ soort: soort.type, label: soort.label,
              wat: 'zeldzame waarde', veld, waarde, aantal: 1, zeker: false,
              uitleg: '"' + waarde + '" komt één keer voor terwijl ' + (per.size - 1) +
                ' andere waarden samen ' + (totaal - 1) + ' rijen dekken -- mogelijk een typefout of een oude naam' });
          }
        }
      }
    }

    hard.sort((a, b) => b.aantal - a.aantal);
    return {
      bevindingen: hard, vermoedens,
      tel: { defecten: hard.reduce((n, b) => n + b.aantal, 0), soorten: hard.length, vermoedens: vermoedens.length },
      gemeten: { objecten, soorten: register.SOORTEN.length, onvolledig,
        drempel: 'een veld heet pas een verwijzing als het in ' + Math.round(REF_DREMPEL * 100) +
          '% van de gevulde gevallen een bestaande sleutel raakt' }
    };
  }

  /* De gemeten verwijzingen los opvraagbaar. De kennisgraaf (./graaf.js) leunt
     hierop: dezelfde meting levert daar de randen en hier de wezen. Twee keer
     meten zou twee keer iets anders kunnen zeggen over dezelfde gegevens. */
  const verwijzingenVan = (soort) => verwijsvelden(soort, sleutelkaart());

  return { meet, verwijzingenVan, REF_DREMPEL };
}

module.exports = { maakKwaliteit, REF_DREMPEL, GEEN_REF };
