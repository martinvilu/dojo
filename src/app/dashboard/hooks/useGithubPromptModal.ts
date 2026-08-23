"use client";

import { useState } from "react";

export interface GithubPromptModalState {
  isOpen: boolean;
  resolve: (username: string | null) => void;
}

/**
 * Promise-based GitHub username prompt used by the LTI auto-enroll flow.
 * Resolves with the entered username or null when dismissed.
 */
export function useGithubPromptModal() {
  const [githubPromptModal, setGithubPromptModal] = useState<GithubPromptModalState | null>(null);

  const promptGithubUsername = () =>
    new Promise<string | null>((resolve) => {
      setGithubPromptModal({ isOpen: true, resolve });
    });

  return { githubPromptModal, setGithubPromptModal, promptGithubUsername };
}
