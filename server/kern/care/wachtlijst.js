/* Care (deelmodule): de wachtlijst en de gemiste afspraak.

   DE WACHTLIJST. Een lid dat eerder wil, zet zich op de lijst bij een
   aanbieder. Komt er een slot vrij doordat iemand annuleert, dan krijgt de
   lijst bericht -- en dan pakt wie wil het slot zelf, op de gewone manier.

   ER WORDT NIEMAND AUTOMATISCH INGEBOEKT, en dat is een keuze. Een afspraak
   die geld kost en tijd vraagt, hoort niet in uw agenda te verschijnen omdat
   een ander afzegde. "Met toestemming kan het" klinkt aardig, maar die
   toestemming zou dan weken eerder zijn gegeven voor een moment dat u nog niet
   kende. Een seintje en een knop is eerlijker dan een cadeau dat u moet
   afzeggen.

   DE GEMISTE AFSPRAAK, EN DE GRENS ERONDER. Een aanbieder kan noteren dat
   iemand niet kwam -- dat hoort bij zijn eigen agenda. Wat NIET gebeurt is er
   een cijfer van maken dat met het lid meereist: de telling staat per
   AANBIEDER, en een andere zaak ziet hem niet. Een no-show-score die door het
   hele huis loopt is een strafblad met een vriendelijke naam.

   En wat het lid krijgt is geen berisping maar een aanbod: wilt u uw
   herinnering eerder? Dat is het enige dat een gemiste ochtend echt oplost. */

module.exports = (ctx) => {
  const { db, save, crypto, nu, vandaag, lijsten, aanbiederVan, notify } = ctx;
  /* aanbiedersVanSupplier komt uit de ledenlaag, en die wordt NA deze module
     gebouwd (zie kern/care.js: de wachtlijst moet er eerder zijn omdat
     careAnnuleer hem aanroept). Dus op aanroepmoment uit de context pakken en
     niet bij het opbouwen -- anders bevriest hier undefined. */
  const aanbiedersVanSupplier = (code) => ctx.aanbiedersVanSupplier(code);

  const bak = () => { if (!Array.isArray(db.data.careWachtlijst)) db.data.careWachtlijst = []; return db.data.careWachtlijst; };
  const opLijst = (key, aanbiederId) =>
    bak().find(w => w.key === key && w.aanbiederId === aanbiederId && w.status === 'actief');

  function wachtlijstZet(key, body) {
    lijsten();
    const a = aanbiederVan(body.aanbiederId);
    if (!a) return { status: 404, error: 'Zorgaanbieder niet gevonden.' };
    if (opLijst(key, a.id)) return { ok: true, alGezet: true, aanbiederNaam: a.naam };
    bak().push({ id: crypto.randomBytes(4).toString('hex'), key, aanbiederId: a.id,
      aanbiederNaam: a.naam, status: 'actief', at: nu() });
    save();
    return { ok: true, aanbiederNaam: a.naam,
      uitleg: 'Komt er iets vrij, dan krijgt u bericht. U boekt het dan zelf; er wordt niets voor u ingeboekt.' };
  }

  function wachtlijstAf(key, body) {
    const w = bak().find(x => x.id === String(body.id || '') && x.key === key && x.status === 'actief');
    if (!w) return { status: 404, error: 'U staat daar niet (meer) op de lijst.' };
    w.status = 'af'; save();
    return { ok: true, af: w.aanbiederNaam };
  }

  const wachtlijstVan = key => ({ ok: true,
    lijsten: bak().filter(w => w.key === key && w.status === 'actief')
      .map(w => ({ id: w.id, aanbiederNaam: w.aanbiederNaam, sinds: w.at })) });

  /* Er is een slot vrijgekomen. Iedereen op de lijst krijgt een seintje met wat
     er vrij is; wie het eerst boekt, heeft het. Geen voorrang, geen
     wachtnummer: dat zou een belofte zijn die de agenda niet kan waarmaken. */
  function slotVrij(aanbiederId, datum, tijd, wat) {
    const a = aanbiederVan(aanbiederId);
    if (!a) return 0;
    const rijen = bak().filter(w => w.aanbiederId === aanbiederId && w.status === 'actief');
    for (const w of rijen) {
      notify(w.key, { icon: 'zorg', title: 'Er is iets vrijgekomen bij ' + a.naam,
        body: (wat || 'Een afspraak') + ' op ' + datum + ' om ' + tijd + '. Wie het eerst boekt, heeft het.',
        scope: 'care' });
    }
    return rijen.length;
  }

  /* ---- de gemiste afspraak, aan de kant van de aanbieder ---- */

  function careNietVerschenen(supplierCode, body) {
    lijsten();
    const ids = aanbiedersVanSupplier(supplierCode).map(a => a.id);
    if (!ids.length) return { status: 409, error: 'Dit account is geen zorgaanbieder.' };
    const bk = db.data.careBoekingen.find(x => x.ref === String(body.ref || '') && ids.includes(x.aanbiederId));
    if (!bk) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (bk.datum > vandaag()) return { status: 400, error: 'Die afspraak moet nog komen.' };
    if (bk.status === 'nietVerschenen') return { status: 409, error: 'Die staat al genoteerd.' };
    bk.status = 'nietVerschenen';
    bk.nietVerschenenOp = nu();
    save();

    /* Geen berisping maar een aanbod. Dit is het enige dat een gemiste ochtend
       echt oplost, en het is aan het lid of hij het wil. */
    notify(bk.key, { icon: 'zorg', title: 'U was er niet bij ' + bk.aanbiederNaam,
      body: 'Dat gebeurt. Wilt u uw herinnering voortaan eerder? Dat zet u zelf om bij uw afspraken.',
      scope: 'care' });
    return { ok: true, ref: bk.ref, genoteerd: true,
      uitleg: 'Genoteerd bij uw eigen agenda. Andere zaken zien dit niet.' };
  }

  /* Wat een AANBIEDER ziet: zijn eigen gemiste afspraken. Bewust per aanbieder
     en niet per lid: een telling die met het lid meereist, is een strafblad. */
  function careGemist(supplierCode) {
    lijsten();
    const ids = aanbiedersVanSupplier(supplierCode).map(a => a.id);
    if (!ids.length) return { status: 409, error: 'Dit account is geen zorgaanbieder.' };
    const eigen = db.data.careBoekingen.filter(x => ids.includes(x.aanbiederId) && x.status === 'nietVerschenen');
    return { ok: true, aantal: eigen.length,
      gemist: eigen.slice(0, 30).map(x => ({ ref: x.ref, datum: x.datum, tijd: x.tijd,
        codenaam: x.codenaam, behandelingNaam: x.behandelingNaam })),
      grens: 'Dit zijn uw eigen afspraken. RTG houdt geen no-show-cijfer bij dat een lid meeneemt naar een andere zaak.' };
  }

  return { wachtlijstZet, wachtlijstAf, wachtlijstVan, slotVrij, careNietVerschenen, careGemist };
};
