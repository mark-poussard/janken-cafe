import React from 'react';
import '../styles/components/_game.scss';

type Move = 'rock' | 'paper' | 'scissors';

interface GameProps {
    onPlay: (move: Move) => void;
    score: { wins: number; losses: number; ties: number };
    lastResult: { yourMove?: string; opponentMove?: string; result?: 'win' | 'loss' | 'tie' } | null;
    opponentMadeMove: boolean;
    myMove: string | null;
}

const Game: React.FC<GameProps> = ({ onPlay, score, lastResult, opponentMadeMove, myMove }) => {

    const getResultText = () => {
        if (!lastResult) return "Make your move!";
        if (!lastResult.result) return "Waiting for results...";

        const { yourMove, opponentMove, result } = lastResult;
        let text = `You played ${yourMove}, opponent played ${opponentMove}. `;
         switch (result) {
             case 'win': text += "You Win!"; break;
             case 'loss': text += "You Lose."; break;
             case 'tie': text += "It's a Tie!"; break;
         }
         return text;
    };

    return (
        <div className="game">
            <h2>Rock Paper Scissors</h2>
            <div className="score-board">
                <span>Wins: {score.wins}</span>
                <span>Losses: {score.losses}</span>
                <span>Ties: {score.ties}</span>
            </div>

             <div className="game-status">
                  {myMove && !lastResult && <p>Your move: {myMove}. Waiting for opponent...</p>}
                  {!myMove && opponentMadeMove && !lastResult && <p>Opponent has moved. Your turn!</p>}
                  {lastResult && <p className={`result ${lastResult.result}`}>{getResultText()}</p> }
                  {!myMove && !opponentMadeMove && !lastResult && <p>Choose your weapon!</p>}
             </div>


            <div className="choices">
                <button onClick={() => onPlay('rock')} disabled={!!myMove} className={myMove === 'rock' ? 'selected' : ''}>Rock</button>
                <button onClick={() => onPlay('paper')} disabled={!!myMove} className={myMove === 'paper' ? 'selected' : ''}>Paper</button>
                <button onClick={() => onPlay('scissors')} disabled={!!myMove} className={myMove === 'scissors' ? 'selected' : ''}>Scissors</button>
            </div>
        </div>
    );
};

export default Game;