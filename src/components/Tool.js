import styled from 'styled-components';
import languages from '../libs/languages';
import { t, Translate } from 'react-i18nify';
import { useState, useCallback } from 'react';
import { getExt, download } from '../utils';
import { file2sub, sub2vtt, sub2srt, sub2srtTranslation, sub2txt } from '../libs/readSub';
import sub2ass from '../libs/readSub/sub2ass';
import googleTranslate from '../libs/googleTranslate';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import DT from 'duration-time-conversion';
import SimpleFS from '@forlagshuset/simple-fs';

const Style = styled.div`
    padding-bottom: 20px;
    background-color: rgb(0 0 0 / 100%);
    border-left: 1px solid rgb(255 255 255 / 20%);

    .navbar {
        width: 100%;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: space-between;
    }

    .navbar .btn {
        position: relative;
        opacity: 0.85;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 35px;
        padding: 0 10px;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        background-color: #3f51b5;
        transition: all 0.2s ease 0s;
        margin: 10px;

        &:hover {
            opacity: 1;
        }
    }

    .import {
        display: flex;
        padding: 10px;

        .file {
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
        }
    }

    .burn {
        display: flex;
        justify-content: end;
        padding: 10px;

        .btn {
            background-color: #673ab7;
        }
    }

    .export {
        display: flex;
        justify-content: end;
        padding: 10px;

        .btn {
            background-color: #009688;
        }
    }

    .operate {
        display: flex;
        justify-content: space-between;
        padding: 10px;

        .btn {
            background-color: #009688;
        }
    }

    .translate {
        display: flex;
        justify-content: start;
        align-items: center;
        padding: 10px;

        select {
            width: 45%;
            height: 35px;
            outline: none;
            padding: 0 5px;
            border-radius: 3px;
        }

        .btn {
            background-color: #673ab7;
        }
    }

    .hotkey {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        width: 17%;

        span {
            width: 100%;
            font-size: 13px;
            padding: 5px 0;
            margin: 0 10px;
            border-radius: 3px;
            text-align: center;
            color: rgb(255 255 255 / 75%);
            background-color: rgb(255 255 255 / 20%);
        }
    }

    .bottom {
        padding: 10px;
        a {
            display: flex;
            flex-direction: column;
            border: 1px solid rgb(255 255 255 / 30%);
            text-decoration: none;

            .title {
                color: #ffeb3b;
                padding: 5px 10px;
                animation: animation 3s infinite;
                border-bottom: 1px solid rgb(255 255 255 / 30%);
            }

            @keyframes animation {
                50% {
                    color: #00bcd4;
                }
            }

            img {
                max-width: 100%;
            }
        }
    }

    .progress {
        position: fixed;
        left: 0;
        top: 0;
        right: 0;
        z-index: 9;
        height: 2px;
        background-color: rgb(0 0 0 / 50%);

        span {
            display: inline-block;
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 0;
            height: 100%;
            background-color: #ff9800;
            transition: all 0.2s ease 0s;
        }
    }
`;

const ffmpeg = new FFmpeg({ log: true });
const fs = new SimpleFS.FileSystem();

