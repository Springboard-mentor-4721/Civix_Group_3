export interface PollOptionResult {
  option: string;
  count: number;
  percentage: number;
}

export interface Poll {
  id: number;
  title: string;
  description: string;
  options: string[];
  target_location: string;
  status: 'active' | 'closed';
  closes_on: string;
  created_at: string;
  created_by?: number;

  results?: PollOptionResult[];
  total_votes?: number;
  has_voted?: boolean;
  my_selected_option?: string | null;

  vote_count?: number;
}
