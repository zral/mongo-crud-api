import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ManagementInterface from './components/ManagementInterface';
import CollectionInterface from './components/CollectionInterface';
import WebhookInterface from './components/WebhookInterface';
import ScriptInterface from './components/ScriptInterface';
import { Database, Settings, Webhook, Code } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('collections');

  return (
    <Router>
      <div className="App">
        <Toaster position="top-right" />
        
        <header className="header">
          <div className="container">
            <h1>MongoDB CRUD Manager</h1>
            <p>Manage your MongoDB collections and data with ease</p>
          </div>
        </header>

        <div className="container">
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'collections' ? 'active' : ''}`}
              onClick={() => setActiveTab('collections')}
            >
              <Database size={20} />
              Collections
            </button>
            <button
              className={`nav-tab ${activeTab === 'management' ? 'active' : ''}`}
              onClick={() => setActiveTab('management')}
            >
              <Settings size={20} />
              Management
            </button>
            <button
              className={`nav-tab ${activeTab === 'webhooks' ? 'active' : ''}`}
              onClick={() => setActiveTab('webhooks')}
            >
              <Webhook size={20} />
              Webhooks
            </button>
            <button
              className={`nav-tab ${activeTab === 'scripts' ? 'active' : ''}`}
              onClick={() => setActiveTab('scripts')}
            >
              <Code size={20} />
              Scripts
            </button>
          </nav>

          <main>
            {activeTab === 'collections' && <CollectionInterface />}
            {activeTab === 'management' && <ManagementInterface />}
            {activeTab === 'webhooks' && <WebhookInterface />}
            {activeTab === 'scripts' && <ScriptInterface />}
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
