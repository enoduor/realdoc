// config/url.js
// ECS injects APP_URL from SSM: e.g. https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/
const BASE = process.env.APP_URL || 'https://reelpostly.com/';

// Build an absolute URL under BASE, tolerating extra/missing slashes.
function abs(path = '') {
  const b = String(BASE).replace(/\/+$/, '');     // drop trailing slashes
  const p = String(path).replace(/^\/+/, '');     // drop leading slashes
  return `${b}/${p}`;
}

module.exports = { BASE, abs };