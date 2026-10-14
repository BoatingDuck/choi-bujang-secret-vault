// Both endpoints are still unimplemented: keep the original 501 responses.
// /api/threat-intel rewrites here on Vercel to stay within the free function limit.
// The 'stub' query parameter is untrusted: never use it for authorization.
// Before implementing either feature, add separate server-side access controls.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const isThreatIntelPlaceholder = request?.query?.stub === 'threat-intel';
  return response.status(501).json({
    error: isThreatIntelPlaceholder
      ? 'THREAT_INTEL_NOT_IMPLEMENTED'
      : 'AI_PROXY_NOT_IMPLEMENTED'
  });
}
