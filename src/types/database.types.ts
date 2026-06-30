export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Currency = 'AED' | 'PKR' | 'USD'
export type IncomeStatus = 'pending' | 'partial' | 'received' | 'cancelled'
export type IncomeType = 'gig' | 'short_contract' | 'long_contract' | 'gift' | 'other'
export type Ownership = 'ibrahim' | 'abu_bakar' | 'shared'
export type SadakaStatus = 'pending' | 'advance_given' | 'partially_given' | 'given'
export type LoanType = 'i_owe' | 'they_owe' | 'joint'
export type LoanCurrencyType = 'AED' | 'PKR' | 'USD' | 'gold_grams' | 'silver_grams'
export type LoanStatus = 'outstanding' | 'partial' | 'cleared'
export type GoalType = 'individual' | 'joint'
export type WasiyyaCategory = 'asset' | 'debt' | 'instruction' | 'password' | 'contact' | 'message'
export type LifeEventKind = 'milestone' | 'intention' | 'reminder'
export type LifeRecurrence = 'none' | 'monthly' | 'yearly' | 'hijri_yearly'
export type ExpenseCategory = 'rent' | 'utilities' | 'petrol' | 'food_out' | 'groceries' | 'vape' | 'sent_home' | 'health' | 'gift' | 'subscription' | 'business' | 'other'

export interface LifeEvent {
  id: string
  owner_id: string
  label: string
  event_date: string
  kind: LifeEventKind
  color: string
  recurrence: LifeRecurrence
  notes: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string | null
  sadaka_pct: number          // 0.20 = 20%
  default_currency: Currency
  nisab_basis: 'gold' | 'silver'
  enabled_modules: Record<string, boolean> | null
  hawl_start_date: string | null
  date_of_birth: string | null
  life_expectancy_years: number | null
  notify_income_received: boolean
  notify_ledger_update: boolean
  notify_sadaka_due: boolean
  notify_zakat_due: boolean
  created_at: string
  updated_at: string
}

export interface IncomeProject {
  id: string
  owner_id: string
  name: string
  type: IncomeType
  currency: Currency
  amount: number
  work_started_date: string | null
  work_completed_date: string | null
  expected_payment_date: string | null
  actual_received_date: string | null
  status: IncomeStatus
  ownership: Ownership
  is_ongoing: boolean
  notes: string | null
  sadaka_triggered: boolean
  created_at: string
  updated_at: string
}

