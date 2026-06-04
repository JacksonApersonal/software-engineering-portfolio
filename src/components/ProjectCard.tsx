import { Link } from 'react-router';
import type { Project } from '../data/projects';

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm transition hover:-translate-y-1 hover:border-neutral-600 hover:bg-neutral-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            {project.title}
          </h2>

          <p className="mt-2 text-sm text-neutral-500">{project.language}</p>
        </div>

        <StatusBadge status={project.status} />
      </div>

      <p className="mt-5 leading-7 text-neutral-400">{project.summary}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {project.concepts.map((concept) => (
          <span
            key={concept}
            className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition group-hover:border-neutral-700"
          >
            {concept}
          </span>
        ))}
      </div>

      <p className="mt-auto pt-6 text-sm font-medium text-neutral-500 transition group-hover:text-neutral-300">
        View project →
      </p>
    </Link>
  );
}

type StatusBadgeProps = {
  status: 'Planned' | 'In Progress' | 'Complete';
};

function StatusBadge({ status }: StatusBadgeProps) {
  const statusStyles = {
    Complete: 'border-white bg-white text-neutral-950',
    'In Progress': 'border-neutral-500 bg-neutral-800 text-neutral-200',
    Planned: 'border-neutral-800 bg-neutral-950 text-neutral-500',
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}