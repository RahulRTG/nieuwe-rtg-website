/* DE SCHRIJFWEG VAN DE SCHADUWMETING -- de buffer en het spoelen.

   Deel van ./mensdeur.js; zie de kop daar voor wat er geteld wordt en waarom
   het een teller is en geen journaal. Dit bestand gaat alleen over HOE die
   tikken de opslag bereiken, en het staat apart omdat die vraag een eigen
   uitleg verdient -- hij heeft dit huis een gebroken PostgreSQL-opstelling
   gekost.

   WAT ER MISGING. De eerste versie deed in `res.on('finish')` het voor de hand
   liggende: db.data muteren en save() roepen. Dat brak de PostgreSQL-opstelling
   volledig -- twee instances op een gedeelde database, en de server werd niet
   meer `ready` (`writeHealthy: false`, elk verzoek 503). Niet af en toe:
   reproduceerbaar, 11 geslaagde integratietoetsen werden er 1.

   De reden staat uitgeschreven in ../kosten/meter.js, en gold hier woord voor
   woord: *een timer heeft geen requestcommit; hij mag daarom nooit eerst de
   levende db.data muteren en daarna save() roepen -- in PostgreSQL sluit dat
   terecht de verkeerspoort.* Een `finish`-handler is precies zo'n moment: de
   response is verstuurd, de request-transactie is voorbij, en wat er daarna
   schrijft staat buiten elke commit.

   Vandaar dezelfde vorm als die meter, en niet een eigen vinding:

     tellen      gaat naar een RAM-buffer. Nooit I/O in het pad van een verzoek.
     spoelen     gaat door `bewerkCollectie` -- het collectieslot van de opslag,
                 de enige autoritatieve baan -- op een timer die unref't.
     mislukken   legt de batch TERUG in de buffer en plant opnieuw. Een teller
                 die stilletjes tikken weggooit, meet iets anders dan hij zegt.
     lezen       projecteert de buffer over de opgeslagen stand, zodat een
                 leesverzoek nooit een verborgen schrijfactie wordt.

   Zonder `bewerkCollectie` (de eenprocesmotoren) valt hij terug op db.data plus
   save(); daar bestaat het probleem niet, en de terugval staat er expliciet in
   plaats van als stilzwijgende aanname.

   `pasToe` woont hier en niet in twee bestanden: spoelen en lezen rekenen met
   DEZELFDE functie. Twee kopieen van die rekensom is de vorm waarin een teller
   op het scherm iets anders zegt dan in de opslag. */
'use strict';

/* Hoe lang tikken in RAM mogen blijven. Kort genoeg dat een herstart weinig
   kost, lang genoeg dat een drukke minuut niet honderd schrijfacties wordt. */
const SPOEL_MS = 5000;
/* En een bovengrens op de buffer zelf: geen enkele lezer mag hem laten groeien
   tot hij zelf het probleem is (dezelfde regel als BUFFER_MAX in kosten/meter). */
const BUFFER_MAX = 500;

function maakSpoeler({ bak, save, bewerkCollectie, collectie, maxPaden }) {
  /* De RAM-buffer: pad -> { metMens, zonderMens }, nog niet weggeschreven. */
  let wacht = new Map();
  let klaarZetter = null;

  /* De batch over een kaart leggen. EEN plek, zodat spoelen en lezen nooit
     uiteenlopen. Boven het plafond landt alles in de bak `overig`: de sleutel is
     het PAD en dat komt van buiten, dus zonder plafond kan een vreemde met een
     geldige kantoorcode de opslag laten groeien door paden te verzinnen. */
  function pasToe(kaart, batch) {
    for (const [pad, tik] of batch) {
      let sleutel = pad;
      if (!kaart[sleutel] && Object.keys(kaart).length >= maxPaden) sleutel = 'overig';
      if (!kaart[sleutel]) kaart[sleutel] = { pad: sleutel, metMens: 0, zonderMens: 0 };
      kaart[sleutel].metMens += tik.metMens;
      kaart[sleutel].zonderMens += tik.zonderMens;
    }
  }

  function planSpoel() {
    if (klaarZetter) return;
    klaarZetter = setTimeout(() => {
      klaarZetter = null;
      try { spoel(); } catch (e) { /* een meting houdt nooit iets tegen */ }
    }, SPOEL_MS);
    /* unref: een teller mag een proces nooit in leven houden. */
    if (klaarZetter.unref) klaarZetter.unref();
  }

  /* DE ENIGE SCHRIJFWEG NAAR DE OPSLAG. Via het collectieslot waar dat bestaat;
     bij een fout gaat de batch terug de buffer in en wordt opnieuw gepland. */
  function spoel() {
    if (!wacht.size) return false;
    const batch = wacht; wacht = new Map();
    try {
      if (typeof bewerkCollectie === 'function') {
        bewerkCollectie(collectie, (kaart) => pasToe(kaart, batch));
      } else {
        pasToe(bak(), batch);
        save();
      }
      return true;
    } catch (e) {
      for (const [pad, tik] of batch) {
        const t = wacht.get(pad) || { metMens: 0, zonderMens: 0 };
        t.metMens += tik.metMens; t.zonderMens += tik.zonderMens;
        wacht.set(pad, t);
      }
      planSpoel();
      return false;
    }
  }

  /* Een tik erbij. Doet nooit I/O: hij plant hoogstens een spoeling. */
  function tik(pad, heeftMens) {
    const t = wacht.get(pad) || { metMens: 0, zonderMens: 0 };
    if (heeftMens) t.metMens += 1; else t.zonderMens += 1;
    wacht.set(pad, t);
    if (wacht.size >= BUFFER_MAX) spoel(); else planSpoel();
  }

  /* De nog niet gespoelde tikken over een beeld leggen, voor de lezer. */
  const projecteer = (beeld) => { if (wacht.size) pasToe(beeld, wacht); return beeld; };

  return { tik, spoel, projecteer, SPOEL_MS, BUFFER_MAX };
}

module.exports = { maakSpoeler, SPOEL_MS, BUFFER_MAX };
