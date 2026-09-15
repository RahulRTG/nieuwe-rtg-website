/* DE WERKVLOER KIJKT NAAR DE ONDERNEMING -- de brug uit ONDERNEMEN.md par. 1,
   en hij loopt EEN KANT OP.

   HET GAT DAT HIJ SLUIT IS GEMETEN EN NIET GEVOELD. `npm run ondernemerslus`
   zette `zaakZietOnderneming` op nul: geen enkel bestand onder routes/supplier/
   of routes/staff/ kende het ondernemingsobject. kern/onderneming kent de zaak
   wel (hij heeft `vanZaak` en `koppel`), dus de lus liep eenrichtingsverkeer de
   verkeerde kant op -- het bedrijfsobject kon naar de werkvloer kijken en de
   werkvloer wist niet dat hij een bedrijfsobject had.

   Dezelfde vorm als de twee ritwerelden (scripts/ritmigratie.js), en de
   reparatie daar is hier het model: kern/mobiliteit/appbrug.js. Inclusief de
   regel die daar geleerd is -- de brug loopt EEN KANT OP, want twee lijsten die
   elkaar bijwerken hebben geen waarheid meer. Deze route LEEST en schrijft
   niets; de onderneming krijgt hier niets voor terug.

   EEN KERNNAAM EN NIET TWEE. Dit bestand raakt alleen `ondernemingAchterZaak`
   aan, en niet `ondernemingVanZaak` plus `ondernemingBeeld`. Dat is geen stijl
   maar de domeingrens: scripts/grenzen.js leidt het domein af uit de MAP, dus
   alles wat hier wordt aangeraakt en ook op de ledenkant staat, wordt een
   gedeelde kernnaam. Een eigen toegang houdt de koppeling op precies een naam,
   en zet de versmalling bovendien in de module die het object BEZIT -- daar
   hoort het besluit over wat gedeeld wordt, niet in een route.

   WAT DE VLOER WEL EN NIET ZIET STAAT IN kern/onderneming/zaakkant.js, mét de
   reden per veld, en die reden gaat MEE in het antwoord. Kort: de trede, de
   rechtsvorm, wat deze onderneming mag en wat haar rechtsvorm weghoudt -- geen
   eigenaar, geen KvK-nummer, geen klant- of personeelscijfers.

   EN ER KOMT GEEN ROLONDERSCHEID BIJ. Iedereen op de leveranciersessie krijgt
   hetzelfde, versmald tot wat veilig is voor de minst bevoegde mens die hier
   binnenkomt. De eigenaar die meer wil zien, heeft zijn eigen ledenroutes
   (/api/onderneming/*) waar hij als eigenaar bekend is; een rolafhankelijke
   variant hier zou een derde rechtenmodel zijn naast de ledenkant en de
   zaakrollen (CONCERN.md: toegang verlenen gebeurt waar de rol woont). */
module.exports = (kern) => {
  const { app, supplierAuth, ondernemingAchterZaak } = kern;

  app.post('/api/supplier/onderneming', supplierAuth, (req, res) =>
    res.json(ondernemingAchterZaak(req.supplier.code)));
};
