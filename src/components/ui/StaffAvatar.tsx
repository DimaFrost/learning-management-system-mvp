function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

export function StaffAvatar({
  name,
  avatarUrl,
  role,
}: {
  name: string;
  avatarUrl: string | null;
  role: string;
}) {
  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] shadow-[0_0_0_1px_rgba(229,229,229,0.9)]"
      title={`${role}: ${name}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
