function normalizeVersion(v) {
  if (/^\d{6}$/.test(v)) return v;          // YYYYMM
  if (/^\d{6}\.\d{2}$/.test(v)) return v;   // YYYYMM.RR
  return null;
}

const DEFAULT_VER = '202503'; // proven working in your tenant
const LI_VER = normalizeVersion(process.env.LINKEDIN_VERSION || DEFAULT_VER);

exports.makeHeaders = (token, withVersion = true) => {
  const h = {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
  if (withVersion && LI_VER) h['LinkedIn-Version'] = LI_VER;
  return h;
};
exports.LI_VER = LI_VER;
