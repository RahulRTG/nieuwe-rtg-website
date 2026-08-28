'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const maak=require('../server/kern/mail-publiek');

test('bedrijfs- en Foundation-adressen vertalen exact heen en terug', () => {
  const m=maak({ basis:'rahultravelgroup.com', foundationDomein:'rahultravelfoundation.com' });
  assert.equal(m.actief, true);
  assert.equal(m.publiek('jan.de.vries@voorbeeld-bedrijf.rtg'),
    'jan.de.vries@voorbeeld-bedrijf.rahultravelgroup.com');
  assert.equal(m.intern('jan.de.vries@voorbeeld-bedrijf.rahultravelgroup.com'),
    'jan.de.vries@voorbeeld-bedrijf.rtg');
  assert.equal(m.hoortBij('jan.de.vries@voorbeeld-bedrijf.rtg',
    'jan.de.vries@voorbeeld-bedrijf.rahultravelgroup.com'), true);
  assert.equal(m.publiek('gouden-vos-ab12@rahultravelfoundation.rtg'),
    'gouden-vos-ab12@rahultravelfoundation.com');
  assert.equal(m.intern('gouden-vos-ab12@rahultravelfoundation.com'),
    'gouden-vos-ab12@rahultravelfoundation.rtg');
});

test('ledenadres gebruikt echte voor- en achternaam plus bewezen pasniveau', () => {
  const opgeslagen=new Map();
  const accounts={
    reservePublicMail:(id,lokaal,domein) => { const a=lokaal+'@'+domein; opgeslagen.set(a,{ id, tier:'business', codename:'Gouden Valk AB12', actief:1 }); return a; },
    findByPublicMail:a => opgeslagen.get(a) || null
  };
  const m=maak({ basis:'rahultravelgroup.com', accounts });
  const publiek=m.geefLid({ user:{ id:7, tier:'business' }, naam:'Rahul Imran Ismail', tier:'business' });
  assert.equal(publiek, 'rahul.ismail@business.rahultravelgroup.com');
  assert.deepEqual(m.vind(publiek), { soort:'lid', publiek, userId:7,
    intern:'goudenvalkab12@business.rtg' });
  assert.equal(m.publiek('goudenvalkab12@business.rtg'), null,
    'een codenaam wordt nooit stil als publiek ledenadres gepubliceerd');
});

test('publieke vertaling staat fail-closed bij ontbrekend of intern basisdomein', () => {
  assert.equal(maak({ basis:'' }).actief, false);
  assert.equal(maak({ basis:'alleen.rtg' }).actief, false);
  assert.equal(maak({ basis:'rtg.example' }).publiek('jan@bedrijf.rtg'), null);
  const m=maak({ basis:'rahultravelgroup.com' });
  assert.equal(m.intern('jan@bedrijf.rtg.aanvaller.example'), null);
  assert.equal(m.publiek('jan@rtgpass.rtg'), null);
  assert.equal(maak({ basis:'', foundationDomein:'' }).actief, false);
});
