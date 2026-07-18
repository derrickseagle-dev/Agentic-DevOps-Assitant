import { useAuth } from "../../hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LogOut, User, Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

export function TopBar() {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const teamId = user?.teams?.[0]?.teamId;

  // Poll for notifications every 30 seconds
  const { data: notifData } = useQuery({
    queryKey: ["notifications", teamId],
    queryFn: () => api.listNotifications(teamId!),
    enabled: !!teamId,
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount ?? 0;
  const notifications = notifData?.notifications ?? [];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    if (!teamId) return;
    try {
      await api.markNotificationRead(teamId, notificationId);
      queryClient.invalidateQueries({ queryKey: ["notifications", teamId] });
    } catch {
      // Best-effort
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "checkpoint_pending":
        return "⏳";
      case "run_failed":
        return "❌";
      case "deployment_complete":
        return "🚀";
      default:
        return "🔔";
    }
  };

  const formatNotifTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#252540] bg-[#131320] px-6">
      <div className="text-sm text-[#8888a0]">
        {user?.teams && user.teams.length > 0 && (
          <span>{user.teams[0].teamName || "Default Team"}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="relative rounded-lg p-2 transition-colors hover:bg-[#1a1a2e]"
          >
            <Bell className="h-5 w-5 text-[#8888a0]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-[#252540] bg-[#131320] py-1 shadow-xl z-50">
              <div className="border-b border-[#252540] px-3 py-2 flex items-center justify-between">
                <p className="text-sm font-medium text-[#e4e4f0]">Notifications</p>
                {unreadCount > 0 && (
                  <span className="text-xs text-[#8888a0]">{unreadCount} unread</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <Bell className="mx-auto mb-2 h-8 w-8 text-[#333355]" />
                    <p className="text-sm text-[#666680]">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n: any) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#1a1a2e] ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="mt-0.5 text-base">{getNotifIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.read ? "font-medium text-[#e4e4f0]" : "text-[#8888a0]"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-[#666680] mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-[#555570] mt-1">{formatNotifTime(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
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

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[#252540] bg-[#131320] py-1 shadow-xl z-50">
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
      </div>
    </header>
  );
}
