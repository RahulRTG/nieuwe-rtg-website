/* DE GESLOTEN LIJST OPENBARE PLEKKEN voor /media (zie ./toegang.js).

   Elke klasse zegt WAAR openbaar beeld staat en waarom het openbaar is. Een
   nieuwe openbare plek komt hier bij -- met een reden -- of hij is niet
   openbaar. Wat hier niet staat, is privé: fail-closed.

   Let op wat een plek hier kost: alles wat in zo'n veld staat, wordt openbaar.
   Een route die zo'n veld vult, neemt dus nooit een /media-naam over die een
   aanroeper aandraagt -- alleen de uitkomst van een eigen upload, of een naam
   die er al stond (zie showroom.js en menukaart.js). Anders maakt wie een naam
   kent andermans privébeeld openbaar. */
'use strict';

/* Een post van de Salon telt alleen als hij er nog staat. */
const levend = p => p && !p.weg && !p.verborgen && !p.archief;
function refsVanPost(p, voeg) {
  voeg(p.photo); voeg(p.visual);
  for (const m of (Array.isArray(p.media) ? p.media : [])) if (m) voeg(m.src);
  if (p.folder && Array.isArray(p.folder.fotos)) for (const f of p.folder.fotos) voeg(f);
}

const KLASSEN = Object.freeze({
  'zaak-etalage': {
    waarom: 'Beeld dat een zaak zelf op haar openbare pagina zet: paginafoto\'s, Salon-omslag, kaart, panden, showroom.',
    vind(data, voeg) {
      for (const s of data.suppliers || []) {
        if (!s) continue;
        for (const f of s.photos || []) voeg(f);
        if (s.salon) voeg(s.salon.foto);
        for (const m of s.menu || []) if (m) voeg(m.foto);
        for (const pand of s.panden || []) for (const f of (pand && pand.fotos) || []) voeg(f);
        for (const a of ((s.verkoop || {}).showroom) || []) for (const f of (a && a.fotos) || []) voeg(f);
      }
    }
  },
  'salon-zaak': {
    waarom: 'Een Salon-post van een zaak voor iedereen: commerciele publicatie, haar eigen Salon-pagina.',
    vind(data, voeg) {
      for (const p of data.posts || []) {
        if (!levend(p) || p.partner !== true) continue;
        if (!['iedereen', 'salon', undefined, null].includes(p.publiek)) continue;
        refsVanPost(p, voeg);
      }
    }
  },
  'salon-uitgelicht': {
    waarom: 'Een post die RTG heeft uitgelicht EN waarvan het lid toestemming gaf voor gebruik buiten De Salon (promoMag) -- de bron van "Uit De Salon" op sites en in de campagne.',
    vind(data, voeg) {
      for (const p of data.posts || []) {
        if (!levend(p) || p.partner === true) continue;
        if (p.featured === true && p.promoMag === true) refsVanPost(p, voeg);
      }
    }
  },
  'website': {
    waarom: 'De beeldbank van een website (Webmaker of Atelier): beeld dat expres voor een openbare site is geupload.',
    vind(data, voeg) {
      const leden = (data.ledenSites || {}).fotos;
      if (leden && typeof leden === 'object') for (const lijst of Object.values(leden)) for (const f of (Array.isArray(lijst) ? lijst : [])) voeg(f);
      for (const f of ((data.atelierSites || {}).fotos) || []) voeg(f);
    }
  }
});

module.exports = { KLASSEN };
