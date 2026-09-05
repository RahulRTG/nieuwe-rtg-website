/* Procesbrede eigenaar voor async commits die dezelfde levende collecties
   kunnen raken. De keten blijft bruikbaar wanneer één bewerking faalt. */
'use strict';

module.exports = () => {
  let keten = Promise.resolve();
  return werk => {
    const uit = keten.then(werk, werk);
    keten = uit.then(() => {}, () => {});
    return uit;
  };
};
