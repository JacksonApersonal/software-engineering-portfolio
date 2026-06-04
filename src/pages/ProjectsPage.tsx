import { useState } from 'react';

import { ProjectCard } from '../components/ProjectCard';
import { projects } from '../data/projects';

type ProjectStatusFilter = 'All' | 'Complete' | 'In Progress' | 'Planned';

const filters: ProjectStatusFilter[] = [
  'All',
  'Complete',
  'In Progress',
  'Planned',
];

export function ProjectsPage() {
  const [selectedFilter, setSelectedFilter] =
    useState<ProjectStatusFilter>('All');

  const filteredProjects =
    selectedFilter === 'All'
      ? projects
      : projects.filter((project) => project.status === selectedFilter);

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
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

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isSelected = selectedFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={
                  isSelected
                    ? 'rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950'
                    : 'rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition hover:border-neutral-600 hover:text-white'
                }
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">No projects found</h2>

          <p className="mt-3 text-neutral-400">
            There are no projects with this status yet.
          </p>
        </div>
      )}
    </section>
  );
}