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

export interface Profile {
  id: string
  email: string
  display_name: string | null
  sadaka_pct: number          // 0.20 = 20%
  default_currency: Currency
  hawl_start_date: string | null
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
  work_completed_date: string
  expected_payment_date: string | null
  actual_received_date: string | null
  status: IncomeStatus
  ownership: Ownership
  notes: string | null
  sadaka_triggered: boolean
  created_at: string
  updated_at: string
}

export interface SadakaEntry {
  id: string
  owner_id: string
  source_income_id: string | null
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
  category: 'house' | 'vehicle' | 'gift' | 'charity' | 'investment' | 'business' | 'other'
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
  notes: string | null
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

export interface RatesCache {
  id: string
  rate_type: string
  rate_value: number
  source: string | null
  updated_at: string
}

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      income_projects: { Row: IncomeProject; Insert: Partial<IncomeProject>; Update: Partial<IncomeProject> }
      sadaka_entries: { Row: SadakaEntry; Insert: Partial<SadakaEntry>; Update: Partial<SadakaEntry> }
      brother_ledger: { Row: BrotherLedgerEntry; Insert: Partial<BrotherLedgerEntry>; Update: Partial<BrotherLedgerEntry> }
      ledger_settlements: { Row: LedgerSettlement; Insert: Partial<LedgerSettlement>; Update: Partial<LedgerSettlement> }
      external_ledger: { Row: ExternalLedgerEntry; Insert: Partial<ExternalLedgerEntry>; Update: Partial<ExternalLedgerEntry> }
      loans: { Row: Loan; Insert: Partial<Loan>; Update: Partial<Loan> }
      loan_repayments: { Row: LoanRepayment; Insert: Partial<LoanRepayment>; Update: Partial<LoanRepayment> }
      shared_costs: { Row: SharedCost; Insert: Partial<SharedCost>; Update: Partial<SharedCost> }
      zakat_snapshots: { Row: ZakatSnapshot; Insert: Partial<ZakatSnapshot>; Update: Partial<ZakatSnapshot> }
      financial_goals: { Row: FinancialGoal; Insert: Partial<FinancialGoal>; Update: Partial<FinancialGoal> }
      goal_contributions: { Row: GoalContribution; Insert: Partial<GoalContribution>; Update: Partial<GoalContribution> }
      wasiyya_entries: { Row: WasiyyaEntry; Insert: Partial<WasiyyaEntry>; Update: Partial<WasiyyaEntry> }
      rates_cache: { Row: RatesCache; Insert: Partial<RatesCache>; Update: Partial<RatesCache> }
    }
  }
}
