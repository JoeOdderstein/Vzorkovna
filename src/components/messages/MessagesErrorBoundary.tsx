import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class MessagesErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Messages panel error', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <section className="tb-remote-inst-card p-6 md:p-8 max-w-2xl">
          <p className="text-sm font-medium text-[var(--tb-text)]">
            Messages couldn&apos;t load.
          </p>
          <p className="text-sm tb-muted mt-2">
            Try refreshing the page. If this keeps happening, clear your saved compose draft or
            contact support.
          </p>
          <button type="button" className="tb-btn-secondary text-sm mt-4" onClick={this.retry}>
            Try again
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
