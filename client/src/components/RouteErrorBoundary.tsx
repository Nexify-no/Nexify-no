/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Component, ReactNode } from "react";
import { ErrorState } from "./ErrorState";

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the current route) auto-clears a caught error. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Page-level error boundary. Unlike the app-wide GlobalErrorBoundary (which
 * blanks the whole screen with "Noe gikk galt"), this catches a render crash in
 * a single page and shows a friendly, recoverable inline message WITHIN the app
 * chrome — the sidebar/nav stay visible. "Prøv igjen" resets the boundary without
 * a full reload, and navigating to another route clears the error automatically.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[RouteErrorBoundary]", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Noe gikk galt på denne siden"
          description="En uventet feil oppstod. Prøv igjen — innholdet og dataene dine er trygge."
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
