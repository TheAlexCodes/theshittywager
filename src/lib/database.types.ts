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
          is_administrator: boolean
          bankroll: number
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          display_name: string
          is_commissioner?: boolean | null
          is_administrator?: boolean
          bankroll?: number
          created_at?: string | null
        }
        Update: {
          email?: string
          display_name?: string
          is_administrator?: boolean
        }
        Relationships: []
      }
      leagues: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leagues_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          league_id: string
          user_id: string
          bankroll: number
          is_commissioner: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          bankroll?: number
          is_commissioner?: boolean
          joined_at?: string
        }
        Update: {
          bankroll?: number
          is_commissioner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'league_members_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      league_invites: {
        Row: {
          id: string
          league_id: string
          token: string
          created_by: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          token?: string
          created_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'league_invites_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      league_settings: {
        Row: {
          league_id: string
          weekly_allowance: number
          futures_allowance: number
          playoff_allowance: number
          season_year: number
          futures_opens_at: string | null
          futures_closes_at: string | null
          updated_at: string
        }
        Insert: {
          league_id: string
          weekly_allowance?: number
          futures_allowance?: number
          playoff_allowance?: number
          season_year?: number
          futures_opens_at?: string | null
          futures_closes_at?: string | null
          updated_at?: string
        }
        Update: {
          weekly_allowance?: number
          futures_allowance?: number
          playoff_allowance?: number
          season_year?: number
          futures_opens_at?: string | null
          futures_closes_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_settings_league_id_fkey'
            columns: ['league_id']
            isOneToOne: true
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
        ]
      }
      weeks: {
        Row: {
          id: number
          league_id: string
          week_number: number
          phase: WeekPhase
          allowance: number
          reveal_at: string
        }
        Insert: {
          id?: number
          league_id: string
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
        Relationships: [
          {
            foreignKeyName: 'weeks_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
        ]
      }
      bets: {
        Row: {
          id: number
          league_id: string
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
          league_id: string
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
        Relationships: [
          {
            foreignKeyName: 'bets_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bets_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      futures: {
        Row: {
          id: number
          league_id: string
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
          league_id: string
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
        Relationships: [
          {
            foreignKeyName: 'futures_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'futures_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      standings: {
        Row: {
          league_id: string
          player_id: string
          display_name: string
          bankroll: number
          is_commissioner: boolean
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
        Args: { p_league_id: string }
        Returns: number
      }
      futures_is_locked: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      is_commissioner: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_administrator: {
        Args: Record<string, never>
        Returns: boolean
      }
      can_access_league: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      is_league_commissioner: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      claim_profile_by_email: {
        Args: Record<string, never>
        Returns: Profile
      }
      apply_league_allowances: {
        Args: { p_league_id?: string }
        Returns: undefined
      }
      create_league: {
        Args: { p_name: string }
        Returns: string
      }
      join_league_by_invite: {
        Args: { p_token: string }
        Returns: string
      }
      create_league_invite: {
        Args: { p_league_id: string }
        Returns: string
      }
      delete_league: {
        Args: { p_league_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type League = Database['public']['Tables']['leagues']['Row']
export type LeagueMember = Database['public']['Tables']['league_members']['Row']
export type LeagueInvite = Database['public']['Tables']['league_invites']['Row']
export type LeagueSettings = Database['public']['Tables']['league_settings']['Row']
export type Week = Database['public']['Tables']['weeks']['Row']
export type Bet = Database['public']['Tables']['bets']['Row']
export type Future = Database['public']['Tables']['futures']['Row']
export type Standing = Database['public']['Views']['standings']['Row']
