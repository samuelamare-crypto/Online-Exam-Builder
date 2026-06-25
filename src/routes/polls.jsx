import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { getPolls, votePoll, getStudent, isAdmin } from "../lib/store.js";

export const Route = createFileRoute("/polls")({
  head: () => ({
    meta: [
      { title: "Polls — QuizPoll" },
      {
        name: "description",
        content: "Cast your vote in live polls and instantly see the percentage breakdown of results.",
      },
    ],
  }),
  component: Polls,
});

function Polls() {
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [voter, setVoter] = useState(null);
  const [ready, setReady] = useState(false);
  const [voted, setVoted] = useState({});

  useEffect(() => {
    const me = getStudent() || (isAdmin() ? "Admin" : null);
    setVoter(me);
    setPolls(getPolls());
    // Determine which polls this user already voted in.
    const v = {};
    if (me) {
      for (const p of getPolls()) {
        const rec = (p.voters || []).find((r) => r.voter === me);
        if (rec) v[p.id] = rec.optionId;
      }
    }
    setVoted(v);
    setReady(true);
  }, []);

  function vote(pollId, optionId) {
    if (!voter) {
      navigate({ to: "/login" });
      return;
    }
    // Allow vote change - no early return if already voted
    const next = votePoll(pollId, optionId, voter);
    setPolls([...next]);
    setVoted((s) => ({ ...s, [pollId]: optionId }));
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center text-muted-foreground">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <section className="gradient-blue-amber py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Live Polls</h1>
        <p className="mt-3 text-lg">Tap an option to vote and see results.</p>
      </section>

      <main className="mx-auto max-w-3xl px-5 py-12">
        {!voter && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Please{" "}
            <button
              onClick={() => navigate({ to: "/login" })}
              className="font-semibold text-primary hover:underline"
            >
              sign in
            </button>{" "}
            to cast your vote.
          </div>
        )}
        {polls.length === 0 && (
          <p className="text-center text-muted-foreground">No polls available yet.</p>
        )}
        <div className="space-y-6">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((a, o) => a + o.votes, 0);
            const hasVoted = Boolean(voted[poll.id]);
            return (
              <div key={poll.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-primary">{poll.question}</h2>
                <div className="mt-5 space-y-3">
                  {poll.options.map((o) => {
                    const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
                    const picked = voted[poll.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => vote(poll.id, o.id)}
                        disabled={false}
                        className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors ${
                          picked ? "border-primary" : "border-border"
                        } ${hasVoted ? "cursor-default" : "hover:bg-muted"}`}
                      >
                        {hasVoted && (
                          <span
                            className="absolute inset-y-0 left-0 bg-primary/15"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <span className="relative flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {o.label}
                            {picked ? " ·  your vote" : ""}
                          </span>
                          {hasVoted && (
                            <span className="text-sm font-semibold text-primary">
                              {pct}%
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {totalVotes} votes{hasVoted ? "" : " · vote to reveal results"}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="gradient-blue-amber py-6 text-center text-sm text-white">
        Built with QuizPoll · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
