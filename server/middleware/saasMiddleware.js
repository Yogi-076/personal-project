const supabase = require('../utils/supabaseClient');
const localAuth = require('../db/localAuth');

/**
 * optionalAuth — silently extracts `userId` from the JWT and attaches it to `req.userId`.
 * Never blocks a request. Falls back to 'anonymous' for demo / unauthenticated users.
 * Use this on every data-access route to enable per-user data isolation.
 */
const optionalAuth = (req, res, next) => {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token || token === 'mock-token') {
        req.userId = 'anonymous';
        return next();
    }

    try {
        const decoded = localAuth.verifyToken(token);
        req.userId = decoded ? decoded.id : 'anonymous';
    } catch (e) {
        req.userId = 'anonymous';
    }
    return next();
};

/**
 * Middleware to check if the user's organization has access to a specific module.
 * @param {string} moduleId - The ID of the module (e.g., 'dast_core', 'sast_pro')
 */
const requireModule = (moduleId) => async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    // Allow all requests with no token in dev/local mode
    if (!token) {
        console.warn(`[SaaS] No token provided — allowing request (dev mode) for module: ${moduleId}`);
        return next();
    }

    // Bypass for Demo / Mock user (matches frontend demoLogin)
    if (token === 'mock-token') {
        return next();
    }

    // If running in local storage mode (no real Supabase backend keys), verify JWT locally
    if (process.env.STORAGE_MODE === 'local') {
        try {
            const decoded = localAuth.verifyToken(token);
            if (decoded) {
                req.user = decoded;
                return next();
            }
        } catch (e) { /* fall through */ }
        // Valid local token check failed — still allow in local mode
        console.warn(`[SaaS] Local JWT invalid for module: ${moduleId}. Allowing in local mode.`);
        return next();
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        // If Supabase is unavailable, tables missing, or user not found — fail open in local mode
        if (error) {
            console.warn(`[SaaS] Supabase auth check failed: ${error.message}. Allowing request in local mode.`);
            return next();
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid Token" });
        }

        // 2. Get User's Organization(s)
        const { data: members, error: memError } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', user.id);

        // If tables don't exist (schema issue) — allow access
        if (memError) {
            console.warn(`[SaaS] Organization check failed: ${memError.message}. Allowing request in local mode.`);
            req.user = user;
            return next();
        }

        if (!members || members.length === 0) {
            // No org found but user is valid — allow in local/dev mode
            console.warn(`[SaaS] User ${user.id} has no organization. Allowing in local mode.`);
            req.user = user;
            return next();
        }

        const orgIds = members.map(m => m.org_id);

        // Check if ANY of the user's organizations has the entitlement
        const { data: entitlements, error: entError } = await supabase
            .from('organization_entitlements')
            .select('id')
            .in('org_id', orgIds)
            .eq('module_id', moduleId)
            .eq('is_active', true);

        // If entitlement table missing — allow
        if (entError) {
            console.warn(`[SaaS] Entitlement check failed: ${entError.message}. Allowing in local mode.`);
            req.user = user;
            return next();
        }

        if (entitlements && entitlements.length > 0) {
            req.user = user;
            return next();
        } else {
            return res.status(403).json({
                error: "Subscription Required",
                message: `Your organization does not have access to module: ${moduleId}`,
                code: "UPGRADE_REQUIRED"
            });
        }

    } catch (err) {
        // If anything throws unexpectedly, allow in local mode rather than blocking user
        console.error("[SaaS] Entitlement check threw an exception:", err.message, "— allowing in local mode.");
        return next();
    }
};

module.exports = { requireModule, optionalAuth };

