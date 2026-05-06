import { Link } from 'react-router';
import { ProjectCard } from '../components/ProjectCard';
import { projects } from '../data/projects';

export function HomePage() {
  const featuredProjects = projects.slice(0, 2);

  return (
    <section className="space-y-16">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
        <div className="space-y-7">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Software Engineering Portfolio
          </p>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            I build reliable software with clean architecture, practical testing,
            and user-focused design.
          </h1>

          <p className="max-w-3xl text-lg leading-8 text-neutral-400">
            I am a software engineer focused on building dependable software,
            solving practical problems, and contributing across the stack. This
            portfolio showcases work in backend systems, application
            development, testing, and full-stack projects across multiple
            languages and frameworks.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
                to="/projects"
                className="rounded-xl bg-white px-5 py-3 font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
                View Projects
            </Link>

            <Link
                to="/resume"
                className="rounded-xl border border-neutral-700 px-5 py-3 font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
            >
                View Resume
            </Link>
            </div>
        </div>

        <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Focus Areas
          </p>

          <div className="mt-6 space-y-4">
            <SkillItem title="Backend Systems" description="APIs, data modeling, service design, and reliability." />
            <SkillItem title="Application Development" description="User-facing software, debugging, workflow design, and maintainable implementation." />
            <SkillItem title="Automated Testing" description="Unit tests, integration tests, UI testing, and test strategy." />
            <SkillItem title="Algorithms" description="Graph traversal, pathfinding, optimization, and visualization." />
          </div>
        </aside>
      </div>

      <section className="grid gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 md:grid-cols-3">
        <StatCard label="Languages" value="4" detail="TypeScript, Python, Java, C#" />
        <StatCard label="Project Style" value="Hands-on" detail="Demos, writeups, tests, and source code." />
        <StatCard label="Goal" value="Job-ready" detail="Built to show practical engineering ability." />
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
              Featured Work
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Current portfolio projects
            </h2>
          </div>

          <Link
            to="/projects"
            className="text-sm font-medium text-neutral-400 transition hover:text-white"
          >
            View all projects →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Contact
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-6">
            <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
                Interested in working together?
            </h2>

            <p className="mt-3 max-w-2xl leading-7 text-neutral-400">
                I am open to software engineering opportunities across backend,
                full-stack, platform, application, automation, and testing
                work where I can build reliable products and keep learning.
            </p>
            </div>

            <div className="flex flex-wrap gap-3">
            <a
                href="mailto:jacord2001@gmail.com"
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
                Email Me
            </a>

            <a
                href="https://linkedin.com/in/jackson-acord-b0baa2262"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
            >
                LinkedIn
            </a>

            <a
                href="https://github.com/JacksonAPersonal"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
            >
                GitHub
            </a>

            <p className="basis-full text-sm text-neutral-500">
                Email: jacord2001@gmail.com
            </p>
            </div>
        </div>
        </section>
    </section>
  );
}

type SkillItemProps = {
  title: string;
  description: string;
};

function SkillItem({ title, description }: SkillItemProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{description}</p>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{detail}</p>
    </div>
  );
}
