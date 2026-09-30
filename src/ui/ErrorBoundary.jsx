import React from 'react';

/** Keeps the canvas alive even if a UI component throws. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[BHL] UI error', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="ui-error">
          <p>The control panel hit an error. The simulation is still running.</p>
          <button type="button" className="chip" onClick={() => this.setState({ error: null })}>Restore controls</button>
        </div>
      );
    }
    return this.props.children;
  }
}
