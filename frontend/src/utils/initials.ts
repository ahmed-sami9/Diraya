// "Omar Adel" -> "OA", "Salma" -> "S". Shown in the round avatar next to a
// student's name.
export const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
