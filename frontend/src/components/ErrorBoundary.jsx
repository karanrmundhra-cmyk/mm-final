import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * #17 — Error Boundary
 * Wraps each page route. Catches render errors so one broken page
 * doesn't crash the whole app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / LogRocket
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 gap-5 px-6 text-center">
        <div className="w-12 h-12 flex items-center justify-center"
             style={{ background:"rgba(224,82,82,0.1)", borderRadius:16 }}>
          <AlertTriangle size={22} style={{ color:"#E05252" }} />
        </div>
        <div>
          <p className="mm-font-display text-lg mb-1" style={{ color:"var(--mm-text)", fontWeight:400 }}>
            Something went wrong
          </p>
          <p className="text-xs max-w-xs leading-relaxed" style={{ color:"var(--mm-muted)" }}>
            {this.state.error?.message || "An unexpected error occurred on this page."}
          </p>
        </div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          className="mm-btn-ghost flex items-center gap-2">
          <RefreshCw size={12} /> Reload page
        </button>
      </div>
    );
  }
}
