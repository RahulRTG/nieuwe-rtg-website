/* Kern-module "gegevenspoort": wat is er nodig voordat er iets met een DERDE
   PARTIJ geregeld kan worden, en wat mist dit lid daarvan nog?

   Een gratis RTG-account vraagt vier dingen: naam, geboortedatum, e-mail en een
   wachtwoord (zie kern/aanmeldgesprek-aanmeld.js). Wie alleen rondkijkt hoeft
   nooit meer te geven. Maar zodra er een zaak, een koerier of een professional in
   beeld komt, moet die iemand kunnen bereiken en soms weten met wie hij te maken
   heeft. Dan pas vraagt Rahul de rest -- in een gesprek, niet in een formulier.

   De regel is streng in beide richtingen. Niets vragen wat de handeling niet nodig
   heeft: een tafel reserveren vraagt geen adres, en een bestelling ter plekke
   vraagt geen paspoort. En niets overslaan wat hij wel nodig heeft: zonder
   telefoonnummer kan de zaak je niet bereiken als er iets misgaat met je tafel.

   Wat waar staat:
     telefoon  de kluis (enc_phone), gebonden aan de rij
     adres     het ledendossier (member_state.adres), versleuteld en gebonden
     identiteit  de BESTAANDE verificatie (/api/verify/upload). Hier komt met
                 opzet geen tweede paspoort-intake naast: een document uploaden en
                 laten goedkeuren is een eigen weg, en die is er al. Deze poort
                 wijst er alleen naar. */

const VELDEN = {
  telefoon: {
    label: 'je telefoonnummer',
    waarom: 'De zaak moet je kunnen bereiken als er iets verandert aan je tafel of je bestelling. Alleen daarvoor.'
  },
  adres: {
    label: 'je adres',
    waarom: 'Zonder adres weet de bezorger niet waar hij moet zijn. Het blijft in de kluis en gaat alleen mee met een bezorging.'
  },
  identiteit: {
    label: 'een geverifieerde identiteit',
    waarom: 'Hiervoor moet de zaak zeker weten wie er komt. Dat loopt via de identiteitscontrole, niet via dit gesprek.',
    viaVerificatie: true
  }
};

/* Wat elke soort handeling nodig heeft. Bewust klein gehouden: liever een korte,
   eerlijke lijst dan een formulier dat alles vast vraagt. */
const NODIG = {
  bestelling: ['telefoon'],            // eten/drinken bij een zaak
  reservering: ['telefoon'],           // een tafel of een dienst op naam
  bezorging: ['telefoon', 'adres'],    // er komt iemand langs
  identiteit: ['identiteit']           // afhalen/inchecken waar men je moet kennen
};

function maakGegevenspoort({ accounts, getMemberState }) {
  /* Heeft dit lid het veld al? `u` is de accountrij, `md` het ledendossier. */
  function heeft(veld, u, md) {
    if (veld === 'telefoon') return !!(u && accounts.phoneOf(u));
    if (veld === 'adres') return !!(md && String(md.adres || '').trim());
    if (veld === 'identiteit') return !!(u && String(u.verified || '') === 'verified');
    return true;
  }

  /* Wat mist dit lid voor deze soort handeling? Geeft een lijst met veld, label en
     het eerlijke waarom, plus of het via de identiteitscontrole loopt. Een lege
     lijst betekent: gewoon doorgaan. */
  function ontbreekt(sessie, soort) {
    const velden = NODIG[String(soort || '')] || [];
    if (!velden.length) return [];
    const u = sessie && sessie.account;
    if (!u) return [];                       // demo-persona's: niets te vragen
    let md = null;
    try { md = getMemberState(u.id); } catch (e) { md = null; }
    return velden.filter(v => !heeft(v, u, md)).map(v => ({
      veld: v, label: VELDEN[v].label, waarom: VELDEN[v].waarom,
      viaVerificatie: !!VELDEN[v].viaVerificatie
    }));
  }

  /* De poort voor een route: geeft null als alles er is, en anders een net
     antwoord met wat er ontbreekt. 428 ("Precondition Required") zegt precies wat
     het is: het verzoek mag, maar er moet eerst iets gebeuren. De app kan met
     `ontbreekt` meteen het gesprek met Rahul openen. */
  function poort(sessie, soort) {
    const mist = ontbreekt(sessie, soort);
    if (!mist.length) return null;
    const wat = mist.map(m => m.label);
    const zin = wat.length === 1 ? wat[0] : wat.slice(0, -1).join(', ') + ' en ' + wat[wat.length - 1];
    return {
      status: 428,
      error: 'Hiervoor heb ik nog ' + zin + ' nodig; dat vraag ik even.',
      ontbreekt: mist
    };
  }

  return { ontbreekt, poort, NODIG, VELDEN };
}

module.exports = { maakGegevenspoort, NODIG, VELDEN };
