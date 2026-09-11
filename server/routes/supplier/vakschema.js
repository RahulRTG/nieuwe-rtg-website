/* EEN SCHEMA KLAARZETTEN VOOR EEN LID (kern/vakschema.js), zaakkant.

   Dit is de handeling `schemaGeven` uit kern/persoonseis-lijst.js, en hij
   bestaat omdat RUGDEKKING.md par. 4.4 de enige eerlijke uitweg aanwijst: RTG
   mag geen inhoud geven op het niveau `professioneel` (kern/zorgniveau.js), dus
   wordt de professional IN het systeem gezet in plaats van dat er een
   uitzondering op die grens komt.

   DE POORT ZIT IN DE KERN EN NIET HIER, met opzet. `magHandeling` weegt het
   GENRE van de zaak en het VAKBEWIJS van de mens achter de sessie, en dat stuk
   verloopt -- het wordt bij elke vraag opnieuw gerekend. Een controle in deze
   route zou een tweede plek zijn waar hetzelfde wordt beslist.

   GEEN MANAGERCONTROLE, en dat is hier geen vergeetpost. Bij ./retour.js is
   `manager` de lat omdat een retour een geldbesluit klaarzet; hier is de lat het
   VAKBEWIJS van de mens zelf. Een praktijkeigenaar zonder BIG hoort dit niet te
   mogen en een fysiotherapeut in loondienst wel -- precies andersom dus. */
module.exports = (kern) => {
  /* GEEN `if (!vakschema) return;` HIER, met opzet. Die wachter stond er, en hij
     zette een bedradingsfout stil om in 404: deze route werd eerst gemonteerd
     vanuit routes/supplier.js, dat VOOR de laag draait die `vakschema` in de
     kern legt. Hij staat nu in opzet/aanbouw3.js, direct na die kern -- en als
     hij daar ooit opnieuw te vroeg komt, hoort de server dat hardop te zeggen
     in plaats van een route te laten verdwijnen. */
  const { app, vakschema, supplierAuth } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json(r)
    : res.json(r);

  app.post('/api/supplier/vakschema/voorstel', supplierAuth, async (req, res) =>
    stuur(res, await vakschema.voorstel(req.supplier.code, req.body || {}, req.actor)));

  app.post('/api/supplier/vakschema/mijn', supplierAuth, (req, res) =>
    stuur(res, vakschema.mijnVoorstellen(req.supplier.code, req.actor)));
};
