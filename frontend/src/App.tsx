import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import WaitingRoom from './components/WaitingRoom';
import CafeTable from './components/CafeTable';
import useWebSocket from './hooks/useWebSocket';
import './App.scss';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'wss://c8m902dg72.execute-api.us-east-1.amazonaws.com/prod';

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
    const [showDisconnectedMessage, setShowDisconnectedMessage] = useState(false);
    const wsUrl = useMemo(() => WEBSOCKET_URL, []);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { sendMessage: rawSendMessage, lastMessage, connectionStatus } = useWebSocket(wsUrl);
    const sendMessage = useCallback((message: object) => {
        if (connectionStatus === 'connected') {
             rawSendMessage(message);
        } else {
             console.warn("Attempted to send message while not connected:", message);
        }
    }, [rawSendMessage, connectionStatus]);

    const sendHeartbeat = useCallback(() => {
        sendMessage({ action: 'heartbeat' });
    }, [sendMessage]);

    useEffect(() => {
        console.log("Connection Status Changed:", connectionStatus);
        switch (connectionStatus) {
            case 'connecting':
                setAppState('CONNECTING');
                setShowDisconnectedMessage(false);
                break;
            case 'connected':
                setAppState('CONNECTED_IDLE');
                setShowDisconnectedMessage(false);
                heartbeatIntervalRef.current = setInterval(sendHeartbeat, 60 * 1000);
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
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, [connectionStatus]);

    // Incoming WebSocket messages
    useEffect(() => {
        if (lastMessage) {
            console.log("App received message:", lastMessage);
            switch (lastMessage.action) {
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
    }, [lastMessage, appState]);

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
                            onJoinQueue={handleJoinQueue}
                            isJoining={false}
                        />;
             case 'JOINING_QUEUE':
                 return <WelcomeScreen
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
            <div className="content-screen-area">
                <div className="content-screen">
                    {renderContent()}
                </div>
            </div>
            <footer>
                <p>A project by <a href="https://github.com/mark-poussard">Mark Poussard</a></p>
            </footer>
        </div>
    );
}

export default App;