import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './views/Landing';
import ProjectHub from './views/ProjectHub';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import SoftwareWorkspace from './views/SoftwareWorkspace';
import RequirementListing from './views/RequirementListing';
import MemoryManagement from './views/MemoryManagement';
import ToastContainer from './components/ui/ToastContainer';

function App() {
  const [project, setProject] = useState(() => {
    try {
      const saved = localStorage.getItem('archtech_project');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("Failed to parse project from localStorage:", e);
      return null;
    }
  });

  const handleProjectCreate = (newProject) => {
    setProject(newProject);
    localStorage.setItem('archtech_project', JSON.stringify(newProject));
  };

  const activeProject = project;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing onProjectCreate={handleProjectCreate} />} />
        
        {/* The Hub page with the 3 main buttons */}
        <Route path="/hub" element={activeProject ? <ProjectHub project={activeProject} /> : <Navigate to="/" replace />} />
        
        {/* Individual Workspaces */}
        <Route path="/workspace" element={activeProject ? <WorkspaceLayout project={activeProject} /> : <Navigate to="/" replace />}>
          <Route index element={<Navigate to="requirements" replace />} />
          <Route path="requirements" element={<RequirementListing project={activeProject} />} />
          <Route path="Memory" element={<MemoryManagement project={activeProject} />} />
          <Route path="software" element={<SoftwareWorkspace project={activeProject} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
