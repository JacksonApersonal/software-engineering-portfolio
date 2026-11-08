import { Link, useParams } from 'react-router';
import { projects } from '../data/projects';
import { PathfindingVisualizerDemo } from '../components/demos/PathfindingVisualizerDemo';
import { UrlShortenerDemo } from '../components/demos/UrlShortenerDemo';

export function ProjectDetailPage() {
  const { slug } = useParams();

  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold text-white">Project not found</h1>

        <Link to="/projects" className="text-neutral-400 hover:text-white">
          Back to projects
        </Link>
      </section>
    );
  }

  const isComplete = project.status === 'Complete';
  const isPlanned = project.status === 'Planned';
  const featuresTitle = isComplete
    ? 'Implemented Features'
    : isPlanned
      ? 'Planned Features'
      : 'Current Feature Scope';
  const testingTitle = isComplete
    ? 'Testing and Validation'
    : isPlanned
      ? 'Planned Testing Strategy'
      : 'Testing Strategy';
  const demoTitle = project.demoUrl
    ? isComplete
      ? 'Live project demo'
      : 'Interactive project demo'
    : 'Planned project demo';
  const demoStatus = project.demoUrl
    ? isComplete
      ? 'Available'
      : 'In progress'
    : 'Planned';

  return (
    <section className="space-y-10">
      <div className="space-y-6">
        <Link
          to="/projects"
          className="text-sm text-neutral-400 transition hover:text-white"
        >
          ← Back to projects
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            {project.language}
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {project.title}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-400">
            {project.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatusBadge status={project.status} />

          {project.concepts.map((concept) => (
            <span
              key={concept}
              className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm text-neutral-400"
            >
              {concept}
            </span>
          ))}
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <InfoPanel title="Problem">
          <p>{project.problem}</p>
        </InfoPanel>

        <InfoPanel title="Solution">
          <p>{project.solution}</p>
        </InfoPanel>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
              Demo
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {demoTitle}
            </h2>
          </div>

          <span className="rounded-full border border-neutral-800 px-3 py-1 text-sm text-neutral-500">
            {demoStatus}
          </span>
        </div>

        <div className="mt-6 flex justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-950/70 p-6">
          {project.slug === 'pathfinding-visualizer' ? (
            <PathfindingVisualizerDemo />
          ) : project.slug === 'url-shortener' ? (
            <UrlShortenerDemo />
          ) : project.demoUrl ? (
            <div className="max-w-2xl text-center">
              <p className="text-neutral-300">
                This project includes an interactive demo.
              </p>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Open the demo to interact with the project directly in the browser.
              </p>

              <div className="mt-5 flex justify-center">
                <Link
                  to={project.demoUrl}
                  className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
                >
                  Open Interactive Demo
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl text-center">
              <p className="text-neutral-300">Demo planned</p>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                This project has not been implemented yet. A demo or guided
                walkthrough will be added after the core functionality is built.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ListPanel title={featuresTitle} items={project.features} />
        <ListPanel title={testingTitle} items={project.testingStrategy} />
      </section>

      {!isComplete && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Implementation Plan
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {isPlanned ? 'Planned milestones' : 'Development milestones'}
          </h2>

          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            <Milestone number="01" title="Define requirements" />
            <Milestone number="02" title="Design data structures" />
            <Milestone number="03" title="Build core logic" />
            <Milestone number="04" title="Add tests" />
            <Milestone number="05" title="Create interactive demo" />
            <Milestone number="06" title="Write final reflection" />
          </ol>
        </section>
      )}

      <section>
        <LinkPanel
          title="Source Code"
          description={
            project.repoUrl
              ? 'View the source code for this project on GitHub.'
              : 'A GitHub repository will be added when implementation begins.'
          }
          linkText={project.repoUrl ? 'View source code' : 'Repository planned'}
          href={project.repoUrl}
        />
      </section>
    </section>
  );
}

type InfoPanelProps = {
  title: string;
  children: React.ReactNode;
};

function InfoPanel({ title, children }: InfoPanelProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-4 leading-7 text-neutral-400">{children}</div>
    </section>
  );
}

type ListPanelProps = {
  title: string;
  items: string[];
};

function ListPanel({ title, items }: ListPanelProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-neutral-400">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
            <span className="leading-7">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type MilestoneProps = {
  number: string;
  title: string;
};

function Milestone({ number, title }: MilestoneProps) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <span className="text-sm font-medium text-neutral-500">{number}</span>
      <span className="font-medium text-neutral-200">{title}</span>
    </li>
  );
}

type LinkPanelProps = {
  title: string;
  description: string;
  linkText: string;
  href?: string;
};

function LinkPanel({ title, description, linkText, href }: LinkPanelProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>

      <p className="mt-4 leading-7 text-neutral-400">{description}</p>

      {href ? (
        <a
          href={href}
          className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
          target="_blank"
          rel="noreferrer"
        >
          {linkText}
        </a>
      ) : (
        <span className="mt-5 inline-flex rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-500">
          {linkText}
        </span>
      )}
    </section>
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
      className={`rounded-full border px-3 py-1 text-sm font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
