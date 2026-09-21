import { useId, useRef, useState, type KeyboardEvent } from "react";
import { PixelArt, type SpriteName } from "./pixels";

const PLAY_MS = 900;

function useDecoPlay() {
  const [play, setPlay] = useState(false);
  const timer = useRef(0);
  const pop = () => {
    setPlay(false);
    window.requestAnimationFrame(() => {
      setPlay(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPlay(false), PLAY_MS);
    });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pop();
    }
  };
  return { play, pop, onKey };
}

function Bits() {
  return (
    <span className="deco-fx" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Tip({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span id={id} className="deco-tip" role="tooltip">
      {text}
    </span>
  );
}

export function DecoTile({
  sprite,
  tone,
  span,
  kicker,
  title,
  tip,
  scale = 5
}: {
  sprite: SpriteName;
  tone: string;
  span: string;
  kicker: string;
  title: string;
  tip?: string;
  scale?: number;
}) {
  const { play, pop, onKey } = useDecoPlay();
  const tipId = useId();
  return (
    <section
      className={`tile ${tone} ${span} deco-tile${play ? " is-play" : ""}`}
      data-deco={sprite}
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-describedby={tip ? tipId : undefined}
      onClick={pop}
      onKeyDown={onKey}
    >
      <Bits />
      <Tip id={tipId} text={tip} />
      <PixelArt name={sprite} scale={scale} />
      <div className="kicker">{kicker}</div>
      <h2>{title}</h2>
    </section>
  );
}

export function DecoBuddy({ name, label, tip }: { name: SpriteName; label: string; tip?: string }) {
  const { play, pop, onKey } = useDecoPlay();
  const tipId = useId();
  return (
    <button
      type="button"
      className={`deco-buddy${play ? " is-play" : ""}`}
      data-deco={name}
      aria-label={label}
      aria-describedby={tip ? tipId : undefined}
      onClick={pop}
      onKeyDown={onKey}
    >
      <Bits />
      <Tip id={tipId} text={tip} />
      <PixelArt name={name} scale={4} />
      <span>{label}</span>
    </button>
  );
}
