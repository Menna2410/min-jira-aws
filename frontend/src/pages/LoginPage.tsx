import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoginPage() {
  const {
    authenticated,
    initialized,
    loadingMe,
    me,
    signIn,
    signOut,
    signUpBasic,
    confirm,
    resendConfirmationCode,
  } = useAuth();
  const navigate = useNavigate();

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole] = useState("EMPLOYEE");
  const [signupTeamId, setSignupTeamId] = useState("");
  const [code, setCode] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const envReady = useMemo(() => {
    const pool = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "";
    const client = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";
    return Boolean(pool.trim()) && Boolean(client.trim());
  }, []);

  async function submitSignIn() {
    setBusy(true);
    try {
      await signIn(signInEmail.trim(), signInPassword);
      toast.success("Welcome back!");
      navigate("/board", { replace: true });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const lower = detail.toLowerCase();
      const unconfirmed =
        lower.includes("not confirmed") ||
        lower.includes("user_not_confirmed") ||
        lower.includes("user is not confirmed");
      if (unconfirmed) {
        toast.error(
          "This email is not verified yet — open Verify, paste the code from Cognito (check spam). Or tap Resend code.",
        );
      } else {
        toast.error(detail || "Sign-in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitSignUp() {
    setBusy(true);
    try {
      const attrs: Record<string, string> = {};
      attrs.email = signupEmail.trim();
      if (signupRole.trim()) attrs["custom:role"] = signupRole.trim().toUpperCase();
      if (signupTeamId.trim()) attrs["custom:teamId"] = signupTeamId.trim();

      const { needsConfirmation } = await signUpBasic(signupEmail.trim(), signupPassword, attrs);
      toast.success(
        needsConfirmation ? "Confirmation code dispatched — redeem below." : "Account ready → sign-in tab.",
      );
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      toast.error(detail || "Sign-up failed — check Cognito pool attributes, password policy, and whether the user already exists.");
    } finally {
      setBusy(false);
    }
  }

  async function submitConfirm() {
    const email =
      verifyEmail.trim() || signupEmail.trim() || signInEmail.trim();
    if (!email) {
      toast.error("Enter the email you signed up with (Verify tab).");
      return;
    }
    setBusy(true);
    try {
      await confirm(email, code.trim());
      toast.success("Verified — switch to Sign in and log in.");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      toast.error(detail || "Invalid code or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitResend() {
    const email =
      verifyEmail.trim() || signupEmail.trim() || signInEmail.trim();
    if (!email) {
      toast.error("Enter your email below first.");
      return;
    }
    setBusy(true);
    try {
      await resendConfirmationCode(email);
      toast.success("Cognito resent the code — check inbox and spam.");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      toast.error(detail || "Could not resend.");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated && initialized && me && !loadingMe) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center text-sm">
        <p>You are already routed as {me.email} ({me.role}).</p>
        <div className="mt-6 flex gap-4 justify-center">
          <Button onClick={() => navigate("/board", { replace: true })}>Open board</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Leave session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-4 py-16">
      <Card className="w-full max-w-lg border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
        <CardHeader>
          <CardTitle>Mini‑Jira console</CardTitle>
          <CardDescription>
            Wire this screen to Cognito Hosted UI whenever you finalize CloudFront origins — Amplify primitives already
            expect your pool identifiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {!envReady ? (
            <p className="rounded-md border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              Populate <span className="font-mono">VITE_COGNITO_*</span> inside <span className="font-mono">.env.local</span>{" "}
              before authentication runs.
            </p>
          ) : null}

          <Tabs defaultValue="sign-in">
            <TabsList className="w-full justify-center">
              <TabsTrigger value="sign-in">Sign in</TabsTrigger>
              <TabsTrigger value="sign-up">Create account</TabsTrigger>
              <TabsTrigger value="confirm">Verify</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="sin-em">Username or email</Label>
                <Input
                  id="sin-em"
                  autoComplete="username"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sin-pw">Password</Label>
                <Input
                  id="sin-pw"
                  type="password"
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                />
              </div>
              <Button disabled={busy} className="w-full" type="button" onClick={() => void submitSignIn()}>
                Enter workspace
              </Button>
            </TabsContent>

            <TabsContent value="sign-up" className="space-y-4 pt-4 text-sm">
              <p className="text-xs text-zinc-500">
                Pools must declare mutable <span className="font-mono">custom:role</span> and{" "}
                <span className="font-mono">custom:teamId</span> attributes or strip them from the payload.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="su-em">Email</Label>
                <Input id="su-em" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pw">Password</Label>
                <Input
                  id="su-pw"
                  type="password"
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Optional custom:teamId</Label>
                  <Input placeholder="Paste UUID synced with Dynamo Teams" value={signupTeamId} onChange={(e) => setSignupTeamId(e.target.value)} />
                </div>
              </div>
              <Button disabled={busy} variant="secondary" type="button" className="w-full" onClick={() => void submitSignUp()}>
                Register participant
              </Button>
            </TabsContent>

            <TabsContent value="confirm" className="space-y-4 pt-4">
              <p className="text-xs leading-relaxed text-zinc-500">
                Many pools send a verification code after{" "}
                <span className="font-medium text-zinc-400">Create account</span>. Paste it here — signing in stays blocked
                until Cognito sees <span className="font-medium text-zinc-400">CONFIRMED</span>.
              </p>
              <p className="text-xs text-zinc-500">
                Still empty inbox? SES sandbox emails only verified addresses unless you exited sandbox in us-east-1.
                Spam folder too. Worst case: Cognito console → open the user →{" "}
                <span className="text-zinc-400">Confirm / mark verified</span> for demos.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="verify-email">Email (exactly as on sign-up)</Label>
                <Input
                  id="verify-email"
                  type="email"
                  placeholder="same as Create account tab"
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Verification code from email</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
              </div>
              <Button disabled={busy} variant="outline" type="button" className="w-full" onClick={() => void submitConfirm()}>
                Confirm account
              </Button>
              <Button disabled={busy} variant="ghost" type="button" className="w-full" onClick={() => void submitResend()}>
                Resend code
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
