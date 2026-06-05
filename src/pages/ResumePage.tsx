export function ResumePage() {
  return (
    <section className="space-y-12">
      <div className="max-w-3xl space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Resume
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Software Engineer focused on reliable systems, practical problem
          solving, and thoughtful software design.
        </h1>

        <p className="text-lg leading-8 text-neutral-400">
          My experience includes building production software, improving
          testing workflows, integrating systems, and collaborating with teams
          to ship stable products. I bring a strong foundation in debugging,
          reliability, and hands-on engineering across multiple technologies.
        </p>

        <div className="flex flex-wrap gap-4">
          <a
            href="/Jackson-Acord-Resume.pdf"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white px-5 py-3 font-medium text-neutral-950 transition hover:bg-neutral-200"
          >
            View Resume PDF
          </a>

          <a
            href="/Jackson-Acord-Resume.pdf"
            download
            className="rounded-xl border border-neutral-700 px-5 py-3 font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
          >
            Download Resume
          </a>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <ResumeCard title="Current Role" eyebrow="365 Labs">
          <p>
            Software Engineer building production applications, APIs, and
            internal tools with a focus on reliability, maintainability, and
            delivery.
          </p>
        </ResumeCard>

        <ResumeCard title="Core Strength" eyebrow="Engineering Focus">
          <p>
            Building maintainable software with strong debugging practices,
            automation, test coverage, and reliability-focused development.
          </p>
        </ResumeCard>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Technical Skills
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <SkillGroup
            title="Programming"
            skills={['C#', 'Python', 'C++', 'JavaScript', 'HTML', 'CSS']}
          />

          <SkillGroup
            title="Frameworks & Tech"
            skills={[
              'ASP.NET Core',
              'WPF',
              'UWP',
              'REST APIs',
              'Entity Framework',
              'MSTest',
            ]}
          />

          <SkillGroup
            title="Testing"
            skills={[
              'Automated Testing',
              'Integration Testing',
              'Regression Testing',
              'API Testing',
              'CI/CD',
            ]}
          />

          <SkillGroup
            title="Tools"
            skills={[
              'GitHub',
              'Azure DevOps',
              'Jira',
              'Confluence',
              'Visual Studio',
              'Postman',
            ]}
          />
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Experience
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Professional background
          </h2>
        </div>

        <ExperienceItem
          company="365 Labs"
          location="Baton Rouge, LA"
          role="Software Engineer"
          dates="March 2023 – Present"
          bullets={[
            'Developed and maintained C#/.NET applications including ASP.NET Core APIs and UWP/WPF client applications.',
            'Built automation and integration testing frameworks using MSTest, WinAppDriver, and Appium.',
            'Implemented and validated API integrations while collaborating with backend developers on system design and debugging.',
            'Coordinated release validation and testing workflows to support stable deployments.',
          ]}
        />

        <ExperienceItem
          company="Electronic Arts"
          location="Baton Rouge, LA"
          role="Defect Coordinator / Quality Assurance Tester"
          dates="October 2020 – January 2023"
          bullets={[
            'Audited, reproduced, prioritized, and documented software defects for engineering teams.',
            'Collaborated with Respawn developers on issue investigation and error-handling practices.',
            'Worked with distributed teams across the U.S., U.K., and Romania on gameplay and systems testing.',
            'Created documentation and onboarding materials for future defect coordinators.',
          ]}
        />
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Education
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          B.S. in Computer Science
        </h2>

        <p className="mt-3 text-neutral-400">
          Louisiana State University — Baton Rouge, LA
        </p>

        <p className="mt-2 text-sm text-neutral-500">
          August 2021 – December 2025
        </p>
      </section>
    </section>
  );
}

type ResumeCardProps = {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
};

function ResumeCard({ title, eyebrow, children }: ResumeCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>

      <div className="mt-4 leading-7 text-neutral-400">{children}</div>
    </div>
  );
}

type SkillGroupProps = {
  title: string;
  skills: string[];
};

function SkillGroup({ title, skills }: SkillGroupProps) {
  return (
    <div>
      <h3 className="font-medium text-white">{title}</h3>

      <div className="mt-3 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-sm text-neutral-400"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

type ExperienceItemProps = {
  company: string;
  location: string;
  role: string;
  dates: string;
  bullets: string[];
};

function ExperienceItem({
  company,
  location,
  role,
  dates,
  bullets,
}: ExperienceItemProps) {
  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-white">
            {company}
          </h3>

          <p className="mt-1 text-neutral-400">{role}</p>

          <p className="mt-1 text-sm text-neutral-500">{location}</p>
        </div>

        <p className="text-sm text-neutral-500">{dates}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3 text-neutral-400">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
            <span className="leading-7">{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
