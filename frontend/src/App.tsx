import { Navigate, BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { ShellLayout } from "@/layout/ShellLayout";
import { BoardPage } from "@/pages/BoardPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { TeamsAdminPage } from "@/pages/TeamsAdminPage";
import { Button } from "@/components/ui/button";

function Splash({ message = "Bootstrapping secure context…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-sm text-zinc-500">
      <div className="size-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      {message}
    </div>
  );
}

function ApiGate() {
  const {
    authenticated,
    initialized,
    me,
    loadingMe,
    refreshMe,
    signOut,
    apiProfileError,
  } = useAuth();
  if (!initialized) return <Splash />;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (loadingMe)
    return <Splash message="Syncing profile with the API you configured in VITE_API_BASE_URL…" />;
  if (!me) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
        <p className="max-w-md text-sm text-zinc-400">
          Cognito signed you in, but <code className="text-emerald-300">/api/me</code> did not return your profile from
          the Node API — usually backend not running, wrong URL, or pool/client mismatch on the server.
        </p>
        {apiProfileError ? (
          <pre className="max-w-xl whitespace-pre-wrap break-words rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-left text-xs text-amber-200/95">
            {apiProfileError}
          </pre>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => void refreshMe()}>Retry handshake</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }
  return <ShellLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-center" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ApiGate />}>
            <Route path="/board" element={<BoardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/admin/teams" element={<TeamsAdminPage />} />
            <Route path="/" element={<Navigate to="/board" replace />} />
            <Route path="*" element={<Navigate to="/board" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
