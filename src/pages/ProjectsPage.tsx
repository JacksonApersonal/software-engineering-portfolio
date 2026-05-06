import { ProjectCard } from '../components/ProjectCard';
import { projects } from '../data/projects';

export function ProjectsPage() {
  return (
    <section className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Projects
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          Software Engineering Labs
        </h1>

        <p className="mt-5 max-w-3xl leading-7 text-neutral-400">
          Each project is designed to demonstrate a different area of software
          engineering: algorithms, backend systems, real-time communication,
          data modeling, testing, and clean architecture.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}