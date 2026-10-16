// Mirrors backend/app/schemas.py. Dates arrive as ISO strings.

export type Person = { id: number; name: string; first_name: string };

export type Child = { id: number; name: string; birth_date: string | null };

export type Family = {
  id: number;
  name: string;
  invite_code: string;
  time_zone: string;
  members: Person[];
  children: Child[];
};

export type User = { id: number; email: string; full_name: string; first_name: string };

export type Me = { user: User; family: Family | null };

export type AuthResponse = { access_token: string; token_type: string; me: Me };

export type EventStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export type HandoffEvent = {
  id: number;
  starts_at: string;
  location: string;
  note: string | null;
  status: EventStatus;
  to_parent: Person;
  created_by: Person;
  change: { starts_at: string; location: string; reason: string | null; by: Person; at: string } | null;
  checked_in_at: string | null;
  checked_in_by: Person | null;
  actions: {
    confirm: boolean;
    decline: boolean;
    cancel: boolean;
    propose_change: boolean;
    respond_change: boolean;
    check_in: boolean;
  };
};

export type ExpenseCategory = 'school' | 'health' | 'activities' | 'clothing' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'declined' | 'settled';

export type Expense = {
  id: number;
  title: string;
  category: ExpenseCategory;
  amount: number;
  payer_share: number;
  owed_amount: number;
  spent_on: string;
  status: ExpenseStatus;
  paid_by: Person;
  created_by: Person;
  debtor: Person | null;
  settled_at: string | null;
  created_at: string;
  actions: { approve: boolean; decline: boolean; settle: boolean; delete: boolean };
};

export type Balance = { amount: number; partner: Person | null };

export type ExpensesResponse = { balance: Balance; expenses: Expense[] };

export type Message = {
  id: number;
  body: string;
  tone: 'calm' | 'heated';
  is_urgent: boolean;
  created_at: string;
  read_at: string | null;
  sender: Person;
  mine: boolean;
};

export type ToneResult = { tone: 'calm' | 'heated'; flags: string[]; tip: string | null };

export type InfoCategory = 'health' | 'school' | 'contacts' | 'other';

export type InfoItem = {
  id: number;
  child_id: number;
  category: InfoCategory;
  label: string;
  value: string;
  updated_at: string;
  updated_by: Person | null;
};

export type RecordEntry = {
  id: number;
  seq: number;
  kind: string;
  summary: string;
  flagged: boolean;
  created_at: string;
  hash: string;
  actor: Person | null;
};

export type Verification = { valid: boolean; count: number; broken_seq: number | null; checked_at: string };

export type RecordResponse = {
  entries: RecordEntry[];
  count: number;
  flagged_count: number;
  verification: Verification;
};

export type Report = {
  family_name: string;
  time_zone: string;
  members: Person[];
  children: Child[];
  generated_at: string;
  verification: Verification;
  entries: RecordEntry[];
};

export type TemplateCategory = 'health' | 'schedule' | 'expenses' | 'check-in';

export type MessageTemplate = { id: number; category: TemplateCategory; body: string; created_at: string };

export type Counsellor = { id: number; name: string; title: string; focus: string; icon: string };

export type SessionType = 'individual' | 'co-parenting' | 'child';

export type SupportRequest = {
  id: number;
  counsellor: Counsellor;
  session_type: SessionType;
  preferred_time: string;
  note: string | null;
  status: string;
  created_at: string;
  requested_by: Person;
};

export type Home = {
  partner: Person | null;
  children: Child[];
  next_handoff: HandoffEvent | null;
  pending_events: HandoffEvent[];
  pending_expenses: Expense[];
  waiting_on_partner: number;
  unread_messages: number;
  balance: Balance;
  record_count: number;
};
