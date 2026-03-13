type WorkspaceLoadingStateProps = {
  eyebrow?: string;
  title: string;
  detail: string;
  status: string;
};

export default function WorkspaceLoadingState({
  eyebrow = 'Workspace',
  title,
  detail,
  status,
}: WorkspaceLoadingStateProps) {
  return (
    <section
      aria-live="polite"
      className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(247,245,241,0.94))] px-5 py-12 shadow-[0_24px_80px_rgba(28,25,23,0.08)] dark:border-neutral-700/50 dark:bg-[linear-gradient(180deg,rgba(16,26,40,0.96),rgba(11,17,24,0.92))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:min-h-[460px] sm:px-8"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="workspace-loading-glow absolute left-1/2 top-[18%] h-56 w-56 -translate-x-1/2 rounded-full bg-[#FFD400]/14 blur-3xl dark:bg-[#FFD400]/10" />
        <div className="workspace-loading-glow workspace-loading-glow-secondary absolute left-1/2 top-[40%] h-64 w-64 -translate-x-1/2 rounded-full bg-sky-300/10 blur-3xl dark:bg-sky-400/8" />
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 dark:via-neutral-600" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[23rem] flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/74 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-400 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/55 dark:text-neutral-500">
          <span className="workspace-loading-dot h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <span>{eyebrow}</span>
        </div>

        <div className="workspace-loading-stage relative mt-8 flex h-40 w-40 items-center justify-center" aria-hidden="true">
          <div className="workspace-loading-ring workspace-loading-ring-outer absolute inset-0 rounded-full border border-white/55 dark:border-white/8" />
          <div className="workspace-loading-ring workspace-loading-ring-middle absolute inset-[14%] rounded-full border border-stone-200/90 dark:border-neutral-700/70" />
          <div className="workspace-loading-ring workspace-loading-ring-inner absolute inset-[28%] rounded-full border border-[#FFD400]/26 dark:border-[#FFD400]/18" />

          <div className="workspace-loading-tile relative flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-[2rem] border border-white/80 bg-white/76 shadow-[0_20px_45px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-2xl dark:border-neutral-700/60 dark:bg-neutral-900/72 dark:shadow-[0_20px_45px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="absolute inset-[10px] rounded-[1.4rem] border border-stone-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,240,234,0.90))] dark:border-neutral-700/60 dark:bg-[linear-gradient(180deg,rgba(28,33,42,0.95),rgba(17,22,30,0.92))]" />
            <div className="workspace-loading-glyph relative flex items-end gap-1.5">
              <span className="workspace-loading-glyph-bar h-8 w-2.5 rounded-full bg-stone-300/95 dark:bg-neutral-600/90" />
              <span className="workspace-loading-glyph-bar workspace-loading-glyph-bar-accent h-11 w-2.5 rounded-full bg-[#FFD400]" />
              <span className="workspace-loading-glyph-bar workspace-loading-glyph-bar-delay h-6 w-2.5 rounded-full bg-stone-800/80 dark:bg-neutral-200/85" />
            </div>
            <div className="workspace-loading-tile-sheen absolute inset-x-6 top-4 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95 dark:via-white/20" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-400 dark:text-neutral-500">Active Sync</p>
          <h2 className="text-balance text-[1.72rem] font-semibold tracking-[-0.045em] text-stone-950 dark:text-neutral-100 sm:text-[1.95rem]">
            {title}
          </h2>
          <p className="mx-auto max-w-sm text-sm leading-6 text-stone-500 dark:text-neutral-400">{detail}</p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-stone-400 dark:text-neutral-500">
            <span className="workspace-loading-dot h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span>{status}</span>
          </div>
          <div className="relative h-[3px] w-28 overflow-hidden rounded-full bg-stone-200/90 dark:bg-neutral-800/90" aria-hidden="true">
            <div className="workspace-loading-line absolute inset-y-0 left-0 w-[42%] rounded-full bg-[linear-gradient(90deg,rgba(160,160,160,0.75),rgba(255,212,0,0.98),rgba(245,245,245,0.95))] dark:bg-[linear-gradient(90deg,rgba(82,82,91,0.9),rgba(255,212,0,0.98),rgba(226,232,240,0.9))]" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .workspace-loading-glow {
          animation: workspace-glow-drift 8.5s ease-in-out infinite;
        }

        .workspace-loading-glow-secondary {
          animation-delay: 1.4s;
        }

        .workspace-loading-dot {
          animation: workspace-dot-pulse 1.8s ease-in-out infinite;
        }

        .workspace-loading-stage {
          animation: workspace-stage-float 5.4s ease-in-out infinite;
        }

        .workspace-loading-ring {
          animation: workspace-ring-breathe 4.6s ease-in-out infinite;
        }

        .workspace-loading-ring-middle {
          animation-delay: 0.6s;
        }

        .workspace-loading-ring-inner {
          animation-delay: 1.1s;
        }

        .workspace-loading-tile {
          animation: workspace-tile-breathe 3.8s ease-in-out infinite;
        }

        .workspace-loading-glyph-bar {
          transform-origin: center bottom;
          animation: workspace-glyph-bar 1.8s ease-in-out infinite;
        }

        .workspace-loading-glyph-bar-accent {
          animation-delay: 0.18s;
        }

        .workspace-loading-glyph-bar-delay {
          animation-delay: 0.36s;
        }

        .workspace-loading-line {
          animation: workspace-line-slide 2.2s ease-in-out infinite;
        }

        @keyframes workspace-glow-drift {
          0%,
          100% {
            transform: translate3d(-50%, 0, 0) scale(0.96);
            opacity: 0.7;
          }
          50% {
            transform: translate3d(-50%, -10px, 0) scale(1.04);
            opacity: 1;
          }
        }

        @keyframes workspace-dot-pulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.12);
            opacity: 1;
          }
        }

        @keyframes workspace-stage-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -7px, 0);
          }
        }

        @keyframes workspace-ring-breathe {
          0%,
          100% {
            transform: scale(0.985);
            opacity: 0.55;
          }
          50% {
            transform: scale(1.015);
            opacity: 0.92;
          }
        }

        @keyframes workspace-tile-breathe {
          0%,
          100% {
            transform: scale(0.985);
          }
          50% {
            transform: scale(1.012);
          }
        }

        @keyframes workspace-glyph-bar {
          0%,
          100% {
            transform: scaleY(0.84);
            opacity: 0.72;
          }
          50% {
            transform: scaleY(1.06);
            opacity: 1;
          }
        }

        @keyframes workspace-line-slide {
          0%,
          100% {
            transform: translateX(0) scaleX(0.82);
            opacity: 0.85;
          }
          50% {
            transform: translateX(120%) scaleX(1);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .workspace-loading-glow,
          .workspace-loading-dot,
          .workspace-loading-stage,
          .workspace-loading-ring,
          .workspace-loading-tile,
          .workspace-loading-glyph-bar,
          .workspace-loading-line {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
