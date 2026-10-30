import { FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LoaderCircle, Play } from "lucide-react";

interface HeroSectionProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  examples: { label: string; id: string }[];
  onSelectExample: (id: string) => void;
}

export function HeroSection({
  query,
  onQueryChange,
  onSubmit,
  loading,
  error,
  onRetry,
  examples,
  onSelectExample,
}: HeroSectionProps) {
  return (
    <section className="hero">
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65 }}
      >
        <div className="eyebrow">THE YOUTUBE PLAYLIST STUDY PLANNER</div>
        <h1>
          How long is that
          <br />
          <em>YouTube playlist?</em>
        </h1>
        <p className="hero-subtitle">
          Paste a playlist, video or channel link. Get the total watch time, speed-adjusted estimates, and a plan to finish it.
        </p>

        <form className="search-form" onSubmit={onSubmit}>
          <textarea
            aria-label="YouTube playlist, video, or channel links"
            placeholder="https://www.youtube.com/playlist?list=..."
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              event.currentTarget.style.height = "24px";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 72)}px`;
            }}
            rows={1}
          />
          <button className="calculate-button" type="submit" disabled={loading}>
            {loading ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                <span>Calculate</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="input-hint">
          Works with playlists up to 5,000 videos · channels · single videos · paste up to 5 links at once to compare them side
          by side
        </p>

        {error && (
          <motion.div className="error-message" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <span>!</span>
            {error}
            <button type="button" onClick={onRetry} aria-label="Retry loading playlist">
              Retry
            </button>
          </motion.div>
        )}

        <div className="example-row">
          <span className="example-label">Or try</span>
          {examples.map((example) => (
            <button className="example-chip" key={example.id} type="button" onClick={() => onSelectExample(example.id)}>
              <Play size={11} fill="currentColor" />
              {example.label}
            </button>
          ))}
          <button
            className="example-chip"
            type="button"
            onClick={() => onSelectExample("https://www.youtube.com/@cs50")}
          >
            a whole channel
          </button>
        </div>
      </motion.div>
    </section>
  );
}
