import type { TeamMember } from '../types';

const DEPARTMENTS: TeamMember['department'][] = [
  'Executive Council',
  'Technical Team',
  'Design & Content',
  'Event Management',
  'Photography',
  'PR & Outreach',
  'Social Media',
];

const POSITIONS: TeamMember['position'][] = [
  'President',
  'Vice President',
  'Secretary',
  'Student Coordinator',
  'Lead',
  'Co-Lead',
  'Core Member',
];

export function mapPublishedTeamMember(id: string, raw: Record<string, unknown>): TeamMember | null {
  const name = String(raw.name || '').trim();
  const department = String(raw.department || '') as TeamMember['department'];
  if (!name || !DEPARTMENTS.includes(department)) return null;

  const submittedPosition = String(raw.position || '') as TeamMember['position'];
  const position = POSITIONS.includes(submittedPosition) ? submittedPosition : 'Core Member';
  const rawSocialLinks = raw.socialLinks && typeof raw.socialLinks === 'object'
    ? raw.socialLinks as Record<string, unknown>
    : {};

  return {
    id,
    name,
    initials: name.split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase(),
    department,
    displayGroup: String(raw.displayGroup || department),
    position,
    roleTag: position.toUpperCase(),
    roleBg: 'bg-brand-orange text-white',
    avatarBg: 'bg-brand-cyan',
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : undefined,
    textColor: 'text-primary',
    specialty: String(raw.specialty || ''),
    quote: String(raw.quote || ''),
    handle: String(raw.handle || ''),
    socialLinks: {
      linkedin: typeof rawSocialLinks.linkedin === 'string' ? rawSocialLinks.linkedin : undefined,
    },
  };
}

// Published profiles come from Firestore; there is no bundled sample roster.
export const TEAM_MEMBERS: TeamMember[] = [];
