import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { listPolls, listVoteCounts, listMyVotes, castVote } from "../lib/db.js";

export const Route = createFileRoute("/polls")({
  head: () => ({
    meta: [
      { title: "Polls — QuizPoll" },
      { name: "description", content: "Cast your vote and see real-time results." },
    ],
  }),
  component: Polls,
});

function Polls() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useAuth();

  const [polls, setPolls]   = useState([]);
  const [counts, setCounts] = useState({});   // { [optionId]: voteCount }
  const [voted, setVoted]   = useState({});   // { [pollId]: optionId }
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;

    async function load() {
      try {
        const [pollList, voteCounts, myVotes] = await Promise.all([
          listPolls(),
          listVoteCounts(),
          listMyVotes(),
        ]);
        if (cancelled) return;
        setPolls(pollList);
        setCounts(voteCounts);
        setVoted(myVotes);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, sessionLoading]);

  async function vote(pollId, optionId) {
    if (!user) { navigate({ to: "/login" }); return; }
    // Optimistic update so the bar fills instantly
    setVoted((s) => ({ ...s, [pollId]: optionId }));
    setCounts((s) => {
      const next = { ...s };
      const prev = voted[pollId];
      if (prev) next[prev] = Math.max(0, (next[prev] || 1) - 1);
      next[optionId] = (next[optionId] || 0) + 1;
      return next;
    });
    try {
      await castVote(pollId, optionId);
      // Refresh counts from the server in the background
      const fresh = await listVoteCounts();
      setCounts(fresh);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background"><NavBar />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center text-muted-foreground">Loading…</main>
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
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">{error}</div>
        )}
        {!user && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            <button onClick={() => navigate({ to: "/login" })} className="font-semibold text-primary hover:underline">Sign in</button>
            {" "}to cast your vote.
          </div>
        )}
        {polls.length === 0 && <p className="text-center text-muted-foreground">No polls available yet.</p>}

        <div className="space-y-6">
          {polls.map((poll) => {
            const hasVoted    = Boolean(voted[poll.id]);
            const totalVotes  = (poll.options || []).reduce((a, o) => a + (counts[o.id] || 0), 0);

            return (
              <div key={poll.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-primary">{poll.question}</h2>
                <div className="mt-5 space-y-3">
                  {(poll.options || []).map((o) => {
                    const voteCount = counts[o.id] || 0;
                    const pct       = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const picked    = voted[poll.id] === o.id;
                    return (
                      <button key={o.id} onClick={() => vote(poll.id, o.id)}
                        className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors ${picked ? "border-primary" : "border-border"} ${hasVoted ? "cursor-default" : "hover:bg-muted"}`}>
                        {hasVoted && (
                          <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                        )}
                        <span className="relative flex items-center justify-between">
                          <span className="font-medium text-foreground">{o.label}{picked ? " · your vote" : ""}</span>
                          {hasVoted && <span className="text-sm font-semibold text-primary">{pct}%</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{hasVoted ? "" : " · vote to reveal results"}
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
