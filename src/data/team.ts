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
  'Treasurer',
  'Student Coordinator',
  'Lead',
  'Co-Lead',
  'Core Member',
];

const POSITION_ORDER: TeamMember['position'][] = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Student Coordinator',
  'Lead',
  'Co-Lead',
  'Core Member',
];

export function sortTeamMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
}

export function getTeamPhotoUrl(photoUrl?: unknown, photoDriveId?: unknown): string | undefined {
  const url = typeof photoUrl === 'string' ? photoUrl.trim() : '';
  const driveId = typeof photoDriveId === 'string' ? photoDriveId.trim() : '';
  const urlDriveId = url.match(/drive\.google\.com\/(?:file\/d\/|thumbnail\?id=|uc\?[^#]*id=)([^&/?]+)/i)?.[1];
  const id = driveId || urlDriveId;
  if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
  return url || undefined;
}

function getInstagramUsername(value: unknown): string | undefined {
  let input = typeof value === 'string' ? value.trim() : '';
  if (!input) return undefined;

  if (/^https?:\/\//i.test(input) || /instagram\.com\//i.test(input)) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname.toLowerCase())) return undefined;
      input = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return undefined;
    }
  }

  const username = input.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(username) && !username.startsWith('.') && !username.endsWith('.')
    ? username
    : undefined;
}

export function getInstagramUrl(value: unknown): string | undefined {
  const username = getInstagramUsername(value);
  return username ? `https://www.instagram.com/${encodeURIComponent(username)}/` : undefined;
}

export function formatInstagramHandle(value: unknown): string {
  const username = getInstagramUsername(value);
  if (username) return `@${username}`;
  return typeof value === 'string' ? value.trim() : '';
}

function getLinkedInUrl(value: unknown): string | undefined {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return undefined;
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const isLinkedInHost = parsed.hostname === 'linkedin.com' || parsed.hostname.endsWith('.linkedin.com');
    return ['http:', 'https:'].includes(parsed.protocol) && isLinkedInHost ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

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
    photoUrl: getTeamPhotoUrl(raw.photoUrl, raw.photoDriveId),
    textColor: 'text-primary',
    specialty: String(raw.specialty || ''),
    quote: String(raw.quote || ''),
    handle: String(raw.handle || ''),
    socialLinks: {
      linkedin: getLinkedInUrl(rawSocialLinks.linkedin),
    },
  };
}

// Published profiles come from Firestore; there is no bundled sample roster.
export const TEAM_MEMBERS: TeamMember[] = [];
