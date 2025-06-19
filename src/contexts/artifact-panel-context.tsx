"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Artifact } from '@/types/artifact';

interface ArtifactPanelContextType {
  isOpen: boolean;
  activeArtifact: Artifact | null;
  openArtifact: (artifact: Artifact) => void;
  closePanel: () => void;
}

const ArtifactPanelContext = createContext<ArtifactPanelContextType | undefined>(undefined);

export function ArtifactPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);

  const openArtifact = (artifact: Artifact) => {
    setActiveArtifact(artifact);
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
    setActiveArtifact(null);
  };

  return (
    <ArtifactPanelContext.Provider
      value={{
        isOpen,
        activeArtifact,
        openArtifact,
        closePanel,
      }}
    >
      {children}
    </ArtifactPanelContext.Provider>
  );
}

export function useArtifactPanel() {
  const context = useContext(ArtifactPanelContext);
  if (context === undefined) {
    throw new Error('useArtifactPanel must be used within an ArtifactPanelProvider');
  }
  return context;
}