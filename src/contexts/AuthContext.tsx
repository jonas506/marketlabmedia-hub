import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AppRole = "admin" | "head_of_content" | "cutter" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  roleLoaded: boolean;
  profile: { name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("name, email").eq("user_id", userId).maybeSingle(),
    ]);
    setRole((roleData?.role as AppRole) ?? null);
    setProfile(profileData ?? null);
    setRoleLoaded(true);
  };

  useEffect(() => {
    let currentUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUserId = session?.user?.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        // Only refetch role/profile when the user identity actually changes.
        // Token refreshes (e.g. after switching browser tabs) must not trigger
        // a re-render storm that remounts routes and resets scroll/tab state.
        if (nextUserId && nextUserId !== currentUserId) {
          currentUserId = nextUserId;
          setRoleLoaded(false);
          setTimeout(() => fetchUserData(nextUserId), 0);
        } else if (!nextUserId) {
          currentUserId = null;
          setRole(null);
          setProfile(null);
          setRoleLoaded(true);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        currentUserId = session.user.id;
        fetchUserData(session.user.id);
      } else {
        setRoleLoaded(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roleLoaded, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
