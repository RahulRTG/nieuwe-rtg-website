/* Het keukenbrein (toren horeca): de voorraad telt echt mee.

   Bouwt voort op de bestaande voorraadlijst van de zaak (s.voorraad:
   {id, naam, aantal, min, eenheid, kostprijs}) en maakt er een sluitend
   systeem van:

   - RECEPTEN: per menu-gerecht de ingredienten met hoeveelheid
     (s.recepten = { menuItemId: [{artikelId, hoeveelheid}] }). Daarmee is de
     kostprijs en de marge van elk gerecht altijd actueel.
   - AFBOEKEN: elke verkoop (kassa-bon en betaalde gastbestelling) boekt de
     ingredienten automatisch af via het recept. Een verkoop wordt NOOIT
     geblokkeerd door de voorraadstand (de gast gaat voor); de stand mag
     onder nul en de telling zet hem later recht.
   - TELLING, VERSPILLING en LEVERING: de vloer telt wat er echt staat, boekt
     breuk en derving met reden, en meldt leveringen aan (met inkoopprijs,
     die meteen de kostprijs van het artikel wordt).
   - LOGBOEK: elke beweging staat in s.voorraadLog met wie, wat en waarom.
     Zo is een kasverschil of een gat in de voorraad altijd te herleiden.
   - INKOOPADVIES: alles onder het minimum, met een voorstel dat aanvult tot
     twee keer het minimum. Een knop ervan maken (groothandel) komt in de
     volgende ronde van deze toren. */

module.exports = ({ db, save, crypto, schoon, notifySupplier }) => {
  const nu = () => new Date().toISOString();
  const rond3 = x => Math.round(Number(x) * 1000) / 1000;
  const rond2 = x => Math.round(Number(x) * 100) / 100;

  const artikelen = s => (s.voorraad = Array.isArray(s.voorraad) ? s.voorraad : []);
  const recepten = s => (s.recepten = (s.recepten && typeof s.recepten === 'object') ? s.recepten : {});
  function logboek(s) { if (!Array.isArray(s.voorraadLog)) s.voorraadLog = []; return s.voorraadLog; }
  function schrijfLog(s, regel) {
    logboek(s).unshift(Object.assign({ at: nu() }, regel));
    if (s.voorraadLog.length > 2000) s.voorraadLog.pop();
  }
  const artikelVan = (s, id) => artikelen(s).find(x => x.id === id) || null;
  const menuItemVan = (s, idOfNaam) => {
    const menu = Array.isArray(s.menu) ? s.menu : [];
    const zoek = String(idOfNaam || '').trim().toLowerCase();
    return menu.find(m => m.id === idOfNaam) || menu.find(m => String(m.name || '').toLowerCase() === zoek) || null;
  };
  // de drempelwachter: een melding per keer dat een artikel onder zijn minimum zakt
  function bewaakMinimum(s, a) {
    if (a.min > 0 && a.aantal <= a.min && !a.laagGemeld) {
      a.laagGemeld = true;
      try { notifySupplier(s.code, { icon: '\u{1F4C9}', title: 'Voorraad laag: ' + a.naam, body: 'Nog ' + a.aantal + ' ' + a.eenheid + ' (minimum ' + a.min + '). Zie het inkoopadvies op de Voorraad-tab.' }); } catch (e) {}
    } else if (a.aantal > a.min) a.laagGemeld = false;
  }

  /* ---------- recepten en marge ---------- */

  /* De voorraad- en advieslaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de voorraadlaag gaat
     eerst de context in omdat de advieslaag kostprijsVan gebruikt. */
  const ctx = { db, save, crypto, schoon, notifySupplier,
    logboek, schrijfLog, bewaakMinimum, nu, rond3, rond2, artikelen, recepten, menuItemVan, artikelVan };
  const deelVoorraad = require('./keuken/voorraad')(ctx);
  Object.assign(ctx, deelVoorraad);
  const deelAdvies = require('./keuken/advies')(ctx);
  const { receptZet, kostprijsVan, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, leverBinnen } = deelVoorraad;
  const { menuAnalyse, menuAdvies, inkoopadvies, werkvloer, overzicht } = deelAdvies;

  return { keuken: { overzicht, werkvloer, receptZet, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, leverBinnen, menuAnalyse, menuAdvies, inkoopadvies, kostprijsVan } };
};
