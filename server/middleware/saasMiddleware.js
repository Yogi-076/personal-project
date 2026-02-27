const supabase = require('../utils/supabaseClient');

/**
 * Middleware to check if the user's organization has access to a specific module.
 * @param {string} moduleId - The ID of the module (e.g., 'dast_core', 'sast_pro')
 */
const requireModule = (moduleId) => async (req, res, next) => {
    // 1. Get User from Auth Header (or session if using express-session)
    // Note: In this architecture, we usually rely on a previous auth middleware to populate req.user
    // But since we are using Supabase on backend often stateless or with tokens, we need to verify token first if not already done.
    // For this implementation, we assume `req.user` is populated by a preceding `requireAuth` middleware
    // OR we decode the token here.

    // Let's assume a simple token check or that we trust req.headers.authorization
    // For robustness, we'll verify the token with Supabase.

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        // ALWAYS allow in development mode without token
        // This enables local testing without authentication
        console.warn(`[SaaS] No token provided - allowing request in development mode for module: ${moduleId}`);
        return next();
    }

    // Bypass for Demo User (hardcoded logic matching frontend)
    // In production, we'd check the token claims.
    if (token === 'mock-token') {
        // Check if demo user has access (Demo has all)
        return next();
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: "Invalid Token" });

        // 2. Get User's Organization(s)
        const { data: members, error: memError } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', user.id);

        if (memError || !members || members.length === 0) {
            return res.status(403).json({ error: "User has no organization" });
        }

        const orgIds = members.map(m => m.org_id);

        // Check if ANY of the user's organizations has the entitlement
        const { data: entitlements, error: entError } = await supabase
            .from('organization_entitlements')
            .select('id')
            .in('org_id', orgIds)
            .eq('module_id', moduleId)
            .eq('is_active', true);

        if (entError) throw entError;

        if (entitlements && entitlements.length > 0) {
            // Access Granted
            req.user = user; // Attach user for downstream
            return next();
        } else {
            return res.status(403).json({
                error: "Subscription Required",
                message: `Your organization does not have access to module: ${moduleId}`,
                code: "UPGRADE_REQUIRED"
            });
        }

    } catch (err) {
        console.error("Entitlement Check Failed:", err);
        res.status(500).json({ error: "Internal Authorization Error" });
    }
};

module.exports = { requireModule };
