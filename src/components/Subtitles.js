import styled from 'styled-components';
import { useState, useCallback, useEffect } from 'react';
import { Table } from 'react-virtualized';
import unescape from 'lodash/unescape';
import debounce from 'lodash/debounce';
import DT from 'duration-time-conversion';
import { GiDuration } from 'react-icons/gi';
import { TbNumber } from 'react-icons/tb';
import { TiDelete } from 'react-icons/ti';
import { BiArrowFromTop, BiArrowFromBottom } from 'react-icons/bi';

const Style = styled.div`
    position: relative;
    box-shadow: 0px 5px 25px 5px rgb(0 0 0 / 80%);
    background-color: rgb(0 0 0 / 100%);

    .ReactVirtualized__Table {
        .ReactVirtualized__Table__Grid {
            outline: none;
        }

        .ReactVirtualized__Table__row {

            .item {
                padding: 5px;
                height: 100%;
                display: flex;
                flex-direction: row;

                .controls {
                    height: 100%;
                    width: 18%;
                    display: flex;
                    flex-direction: column;
                    background-color: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.2s ease;
                    resize: none;
                    outline: none;
                    padding-left: 10px;

                    .control-block {
                        height: 25%;
                        display: flex;
                        flex-direction: row;
                        align-items: center;

                        span {
                            padding-left: 5px;
                        }
                    }

                    .delete {
                        position: absolute;
                        top: -4px;
                        left: -4px;
                        font-size: 20px;

                        &:hover path {
                            fill: rgba(212, 40, 40, 1);
                        }
                    }

                    .delete-hide {
                        display: none;
                    }

                    &.highlight {
                        background-color: rgb(0, 87, 158);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }
                }

                .text {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 90%;
                }

                .textarea {
                    border: none;
                    width: 100%;
                    color: #fff;
                    font-size: 12px;
                    padding: 10px;
                    text-align: center;
                    box-sizing: border-box;
                    background-color: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.2s ease;
                    resize: none;
                    outline: none;

                    &.highlight {
                        background-color: rgb(43, 95, 138);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }

                    &.illegal {
                        background-color: rgb(123 29 0);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }
                }

                .textarea-original-text {
                    height: 50%;
                }

                .textarea-translation {
                    height: 100%;
                    color: rgb(255, 251, 23);
                }

                .text-area-with-options {
                    position: relative;
                    width: 100%;
                    box-sizing: border-box;
                }

                .options-list {
                    position: absolute;
                    top: -200%;
                    left: 0;
                    width: 100%;
                    max-height: 150px;
                    overflow-y: auto;
                    background-color: rgba(37, 37, 37, 1);;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    z-index: 10;
                    margin: 0;
                    padding: 0;
                    list-style-type: none;
                }

                .option-item {
                    font-size: 11px;
                    padding: 10px;
                    cursor: pointer;
                    color: rgb(255, 251, 23);
                }

                .option-item:hover {
                    background-color: rgb(43, 95, 138);
                }
            }
        }
    }
`;

