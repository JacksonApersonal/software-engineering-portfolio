export function AboutPage() {
  return (
    <section className="space-y-12">
      <div className="max-w-3xl space-y-7">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          About
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
          I am a software engineer who likes building practical systems that are
          reliable, testable, and easy to understand.
        </h1>

        <p className="text-lg leading-8 text-neutral-400">
          Professionally, I work across C#/.NET applications, ASP.NET Core APIs,
          system integrations, UI automation, and release validation. In this
          portfolio, I applied the same debugging and testing mindset to a
          pathfinding visualizer, a Redis-backed URL shortener, and a Spotify
          dashboard with server-side OAuth.
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        <AboutCard
          title="Backend & APIs"
          description="Experience with ASP.NET Core APIs and integrations, plus portfolio work using Vercel Functions, Redis, request validation, and OAuth token flows."
        />

        <AboutCard
          title="Desktop Applications"
          description="Hands-on experience with C#, .NET, UWP, XAML-heavy interfaces, debugging, and user-facing application behavior."
        />

        <AboutCard
          title="Testing & Quality"
          description="Professional experience with integration and UI automation, reinforced by focused unit, handler, adapter, and client tests in this portfolio."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Core Skills
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'C#',
              '.NET',
              'ASP.NET Core',
              'UWP',
              'XAML',
              'TypeScript',
              'React',
              'Vercel Functions',
              'Redis',
              'OAuth 2.0',
              'Python',
              'Java',
              'SQL',
              'REST APIs',
              'Automated Testing',
              'Debugging',
              'Git',
            ].map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-sm text-neutral-400"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
            Engineering Style
          </p>

          <div className="mt-6 space-y-5 text-neutral-400">
            <p className="leading-7">
              I like approaching software from both the user side and the
              system side: what the user is trying to accomplish, what the code
              is actually doing, and where the failure points are.
            </p>

            <p className="leading-7">
              I care about readable code, focused tests, good debugging
              practices, and building features in a way that can be maintained
              after the first version works.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Role Direction
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          I am targeting software engineering roles where I can build, test,
          debug, and improve real systems.
        </h2>

        <p className="mt-5 max-w-4xl leading-7 text-neutral-400">
          I am interested in teams where I can contribute to APIs, user-facing
          applications, platform tooling, or test infrastructure while taking
          ownership of debugging, implementation, and validation from initial
          requirements through release.
        </p>
      </section>
    </section>
  );
}

type AboutCardProps = {
  title: string;
  description: string;
};

function AboutCard({ title, description }: AboutCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>

      <p className="mt-4 leading-7 text-neutral-400">{description}</p>
    </div>
  );
}
