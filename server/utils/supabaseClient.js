const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] Missing keys. initializing Mock Client.');
    // Helper to create a chainable mock object
    const createChainableMock = (data = []) => {
        const mock = {
            data: data,
            error: null,
            select: () => mock,
            order: () => mock,
            limit: () => mock,
            eq: () => mock,
            single: () => mock, // Often terminal, but keeps chain safe-ish if awaited. 
            // In reality, single() returns a modifier, let's keep it simple.
            // Better strategy: Have them return mock, and let the final await/then resolve the data.
            insert: () => mock,
            update: () => mock,
            delete: () => mock,
        };
        // Allow await on the chain
        mock.then = (resolve) => resolve({ data, error: null });
        return mock;
    };

    supabase = {
        auth: {
            signUp: async () => ({ data: { user: { id: 'mock-user' } }, error: null }),
            signInWithPassword: async () => ({ data: { session: { access_token: 'mock-token' }, user: { id: 'mock-user' } }, error: null }),
            getUser: async () => ({ data: { user: { id: 'mock-user' } }, error: null }),
            getSession: async () => ({ data: { session: { access_token: 'mock-token' } }, error: null }),
        },
        from: () => createChainableMock([])
    };
} else {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

module.exports = supabase;
