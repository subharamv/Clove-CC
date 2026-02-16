import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthDebugger: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [adminStatus, setAdminStatus] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addLog('Auth debugger initialized');
    
    // Check current session
    const checkSession = async () => {
      try {
        addLog('Checking current session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          addLog(`❌ Session error: ${error.message}`);
          return;
        }
        
        if (session) {
          addLog(`✅ Session found for: ${session.user.email}`);
          addLog(`📅 Session expires at: ${session.expires_at}`);
          setSessionInfo({
            email: session.user.email,
            id: session.user.id,
            expires_at: session.expires_at
          });
          
          // Check admin status
          addLog('Checking admin status...');
          const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .limit(1);
            
          if (adminError) {
            addLog(`❌ Admin check error: ${adminError.message}`);
          } else if (adminData && adminData.length > 0) {
            addLog(`✅ Admin record found: ${JSON.stringify(adminData[0])}`);
            setAdminStatus(adminData[0]);
          } else {
            addLog('❌ No admin record found');
          }
        } else {
          addLog('❌ No session found');
        }
      } catch (err: any) {
        addLog(`❌ Unexpected error: ${err.message}`);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`🔄 Auth event: ${event}`);
      if (session) {
        addLog(`📧 Session email: ${session.user.email}`);
        addLog(`🆔 Session ID: ${session.user.id}`);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const testSignOut = async () => {
    addLog('🚪 Testing sign out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        addLog(`❌ Sign out error: ${error.message}`);
      } else {
        addLog('✅ Signed out successfully');
      }
    } catch (err: any) {
      addLog(`❌ Sign out exception: ${err.message}`);
    }
  };

  const testSessionRefresh = async () => {
    addLog('🔄 Testing session refresh...');
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        addLog(`❌ Refresh error: ${error.message}`);
      } else {
        addLog('✅ Session refreshed successfully');
      }
    } catch (err: any) {
      addLog(`❌ Refresh exception: ${err.message}`);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      width: '400px', 
      maxHeight: '80vh', 
      backgroundColor: '#1a1a1a', 
      color: '#fff', 
      padding: '15px', 
      borderRadius: '8px', 
      fontFamily: 'monospace', 
      fontSize: '12px', 
      zIndex: 9999,
      overflow: 'auto'
    }}>
      <div style={{ borderBottom: '1px solid #333', marginBottom: '10px', paddingBottom: '10px' }}>
        <h3 style={{ margin: 0, color: '#4CAF50' }}>🐛 Auth Debugger</h3>
      </div>
      
      {sessionInfo && (
        <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
          <div><strong>Session:</strong></div>
          <div>Email: {sessionInfo.email}</div>
          <div>ID: {sessionInfo.id}</div>
          <div>Expires: {new Date(sessionInfo.expires_at * 1000).toLocaleString()}</div>
        </div>
      )}
      
      {adminStatus && (
        <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
          <div><strong>Admin Status:</strong></div>
          <div>Access: {adminStatus.access ? '✅' : '❌'}</div>
          <div>Created: {new Date(adminStatus.created_at).toLocaleString()}</div>
        </div>
      )}
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={testSignOut} 
          style={{ 
            marginRight: '5px', 
            padding: '5px 10px', 
            backgroundColor: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
        <button 
          onClick={testSessionRefresh} 
          style={{ 
            marginRight: '5px', 
            padding: '5px 10px', 
            backgroundColor: '#2196F3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
        <button 
          onClick={clearLogs} 
          style={{ 
            padding: '5px 10px', 
            backgroundColor: '#666', 
            color: 'white', 
            border: 'none', 
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      
      <div style={{ 
        maxHeight: '300px', 
        overflow: 'auto', 
        backgroundColor: '#0a0a0a', 
        padding: '10px', 
        borderRadius: '4px',
        fontSize: '11px'
      }}>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '2px' }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthDebugger;