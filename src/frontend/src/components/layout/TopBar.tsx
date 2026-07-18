import { useAuth } from "../../hooks/useAuth";
import { LogOut, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function TopBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#252540] bg-[#131320] px-6">
      <div className="text-sm text-[#8888a0]">
        {user?.teams && user.teams.length > 0 && (
          <span>{user.teams[0].teamName || "Default Team"}</span>
        )}
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-[#1a1a2e]"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full ring-1 ring-[#333355]"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          <span className="text-[#e4e4f0]">{user?.name || "User"}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[#252540] bg-[#131320] py-1 shadow-xl">
            <div className="border-b border-[#252540] px-3 py-2">
              <p className="text-sm font-medium text-[#e4e4f0]">{user?.name}</p>
              <p className="text-xs text-[#8888a0]">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#8888a0] transition-colors hover:bg-[#1a1a2e] hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
