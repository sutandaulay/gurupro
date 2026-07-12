import { getPayload } from "./payload";
import { normalizePhoneNumber, normalizeEmail } from "./performance-share";
import { COLLECTIONS } from "@/collections/config";

export interface TeacherGroup {
  teacherId: string;
  teacherName?: string;
  shareLinks: Array<{
    id: string;
    token: string;
    accessLevel: string;
    createdAt: string;
  }>;
  aggregatedStats?: Record<string, unknown>;
}

export interface SharedLeaderInfo {
  phoneNumber?: string;
  email?: string;
  teachers: TeacherGroup[];
  teacherCount: number;
  hasMultipleTeachers: boolean;
}

/**
 * Detect if a leader contact has been shared by multiple teachers
 * Uses normalized phone number or email for matching
 */
export async function detectSharedLeader(
  phoneNumber?: string | null,
  email?: string | null
): Promise<SharedLeaderInfo | null> {
  if (!phoneNumber && !email) {
    return null;
  }

  const payload = await getPayload();

  const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
  const normalizedEmail = email ? normalizeEmail(email) : null;

  const orConditions: Record<string, unknown>[] = [];
  if (normalizedPhone) {
    orConditions.push({ phoneNumber: { equals: normalizedPhone } });
  }
  if (normalizedEmail) {
    orConditions.push({ email: { equals: normalizedEmail } });
  }

  if (orConditions.length === 0) {
    return null;
  }

  const leaderContacts = await payload.find({
    collection: COLLECTIONS.LEADER_CONTACTS,
    where: {
      or: orConditions,
    },
    limit: 100,
  });

  const teacherIds = [...new Set(leaderContacts.docs.map((c) => c.teacherId))];

  if (teacherIds.length < 2) {
    return null;
  }

  const teacherGroups: TeacherGroup[] = [];

  for (const teacherId of teacherIds) {
    const shareLinks = await payload.find({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      where: {
        teacherId: { equals: teacherId },
      },
      limit: 10,
    });

    const teacherGroupsData = await getTeacherInfo(teacherId);

    teacherGroups.push({
      teacherId,
      ...teacherGroupsData,
      shareLinks: shareLinks.docs.map((link) => ({
        id: link.id as string,
        token: link.shareToken as string,
        accessLevel: link.accessLevel as string,
        createdAt: link.createdAt as string,
        aggregatedStats: link.aggregatedStats as Record<string, unknown> | undefined,
      })),
    });
  }

  return {
    phoneNumber: normalizedPhone || undefined,
    email: normalizedEmail || undefined,
    teachers: teacherGroups,
    teacherCount: teacherGroups.length,
    hasMultipleTeachers: teacherGroups.length >= 2,
  };
}

/**
 * Get basic teacher info for display
 */
async function getTeacherInfo(
  teacherId: string
): Promise<Pick<TeacherGroup, "teacherName">> {
  try {
    const payload = await getPayload();
    const user = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: teacherId,
    });
    return {
      teacherName: (user as unknown as { teacherId?: string })?.teacherId || teacherId,
    };
  } catch {
    return { teacherName: undefined };
  }
}

/**
 * Get all teachers sharing to the same contact (for directory view)
 */
export async function getTeachersSharingContact(
  phoneNumber?: string | null,
  email?: string | null,
  excludeTeacherId?: string
): Promise<TeacherGroup[]> {
  const sharedInfo = await detectSharedLeader(phoneNumber, email);

  if (!sharedInfo) {
    return [];
  }

  if (excludeTeacherId) {
    return sharedInfo.teachers.filter((t) => t.teacherId !== excludeTeacherId);
  }

  return sharedInfo.teachers;
}

/**
 * Count how many teachers share a contact
 */
export async function countSharedTeachers(
  phoneNumber?: string | null,
  email?: string | null
): Promise<number> {
  const sharedInfo = await detectSharedLeader(phoneNumber, email);
  return sharedInfo?.teacherCount || 0;
}
