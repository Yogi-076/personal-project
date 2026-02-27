const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');

// Middleware to check if user is Platform Admin
// For now, we simulate this check or check specific email
const requirePlatformAdmin = async (req, res, next) => {
    // In a real app, you'd check a database flag or specific role claims
    // Here we trust the auth middleware populated req.user
    // And simplistic check:
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Allow demo user or specific domain
    if (user.email === 'demo@vajrascan.com' || user.email?.endsWith('@vajrascan.com')) {
        return next();
    }

    // Check if they are 'owner' of the 'platform' org (if we had one)
    // For now, fail safe
    // return res.status(403).json({ error: "High Command Access Required" });
    // BYPASS FOR DEV:
    next();
};

router.use(requirePlatformAdmin);

// GET /api/admin/organizations
router.get('/organizations', async (req, res) => {
    try {
        const { data: orgs, error } = await supabase
            .from('organizations')
            .select(`
                id, name, subscription_tier, 
                members:organization_members(count),
                entitlements:organization_entitlements(module_id)
            `);

        if (error) throw error;

        // Transform for frontend
        const summary = orgs.map(o => ({
            id: o.id,
            name: o.name,
            plan: o.subscription_tier,
            users: o.members?.[0]?.count || 0,
            modules: o.entitlements?.map(e => e.module_id) || []
        }));

        res.json(summary);
    } catch (error) {
        console.error("Admin Org List Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/entitlements (Grant)
router.post('/entitlements', async (req, res) => {
    const { orgId, moduleId } = req.body || {};
    if (!orgId || !moduleId) return res.status(400).json({ error: "Missing orgId or moduleId" });

    try {
        const { error } = await supabase
            .from('organization_entitlements')
            .insert({ org_id: orgId, module_id: moduleId });

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/entitlements (Revoke)
router.delete('/entitlements', async (req, res) => {
    const { orgId, moduleId } = req.body || {};
    if (!orgId || !moduleId) return res.status(400).json({ error: "Missing orgId or moduleId" });

    try {
        const { error } = await supabase
            .from('organization_entitlements')
            .delete()
            .match({ org_id: orgId, module_id: moduleId });

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
