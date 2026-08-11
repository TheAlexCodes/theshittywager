export type WeekPhase = 'futures' | 'regular' | 'playoff'
export type BetStatus = 'pending' | 'won' | 'lost' | 'push' | 'void'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          is_commissioner: boolean | null
          bankroll: number
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          display_name: string
          is_commissioner?: boolean | null
          bankroll?: number
          created_at?: string | null
        }
        Update: {
          email?: string
          display_name?: string
          is_commissioner?: boolean | null
          bankroll?: number
        }
        Relationships: []
      }
      league_settings: {
        Row: {
          id: number
          weekly_allowance: number
          futures_allowance: number
          playoff_allowance: number
          season_year: number
          updated_at: string
        }
        Insert: {
          id?: number
          weekly_allowance?: number
          futures_allowance?: number
          playoff_allowance?: number
          season_year?: number
          updated_at?: string
        }
        Update: {
          weekly_allowance?: number
          futures_allowance?: number
          playoff_allowance?: number
          season_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          id: number
          week_number: number
          phase: WeekPhase
          allowance: number
          reveal_at: string
        }
        Insert: {
          id?: number
          week_number: number
          phase: WeekPhase
          allowance: number
          reveal_at: string
        }
        Update: {
          week_number?: number
          phase?: WeekPhase
          allowance?: number
          reveal_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          id: number
          player_id: string
          week_id: number | null
          bet_type: string | null
          selection: string | null
          stake: number | null
          american_odds: number | null
          status: BetStatus | null
          payout: number | null
          settled_at: string | null
          settled_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          player_id: string
          week_id?: number | null
          bet_type?: string | null
          selection?: string | null
          stake?: number | null
          american_odds?: number | null
          status?: BetStatus | null
          payout?: number | null
          settled_at?: string | null
          settled_by?: string | null
          created_at?: string | null
        }
        Update: {
          bet_type?: string | null
          selection?: string | null
          stake?: number | null
          american_odds?: number | null
          status?: BetStatus | null
          payout?: number | null
          settled_at?: string | null
          settled_by?: string | null
        }
        Relationships: []
      }
      futures: {
        Row: {
          id: number
          player_id: string
          category: string | null
          selection: string | null
          stake: number | null
          american_odds: number | null
          status: BetStatus | null
          payout: number | null
          settled_at: string | null
          settled_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          player_id: string
          category?: string | null
          selection?: string | null
          stake?: number | null
          american_odds?: number | null
          status?: BetStatus | null
          payout?: number | null
          settled_at?: string | null
          settled_by?: string | null
          created_at?: string | null
        }
        Update: {
          category?: string | null
          selection?: string | null
          stake?: number | null
          american_odds?: number | null
          status?: BetStatus | null
          payout?: number | null
          settled_at?: string | null
          settled_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      standings: {
        Row: {
          player_id: string
          display_name: string
          bankroll: number
          is_commissioner: boolean | null
          standing_rank: number
        }
        Relationships: []
      }
    }
    Functions: {
      american_odds_profit: {
        Args: { p_stake: number; p_odds: number }
        Returns: number
      }
      futures_allowance: {
        Args: Record<string, never>
        Returns: number
      }
      futures_is_locked: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_commissioner: {
        Args: Record<string, never>
        Returns: boolean
      }
      claim_profile_by_email: {
        Args: Record<string, never>
        Returns: Profile
      }
      apply_league_allowances: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type LeagueSettings = Database['public']['Tables']['league_settings']['Row']
export type Week = Database['public']['Tables']['weeks']['Row']
export type Bet = Database['public']['Tables']['bets']['Row']
export type Future = Database['public']['Tables']['futures']['Row']
export type Standing = Database['public']['Views']['standings']['Row']
