import { createRoot } from "react-dom/client";
import { ProfileForm } from "../../app/(app)/settings/profile-form";
import { SettingsAppearance } from "../../components/ui/settings-appearance";

createRoot(document.getElementById("root")).render(
  <>
    <div className="daybreak-scene" aria-hidden />
    <div className="daybreak-shell">
      <header className="daybreak-shell-top">Settings</header>
      <main className="daybreak-workspace flex flex-col gap-8">
        <h1>Your account</h1>
        <ProfileForm birthDate="1991-02-15" today="2026-10-17" />
        <SettingsAppearance />
      </main>
    </div>
  </>,
);
