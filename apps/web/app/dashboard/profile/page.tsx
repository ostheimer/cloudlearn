"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import { User, Globe, LogOut } from "@/components/icons";

export default function ProfilePage() {
  const { email, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <>
      <div className="lib-head">
        <div>
          <h1>Profil</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Dein Konto und Einstellungen.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="profile-avatar" aria-hidden>
            <User size={26} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>Angemeldet als</div>
            <div className="muted" style={{ overflowWrap: "anywhere" }}>
              {email ?? "—"}
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <a href="/" className="profile-row">
            <Globe size={18} /> Zur Website
          </a>
          <button type="button" className="profile-row profile-row--danger" onClick={handleSignOut}>
            <LogOut size={18} /> Abmelden
          </button>
        </div>
      </div>
    </>
  );
}
