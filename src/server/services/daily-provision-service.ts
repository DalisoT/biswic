/**
 * Daily provision service.
 * ----------------------------------------------------------------------------
 * Writes the day's provision for members: one notification each, carrying
 * the financial quote of the day, one line from the literacy hub and the
 * member's next unfinished lesson.
 *
 * There is no scheduler on this platform, so the provision is written on
 * demand:
 *
 *   - every member gets their own the moment they open the platform, and
 *   - an officer or the platform owner opening the dashboard writes it for
 *     everybody at once, so the bell lights up for the whole cooperative.
 *
 * Either way it is written once per member per day. The notification link
 * carries the date, so an existing row with that link is left alone and the
 * provision can be run as often as the page is opened.
 */

import { prisma } from '@/lib/db';
import {
  buildProvisionBody,
  provisionDateKey,
  selectProvision,
  type ProvisionModule,
  type ProvisionReminder,
  type ProvisionSelection,
} from '@/lib/daily-provision';

export const PROVISION_NOTIFICATION_TYPE = 'DAILY_PROVISION';
export const PROVISION_PATH = '/provision';

export interface ProvisionModuleRow {
  id: string;
  slug: string;
  title: string;
  content: string;
  audience: string[];
  lessons: { id: string; title: string; content: string; order: number }[];
}

/**
 * The link a provision notification carries. The date in it is what makes the
 * row unique per member per day.
 */
export function provisionLink(key: string): string {
  return PROVISION_PATH + '?date=' + key;
}

export async function loadPublishedModules(): Promise<ProvisionModuleRow[]> {
  return prisma.learningModule.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      audience: true,
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, content: true, order: true },
      },
    },
  });
}

function toProvisionModule(row: ProvisionModuleRow): ProvisionModule {
  return {
    title: row.title,
    slug: row.slug,
    content: row.content,
    lessons: row.lessons.map((lesson) => ({ title: lesson.title, content: lesson.content })),
  };
}

/**
 * A module is visible to a member when its audience is empty, when it names
 * their role, or when they hold the platform-wide admin override.
 */
function isAudienceMatch(audience: string[], role: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (audience.length === 0) return true;
  return audience.includes(role);
}

/**
 * The first lesson this member has not finished, in module order.
 */
export function nextUnfinishedLesson(
  modules: ProvisionModuleRow[],
  completed: Set<string>,
  role: string,
  isAdmin: boolean,
): ProvisionReminder | null {
  for (const mod of modules) {
    if (!isAudienceMatch(mod.audience, role, isAdmin)) continue;
    for (const lesson of mod.lessons) {
      if (completed.has(lesson.id)) continue;
      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: mod.title,
        moduleSlug: mod.slug,
      };
    }
  }
  return null;
}

async function completedLessonIds(
  userId: string,
  modules: ProvisionModuleRow[],
): Promise<Set<string>> {
  const lessonIds = modules.flatMap((mod) => mod.lessons.map((lesson) => lesson.id));
  if (lessonIds.length === 0) return new Set<string>();
  const rows = await prisma.lessonProgress.findMany({
    where: { userId: userId, lessonId: { in: lessonIds } },
    select: { lessonId: true },
  });
  return new Set<string>(rows.map((row) => row.lessonId));
}

/**
 * Today's provision for one member, whether or not it has been written yet.
 */
export async function getProvisionForUser(userId: string): Promise<{
  key: string;
  selection: ProvisionSelection;
  reminder: ProvisionReminder | null;
}> {
  const key = provisionDateKey();
  const modules = await loadPublishedModules();
  const selection = selectProvision(key, modules.map(toProvisionModule));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isAdmin: true },
  });
  const completed = await completedLessonIds(userId, modules);
  const reminder = user
    ? nextUnfinishedLesson(modules, completed, user.role, user.isAdmin)
    : null;
  return { key: key, selection: selection, reminder: reminder };
}

/**
 * Write today's provision for one member. Returns false when it was already
 * written today.
 */
export async function ensureDailyProvisionForUser(userId: string): Promise<boolean> {
  const key = provisionDateKey();
  const link = provisionLink(key);

  const existing = await prisma.notification.findFirst({
    where: { userId: userId, type: PROVISION_NOTIFICATION_TYPE, link: link },
    select: { id: true },
  });
  if (existing) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isAdmin: true },
  });
  if (!user) return false;

  const modules = await loadPublishedModules();
  const selection = selectProvision(key, modules.map(toProvisionModule));
  const completed = await completedLessonIds(userId, modules);
  const reminder = nextUnfinishedLesson(modules, completed, user.role, user.isAdmin);

  await prisma.notification.create({
    data: {
      userId: userId,
      type: PROVISION_NOTIFICATION_TYPE,
      title: "Today's provision",
      body: buildProvisionBody(selection, reminder),
      link: link,
    },
  });
  return true;
}

/**
 * Write today's provision for every active member who does not have it yet.
 * Returns how many were written.
 */
export async function ensureDailyProvisionForAll(): Promise<number> {
  const key = provisionDateKey();
  const link = provisionLink(key);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, isAdmin: true },
  });
  if (users.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: { type: PROVISION_NOTIFICATION_TYPE, link: link },
    select: { userId: true },
  });
  const already = new Set<string>(existing.map((row) => row.userId));
  const pending = users.filter((user) => !already.has(user.id));
  if (pending.length === 0) return 0;

  const modules = await loadPublishedModules();
  const selection = selectProvision(key, modules.map(toProvisionModule));

  const lessonIds = modules.flatMap((mod) => mod.lessons.map((lesson) => lesson.id));
  const progressRows = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: {
          userId: { in: pending.map((user) => user.id) },
          lessonId: { in: lessonIds },
        },
        select: { userId: true, lessonId: true },
      })
    : [];

  const byUser = new Map<string, Set<string>>();
  for (const row of progressRows) {
    const set = byUser.get(row.userId);
    if (set) set.add(row.lessonId);
    else byUser.set(row.userId, new Set<string>([row.lessonId]));
  }

  await prisma.notification.createMany({
    data: pending.map((user) => ({
      userId: user.id,
      type: PROVISION_NOTIFICATION_TYPE,
      title: "Today's provision",
      body: buildProvisionBody(
        selection,
        nextUnfinishedLesson(
          modules,
          byUser.get(user.id) ?? new Set<string>(),
          user.role,
          user.isAdmin,
        ),
      ),
      link: link,
    })),
  });
  return pending.length;
}
