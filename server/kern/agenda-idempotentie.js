/* De crashnaad tussen een gebrokerde actie en haar evidence. De previewbron
   identificeert één afspraak, zodat retry hetzelfde domeinobject terugvindt. */
'use strict';

function afspraakVoorBron(items, bron) {
  if (!bron) return null;
  return items.find(item => item.bron === bron) || null;
}

module.exports = { afspraakVoorBron };
