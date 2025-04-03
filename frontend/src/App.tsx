import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import WaitingRoom from './components/WaitingRoom';
import CafeTable from './components/CafeTable';
import useWebSocket from './hooks/useWebSocket';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';

type AppState =
    | 'INITIALIZING'
    | 'CONNECTING'
    | 'CONNECTED_IDLE'
    | 'JOINING_QUEUE'
    | 'WAITING'
    | 'PLAYING'
    | 'DISCONNECTED'
    | 'ERROR';

function App() {
    const [appState, setAppState] = useState<AppState>('INITIALIZING');
    const [activeTableCount, setActiveTableCount] = useState<number | null>(0);
    const [showDisconnectedMessage, setShowDisconnectedMessage] = useState(false);
    const wsUrl = useMemo(() => WEBSOCKET_URL, []);
    const activeTablesIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { sendMessage: rawSendMessage, lastMessage, connectionStatus } = useWebSocket(wsUrl);
    const sendMessage = useCallback((message: object) => {
        if (connectionStatus === 'connected') {
             rawSendMessage(message);
        } else {
             console.warn("Attempted to send message while not connected:", message);
        }
    }, [rawSendMessage, connectionStatus]);

    const requestActiveTables = useCallback(() => {
        console.log("Requesting active table count...");
        sendMessage({ action: 'getActiveTables' });
    }, [sendMessage]);

    useEffect(() => {
        console.log("Connection Status Changed:", connectionStatus);
        if (activeTablesIntervalRef.current) {
            clearInterval(activeTablesIntervalRef.current);
            activeTablesIntervalRef.current = null;
        }
        setActiveTableCount(null);

        switch (connectionStatus) {
            case 'connecting':
                setAppState('CONNECTING');
                setShowDisconnectedMessage(false);
                break;
            case 'connected':
                setAppState('CONNECTED_IDLE');
                setShowDisconnectedMessage(false);
                // TODO : Show active tables feature
                // requestActiveTables();
                // activeTablesIntervalRef.current = setInterval(requestActiveTables, 60 * 1000); // Request every 60 seconds
                break;
            case 'disconnected':
            case 'error':
                if (['CONNECTED_IDLE', 'JOINING_QUEUE', 'WAITING', 'PLAYING'].includes(appState)) {
                    setShowDisconnectedMessage(true);
                }
                setAppState(connectionStatus === 'error' ? 'ERROR' : 'DISCONNECTED');
                break;
        }

        return () => {
            if (activeTablesIntervalRef.current) {
                clearInterval(activeTablesIntervalRef.current);
                activeTablesIntervalRef.current = null;
                console.log("Cleared active tables interval.");
            }
        };
    }, [connectionStatus, requestActiveTables]);

    // Incoming WebSocket messages
    useEffect(() => {
        if (lastMessage) {
            console.log("App received message:", lastMessage);
            switch (lastMessage.action) {
                case 'activeTablesUpdate':
                    setActiveTableCount(lastMessage.payload.count);
                    break;
                case 'paired':
                    console.log("Received 'paired' message.");
                    setAppState('PLAYING');
                    break;
                case 'partnerLeft':
                     if (appState === 'PLAYING') {
                          console.log("Partner left, returning to Welcome screen.");
                          setAppState('CONNECTED_IDLE');
                     }
                    break;
                case 'returnedToIdle':
                     console.log("Returned to Welcome screen after leaving table.");
                     setAppState('CONNECTED_IDLE');
                    break;
                case 'error':
                     console.error("Backend Error Message:", lastMessage.payload?.message);
                     break;
            }
        }
    }, [lastMessage, appState, requestActiveTables]);

    const handleJoinQueue = () => {
        if (appState === 'CONNECTED_IDLE') {
            console.log("Sending joinQueue request...");
            sendMessage({ action: 'joinQueue' });
            setAppState('JOINING_QUEUE');
            // Brief JOINING state, then move to WAITING if no message is received from backend.
             setTimeout(() => {
                 setAppState(appState => {
                    if (appState === 'JOINING_QUEUE') {
                        return 'WAITING';
                    }
                    return appState;
                 })
             }, 500);

        }
    };

    const handleLeaveTable = () => {
        if (appState === 'PLAYING') {
            sendMessage({ action: 'leaveTable' });
        }
    };

    const renderContent = () => {
        switch (appState) {
            case 'INITIALIZING':
            case 'CONNECTING':
                return <WaitingRoom message="Connecting to Janken Cafe..." showSpinner={true} />;
            case 'CONNECTED_IDLE':
                return <WelcomeScreen
                            activeTableCount={activeTableCount}
                            onJoinQueue={handleJoinQueue}
                            isJoining={false}
                        />;
             case 'JOINING_QUEUE':
                 return <WelcomeScreen
                             activeTableCount={activeTableCount}
                             onJoinQueue={() => {}}
                             isJoining={true}
                         />;
            case 'WAITING':
                return <WaitingRoom message="Waiting for another player to join..." showSpinner={true} />;
            case 'PLAYING':
                return <CafeTable sendMessage={sendMessage} lastMessage={lastMessage} onLeaveTable={handleLeaveTable} />;
            case 'DISCONNECTED':
            case 'ERROR':
            default:
                return <WaitingRoom
                            message={appState === 'ERROR' ? "Connection error." : "Disconnected."}
                            showSpinner={false}
                        />;
        }
    };

    return (
        <div className="app-container">
             {showDisconnectedMessage && <div className="disconnect-banner">Connection lost. Please wait or refresh.</div>}
            <h1>Janken Cafe</h1>
            {renderContent()}
        </div>
    );
}

export default App;