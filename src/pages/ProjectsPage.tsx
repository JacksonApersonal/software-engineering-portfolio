import { ProjectCard } from '../components/ProjectCard';
import { projects } from '../data/projects';

export function ProjectsPage() {
  return (
    <section className="space-y-10">
      <div>
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Projects
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Software Engineering Labs
          </h1>

          <p className="mt-5 max-w-3xl leading-7 text-neutral-400">
            Three completed projects demonstrate algorithm design, persistent
            backend services, third-party API integration, secure OAuth,
            responsive React interfaces, and focused automated testing. Each
            project includes a working interactive demo and source code.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
