import { saveProfileAction } from "../lib/dashboard-actions";
import type { ProfileRow } from "../lib/dashboard-data";
import { formatDate } from "../lib/format";

type ProfileViewProps = {
  profile: ProfileRow | null;
};

export default function ProfileView({ profile }: ProfileViewProps) {
  return (
    <section className="profile-section" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-heading">Master Resume</h2>
        </div>
        <span className="muted">
          {profile?.resume_text ? `Updated ${formatDate(profile.updated_at)}` : "No resume saved"}
        </span>
      </div>
      <form action={saveProfileAction} className="profile-form">
        <label className="field wide-field">
          <span>Resume text</span>
          <textarea
            name="resumeText"
            defaultValue={profile?.resume_text ?? ""}
            rows={24}
          />
        </label>
        <button className="primary-button" type="submit">
          Save resume
        </button>
      </form>
    </section>
  );
}
