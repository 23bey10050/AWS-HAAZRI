import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth/AuthContext";
import { getWorkerProfile } from "./api/client";
import Login from "./screens/Login";
import ProfileSetup from "./screens/ProfileSetup";
import Home from "./screens/Home";
import Calendar from "./screens/Calendar";
import Profile from "./screens/Profile";
import BottomNav from "./components/BottomNav";
import { startBackgroundSync } from "./hooks/useOfflineQueue";
import { t } from "./i18n/strings";

const TABS = [
  { key: "home", labelKey: "nav_home", component: Home },
  { key: "calendar", labelKey: "nav_calendar", component: Calendar },
  { key: "profile", labelKey: "nav_profile", component: Profile },
];

export default function App() {
  const { tokens, restoring } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  // null = still checking, true/false once we know whether this phone number already
  // has a name on file. A brand-new number must complete this before anything else.
  const [profileComplete, setProfileComplete] = useState(null);

  const checkProfile = useCallback(() => {
    setProfileComplete(null);
    getWorkerProfile()
      .then((profile) => setProfileComplete(!profile.profile_incomplete && !!profile.display_name))
      .catch(() => setProfileComplete(false));
  }, []);

  useEffect(() => {
    if (!tokens) return;
    checkProfile();
  }, [tokens, checkProfile]);

  useEffect(() => {
    if (!tokens) return;
    return startBackgroundSync(); // mounted once per authenticated session (spec 12.5)
  }, [tokens]);

  // While a persisted session is being silently restored (page reload, app reopen),
  // show a splash instead of flashing the Login screen and then yanking it away.
  if (restoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-textPrimary text-xl">{t("loading")}</p>
      </div>
    );
  }

  if (!tokens) return <Login />;

  if (profileComplete === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-textPrimary text-xl">{t("loading")}</p>
      </div>
    );
  }

  if (!profileComplete) {
    return <ProfileSetup onDone={checkProfile} />;
  }

  const active = TABS.find((s) => s.key === activeTab) ?? TABS[0];
  const Active = active.component;

  return (
    <>
      <Active />
      <BottomNav
        tabs={TABS.map((s) => ({ key: s.key, label: t(s.labelKey) }))}
        active={active.key}
        onChange={setActiveTab}
      />
    </>
  );
}
