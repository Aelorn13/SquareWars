// components/effects/index.js
import { burn } from './handlers/burn.js';
import { knockback } from './handlers/knockback.js';
import { slow } from './handlers/slow.js';
import { ricochet } from './handlers/ricochet.js';


export const EFFECT_HANDLERS = {
  burn,
  knockback,
  slow,
  ricochet,
};