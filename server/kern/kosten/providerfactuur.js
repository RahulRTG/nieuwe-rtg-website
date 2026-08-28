/* DE FACTUREN VAN ONZE EIGEN LEVERANCIERS -- waar de herkomstketen eindigt.

   Elke kostenregel in dit huis droeg al een BRON: "prijslijst modelaanbieder,
   augustus 2026", ingetikt door een mens in de boardroom. Dat is beter dan
   niets en het is niet genoeg. Over een half jaar staat er een bedrag op de
   factuur van een lid, en de vraag "waar komt dit vandaan" eindigt dan bij een
   zin die iemand ooit heeft getypt. Een zin is geen bewijs.

   Dus: een register van de facturen die WIJ betalen. Leverancier, nummer,
   periode, bedrag. Een nota van de infrastructuur en een tarief kunnen daarnaar
   verwijzen, en dan loopt de keten door tot iets wat je naast een bankafschrift
   kunt leggen:

     regel op de factuur van een lid
       -> tarief of verdeelde nota
         -> factuur van de leverancier (nummer, bedrag, datum)

   WAT DIT NIET IS, en dat hoort er even groot bij: dit is niet de factuur van
   de leverancier zelf. Het is wat een mens ervan heeft OVERGENOMEN. Er wordt
   geen PDF ingelezen, geen API bevraagd en niets geverifieerd. De keten eindigt
   dus bij "zo is hij ingevoerd, door die persoon, op die dag" -- en dat staat
   ook in het antwoord. Een register dat zich voordoet als de bron zelf, is
   gevaarlijker dan geen register.

   HET NUMMER IS UNIEK PER LEVERANCIER. Twee keer dezelfde factuur invoeren is
   de klassieke manier waarop een maand dubbel telt, en dat merk je pas bij de
   afstemming -- als je die draait.

   Opslag: db.data.kosten.leveranciersfacturen. */
'use strict';

const MAX_CENTEN = 1000000000;   // 10 miljoen euro op een factuur: grens op het doel
const MAX_FACTUREN = 5000;

module.exports = (ctx) => {
  const { d, save, nu, periodeVan } = ctx;

  function bak() {
    const k = d();
    if (!Array.isArray(k.leveranciersfacturen)) k.leveranciersfacturen = [];
    return k.leveranciersfacturen;
  }

  const zicht = (f) => ({ id: f.id, leverancier: f.leverancier, nummer: f.nummer, periode: f.periode,
    centen: f.centen, omschrijving: f.omschrijving || null, ingevoerdOp: f.ingevoerdOp, door: f.door,
    /* Wat dit record NIET zegt, staat in het record zelf en niet alleen in een
       document. Wie hem via de API leest, hoort het mee te krijgen. */
    zegtNiet: 'Dit is wat een mens van de factuur heeft overgenomen, niet de factuur zelf. Er is niets geverifieerd bij de leverancier.' });

  const facturen = (periode) => {
    const p = periode ? periodeVan(periode) : null;
    return bak().filter(f => !p || f.periode === p).map(zicht)
      .sort((a, b) => String(b.periode).localeCompare(String(a.periode)) || a.leverancier.localeCompare(b.leverancier));
  };
  const factuurVan = (id) => {
    const f = bak().find(x => x.id === String(id || ''));
    return f ? zicht(f) : null;
  };

  function factuurZet({ leverancier, nummer, periode, centen, omschrijving, door }) {
    const lev = String(leverancier == null ? '' : leverancier).trim().slice(0, 120);
    if (lev.length < 2) return { status: 400, error: 'Van welke leverancier is deze factuur?' };
    const nr = String(nummer == null ? '' : nummer).trim().slice(0, 80);
    if (nr.length < 2) return { status: 400, error: 'Wat is het factuurnummer? Zonder nummer is een factuur niet terug te vinden.' };
    const p = periodeVan(periode);
    if (!/^\d{4}-\d{2}$/.test(p)) return { status: 400, error: 'Geen geldige maand (JJJJ-MM).' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0 || c > MAX_CENTEN) return { status: 400, error: 'Geen geldig bedrag in centen.' };
    const naam = String(door == null ? '' : door).trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    const lijst = bak();
    /* Hetzelfde nummer bij dezelfde leverancier is dezelfde factuur. Twee keer
       invoeren laat een maand dubbel tellen, en dat zie je pas bij de
       afstemming -- als iemand die draait. */
    if (lijst.some(f => f.leverancier.toLowerCase() === lev.toLowerCase() && f.nummer.toLowerCase() === nr.toLowerCase())) {
      return { status: 409, error: 'Deze factuur staat er al: ' + lev + ' ' + nr + '.' };
    }
    if (lijst.length >= MAX_FACTUREN) return { status: 409, error: 'Het facturenregister zit vol.' };
    const f = { id: 'LF-' + p.replace('-', '') + '-' + (lijst.length + 1),
      leverancier: lev, nummer: nr, periode: p, centen: c,
      omschrijving: String(omschrijving == null ? '' : omschrijving).trim().slice(0, 200) || null,
      ingevoerdOp: nu(), door: naam };
    lijst.push(f);
    save();
    return { status: 200, ok: true, factuur: zicht(f) };
  }

  /* De BRON-tekst die bij een factuur hoort. Zo staat er op een kostenregel niet
     een zin die iemand typte maar een verwijzing die je kunt natrekken -- en
     staat die zin op precies EEN plek. */
  function bronVan(id) {
    const f = factuurVan(id);
    return f ? (f.leverancier + ' factuur ' + f.nummer + ' (' + f.periode + ')') : null;
  }

  return { facturen, factuurVan, factuurZet, bronVan, MAX_CENTEN };
};
