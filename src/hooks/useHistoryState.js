import { useState, useCallback, useRef } from "react";

export function useHistoryState(initialState) {
    const [state, setState] = useState(initialState);
    const [hist, setHist] = useState({ stack: [initialState], pointer: 0 });
    const lastUpdated = useRef(Date.now());

    const set = useCallback(
        (value) => {
            const now = Date.now();
            const isRapid = now - lastUpdated.current < 250;
            lastUpdated.current = now;

            setState((prev) => {
                const nextState = typeof value === "function" ? value(prev) : value;

                setHist((prevHist) => {
                    const currentHistory = prevHist.stack.slice(0, prevHist.pointer + 1);
                    let newPointer = prevHist.pointer;

                    if (isRapid && currentHistory.length > 1) {
                        currentHistory[currentHistory.length - 1] = nextState;
                    } else {
                        currentHistory.push(nextState);
                        newPointer++;
                    }

                    if (currentHistory.length > 50) {
                        currentHistory.shift();
                        newPointer--;
                    }

                    return { stack: currentHistory, pointer: newPointer };
                });

                return nextState;
            });
        },
        [],
    );

    const undo = useCallback(() => {
        setHist((prev) => {
            if (prev.pointer > 0) {
                const newPointer = prev.pointer - 1;
                setState(prev.stack[newPointer]);
                return { ...prev, pointer: newPointer };
            }
            return prev;
        });
    }, []);

    const redo = useCallback(() => {
        setHist((prev) => {
            if (prev.pointer < prev.stack.length - 1) {
                const newPointer = prev.pointer + 1;
                setState(prev.stack[newPointer]);
                return { ...prev, pointer: newPointer };
            }
            return prev;
        });
    }, []);

    const reset = useCallback(() => {
        setHist({ stack: [initialState], pointer: 0 });
        setState(initialState);
    }, [initialState]);

    return [
        state,
        set,
        {
            undo,
            redo,
            reset,
            canUndo: hist.pointer > 0,
            canRedo: hist.pointer < hist.stack.length - 1,
        },
    ];
}
