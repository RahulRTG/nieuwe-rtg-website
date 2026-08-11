/* Vergeten (deelbestand): DE PERSOON ERUIT, DE REST BLIJFT.

   ../vergeten.js onderscheidt drie soorten. Dit is de tweede: alles waar het
   spoor van dit lid in het werk van een ANDER zit. Daar mag niet het geheel
   weg, want dan wist het ene lid de administratie of het gesprek van het
   andere. Wat weg moet is de persoon: de naam, de codenaam, de sleutel.

   Bij elkaar in een bestand omdat ze allemaal dezelfde afweging maken en die
   afweging telkens een oordeel is -- wat is van dit lid, en wat is van iemand
   anders? Dat leest beter als reeks dan verspreid tussen het weggooien.

   De eerste soort (WEG) en de derde (BLIJFT, MET GROND) staan in
   ../vergeten.js; wat buiten db.data ligt staat in ./bytes.js.

   Afgesplitst uit vergeten.js toen die de 10 KB passeerde. */
const WEG = '(verwijderd)';
const OP_VERZOEK = '(op verzoek verwijderd)';

module.exports = function maakAnoniem({ db, accounts, spelVergeet }) {
  /* De reacties van dit lid onder posts van ANDEREN: dat is de draad van iemand
     anders. Daar gaat alleen de persoon uit, niet het gesprek. `cn` vangt de
     oudere vorm op, waarin een reactie alleen een codenaam droeg en geen
     sleutel. */
  function reacties(key, cn) {
    for (const p of db.data.posts || []) {
      for (const c of p.comments || []) {
        if (c.key === key) { c.key = null; c.who = WEG; }
        else if (cn && c.who === cn) c.who = WEG;
      }
    }
  }

  // Sollicitaties: het bedrijf houdt zijn administratie, maar zonder iets dat
  // naar deze persoon herleidbaar is.
  function sollicitaties(key) {
    for (const list of Object.values(db.data.applications || {})) {
      for (const a of list) if (a.key === key) {
        a.name = OP_VERZOEK; a.contact = ''; a.note = '';
        a.cv = null; a.codename = null; a.key = null;
      }
    }
  }

  /* Een DM is de helft van andermans gesprek. Die ander mag zijn eigen verkeer
     houden; hij hoeft alleen niet meer te weten met wie. Dus blijft het bericht
     staan en verdwijnt de naam aan beide kanten. */
  function dms(cn) {
    if (!cn || !Array.isArray(db.data.dms)) return;
    for (const d of db.data.dms) {
      if (d.from === cn) d.from = WEG;
      if (d.to === cn) d.to = WEG;
    }
  }

  /* Het aanmeldingsdossier: RTG houdt het BESLUIT (wie zei ja tegen welke pas,
     en wanneer), want dat is haar eigen administratie van een menselijke
     beslissing. De AANVRAGER gaat eruit, net als bij sollicitaties. */
  function aanmeldingen(key, cn, sessie) {
    for (const a of db.data.aanmeldingen || []) {
      const raakt = (a.userId != null && key === 'user-' + a.userId) ||
        (cn && a.codenaam === cn) || (a.contact && sessie.account &&
          String(a.contact).toLowerCase() === String(accounts.emailOf(sessie.account) || '').toLowerCase());
      if (raakt) { a.naam = OP_VERZOEK; a.contact = ''; a.codenaam = null; a.userId = null; }
    }
  }

  /* Cadeaukaarten zijn een geval apart: daar zit geld in dat de zaak nog moet
     honoreren, dus die vernietigen zou iets weggooien wat niet van ons is. De
     kaart blijft geldig; alleen de KOPER verdwijnt eruit. */
  function cadeaukaarten(key) {
    for (const g of db.data.giftcards || []) {
      if (g.customerKey === key) { g.customerKey = null; g.kocht = WEG; }
    }
  }

  /* De bel van de zaak. Daar staat na een bestelling of een cadeaukaart een
     regel als "<codenaam> kocht ...", en die codenaam is precies waarmee dit
     lid weer terug te vinden is. De zaak mag haar eigen administratie houden,
     dus we halen de regel niet weg maar de PERSOON eruit. */
  function zaakMeldingen(cn) {
    if (!cn || !db.data.supplierNotifications) return;
    for (const lijst of Object.values(db.data.supplierNotifications)) {
      for (const n of lijst || []) {
        for (const veld of ['title', 'body']) {
          if (typeof n[veld] === 'string' && n[veld].includes(cn)) n[veld] = n[veld].split(cn).join(WEG);
        }
      }
    }
  }

  /* Het contactboek tussen de pas-niveaus (kern/lid.js) is de uitzondering in
     deze reeks: puur boekhouding, twee codenamen en verder niets. Daar valt
     niets aan te bewaren voor een ander, dus dat gaat gewoon weg. */
  function contactboek(cn) {
    if (!cn || !Array.isArray(db.data.contacts)) return;
    db.data.contacts = db.data.contacts.filter(c => c.higher !== cn && c.rtg !== cn);
  }


  /* Lopende potjes en de wachtrij (kern/spellen.js). Weggaan telt als
     opgeven: de tegenstander wint en die overwinning landt in de uitslagen,
     waarna de regel hieronder de vertrekker daar anoniem maakt. Die VOLGORDE
     is het hele punt -- draai je hem om, dan staat de codenaam van een
     verwijderd lid alsnog in een verse uitslagrij.

     De mechaniek staat in de spellenlaag en niet hier: wat "opgeven" betekent
     is een spelregel. Hier staat alleen dat het gebeurt, want dat is beleid. */
  function lopendePotjes(key) {
    if (typeof spelVergeet === 'function') spelVergeet(key);
  }

  /* Uitslagen van potjes (kern/spellen/uitslagen.js). Een partij is per
     definitie van meer dan een: hem weggooien zou de historie van de
     tegenstander uitwissen. De persoon gaat eruit en de partij blijft, in
     precies de vorm die deze laag al kent -- `{ anoniem: true }`, dezelfde
     vorm die een deelnemer onder de progressiegrens krijgt. Zo hoeft niemand
     die de lijst leest een tweede soort "onbekende speler" te begrijpen.

     Blijft er daarna geen enkele genoemde speler over, dan gaat de rij alsnog
     weg: een partij waarin niemand meer staat is voor niemand nog historie, en
     hem laten staan zou opslag zijn zonder doel. */
  function speluitslagen(key) {
    if (!key || !Array.isArray(db.data.spelUitslagen)) return;
    for (const r of db.data.spelUitslagen) {
      for (let i = 0; i < (r.spelers || []).length; i++) {
        if (r.spelers[i] && r.spelers[i].key === key) r.spelers[i] = { anoniem: true, won: !!r.spelers[i].won };
      }
    }
    db.data.spelUitslagen = db.data.spelUitslagen.filter(r => (r.spelers || []).some(s => s && s.key));
  }

  // Alles in een keer, in de volgorde waarin ../vergeten.js het deed.
  function anonimiseer(key, cn, sessie) {
    reacties(key, cn);
    sollicitaties(key);
    contactboek(cn);
    dms(cn);
    aanmeldingen(key, cn, sessie);
    cadeaukaarten(key);
    zaakMeldingen(cn);
    lopendePotjes(key);   // eerst: dit MAAKT nog een uitslagrij
    speluitslagen(key);  // en dan pas anonimiseren
  }

  return { anonimiseer };
};
