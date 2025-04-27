import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Container, Paper, Button, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import { io, Socket } from 'socket.io-client';
import { FaceLandmarks, AvatarState, Keypoint, SpeechRecognition, SpeechRecognitionEvent } from '../../types/face';
import { renderAvatar } from '../../utils/avatarRenderer';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VoiceOverOffIcon from '@mui/icons-material/VoiceOverOff';

const Practice: React.FC = () => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [model, setModel] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
    const [avatarState, setAvatarState] = useState<AvatarState>({
        expression: 'neutral',
        eyeBlink: { left: 0, right: 0 },
        mouthOpen: 0,
        headRotation: { x: 0, y: 0, z: 0 },
    });
    const socketRef = useRef<Socket | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [transcript, setTranscript] = useState<string>('');
    const [isListening, setIsListening] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
        'disconnected'
    );
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const streamIdRef = useRef<string>('');
    const [referenceText, setReferenceText] = useState<string>('안녕하세요, 반갑습니다.');
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    // WebRTC 설정
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ],
    };

    const setupWebRTC = async () => {
        try {
            console.log('=== WebRTC 설정 시작 ===');

            // RTCPeerConnection 생성
            peerConnectionRef.current = new RTCPeerConnection(configuration);
            console.log('RTCPeerConnection 생성됨');

            // ICE 후보 이벤트 처리
            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate && socketRef.current) {
                    console.log('ICE 후보 전송:', event.candidate);
                    socketRef.current.emit('ice_candidate', {
                        candidate: event.candidate,
                    });
                }
            };

            // 연결 상태 변경 이벤트 처리
            peerConnectionRef.current.onconnectionstatechange = () => {
                console.log('WebRTC 연결 상태:', peerConnectionRef.current?.connectionState);
                if (socketRef.current) {
                    socketRef.current.emit('webrtc_state', {
                        state: peerConnectionRef.current?.connectionState,
                        peer_id: socketRef.current.id,
                    });
                }
            };

            // 로컬 스트림 추가
            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    if (peerConnectionRef.current) {
                        peerConnectionRef.current.addTrack(track, localStream);
                        console.log('트랙 추가:', track.kind);
                    }
                });
            }

            console.log('=== WebRTC 설정 완료 ===');
        } catch (error) {
            console.error('WebRTC 설정 중 오류:', error);
        }
    };

    const setupAudioProcessing = (stream: MediaStream) => {
        try {
            console.log('=== 오디오 처리 설정 시작 ===');

            // AudioContext 생성
            audioContextRef.current = new AudioContext({
                sampleRate: 48000,
                latencyHint: 'interactive',
            });
            console.log('AudioContext 생성됨:', audioContextRef.current.state);

            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            console.log('MediaStreamSource 생성됨');

            // ScriptProcessorNode 생성 (오디오 데이터 처리)
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            console.log('ScriptProcessor 생성됨, 버퍼 크기:', 4096);

            // 오디오 데이터 처리 콜백
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                if (!isAudioEnabled || !socketRef.current) {
                    return;
                }

                try {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const audioDataArray = new Float32Array(inputData);

                    // 데이터 유효성 검사
                    if (audioDataArray.length === 0) {
                        console.warn('빈 오디오 데이터 수신');
                        return;
                    }

                    // 데이터 전송 전 로깅
                    console.log('=== 오디오 데이터 전송 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('데이터 크기:', audioDataArray.length);
                    console.log('샘플레이트:', audioContextRef.current?.sampleRate);
                    console.log('첫 번째 샘플:', audioDataArray[0]);
                    console.log('마지막 샘플:', audioDataArray[audioDataArray.length - 1]);

                    // 오디오 데이터 전송
                    socketRef.current.emit('audio_stream_data', {
                        stream_id: streamIdRef.current,
                        data: audioDataArray,
                        sampleRate: audioContextRef.current?.sampleRate,
                        channelCount: 1,
                    });
                } catch (error) {
                    console.error('오디오 데이터 처리 중 오류:', error);
                }
            };

            // 오디오 처리 연결
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
            console.log('오디오 처리 연결 완료');
            console.log('=== 오디오 처리 설정 완료 ===');
        } catch (error) {
            console.error('오디오 처리 설정 중 오류:', error);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                setConnectionStatus('connecting');
                console.log('=== 초기화 시작 ===');

                // 오디오 제약 조건 설정
                const audioConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: false,
                        channelCount: 1,
                        sampleRate: 48000,
                        sampleSize: 16,
                    },
                    video: true,
                };

                // 미디어 스트림 가져오기
                const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                setLocalStream(stream);
                console.log('미디어 스트림 획득 완료');

                // WebRTC 설정
                await setupWebRTC();

                // AudioContext 설정
                audioContextRef.current = new AudioContext({
                    sampleRate: 48000,
                    latencyHint: 'interactive',
                });
                console.log('AudioContext 생성됨:', audioContextRef.current.state);

                // 스트림을 AudioContext에 연결
                mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                console.log('MediaStreamSource 생성됨');

                // 오디오 처리를 위한 프로세서 노드 생성
                scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                console.log('ScriptProcessor 생성됨, 버퍼 크기:', 4096);

                // 오디오 데이터 처리 콜백
                scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                    if (!isAudioEnabled || !socketRef.current) {
                        return;
                    }

                    try {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const audioDataArray = new Float32Array(inputData);

                        // 데이터 유효성 검사
                        if (audioDataArray.length === 0) {
                            console.warn('빈 오디오 데이터 수신');
                            return;
                        }

                        // 데이터 전송 전 로깅
                        console.log('=== 오디오 데이터 전송 ===');
                        console.log('시간:', new Date().toISOString());
                        console.log('데이터 크기:', audioDataArray.length);
                        console.log('샘플레이트:', audioContextRef.current?.sampleRate);
                        console.log('첫 번째 샘플:', audioDataArray[0]);
                        console.log('마지막 샘플:', audioDataArray[audioDataArray.length - 1]);

                        // 오디오 데이터 전송
                        socketRef.current.emit('audio_stream_data', {
                            stream_id: streamIdRef.current,
                            data: audioDataArray,
                            sampleRate: audioContextRef.current?.sampleRate,
                            channelCount: 1,
                        });
                    } catch (error) {
                        console.error('오디오 데이터 처리 중 오류:', error);
                    }
                };

                // 오디오 처리 연결
                mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(audioContextRef.current.destination);
                console.log('오디오 처리 연결 완료');

                // 비디오 요소에 스트림 연결
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.muted = true; // 비디오 요소 음소거
                    console.log('비디오 요소에 스트림 연결 완료');
                }

                // WebSocket 연결
                const socket = io('http://localhost:8000', {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 20000,
                    path: '/socket.io',
                    query: {
                        EIO: '4',
                        transport: 'websocket',
                    },
                    withCredentials: false,
                    forceNew: true,
                    autoConnect: true,
                    extraHeaders: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
                socketRef.current = socket;

                // 연결 이벤트 핸들러
                socket.on('connect', () => {
                    setIsConnected(true);
                    setConnectionStatus('connected');
                    console.log('=== WebSocket 연결 성공 ===');
                    console.log('연결 시간:', new Date().toISOString());
                    console.log('소켓 ID:', socket.id);
                    console.log('연결 상태:', socket.connected);
                    console.log('연결 옵션:', socket.io.opts);

                    // 참조 텍스트 설정 (연결 성공 후 1초 지연)
                    setTimeout(() => {
                        if (referenceText && referenceText.trim()) {
                            console.log('참조 텍스트 설정 시도:', referenceText);
                            socket.emit('reference', {
                                text: referenceText.trim(),
                            });
                        } else {
                            console.error('참조 텍스트가 비어있습니다.');
                            setConnectionStatus('disconnected');
                        }
                    }, 1000);
                });

                socket.on('connect_error', (error) => {
                    console.error('=== WebSocket 연결 오류 ===');
                    console.error('시간:', new Date().toISOString());
                    console.error('오류:', error);
                    console.error('연결 상태:', socket.connected);
                    console.error('연결 옵션:', socket.io.opts);
                    console.error('오류 상세:', error.message);
                    console.error('오류 스택:', error.stack);
                    setConnectionStatus('disconnected');
                });

                socket.on('error', (error) => {
                    console.error('=== Socket.IO 오류 ===');
                    console.error('시간:', new Date().toISOString());
                    console.error('오류:', error);
                    console.error('오류 상세:', error.message);
                    console.error('오류 스택:', error.stack);
                });

                socket.on('disconnect', (reason) => {
                    console.log('=== WebSocket 연결 해제 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('사유:', reason);
                    console.log('연결 상태:', socket.connected);
                    setConnectionStatus('disconnected');
                });

                socket.on('reconnect_attempt', (attemptNumber) => {
                    console.log('=== WebSocket 재연결 시도 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('시도 횟수:', attemptNumber);
                    setConnectionStatus('connecting');
                });

                socket.on('reconnect', (attemptNumber) => {
                    console.log('=== WebSocket 재연결 성공 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('시도 횟수:', attemptNumber);
                    console.log('연결 상태:', socket.connected);
                    setConnectionStatus('connected');
                });

                socket.on('reconnect_error', (error) => {
                    console.error('=== WebSocket 재연결 오류 ===');
                    console.error('시간:', new Date().toISOString());
                    console.error('오류:', error);
                    setConnectionStatus('disconnected');
                });

                socket.on('reconnect_failed', () => {
                    console.error('=== WebSocket 재연결 실패 ===');
                    console.error('시간:', new Date().toISOString());
                    setConnectionStatus('disconnected');
                });

                // 참조 텍스트 설정 응답 처리
                socket.on('reference_response', (response) => {
                    console.log('=== 참조 텍스트 설정 응답 ===');
                    console.log('응답:', response);

                    if (response.status === 'success') {
                        console.log('참조 텍스트 설정 성공');

                        // 스트림 ID 생성
                        streamIdRef.current = `stream_${Date.now()}`;
                        console.log('스트림 ID 생성:', streamIdRef.current);

                        // 오디오 스트림 시작
                        console.log('오디오 스트림 시작 시도');
                        socket.emit('audio_stream_start', {
                            stream_id: streamIdRef.current,
                        });

                        // 오디오 처리 설정
                        setupAudioProcessing(stream);
                    } else {
                        console.error('참조 텍스트 설정 실패:', response.error);
                        setConnectionStatus('disconnected');
                    }
                });

                // 스트림 상태 이벤트 처리
                socket.on('stream_status', (data) => {
                    console.log('=== 스트림 상태 변경 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('상태:', data);
                });

                // 스트림 에러 이벤트 처리
                socket.on('stream_error', (error) => {
                    console.error('=== 스트림 에러 ===');
                    console.error('시간:', new Date().toISOString());
                    console.error('에러:', error);

                    // 참조 텍스트 관련 에러인 경우 재시도
                    if (error.message === '참조 텍스트가 설정되지 않았습니다') {
                        console.log('참조 텍스트 재설정 시도...');
                        setTimeout(() => {
                            if (referenceText && referenceText.trim()) {
                                socket.emit('reference', {
                                    text: referenceText.trim(),
                                });
                            }
                        }, 1000);
                    }
                });

                // STT 결과 수신
                socket.on('stt-result', (data: { text: string }) => {
                    console.log('=== STT 결과 ===');
                    console.log('시간:', new Date().toISOString());
                    console.log('인식된 텍스트:', data.text);
                    console.log('전체 트랜스크립트:', transcript + '\n' + data.text);
                    console.log('================');

                    setTranscript((prev) => prev + '\n' + data.text);
                });

                // TensorFlow.js 모델 로드
                await tf.setBackend('webgl');
                const loadedModel = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'tfjs',
                        refineLandmarks: true,
                    }
                );
                setModel(loadedModel);

                // 얼굴 랜드마크 감지 루프
                const detectFace = async () => {
                    if (videoRef.current && model && canvasRef.current && avatarCanvasRef.current) {
                        const predictions = await model.estimateFaces(videoRef.current);

                        if (predictions.length > 0) {
                            const landmarks = predictions[0].keypoints;
                            const faceOval = landmarks.slice(0, 17);
                            const leftEye = landmarks.slice(33, 46);
                            const rightEye = landmarks.slice(263, 276);
                            const mouth = landmarks.slice(61, 76);

                            // 아바타 상태 업데이트
                            const newAvatarState: AvatarState = {
                                expression: 'neutral',
                                eyeBlink: {
                                    left: calculateEyeBlink(leftEye),
                                    right: calculateEyeBlink(rightEye),
                                },
                                mouthOpen: calculateMouthOpen(mouth),
                                headRotation: calculateHeadRotation(landmarks),
                            };

                            setAvatarState(newAvatarState);

                            // 아바타 렌더링
                            renderAvatar(avatarCanvasRef.current, newAvatarState);

                            // 서버에 아바타 상태 전송
                            if (socketRef.current) {
                                socketRef.current.emit('avatarState', newAvatarState);
                            }

                            // 캔버스에 랜드마크 그리기
                            const ctx = canvasRef.current.getContext('2d');
                            if (ctx) {
                                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                                ctx.strokeStyle = '#00FF00';
                                ctx.lineWidth = 2;

                                // 얼굴 윤곽
                                ctx.beginPath();
                                faceOval.forEach((point, i) => {
                                    if (i === 0) {
                                        ctx.moveTo(point.x, point.y);
                                    } else {
                                        ctx.lineTo(point.x, point.y);
                                    }
                                });
                                ctx.closePath();
                                ctx.stroke();

                                // 눈
                                drawLandmarks(ctx, leftEye);
                                drawLandmarks(ctx, rightEye);

                                // 입
                                drawLandmarks(ctx, mouth);
                            }
                        }
                    }
                    requestAnimationFrame(detectFace);
                };

                detectFace();

                // WebRTC 시그널링 이벤트 처리
                socket.on('offer', async (data) => {
                    try {
                        if (peerConnectionRef.current) {
                            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                            const answer = await peerConnectionRef.current.createAnswer();
                            await peerConnectionRef.current.setLocalDescription(answer);
                            socket.emit('answer', { answer });
                        }
                    } catch (error) {
                        console.error('Offer 처리 중 오류:', error);
                    }
                });

                socket.on('answer', async (data) => {
                    try {
                        if (peerConnectionRef.current) {
                            await peerConnectionRef.current.setRemoteDescription(
                                new RTCSessionDescription(data.answer)
                            );
                        }
                    } catch (error) {
                        console.error('Answer 처리 중 오류:', error);
                    }
                });

                socket.on('ice-candidate', async (data) => {
                    try {
                        if (peerConnectionRef.current) {
                            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                    } catch (error) {
                        console.error('ICE 후보 처리 중 오류:', error);
                    }
                });
            } catch (error) {
                console.error('초기화 중 오류 발생:', error);
                setConnectionStatus('disconnected');
            }
        };

        init();

        return () => {
            console.log('=== 컴포넌트 정리 시작 ===');

            // WebRTC 연결 정리
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                console.log('WebRTC 연결 종료');
            }

            // 오디오 처리 정리
            if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
                console.log('ScriptProcessor 연결 해제');
            }
            if (mediaStreamSourceRef.current) {
                mediaStreamSourceRef.current.disconnect();
                console.log('MediaStreamSource 연결 해제');
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                console.log('AudioContext 종료');
            }

            // 스트림 정리
            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    track.stop();
                    console.log('미디어 트랙 정지:', track.kind);
                });
            }

            // 소켓 연결 종료
            if (socketRef.current) {
                if (streamIdRef.current) {
                    socketRef.current.emit('audio_stream_end', {
                        stream_id: streamIdRef.current,
                    });
                    console.log('오디오 스트림 종료 이벤트 전송');
                }
                socketRef.current.disconnect();
                console.log('WebSocket 연결 종료');
            }

            console.log('=== 컴포넌트 정리 완료 ===');
        };
    }, []);

    const calculateEyeBlink = (eyePoints: Array<{ x: number; y: number }>): number => {
        if (eyePoints.length < 2) return 0;

        // 눈의 상단과 하단 점을 사용하여 깜빡임 계산
        const top = eyePoints[1];
        const bottom = eyePoints[4];
        const height = Math.abs(bottom.y - top.y);
        const maxHeight = 10; // 임계값

        return Math.min(height / maxHeight, 1);
    };

    const calculateMouthOpen = (mouthPoints: Array<{ x: number; y: number }>): number => {
        if (mouthPoints.length < 2) return 0;

        // 입의 상단과 하단 점을 사용하여 벌림 정도 계산
        const top = mouthPoints[0];
        const bottom = mouthPoints[6];
        const height = Math.abs(bottom.y - top.y);
        const maxHeight = 20; // 임계값

        return Math.min(height / maxHeight, 1);
    };

    const calculateHeadRotation = (landmarks: Keypoint[]): { x: number; y: number; z: number } => {
        if (landmarks.length < 1) return { x: 0, y: 0, z: 0 };

        // 간단한 머리 회전 계산 (실제로는 더 복잡한 계산 필요)
        const nose = landmarks[0];
        return {
            x: Math.min(Math.max((nose.z || 0) * 10, -1), 1),
            y: Math.min(Math.max(nose.x * 10, -1), 1),
            z: Math.min(Math.max(nose.y * 10, -1), 1),
        };
    };

    const drawLandmarks = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) => {
        ctx.beginPath();
        points.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath();
        ctx.stroke();
    };

    // 오디오 토글 함수
    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                setIsListening(audioTrack.enabled);
            }
        }
    };

    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minHeight: '100vh',
                    py: 4,
                    gap: 4,
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom>
                    실시간 대화 연습
                </Typography>

                {/* 연결 상태 표시 */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        mb: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor:
                                    connectionStatus === 'connected'
                                        ? '#4CAF50'
                                        : connectionStatus === 'connecting'
                                        ? '#FFC107'
                                        : '#F44336',
                            }}
                        />
                        <Typography variant="body1">
                            {connectionStatus === 'connected'
                                ? '연결됨'
                                : connectionStatus === 'connecting'
                                ? '연결 중...'
                                : '연결 해제'}
                        </Typography>
                    </Box>
                </Box>

                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                    }}
                >
                    {/* 참조 텍스트 표시 */}
                    <Box sx={{ width: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            참조 텍스트
                        </Typography>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2,
                                bgcolor: '#f5f5f5',
                                borderRadius: 1,
                            }}
                        >
                            <Typography variant="body1">{referenceText}</Typography>
                        </Paper>
                    </Box>

                    {/* 비디오 및 아바타 표시 */}
                    <Box sx={{ display: 'flex', gap: 4, width: '100%' }}>
                        {/* 사용자 비디오 */}
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                style={{
                                    width: '100%',
                                    borderRadius: '8px',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            <canvas
                                ref={canvasRef}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                        </Box>

                        {/* 아바타 */}
                        <Box sx={{ flex: 1 }}>
                            <canvas
                                ref={avatarCanvasRef}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '8px',
                                    backgroundColor: '#f0f0f0',
                                }}
                            />
                        </Box>
                    </Box>

                    {/* 오디오 컨트롤 */}
                    <Box sx={{ width: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            오디오 설정
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 2,
                                border: '1px solid #ccc',
                                borderRadius: 1,
                            }}
                        >
                            <IconButton onClick={toggleAudio} color={isAudioEnabled ? 'primary' : 'default'}>
                                {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                            <Typography>{isAudioEnabled ? '마이크 켜짐' : '마이크 꺼짐'}</Typography>
                        </Box>
                    </Box>

                    {/* STT 결과 표시 */}
                    <Box sx={{ width: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            음성 인식 결과
                        </Typography>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2,
                                bgcolor: '#f5f5f5',
                                maxHeight: '200px',
                                overflow: 'auto',
                            }}
                        >
                            <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                                {transcript || '인식된 텍스트가 여기에 표시됩니다...'}
                            </Typography>
                        </Paper>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="contained" color="primary" onClick={() => navigate('/feedback')}>
                            연습 종료
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Practice;
