import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Container, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import { io, Socket } from 'socket.io-client';
import { FaceLandmarks, AvatarState, Keypoint } from '../../types/face';
import { renderAvatar } from '../../utils/avatarRenderer';

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
    const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
        'disconnected'
    );
    const [iceConnectionState, setIceConnectionState] = useState<string>('');

    useEffect(() => {
        const init = async () => {
            try {
                setConnectionStatus('connecting');

                // WebRTC 피어 연결 설정
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                });
                setPeerConnection(pc);

                // ICE 연결 상태 모니터링
                pc.oniceconnectionstatechange = () => {
                    setIceConnectionState(pc.iceConnectionState);
                    console.log('ICE 연결 상태:', pc.iceConnectionState);
                };

                // 비디오 스트림 설정
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                setLocalStream(stream);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // 스트림을 피어 연결에 추가
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                // ICE 후보 생성 시 서버로 전송
                pc.onicecandidate = (event) => {
                    if (event.candidate && socketRef.current) {
                        socketRef.current.emit('ice-candidate', {
                            candidate: event.candidate,
                        });
                    }
                };

                // 원격 스트림 수신 시 처리
                pc.ontrack = (event) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = event.streams[0];
                    }
                };

                // WebSocket 연결
                const socket = io('ws://localhost:8000/ws/audio', {
                    transports: ['websocket'],
                    upgrade: false,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 20000,
                    path: '/ws/audio/socket.io',
                    withCredentials: true, // CORS credentials 허용
                    extraHeaders: {
                        'Access-Control-Allow-Origin': 'http://localhost:3000', // React 개발 서버 주소
                        'Access-Control-Allow-Credentials': 'true',
                    },
                });
                socketRef.current = socket;

                socket.on('connect', () => {
                    setIsConnected(true);
                    setConnectionStatus('connected');
                    console.log('WebSocket 연결 성공');
                });

                socket.on('connect_error', (error) => {
                    console.error('WebSocket 연결 오류:', error);
                    setConnectionStatus('disconnected');
                    // CORS 관련 오류인 경우 명시적으로 표시
                    if (error.message.includes('CORS')) {
                        console.error('CORS 오류 발생. 서버의 CORS 설정을 확인해주세요.');
                    }
                });

                socket.on('disconnect', (reason) => {
                    setIsConnected(false);
                    setConnectionStatus('disconnected');
                    console.log('WebSocket 연결 해제:', reason);
                });

                socket.on('error', (error) => {
                    console.error('WebSocket 오류:', error);
                    setConnectionStatus('disconnected');
                });

                // 연결 시도
                socket.connect();

                // 시그널링 메시지 처리
                socket.on('offer', async (offer) => {
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit('answer', answer);
                    }
                });

                socket.on('answer', async (answer) => {
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                });

                socket.on('ice-candidate', async (candidate) => {
                    if (pc) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
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
            } catch (error) {
                console.error('초기화 중 오류 발생:', error);
                setConnectionStatus('disconnected');
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (peerConnection) {
                peerConnection.close();
            }
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
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
                        gap: 2,
                        alignItems: 'center',
                        mb: 2,
                    }}
                >
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
                    {iceConnectionState && (
                        <Typography variant="body2" color="text.secondary">
                            (ICE: {iceConnectionState})
                        </Typography>
                    )}
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
