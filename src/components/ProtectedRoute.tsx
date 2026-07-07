import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d0f1a]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 grid place-items-center shadow-[0_0_40px_rgba(99,102,241,0.45)]">
              <span className="text-white font-bold text-2xl">E</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 animate-ping opacity-20" />
          </div>
          <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
          <p className="text-white/40 text-xs tracking-widest uppercase">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (isConfigured && !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
