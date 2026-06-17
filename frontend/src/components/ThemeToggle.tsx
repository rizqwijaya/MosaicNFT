import { useEffect, useState } from "react";

function getInitial(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="btn-ghost size-10 !px-0"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
