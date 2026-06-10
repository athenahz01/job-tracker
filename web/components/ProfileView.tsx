import DeleteAnswerButton from "./DeleteAnswerButton";
import {
  createScreenerAnswerAction,
  deleteScreenerAnswerAction,
  saveApplicationProfileAction,
  saveProfileAction,
  updateScreenerAnswerAction
} from "../lib/dashboard-actions";
import type { ProfileRow, ScreenerAnswerRow } from "../lib/dashboard-data";
import { formatDate } from "../lib/format";

type ProfileViewProps = {
  profile: ProfileRow | null;
  answers: ScreenerAnswerRow[];
};

export default function ProfileView({ profile, answers }: ProfileViewProps) {
  return (
    <div className="profile-stack">
      <section className="profile-section" aria-labelledby="profile-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Profile</p>
            <h2 id="profile-heading">Master Resume</h2>
          </div>
          <span className="muted">
            {profile?.resume_text
              ? `Updated ${formatDate(profile.updated_at)}`
              : "No resume saved"}
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

      <section className="profile-section" aria-labelledby="application-profile-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Autofill</p>
            <h2 id="application-profile-heading">Application Details</h2>
          </div>
          <p className="muted">Used by the extension to fill application forms.</p>
        </div>
        <form action={saveApplicationProfileAction} className="profile-form compact-profile-form">
          <label className="field">
            <span>Full name</span>
            <input
              autoComplete="name"
              name="fullName"
              defaultValue={profile?.full_name ?? ""}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              type="email"
              defaultValue={profile?.email ?? ""}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              autoComplete="tel"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              autoComplete="address-level2"
              name="location"
              defaultValue={profile?.location ?? ""}
            />
          </label>
          <label className="field">
            <span>LinkedIn</span>
            <input
              autoComplete="url"
              name="linkedinUrl"
              type="url"
              defaultValue={profile?.linkedin_url ?? ""}
            />
          </label>
          <label className="field">
            <span>GitHub</span>
            <input
              autoComplete="url"
              name="githubUrl"
              type="url"
              defaultValue={profile?.github_url ?? ""}
            />
          </label>
          <label className="field">
            <span>Portfolio</span>
            <input
              autoComplete="url"
              name="portfolioUrl"
              type="url"
              defaultValue={profile?.portfolio_url ?? ""}
            />
          </label>
          <label className="field">
            <span>Website</span>
            <input
              autoComplete="url"
              name="websiteUrl"
              type="url"
              defaultValue={profile?.website_url ?? ""}
            />
          </label>
          <label className="field">
            <span>Work authorization</span>
            <input
              name="workAuthorization"
              defaultValue={profile?.work_authorization ?? ""}
              placeholder="Authorized to work in the United States"
            />
          </label>
          <label className="field">
            <span>Years of experience</span>
            <input name="yearsExperience" defaultValue={profile?.years_experience ?? ""} />
          </label>
          <label className="field">
            <span>Current title</span>
            <input name="currentTitle" defaultValue={profile?.current_title ?? ""} />
          </label>
          <label className="checkbox-field profile-checkbox">
            <input
              name="requiresSponsorship"
              type="checkbox"
              defaultChecked={Boolean(profile?.requires_sponsorship)}
            />
            <span>Requires sponsorship</span>
          </label>
          <button className="primary-button" type="submit">
            Save application details
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="answer-bank-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Screener library</p>
            <h2 id="answer-bank-heading">Answer Bank</h2>
          </div>
          <span className="muted">{answers.length} saved</span>
        </div>

        <form action={createScreenerAnswerAction} className="answer-form">
          <label className="field wide-field">
            <span>Question</span>
            <input
              name="question"
              placeholder="Why are you interested in this company?"
              required
            />
          </label>
          <label className="field wide-field">
            <span>Answer</span>
            <textarea
              name="answer"
              placeholder="A reusable, honest answer you are comfortable using."
              rows={5}
              required
            />
          </label>
          <label className="field">
            <span>Tags</span>
            <input name="tags" placeholder="motivation, visa, salary" />
          </label>
          <button className="primary-button" type="submit">
            Add answer
          </button>
        </form>

        <div className="answer-list">
          {answers.length ? (
            answers.map((item) => (
              <details className="answer-item" key={item.id}>
                <summary>
                  <span>{item.question}</span>
                  {item.tags.length ? (
                    <span className="chip-row">
                      {item.tags.map((tag) => (
                        <span className="tag-chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </summary>
                <form action={updateScreenerAnswerAction} className="answer-form">
                  <input name="answerId" type="hidden" value={item.id} />
                  <label className="field wide-field">
                    <span>Question</span>
                    <input name="question" defaultValue={item.question} required />
                  </label>
                  <label className="field wide-field">
                    <span>Answer</span>
                    <textarea name="answer" defaultValue={item.answer} rows={6} required />
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <input name="tags" defaultValue={item.tags.join(", ")} />
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit">
                      Save answer
                    </button>
                  </div>
                </form>
                <form action={deleteScreenerAnswerAction} className="delete-answer-form">
                  <input name="answerId" type="hidden" value={item.id} />
                  <DeleteAnswerButton />
                </form>
              </details>
            ))
          ) : (
            <p className="empty-state">No saved screener answers yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
