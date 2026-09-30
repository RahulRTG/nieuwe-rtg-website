'use strict';
module.exports = ({kern,action}) => ({
  prepare({key,parameters}) { return kern.livingWorld.prepare(key,action,parameters); },
  execute({key,preview}) { return kern.livingWorld.execute(key,action,preview.parameters,preview.id); }
});
