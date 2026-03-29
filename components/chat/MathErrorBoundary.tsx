"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** The raw (pre-render) string being rendered — used as fallback text and
   *  to reset the error state when the content changes (e.g. next stream
   *  chunk arrives with a corrected delimiter). */
  rawContent: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches KaTeX parse errors thrown during react-markdown rendering so that
 * a malformed LaTeX expression from the LLM does not crash the entire message
 * bubble. On error the raw string is shown in a styled <code> block instead.
 *
 * The boundary resets automatically whenever `rawContent` changes, which
 * means a subsequent stream chunk that completes the LaTeX expression will
 * re-attempt rendering without requiring a page reload.
 */
export class MathErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props): void {
    // If the content changed (new chunk arrived) and we were in an error
    // state, optimistically retry — the new content may be valid LaTeX.
    if (prevProps.rawContent !== this.props.rawContent && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <code className="block font-mono text-sm bg-[#F9FAFB] dark:bg-[#0F1117] px-2 py-1 rounded text-[#EF4444] dark:text-[#F87171] whitespace-pre-wrap break-all">
          {this.props.rawContent}
        </code>
      );
    }
    return this.props.children;
  }
}
