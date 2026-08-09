/* Spellen (deelmodule): het verloop van een partij, voor de replay.

   De uitslagen (./uitslagen.js) zeggen WIE won; dit zegt HOE. Twee aparte
   dingen met twee aparte termijnen, en dat is met opzet: een uitslag is een
   feit dat een jaar meegaat, een verloop is een naspeelbaar geheugen dat je
   binnen een maand nog eens wilt bekijken en daarna niet meer. Ze in een tak
   proppen zou betekenen dat het een de termijn van het ander erft.

   VIER KEUZES:

   1. ALLEEN DE SPELERS ZELF. Een replay is geen kijkweergave: wie live mocht
      meekijken (vrienden, toernooigenoten) krijgt hier niets. Het verloop van
      een partij bevat alles wat er gebeurd is, inclusief wat op dat moment
      verborgen was, en dat is van de twee die speelden.

   2. OOK ONDER DE 18+-GRENS. Je eigen partij terugkijken is geen ranglijst en
      geen stand -- er wordt niets van opgeteld en niets van vergeleken. Het is
      dezelfde redenering als bij een toernooi: begrensd, en het laat geen
      stand na. Een tiener mag zijn eigen schaakpartij nabespreken.

   3. HET PLATFORM SCHRIJFT, NIET HET SPEL. Elke geaccepteerde zet wordt hier
      opgeslagen zoals hij binnenkwam, zonder te weten wat hij betekent. Dat
      werkt voor alle zestien spellen tegelijk en het is de enige manier waarop
      een nieuw spel dit vanzelf krijgt -- zestien motoren die er elk aan moeten
      denken is zestien kansen om het te vergeten.

   4. EEN BOVENGRENS PER PARTIJ. Een potje dat blijft doorgaan mag de database
      niet vullen. Boven de grens vallen de OUDSTE zetten weg en niet de
      nieuwste: het eind van een partij is interessanter dan het begin, en een
      afgekapte replay zegt dat er ook bij. */
module.exports = (ctx) => {
  const { db, save, nu, codenaamVan } = ctx;

  const MAX_ZETTEN = 500;     // per partij
  const MAX_PARTIJEN = 5000;  // harde bovengrens op schijf, los van de termijn

  function Z() {
    if (!Array.isArray(db.data.spelZetten)) db.data.spelZetten = [];
    return db.data.spelZetten;
  }

  /* Een geaccepteerde zet vastleggen. Wordt aangeroepen vanuit dezelfde plek
     die de zet doorlaat, dus een zet die geweigerd is komt hier nooit -- een
     replay die afgekeurde zetten bevat is geen verloop maar een logboek. */
  function noteerZet(potje, mij, zet) {
    if (!potje || !potje.id) return;
    const lijst = Z();
    let r = lijst.find(x => x.potje === potje.id);
    if (!r) {
      r = { potje: potje.id, soort: potje.soort, spelers: potje.spelers.slice(), zetten: [], afgekapt: false, at: nu() };
      lijst.push(r);
      if (lijst.length > MAX_PARTIJEN) lijst.splice(0, lijst.length - MAX_PARTIJEN);
    }
    r.zetten.push({ s: potje.spelers.indexOf(mij), z: zet });
    if (r.zetten.length > MAX_ZETTEN) {
      r.zetten.splice(0, r.zetten.length - MAX_ZETTEN);
      r.afgekapt = true;   // en dat zeggen we ook, zie de kop
    }
  }

  /* Het verloop van je eigen partij. Alleen wie meespeelde; een kijker of een
     toernooigenoot krijgt hier niets, ook al mocht hij live meekijken. */
  function spelReplay(mij, id) {
    const r = Z().find(x => x.potje === String(id || ''));
    if (!r || !r.spelers.includes(mij))
      return { status: 404, error: 'Van deze partij is geen verloop (meer).' };
    return {
      status: 200,
      potje: r.potje, soort: r.soort, at: r.at, afgekapt: !!r.afgekapt,
      spelers: r.spelers.map(k => k ? codenaamVan(k) : null),
      zetten: r.zetten.map(x => ({ speler: x.s, zet: x.z }))
    };
  }

  /* Een lid dat zich laat verwijderen. Zijn sleutel gaat eruit; blijft er geen
     enkele speler over, dan is er niemand meer die de replay MAG zien en heeft
     hij dus geen doel meer. */
  function zettenVergeet(key) {
    if (!key) return;
    const over = [];
    for (const r of Z()) {
      if (!r.spelers.includes(key)) { over.push(r); continue; }
      r.spelers = r.spelers.map(k => k === key ? null : k);
      if (r.spelers.some(Boolean)) over.push(r);
    }
    db.data.spelZetten = over;
    save();
  }

  return { noteerZet, spelReplay, zettenVergeet, _MAX_ZETTEN: MAX_ZETTEN };
};
