import { Avatar } from "./Avatar";

interface MemberListProps {
  members: Array<{ guest: { id: string; name: string; avatar: string } }>;
  currentGuestId: string;
}

export function MemberList({ members, currentGuestId }: MemberListProps) {
  if (!members.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Active Members ({members.length}/5)
      </h3>
      <div className="flex flex-wrap gap-3">
        {members.map((member) => (
          <div key={member.guest.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Avatar avatar={member.guest.avatar} name={member.guest.name} size="sm" />
            <span className="text-sm font-medium text-gray-900">
              {member.guest.name}
              {member.guest.id === currentGuestId && (
                <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">You</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}