/* Magnaat: HANDELEN NAMENS EEN ANDER -- wat een rol je laat doen.

   Afgesplitst van ./dienst-acties.js op de naad die het onderwerp aangeeft:
   daar hoe een dienstverband ONTSTAAT (vacature, sollicitatie, aannemen,
   opzeggen), hier wat een rol vervolgens MAG. Dat eerste is af; dit groeit met
   elke fase mee -- fase D zette er het bestuur bij.

   EEN ROL ZET ZELF GEEN ENKEL VELD. Allebei de acties hieronder controleren de
   rol en roepen dan de GEWONE actie aan, met de EIGENAAR als handelende speler.
   Zou een van de twee het zelf doen, dan bestaat er een tweede weg naar dezelfde
   verandering -- en dan is de vraag "wie mag dit" op twee plekken beantwoord.
   Dat is de wet van ./beheer.js, hier toegepast op twee soorten mens.

   TWEE WEGEN, EN ZE ZIJN DISJUNCT. Een ZAAKROL gaat over VELDEN op EEN zaak
   (`werk-beleid`); een BESTUURSROL over ACTIES voor een heel concern
   (`bestuur-zet`). Ze weigeren elkaar allebei luid, want stil doorlaten zou
   betekenen dat "wat mag deze rol" twee antwoorden heeft. */
'use strict';
const D = require('./dienst');
const BS = require('./bestuur');

module.exports = ({ ACTIES }) => ({
  /* WAT EEN WERKNEMER MAG VERANDEREN, en dit is de enige plek waar een rol iets
     doet. Hij zet zelf geen enkel veld: hij controleert of zijn rol dit mag en
     roept dan de gewone `beleid`-actie aan namens de EIGENAAR. */
  'werk-beleid'(potje, h, zet) {
    const st = potje.staat;
    const d = D.dienstVan(st, h);
    if (!d) return { status: 403, error: 'Je bent nergens in dienst.' };
  /* EEN BESTUURDER KOMT HIER NIET LANGS. Hij gaat over acties voor een heel
     concern en niet over vier velden op een zaak; zijn weg is `bestuur-zet`.
     Luid weigeren en niet stil doorlaten -- anders zijn er twee antwoorden
     op "wat mag deze rol". */
    if (BS.isBestuur(d.rol))
    return { status: 400, error: 'Als bestuurder stuur je het concern aan, niet een enkele zaak.' };
    const velden = ['onderhoud', 'personeel', 'prijs', 'marketing'].filter(x => zet[x] !== undefined);
    if (!velden.length) return { status: 400, error: 'Er valt niets te veranderen.' };
    const nietMag = velden.filter(x => !D.magRol(d.rol, x));
    if (nietMag.length)
    return { status: 403, error: 'Als ' + D.ROLLEN[d.rol].naam.toLowerCase()
      + ' ga je niet over: ' + nietMag.join(', ') + '.' };
    const door = Object.assign({}, zet, { actie: 'beleid', id: d.vestiging });
    return ACTIES.beleid(potje, d.werkgever, door);
  },

  /* WAT EEN BESTUURDER MAG DOEN (fase D, ./bestuur.js). Zelfde vorm en zelfde
     wet als `werk-beleid` hierboven, alleen breder: een directeur gaat niet
     over EEN veld op EEN zaak maar over een ACTIE voor het hele concern. Hij
     zet zelf niets -- hij controleert zijn rol en roept dan de gewone actie
     aan namens de EIGENAAR. Een tweede weg naar dezelfde verandering zou
     betekenen dat "wie mag dit" op twee plekken beantwoord wordt.

     DE WAND ZIT IN ./bestuur.js EN NIET HIER, want een grens die in de
     uitvoering staat is een grens die je vergeet zodra er een tweede
     uitvoering komt. */
  'bestuur-zet'(potje, h, zet) {
    const st = potje.staat;
    const actie = String(zet.actie2 || '');
    if (!ACTIES[actie]) return { status: 400, error: 'Die actie bestaat niet.' };
    const d = BS.magBesturen(st, h, actie);
    if (!d) {
    const eigen = D.dienstVan(st, h);
    if (!eigen || eigen.vestiging || !BS.isBestuur(eigen.rol))
      return { status: 403, error: 'Je bestuurt geen concern.' };
    return { status: 403, error: 'Als ' + BS.BESTUURSROLLEN[eigen.rol].naam.toLowerCase()
      + ' ga je niet over ' + actie + '. Wat het bezit raakt blijft bij de eigenaar.' };
    }
    return ACTIES[actie](potje, d.werkgever, Object.assign({}, zet, { actie }));
  }
});
