import React from 'react';
import { Box, Typography, Container, Paper, Grid, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Feedback: React.FC = () => {
    const navigate = useNavigate();

    // TODO: 실제 분석 데이터로 대체
    const feedbackData = {
        pronunciation: 85,
        intonation: 75,
        speed: 90,
        clarity: 80,
    };

    const getFeedbackColor = (score: number) => {
        if (score >= 90) return 'success.main';
        if (score >= 70) return 'warning.main';
        return 'error.main';
    };

    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    py: 4,
                    gap: 4,
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom>
                    스피치 분석 결과
                </Typography>

                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        width: '100%',
                    }}
                >
                    <div style={{ display: 'grid', gap: '24px' }}>
                        {Object.entries(feedbackData).map(([key, value]) => (
                            <div key={key}>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        {key === 'pronunciation' && '발음 정확도'}
                                        {key === 'intonation' && '억양'}
                                        {key === 'speed' && '속도'}
                                        {key === 'clarity' && '명료성'}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ width: '100%' }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={value}
                                                sx={{
                                                    height: 10,
                                                    borderRadius: 5,
                                                    backgroundColor: 'grey.200',
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor: getFeedbackColor(value),
                                                    },
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            {value}%
                                        </Typography>
                                    </Box>
                                </Box>
                            </div>
                        ))}
                    </div>

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <button
                            onClick={() => navigate('/practice')}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            다시 연습하기
                        </button>
                        <button
                            onClick={() => navigate('/profile')}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'white',
                                color: '#1976d2',
                                border: '1px solid #1976d2',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            프로필 확인
                        </button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Feedback;
