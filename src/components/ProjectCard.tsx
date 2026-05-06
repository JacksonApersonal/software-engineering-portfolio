import { Link } from 'react-router';
import type { Project } from '../data/projects';

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group block rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm transition hover:-translate-y-1 hover:border-neutral-600 hover:bg-neutral-900"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          {project.title}
        </h2>

        <span className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs font-medium text-neutral-300">
          {project.language}
        </span>
      </div>

      <p className="mb-5 leading-7 text-neutral-400">{project.summary}</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {project.concepts.map((concept) => (
          <span
            key={concept}
            className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition group-hover:border-neutral-700"
          >
            {concept}
          </span>
        ))}
      </div>

      <p className="text-sm text-neutral-500">Status: {project.status}</p>
    </Link>
  );
}