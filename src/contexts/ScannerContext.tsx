import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * ScannerContext - Persists active scan IDs across tab switches and refreshes.
 * This ensures the UI can re-attach to background jobs.
 */

interface ScannerState {
    forreconScanId: string | null;
    arsenalScanId: string | null;
    gobusterScanId: string | null;
    nucleiScanId: string | null;
    zapScanId: string | null;
    katanaScanId: string | null;
    retireScanId: string | null;
    sastScanId: string | null;
    aiHuntScanId: string | null;
}

interface ScannerContextType {
    scanState: ScannerState;
    setForreconScanId: (id: string | null) => void;
    setArsenalScanId: (id: string | null) => void;
    setGobusterScanId: (id: string | null) => void;
    setNucleiScanId: (id: string | null) => void;
    setZapScanId: (id: string | null) => void;
    setKatanaScanId: (id: string | null) => void;
    setRetireScanId: (id: string | null) => void;
    setSastScanId: (id: string | null) => void;
    setAiHuntScanId: (id: string | null) => void;
    clearAll: () => void;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

export const ScannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize from localStorage
    const [scanState, setScanState] = useState<ScannerState>(() => {
        const saved = localStorage.getItem('vapt_scanner_state');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse scanner state', e);
            }
        }
        return {
            forreconScanId: null,
            arsenalScanId: null,
            gobusterScanId: null,
            nucleiScanId: null,
            zapScanId: null,
            katanaScanId: null,
            retireScanId: null,
            sastScanId: null,
            aiHuntScanId: null
        };
    });

    // Persist to localStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('vapt_scanner_state', JSON.stringify(scanState));
    }, [scanState]);

    const setForreconScanId = (id: string | null) => setScanState(prev => ({ ...prev, forreconScanId: id }));
    const setArsenalScanId = (id: string | null) => setScanState(prev => ({ ...prev, arsenalScanId: id }));
    const setGobusterScanId = (id: string | null) => setScanState(prev => ({ ...prev, gobusterScanId: id }));
    const setNucleiScanId = (id: string | null) => setScanState(prev => ({ ...prev, nucleiScanId: id }));
    const setZapScanId = (id: string | null) => setScanState(prev => ({ ...prev, zapScanId: id }));
    const setKatanaScanId = (id: string | null) => setScanState(prev => ({ ...prev, katanaScanId: id }));
    const setRetireScanId = (id: string | null) => setScanState(prev => ({ ...prev, retireScanId: id }));
    const setSastScanId = (id: string | null) => setScanState(prev => ({ ...prev, sastScanId: id }));
    const setAiHuntScanId = (id: string | null) => setScanState(prev => ({ ...prev, aiHuntScanId: id }));

    const clearAll = () => {
        setScanState({
            forreconScanId: null,
            arsenalScanId: null,
            gobusterScanId: null,
            nucleiScanId: null,
            zapScanId: null,
            katanaScanId: null,
            retireScanId: null,
            sastScanId: null,
            aiHuntScanId: null
        });
    };

    return (
        <ScannerContext.Provider value={{ 
            scanState, 
            setForreconScanId, 
            setArsenalScanId, 
            setGobusterScanId,
            setNucleiScanId,
            setZapScanId,
            setKatanaScanId,
            setRetireScanId,
            setSastScanId,
            setAiHuntScanId,
            clearAll 
        }}>
            {children}
        </ScannerContext.Provider>
    );
};

export const useScanner = () => {
    const context = useContext(ScannerContext);
    if (context === undefined) {
        throw new Error('useScanner must be used within a ScannerProvider');
    }
    return context;
};
