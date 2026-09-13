export interface GitHubCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
  author_login: string;
  author_avatar: string;
  branch: string;
  url?: string;
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "all";
  url?: string;
  user?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GitHubComment {
  author: string;
  created_at: string;
  body: string;
  url?: string;
}

export interface GitHubActivity {
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  comments: GitHubComment[];
}

export interface GitHubStudentActivity {
  student_id: string;
  github_user: string;
  repo_name?: string;
  total_commits: number;
  last_commit_date?: string;
  pull_requests_count: number;
  activity: GitHubActivity;
}
