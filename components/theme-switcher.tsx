"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeSwitcher({ label }: { label: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.cookie = `moribac_theme=${next ? "dark" : "light"};path=/;max-age=31536000;samesite=lax`;
  }
  return <button type="button" className="icon-button" onClick={toggle} aria-label={label} title={label}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>;
}
