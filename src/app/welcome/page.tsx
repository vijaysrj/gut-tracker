import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gut Tracker: meals, nutrients and gut symptoms in one chat",
  description:
    "Snap a photo or type what you ate. Gut Tracker estimates the nutrients, logs symptoms like bloating, and shows how your days, weeks and months add up.",
};

const features = [
  {
    icon: "📸",
    title: "Snap your plate",
    body: "Take a photo and Claude estimates the portion, calories, protein, carbs, fat and fibre for you.",
  },
  {
    icon: "💬",
    title: "Just chat",
    body: "Type “dal, rice and curd at 1pm” or fix a mistake in plain words. No forms to fill.",
  },
  {
    icon: "🫃",
    title: "Log how you feel",
    body: "Bloating, gas, cramps, reflux. Note the symptom and how bad it is, whenever it shows up.",
  },
  {
    icon: "🍽️",
    title: "Home or outside",
    body: "Mark meals as home cooked or eaten out, with the place and what you spent.",
  },
  {
    icon: "📊",
    title: "See the patterns",
    body: "Daily, weekly, monthly and yearly views of nutrients, symptoms and spending.",
  },
  {
    icon: "📱",
    title: "Lives on your iPhone",
    body: "Add it to your home screen and it opens like an app. Works on desktop too.",
  },
];

const steps = [
  { n: "1", title: "Log", body: "Photo or a quick message after each meal." },
  { n: "2", title: "Note", body: "Mention any gut symptoms as they happen." },
  { n: "3", title: "Learn", body: "Spot which foods and habits line up with bad days." },
];

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
          me ? "bg-accent text-white" : "bg-bubble"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.5rem] border border-black/10 bg-surface p-3 shadow-xl shadow-black/10 dark:border-white/10 dark:shadow-black/40">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-bubble" />
      <div className="space-y-2 px-1 pb-2">
        <Bubble me>
          <div className="mb-1 flex h-20 items-center justify-center rounded-lg bg-white/15 text-3xl">
            🍛
          </div>
          Lunch at the dosa place, ₹340
        </Bubble>
        <Bubble>
          <div className="rounded-xl border border-black/5 bg-surface px-2.5 py-2 dark:border-white/10">
            <div className="font-medium">Masala dosa with sambar</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
              <span className="font-semibold text-foreground">520 kcal</span>
              <span>P 12g</span>
              <span>C 78g</span>
              <span>F 18g</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">🍽️ Outside · ₹340</div>
          </div>
        </Bubble>
        <Bubble me>Feeling bloated, maybe 6/10</Bubble>
        <Bubble>Logged bloating (6/10) at 3:10 pm. That’s the third time this week after a late lunch.</Bubble>
      </div>
    </div>
  );
}

export default function Welcome() {
  return (
    <div className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-2xl">🥗</span> Gut Tracker
        </div>
        <Link
          href="/login"
          className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium dark:border-white/15"
        >
          Unlock
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-16">
          <div className="text-center md:text-left">
            <p className="text-sm font-medium text-accent">Your personal gut health journal</p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
              Eat, snap, chat.
              <br />
              Understand your gut.
            </h1>
            <p className="mt-4 text-lg text-muted">
              Photograph your meals or describe them in a message. Gut Tracker works out the
              nutrients, keeps track of bloating and other symptoms, and shows you how it all
              connects over days, weeks and months.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link
                href="/login"
                className="rounded-xl bg-accent px-6 py-3 text-center font-medium text-white"
              >
                Open the app
              </Link>
              <a
                href="#features"
                className="rounded-xl border border-black/10 px-6 py-3 text-center font-medium dark:border-white/15"
              >
                What it does
              </a>
            </div>
          </div>
          <PhoneMock />
        </section>

        <section id="features" className="scroll-mt-6 py-10">
          <h2 className="text-center text-2xl font-semibold">Everything in one conversation</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-black/5 bg-surface p-5 dark:border-white/10"
              >
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-2 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl bg-bubble p-5 sm:flex-col sm:gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-12 text-center">
          <div className="rounded-3xl bg-accent px-6 py-10 text-white">
            <h2 className="text-2xl font-semibold">Ready for today’s first meal?</h2>
            <p className="mt-2 text-white/80">
              On iPhone, tap Share then “Add to Home Screen” to keep it one tap away.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-medium text-accent"
            >
              Open Gut Tracker
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-muted">
        A private, single-user app. Nutrient values are AI estimates, not medical advice.
      </footer>
    </div>
  );
}
