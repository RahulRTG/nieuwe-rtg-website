/* Beeld "Uit De Salon": de foto's die de website-makers als bron mogen
   gebruiken. De Salon levert het beeld (merkregel) -- uitgelichte en
   partner-posts met een echte foto, altijd met naamsvermelding, plus het eigen
   RTG-campagnebeeld als vaste huisbron (AI-gemaakt in eigen huis, quiet luxury).
   Geen stockfoto's, geen extern beeld: alleen /media- of /campagne-verwijzingen.
   We geven alleen verwijzingen terug, nooit bestanden. */

const CAMPAGNE = ['bamboe', 'hero', 'huis-omslag', 'jet', 'kaiseki', 'kyoto-suite', 'onsen', 'palacio', 'riad']
  .map(n => '/campagne/' + n + '.jpg');

// alleen eigen bronnen: de mediastore (/media/..) of het campagnebeeld (/campagne/..)
const EIGEN_BRON = /^\/(media|campagne)\/[A-Za-z0-9._\-\/]+$/;

function salonPromoFotos(db, max) {
  const grens = Math.max(1, Math.min(120, Number(max) || 60));
  const posts = (db && db.data && Array.isArray(db.data.posts)) ? db.data.posts : [];
  const uit = []; const gezien = new Set();
  const voegToe = (src, naam) => {
    const u = String(src || '');
    if (!EIGEN_BRON.test(u) || gezien.has(u) || uit.length >= grens) return;
    gezien.add(u);
    uit.push({ src: u, naam: String(naam || 'De Salon').slice(0, 60) });
  };
  /* 1) echt uitgelicht of partner-Salonbeeld, met naamsvermelding
        ("Uit De Salon · naam").

     EN VAN EEN LID ALLEEN MET ZIJN TOESTEMMING. Dit is de enige plek in het huis
     waar het bericht van een lid BUITEN De Salon terechtkomt: als beeld op de
     site en in de campagne, met zijn naam eronder. Dat mag niet stilzwijgend --
     wie iets voor zijn vrienden plaatst, geeft daarmee geen campagnebeeld weg.
     `promoMag` staat op de post en wordt gezet bij het plaatsen (kern/salon:
     plaats), standaard uit. Een partner is een ander geval: die publiceert
     commercieel, dat IS zijn Salon-pagina, en voor hem verandert er niets. */
  for (const p of posts) {
    if (!p || !p.photo) continue;
    const magVanLid = p.partner ? true : p.promoMag === true;
    if ((p.featured || p.partner) && magVanLid) voegToe(p.photo, p.author);
    if (uit.length >= grens) break;
  }
  // 2) het eigen RTG-campagnebeeld als vaste huisbron
  for (const c of CAMPAGNE) { voegToe(c, 'RTG-campagne'); if (uit.length >= grens) break; }
  return uit;
}

module.exports = { salonPromoFotos, CAMPAGNE };
