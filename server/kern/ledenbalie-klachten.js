/* DE KLACHTEN VAN DE BALIE.

   Een eigen bestand omdat het een eigen voorraad is: db.data.balieKlachten,
   met een eigen dak (MAX_KLACHTEN) en een eigen levensloop (open -> gesloten).
   In ./ledenbalie.js stond het tussen het dossier en het abo-voorstel in, en
   dat leest alsof een klacht een veld van een lid is. Dat is het niet -- een
   klacht heeft een eigen geschiedenis, en er kijkt later iemand anders naar
   dan wie hem aannam.

   Wat hier NIET langsloopt: eis(). Een klacht opnemen is geen INZAGE -- de
   baliemedewerker krijgt er niets van het lid door te zien, hij schrijft
   alleen op waar het over ging. Vandaar magBalie() en niet eis(): een zetel is
   nodig, een aanleiding niet, want de klacht IS de aanleiding. Zou eis() hier
   staan, dan vulde het inzagejournaal zich met regels waarin niemand iets
   heeft ingezien, en dat maakt het journaal juist minder waard. */
'use strict';

const KLACHT_SOORTEN = ['betaling', 'toegang', 'reis', 'partner', 'privacy', 'overig'];
const MAX_KLACHTEN = 5000;

function maakKlachten({ crypto, save, accounts, kap, nu, magBalie, klachtLijst }) {
  const naarBuiten = (k) => ({ id: k.id, soort: k.soort, tekst: k.tekst, status: k.status, at: k.at });

  function balieKlachtOpen(zetel, id, soort, tekst) {
    if (!magBalie(zetel)) return { status: 403, error: 'Hiervoor is een baliezetel nodig.' };
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    const s = KLACHT_SOORTEN.includes(String(soort)) ? String(soort) : 'overig';
    const t = kap(tekst, 600);
    /* Een klacht is het begin van een dossier waar later iemand anders naar
       kijkt. "x" is dan geen klacht maar ruis, en ruis in een klachtenlijst
       kost precies de aandacht die de echte klacht nodig heeft. */
    if (t.length < 12) return { status: 400, error: 'Schrijf op waar de klacht over gaat (een zin volstaat).' };
    /* Uit de CSPRNG en niet uit Math.random(): dit is een sleutel waarmee je
       een klacht opzoekt en sluit. Verderop in dit huis staat dezelfde regel
       voor elk ander kenmerk, en een uitzondering die niemand kan uitleggen is
       geen uitzondering maar een vergissing. */
    const k = { id: 'kl_' + crypto.randomBytes(5).toString('hex'), lidId: u.id, soort: s, tekst: t,
      status: 'open', door: zetel, at: nu(), dicht: null };
    klachtLijst().unshift(k);
    if (klachtLijst().length > MAX_KLACHTEN) klachtLijst().length = MAX_KLACHTEN;
    save();
    return { ok: true, klacht: naarBuiten(k) };
  }

  function balieKlachtStatus(zetel, klachtId, status) {
    if (!magBalie(zetel)) return { status: 403, error: 'Hiervoor is een baliezetel nodig.' };
    const k = klachtLijst().find((x) => x.id === String(klachtId));
    if (!k) return { status: 404, error: 'Deze klacht kennen we niet.' };
    const nieuw = String(status) === 'gesloten' ? 'gesloten' : 'open';
    k.status = nieuw;
    k.dicht = nieuw === 'gesloten' ? nu() : null;
    save();
    return { ok: true, klacht: naarBuiten(k) };
  }

  /* De open klachten van een lid, voor het dossier. Hier en niet daar, want
     dit bestand kent de voorraad en het dossier hoort hem niet te kennen. */
  const openKlachten = (id) => klachtLijst()
    .filter((k) => String(k.lidId) === String(id) && k.status === 'open')
    .map(naarBuiten);

  return { balieKlachtOpen, balieKlachtStatus, openKlachten };
}

module.exports = { KLACHT_SOORTEN, MAX_KLACHTEN, maakKlachten };
