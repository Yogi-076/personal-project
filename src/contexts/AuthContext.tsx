import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
};

export type OrgMemberRole = 'owner' | 'admin' | 'member';


type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  demoLogin: () => Promise<void>;
  organization: Organization | null;
  role: OrgMemberRole | null;
};

const DEMO_SESSION_KEY = "vajrascan_demo_session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrgMemberRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to prevent infinite loading if Supabase is unreachable
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("Auth initialization timed out, falling back to unauthenticated state.");
          return false;
        }
        return prev;
      });
    }, 3000);

    // 1. Get initial session
    // FIRST: Check if we have a persisted demo session
    const storedDemo = localStorage.getItem(DEMO_SESSION_KEY);
    if (storedDemo === "true") {
      console.log("Restoring demo session from storage...");
      // Re-hydrate demo user
      const mockUser: User = {
        id: "demo-user-id",
        aud: "authenticated",
        role: "authenticated",
        email: "demo@vajrascan.com",
        email_confirmed_at: new Date().toISOString(),
        phone: "",
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { username: "DemoAdmin" },
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_anonymous: false
      };

      const mockSession: Session = {
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "mock-refresh-token",
        user: mockUser,
      };

      setSession(mockSession);
      setUser(mockUser);
      setOrganization({
        id: "demo-org-id",
        name: "Demo Organization",
        slug: "demo-org",
        subscription_tier: "enterprise"
      });
      setRole("owner");
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      clearTimeout(safetyTimeout);
      if (error) {
        console.error("Supabase Auth Error:", error);
      }
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch Organization
        try {
          // @ts-ignore
          const { data, error: orgError } = await supabase
            .from('organization_members')
            .select('role, organization:organizations(*)')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (orgError) {
            console.warn("Error fetching org (migration might be pending):", orgError);
          } else if (data) {
            // @ts-ignore - Supabase types might imply array, but single() returns object
            const org = data.organization as Organization;
            setOrganization(org);
            setRole(data.role as OrgMemberRole);
          }
        } catch (e) {
          console.error("Org fetch failed", e);
        }
      }

      setLoading(false);
    }).catch(err => {
      clearTimeout(safetyTimeout);
      console.error("Supabase connection failed:", err);
      setLoading(false);
    });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // FIX: Prevent Supabase from clearing our manual demo session
      setSession(prev => {
        if (prev?.user?.id === "demo-user-id" && !newSession) {
          console.log("Preserving demo session despite auth event.");
          return prev;
        }
        return newSession;
      });
      setUser(newUser => {
        if (newUser?.id === "demo-user-id" && !newSession?.user) {
          return newUser;
        }
        return newSession?.user ?? null;
      });
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username, // Stored in user_metadata
          full_name: username, // Map username to full_name optionally
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
    setOrganization(null);
    setRole(null);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const demoLogin = async () => {
    localStorage.setItem(DEMO_SESSION_KEY, "true");
    const mockUser: User = {
      id: "demo-user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "demo@vajrascan.com",
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { username: "DemoAdmin" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false
    };

    const mockSession: Session = {
      access_token: "mock-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: mockUser,
    };

    setSession(mockSession);
    setUser(mockUser);
    setOrganization({
      id: "demo-org-id",
      name: "Demo Organization",
      slug: "demo-org",
      subscription_tier: "enterprise"
    });
    setRole("owner");
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, demoLogin, organization, role }}>
      {children}
    </AuthContext.Provider>
  );
};