const EditableDropdown = ({ options, subSentence, updateSub, checkSub, shouldHighlight, isLast }) => {
    const [isListVisible, setIsListVisible] = useState(false);

    const updateSentence = (value) => {
        updateSub(
            subSentence,
            {
                text: value,
            },
            true,
        );
    };

    return (
        <div className="text-area-with-options">
            <textarea
                maxLength={200}
                spellCheck={false}
                className={[
                    'textarea textarea-translation',
                    shouldHighlight ? 'highlight' : '',
                    checkSub(subSentence) ? 'illegal' : '',
                ]
                    .join(' ')
                    .trim()}
                value={unescape(subSentence.text2)}
                // TODO: add i18n support
                placeholder="Enter translation or click to select an option..."
                onBlur={() => setTimeout(() => setIsListVisible(false), 200)}
                onClick={() => setIsListVisible(!isListVisible)}
                onChange={(event) => updateSentence(event.target.value)}
            />
            {isListVisible && (
                // NOTE: -55 is the height of the textarea, 150 is the height of the options list
                // Need special handling for the last item as the option list is overshadowed by the footer. This is a limitation of the react-virtualized Table
                <ul className="options-list" style={{ top: isLast ? `${-(55+150)}px` : "100%"}}>
                    {Object.keys(options).map((key, index) => (
                        <li key={index} onMouseDown={() => updateSentence(options[key].text)} className="option-item">
                            [{key}]: {options[key].text}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default function Subtitles({ currentIndex, subtitle, checkSub, player, updateSub, removeSub }) {
    const [height, setHeight] = useState(100);

    const resize = useCallback(() => {
        // 200 is the height of the footer, 70 is the height of the header
        setHeight(document.body.clientHeight - 200 - 70);
    }, [setHeight]);

    useEffect(() => {
        resize();
        if (!resize.init) {
            resize.init = true;
            const debounceResize = debounce(resize, 500);
            window.addEventListener('resize', debounceResize);
        }
    }, [resize]);

    return (
        <Style className="subtitles">
            <Table
                headerHeight={40}
                width={800}
                height={height}
                rowHeight={120}
                scrollToIndex={currentIndex}
                rowCount={subtitle.length}
                rowGetter={({ index }) => subtitle[index]}
                rowStyle={{ overflow: 'visible' }}
                headerRowRenderer={() => null}
                rowRenderer={(props) => {
                    return (
                        <div
                            key={props.key}
                            className={props.className}
                            style={props.style}
                            onClick={() => {
                                if (player) {
                                    player.pause();
                                    if (player.duration >= props.rowData.startTime) {
                                        player.currentTime = props.rowData.startTime + 0.001;
                                    }
                                }
                            }}
                        >
                            <div className="item">
                                {/* Sentence Metadata and Controls */}
                                <div
                                    className={[
                                        'controls',
                                        currentIndex === props.index ? 'highlight' : '',
                                        checkSub(props.rowData) ? 'illegal' : '',
                                    ]
                                        .join(' ')
                                        .trim()}
                                >
                                    <div className="control-block">
                                        <BiArrowFromTop />
                                        <span>{DT.d2t(props.rowData.startTime)}</span>
                                    </div>
                                    <div className="control-block">
                                        <BiArrowFromBottom />
                                        <span>{DT.d2t(props.rowData.endTime)}</span>
                                    </div>
                                    <div className="control-block">
                                        <GiDuration />
                                        <span>{(props.rowData.endTime - props.rowData.startTime).toFixed(3)}</span>
                                    </div>
                                    <div className="control-block">
                                        <TbNumber />
                                        <span>{props.index + 1}</span>
                                    </div>

                                    <TiDelete
                                        className={currentIndex === props.index ? 'delete' : 'delete-hide'}
                                        onClick={() => removeSub(props.rowData)}
                                        title="Delete subtitle sentence"
                                    />
                                </div>
                                {/* Sentence Editor */}
                                <div className="text">
                                    <textarea
                                        maxLength={200}
                                        spellCheck={false}
                                        className={[
                                            'textarea textarea-original-text',
                                            currentIndex === props.index ? 'highlight' : '',
                                            checkSub(props.rowData) ? 'illegal' : '',
                                        ]
                                            .join(' ')
                                            .trim()}
                                        value={unescape(props.rowData.text)}
                                        onChange={(event) => {
                                            // props.rowData is of Sub type
                                            updateSub(props.rowData, {
                                                text: event.target.value,
                                            });
                                        }}
                                    />

                                    <EditableDropdown
                                        options={props.rowData.rawTranslations}
                                        subSentence={props.rowData}
                                        checkSub={checkSub}
                                        updateSub={updateSub}
                                        shouldHighlight={currentIndex===props.index}
                                        isLast={currentIndex===subtitle.length-1}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                }}
            ></Table>
        </Style>
    );
}
