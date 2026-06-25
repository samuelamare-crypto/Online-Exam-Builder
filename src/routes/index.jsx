import { createFileRoute, Link } from "@tanstack/react-router";
import NavBar from "../components/NavBar.jsx";
import { seedExams, seedPolls } from "../lib/data.js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuizPoll — Online Exams & Polls" },
      {
        name: "description",
        content:
          "Take timed online exams, get instant scores, and vote in live polls. A simple web app for quizzes and opinions.",
      },
      { property: "og:title", content: "QuizPoll — Online Exams & Polls" },
      {
        property: "og:description",
        content: "Take timed online exams and vote in live polls.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <NavBar />

      {/* Hero */}
      <section className="hero-bg">
        <div className="hero-overlay-bg">
          <h1 className="mb-5 text-4xl font-bold sm:text-6xl">
            Test knowledge.
            <br />
            Capture opinions.
          </h1>
          <p className="mb-6 max-w-xl text-lg sm:text-xl">
            Take timed multiple-choice exams with instant scoring, or cast your vote
            in live polls and watch the results update in real time.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/exams" className="btn-gold">
              Start an exam
            </Link>
            <Link to="/polls" className="btn-gold">
              Vote in a poll
            </Link>
          </div>
        </div>
      </section>

      {/* Institutions / Features */}
      <section className="institutions-band">
        <h2>Built for Learners &amp; Leaders</h2>
        <p>Everything you need to run quizzes and collect opinions in one place.</p>
        <div className="flex justify-center gap-5 flex-wrap">
          <InstitutionCard
            title="Timed Exams"
            blurb={`${seedExams.length} ready quizzes with countdown timers and instant scoring.`}
            to="/exams"
            cta="Browse exams"
          />
          <InstitutionCard
            title="Live Polls"
            blurb={`${seedPolls.length} live polls with one-tap voting and real-time percentages.`}
            to="/polls"
            cta="See polls"
          />
          <InstitutionCard
            title="Instant Results"
            blurb="See your score, review every answer, and retake until you master the topic."
            to="/exams"
            cta="Try now"
          />
        </div>
      </section>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function InstitutionCard({ title, blurb, to, cta }) {
  return (
    <div className="institution-card">
      <h3>{title}</h3>
      <p>{blurb}</p>
      <Link to={to} className="btn-gold mt-4 inline-block text-sm">
        {cta}
      </Link>
    </div>
  );
}
