import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/Toast';
import { useAuth } from './auth';
import { api } from './api';
import type {
  Counsellor,
  ExpensesResponse,
  Family,
  HandoffEvent,
  Home,
  InfoItem,
  Message,
  MessageTemplate,
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
  record: (flagged: boolean) => ['record', flagged] as const,
  family: ['family'] as const,
  counsellors: ['counsellors'] as const,
  supportRequests: ['support-requests'] as const,
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

export function useRecord(flagged: boolean) {
  return useQuery({
    queryKey: keys.record(flagged),
    queryFn: () => api<RecordResponse>(`/record${flagged ? '?flagged=true' : ''}`),
  });
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
