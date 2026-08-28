/* Een eigen adres naast naam.rtg, bijvoorbeeld hotelazur.nl.

   DIT STAAT STANDAARD UIT. De schakelaar zit in de boardroom (functie
   'dom-eigendomein', standaard: false). De reden dat het een boardroom-besluit
   is en geen ledenknop: een extern domein haalt een site BUITEN het RTG-web.
   Binnen het huis leest alleen een ingelogd lid een site; op een eigen domein
   leest iedereen hem, ook wie geen account heeft. Dat is geen instelling maar
   een verandering van wie de lezers zijn.

   TWEE SLOTEN, MET OPZET. De boardroom zet de functie aan voor het hele huis;
   daarna koppelt de eigenaar per site zelf een domein. Zonder het eerste kan
   niemand iets, en het tweede blijft een eigen, bewuste handeling -- een lid
   hoort niet publiek te worden doordat de boardroom een knop omzette.

   WAT DIT WEL EN NIET DOET. Wij serveren de site aan wie hem op dat adres komt
   halen. Dat het verzoek hier AANKOMT is een andere zaak: daar zijn DNS en een
   certificaat voor nodig, en die draaien buiten deze app. Het scherm zegt dat
   met zoveel woorden, want een adres dat is ingevuld maar nergens heen wijst,
   voelt als een kapotte functie terwijl er niets kapot is. */
module.exports = ({ store, save, scho, spoor }) => {
  /* Een hostnaam, geen url en geen pad: letters, cijfers, koppeltekens en
     punten, met een echte extensie. Wat hier doorheen komt, komt straks in een
     Host-vergelijking terecht, dus we zijn streng. */
  const HOST = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
  // adressen van het huis zelf horen niemand toe te vallen
  const VERBODEN = /(^|\.)(rtg|localhost)$/;

  function norm(v) {
    return String(v == null ? '' : v).toLowerCase().trim()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '')
      .replace(/^www\./, '');            // www is hetzelfde adres, niet een tweede
  }

  function koppel(d, domeinIn, wie) {
    if (!d.online || !d.adres) return { error: 'Zet de site eerst online op het RTG-web; daarna kan er een eigen adres bij.', status: 400 };
    const h = norm(domeinIn);
    if (!h) {                                    // leeg = ontkoppelen
      delete d.domein;
      spoor.noteer(d.id, 'eigen domein losgekoppeld', wie);
      save();
      return { ok: true, domein: null };
    }
    if (!HOST.test(h) || h.length > 190) return { error: 'Dat is geen geldig adres. Vul iets als hotelazur.nl in.', status: 400 };
    if (VERBODEN.test(h)) return { error: 'Adressen binnen rtg zijn van het huis; kies een eigen domein.', status: 400 };
    const bezet = store().lijst.find(x => x.domein === h && x.id !== d.id);
    if (bezet) return { error: 'Dit adres is al aan een andere site gekoppeld.', status: 409 };
    d.domein = h;
    spoor.noteer(d.id, 'eigen domein gekoppeld: ' + h, wie);
    save();
    return { ok: true, domein: h };
  }

  /* Welke site hoort bij deze hostnaam. Alleen een site die ONLINE staat: uit
     de lucht halen op het RTG-web hoort ook het eigen adres stil te zetten,
     anders is "offline" maar de helft waar. */
  function siteVoorHost(hostIn) {
    const h = norm(hostIn);
    if (!h) return null;
    return store().lijst.find(x => x.domein === h && x.online && x.adres) || null;
  }

  /* De omgekeerde vraag: heeft DEZE zaak een eigen adres, en staat dat aan?
     `siteVoorHost` gaat van adres naar site; deze gaat van zaak naar adres, en
     hij hoort hier en niet bij de vrager -- anders staat er straks een tweede
     plek die weet wanneer een adres "echt aan" is (online én gekoppeld), en die
     twee lopen uiteen. kern/commerce/publiekslot.js leest hem om te bepalen of
     een verkoopweg publiek mag; die laag opent niets, hij kijkt hier.

     Meerdere sites per zaak kan: dan wint de eerste die online staat MET een
     adres. Een zaak die er twee heeft, verkoopt langs allebei hetzelfde aanbod. */
  function siteVanZaak(zaakCode) {
    const c = String(zaakCode == null ? '' : zaakCode).trim();
    if (!c) return null;
    const van = store().lijst.filter(x => x && x.zaakCode === c);
    const aan = van.find(x => x.domein && x.online && x.adres);
    const d = aan || van[0];
    if (!d) return null;
    return { id: d.id, titel: d.titel || '', adres: d.adres || '', online: !!d.online, domein: d.domein || '' };
  }

  return { koppel, siteVoorHost, siteVanZaak, norm };
};
