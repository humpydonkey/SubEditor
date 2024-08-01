import React, { useEffect, useCallback, useState } from 'react';
import styled from 'styled-components';
import DT from 'duration-time-conversion';
import { t } from 'react-i18nify';

const Metronome = styled.div`
    position: absolute;
    z-index: 8;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: ew-resize;
    user-select: none;

    .template {
        position: absolute;
        top: 0;
        bottom: 0;
        height: 100%;
        background-color: rgba(76, 175, 80, 0.5);
        border-left: 1px solid rgba(76, 175, 80, 0.8);
        border-right: 1px solid rgba(76, 175, 80, 0.8);
        user-select: none;
        pointer-events: none;
    }
`;

function findIndex(subs, startTime) {
    return subs.findIndex((item, index) => {
        return (
            (startTime >= item.endTime && !subs[index + 1]) ||
            (item.startTime <= startTime && item.endTime > startTime) ||
            (startTime >= item.endTime && subs[index + 1] && startTime < subs[index + 1].startTime)
        );
    });
}

export default function Component({ render, subtitle, newSub, addSub, player, playing }) {
    // An horizontal transparent overlay (on the waveform) that user can drag and drop to create a new subtitle
    const [isDropped, setIsDropped] = useState(false);
    const [dropStartTime, setDropStartTime] = useState(0);
    const [dropEndTime, setDropEndTime] = useState(0);
    const gridGap = document.body.clientWidth / render.gridNum;

    const getEventTime = useCallback(
        (event) => {
            return (event.pageX - render.padding * gridGap) / gridGap / 10 + render.beginTime;
        },
        [gridGap, render],
    );

    const onMouseDown = useCallback(
        (event) => {
            if (event.button !== 0) {
              return;
            }
            const clickTime = getEventTime(event);
            setIsDropped(true);
            setDropStartTime(clickTime);
        },
        [getEventTime],
    );

    const onMouseMove = useCallback(
        (event) => {
            if (isDropped) {
                if (playing) {
                  player.pause();
                }
                setDropEndTime(getEventTime(event));
            }
        },
        [isDropped, playing, player, getEventTime],
    );

    const onMouseUp = useCallback(() => {
        if (isDropped && (dropStartTime > 0 && dropEndTime > 0 && dropEndTime - dropStartTime >= 0.2)) {
              const index = findIndex(subtitle, dropStartTime) + 1;
              const start = DT.d2t(dropStartTime);
              const end = DT.d2t(dropEndTime);
              addSub(
                  index,
                  newSub({
                      start,
                      end,
                      text: t('SUB_TEXT'),
                  }),
              );
        }
        setIsDropped(false);
        setDropStartTime(0);
        setDropEndTime(0);
    }, [isDropped, dropStartTime, dropEndTime, subtitle, addSub, newSub]);

    useEffect(() => {
        document.addEventListener('mouseup', onMouseUp);
        return () => document.removeEventListener('mouseup', onMouseUp);
    }, [onMouseUp]);

    return (
        <Metronome className="metronome" onMouseDown={onMouseDown} onMouseMove={onMouseMove}>
            {player && !playing && dropStartTime && dropEndTime && dropEndTime > dropStartTime ? (
                <div
                    className="template"
                    style={{
                        left: render.padding * gridGap + (dropStartTime - render.beginTime) * gridGap * 10,
                        width: (dropEndTime - dropStartTime) * gridGap * 10,
                    }}
                ></div>
            ) : null}
        </Metronome>
    );
}
