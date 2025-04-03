import React, { useState, useEffect } from 'react';
import Game from './Game';
import Chat from './Chat';
import '../styles/components/_cafeTable.scss';

interface CafeTableProps {
    sendMessage: (message: object) => void;
    lastMessage: { action: string; payload?: any } | null;
    onLeaveTable: () => void;
}

const CafeTable: React.FC<CafeTableProps> = ({ sendMessage, lastMessage, onLeaveTable }) => {
    const [score, setScore] = useState({ wins: 0, losses: 0, ties: 0 });
    const [chatMessages, setChatMessages] = useState<{ type: 'my' | 'other' | 'system'; text: string }[]>([]);
    const [lastGameResult, setLastGameResult] = useState<{ yourMove?: string; opponentMove?: string; result?: 'win' | 'loss' | 'tie' } | null>(null);
    const [opponentMadeMove, setOpponentMadeMove] = useState(false);
    const [myMove, setMyMove] = useState<string | null>(null);

    useEffect(() => {
         setScore({ wins: 0, losses: 0, ties: 0 });
         setChatMessages([{ type: 'system', text: 'You are paired! Say hello.' }]);
         setLastGameResult(null);
         setOpponentMadeMove(false);
         setMyMove(null);
    }, []);


    useEffect(() => {
        if (lastMessage) {
            switch (lastMessage.action) {
                 case 'moveReceived':
                      setMyMove(lastMessage.payload.move);
                      setOpponentMadeMove(false);
                      break;
                 case 'opponentMoved':
                      setOpponentMadeMove(true);
                      break;
                case 'roundResult':
                    const { yourMove, opponentMove, result } = lastMessage.payload;
                    setLastGameResult({ yourMove, opponentMove, result });
                    setOpponentMadeMove(false);
                    setMyMove(null);

                    setScore(prevScore => ({
                        wins: result === 'win' ? prevScore.wins + 1 : prevScore.wins,
                        losses: result === 'loss' ? prevScore.losses + 1 : prevScore.losses,
                        ties: result === 'tie' ? prevScore.ties + 1 : prevScore.ties,
                    }));
                    break;
                case 'newMessage':
                    setChatMessages(prev => [...prev, { type: 'other', text: lastMessage.payload.message }]);
                    break;
                case 'partnerLeft':
                    setChatMessages(prev => [...prev, { type: 'system', text: 'Your partner has left the table.' }]);
                    break;
            }
        }
    }, [lastMessage]);

    const handlePlay = (move: 'rock' | 'paper' | 'scissors') => {
        if (myMove) return;
        sendMessage({ action: 'playMove', payload: { move } });
    };

    const handleSendMessage = (message: string) => {
        sendMessage({ action: 'sendMessage', payload: { message } });
        setChatMessages(prev => [...prev, { type: 'my', text: message }]);
    };

    return (
        <div className="cafe-table">
            <button className="leave-button" onClick={onLeaveTable}>Leave Table</button>
            <div className="table-layout">
                <div className="game-area">
                    <Game
                        onPlay={handlePlay}
                        score={score}
                        lastResult={lastGameResult}
                        opponentMadeMove={opponentMadeMove}
                         myMove={myMove}
                    />
                </div>
                <div className="chat-area">
                    <Chat messages={chatMessages} onSendMessage={handleSendMessage} />
                </div>
            </div>
        </div>
    );
};

export default CafeTable;