export default function Tool({
    player,
    waveform,
    newSub,
    undoSubs,
    clearSubs,
    language,
    subtitle,
    setLoading,
    formatSub,
    setSubtitle,
    setProcessing,
    notify,
}) {
    const [translate, setTranslate] = useState('zh');
    const [videoFile, setVideoFile] = useState(null);

    const decodeAudioData = useCallback(
        async (file) => {
            try {
                const { fetchFile } = FFmpeg;
                await ffmpeg.load();
                ffmpeg.setProgress(({ ratio }) => setProcessing(ratio * 100));
                setLoading(t('LOADING_FFMPEG'));
                await ffmpeg.load();
                ffmpeg.FS('writeFile', file.name, await fetchFile(file));
                setLoading('');
                notify({
                    message: t('DECODE_START'),
                    level: 'info',
                });
                const output = `${Date.now()}.mp3`;
                await ffmpeg.run('-i', file.name, '-ac', '1', '-ar', '8000', output);
                const uint8 = ffmpeg.FS('readFile', output);
                // download(URL.createObjectURL(new Blob([uint8])), `${output}`);
                await waveform.decoder.decodeAudioData(uint8);
                waveform.drawer.update();
                setProcessing(0);
                ffmpeg.setProgress(() => null);
                notify({
                    message: t('DECODE_SUCCESS'),
                    level: 'success',
                });
            } catch (error) {
                setLoading('');
                setProcessing(0);
                notify({
                    message: t('DECODE_ERROR'),
                    level: 'error',
                });
            }
        },
        [waveform, notify, setProcessing, setLoading],
    );

    const burnSubtitles = useCallback(async () => {
        try {
            const { createFFmpeg, fetchFile } = FFmpeg;
            const ffmpeg = createFFmpeg({ log: true });
            ffmpeg.setProgress(({ ratio }) => setProcessing(ratio * 100));
            setLoading(t('LOADING_FFMPEG'));
            await ffmpeg.load();
            setLoading(t('LOADING_FONT'));

            await fs.mkdir('/fonts');
            const fontExist = await fs.exists('/fonts/Microsoft-YaHei.ttf');
            if (fontExist) {
                const fontBlob = await fs.readFile('/fonts/Microsoft-YaHei.ttf');
                ffmpeg.FS('writeFile', `tmp/Microsoft-YaHei.ttf`, await fetchFile(fontBlob));
            } else {
                const fontUrl = 'https://cdn.jsdelivr.net/gh/zhw2590582/SubPlayer/docs/Microsoft-YaHei.ttf';
                const fontBlob = await fetch(fontUrl).then((res) => res.blob());
                await fs.writeFile('/fonts/Microsoft-YaHei.ttf', fontBlob);
                ffmpeg.FS('writeFile', `tmp/Microsoft-YaHei.ttf`, await fetchFile(fontBlob));
            }
            setLoading(t('LOADING_VIDEO'));
            ffmpeg.FS(
                'writeFile',
                videoFile ? videoFile.name : 'sample.mp4',
                await fetchFile(videoFile || 'sample.mp4'),
            );
            setLoading(t('LOADING_SUB'));
            const subtitleFile = new File([new Blob([sub2ass(subtitle)])], 'subtitle.ass');
            ffmpeg.FS('writeFile', subtitleFile.name, await fetchFile(subtitleFile));
            setLoading('');
            notify({
                message: t('BURN_START'),
                level: 'info',
            });
            const output = `${Date.now()}.mp4`;
            await ffmpeg.run(
                '-i',
                videoFile ? videoFile.name : 'sample.mp4',
                '-vf',
                `ass=${subtitleFile.name}:fontsdir=/tmp`,
                '-preset',
                videoFile ? 'fast' : 'ultrafast',
                output,
            );
            const uint8 = ffmpeg.FS('readFile', output);
            download(URL.createObjectURL(new Blob([uint8])), `${output}`);
            setProcessing(0);
            ffmpeg.setProgress(() => null);
            notify({
                message: t('BURN_SUCCESS'),
                level: 'success',
            });
        } catch (error) {
            setLoading('');
            setProcessing(0);
            notify({
                message: t('BURN_ERROR'),
                level: 'error',
            });
        }
    }, [notify, setProcessing, setLoading, videoFile, subtitle]);

    const onVideoChange = useCallback(
        (event) => {
            // TODO: add check length <= 2, check file type is either video or subtitle
            let file;
            let subtitleFile = null;
            if (event.target.files.length > 1) {
                for (const f of event.target.files) {
                    if (f.type.startsWith('video')) {
                        file = f;
                    } else if (f.name.endsWith(".subtitle")) {
                        subtitleFile = f;
                    }
                }
            } else {
                file = event.target.files[0];
            }
            if (file) {
                const ext = getExt(file.name);
                const canPlayType = player.canPlayType(file.type);
                if (canPlayType === 'maybe' || canPlayType === 'probably') {
                    setVideoFile(file);
                    decodeAudioData(file);
                    const url = URL.createObjectURL(new Blob([file]));
                    waveform.decoder.destroy();
                    waveform.drawer.update();
                    waveform.seek(0);
                    player.currentTime = 0;
                    player.src = url;
                } else {
                    notify({
                        message: `${t('VIDEO_EXT_ERR')}: ${file.type || ext}`,
                        level: 'error',
                    });
                }
            }
            clearSubs();
            if (subtitleFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const subtitleJson = JSON.parse(e.target.result);
                        const sub = [];
                        for (const sentence of subtitleJson["sentences"]) {
                            const s = newSub({
                                start: DT.d2t(sentence["start"]),
                                end: DT.d2t(sentence["start"] + sentence["duration"]),
                                text: sentence["text"],
                                text2: sentence["raw_translations"]["agent_translator"]["text"],
                                rawTranslations: sentence["raw_translations"],
                            });
                            sub.push(s);
                        }
                        setSubtitle(sub);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        notify({
                            message: `${t('LOAD_SUBTITLE_ERROR')}: ${subtitleFile}. ${error}`,
                            level: 'error',
                        });
                    }
                };
                reader.readAsText(subtitleFile);
            } else {
                setSubtitle([
                    newSub({
                        start: '00:00:00.000',
                        end: '00:00:01.000',
                        text: t('SUB_TEXT'),
                    }),
                ]);
            }
        },
        [newSub, notify, player, setSubtitle, waveform, clearSubs, decodeAudioData],
    );

    const onSubtitleChange = useCallback(
        (event) => {
            const file = event.target.files[0];
            if (file) {
                const ext = getExt(file.name);
                if (['ass', 'vtt', 'srt', 'json'].includes(ext)) {
                    file2sub(file)
                        .then((res) => {
                            clearSubs();
                            setSubtitle(res);
                        })
                        .catch((err) => {
                            notify({
                                message: err.message,
                                level: 'error',
                            });
                        });
                } else {
                    notify({
                        message: `${t('SUB_EXT_ERR')}: ${ext}`,
                        level: 'error',
                    });
                }
            }
        },
        [notify, setSubtitle, clearSubs],
    );

    const onInputClick = useCallback((event) => {
        event.target.value = '';
    }, []);

    const downloadSub = useCallback(
        (type) => {
            let text = '';
            let text2 = '';
            const name = `${Date.now()}.${type}`;
            const name2 = `${Date.now()}_translation.${type}`;
            switch (type) {
                case 'vtt':
                    text = sub2vtt(subtitle);
                    break;
                case 'srt':
                    text = sub2srt(subtitle);
                    // translation
                    text2 = sub2srtTranslation(subtitle);
                    break;
                case 'ass':
                    text = sub2ass(subtitle);
                    break;
                case 'txt':
                    text = sub2txt(subtitle);
                    break;
                case 'json':
                    text = JSON.stringify(subtitle);
                    break;
                default:
                    break;
            }
            const url = URL.createObjectURL(new Blob([text]));
            download(url, name);
            if (text2.trim()) {
                const url2 = URL.createObjectURL(new Blob([text2]));
                download(url2, name2);
            }
        },
        [subtitle],
    );

    const onTranslate = useCallback(() => {
        setLoading(t('TRANSLATING'));
        googleTranslate(formatSub(subtitle), translate)
            .then((res) => {
                setLoading('');
                setSubtitle(formatSub(res));
                notify({
                    message: t('TRANSLAT_SUCCESS'),
                    level: 'success',
                });
            })
            .catch((err) => {
                setLoading('');
                notify({
                    message: err.message,
                    level: 'error',
                });
            });
    }, [subtitle, setLoading, formatSub, setSubtitle, translate, notify]);

    const showRenderCommand = useCallback(() => {
        let cmd = 'python vid_craft/render.py "title.mp4" "title.srt" "title" "@硅谷见闻" ~/Downloads/';
        const userInput = window.prompt("Please review and modify the command if needed:", cmd);
        if (userInput !== null) {
            notify({
                message: `Command to execute: ${userInput}`,
                level: 'info',
            });
        }
    }, [subtitle, notify]);

    return (
        <Style className="tool">
            <div className="navbar">
                <div className="import">
                    <div className="btn">
                        <Translate value="OPEN_VIDEO" />
                        <input className="file" type="file" onChange={onVideoChange} onClick={onInputClick} multiple />
                    </div>
                    <div className="btn">
                        <Translate value="OPEN_SUB" />
                        <input className="file" type="file" onChange={onSubtitleChange} onClick={onInputClick} />
                    </div>
                </div>
                {window.crossOriginIsolated ? (
                    <div className="burn" onClick={burnSubtitles}>
                        <div className="btn">
                            <Translate value="EXPORT_VIDEO" />
                        </div>
                    </div>
                ) : null}
                <div className="export">
                    <div className="btn" onClick={showRenderCommand}>
                        <div className="btn">
                            <Translate value="EXPORT_VIDEO" />
                        </div>
                    </div>
                    <div className="btn" onClick={() => downloadSub('ass')}>
                        <Translate value="EXPORT_ASS" />
                    </div>
                    <div className="btn" onClick={() => downloadSub('srt')}>
                        <Translate value="EXPORT_SRT" />
                    </div>
                    <div className="btn" onClick={() => downloadSub('vtt')}>
                        <Translate value="EXPORT_VTT" />
                    </div>
                </div>
                <div className="operate">
                    <div
                        className="btn"
                        onClick={() => {
                            if (window.confirm(t('CLEAR_TIP')) === true) {
                                clearSubs();
                                window.location.reload();
                            }
                        }}
                    >
                        <Translate value="CLEAR" />
                    </div>
                    <div className="btn" onClick={undoSubs}>
                        <Translate value="UNDO" />
                    </div>
                </div>
                <div className="translate">
                    <select value={translate} onChange={(event) => setTranslate(event.target.value)}>
                        {(languages[language] || languages.en).map((item) => (
                            <option key={item.key} value={item.key}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                    <div className="btn" onClick={onTranslate}>
                        <Translate value="TRANSLATE" />
                    </div>
                </div>
                <div className="hotkey">
                    <span>
                        <Translate value="HOTKEY_01" />
                    </span>
                    <span>
                        <Translate value="HOTKEY_02" />
                    </span>
                </div>
            </div>
        </Style>
    );
}
