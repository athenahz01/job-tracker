import DeleteAnswerButton from "./DeleteAnswerButton";
import {
  createEducationAction,
  createScreenerAnswerAction,
  createWorkExperienceAction,
  deleteEducationAction,
  deleteScreenerAnswerAction,
  deleteWorkExperienceAction,
  saveApplicationProfileAction,
  saveEqualEmploymentAction,
  saveProfileAction,
  saveSkillsAction,
  updateEducationAction,
  updateScreenerAnswerAction,
  updateWorkExperienceAction
} from "../lib/dashboard-actions";
import type {
  EducationRow,
  ProfileRow,
  ScreenerAnswerRow,
  WorkExperienceRow
} from "../lib/dashboard-data";
import { formatDate } from "../lib/format";

type ProfileViewProps = {
  profile: ProfileRow | null;
  education: EducationRow[];
  workExperience: WorkExperienceRow[];
  answers: ScreenerAnswerRow[];
};

export default function ProfileView({
  profile,
  education,
  workExperience,
  answers
}: ProfileViewProps) {
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
        <form action={saveProfileAction} className="profile-form resume-form">
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

      <section className="profile-section" aria-labelledby="personal-profile-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Autofill</p>
            <h2 id="personal-profile-heading">Personal</h2>
          </div>
          <p className="muted">Granular contact fields keep autofill precise.</p>
        </div>
        <form action={saveApplicationProfileAction} className="profile-form compact-profile-form">
          <label className="field">
            <span>First name</span>
            <input
              autoComplete="given-name"
              name="firstName"
              defaultValue={profile?.first_name ?? ""}
            />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              autoComplete="family-name"
              name="lastName"
              defaultValue={profile?.last_name ?? ""}
            />
          </label>
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
            <span>City</span>
            <input
              autoComplete="address-level2"
              name="city"
              defaultValue={profile?.city ?? ""}
            />
          </label>
          <label className="field">
            <span>State or province</span>
            <input
              autoComplete="address-level1"
              name="state"
              defaultValue={profile?.state ?? ""}
            />
          </label>
          <label className="field">
            <span>Country</span>
            <input
              autoComplete="country-name"
              name="country"
              defaultValue={profile?.country ?? ""}
            />
          </label>
          <label className="field">
            <span>Postal code</span>
            <input
              autoComplete="postal-code"
              name="postalCode"
              defaultValue={profile?.postal_code ?? ""}
            />
          </label>
          <label className="field">
            <span>Generic location</span>
            <input name="location" defaultValue={profile?.location ?? ""} />
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
            <span>Current title</span>
            <input name="currentTitle" defaultValue={profile?.current_title ?? ""} />
          </label>
          <label className="field">
            <span>Years of experience</span>
            <input name="yearsExperience" defaultValue={profile?.years_experience ?? ""} />
          </label>
          <label className="field wide-field">
            <span>Work authorization note</span>
            <input
              name="workAuthorization"
              defaultValue={profile?.work_authorization ?? ""}
              placeholder="Authorized to work in the United States"
            />
          </label>
          <button className="primary-button" type="submit">
            Save personal details
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="equal-employment-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Voluntary</p>
            <h2 id="equal-employment-heading">Equal Employment</h2>
          </div>
          <p className="muted">Stored exactly as you choose to answer.</p>
        </div>
        <form action={saveEqualEmploymentAction} className="profile-form compact-profile-form">
          <label className="field">
            <span>Work authorized</span>
            <input name="workAuthorized" defaultValue={profile?.work_authorized ?? ""} />
          </label>
          <label className="field">
            <span>Requires sponsorship</span>
            <select name="requiresSponsorship" defaultValue={sponsorshipValue(profile)}>
              <option value="">Not set</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="field">
            <span>Gender</span>
            <input name="gender" defaultValue={profile?.gender ?? ""} />
          </label>
          <label className="field">
            <span>Race or ethnicity</span>
            <input name="raceEthnicity" defaultValue={profile?.race_ethnicity ?? ""} />
          </label>
          <label className="field">
            <span>Hispanic or Latino</span>
            <input name="hispanicLatino" defaultValue={profile?.hispanic_latino ?? ""} />
          </label>
          <label className="field">
            <span>Veteran status</span>
            <input name="veteranStatus" defaultValue={profile?.veteran_status ?? ""} />
          </label>
          <label className="field">
            <span>Disability status</span>
            <input name="disabilityStatus" defaultValue={profile?.disability_status ?? ""} />
          </label>
          <label className="field">
            <span>LGBTQ status</span>
            <input name="lgbtqStatus" defaultValue={profile?.lgbtq_status ?? ""} />
          </label>
          <button className="primary-button" type="submit">
            Save equal employment
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="education-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2 id="education-heading">Education</h2>
          </div>
          <span className="muted">{education.length} saved</span>
        </div>
        <form action={createEducationAction} className="profile-form compact-profile-form">
          <EducationFields />
          <button className="primary-button" type="submit">
            Add education
          </button>
        </form>
        <div className="answer-list">
          {education.length ? (
            education.map((item) => (
              <details className="answer-item" key={item.id}>
                <summary>
                  <span>{item.school || item.degree || "Education"}</span>
                  <span className="muted">{item.end_date || "No end date"}</span>
                </summary>
                <form action={updateEducationAction} className="profile-form compact-profile-form">
                  <input name="educationId" type="hidden" value={item.id} />
                  <EducationFields item={item} />
                  <button className="primary-button" type="submit">
                    Save education
                  </button>
                </form>
                <form action={deleteEducationAction} className="delete-answer-form">
                  <input name="educationId" type="hidden" value={item.id} />
                  <DeleteAnswerButton confirmMessage="Delete this education entry?" />
                </form>
              </details>
            ))
          ) : (
            <p className="empty-state">No education saved yet.</p>
          )}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="work-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2 id="work-heading">Work Experience</h2>
          </div>
          <span className="muted">{workExperience.length} saved</span>
        </div>
        <form action={createWorkExperienceAction} className="profile-form compact-profile-form">
          <WorkFields />
          <button className="primary-button" type="submit">
            Add work experience
          </button>
        </form>
        <div className="answer-list">
          {workExperience.length ? (
            workExperience.map((item) => (
              <details className="answer-item" key={item.id}>
                <summary>
                  <span>{item.title || item.company || "Work experience"}</span>
                  <span className="muted">{item.company ?? "No company"}</span>
                </summary>
                <form
                  action={updateWorkExperienceAction}
                  className="profile-form compact-profile-form"
                >
                  <input name="workExperienceId" type="hidden" value={item.id} />
                  <WorkFields item={item} />
                  <button className="primary-button" type="submit">
                    Save work experience
                  </button>
                </form>
                <form action={deleteWorkExperienceAction} className="delete-answer-form">
                  <input name="workExperienceId" type="hidden" value={item.id} />
                  <DeleteAnswerButton confirmMessage="Delete this work experience entry?" />
                </form>
              </details>
            ))
          ) : (
            <p className="empty-state">No work experience saved yet.</p>
          )}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="skills-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Keywords</p>
            <h2 id="skills-heading">Skills</h2>
          </div>
          <span className="muted">{profile?.skills?.length ?? 0} saved</span>
        </div>
        <form action={saveSkillsAction} className="profile-form compact-profile-form">
          <label className="field wide-field">
            <span>Skills</span>
            <input
              name="skills"
              defaultValue={(profile?.skills ?? []).join(", ")}
              placeholder="TypeScript, SQL, product analytics"
            />
          </label>
          <button className="primary-button" type="submit">
            Save skills
          </button>
        </form>
        {profile?.skills?.length ? (
          <div className="profile-chip-list">
            {profile.skills.map((skill) => (
              <span className="tag-chip" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        ) : null}
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

function EducationFields({ item }: { item?: EducationRow }) {
  return (
    <>
      <label className="field">
        <span>School</span>
        <input name="school" defaultValue={item?.school ?? ""} />
      </label>
      <label className="field">
        <span>Degree</span>
        <input name="degree" defaultValue={item?.degree ?? ""} />
      </label>
      <label className="field">
        <span>Field of study</span>
        <input name="fieldOfStudy" defaultValue={item?.field_of_study ?? ""} />
      </label>
      <label className="field">
        <span>Start</span>
        <input name="startDate" defaultValue={item?.start_date ?? ""} placeholder="2020" />
      </label>
      <label className="field">
        <span>End</span>
        <input name="endDate" defaultValue={item?.end_date ?? ""} placeholder="2024" />
      </label>
      <label className="field">
        <span>GPA</span>
        <input name="gpa" defaultValue={item?.gpa ?? ""} />
      </label>
      <label className="field">
        <span>Order</span>
        <input name="sortOrder" type="number" min="0" defaultValue={item?.sort_order ?? 0} />
      </label>
    </>
  );
}

function WorkFields({ item }: { item?: WorkExperienceRow }) {
  return (
    <>
      <label className="field">
        <span>Company</span>
        <input name="company" defaultValue={item?.company ?? ""} />
      </label>
      <label className="field">
        <span>Title</span>
        <input name="title" defaultValue={item?.title ?? ""} />
      </label>
      <label className="field">
        <span>Location</span>
        <input name="location" defaultValue={item?.location ?? ""} />
      </label>
      <label className="field">
        <span>Start</span>
        <input name="startDate" defaultValue={item?.start_date ?? ""} placeholder="2022" />
      </label>
      <label className="field">
        <span>End</span>
        <input name="endDate" defaultValue={item?.end_date ?? ""} placeholder="Present" />
      </label>
      <label className="field">
        <span>Order</span>
        <input name="sortOrder" type="number" min="0" defaultValue={item?.sort_order ?? 0} />
      </label>
      <label className="checkbox-field profile-checkbox">
        <input name="isCurrent" type="checkbox" defaultChecked={Boolean(item?.is_current)} />
        <span>Current role</span>
      </label>
      <label className="field wide-field">
        <span>Description</span>
        <textarea name="description" defaultValue={item?.description ?? ""} rows={5} />
      </label>
    </>
  );
}

function sponsorshipValue(profile: ProfileRow | null) {
  if (profile?.requires_sponsorship === true) {
    return "yes";
  }
  if (profile?.requires_sponsorship === false) {
    return "no";
  }
  return "";
}
