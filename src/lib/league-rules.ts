export const RULES_STORAGE_KEY = 'tsw_rules_intro_seen'

export interface RuleSection {
  title: string
  body: string
}

export const LEAGUE_RULES: RuleSection[] = [
  {
    title: 'What is this?',
    body: 'The Shitty Wager is a season-long NFL betting league using play money. Track fake wagers, climb the standings, and talk trash until Conference Championship weekend.',
  },
  {
    title: 'How seasons work',
    body: 'Each league runs on its own schedule. The commissioner syncs NFL weeks from ESPN and sets budget amounts. You join a league via invite link or create your own.',
  },
  {
    title: 'Futures (pre-season)',
    body: 'Before Week 1 kicks off, each player gets a futures budget (default $300) to spread across season-long bets — MVP, Super Bowl winner, etc. Unused futures money is lost when the regular season opens.',
  },
  {
    title: 'Regular season',
    body: 'Each week you receive a fresh allowance (default $100). Use it or lose it — unspent weekly money does not roll over. Place bets on spreads, totals, moneylines, or props using American odds.',
  },
  {
    title: 'Playoffs',
    body: 'Playoff rounds use a higher weekly allowance (default $200), still use-it-or-lose-it. Wild Card through Conference Championships count toward the league winner.',
  },
  {
    title: 'Winning & settlement',
    body: 'The player with the most play money after Conference Championship weekend wins the league. The commissioner settles all bets. Super Bowl wagers are handled outside the app with real money among the group.',
  },
  {
    title: 'Your team',
    body: 'Pick a team name on your profile. Standings show bankroll totals updated automatically when the commissioner marks bets won, lost, pushed, or void.',
  },
]
