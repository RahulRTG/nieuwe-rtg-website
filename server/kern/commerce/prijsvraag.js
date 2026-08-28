/* ============================================================================
   DE PRIJSVRAAG -- het werkwoord `prijs` waar het bedrag van een KEUZE afhangt.

   COMMERCE.md par. 6 hield dit als het laatste gat overeind: twaalf van de 92
   koopbaren met een bedrag dragen een `vanaf`-prijs, en daar kan niet op worden
   afgerekend -- wie op een vanaf-prijs incasseert, int iets wat niemand heeft
   afgesproken. Het document zei erbij dat er voor een reis en een verblijf
   nooit een vast bedrag zal komen: daar HANGT de prijs van iets af.

   MAAR DE TWAALF ZIJN NIET EEN GEVAL. Nagemeten op de seed zijn het er drie:

     6x eten      een restaurant, "vanaf 12 euro per gerecht". Dat is geen prijs
                  maar een prijsNIVEAU: je koopt geen restaurant. Hier valt niets
                  exact te maken, en dat hoort ook niet -- zie `prijsAard` in
                  kern/mall/aanbod.js.
     3x verblijf  een huis met vrije kamers die elk hun EIGEN exacte prijs per
                  nacht hebben. De vraag is: welke kamer, hoeveel nachten.
     3x reis      een reis tegen de nettoprijs PER PERSOON. De vraag is: met
                  hoeveel personen.

   De laatste twee hebben dezelfde vorm: KIES EEN GRONDSLAG, MAAL EEN AANTAL. En
   dat is precies de som die ./afrekening.js al doet. Er hoeft dus geen
   prijsfunctie per domein te worden aangeroepen en geen registertje van
   domeinen die er een hebben: het domein publiceert de keuzes MET hun exacte
   bedrag (die kent het al), en deze laag doet de vermenigvuldiging die ze
   overal al doet.

   DAT IS MET OPZET ZO SAAI. Een aanroep terug het domein in zou een tweede weg
   zijn waarlangs een bedrag ontstaat, en dan is de vraag welke van de twee
   klopt -- de fout die kern/fiscaal/tarief.js een keer heeft gemaakt en die dit
   huis sindsdien op een plek houdt.

   WAT ER NIET IN ZIT: staffels, seizoenstoeslagen, weekendtarieven, een prijs
   die van de datum afhangt. Die bestaan in geen van de domeinen, en ze hier
   alvast als veld neerzetten zou een vorm verklaren die niemand waarmaakt --
   precies wat de meting bij `Koopbaar` heeft voorkomen.
   ========================================================================== */
'use strict';

const MAX_OPTIES = 60;
const MAX_MAAL = 365;

const NIET_GEBOUWD = {
  staffel: 'Een prijs die per aantal verspringt (drie nachten goedkoper dan een) bestaat in geen enkel domein. Zolang dat zo is, zou een staffelveld een vorm zijn die niemand invult.',
  datumprijs: 'Een prijs die van de datum afhangt (hoogseizoen, weekend) bestaat hier evenmin. Het reisbureau bevestigt wel de DATUM, maar de nettoprijs per persoon staat vast.',
  toeslagen: 'Toeslagen (ontbijt, extra bed, toeristenbelasting) horen bij het domein dat ze heft, en niet bij de vraag wat iets kost. Zonder bron zou het een tweede prijslijst zijn.'
};

/* Een prijsvraag is geldig als hij een grondslag met bedragen heeft en een
   aantal met grenzen. Alles daarbuiten wordt geweigerd en niet gerepareerd: een
   half ingevulde prijsvraag levert een half bedrag op, en dat is erger dan geen. */
function geldig(v) {
  if (!v || typeof v !== 'object') return false;
  const b = v.basis, m = v.maal;
  if (!b || !Array.isArray(b.opties) || !b.opties.length || b.opties.length > MAX_OPTIES) return false;
  if (!b.opties.every(o => o && o.id && Number.isFinite(Number(o.centen)) && Number(o.centen) >= 0)) return false;
  if (!m || !m.id) return false;
  const min = Number(m.min), max = Number(m.max);
  return Number.isFinite(min) && Number.isFinite(max) && min >= 1 && max >= min && max <= MAX_MAAL;
}

/* Het bedrag bij een antwoord, of de reden waarom er geen is. Geeft nooit een
   getal terug bij een onvolledig antwoord -- `null` mét een reden, zodat het
   scherm kan vragen in plaats van te raden. */
function antwoordCenten(vraag, antwoorden) {
  if (!geldig(vraag)) return { centen: null, reden: 'Voor dit aanbod is geen prijsvraag ingericht.' };
  const a = antwoorden || {};
  const keuze = vraag.basis.opties.find(o => o.id === String(a[vraag.basis.id] == null ? '' : a[vraag.basis.id]));
  if (!keuze) return { centen: null, reden: vraag.basis.vraag || ('Kies ' + (vraag.basis.label || 'een optie') + '.') };

  const ruw = a[vraag.maal.id];
  const n = Math.floor(Number(ruw));
  if (!Number.isFinite(n) || n < vraag.maal.min || n > vraag.maal.max) {
    return { centen: null, reden: (vraag.maal.vraag || ('Vul ' + (vraag.maal.label || 'een aantal') + ' in')) +
      ' (' + vraag.maal.min + ' tot ' + vraag.maal.max + ').' };
  }
  return {
    centen: Math.round(Number(keuze.centen)) * n,
    keuze: { id: keuze.id, label: keuze.label || keuze.id, centen: Math.round(Number(keuze.centen)) },
    aantal: n,
    /* Uitgeschreven, want dit is het bedrag waarop wordt afgerekend en dan
       hoort een koper te kunnen zien hoe het is opgebouwd. */
    uitleg: (keuze.label || keuze.id) + ' x ' + n + ' ' + (n === 1 ? (vraag.maal.eenheid || '') : (vraag.maal.eenheidMeervoud || vraag.maal.eenheid || ''))
  };
}

/* Het beeld naar buiten: wat er gevraagd wordt, zonder dat een scherm de vorm
   hoeft te kennen. Bedragen gaan in CENTEN mee -- dezelfde eenheid als de rest
   van de afrekening, want `bedrag` in kern/mall/aanbod.js staat in euro's en
   dat is hier een keer misgegaan. */
function publiek(vraag) {
  if (!geldig(vraag)) return null;
  return {
    basis: { id: vraag.basis.id, label: vraag.basis.label || 'Keuze', vraag: vraag.basis.vraag || null,
      opties: vraag.basis.opties.map(o => ({ id: o.id, label: o.label || o.id, centen: Math.round(Number(o.centen)), uitleg: o.uitleg || null })) },
    maal: { id: vraag.maal.id, label: vraag.maal.label || 'Aantal', vraag: vraag.maal.vraag || null,
      min: Number(vraag.maal.min), max: Number(vraag.maal.max),
      eenheid: vraag.maal.eenheid || null, eenheidMeervoud: vraag.maal.eenheidMeervoud || null },
    eenheid: vraag.eenheid || null
  };
}

module.exports = { geldig, antwoordCenten, publiek, NIET_GEBOUWD, MAX_OPTIES, MAX_MAAL };
