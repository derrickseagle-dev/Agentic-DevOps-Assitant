import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Users, UserPlus, Trash2, Crown, Shield, Loader2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const teamId = user?.teams?.[0]?.teamId;
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMessage, setInviteMessage] = useState("");

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => api.listMembers(teamId!),
    enabled: !!teamId,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => api.inviteMember(teamId!, data),
    onSuccess: (data) => {
      setInviteMessage(data.message || "Invitation sent!");
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
    },
    onError: (err: any) => {
      setInviteMessage(err.message || "Failed to invite");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteMessage("");
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3.5 w-3.5 text-amber-400" />;
      case "admin":
        return <Shield className="h-3.5 w-3.5 text-primary" />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e4e4f0]">Settings</h1>
        <p className="mt-1 text-sm text-[#8888a0]">Manage your team and account</p>
      </div>

      {/* Team Members */}
      <div className="mb-8 rounded-xl border border-[#252540] bg-[#131320]">
        <div className="flex items-center gap-2 border-b border-[#252540] px-6 py-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-[#e4e4f0]">Team Members</h2>
        </div>

        <div className="p-6">
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {membersData?.members?.map((member: any) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#1a1a2e]"
                >
                  <div className="flex items-center gap-3">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full ring-1 ring-[#333355]"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                        {member.name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[#e4e4f0]">
                          {member.name}
                        </span>
                        {roleIcon(member.role)}
                      </div>
                      <span className="text-xs text-[#8888a0]">{member.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize text-[#8888a0]">{member.role}</span>
                    {member.role !== "owner" && member.userId !== user?.id && (
                      <button
                        onClick={() => removeMutation.mutate(member.userId)}
                        className="rounded p-1 text-[#666680] transition-colors hover:bg-red-400/10 hover:text-red-400"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {(!membersData?.members || membersData.members.length === 0) && (
                <p className="py-4 text-center text-sm text-[#8888a0]">
                  No team members yet.
                </p>
              )}
            </div>
          )}

          {/* Invite form */}
          <form onSubmit={handleInvite} className="mt-6 border-t border-[#252540] pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#8888a0] mb-1">
                  Invite by email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded-lg border border-[#252540] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e4e4f0] placeholder:text-[#555570] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8888a0] mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-lg border border-[#252540] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e4e4f0] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Invite
              </button>
            </div>
            {inviteMessage && (
              <p className="mt-2 text-xs text-[#8888a0]">{inviteMessage}</p>
            )}
          </form>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-xl border border-[#252540] bg-[#131320]">
        <div className="border-b border-[#252540] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#e4e4f0]">Account</h2>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Name</span>
            <span className="text-[#e4e4f0]">{user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Email</span>
            <span className="text-[#e4e4f0]">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Plan</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Free
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
