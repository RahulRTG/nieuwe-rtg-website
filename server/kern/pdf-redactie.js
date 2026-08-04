/* ============================================================================
   PDF-REDACTIE: de passage gaat UIT de bytes, niet onder een zwart balkje.

   DE FOUT DIE DIT VOORKOMT. Bijna elke "redactie" die je in het wild ziet,
   tekent een zwarte rechthoek OVER de tekst. De letters staan er dan nog:
   selecteren, kopieren of `strings document.pdf` haalt ze zo weer tevoorschijn.
   Dat is de reden dat er met enige regelmaat een geredigeerd rapport in het
   nieuws komt waar de namen alsnog uit te lezen waren.

   Deze module tekent niets. Hij pakt de inhoudsstroom uit, haalt de gevraagde
   tekst UIT de tekenopdrachten, pakt hem weer in, en bouwt het bestand opnieuw
   op met een verse cross-reference tabel. Wat eruit is, is eruit.

   DE MAAT DIE ERBIJ HOORT (TAKEN 5.9): zoeken op de geredigeerde tekst in het
   RESULTAAT vindt hem niet meer -- niet in de tekstlaag en niet in de ruwe
   bytes. Die twee staan allebei in test/pdf.test.js.

   WAT HIJ NIET DOET, EN ZEGT:
   - een PDF die de leeslaag niet begrijpt (versleuteld, objectstreams,
     xref-streams) wordt GEWEIGERD en niet half bewerkt;
   - tekst in een AFBEELDING blijft staan; dat is geen tekst maar beeld, en wie
     dat wil redigeren heeft een andere machine nodig. Het antwoord zegt dat
     erbij in plaats van stilte;
   - de opmaak schuift. Een woord weghalen verandert de regelval, en dat is de
     prijs van echt weghalen. Een redactie die er precies zo uitziet als het
     origineel, heeft de letters nog.
   ========================================================================== */
'use strict';
const zlib = require('zlib');
const { lees, kopVan, streamVan, pakUit, isFlate } = require('./pdf');

/* De tekenopdrachten van een inhoudsstroom bevatten letterlijke strings tussen
   haakjes. Alleen DAAR halen we tekst weg; buiten die strings staat de opmaak,
   en die willen we niet aanraken. */
function schoonStroom(inhoud, woorden) {
  let raak = 0;
  const uit = inhoud.replace(/\(((?:\\.|[^\\()])*)\)/g, (heel, binnen) => {
    let s = binnen;
    for (const w of woorden) {
      if (!w) continue;
      // op de ONTSNAPTE vorm zoeken zou de helft missen; eerst uitpakken
      const plat = s.replace(/\\([()\\])/g, '$1');
      if (plat.indexOf(w) < 0) continue;
      const nieuw = plat.split(w).join('');
      s = nieuw.replace(/([()\\])/g, '\\$1');
      raak++;
    }
    return '(' + s + ')';
  });
  return { inhoud: uit, raak };
}

/* Het bestand opnieuw opbouwen. Wij schrijven ELK object opnieuw weg en zetten
   er een verse xref-tabel onder; de oude tabel klopt na een wijziging toch
   niet meer, en een xref bijwerken op byte-niveau is precies waar dit soort
   code stilletjes fout gaat. */
function bouw(buf, vervangingen, wortel) {
  const stukken = [];
  const posities = new Map();
  let lengte = 0;
  const duw = (b) => { stukken.push(b); lengte += b.length; };

  const kop = buf.slice(0, buf.indexOf('\n') + 1);
  duw(kop);

  const objs = [...vervangingen.keys()].sort((a, b) => a.start - b.start);
  for (const o of objs) {
    posities.set(o.nummer, lengte);
    duw(Buffer.from(vervangingen.get(o), 'latin1'));
  }

  const xref = lengte;
  const hoogste = Math.max(...[...posities.keys()]);
  let tabel = 'xref\n0 ' + (hoogste + 1) + '\n0000000000 65535 f \n';
  for (let n = 1; n <= hoogste; n++) {
    const p = posities.has(n) ? posities.get(n) : 0;
    tabel += String(p).padStart(10, '0') + ' 00000 ' + (posities.has(n) ? 'n' : 'f') + ' \n';
  }
  tabel += 'trailer\n<< /Size ' + (hoogste + 1) + (wortel ? ' /Root ' + wortel + ' R' : '') +
    ' >>\nstartxref\n' + xref + '\n%%EOF\n';
  duw(Buffer.from(tabel, 'latin1'));
  return Buffer.concat(stukken);
}

/* Redigeren. Geeft het NIEUWE bestand terug plus een verslag: wat is er
   geraakt, en wat kon niet. */
function redigeer(buf, woorden) {
  const lijst = (Array.isArray(woorden) ? woorden : [woorden]).map(w => String(w || '')).filter(Boolean);
  if (!lijst.length) return { ok: false, waarom: 'geef op welke tekst eruit moet' };
  const d = lees(buf);
  if (!d.ok) return d;

  const vervangingen = new Map();
  let raak = 0, strooms = 0, beeld = 0;
  for (const o of d.objecten) {
    let nieuwLijf = buf.toString('latin1', o.start, o.eind);
    const st = streamVan(buf, o);
    const kop = kopVan(o.lijf);
    if (st) {
      if (/\/Subtype\s*\/Image\b/.test(kop)) beeld++;
      const uit = pakUit(kop, st.bytes);
      if (uit.ok) {
        const inhoud = uit.data.toString('latin1');
        if (/(BT|Tj|TJ)\b/.test(inhoud)) {
          strooms++;
          const schoon = schoonStroom(inhoud, lijst);
          if (schoon.raak) {
            raak += schoon.raak;
            let bytes = Buffer.from(schoon.inhoud, 'latin1');
            if (uit.gecomprimeerd) bytes = uit.rauw ? zlib.deflateRawSync(bytes) : zlib.deflateSync(bytes);
            const voor = buf.toString('latin1', o.start, st.begin);
            const na = buf.toString('latin1', st.eind, o.eind);
            nieuwLijf = voor.replace(/\/Length\s+\d+/, '/Length ' + bytes.length) +
              bytes.toString('latin1') + na;
          }
        }
      }
    }
    if (!/\n$/.test(nieuwLijf)) nieuwLijf += '\n';
    vervangingen.set(o, nieuwLijf);
  }

  if (!raak) return { ok: true, geraakt: 0, bestand: buf, onveranderd: true,
    waarom: 'die tekst staat niet in de tekstlaag van dit document' +
      (beeld ? '; er staan wel ' + beeld + ' afbeelding(en) in, en tekst IN een afbeelding is beeld en geen tekst' : '') };

  return { ok: true, geraakt: raak, stromen: strooms, afbeeldingen: beeld,
    bestand: bouw(buf, vervangingen, d.wortel),
    let: 'De passage is uit de tekenopdrachten gehaald, niet afgedekt. De opmaak kan daardoor verschuiven -- dat is de prijs van echt weghalen.' +
      (beeld ? ' Let op: dit document bevat ' + beeld + ' afbeelding(en); tekst die daarin staat is beeld en blijft staan.' : '') };
}

module.exports = { redigeer, schoonStroom };
