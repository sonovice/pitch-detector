import type { Component } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import Demo from './pages/Demo';

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={Demo} />
      {/* Add other routes here */}

    </Router>
  );
};

export default App;