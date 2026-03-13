/**
 * Service Registry — Singleton instances for all scanner services.
 * Import from here instead of instantiating services in route files
 * to ensure shared in-memory state (progress tracking, scan maps, etc.)
 */
const WapitiService = require('./wapitiService');
const SastService = require('./sastService');
const ZapService = require('./zapService');
const KatanaService = require('./katanaService');
const NucleiService = require('./nucleiService');
const RetireService = require('./retireService');
const SovereignShodan = require('./sovereignShodan');
const GobusterService = require('./gobusterService');
const ForreconService = require('./forreconService');
const ArsenalService = require('./arsenalService'); 
const gitleaksService = require('./gitleaksService');
const aiHunter = require('./aiHunterService');

module.exports = {
    wapitiService: new WapitiService(),
    sastService: new SastService(),
    zapService: new ZapService(),
    katanaService: new KatanaService(),
    nucleiService: new NucleiService(),
    retireService: new RetireService(),
    sovereignShodan: new SovereignShodan(),
    gobusterService: new GobusterService(),
    forreconService: new ForreconService(),
    arsenalService: new ArsenalService(),
    gitleaksService: gitleaksService,
    aiHunter,        // Already a singleton module (not a class)
};
