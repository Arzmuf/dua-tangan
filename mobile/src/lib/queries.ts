import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/Toast';
import { useAuth } from './auth';
import { api } from './api';
import type {
  AdminBooking,
  AdminProgram,
  AdminStats,
  AdminUser,
  Booking,
  Counsellor,
  ExpensesResponse,
  Family,
  FamilyDocument,
  HandoffEvent,
  Home,
  InfoItem,
  Message,
  MessageTemplate,
  Program,
  RecordResponse,
  SupportRequest,
} from './types';

export const keys = {
  home: ['home'] as const,
  events: ['events'] as const,
  expenses: ['expenses'] as const,
  messages: ['messages'] as const,
  templates: ['templates'] as const,
  info: (childId: number) => ['info', childId] as const,
  record: (kinds: string, flagged: boolean) => ['record', kinds, flagged] as const,
  documents: ['documents'] as const,
  family: ['family'] as const,
  counsellors: ['counsellors'] as const,
  supportRequests: ['support-requests'] as const,
  programs: ['programs'] as const,
  program: (id: number) => ['programs', id] as const,
  bookings: ['bookings'] as const,
  admin: ['admin'] as const,
};

/** Queries that need a family only run once the signed-in parent has one. */
function useHasFamily() {
  const { me } = useAuth();
  return !!me?.family;
}

export function useHome() {
  const enabled = useHasFamily();
  return useQuery({ queryKey: keys.home, queryFn: () => api<Home>('/home'), enabled, refetchInterval: 15_000 });
}

export function useEvents() {
  return useQuery({ queryKey: keys.events, queryFn: () => api<HandoffEvent[]>('/events') });
}

export function useExpenses() {
  return useQuery({ queryKey: keys.expenses, queryFn: () => api<ExpensesResponse>('/expenses') });
}

export function useMessages(polling: boolean) {
  return useQuery({
    queryKey: keys.messages,
    queryFn: () => api<Message[]>('/messages'),
    refetchInterval: polling ? 4_000 : false,
  });
}

export function useTemplates() {
  return useQuery({ queryKey: keys.templates, queryFn: () => api<MessageTemplate[]>('/messages/templates') });
}

export function useInfo(childId: number | undefined) {
  return useQuery({
    queryKey: keys.info(childId ?? 0),
    queryFn: () => api<InfoItem[]>(`/children/${childId}/info`),
    enabled: !!childId,
  });
}

/** The info bank's sealed entries, optionally only some kinds (e.g. message and expense). */
export function useRecord(kinds: string[] = [], flagged = false) {
  const filter = kinds.join(',');
  const query = [filter && `kinds=${filter}`, flagged && 'flagged=true'].filter(Boolean).join('&');
  return useQuery({
    queryKey: keys.record(filter, flagged),
    queryFn: () => api<RecordResponse>(`/record${query ? `?${query}` : ''}`),
  });
}

export function useDocuments() {
  return useQuery({ queryKey: keys.documents, queryFn: () => api<FamilyDocument[]>('/documents') });
}

export function useFamily() {
  return useQuery({ queryKey: keys.family, queryFn: () => api<Family>('/family') });
}

export function useCounsellors() {
  return useQuery({
    queryKey: keys.counsellors,
    queryFn: () => api<Counsellor[]>('/support/counsellors'),
    staleTime: 5 * 60_000,
  });
}

export function useSupportRequests() {
  return useQuery({ queryKey: keys.supportRequests, queryFn: () => api<SupportRequest[]>('/support/requests') });
}

export function usePrograms() {
  return useQuery({ queryKey: keys.programs, queryFn: () => api<Program[]>('/programs') });
}

export function useProgram(id: number) {
  return useQuery({ queryKey: keys.program(id), queryFn: () => api<Program>(`/programs/${id}`) });
}

export function useBookings() {
  return useQuery({ queryKey: keys.bookings, queryFn: () => api<Booking[]>('/bookings') });
}

// Admin data shares the ['admin'] key prefix, so one invalidation refreshes all of it.
export function useAdminStats() {
  return useQuery({ queryKey: [...keys.admin, 'stats'], queryFn: () => api<AdminStats>('/admin/stats') });
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: [...keys.admin, 'users', search],
    queryFn: () => api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(search)}`),
  });
}

export function useAdminPrograms() {
  return useQuery({ queryKey: [...keys.admin, 'programs'], queryFn: () => api<AdminProgram[]>('/admin/programs') });
}

export function useAdminProgram(id: number | null) {
  return useQuery({
    queryKey: [...keys.admin, 'programs', id],
    queryFn: () => api<AdminProgram>(`/admin/programs/${id}`),
    enabled: id !== null,
  });
}

export function useAdminBookings(programId: number | null) {
  return useQuery({
    queryKey: [...keys.admin, 'bookings', programId],
    queryFn: () => api<AdminBooking[]>(`/admin/programs/${programId}/bookings`),
    enabled: programId !== null,
  });
}

/**
 * Wraps a write: on success every visible query refetches (one action can change the home
 * screen, the schedule and the record at once) and an optional toast confirms it.
 */
export function useAction<TVars = void, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  options: { success?: string | ((result: TResult, vars: TVars) => string); onDone?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      void queryClient.invalidateQueries();
      const message = typeof options.success === 'function' ? options.success(result, vars) : options.success;
      if (message) toast.show(message);
      options.onDone?.(result);
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });
}