export interface SadakaEntry {
  id: string
  owner_id: string
  source_income_id: string | null
  added_by_id: string | null
  shared: boolean
  amount_owed: number
  amount_given: number
  currency: Currency
  status: SadakaStatus
  is_advance: boolean
  is_joint: boolean
  joint_ibrahim_pct: number
  date_given: string | null
  recipient_name: string | null
  recipient_type: 'named_relative' | 'anonymous_needy' | 'masjid' | 'gift' | 'other' | null
  location: 'UAE' | 'Pakistan' | 'other' | null
  method: 'cash' | 'gift' | 'food' | 'bank_transfer' | 'other' | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BrotherLedgerEntry {
  id: string
  from_user_id: string
  to_user_id: string
  amount: number
  currency: 'AED' | 'PKR'
  category: 'bought_for_me' | 'paid_my_share' | 'project_expense' | 'joint_sadaka_contribution' | 'shared_cost' | 'salary_advance' | 'settlement' | 'other'
  description: string
  transaction_date: string
  source_type: 'manual' | 'shared_split' | 'joint_sadaka' | 'settlement'
  source_id: string | null
  is_settled: boolean
  settlement_id: string | null
  created_at: string
}

export interface LedgerSettlement {
  id: string
  settled_by_id: string
  currency: 'AED' | 'PKR'
  amount: number
  settlement_method: 'cash' | 'bank_transfer' | 'goods' | 'split_offset'
  settlement_date: string
  notes: string | null
  created_at: string
}

export interface ExternalLedgerEntry {
  id: string
  owner_id: string
  person_name: string
  contact_info: string | null
  direction: 'i_owe' | 'they_owe'
  amount: number
  currency: Currency
  description: string | null
  transaction_date: string
  status: LoanStatus
  amount_cleared: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Loan {
  id: string
  owner_id: string
  added_by_id: string | null
  counterparty_name: string
  loan_type: LoanType
  currency_type: LoanCurrencyType
  original_amount: number
  date_taken: string
  due_date: string | null
  status: LoanStatus
  joint_ibrahim_pct: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LoanRepayment {
  id: string
  loan_id: string
  paid_by_id: string
  amount: number
  payment_date: string
  notes: string | null
  created_at: string
}

export interface SharedCost {
  id: string
  created_by_id: string
  name: string
  category: string   // house | vehicle | gift | charity | investment | business | other | custom text
  total_amount: number
  currency: 'AED' | 'PKR'
  ibrahim_pct: number
  paid_by: 'ibrahim' | 'abu_bakar' | 'both'
  cost_date: string
  is_recurring: boolean
  recurring_day: number | null
  notes: string | null
  ledger_entry_created: boolean
  created_at: string
  updated_at: string
}

export interface ZakatSnapshot {
  id: string
  owner_id: string
  snapshot_year: string
  snapshot_date: string
  cash_aed: number
  cash_pkr: number
  cash_usd: number
  gold_grams: number
  silver_grams: number
  investments_aed: number
  crypto_aed: number
  business_assets_aed: number
  receivables_aed: number
  liabilities_aed: number
  gold_price_aed_per_gram: number | null
  silver_price_aed_per_gram: number | null
  pkr_to_aed_rate: number | null
  usd_to_aed_rate: number | null
  nisab_threshold_aed: number | null
  net_zakatable_wealth_aed: number | null
  zakat_due_aed: number | null
  is_wajib: boolean | null
  hawl_days_completed: number | null
  nisab_basis: 'gold' | 'silver' | null
  zakat_paid: boolean
  zakat_paid_date: string | null
  due_date: string | null
  notes: string | null
  created_at: string
}

export interface SadakaRecipient {
  id: string
  name: string
  relation: string | null
  location: string | null
  contact: string | null
  notes: string | null
  is_active: boolean
  created_by_id: string | null
  created_at: string
}

export interface JointAccount {
  id: string
  name: string
  bank_name: string | null
  currency: 'AED' | 'PKR'
  is_active: boolean
  created_by_id: string | null
  created_at: string
}

export interface Expense {
  id: string
  owner_id: string
  description: string
  category: string          // ExpenseCategory or custom text
  amount: number            // total paid out of pocket
  currency: 'AED' | 'PKR'
  expense_date: string
  is_shared: boolean
  my_pct: number            // owner's share (1.0 = all mine)
  ledger_entry_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface JointAccountTxn {
  id: string
  account_id: string
  txn_type: 'deposit' | 'withdrawal'
  contributor_id: string | null
  amount: number
  description: string | null
  category: string | null
  txn_date: string
  created_by_id: string | null
  created_at: string
}

export interface FinancialGoal {
  id: string
  owner_id: string | null
  goal_type: GoalType
  name: string
  target_amount: number
  currency: 'AED' | 'PKR'
  target_date: string | null
  contribution_method: 'manual' | 'auto_pct'
  auto_pct: number | null
  linked_project_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  contributor_id: string
  amount: number
  contribution_date: string
  source: 'manual' | 'auto_from_income' | 'linked_project'
  source_income_id: string | null
  notes: string | null
  created_at: string
}

export interface WasiyyaEntry {
  id: string
  owner_id: string
  category: WasiyyaCategory
  title: string
  description: string | null
  amount: number | null
  currency: Currency | null
  beneficiary_name: string | null
  beneficiary_contact: string | null
  is_sensitive: boolean
  created_at: string
  updated_at: string
}

export interface SavingsEntry {
  id: string
  owner_id: string
  account_name: string
  location: 'UAE' | 'Pakistan' | 'other'
  currency: 'AED' | 'PKR'
  txn_type: 'deposit' | 'withdrawal'
  amount: number
  entry_date: string
  notes: string | null
  created_at: string
}

export interface RatesCache {
  id: string
  rate_type: string
  rate_value: number
  source: string | null
  updated_at: string
}

// Supabase's GenericTable requires Row/Insert/Update to be Record<string, unknown>
// and a Relationships array. Our row types are `interface`s, which are NOT assignable
// to Record<string, unknown> (no implicit index signature) — that made every
// .select() infer as `never`. Loosen<T> re-maps the interface into a homomorphic
// mapped type, which IS Record-compatible, so the schema satisfies GenericSchema.
type Loosen<T> = { [K in keyof T]: T[K] }
type Tbl<T> = { Row: Loosen<T>; Insert: Partial<Loosen<T>>; Update: Partial<Loosen<T>>; Relationships: [] }

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: Tbl<Profile>
      income_projects: Tbl<IncomeProject>
      sadaka_entries: Tbl<SadakaEntry>
      brother_ledger: Tbl<BrotherLedgerEntry>
      ledger_settlements: Tbl<LedgerSettlement>
      external_ledger: Tbl<ExternalLedgerEntry>
      loans: Tbl<Loan>
      loan_repayments: Tbl<LoanRepayment>
      shared_costs: Tbl<SharedCost>
      zakat_snapshots: Tbl<ZakatSnapshot>
      financial_goals: Tbl<FinancialGoal>
      goal_contributions: Tbl<GoalContribution>
      wasiyya_entries: Tbl<WasiyyaEntry>
      savings_entries: Tbl<SavingsEntry>
      rates_cache: Tbl<RatesCache>
      sadaka_recipients: Tbl<SadakaRecipient>
      joint_accounts: Tbl<JointAccount>
      joint_account_txns: Tbl<JointAccountTxn>
      life_events: Tbl<LifeEvent>
      expenses: Tbl<Expense>
    }
  }
}
